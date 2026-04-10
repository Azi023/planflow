#!/usr/bin/env python3
"""
PlanFlow Production Importer — reads plans.json and imports into planflow_prod.

Safety rules:
- Never deletes existing data
- Skips plans that already exist (by campaign_name + client_id)
- Imports plans with status='sent' (historical)
- Uses exact DB column names from schema
"""

import json
import os
import sys
import uuid
from datetime import datetime

import psycopg2
import psycopg2.extras

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "planflow_prod",
    "user": "planflow",
    "password": "Pf@2026!xK9mWq",
}

PLANS_JSON = os.path.expanduser("~/workspace/planflow/data-import/output/plans.json")

# ---------------------------------------------------------------------------
# Client name → DB id mapping (filled at runtime)
# ---------------------------------------------------------------------------
CLIENT_MAP: dict[str, str] = {}  # normalized_name → uuid

# ---------------------------------------------------------------------------
# Product name → DB id mapping (filled at runtime)
# ---------------------------------------------------------------------------
PRODUCT_MAP: dict[str, str] = {}  # "client_id|product_name" → uuid

# ---------------------------------------------------------------------------
# Platform normalization: plans.json platform → DB canonical platform
# ---------------------------------------------------------------------------
PLATFORM_NORM: dict[str, str] = {
    "meta": "Meta + IG",
    "meta_ig": "Meta + IG",
    "meta+ig": "Meta + IG",
    "meta + ig": "Meta + IG",
    "meta+instagram": "Meta + IG",
    "meta/instagram": "Meta + IG",
    "meta(facebok/instagram)": "Meta + IG",
    "meta(facebook/instagram)": "Meta + IG",
    "meta (facebook/instagram)": "Meta + IG",
    "meta/ig": "Meta + IG",
    "facebook/instagram": "Meta + IG",
    "fb/ig": "Meta + IG",
    "ig": "IG only",
    "ig only": "IG only",
    "instagram": "IG only",
    "instagram only": "IG only",
    "meta only": "Meta only",
    "facebook": "Meta only",
    "facebook only": "Meta only",
    "fb only": "Meta only",
    "ig follower": "IG Follower",
    "instagram follower": "IG Follower",
    "meta page like": "Meta Page Like",
    "facebook page like": "Meta Page Like",
    "page like": "Meta Page Like",
    "fb page like": "Meta Page Like",
    "gdn": "GDN",
    "google display": "GDN",
    "google display network": "GDN",
    "display": "GDN",
    "youtube video": "YouTube Video Views",
    "youtube video views": "YouTube Video Views",
    "youtube": "YouTube Video Views",
    "yt": "YouTube Video Views",
    "youtube bumper": "YouTube Bumper",
    "bumper": "YouTube Bumper",
    "search": "Search",
    "google search": "Search",
    "google ads": "Search",
    "demand gen": "Demand Gen",
    "demand generation": "Demand Gen",
    "demandgen": "Demand Gen",
    "performance max": "Performance Max",
    "perf max": "Performance Max",
    "pmax": "Performance Max",
    "performance maximum": "Performance Max",
}

# ---------------------------------------------------------------------------
# Objective normalization
# ---------------------------------------------------------------------------
OBJECTIVE_NORM: dict[str, str] = {
    "awareness": "Awareness",
    "brand awareness": "Awareness",
    "reach": "Awareness",
    "video views": "Awareness",
    "views": "Awareness",
    "engagement": "Engagement",
    "engagements": "Engagement",
    "post engagement": "Engagement",
    "traffic": "Traffic",
    "link clicks": "Traffic",
    "website traffic": "Traffic",
    "leads": "Leads",
    "lead generation": "Leads",
    "lead gen": "Leads",
    "conversions": "Leads",
    "messages": "Engagement",
    "page likes": "Engagement",
    "followers": "Engagement",
}


def normalize_platform(raw: str) -> str:
    if not raw:
        return "Meta + IG"
    key = raw.strip().lower()
    return PLATFORM_NORM.get(key, raw.strip() or "Meta + IG")


def normalize_objective(raw: str) -> str:
    if not raw:
        return "Awareness"
    key = raw.strip().lower()
    return OBJECTIVE_NORM.get(key, "Awareness")


def normalize_client_name(name: str) -> str:
    n = name.lower().strip()
    if "peoples" in n or "people" in n:
        return "People's Bank"
    if "fonterra" in n:
        return "Fonterra"
    return name.strip()


def load_plans() -> list[dict]:
    with open(PLANS_JSON) as f:
        return json.load(f)


def load_db_clients(conn) -> dict[str, str]:
    """Returns {normalized_name: id}"""
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("SELECT id, name FROM clients ORDER BY name")
        rows = cur.fetchall()
    result = {}
    for r in rows:
        result[r["name"]] = str(r["id"])
        result[normalize_client_name(r["name"])] = str(r["id"])
        result[r["name"].lower()] = str(r["id"])
    return result


