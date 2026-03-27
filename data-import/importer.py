#!/usr/bin/env python3
"""
PlanFlow Data Importer — Phase 2: JSON → API

Reads scanner output from data-import/output/plans.json and actuals.json,
then creates media plans via the PlanFlow API.

Prerequisites:
  - PlanFlow API running on port 3001
  - scanner.py already run (output/plans.json exists)
  - Database seeded (clients, products, benchmarks exist)
"""

import json
import logging
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any, Optional

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
API_BASE = "http://localhost:3001/api"
ADMIN_EMAIL = "admin@jasminmedia.com"
ADMIN_PASSWORD = "admin123"

RAW_DIR = Path(__file__).parent / "output"
LOG_FILE = RAW_DIR / "importer.log"

# Clients whose fee is 12% + 6.25% ASP (Fonterra)
FONTERRA_CLIENTS = {"fonterra", "fonterra sri lanka"}

# Default management fee for everyone else
DEFAULT_FEE_PCT = 15.0

# Max rows per plan to import (prevent huge plans from crashing)
MAX_ROWS_PER_PLAN = 30

# Status to assign historical plans
HISTORICAL_STATUS = "approved"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
def setup_logging() -> logging.Logger:
    logger = logging.getLogger("importer")
    logger.setLevel(logging.DEBUG)
    fmt = logging.Formatter("[%(levelname)s] %(message)s")

    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    fh = logging.FileHandler(LOG_FILE, mode="w", encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)

    logger.addHandler(ch)
    logger.addHandler(fh)
    return logger


