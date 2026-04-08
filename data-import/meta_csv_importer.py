#!/usr/bin/env python3
"""
PlanFlow Meta CSV Importer — Sprint 3C-meta

Imports Meta Ads Manager CSV exports (Campaigns, Ad-sets, Ads) into PlanFlow.
Creates clients, media plans, media plan rows, and campaign actuals.

Usage:
    python3 meta_csv_importer.py --dry-run    # preview without DB writes
    python3 meta_csv_importer.py              # actual import

Prerequisites:
    - PostgreSQL running on port 5435 (docker compose up -d)
    - psycopg2-binary installed
"""

import argparse
import csv
import logging
import os
import sys
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional

import psycopg2
import psycopg2.extras

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DB_DSN = "host=localhost port=5432 dbname=planflow_prod user=planflow password=Pf@2026!xK9mWq"
META_EXPORTS_DIR = Path(__file__).parent / "meta-exports"
LOG_FILE = Path(__file__).parent / "meta-import.log"
ADMIN_USER_ID = "8767a0bd-dede-45fe-96ec-3141c7338579"

# Ad account → client name mapping
AD_ACCOUNT_MAP = {
    "SLR_CBL-Tiara": "CBL Tiara",
    "SLR_Softlogic-Supermarkets_Glomark": "Softlogic Supermarkets",
    "Teddy-SL-_-Primary": "Teddy SL",
}

# Meta result indicator → PlanFlow objective
RESULT_INDICATOR_MAP = {
    "reach": "awareness",
    "actions:post_engagement": "engagement",
    "actions:like": "engagement",
    "profile_visit_view": "engagement",
    "actions:link_click": "traffic",
    "actions:omni_landing_page_view": "traffic",
    "actions:click_to_call_native_call_placed": "traffic",
    "actions:offsite_conversion.fb_pixel_purchase": "leads",
    "actions:offsite_conversion.fb_pixel_view_content": "leads",
    "actions:leadgen.other": "leads",
    "actions:onsite_conversion.messaging_conversation_started_7d": "leads",
    "video_thruplay_watched_actions": "awareness",
    "video_continuous_2_sec_watched_actions": "awareness",
}

