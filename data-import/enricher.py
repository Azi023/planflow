#!/usr/bin/env python3
"""
PlanFlow Data Enrichment — Fill missing fields in imported plans.

Re-scans raw Excel files to extract:
- Audience names from targeting/audience columns
- Creative types from ad type columns
- Country from targeting text or filename context
- Buy type from buy type columns
- Campaign dates from filenames, sheet names, period cells

Then updates existing plans in the database via the API.
"""

import json
import re
import os
import subprocess
import sys
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional

import openpyxl
import requests

API_BASE = "http://localhost:3001/api"
RAW_DIR = Path(__file__).parent / "raw"
OUTPUT_DIR = Path(__file__).parent / "output"

log = logging.getLogger("enricher")
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

# ─── Auth ──────────────────────────────────────────────────────────────────────

def get_token() -> str:
    resp = requests.post(f"{API_BASE}/auth/login", json={
        "email": "admin@jasminmedia.com",
        "password": "admin123"
    })
    resp.raise_for_status()
    return resp.json()["access_token"]

# ─── Creative Type Normalization ───────────────────────────────────────────────

CREATIVE_CATEGORIES = {
    "static": ["static", "statics", "static post", "image", "photo", "banner", "poster"],
    "video": ["video", "main video", "hero video", "tvc", "film", "asset", "vertical asset", "produced"],
    "carousel": ["carousel"],
    "gif": ["gif", "gifs"],
    "bumper": ["bumper", "bumper ad", "6sec", "5sec"],
    "animated_banner": ["animated banner", "animated", "animation"],
    "display_banner": ["display banner", "display", "gdn banner", "responsive"],
    "vertical_content": ["vertical", "vertical content", "reel", "highlight reel", "snippet"],
    "story_ad": ["story", "story ad"],
    "album": ["album", "photo album"],
    "video_cuts": ["cuts", "video cuts", "cut"],
    "main_video": ["main video", "hero film", "main asset", "teaser"],
}

def normalize_creative(raw: str) -> str:
    """Extract a normalized creative category from a raw description."""
    if not raw:
        return ""
    lower = raw.lower().strip()

    for category, keywords in CREATIVE_CATEGORIES.items():
        for kw in keywords:
            if kw in lower:
                return category.replace("_", " ").title()

    # Try count + type pattern: "3 Statics" → "Static"
    count_match = re.match(r'(\d+)\s*(.*)', lower)
    if count_match:
        type_part = count_match.group(2).strip()
        for category, keywords in CREATIVE_CATEGORIES.items():
            for kw in keywords:
                if kw in type_part:
                    return category.replace("_", " ").title()

    return raw[:50] if len(raw) > 50 else raw

# ─── Country Extraction ────────────────────────────────────────────────────────

def extract_country(targeting_text: str, filename: str, audience_name: str) -> str:
    """Infer country from targeting text, filename, or audience context."""
    combined = f"{targeting_text or ''} {filename or ''} {audience_name or ''}".lower()

    if "kuwait" in combined:
        return "Kuwait"
    if "middle east" in combined or "overseas" in combined or "foreign" in combined:
        return "Middle East"
    if "global" in combined:
        return "Global"
    if "all island" in combined or "sri lanka" in combined or "colombo" in combined:
        return "Sri Lanka"
    if "northern" in combined or "eastern" in combined or "southern" in combined:
        return "Sri Lanka"
    if "tamil" in combined and "nadu" in combined:
        return "India"

    return "Sri Lanka"

# ─── Audience Name Extraction ──────────────────────────────────────────────────

KNOWN_AUDIENCES = [
    "Advantage+ Audience",
    "Mass Audience",
    "Local audience",
    "Overseas Sri Lankans",
    "Tamil Audience",
    "Parents with preschoolers",
    "Parents with teenagers",
    "SMEs",
    "Engaged Shoppers",
    "Mass Youth 18-34",
    "All Island 18+",
    "Young Adults 18-25",
    "Professionals 25-45",
    "Women 25-45",
    "Men 25-45",
]

