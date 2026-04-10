#!/usr/bin/env python3
"""
Meta Campaign Actuals Importer v2
Imports Meta Ads Manager CSV exports as actuals data only.
Creates one placeholder plan per client, links all actuals to it.
"""

import csv
import os
import sys
import uuid
import logging
import argparse
from datetime import datetime
from decimal import Decimal, InvalidOperation

import psycopg2

# --- Config ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_DIR = os.path.join(SCRIPT_DIR, "meta-exports")
ENV_FILE = os.path.join(SCRIPT_DIR, "..", "apps", "api", ".env")
LOG_FILE = os.path.join(SCRIPT_DIR, "meta-actuals-import.log")
SOURCE = "meta_csv_v2"

# Filename prefix → client name mapping
CLIENT_MAP = {
    "SLR_Softlogic": "Softlogic Supermarkets",
    "SLR_CBL-Tiara": "CBL Tiara",
    "LKR_ADX_Jasmin-Media_Peoples-Bank": "People's Bank",
    "LKR_ADX_Jasmin-Media_Asiri": "Asiri Hospitals",
    "LKR_ADX_Roccoa": "Roccoa",
    "LKR_RR_Jasmin-Media_Ro-ialac": "Robbialac",
    "LKR_MBP2_Jasmin-Media_Fintech": "FinTech Sri Lanka",
    "LKR_RoarCorp_Jasmin-Media_LB-Finance": "LB Finance",
    "Land-Sterling": "Land Sterling",
    "Teddy-SL": "Teddy SL",
}


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(LOG_FILE, mode="w"),
            logging.StreamHandler(sys.stdout),
        ],
    )


def read_env():
    """Read DB credentials from apps/api/.env"""
    env = {}
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, val = line.split("=", 1)
                env[key.strip()] = val.strip()
    return env


def get_connection(env):
    return psycopg2.connect(
        host=env.get("DB_HOST", "localhost"),
        port=int(env.get("DB_PORT", 5432)),
        dbname=env.get("DB_NAME", "planflow_prod"),
        user=env.get("DB_USER", "planflow"),
        password=env.get("DB_PASS", ""),
    )


def match_client(filename):
    """Match a CSV filename to a client name using prefix mapping."""
    for prefix, client_name in CLIENT_MAP.items():
        if filename.startswith(prefix):
            return client_name
    return None


def detect_currency(headers):
    """Detect currency from the 'Amount spent (XXX)' column header."""
    for h in headers:
        if "Amount spent" in h:
            if "AED" in h:
                return "AED", h
            return "LKR", h
    return "LKR", None


def safe_decimal(val):
    """Parse a string to Decimal, return None if empty/invalid."""
    if not val or val.strip() == "":
        return None
    try:
        cleaned = val.replace(",", "").strip()
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None


def safe_int(val):
    """Parse a string to int, return None if empty/invalid."""
    if not val or val.strip() == "":
        return None
    try:
        cleaned = val.replace(",", "").strip()
        return int(Decimal(cleaned))
    except (InvalidOperation, ValueError):
        return None


def calc_cpm(spend, impressions):
    if spend and impressions and impressions > 0:
        return round(spend / impressions * 1000, 4)
    return None


def calc_cpc(spend, clicks):
    if spend and clicks and clicks > 0:
        return round(spend / Decimal(clicks), 4)
    return None


def calc_ctr(clicks, impressions):
    if clicks and impressions and impressions > 0:
        return round(Decimal(clicks) / impressions * 100, 6)
    return None


def calc_frequency(impressions, reach):
    if impressions and reach and reach > 0:
        return round(Decimal(impressions) / Decimal(reach), 2)
    return None