# Result indicators that map to specific actuals fields
CLICKS_INDICATORS = {"actions:link_click"}
VIDEO_INDICATORS = {"video_thruplay_watched_actions", "video_continuous_2_sec_watched_actions"}
LEADS_INDICATORS = {
    "actions:leadgen.other",
    "actions:onsite_conversion.messaging_conversation_started_7d",
}
ENGAGEMENT_INDICATORS = {
    "actions:post_engagement",
    "actions:like",
    "profile_visit_view",
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("meta-importer")


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------
@dataclass
class CampaignRow:
    """Parsed row from a Campaigns CSV."""
    account_key: str
    campaign_name: str
    delivery: str
    results: Optional[float]
    result_indicator: str
    cost_per_result: Optional[float]
    spend: float
    impressions: int
    reach: int
    end_date: Optional[date]
    post_engagements: Optional[int]
    # Enriched from ad-sets/ads
    start_date: Optional[date] = None
    aggregated_engagements: Optional[int] = None


@dataclass
class ImportStats:
    """Tracks import statistics."""
    clients_created: int = 0
    clients_existing: int = 0
    plans_created: int = 0
    plans_skipped: int = 0
    rows_created: int = 0
    actuals_created: int = 0
    actuals_updated: int = 0
    actuals_skipped: int = 0


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------
def safe_float(val: str) -> Optional[float]:
    """Parse a string to float, returning None for empty/invalid values."""
    if not val or val.strip() in ("", "-", "N/A"):
        return None
    try:
        return float(val.strip().replace(",", ""))
    except (ValueError, InvalidOperation):
        return None


def safe_int(val: str) -> Optional[int]:
    """Parse a string to int, returning None for empty/invalid values."""
    f = safe_float(val)
    if f is None:
        return None
    return int(f)


def safe_date(val: str) -> Optional[date]:
    """Parse YYYY-MM-DD date string, returning None for invalid values."""
    if not val or val.strip() in ("", "-", "N/A", "0"):
        return None
    try:
        return datetime.strptime(val.strip()[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def detect_account_key(filename: str) -> Optional[str]:
    """Extract the ad account key from a filename."""
    for key in AD_ACCOUNT_MAP:
        if filename.startswith(key):
            return key
    return None


def detect_file_type(filename: str) -> Optional[str]:
    """Detect if file is Campaigns, Ad-sets, or Ads."""
    lower = filename.lower()
    if "-campaigns-" in lower:
        return "campaigns"
    if "-ad-sets-" in lower or "-adsets-" in lower:
        return "adsets"
    if "-ads-" in lower:
        return "ads"
    return None


# ---------------------------------------------------------------------------
# CSV reading
# ---------------------------------------------------------------------------
def read_campaigns_csv(path: Path, account_key: str) -> list[CampaignRow]:
    """Read a Campaigns CSV and return parsed rows (skipping summary row)."""
    rows = []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            name = raw.get("Campaign name", "").strip()
            if not name:
                continue  # skip account-level summary row

            spend = safe_float(raw.get("Amount spent (LKR)", "0")) or 0.0
            if spend <= 0:
                continue  # skip zero-spend campaigns

            rows.append(CampaignRow(
                account_key=account_key,
                campaign_name=name,
                delivery=raw.get("Campaign delivery", "").strip(),
                results=safe_float(raw.get("Results", "")),
                result_indicator=raw.get("Result indicator", "").strip(),
                cost_per_result=safe_float(raw.get("Cost per results", "")),
                spend=spend,
                impressions=safe_int(raw.get("Impressions", "0")) or 0,
                reach=safe_int(raw.get("Reach", "0")) or 0,
                end_date=safe_date(raw.get("Ends", "")),
                post_engagements=safe_int(raw.get("Post engagements", "")),
            ))
    return rows


def read_adsets_start_dates(path: Path) -> dict[str, date]:
    """
    Read Ad-sets CSV to extract the earliest start date per campaign.
    Ad-set names follow patterns like "CampaignName_AdSetSuffix" — but we
    don't have a direct campaign name column in ad-sets. Instead, we match
    ad-set names to campaigns by prefix or use the Starts column.

    Since ad-sets don't have a "Campaign name" column, we collect ALL start
    dates and return a mapping of ad_set_name → start_date. The caller will
    need to match these to campaigns via the Ads CSV (which has both ad name
    and ad set name).
    """
    adset_starts: dict[str, date] = {}
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            name = raw.get("Ad set name", "").strip()
            if not name:
                continue
            start = safe_date(raw.get("Starts", ""))
            if start and (name not in adset_starts or start < adset_starts[name]):
                adset_starts[name] = start
    return adset_starts


def read_ads_csv(path: Path) -> dict[str, int]:
    """
    Read Ads CSV to aggregate post engagements per ad-set name.

    Note: "Post engagements" column only exists in CBL Tiara's CSVs.
    For Softlogic/Teddy, this returns an empty dict — we derive engagements
    from the Results column in campaigns CSV instead.
    """
    adset_engagements: dict[str, int] = defaultdict(int)
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if "Post engagements" not in (reader.fieldnames or []):
            return {}
        for raw in reader:
            adset_name = raw.get("Ad set name", "").strip()
            if not adset_name:
                continue
            eng = safe_int(raw.get("Post engagements", ""))
            if eng and eng > 0:
                adset_engagements[adset_name] += eng

    return dict(adset_engagements)


def build_campaign_adset_map_from_adsets(
    adsets_path: Path,
) -> dict[str, set[str]]:
    """
    We don't have campaign name in ad-sets CSV, but we CAN use the campaign
    name embedded in ad-set naming conventions. However, this is unreliable.

    Better approach: read the ad-sets file and group by campaign delivery
    pattern. Actually, the most reliable way is to match via the API or
    by using the Ads CSV which has "Ad set name" we can trace back.

    For start dates: we'll use a different strategy — match campaign names
    to ad-set names using fuzzy substring matching.
    """
    # Read all ad-set names and their starts
    adset_data: dict[str, dict] = {}
    with open(adsets_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            name = raw.get("Ad set name", "").strip()
            if not name:
                continue
            start = safe_date(raw.get("Starts", ""))
            end = safe_date(raw.get("Ends", ""))
            adset_data[name] = {"start": start, "end": end}
    return adset_data


def _extract_year_from_name(name: str) -> Optional[int]:
    """Extract a 4-digit year from a campaign/ad-set name."""
    import re
    # Match explicit years like "2023", "2024", "2025"
    years = re.findall(r"\b(20[2-3]\d)\b", name)
    if years:
        return int(years[-1])  # last occurrence is usually most specific
    # Match date suffixes like "29Aug2025", "01Sep2025"
    date_match = re.findall(r"\d{1,2}[A-Za-z]{3}(20[2-3]\d)", name)
    if date_match:
        return int(date_match[-1])
    return None


def _tokenize_name(name: str) -> set[str]:
    """Split a campaign/ad-set name into significant tokens."""
    return set(
        t for t in name.lower().replace("|", " ").replace("_", " ").replace("-", " ").split()
        if len(t) > 2
    )


def match_campaign_start_dates(
    campaigns: list[CampaignRow],
    adset_data: dict[str, dict],
) -> None:
    """
    For each campaign, find matching ad-sets and extract the earliest start date.

    Matching strategy:
    1. Exact campaign name appears as prefix/substring in ad-set name
    2. Key words from campaign name appear in ad-set name
    Both strategies also check year consistency when a year is present in
    the campaign name, to avoid "October 2023 Engagement" matching an
    ad-set from October 2025.
    """
    for camp in campaigns:
        camp_name_lower = camp.campaign_name.lower().strip()
        camp_year = _extract_year_from_name(camp.campaign_name)
        camp_tokens = _tokenize_name(camp.campaign_name)
        earliest_start = None

        for adset_name, data in adset_data.items():
            adset_lower = adset_name.lower()
            start = data.get("start")
            if not start:
                continue

            # Year guard: if campaign has a year, ad-set start must be in the same
            # year or at most 1 year prior (campaigns can start in Dec of prior year)
            if camp_year is not None:
                adset_year = _extract_year_from_name(adset_name)
                if adset_year is not None and abs(adset_year - camp_year) > 1:
                    continue
                # Also check actual start date year
                if abs(start.year - camp_year) > 1:
                    continue

            # Strategy 1: Campaign name is substring of ad-set name
            if camp_name_lower in adset_lower:
                if earliest_start is None or start < earliest_start:
                    earliest_start = start
                continue

            # Strategy 2: Token overlap ≥ 60%
            adset_tokens = _tokenize_name(adset_name)
            if camp_tokens and len(camp_tokens & adset_tokens) >= len(camp_tokens) * 0.6:
                if earliest_start is None or start < earliest_start:
                    earliest_start = start

        # Final sanity check: if campaign has a year and matched start is >1 year off
        if earliest_start and camp_year and abs(earliest_start.year - camp_year) > 1:
            earliest_start = None

        camp.start_date = earliest_start


def aggregate_engagements_to_campaigns(
    campaigns: list[CampaignRow],
    adset_engagements: dict[str, int],
    adset_data: dict[str, dict],
) -> None:
    """
    For campaigns without post_engagements (Softlogic, Teddy), aggregate
    from ads CSV data grouped by ad-set, then matched to campaigns.
    """
    for camp in campaigns:
        if camp.post_engagements is not None and camp.post_engagements > 0:
            continue  # already has engagements from campaigns CSV

        camp_name_lower = camp.campaign_name.lower().strip()
        total_eng = 0

        for adset_name, eng_count in adset_engagements.items():
            adset_lower = adset_name.lower()

            # Same matching strategy as start dates
            if camp_name_lower in adset_lower:
                total_eng += eng_count
                continue

            camp_tokens = set(
                t for t in camp_name_lower.replace("|", " ").replace("_", " ").split()
                if len(t) > 2
            )
            adset_tokens = set(
                t for t in adset_lower.replace("|", " ").replace("_", " ").split()
                if len(t) > 2
            )
            if camp_tokens and len(camp_tokens & adset_tokens) >= len(camp_tokens) * 0.6:
                total_eng += eng_count

        if total_eng > 0:
            camp.aggregated_engagements = total_eng


# ---------------------------------------------------------------------------
# Database operations
# ---------------------------------------------------------------------------
def get_or_create_client(
    cur, client_name: str, dry_run: bool
) -> str:
    """Find existing client by name or create new one. Returns client UUID."""
    # Exact match first
    cur.execute("SELECT id FROM clients WHERE LOWER(name) = LOWER(%s)", (client_name,))
    row = cur.fetchone()
    if row:
        return row[0]

    # Fuzzy: check if any existing client name is a substring
    cur.execute("SELECT id, name FROM clients")
    for cid, cname in cur.fetchall():
        if cname.lower() in client_name.lower() or client_name.lower() in cname.lower():
            log.info(f"  Fuzzy matched client '{client_name}' → existing '{cname}' ({cid})")
            return cid

    # Create new
    new_id = str(uuid.uuid4())
    if not dry_run:
        cur.execute(
            """INSERT INTO clients (id, name, default_fee_1_pct, default_fee_1_label, default_currency)
               VALUES (%s, %s, 15, 'Management Fee', 'LKR')""",
            (new_id, client_name),
        )
    log.info(f"  {'[DRY-RUN] Would create' if dry_run else 'Created'} client: {client_name} ({new_id})")
    return new_id


def get_next_ref_number(cur, year: int) -> str:
    """Get the next JM-YYYY-NNN reference number."""
    cur.execute(
        "SELECT reference_number FROM media_plans WHERE reference_number LIKE %s ORDER BY reference_number DESC LIMIT 1",
        (f"JM-{year}-%",),
    )
    row = cur.fetchone()
    if row and row[0]:
        try:
            last_num = int(row[0].split("-")[-1])
            return f"JM-{year}-{str(last_num + 1).zfill(3)}"
        except (ValueError, IndexError):
            pass
    return f"JM-{year}-001"


def find_existing_plan(cur, campaign_name: str, client_id: str) -> Optional[str]:
    """Check if a media plan already exists for this campaign+client."""
    cur.execute(
        "SELECT id FROM media_plans WHERE campaign_name = %s AND client_id = %s LIMIT 1",
        (campaign_name, client_id),
    )
    row = cur.fetchone()
    return row[0] if row else None


def find_existing_actual(
    cur, plan_id: str, period_start: Optional[date], period_end: Optional[date]
) -> Optional[str]:
    """Check if an actual already exists for this plan+period."""
    if period_start and period_end:
        cur.execute(
            "SELECT id FROM campaign_actuals WHERE plan_id = %s AND period_start = %s AND period_end = %s LIMIT 1",
            (plan_id, period_start, period_end),
        )
    else:
        cur.execute(
            "SELECT id FROM campaign_actuals WHERE plan_id = %s AND period_start IS NULL AND period_end IS NULL LIMIT 1",
            (plan_id,),
        )
    row = cur.fetchone()
    return row[0] if row else None


def map_objective(result_indicator: str) -> str:
    """Map Meta result indicator to PlanFlow objective."""
    return RESULT_INDICATOR_MAP.get(result_indicator, "awareness")


def compute_derived_metrics(
    spend: float, impressions: int, reach: int
) -> dict:
    """Calculate CPM, frequency from raw numbers."""
    cpm = (spend / impressions) * 1000 if impressions > 0 else None
    frequency = impressions / reach if reach > 0 else None
    return {"cpm": cpm, "frequency": frequency}


# ---------------------------------------------------------------------------
# Main import logic
# ---------------------------------------------------------------------------
def discover_files() -> dict[str, dict[str, Path]]:
    """
    Discover CSV files in META_EXPORTS_DIR grouped by account.
    Returns: {account_key: {"campaigns": Path, "adsets": Path, "ads": Path}}
    """
    accounts: dict[str, dict[str, Path]] = defaultdict(dict)

    for f in sorted(META_EXPORTS_DIR.iterdir()):
        if not f.name.endswith(".csv") or ":Zone" in f.name:
            continue

        account_key = detect_account_key(f.name)
        file_type = detect_file_type(f.name)

        if account_key and file_type:
            accounts[account_key][file_type] = f

    return dict(accounts)


def import_account(
    cur,
    account_key: str,
    files: dict[str, Path],
    stats: ImportStats,
    dry_run: bool,
    ref_counter: list[int],
) -> list[dict]:
    """Import a single ad account's data. Returns list of plan summaries for report."""
    client_name = AD_ACCOUNT_MAP[account_key]
    log.info(f"\n{'='*60}")
    log.info(f"Processing account: {account_key} → client: {client_name}")
    log.info(f"{'='*60}")

    # Step 2A: Client resolution
    client_id = get_or_create_client(cur, client_name, dry_run)
    if client_id:
        # Check if this was newly created (no prior id)
        cur.execute("SELECT name FROM clients WHERE id = %s", (client_id,))
        existing = cur.fetchone()
        if existing and existing[0].lower() == client_name.lower():
            log.info(f"  Client resolved: {client_name} → {client_id}")
        else:
            stats.clients_created += 1

    # Read campaigns CSV
    campaigns_path = files.get("campaigns")
    if not campaigns_path:
        log.warning(f"  No campaigns CSV found for {account_key}")
        return []

    campaigns = read_campaigns_csv(campaigns_path, account_key)
    log.info(f"  Read {len(campaigns)} campaigns with spend > 0")

    # Read ad-sets for start dates
    adsets_path = files.get("adsets")
    adset_data = {}
    if adsets_path:
        adset_data = build_campaign_adset_map_from_adsets(adsets_path)
        log.info(f"  Read {len(adset_data)} ad-sets for start date matching")
        match_campaign_start_dates(campaigns, adset_data)
        matched_starts = sum(1 for c in campaigns if c.start_date is not None)
        log.info(f"  Matched start dates for {matched_starts}/{len(campaigns)} campaigns")

    # Read ads CSV for engagement aggregation
    ads_path = files.get("ads")
    adset_engagements = {}
    if ads_path:
        adset_engagements = read_ads_csv(ads_path)
        log.info(f"  Read engagements from {len(adset_engagements)} ad-sets in Ads CSV")
        aggregate_engagements_to_campaigns(campaigns, adset_engagements, adset_data)
        enriched_eng = sum(
            1 for c in campaigns
            if c.aggregated_engagements is not None and c.aggregated_engagements > 0
        )
        log.info(f"  Enriched engagements for {enriched_eng} campaigns from Ads CSV")

    # Step 2B & 2C: Process each campaign
    plan_summaries = []
    year = datetime.now().year

    for camp in campaigns:
        # Check for existing plan
        existing_plan_id = find_existing_plan(cur, camp.campaign_name, client_id)

        if existing_plan_id:
            plan_id = existing_plan_id
            stats.plans_skipped += 1
            log.debug(f"  Plan exists: {camp.campaign_name} → {plan_id}")
        else:
            # Create new media plan
            plan_id = str(uuid.uuid4())
            ref_num = f"JM-{year}-{str(ref_counter[0]).zfill(3)}"
            ref_counter[0] += 1

            objective = map_objective(camp.result_indicator)

            if not dry_run:
                cur.execute(
                    """INSERT INTO media_plans
                       (id, client_id, campaign_name, total_budget, currency, status,
                        variant_name, reference_number, start_date, end_date,
                        management_fee_pct, fee_1_label, notes)
                       VALUES (%s, %s, %s, %s, 'LKR', 'sent', 'Option 1', %s, %s, %s,
                               15, 'Management Fee', %s)""",
                    (
                        plan_id,
                        client_id,
                        camp.campaign_name,
                        round(camp.spend, 2),
                        ref_num,
                        camp.start_date,
                        camp.end_date,
                        f"Imported from Meta Ads Manager ({account_key})",
                    ),
                )

            stats.plans_created += 1

            # Create a media plan row
            row_id = str(uuid.uuid4())
            if not dry_run:
                cur.execute(
                    """INSERT INTO media_plan_rows
                       (id, plan_id, platform, objective, budget, audience_type,
                        audience_name, sort_order, country, buy_type)
                       VALUES (%s, %s, 'Meta', %s, %s, 'mass',
                               'Local - Mass', 0, 'Sri Lanka', 'Auction')""",
                    (row_id, plan_id, objective, round(camp.spend, 2)),
                )
            stats.rows_created += 1

        # Step 2C: Create/update actuals
        period_start = camp.start_date
        period_end = camp.end_date

        # Determine engagement value:
        # 1. From "Post engagements" column (CBL Tiara only)
        # 2. From aggregated ads CSV (if enrichment found matches)
        # 3. From Results column when indicator is an engagement type
        engagements = camp.post_engagements
        if (engagements is None or engagements == 0) and camp.aggregated_engagements:
            engagements = camp.aggregated_engagements
        if (engagements is None or engagements == 0) and camp.result_indicator in ENGAGEMENT_INDICATORS and camp.results:
            engagements = int(camp.results)

        # Map results to specific fields based on indicator
        actual_clicks = None
        actual_video_views = None
        actual_leads = None
        if camp.result_indicator in CLICKS_INDICATORS and camp.results:
            actual_clicks = int(camp.results)
        elif camp.result_indicator in VIDEO_INDICATORS and camp.results:
            actual_video_views = int(camp.results)
        elif camp.result_indicator in LEADS_INDICATORS and camp.results:
            actual_leads = int(camp.results)

        derived = compute_derived_metrics(camp.spend, camp.impressions, camp.reach)

        existing_actual_id = find_existing_actual(cur, plan_id, period_start, period_end)

        if existing_actual_id:
            # Update existing actual
            if not dry_run:
                cur.execute(
                    """UPDATE campaign_actuals SET
                       actual_impressions = %s, actual_reach = %s,
                       actual_spend = %s, actual_engagements = %s,
                       actual_clicks = %s, actual_video_views = %s,
                       actual_leads = %s, actual_cpm = %s,
                       actual_frequency = %s, source = 'meta_csv',
                       updated_at = NOW()
                       WHERE id = %s""",
                    (
                        camp.impressions,
                        camp.reach,
                        round(camp.spend, 2),
                        engagements,
                        actual_clicks,
                        actual_video_views,
                        actual_leads,
                        round(derived["cpm"], 4) if derived["cpm"] else None,
                        round(derived["frequency"], 2) if derived["frequency"] else None,
                        existing_actual_id,
                    ),
                )
            stats.actuals_updated += 1
        else:
            # Create new actual
            actual_id = str(uuid.uuid4())
            period_label = None
            if period_start and period_end:
                period_label = f"{period_start.strftime('%b %Y')}"
            elif period_end:
                end_dt = period_end
                period_label = f"Until {end_dt.strftime('%b %Y')}"

            if not dry_run:
                cur.execute(
                    """INSERT INTO campaign_actuals
                       (id, plan_id, period_label, period_start, period_end,
                        actual_impressions, actual_reach, actual_clicks,
                        actual_engagements, actual_video_views, actual_leads,
                        actual_spend, actual_cpm, actual_frequency,
                        source, notes)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                               'meta_csv', %s)""",
                    (
                        actual_id,
                        plan_id,
                        period_label,
                        period_start,
                        period_end,
                        camp.impressions,
                        camp.reach,
                        actual_clicks,
                        engagements,
                        actual_video_views,
                        actual_leads,
                        round(camp.spend, 2),
                        round(derived["cpm"], 4) if derived["cpm"] else None,
                        round(derived["frequency"], 2) if derived["frequency"] else None,
                        f"Meta CSV import: {camp.result_indicator or 'no indicator'}",
                    ),
                )
            stats.actuals_created += 1

        plan_summaries.append({
            "campaign": camp.campaign_name,
            "client": client_name,
            "plan_id": plan_id,
            "ref": ref_num if not existing_plan_id else "(existing)",
            "objective": map_objective(camp.result_indicator),
            "spend": camp.spend,
            "impressions": camp.impressions,
            "reach": camp.reach,
            "engagements": engagements,
            "start": str(camp.start_date) if camp.start_date else "—",
            "end": str(camp.end_date) if camp.end_date else "—",
            "actual_status": "updated" if existing_plan_id else "new",
        })

    return plan_summaries


def print_report(
    all_summaries: list[dict],
    stats: ImportStats,
    dry_run: bool,
) -> None:
    """Print a formatted import report."""
    prefix = "[DRY-RUN] " if dry_run else ""

    log.info(f"\n{'='*80}")
    log.info(f"{prefix}IMPORT REPORT")
    log.info(f"{'='*80}")

    # Group by client
    by_client: dict[str, list[dict]] = defaultdict(list)
    for s in all_summaries:
        by_client[s["client"]].append(s)

    for client, summaries in sorted(by_client.items()):
        log.info(f"\n--- {client} ({len(summaries)} campaigns) ---")
        total_spend = sum(s["spend"] for s in summaries)
        total_impr = sum(s["impressions"] for s in summaries)
        log.info(f"  Total spend: LKR {total_spend:,.2f}")
        log.info(f"  Total impressions: {total_impr:,}")

        # Show first 10 campaigns as sample
        for s in summaries[:10]:
            eng_str = f", eng={s['engagements']:,}" if s["engagements"] else ""
            log.info(
                f"  [{s['actual_status']:>7}] {s['ref']:>12} | "
                f"{s['objective']:<12} | LKR {s['spend']:>12,.2f} | "
                f"impr={s['impressions']:>12,} | reach={s['reach']:>10,}{eng_str}"
            )
            log.info(f"           {s['campaign'][:70]}")
            log.info(f"           dates: {s['start']} → {s['end']}")

        if len(summaries) > 10:
            log.info(f"  ... and {len(summaries) - 10} more campaigns")

    log.info(f"\n{'='*80}")
    log.info(f"{prefix}SUMMARY")
    log.info(f"{'='*80}")
    log.info(f"  Clients created:    {stats.clients_created}")
    log.info(f"  Plans created:      {stats.plans_created}")
    log.info(f"  Plans skipped:      {stats.plans_skipped} (already exist)")
    log.info(f"  Plan rows created:  {stats.rows_created}")
    log.info(f"  Actuals created:    {stats.actuals_created}")
    log.info(f"  Actuals updated:    {stats.actuals_updated}")
    log.info(f"  Actuals skipped:    {stats.actuals_skipped}")
    log.info(f"  Total campaigns:    {stats.plans_created + stats.plans_skipped}")


def main():
    parser = argparse.ArgumentParser(description="Import Meta Ads CSV exports into PlanFlow")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB writes")
    args = parser.parse_args()

    dry_run = args.dry_run
    if dry_run:
        log.info("=" * 60)
        log.info("DRY RUN MODE — no database changes will be made")
        log.info("=" * 60)

    # Discover files
    accounts = discover_files()
    if not accounts:
        log.error(f"No CSV files found in {META_EXPORTS_DIR}")
        sys.exit(1)

    log.info(f"Found {len(accounts)} ad accounts:")
    for key, files in accounts.items():
        log.info(f"  {key}: {', '.join(files.keys())}")

    # Connect to database
    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Get the current max reference number to continue the sequence
        cur.execute(
            "SELECT reference_number FROM media_plans "
            "WHERE reference_number LIKE %s "
            "ORDER BY reference_number DESC LIMIT 1",
            (f"JM-{datetime.now().year}-%",),
        )
        row = cur.fetchone()
        if row and row[0]:
            last_num = int(row[0].split("-")[-1])
        else:
            last_num = 0
        ref_counter = [last_num + 1]
        log.info(f"Reference number sequence starts at: JM-{datetime.now().year}-{str(ref_counter[0]).zfill(3)}")

        stats = ImportStats()
        all_summaries = []

        for account_key in sorted(accounts.keys()):
            files = accounts[account_key]
            summaries = import_account(
                cur, account_key, files, stats, dry_run, ref_counter
            )
            all_summaries.extend(summaries)

        # Print full report
        print_report(all_summaries, stats, dry_run)

        if dry_run:
            log.info("\nDry run complete. No changes were made. Run without --dry-run to import.")
            conn.rollback()
        else:
            conn.commit()
            log.info("\nImport committed successfully.")

    except Exception as e:
        conn.rollback()
        log.error(f"Import failed, rolled back: {e}", exc_info=True)
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