def extract_audience_name(targeting_text: str, audience_raw: str, audience_size: str) -> str:
    """Extract a meaningful audience name from available data."""
    if audience_raw and len(audience_raw) > 3 and audience_raw.lower() not in ("mass", "niche", "—", "-"):
        return audience_raw

    combined = f"{targeting_text or ''} {audience_size or ''}".lower()

    for name in KNOWN_AUDIENCES:
        if name.lower() in combined:
            return name

    if not targeting_text:
        return ""

    loc_match = re.search(r'location\s*[:\-]\s*([^\n,]+)', targeting_text, re.IGNORECASE)
    age_match = re.search(r'age\s*[:\-]\s*(\d+)\s*(?:to|-)\s*(\d+)', targeting_text, re.IGNORECASE)
    gender_match = re.search(r'gender\s*[:\-]\s*(\w+)', targeting_text, re.IGNORECASE)

    parts = []
    if loc_match:
        loc = loc_match.group(1).strip()
        if len(loc) < 30:
            parts.append(loc)
    if gender_match:
        gender = gender_match.group(1).strip().title()
        if gender in ("Male", "Female"):
            parts.append(gender)
    if age_match:
        parts.append(f"{age_match.group(1)}-{age_match.group(2)}")

    if parts:
        return " ".join(parts)

    combined_lower = f"{targeting_text or ''}".lower()
    if "advantage+" in combined_lower or "advantage +" in combined_lower:
        return "Advantage+ Audience"

    return ""

# ─── Buy Type Extraction ──────────────────────────────────────────────────────

def extract_buy_type(buy_type_raw: str, objective: str) -> str:
    """Extract buy type from raw data or infer from objective."""
    if buy_type_raw:
        lower = buy_type_raw.lower().strip()
        if "auction" in lower:
            return "Auction"
        if "reach" in lower and "frequency" in lower:
            return "Reach & Frequency"
        if "cpm" in lower:
            return "CPM"
        if "cpv" in lower:
            return "CPV"
        return buy_type_raw.strip()

    return "Auction"

# ─── Date Extraction from Filenames ────────────────────────────────────────────

MONTH_MAP = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "februay": 2,
    "mar": 3, "march": 3, "apr": 4, "april": 4, "aptil": 4,
    "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "september": 9, "sept": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

def extract_dates_from_context(filename: str, sheet_name: str, campaign_period: str, campaign_name: str) -> tuple:
    """Try to extract start_date and end_date from filename, sheet name, or campaign period."""
    combined = f"{filename} {sheet_name} {campaign_name}".lower()

    month_year = re.search(
        r'(january|february|februay|march|april|aptil|may|june|july|august|september|october|november|december|'
        r'jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s*[-_]?\s*(\d{4}|\d{2})\b',
        combined
    )

    start_date = None
    end_date = None

    if month_year:
        month_str = month_year.group(1)
        year_str = month_year.group(2)

        month = MONTH_MAP.get(month_str)
        if month:
            year = int(year_str)
            if year < 100:
                year += 2000

            start_date = f"{year}-{month:02d}-01"
            if month == 12:
                end_date = f"{year}-12-31"
            else:
                next_month_first = datetime(year, month + 1, 1)
                last_day = next_month_first - timedelta(days=1)
                end_date = last_day.strftime("%Y-%m-%d")

    # Refine end_date using campaign_period duration
    if campaign_period and start_date:
        period_lower = campaign_period.lower().strip()

        week_match = re.search(r'(\d+)\s*week', period_lower)
        day_match = re.search(r'(\d+)\s*day', period_lower)
        month_match = re.search(r'(\d+)\s*month', period_lower)

        duration_days = None
        if day_match:
            duration_days = int(day_match.group(1))
        elif week_match:
            duration_days = int(week_match.group(1)) * 7
        elif month_match:
            duration_days = int(month_match.group(1)) * 30

        if duration_days:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_date = (start_dt + timedelta(days=duration_days - 1)).strftime("%Y-%m-%d")

    # Fallback: KPI folder name provides month context
    if not start_date:
        folder_match = re.search(
            r'(january|february|march|april|may|june|july|august|september|october|november|december)\s*kpi',
            combined
        )
        if folder_match:
            month = MONTH_MAP.get(folder_match.group(1))
            if month:
                year = 2026 if "2026" in combined else 2025
                start_date = f"{year}-{month:02d}-01"
                if month == 12:
                    end_date = f"{year}-12-31"
                else:
                    next_month_first = datetime(year, month + 1, 1)
                    last_day = next_month_first - timedelta(days=1)
                    end_date = last_day.strftime("%Y-%m-%d")

    return start_date, end_date

# ─── API Helpers ───────────────────────────────────────────────────────────────

def load_existing_plans(headers: dict) -> list:
    """Load all plans from the API."""
    resp = requests.get(f"{API_BASE}/media-plans", headers=headers)
    resp.raise_for_status()
    return resp.json()