def load_db_products(conn) -> dict[str, str]:
    """Returns {"client_id|product_name": id}"""
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("SELECT id, client_id, name FROM products ORDER BY name")
        rows = cur.fetchall()
    result = {}
    for r in rows:
        key = f"{r['client_id']}|{r['name']}"
        result[key] = str(r["id"])
        result[f"{r['client_id']}|{r['name'].lower()}"] = str(r["id"])
    return result


def load_existing_plan_names(conn) -> set[str]:
    """Returns set of existing (campaign_name, client_id) tuples as strings."""
    with conn.cursor() as cur:
        cur.execute("SELECT campaign_name, client_id FROM media_plans")
        rows = cur.fetchall()
    return {f"{r[0]}|{r[1]}" for r in rows}


def ensure_product(conn, client_id: str, product_name: str) -> str | None:
    """Get or create a product, return its id."""
    if not product_name or product_name == "Unknown":
        return None

    key = f"{client_id}|{product_name}"
    if key in PRODUCT_MAP:
        return PRODUCT_MAP[key]

    # Check DB
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM products WHERE client_id=%s AND name=%s",
            (client_id, product_name)
        )
        row = cur.fetchone()
        if row:
            pid = str(row[0])
            PRODUCT_MAP[key] = pid
            return pid

    # Create it
    pid = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO products (id, client_id, name, created_at) VALUES (%s, %s, %s, NOW())",
            (pid, client_id, product_name)
        )
    conn.commit()
    PRODUCT_MAP[key] = pid
    print(f"  [NEW PRODUCT] {product_name} (client_id={client_id[:8]}...)")
    return pid


def import_plan(conn, plan: dict, existing_names: set[str], stats: dict) -> bool:
    """Import a single plan and its rows. Returns True if imported."""

    # Resolve client
    client_raw = plan.get("client", "")
    client_norm = normalize_client_name(client_raw)
    client_id = CLIENT_MAP.get(client_norm) or CLIENT_MAP.get(client_raw)
    if not client_id:
        # Try case-insensitive
        for k, v in CLIENT_MAP.items():
            if k.lower() == client_norm.lower():
                client_id = v
                break
    if not client_id:
        stats["skipped_no_client"] += 1
        return False

    # Resolve product
    product_name = plan.get("product", "")
    product_id = None
    if product_name and product_name != "Unknown":
        product_id = ensure_product(conn, client_id, product_name)

    # Campaign name
    campaign_name = (plan.get("campaign_name") or plan.get("name") or "").strip()
    if not campaign_name:
        # Generate from product + client
        campaign_name = f"{client_raw} - {product_name or 'Campaign'}"

    # Check duplicate
    dup_key = f"{campaign_name}|{client_id}"
    if dup_key in existing_names:
        stats["skipped_duplicate"] += 1
        return False

    # Budget and fees
    total_budget = plan.get("total_budget") or 0
    currency = (plan.get("currency") or "LKR").upper()[:3]
    if currency not in ("LKR", "USD"):
        currency = "LKR"

    # Fee: Fonterra uses 12%, others use 15%
    if "fonterra" in client_norm.lower():
        mgmt_fee_pct = 12.0
    else:
        mgmt_fee_pct = plan.get("management_fee_pct") or 15.0
    if mgmt_fee_pct is None or mgmt_fee_pct == 0:
        mgmt_fee_pct = 15.0

    # Other fields
    campaign_period = (plan.get("campaign_period") or "").strip()[:50] or None
    notes = (plan.get("notes") or plan.get("strategic_notes") or "").strip() or None
    reference_number = (plan.get("reference_number") or "").strip()[:50] or None
    prepared_by = (plan.get("prepared_by") or "").strip()[:100] or None

    # Source file → reference
    source_file = plan.get("source_file", "")

    plan_id = str(uuid.uuid4())

    now = datetime.utcnow()

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO media_plans (
                id, client_id, product_id, campaign_name, campaign_period,
                total_budget, management_fee_pct, fee_1_label,
                currency, variant_name, notes, status,
                reference_number, prepared_by,
                buffer_pct, share_enabled,
                created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s
            )
            """,
            (
                plan_id, client_id, product_id, campaign_name, campaign_period,
                total_budget or None, mgmt_fee_pct, "Management Fee",
                currency, "Option 1", notes, "sent",
                reference_number, prepared_by,
                0.0, False,
                now, now,
            )
        )

    # Import rows
    rows = plan.get("rows", [])
    row_count = 0
    for sort_order, row in enumerate(rows):
        platform_raw = row.get("platform_raw") or row.get("platform") or ""
        platform = normalize_platform(platform_raw)

        objective_raw = row.get("objective") or ""
        objective = normalize_objective(objective_raw)

        audience_type = (row.get("audience_type") or "").strip() or None
        # Normalize audience type
        if audience_type:
            at_lower = audience_type.lower()
            if "mass" in at_lower:
                audience_type = "mass"
            elif "niche" in at_lower:
                audience_type = "niche"
            else:
                audience_type = None

        audience_name = (row.get("audience_name") or "").strip()[:100] or None
        audience_size = (row.get("audience_size") or "").strip()[:100] or None
        targeting_criteria = (row.get("targeting") or row.get("targeting_criteria") or "").strip() or None
        creative = (row.get("creative") or "").strip()[:100] or None
        country = (row.get("country") or "Sri Lanka").strip()[:50]
        buy_type = (row.get("buy_type") or "Auction").strip()[:50]

        budget = row.get("budget")
        if budget is not None:
            try:
                budget = float(budget)
            except (TypeError, ValueError):
                budget = None

        percentage = row.get("percentage")
        if percentage is not None:
            try:
                percentage = float(percentage)
            except (TypeError, ValueError):
                percentage = None

        # KPIs from the scan
        kpis = row.get("kpis") or {}
        projected_kpis = {}
        if isinstance(kpis, dict):
            # Map scanner KPI keys to DB format
            kpi_key_map = {
                "impressions_low": "impressionsLow",
                "impressions_high": "impressionsHigh",
                "reach_low": "reachLow",
                "reach_high": "reachHigh",
                "clicks_low": "clicksLow",
                "clicks_high": "clicksHigh",
                "video_views_low": "videoViewsLow",
                "video_views_high": "videoViewsHigh",
                "cpm": "cpm",
                "cpc": "cpc",
                "cpl": "cpl",
                "ctr": "ctr",
                "frequency_low": "frequencyLow",
                "frequency_high": "frequencyHigh",
            }
            for k, v in kpis.items():
                mapped = kpi_key_map.get(k, k)
                if v is not None:
                    projected_kpis[mapped] = v

        row_id = str(uuid.uuid4())

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO media_plan_rows (
                    id, plan_id, platform, audience_type, ad_type, objective,
                    audience_name, audience_size, targeting_criteria, creative,
                    budget, projected_kpis, sort_order,
                    country, buy_type, percentage
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s
                )
                """,
                (
                    row_id, plan_id, platform, audience_type, None, objective,
                    audience_name, audience_size, targeting_criteria, creative,
                    budget, json.dumps(projected_kpis), sort_order,
                    country, buy_type, percentage,
                )
            )
        row_count += 1

    conn.commit()
    existing_names.add(dup_key)
    stats["plans_imported"] += 1
    stats["rows_imported"] += row_count
    return True