def main():
    parser = argparse.ArgumentParser(description="Import Meta campaign actuals")
    parser.add_argument("--dry-run", action="store_true", help="Preview without inserting")
    args = parser.parse_args()

    setup_logging()
    log = logging.getLogger(__name__)

    if args.dry_run:
        log.info("=== DRY RUN MODE ===")

    env = read_env()
    conn = get_connection(env)
    cur = conn.cursor()

    # Load client IDs
    cur.execute("SELECT id, name FROM clients")
    client_rows = cur.fetchall()
    client_id_map = {name: cid for cid, name in client_rows}
    log.info(f"Loaded {len(client_id_map)} clients from DB")

    # Collect CSV files
    csv_files = sorted(
        f for f in os.listdir(CSV_DIR) if f.endswith(".csv") and "Zone" not in f
    )
    log.info(f"Found {len(csv_files)} CSV files to process")

    # Track stats
    stats = {}
    total_inserted = 0
    total_skipped = 0
    placeholder_plans = {}

    for csv_file in csv_files:
        csv_path = os.path.join(CSV_DIR, csv_file)
        client_name = match_client(csv_file)

        if not client_name:
            log.warning(f"SKIP {csv_file}: no client mapping found")
            continue

        client_id = client_id_map.get(client_name)
        if not client_id:
            log.warning(f"SKIP {csv_file}: client '{client_name}' not in DB")
            continue

        log.info(f"Processing: {csv_file} → {client_name}")

        with open(csv_path, newline="", encoding="utf-8-sig") as fh:
            reader = csv.DictReader(fh)
            headers = reader.fieldnames
            currency, spend_col = detect_currency(headers)

            if not spend_col:
                log.warning(f"SKIP {csv_file}: no 'Amount spent' column found")
                continue

            log.info(f"  Currency: {currency}, Spend column: {spend_col}")

            # Create or reuse placeholder plan for this client
            if client_name not in placeholder_plans:
                plan_name = f"{client_name} - Meta Historical Actuals"
                if not args.dry_run:
                    plan_id = str(uuid.uuid4())
                    cur.execute(
                        """INSERT INTO media_plans
                           (id, client_id, campaign_name, currency, variant_name, status, notes)
                           VALUES (%s, %s, %s, %s, %s, %s, %s)
                           RETURNING id""",
                        (
                            plan_id,
                            str(client_id),
                            plan_name,
                            currency,
                            "Actuals",
                            "sent",
                            f"Auto-created placeholder for Meta CSV actuals import. Source: {SOURCE}",
                        ),
                    )
                    plan_id = str(cur.fetchone()[0])
                    log.info(f"  Created placeholder plan: {plan_name} ({plan_id})")
                else:
                    plan_id = "DRY-RUN-PLAN-ID"
                    log.info(f"  [DRY RUN] Would create placeholder plan: {plan_name}")
                placeholder_plans[client_name] = plan_id
            else:
                plan_id = placeholder_plans[client_name]

            file_inserted = 0
            file_skipped = 0

            for row in reader:
                spend = safe_decimal(row.get(spend_col, "0"))
                if not spend or spend <= 0:
                    file_skipped += 1
                    continue

                campaign_name = row.get("Campaign name", "").strip()
                result_indicator = row.get("Result indicator", "").strip()

                # Dedup check
                if not args.dry_run:
                    cur.execute(
                        """SELECT 1 FROM campaign_actuals
                           WHERE plan_id = %s AND period_label = %s AND source = %s
                           LIMIT 1""",
                        (plan_id, campaign_name, SOURCE),
                    )
                    if cur.fetchone():
                        file_skipped += 1
                        continue

                impressions = safe_int(row.get("Impressions", ""))
                reach = safe_int(row.get("Reach", ""))
                clicks = safe_int(row.get("Link clicks", ""))
                engagements = safe_int(row.get("Post engagements", ""))
                video_views = safe_int(row.get("Views", ""))

                period_start = row.get("Reporting starts", row.get("Starts", "")).strip() or None
                period_end = row.get("Reporting ends", row.get("Ends", "")).strip() or None

                cpm = calc_cpm(spend, Decimal(impressions)) if impressions else None
                cpc = calc_cpc(spend, clicks)
                ctr = calc_ctr(clicks, Decimal(impressions)) if impressions else None
                frequency = calc_frequency(impressions, reach)

                notes_parts = [campaign_name]
                if result_indicator:
                    notes_parts.append(f"Result: {result_indicator}")
                notes_parts.append(f"Currency: {currency}")
                notes = " | ".join(notes_parts)

                if not args.dry_run:
                    cur.execute(
                        """INSERT INTO campaign_actuals
                           (id, plan_id, row_id, period_label, period_start, period_end,
                            actual_impressions, actual_reach, actual_clicks,
                            actual_engagements, actual_video_views, actual_spend,
                            actual_cpm, actual_cpc, actual_ctr, actual_frequency,
                            source, notes, created_at, updated_at)
                           VALUES (%s, %s, NULL, %s, %s, %s,
                                   %s, %s, %s, %s, %s, %s,
                                   %s, %s, %s, %s,
                                   %s, %s, NOW(), NOW())""",
                        (
                            str(uuid.uuid4()),
                            plan_id,
                            campaign_name,
                            period_start,
                            period_end,
                            impressions,
                            reach,
                            clicks,
                            engagements,
                            video_views,
                            spend,
                            cpm,
                            cpc,
                            ctr,
                            frequency,
                            SOURCE,
                            notes,
                        ),
                    )

                file_inserted += 1

            stats[client_name] = {
                "file": csv_file,
                "inserted": file_inserted,
                "skipped": file_skipped,
                "currency": currency,
            }
            total_inserted += file_inserted
            total_skipped += file_skipped
            log.info(f"  Inserted: {file_inserted}, Skipped: {file_skipped}")

    if not args.dry_run:
        conn.commit()
        log.info("Committed all changes to database")
    else:
        conn.rollback()
        log.info("[DRY RUN] No changes committed")

    # Summary
    log.info("")
    log.info("=" * 60)
    log.info("IMPORT SUMMARY")
    log.info("=" * 60)
    log.info(f"{'Client':<25} {'Currency':<5} {'Inserted':>8} {'Skipped':>8}")
    log.info("-" * 60)
    for client_name, s in sorted(stats.items()):
        log.info(f"{client_name:<25} {s['currency']:<5} {s['inserted']:>8} {s['skipped']:>8}")
    log.info("-" * 60)
    log.info(f"{'TOTAL':<25} {'':5} {total_inserted:>8} {total_skipped:>8}")
    log.info(f"Placeholder plans created: {len(placeholder_plans)}")
    log.info("=" * 60)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