def find_matching_plan(plans: list, campaign_name: str, source_file: str) -> dict | None:
    """Find the matching plan in the database by name or source file."""
    if not campaign_name:
        return None

    campaign_lower = campaign_name.lower().strip()

    for plan in plans:
        plan_name = (plan.get("campaignName") or "").lower().strip()
        plan_notes = (plan.get("notes") or "").lower()

        if plan_name == campaign_lower:
            return plan

        if source_file and source_file.lower() in plan_notes:
            return plan

        if len(campaign_lower) > 5 and (campaign_lower in plan_name or plan_name in campaign_lower):
            return plan

    return None

def enrich_plan(plan: dict, enrichment: dict, headers: dict) -> bool:
    """Fetch the full plan and update it with enriched data, preserving existing values."""
    plan_id = plan["id"]

    # Fetch the full plan with rows
    resp = requests.get(f"{API_BASE}/media-plans/{plan_id}", headers=headers)
    if resp.status_code != 200:
        return False
    full_plan = resp.json()
    existing_rows = sorted(full_plan.get("rows", []), key=lambda r: r.get("sortOrder", 0))

    # Build plan-level update — only fill in missing date fields
    update: dict = {
        "campaignName": full_plan.get("campaignName"),
        "variantName": full_plan.get("variantName", "Option 1"),
        "clientId": full_plan.get("clientId"),
        "productId": full_plan.get("productId"),
        "campaignPeriod": full_plan.get("campaignPeriod"),
        "totalBudget": full_plan.get("totalBudget"),
        "fee1Pct": full_plan.get("fee1Pct"),
        "currency": full_plan.get("currency"),
        "notes": full_plan.get("notes"),
    }

    changed = False

    if enrichment.get("start_date") and not full_plan.get("startDate"):
        update["startDate"] = enrichment["start_date"]
        changed = True
    else:
        update["startDate"] = full_plan.get("startDate")

    if enrichment.get("end_date") and not full_plan.get("endDate"):
        update["endDate"] = enrichment["end_date"]
        changed = True
    else:
        update["endDate"] = full_plan.get("endDate")

    # Merge enrichment data into rows (only fill empty fields)
    enriched_rows = enrichment.get("rows", [])
    merged_rows = []

    for idx, existing_row in enumerate(existing_rows):
        row_payload = {
            "platform": existing_row.get("platform", "meta"),
            "objective": existing_row.get("objective"),
            "audienceType": existing_row.get("audienceType"),
            "audienceName": existing_row.get("audienceName"),
            "audienceSize": existing_row.get("audienceSize"),
            "targetingCriteria": existing_row.get("targetingCriteria"),
            "creative": existing_row.get("creative"),
            "country": existing_row.get("country"),
            "buyType": existing_row.get("buyType"),
            "budget": existing_row.get("budget"),
            "benchmarkId": existing_row.get("benchmarkId"),
            "projectedKpis": existing_row.get("projectedKpis", {}),
            "sortOrder": existing_row.get("sortOrder", idx),
            "notes": existing_row.get("notes"),
            "adType": existing_row.get("adType"),
            "platformRangeCpm": existing_row.get("platformRangeCpm"),
            "platformRangeCpl": existing_row.get("platformRangeCpl"),
        }

        if idx < len(enriched_rows):
            er = enriched_rows[idx]

            if not row_payload.get("audienceName") and er.get("audience_name"):
                row_payload["audienceName"] = er["audience_name"]
                changed = True
            if not row_payload.get("creative") and er.get("creative"):
                row_payload["creative"] = er["creative"]
                changed = True
            if not row_payload.get("country") and er.get("country"):
                row_payload["country"] = er["country"]
                changed = True
            if not row_payload.get("buyType") and er.get("buy_type"):
                row_payload["buyType"] = er["buy_type"]
                changed = True

        merged_rows.append(row_payload)

    if not changed:
        return False

    update["rows"] = merged_rows

    try:
        resp = requests.put(f"{API_BASE}/media-plans/{plan_id}", headers=headers, json=update)
        return resp.status_code in (200, 201)
    except Exception as e:
        log.error(f"  Failed to update plan {plan_id}: {e}")
        return False

# ─── Excel Re-scan for Missing Fields ──────────────────────────────────────────