def main():
    print("=== PlanFlow Production Importer ===")
    print(f"Plans JSON: {PLANS_JSON}")

    # Load plans
    plans = load_plans()
    print(f"Loaded {len(plans)} plans from plans.json")

    # Connect to DB
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    print("Connected to DB")

    # Load reference data
    global CLIENT_MAP, PRODUCT_MAP
    CLIENT_MAP = load_db_clients(conn)
    PRODUCT_MAP = load_db_products(conn)
    existing_names = load_existing_plan_names(conn)

    print(f"DB clients: {len(set(CLIENT_MAP.values()))}")
    print(f"DB products: {len(PRODUCT_MAP)}")
    print(f"Existing plans: {len(existing_names)}")

    stats = {
        "plans_imported": 0,
        "rows_imported": 0,
        "skipped_duplicate": 0,
        "skipped_no_client": 0,
        "errors": 0,
    }

    products_created_before = len(PRODUCT_MAP)

    for i, plan in enumerate(plans):
        try:
            import_plan(conn, plan, existing_names, stats)
        except Exception as e:
            conn.rollback()
            print(f"  ERROR on plan #{i}: {e}")
            print(f"    Plan: {plan.get('campaign_name')} | {plan.get('client')} | {plan.get('product')}")
            stats["errors"] += 1

        if (i + 1) % 50 == 0:
            print(f"  Progress: {i+1}/{len(plans)} processed, {stats['plans_imported']} imported...")

    products_created = (len(PRODUCT_MAP) - products_created_before) // 2  # keys stored twice

    print("\n=== IMPORT COMPLETE ===")
    print(f"Plans imported:      {stats['plans_imported']}")
    print(f"Rows imported:       {stats['rows_imported']}")
    print(f"Products created:    {products_created}")
    print(f"Skipped (duplicate): {stats['skipped_duplicate']}")
    print(f"Skipped (no client): {stats['skipped_no_client']}")
    print(f"Errors:              {stats['errors']}")

    conn.close()


if __name__ == "__main__":
    main()