log = setup_logging()


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
def authenticate() -> dict[str, str]:
    """Login and return Authorization header dict."""
    resp = requests.post(f"{API_BASE}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    }, timeout=10)
    resp.raise_for_status()
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# DB helpers (for creating clients/products — no API POST endpoint exists)
# ---------------------------------------------------------------------------
DB_CMD = [
    "psql", "-h", "localhost", "-p", "5435", "-U", "planflow", "-d", "planflow",
    "-t", "-A",
]
DB_ENV = {"PGPASSWORD": "planflow_dev", "PATH": "/usr/bin:/bin"}

import os
DB_ENV["PATH"] = os.environ.get("PATH", "/usr/bin:/bin")


def db_exec(sql: str) -> str:
    """Run a SQL statement and return trimmed stdout."""
    result = subprocess.run(
        DB_CMD + ["-c", sql],
        capture_output=True, text=True, env=DB_ENV,
    )
    return result.stdout.strip()


# ---------------------------------------------------------------------------
# Client / Product resolution
# ---------------------------------------------------------------------------
def load_clients(headers: dict) -> dict[str, dict]:
    """Return {client_name_lower: client_obj} map (with nested products)."""
    resp = requests.get(f"{API_BASE}/clients", headers=headers, timeout=10)
    resp.raise_for_status()
    clients = resp.json()
    cache: dict[str, dict] = {}
    for c in clients:
        cache[c["name"].lower()] = c
        # Also index common abbreviations / alternative spellings
        n = c["name"].lower()
        if "peoples" in n or "people" in n:
            cache["peoples bank"] = c
            cache["people's bank"] = c
            cache["peoples bank"] = c
        if "fonterra" in n:
            cache["fonterra"] = c
    return cache


def load_products(clients_cache: dict) -> dict[str, dict]:
    """Return {client_id|product_name_lower: product_obj} map from nested client data."""
    cache: dict[str, dict] = {}
    for client in clients_cache.values():
        for p in client.get("products", []):
            key = f"{p['clientId']}|{p['name'].lower()}"
            cache[key] = p
    return cache


def ensure_client(name: str, clients_cache: dict) -> Optional[str]:
    """Get or create client via DB, return ID."""
    key = name.lower()
    if key in clients_cache:
        return clients_cache[key]["id"]
    # Create via DB
    new_id = str(uuid.uuid4())
    safe_name = name.replace("'", "''")
    db_exec(f"INSERT INTO clients (id, name) VALUES ('{new_id}', '{safe_name}') ON CONFLICT DO NOTHING;")
    clients_cache[key] = {"id": new_id, "name": name, "products": []}
    log.info(f"  Created client (DB): {name}")
    return new_id


def ensure_product(name: str, client_id: str, products_cache: dict) -> Optional[str]:
    """Get or create product via DB, return ID."""
    key = f"{client_id}|{name.lower()}"
    if key in products_cache:
        return products_cache[key]["id"]
    new_id = str(uuid.uuid4())
    safe_name = name.replace("'", "''")
    db_exec(f"INSERT INTO products (id, client_id, name) VALUES ('{new_id}', '{client_id}', '{safe_name}') ON CONFLICT DO NOTHING;")
    products_cache[key] = {"id": new_id, "clientId": client_id, "name": name}
    log.info(f"  Created product (DB): {name}")
    return new_id


# ---------------------------------------------------------------------------
# KPI normalization
# ---------------------------------------------------------------------------
# Map scanner kpis keys → projectedKpis nested structure expected by API
# The API expects: { reach: {low, high}, impressions: {low, high}, ... }
def build_projected_kpis(kpis: dict) -> dict:
    """Convert flat scanner kpis dict to nested API format."""
    def pair(low_key: str, high_key: str) -> Optional[dict]:
        lo = kpis.get(low_key)
        hi = kpis.get(high_key)
        if lo is None and hi is None:
            return None
        return {"low": lo, "high": hi}

    result = {}
    pairs = [
        ("reach", "reach_low", "reach_high"),
        ("impressions", "impressions_low", "impressions_high"),
        ("clicks", "clicks_low", "clicks_high"),
        ("leads", "leads_low", "leads_high"),
        ("videoViews", "video_views_low", "video_views_high"),
        ("engagements", "engagements_low", "engagements_high"),
        ("frequency", "frequency_low", "frequency_high"),
        ("cpm", "cpm_low", "cpm_high"),
        ("cpc", "cpc_low", "cpc_high"),
        ("cpl", "cpl_low", "cpl_high"),
        ("cpr", "cpr_low", "cpr_high"),
        ("cpv", "cpv_low", "cpv_high"),
        ("ctr", "ctr_low", "ctr_high"),
        ("landingPageViews", "landing_page_views_low", "landing_page_views_high"),
        ("pageLikes", "page_likes_low", "page_likes_high"),
    ]
    for api_key, lo_key, hi_key in pairs:
        p = pair(lo_key, hi_key)
        if p is not None:
            result[api_key] = p
    return result


# ---------------------------------------------------------------------------
# Plan row builder
# ---------------------------------------------------------------------------
def build_row_payload(row: dict, sort_order: int) -> dict:
    """Convert a scanner row dict into an API row payload."""
    projected_kpis = build_projected_kpis(row.get("kpis", {}))
    return {
        "platform": row.get("platform", "meta_ig"),
        "objective": row.get("objective") or "awareness",
        "audienceType": row.get("audience_type") or "mass",
        "audienceName": row.get("audience_name"),
        "audienceSize": row.get("audience_size"),
        "targetingCriteria": row.get("targeting"),
        "creative": row.get("creative"),
        "country": row.get("country"),
        "buyType": row.get("buy_type"),
        "campaignPeriod": row.get("campaign_period"),
        "budget": row.get("budget") or 0,
        "percentage": row.get("percentage"),
        "projectedKpis": projected_kpis,
        "sortOrder": sort_order,
        "notes": None,
    }


# ---------------------------------------------------------------------------
# Plan import
# ---------------------------------------------------------------------------
def import_plan(plan: dict, clients_cache: dict, products_cache: dict,
                headers: dict, stats: dict) -> bool:
    """Import a single plan. Returns True on success."""
    client_name = plan.get("client", "Unknown")
    product_name = plan.get("product", "Unknown")
    campaign_name = plan.get("campaign_name") or plan.get("source_sheet", "Imported Plan")
    rows = plan.get("rows", [])[:MAX_ROWS_PER_PLAN]

    if not rows:
        stats["skipped_no_rows"] += 1
        return False

    # Resolve client
    if client_name in ("Unknown", ""):
        client_name = "Imported Client"
    client_id = ensure_client(client_name, clients_cache)
    if not client_id:
        stats["failed"] += 1
        return False

    # Resolve product
    if product_name in ("Unknown", ""):
        product_name = campaign_name[:50] if campaign_name else "Imported"
    product_id = ensure_product(product_name, client_id, products_cache)

    # Determine fees
    client_lower = client_name.lower()
    if any(k in client_lower for k in FONTERRA_CLIENTS):
        fee_pct = plan.get("fee_1_pct") or 12.0
    else:
        fee_pct = plan.get("fee_1_pct") or DEFAULT_FEE_PCT

    total_budget = plan.get("total_budget")
    if not total_budget:
        budgets = [r.get("budget") for r in rows if r.get("budget")]
        total_budget = sum(budgets) if budgets else 0

    currency = plan.get("currency", "LKR")
    campaign_period = plan.get("campaign_period")

    row_payloads = [build_row_payload(r, i) for i, r in enumerate(rows)]

    payload = {
        "clientId": client_id,
        "productId": product_id,
        "campaignName": campaign_name[:200] if campaign_name else "Imported Plan",
        "campaignPeriod": campaign_period[:50] if campaign_period else None,
        "totalBudget": total_budget,
        "managementFeePct": fee_pct,
        "currency": currency,
        "variantName": "Option 1",
        "status": HISTORICAL_STATUS,
        "referenceNumber": plan.get("reference_number"),
        "notes": f"Imported from: {plan.get('source_file', 'unknown')}",
        "rows": row_payloads,
    }

    try:
        resp = requests.post(f"{API_BASE}/media-plans", headers=headers,
                             json=payload, timeout=30)
        if resp.status_code in (200, 201):
            stats["imported"] += 1
            log.debug(f"  ✓ Imported: {campaign_name} ({len(rows)} rows)")
            return True
        else:
            log.warning(f"  ✗ Failed [{resp.status_code}]: {campaign_name} — {resp.text[:200]}")
            stats["failed"] += 1
            return False
    except Exception as e:
        log.error(f"  ✗ Error importing {campaign_name}: {e}")
        stats["failed"] += 1
        return False


# ---------------------------------------------------------------------------
# Actuals import
# ---------------------------------------------------------------------------
def import_actuals(actuals: list, plan_index: list, headers: dict, stats: dict):
    """Import KPI performance actuals, matching to plans by campaign name."""
    for entry in actuals:
        campaign = (entry.get("campaign_name") or "").lower().strip()
        client = (entry.get("client") or "").lower().strip()

        # Find matching plan from the index
        matched_plan_id = None
        for idx_entry in plan_index:
            p_name = idx_entry.get("name", "").lower()
            p_client = idx_entry.get("client", "").lower()
            if campaign and (campaign in p_name or p_name in campaign):
                if not client or client in p_client or p_client in client:
                    matched_plan_id = idx_entry["id"]
                    break

        if not matched_plan_id:
            stats["actuals_unmatched"] += 1
            continue

        period_label = entry.get("period_label") or "Historical"

        for row_entry in entry.get("entries", []):
            actual_payload = {
                "planId": matched_plan_id,
                "periodLabel": str(period_label)[:100],
                "actualImpressions": row_entry.get("actual_impressions"),
                "actualReach": row_entry.get("actual_reach"),
                "actualClicks": row_entry.get("actual_clicks"),
                "actualEngagements": row_entry.get("actual_engagements"),
                "actualVideoViews": row_entry.get("actual_video_views"),
                "actualLeads": row_entry.get("actual_leads"),
                "actualSpend": row_entry.get("actual_spend"),
                "actualCpm": row_entry.get("actual_cpm"),
                "actualCpc": row_entry.get("actual_cpc"),
                "actualCtr": row_entry.get("actual_ctr"),
                "source": "bulk_paste",
                "notes": f"Imported from: {entry.get('source_file', 'unknown')}",
            }
            # Remove None values
            actual_payload = {k: v for k, v in actual_payload.items() if v is not None}

            try:
                resp = requests.post(f"{API_BASE}/actuals", headers=headers,
                                     json=actual_payload, timeout=15)
                if resp.status_code in (200, 201):
                    stats["actuals_imported"] += 1
                else:
                    stats["actuals_failed"] += 1
            except Exception:
                stats["actuals_failed"] += 1


# ---------------------------------------------------------------------------
# Build plan index for actuals matching
# ---------------------------------------------------------------------------
def build_plan_index(headers: dict) -> list:
    """Fetch all plans and return a lightweight list for matching."""
    try:
        resp = requests.get(f"{API_BASE}/media-plans", headers=headers, timeout=15)
        if resp.status_code == 200:
            plans = resp.json()
            return [
                {
                    "id": p["id"],
                    "name": (p.get("campaignName") or "").lower(),
                    "client": (p.get("client", {}) or {}).get("name", "").lower(),
                }
                for p in plans
            ]
    except Exception as e:
        log.warning(f"Could not build plan index: {e}")
    return []


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    plans_file = RAW_DIR / "plans.json"
    actuals_file = RAW_DIR / "actuals.json"

    if not plans_file.exists():
        print(f"ERROR: {plans_file} not found. Run scanner.py first.")
        sys.exit(1)

    log.info(f"Loading {plans_file}...")
    with open(plans_file, encoding="utf-8") as f:
        all_plans: list[dict] = json.load(f)

    all_actuals: list[dict] = []
    if actuals_file.exists():
        with open(actuals_file, encoding="utf-8") as f:
            all_actuals = json.load(f)

    log.info(f"Plans to import:   {len(all_plans)}")
    log.info(f"Actuals to import: {len(all_actuals)}")
    log.info("")

    # Authenticate
    log.info("Authenticating...")
    try:
        headers = authenticate()
        log.info("  ✓ Authenticated")
    except Exception as e:
        log.error(f"Authentication failed: {e}")
        sys.exit(1)

    # Load existing clients/products
    log.info("Loading existing clients and products...")
    clients_cache = load_clients(headers)
    products_cache = load_products(clients_cache)
    log.info(f"  {len(set(c['id'] for c in clients_cache.values()))} clients, {len(products_cache)} products")

    stats = {
        "imported": 0,
        "failed": 0,
        "skipped_no_rows": 0,
        "actuals_imported": 0,
        "actuals_failed": 0,
        "actuals_unmatched": 0,
    }

    # Import plans
    log.info(f"\nImporting {len(all_plans)} plans...")
    for i, plan in enumerate(all_plans):
        if i % 20 == 0:
            log.info(f"  Progress: {i}/{len(all_plans)} ({stats['imported']} imported, {stats['failed']} failed)")
        import_plan(plan, clients_cache, products_cache, headers, stats)

    # Import actuals if any
    if all_actuals:
        log.info(f"\nImporting {len(all_actuals)} actuals entries...")
        plan_index = build_plan_index(headers)
        import_actuals(all_actuals, plan_index, headers, stats)

    # Summary
    print(f"\n{'='*60}")
    print(f"IMPORT COMPLETE")
    print(f"{'='*60}")
    print(f"  Plans imported:      {stats['imported']}")
    print(f"  Plans failed:        {stats['failed']}")
    print(f"  Plans skipped:       {stats['skipped_no_rows']} (no rows)")
    if all_actuals:
        print(f"  Actuals imported:    {stats['actuals_imported']}")
        print(f"  Actuals unmatched:   {stats['actuals_unmatched']}")
        print(f"  Actuals failed:      {stats['actuals_failed']}")
    print(f"{'='*60}")
    print(f"  Log: {LOG_FILE}")


if __name__ == "__main__":
    main()