def rescan_file(filepath: Path) -> list:
    """Re-scan an Excel file to extract audience, creative, country, buy type, and dates."""
    plans_enrichment = []

    try:
        wb = openpyxl.load_workbook(str(filepath), data_only=True, read_only=True)
    except Exception:
        return []

    rel_path = str(filepath.relative_to(RAW_DIR))

    for ws in wb.worksheets:
        try:
            rows_data = list(ws.iter_rows(max_row=50, values_only=True))
        except Exception:
            continue

        if not rows_data:
            continue

        # Find header row (first row with 4+ non-empty string cells)
        header_row_idx = None
        headers: dict = {}

        for i, row in enumerate(rows_data[:20]):
            if not row:
                continue
            cell_count = sum(1 for c in row if c and isinstance(c, str) and len(str(c).strip()) > 1)
            if cell_count >= 4:
                candidate: dict = {}
                for j, cell in enumerate(row):
                    if cell and isinstance(cell, str):
                        candidate[str(cell).strip().lower()] = j
                if len(candidate) >= 4:
                    headers = candidate
                    header_row_idx = i
                    break

        if header_row_idx is None:
            continue

        # Extract campaign name from rows above the header
        campaign_name = None
        for i in range(header_row_idx):
            row = rows_data[i]
            for cell in row:
                if cell and isinstance(cell, str) and len(str(cell).strip()) > 5:
                    text = str(cell).strip()
                    if "media plan" in text.lower() or "campaign" in text.lower():
                        campaign_name = re.sub(r'media plan\s*[-–—]\s*', '', text, flags=re.IGNORECASE).strip()
                        if len(campaign_name) < 3:
                            campaign_name = text
                        break
            if campaign_name:
                break

        # Map header columns to known field names
        col_map: dict = {}
        for key in headers:
            if any(x in key for x in ["targeting", "detailed targeting", "target audience"]):
                col_map.setdefault("targeting", headers[key])
            elif any(x in key for x in ["audience name", "audiences", "audience "]):
                col_map.setdefault("audience_name", headers[key])
            elif any(x in key for x in ["audience size", "estimated audience"]):
                col_map.setdefault("audience_size", headers[key])
            elif any(x in key for x in ["ad type", "creative", "assets", "content"]):
                col_map.setdefault("creative", headers[key])
            elif any(x in key for x in ["country", "location", "geo"]):
                col_map.setdefault("country", headers[key])
            elif any(x in key for x in ["buy type", "buying type", "auction"]):
                col_map.setdefault("buy_type", headers[key])
            elif any(x in key for x in ["campaign period", "duration", "period"]):
                col_map.setdefault("campaign_period", headers[key])
            elif any(x in key for x in ["objective", "channels"]):
                col_map.setdefault("objective", headers[key])

        def get_col(name: str, row: tuple) -> str:
            idx = col_map.get(name)
            if idx is not None and idx < len(row) and row[idx]:
                return str(row[idx]).strip()
            return ""

        # Extract enrichment data from each data row
        enrichment_rows = []
        for i in range(header_row_idx + 1, min(len(rows_data), header_row_idx + 30)):
            row = rows_data[i]
            if not row or not any(c for c in row if c):
                continue

            # Skip total/summary rows
            first_cell = str(row[0] or "").lower().strip()
            if first_cell in ("total", "total media spend", "grand total"):
                continue

            targeting = get_col("targeting", row)
            audience_raw = get_col("audience_name", row)
            audience_size = get_col("audience_size", row)
            creative_raw = get_col("creative", row)
            country_raw = get_col("country", row)
            buy_type_raw = get_col("buy_type", row)
            objective_raw = get_col("objective", row)

            enrichment_rows.append({
                "audience_name": extract_audience_name(targeting, audience_raw, audience_size),
                "creative": normalize_creative(creative_raw) if creative_raw else "",
                "country": country_raw if country_raw else extract_country(targeting, rel_path, audience_raw),
                "buy_type": extract_buy_type(buy_type_raw, objective_raw.lower() if objective_raw else "awareness"),
            })

        if not enrichment_rows:
            continue

        # Extract campaign period from first data row
        campaign_period = ""
        if "campaign_period" in col_map:
            for i in range(header_row_idx + 1, min(len(rows_data), header_row_idx + 5)):
                row = rows_data[i]
                val = get_col("campaign_period", row)
                if val:
                    campaign_period = val
                    break

        start_date, end_date = extract_dates_from_context(
            rel_path, ws.title, campaign_period, campaign_name or ""
        )

        plans_enrichment.append({
            "source_file": rel_path,
            "source_sheet": ws.title,
            "campaign_name": campaign_name,
            "start_date": start_date,
            "end_date": end_date,
            "rows": enrichment_rows,
        })

    wb.close()
    return plans_enrichment

# ─── Bulk SQL Defaults ─────────────────────────────────────────────────────────

def run_psql(sql: str, label: str) -> None:
    """Run a SQL statement via psql and print the result."""
    env = {**os.environ, "PGPASSWORD": "planflow_dev"}
    result = subprocess.run(
        ["psql", "-h", "localhost", "-p", "5435", "-U", "planflow", "-d", "planflow", "-c", sql],
        env=env, capture_output=True, text=True,
    )
    if result.returncode == 0:
        print(f"  ✓ {label}: {result.stdout.strip()}")
    else:
        print(f"  ✗ {label} failed: {result.stderr.strip()}")

# ─── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("PlanFlow Data Enrichment — Fill Missing Fields")
    print("=" * 60)

    # Auth
    print("\nAuthenticating...")
    token = get_token()
    auth_headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print("✓ Authenticated")

    # Load existing plans
    print("Loading existing plans from database...")
    existing_plans = load_existing_plans(auth_headers)
    print(f"✓ {len(existing_plans)} plans loaded")

    # Scan all Excel files
    print(f"\nScanning {RAW_DIR} for enrichment data...")
    all_enrichments: list = []
    xlsx_files = sorted(RAW_DIR.rglob("*.xlsx"))
    xlsx_files = [f for f in xlsx_files if not f.name.startswith("~$") and "Zone.Identifier" not in f.name]

    for filepath in xlsx_files:
        enrichments = rescan_file(filepath)
        all_enrichments.extend(enrichments)

    print(f"✓ {len(all_enrichments)} plan enrichments extracted from {len(xlsx_files)} files")

    # Match plans and update
    stats = {"matched": 0, "updated": 0, "skipped": 0, "unmatched": 0, "failed": 0}

    print(f"\nMatching and updating plans...")
    print("-" * 60)

    for enrichment in all_enrichments:
        campaign_name = enrichment.get("campaign_name", "")
        source_file = enrichment.get("source_file", "")

        plan = find_matching_plan(existing_plans, campaign_name, source_file)

        if plan:
            stats["matched"] += 1
            success = enrich_plan(plan, enrichment, auth_headers)
            if success:
                stats["updated"] += 1
                log.info(f"  ✓ Updated: {campaign_name[:60]}")
            else:
                stats["skipped"] += 1
        else:
            stats["unmatched"] += 1
            log.debug(f"  - No match: {(campaign_name or '')[:60]}")

    # Bulk SQL defaults for any rows still missing country or buy_type
    print("\nApplying bulk defaults via SQL...")
    run_psql(
        "UPDATE media_plan_rows SET country = 'Sri Lanka' WHERE country IS NULL OR country = '';",
        "Set default country = Sri Lanka"
    )
    run_psql(
        "UPDATE media_plan_rows SET buy_type = 'Auction' WHERE buy_type IS NULL OR buy_type = '';",
        "Set default buy_type = Auction"
    )

    # Summary
    print("\n" + "=" * 60)
    print("ENRICHMENT COMPLETE")
    print("=" * 60)
    print(f"  Plans matched:   {stats['matched']}")
    print(f"  Plans updated:   {stats['updated']}")
    print(f"  Plans skipped (no changes needed): {stats['skipped']}")
    print(f"  Plans unmatched: {stats['unmatched']}")
    print(f"  Update failures: {stats['failed']}")

    # Verification
    print("\nField coverage after enrichment:")
    run_psql("""
        SELECT
            'audience_name' AS field,
            count(CASE WHEN audience_name IS NOT NULL AND audience_name != '' THEN 1 END) AS filled,
            count(*) AS total,
            round(100.0 * count(CASE WHEN audience_name IS NOT NULL AND audience_name != '' THEN 1 END) / NULLIF(count(*),0), 1) AS pct
        FROM media_plan_rows
        UNION ALL SELECT 'creative',
            count(CASE WHEN creative IS NOT NULL AND creative != '' THEN 1 END), count(*),
            round(100.0 * count(CASE WHEN creative IS NOT NULL AND creative != '' THEN 1 END) / NULLIF(count(*),0), 1)
        FROM media_plan_rows
        UNION ALL SELECT 'country',
            count(CASE WHEN country IS NOT NULL AND country != '' THEN 1 END), count(*),
            round(100.0 * count(CASE WHEN country IS NOT NULL AND country != '' THEN 1 END) / NULLIF(count(*),0), 1)
        FROM media_plan_rows
        UNION ALL SELECT 'buy_type',
            count(CASE WHEN buy_type IS NOT NULL AND buy_type != '' THEN 1 END), count(*),
            round(100.0 * count(CASE WHEN buy_type IS NOT NULL AND buy_type != '' THEN 1 END) / NULLIF(count(*),0), 1)
        FROM media_plan_rows;
    """, "Row field coverage")

    run_psql("""
        SELECT
            count(*) AS total_plans,
            count(CASE WHEN start_date IS NOT NULL THEN 1 END) AS has_start_date,
            count(CASE WHEN end_date IS NOT NULL THEN 1 END) AS has_end_date
        FROM media_plans;
    """, "Plan date coverage")


if __name__ == "__main__":
    main()
