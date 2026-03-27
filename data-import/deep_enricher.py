#!/usr/bin/env python3
"""
PlanFlow Deep Enricher — Directly fills ALL empty fields in media_plan_rows.

Strategy:
1. Build comprehensive row-level lookup from ALL Excel files
2. Match DB rows to Excel rows by (plan_notes source_file + platform + budget)
3. Update directly via psql for speed
4. Apply intelligent defaults for anything still empty
"""

import json
import re
import os
import subprocess
import sys
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timedelta

import openpyxl

RAW_DIR = Path(__file__).parent / "raw"
DB_CMD = ["psql", "-h", "localhost", "-p", "5435", "-U", "planflow", "-d", "planflow", "-t", "-A"]
DB_ENV = {**os.environ, "PGPASSWORD": "planflow_dev"}

def run_sql(sql: str) -> str:
    """Run a SQL command and return output."""
    result = subprocess.run(
        DB_CMD + ["-c", sql],
        env=DB_ENV, capture_output=True, text=True
    )
    return result.stdout.strip()

def run_sql_update(sql: str) -> int:
    """Run a SQL update and return affected row count."""
    result = subprocess.run(
        DB_CMD + ["-c", sql],
        env=DB_ENV, capture_output=True, text=True
    )
    # Parse "UPDATE N" from output
    match = re.search(r'UPDATE (\d+)', result.stdout + result.stderr)
    return int(match.group(1)) if match else 0

# ─── Platform normalization (same as scanner) ──────────────────────────────────

PLATFORM_MAP = {
    'meta': 'meta', 'facebook': 'meta', 'fb': 'meta',
    'meta(facebook/instagram)': 'meta_ig', 'meta(facebok/instagram)': 'meta_ig',
    'meta + ig': 'meta_ig', 'meta+ig': 'meta_ig', 'fb+ig': 'meta_ig',
    'facebook + instagram': 'meta_ig', 'fb/ig': 'meta_ig', 'fb & ig': 'meta_ig',
    'instagram': 'ig', 'ig': 'ig', 'ig only': 'ig',
    'youtube': 'youtube_video', 'youtube video views': 'youtube_video',
    'youtube video': 'youtube_video', 'yt': 'youtube_video',
    'youtube bumper': 'youtube_bumper', 'bumper': 'youtube_bumper',
    'gdn': 'gdn', 'google display': 'gdn', 'display': 'gdn',
    'search': 'search', 'google search': 'search',
    'demand gen': 'demand_gen', 'demand generation': 'demand_gen',
    'performance max': 'perf_max', 'pmax': 'perf_max',
    'tiktok': 'tiktok', 'tik tok': 'tiktok',
    'linkedin': 'linkedin',
    'ig follower': 'ig_follower', 'page like': 'meta_page_like',
}

def normalize_platform(raw: str) -> str:
    if not raw: return 'meta'
    return PLATFORM_MAP.get(raw.lower().strip(), raw.lower().strip().replace(' ', '_'))

# ─── Creative normalization ────────────────────────────────────────────────────

def normalize_creative(raw: str) -> str:
    if not raw: return ""
    lower = raw.lower().strip()

    # Map to clean categories
    if any(x in lower for x in ['static post', 'statics', 'static ads', 'static banner']):
        return "Static Post"
    if any(x in lower for x in ['main video', 'hero video', 'tvc', 'hero film', 'hero asset']):
        return "Main Video"
    if any(x in lower for x in ['vertical', 'reel', 'highlight reel', 'snippet']):
        return "Vertical Content"
    if any(x in lower for x in ['carousel']):
        return "Carousel"
    if any(x in lower for x in ['bumper', '6sec', '5sec']):
        return "Bumper Ad"
    if any(x in lower for x in ['gif']):
        return "GIF"
    if any(x in lower for x in ['animated banner', 'animated']):
        return "Animated Banner"
    if any(x in lower for x in ['display banner', 'responsive banner', 'banner ad', 'image ad']):
        return "Display Banner"
    if any(x in lower for x in ['story ad', 'story']):
        return "Story Ad"
    if any(x in lower for x in ['album', 'photo album']):
        return "Album Post"
    if any(x in lower for x in ['video cut', 'cuts']):
        return "Video Cuts"
    if any(x in lower for x in ['video', 'videos']):
        return "Video"
    if any(x in lower for x in ['teaser']):
        return "Teaser"
    if any(x in lower for x in ['image', 'photo', 'post']):
        return "Static Post"

    # Return cleaned raw if < 50 chars, otherwise truncate
    return raw.strip()[:50] if raw.strip() else ""

# ─── Audience name extraction ──────────────────────────────────────────────────

def extract_audience(targeting: str, audience_col: str, audience_size: str) -> str:
    """Build a meaningful audience name from available data."""
    # If audience column has a real name, use it
    if audience_col and len(audience_col.strip()) > 3:
        clean = audience_col.strip()
        if clean.lower() not in ('mass', 'niche', '—', '-', 'mass audience', 'niche audience'):
            return clean

    if not targeting:
        return ""

    parts = []
    lower = targeting.lower()

    # Extract location
    loc_match = re.search(r'location\s*[:\->]\s*([^\n,;]+)', lower)
    if loc_match:
        loc = loc_match.group(1).strip()
        # Clean common prefixes
        loc = re.sub(r'^(tg\s*[-–]\s*\d+\s*)', '', loc).strip()
        if loc and len(loc) < 40:
            parts.append(loc.title())

    # Extract age
    age_match = re.search(r'age\s*[:\->]\s*(\d+)\s*(?:to|[-–])\s*(\d+)', lower)
    if age_match:
        parts.append(f"{age_match.group(1)}-{age_match.group(2)}")

    # Extract gender
    gender_match = re.search(r'gender\s*[:\->]\s*(male|female|all)', lower)
    if gender_match:
        g = gender_match.group(1).title()
        if g != "All":
            parts.append(g)

    # Special audience patterns
    if 'advantage+' in lower or 'advantage +' in lower:
        return "Advantage+ Audience"
    if 'overseas' in lower or 'abroad' in lower:
        return "Overseas Audience"
    if 'tamil' in lower:
        return "Tamil Audience"
    if 'sme' in lower:
        return "SME Audience"

    if parts:
        return " · ".join(parts)

    # Try audience size as fallback context
    if audience_size and len(str(audience_size).strip()) > 2:
        return f"Audience ({str(audience_size).strip()[:30]})"

    return ""

# ─── Country extraction ────────────────────────────────────────────────────────

def extract_country(targeting: str, filename: str) -> str:
    combined = f"{targeting or ''} {filename or ''}".lower()

    if 'kuwait' in combined: return "Kuwait"
    if 'middle east' in combined: return "Middle East"
    if 'overseas' in combined or 'abroad' in combined or 'foreign' in combined: return "Overseas"
    if 'global' in combined: return "Global"
    if 'india' in combined or 'tamil nadu' in combined: return "India"

    return "Sri Lanka"

# ─── Buy type extraction ──────────────────────────────────────────────────────

def extract_buy_type(buy_type_raw: str) -> str:
    if not buy_type_raw: return ""
    lower = buy_type_raw.lower().strip()
    if 'auction' in lower: return "Auction"
    if 'reach' in lower and 'frequency' in lower: return "Reach & Frequency"
    if 'cpm' in lower: return "CPM"
    if 'cpv' in lower: return "CPV"
    return buy_type_raw.strip()[:30]

# ─── Excel scanning ───────────────────────────────────────────────────────────

def scan_all_excels() -> dict:
    """
    Scan all Excel files and build a lookup:
    key = (source_file_relative_path, row_index)
    value = {audience_name, creative, country, buy_type, targeting, audience_size}
    """
    lookup = {}  # keyed by source_file

    xlsx_files = sorted(RAW_DIR.rglob("*.xlsx"))
    xlsx_files = [f for f in xlsx_files if not f.name.startswith("~$") and "Zone.Identifier" not in f.name]

    print(f"Scanning {len(xlsx_files)} Excel files...")

    for filepath in xlsx_files:
        try:
            wb = openpyxl.load_workbook(str(filepath), data_only=True, read_only=True)
        except:
            continue

        rel_path = str(filepath.relative_to(RAW_DIR))

        for ws in wb.worksheets:
            try:
                all_rows = list(ws.iter_rows(max_row=50, values_only=True))
            except:
                continue

            if not all_rows:
                continue

            # Find header row
            header_idx = None
            col_map = {}

            for i, row in enumerate(all_rows[:20]):
                if not row: continue
                temp_map = {}
                for j, cell in enumerate(row):
                    if not cell or not isinstance(cell, str): continue
                    key = cell.strip().lower()

                    # Map columns
                    if any(x in key for x in ['targeting', 'detailed', 'target audience']):
                        temp_map['targeting'] = j
                    elif any(x in key for x in ['audience name', 'audiences', 'audience ']):
                        temp_map['audience_name'] = j
                    elif any(x in key for x in ['audience size', 'estimated audience']):
                        temp_map['audience_size'] = j
                    elif any(x in key for x in ['ad type', 'creative', 'assets', 'content', 'no.of content', 'no of content']):
                        temp_map['creative'] = j
                    elif any(x in key for x in ['country', 'location']):
                        temp_map['country_col'] = j
                    elif any(x in key for x in ['buy type', 'buying']):
                        temp_map['buy_type'] = j
                    elif key in ('platform', 'platform ') or 'channels' in key:
                        temp_map['platform'] = j
                    elif 'budget' in key and 'total' not in key and 'campaign' not in key:
                        temp_map['budget'] = j

                if len(temp_map) >= 3:
                    header_idx = i
                    col_map = temp_map
                    break

            if header_idx is None:
                continue

            # Extract data rows
            sheet_rows = []
            for i in range(header_idx + 1, min(len(all_rows), header_idx + 40)):
                row = all_rows[i]
                if not row or not any(c for c in row if c): continue

                def get(name):
                    idx = col_map.get(name)
                    if idx is not None and idx < len(row) and row[idx]:
                        return str(row[idx]).strip()
                    return ""

                platform_raw = get('platform')
                if not platform_raw or platform_raw.lower() in ('total', 'total media spend', '', '–', '—'):
                    continue

                targeting = get('targeting')
                audience_raw = get('audience_name')
                audience_size = get('audience_size')
                creative_raw = get('creative')
                country_raw = get('country_col')
                buy_type_raw = get('buy_type')
                budget_raw = get('budget')

                # Parse budget for matching
                budget = None
                if budget_raw:
                    try:
                        budget = float(re.sub(r'[^\d.]', '', budget_raw))
                    except:
                        budget = None

                platform = normalize_platform(platform_raw)

                row_data = {
                    'audience_name': extract_audience(targeting, audience_raw, audience_size),
                    'creative': normalize_creative(creative_raw),
                    'country': extract_country(targeting, rel_path) if not country_raw else country_raw.strip(),
                    'buy_type': extract_buy_type(buy_type_raw),
                    'audience_size': audience_size,
                    'targeting': targeting[:500] if targeting else "",
                    'platform': platform,
                    'budget': budget,
                }

                sheet_rows.append(row_data)

            if sheet_rows:
                file_key = f"{rel_path}|{ws.title}"
                lookup[file_key] = sheet_rows

        wb.close()

    print(f"✓ Built lookup from {len(lookup)} sheets")
    return lookup

# ─── Database row fetching ─────────────────────────────────────────────────────

def fetch_db_rows() -> list:
    """Fetch all plan rows with their plan's notes (which contains source file path)."""
    sql = """
    SELECT
        mpr.id, mpr.platform, mpr.budget, mpr.sort_order,
        mpr.audience_name, mpr.creative, mpr.country, mpr.buy_type,
        mpr.audience_size, mpr.targeting_criteria,
        mp.notes, mp.campaign_name, mp.id as plan_id,
        mp.start_date, mp.end_date, mp.campaign_period
    FROM media_plan_rows mpr
    JOIN media_plans mp ON mpr.plan_id = mp.id
    ORDER BY mp.id, mpr.sort_order;
    """
    output = run_sql(sql)
    rows = []
    for line in output.strip().split('\n'):
        if not line: continue
        parts = line.split('|')
        if len(parts) >= 16:
            rows.append({
                'row_id': parts[0],
                'platform': parts[1],
                'budget': float(parts[2]) if parts[2] else None,
                'sort_order': int(parts[3]) if parts[3] else 0,
                'audience_name': parts[4] if parts[4] else '',
                'creative': parts[5] if parts[5] else '',
                'country': parts[6] if parts[6] else '',
                'buy_type': parts[7] if parts[7] else '',
                'audience_size': parts[8] if parts[8] else '',
                'targeting': parts[9] if parts[9] else '',
                'notes': parts[10] if parts[10] else '',
                'campaign_name': parts[11] if parts[11] else '',
                'plan_id': parts[12],
                'start_date': parts[13] if parts[13] else None,
                'end_date': parts[14] if parts[14] else None,
                'campaign_period': parts[15] if parts[15] else '',
            })
    return rows

# ─── Matching logic ────────────────────────────────────────────────────────────

def find_best_match(db_row: dict, lookup: dict) -> dict | None:
    """Find the best matching Excel row for a DB row."""
    notes = db_row.get('notes', '')

    # Extract source file from notes: "Imported from: Fonterra/Anchor Milk/file.xlsx / Sheet1"
    source_match = re.search(r'Imported from:\s*(.+?)(?:\s*$)', notes)
    if not source_match:
        return None

    source_path = source_match.group(1).strip()

    # Try exact file|sheet match
    for file_key, excel_rows in lookup.items():
        if source_path in file_key or file_key.split('|')[0] in source_path:
            # Found the file — now match by sort_order (row index)
            sort_order = db_row.get('sort_order', 0)
            if sort_order < len(excel_rows):
                return excel_rows[sort_order]

            # Fallback: match by platform + budget
            for er in excel_rows:
                if er['platform'] == db_row['platform']:
                    if er['budget'] and db_row['budget']:
                        if abs(er['budget'] - db_row['budget']) < 100:
                            return er
                    elif not er['budget'] and not db_row['budget']:
                        return er

    return None

# ─── Update logic ──────────────────────────────────────────────────────────────

def escape_sql(s: str) -> str:
    """Escape a string for SQL insertion."""
    if not s: return "NULL"
    return "'" + s.replace("'", "''").replace("\n", " ").replace("\r", "")[:200] + "'"

def update_row(row_id: str, updates: dict) -> bool:
    """Update a single row in the database."""
    set_clauses = []
    for field, value in updates.items():
        if value is None:
            continue
        set_clauses.append(f"{field} = {escape_sql(str(value))}")

    if not set_clauses:
        return False

    sql = f"UPDATE media_plan_rows SET {', '.join(set_clauses)} WHERE id = '{row_id}';"
    result = subprocess.run(
        DB_CMD + ["-c", sql],
        env=DB_ENV, capture_output=True, text=True
    )
    return "UPDATE 1" in (result.stdout + result.stderr)

# ─── Date extraction ───────────────────────────────────────────────────────────

MONTH_MAP = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'februay': 2,
    'mar': 3, 'march': 3, 'apr': 4, 'april': 4, 'aptil': 4,
    'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'september': 9, 'sept': 9,
    'oct': 10, 'october': 10, 'nov': 11, 'november': 11,
    'dec': 12, 'december': 12,
}

def extract_dates(notes: str, campaign_name: str, campaign_period: str) -> tuple:
    """Extract start_date and end_date from context."""
    combined = f"{notes or ''} {campaign_name or ''}".lower()

    # Find month + year
    month_match = re.search(
        r'(january|february|februay|march|april|aptil|may|june|july|august|september|october|november|december|'
        r'jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s*[-_/]?\s*(\d{4}|\d{2})\b',
        combined
    )

    if not month_match:
        # Try folder-based: "September KPI", "October KPI"
        folder_match = re.search(
            r'(january|february|march|april|may|june|july|august|september|october|november|december)\s*(?:kpi|kpis)',
            combined
        )
        if folder_match:
            month = MONTH_MAP.get(folder_match.group(1))
            if month:
                year = 2026 if '2026' in combined else 2025
                start = f"{year}-{month:02d}-01"
                if month == 12:
                    end = f"{year}-12-31"
                else:
                    end = (datetime(year, month + 1, 1) - timedelta(days=1)).strftime("%Y-%m-%d")
                return start, end
        return None, None

    month = MONTH_MAP.get(month_match.group(1))
    year_str = month_match.group(2)
    if not month: return None, None

    year = int(year_str)
    if year < 100: year += 2000

    start = f"{year}-{month:02d}-01"

    # Calculate end date from campaign period
    period = (campaign_period or "").lower().strip()
    duration_days = 30  # default 1 month

    day_match = re.search(r'(\d+)\s*day', period)
    week_match = re.search(r'(\d+)\s*week', period)
    month_match2 = re.search(r'(\d+)\s*month', period)

    if day_match: duration_days = int(day_match.group(1))
    elif week_match: duration_days = int(week_match.group(1)) * 7
    elif month_match2: duration_days = int(month_match2.group(1)) * 30

    end = (datetime(year, month, 1) + timedelta(days=duration_days - 1)).strftime("%Y-%m-%d")

    return start, end

# ─── Smart Defaults ────────────────────────────────────────────────────────────

PLATFORM_DEFAULT_CREATIVE = {
    'meta': 'Static Post',
    'meta_ig': 'Static Post',
    'ig': 'Static Post',
    'youtube_video': 'Video',
    'youtube_bumper': 'Bumper Ad',
    'gdn': 'Display Banner',
    'search': 'Text Ad',
    'tiktok': 'Vertical Content',
    'demand_gen': 'Display Banner',
    'perf_max': 'Responsive Ad',
    'ig_follower': 'Static Post',
    'meta_page_like': 'Static Post',
    'linkedin': 'Static Post',
}

PLATFORM_DEFAULT_BUY_TYPE = {
    'meta': 'Auction',
    'meta_ig': 'Auction',
    'ig': 'Auction',
    'youtube_video': 'Auction',
    'youtube_bumper': 'CPM',
    'gdn': 'Auction',
    'search': 'CPC',
    'tiktok': 'Auction',
    'demand_gen': 'Auction',
    'perf_max': 'Auction',
    'ig_follower': 'Auction',
    'meta_page_like': 'Auction',
    'linkedin': 'Auction',
}

# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("PlanFlow Deep Enricher — Fill ALL Missing Fields")
    print("=" * 60)

    # Step 1: Scan Excel files
    lookup = scan_all_excels()

    # Step 2: Fetch DB rows
    print("\nFetching database rows...")
    db_rows = fetch_db_rows()
    print(f"✓ {len(db_rows)} rows loaded from database")

    # Step 3: Match and update
    stats = {
        'matched': 0, 'updated': 0, 'defaulted': 0,
        'audience_filled': 0, 'creative_filled': 0,
        'country_updated': 0, 'buy_type_updated': 0,
        'dates_filled': 0,
    }

    print(f"\nMatching and enriching rows...")

    # Track which plans need date updates
    plan_dates = {}

    for db_row in db_rows:
        updates = {}
        match = find_best_match(db_row, lookup)

        if match:
            stats['matched'] += 1

            # Fill audience_name if empty
            if not db_row['audience_name'] and match.get('audience_name'):
                updates['audience_name'] = match['audience_name']
                stats['audience_filled'] += 1

            # Fill creative if empty
            if not db_row['creative'] and match.get('creative'):
                updates['creative'] = match['creative']
                stats['creative_filled'] += 1

            # Update country with better data
            if match.get('country') and match['country'] != 'Sri Lanka' and db_row['country'] == 'Sri Lanka':
                updates['country'] = match['country']
                stats['country_updated'] += 1
            elif not db_row['country'] and match.get('country'):
                updates['country'] = match['country']
                stats['country_updated'] += 1

            # Fill buy_type with real data
            if match.get('buy_type') and (not db_row['buy_type'] or db_row['buy_type'] == 'Auction'):
                if match['buy_type'] != db_row['buy_type']:
                    updates['buy_type'] = match['buy_type']
                    stats['buy_type_updated'] += 1

            # Update audience_size if empty
            if not db_row['audience_size'] and match.get('audience_size'):
                updates['audience_size'] = match['audience_size']

            # Update targeting if empty
            if not db_row['targeting'] and match.get('targeting'):
                updates['targeting_criteria'] = match['targeting'][:500]

        else:
            # Apply smart defaults for unmatched rows
            if not db_row['creative']:
                default_creative = PLATFORM_DEFAULT_CREATIVE.get(db_row['platform'], 'Static Post')
                updates['creative'] = default_creative
                stats['creative_filled'] += 1
                stats['defaulted'] += 1

            if not db_row['audience_name']:
                # Build a default audience name from platform
                if db_row['platform'] in ('tiktok',):
                    updates['audience_name'] = 'Young Adults 18-34'
                elif db_row['platform'] in ('youtube_video', 'youtube_bumper'):
                    updates['audience_name'] = 'All Island 18+'
                else:
                    updates['audience_name'] = 'Mass Audience'
                stats['audience_filled'] += 1
                stats['defaulted'] += 1

        # Apply updates
        if updates:
            success = update_row(db_row['row_id'], updates)
            if success:
                stats['updated'] += 1

        # Extract dates for plans
        plan_id = db_row['plan_id']
        if plan_id not in plan_dates and not db_row.get('start_date'):
            start, end = extract_dates(
                db_row['notes'], db_row['campaign_name'], db_row['campaign_period']
            )
            if start:
                plan_dates[plan_id] = (start, end)

    # Step 4: Update plan dates
    print(f"\nUpdating dates for {len(plan_dates)} plans...")
    for plan_id, (start_date, end_date) in plan_dates.items():
        sql = f"""
        UPDATE media_plans
        SET start_date = '{start_date}',
            end_date = {("'" + end_date + "'") if end_date else 'NULL'}
        WHERE id = '{plan_id}'
          AND (start_date IS NULL OR start_date::text = '');
        """
        result = subprocess.run(DB_CMD + ["-c", sql], env=DB_ENV, capture_output=True, text=True)
        if "UPDATE 1" in (result.stdout + result.stderr):
            stats['dates_filled'] += 1

    # Step 5: Final defaults pass — ensure nothing is empty
    print("\nApplying final defaults for remaining empty fields...")

    # Creative defaults by platform
    for platform, creative in PLATFORM_DEFAULT_CREATIVE.items():
        count = run_sql_update(f"""
            UPDATE media_plan_rows
            SET creative = '{creative}'
            WHERE (creative IS NULL OR creative = '')
              AND platform = '{platform}';
        """)
        if count > 0:
            print(f"  Set {count} {platform} rows → {creative}")

    # Audience name defaults
    count = run_sql_update("""
        UPDATE media_plan_rows
        SET audience_name = 'Mass Audience'
        WHERE (audience_name IS NULL OR audience_name = '')
          AND audience_type = 'mass';
    """)
    if count > 0: print(f"  Set {count} mass rows → Mass Audience")

    count = run_sql_update("""
        UPDATE media_plan_rows
        SET audience_name = 'Niche Audience'
        WHERE (audience_name IS NULL OR audience_name = '')
          AND audience_type = 'niche';
    """)
    if count > 0: print(f"  Set {count} niche rows → Niche Audience")

    # Buy type defaults by platform
    for platform, buy_type in PLATFORM_DEFAULT_BUY_TYPE.items():
        run_sql_update(f"""
            UPDATE media_plan_rows
            SET buy_type = '{buy_type}'
            WHERE (buy_type IS NULL OR buy_type = '')
              AND platform = '{platform}';
        """)

    # Summary
    print("\n" + "=" * 60)
    print("DEEP ENRICHMENT COMPLETE")
    print("=" * 60)
    print(f"  Rows matched to Excel: {stats['matched']}")
    print(f"  Rows updated:          {stats['updated']}")
    print(f"  Rows with defaults:    {stats['defaulted']}")
    print(f"  Audience names filled: {stats['audience_filled']}")
    print(f"  Creatives filled:      {stats['creative_filled']}")
    print(f"  Countries updated:     {stats['country_updated']}")
    print(f"  Buy types updated:     {stats['buy_type_updated']}")
    print(f"  Plan dates filled:     {stats['dates_filled']}")

    # Verification
    print("\n--- Field Coverage After Deep Enrichment ---")
    for field in ['audience_name', 'creative', 'country', 'buy_type', 'audience_size']:
        filled = run_sql(f"SELECT count(*) FROM media_plan_rows WHERE {field} IS NOT NULL AND {field} != '';")
        total = run_sql(f"SELECT count(*) FROM media_plan_rows;")
        pct = round(100 * int(filled) / max(int(total), 1), 1)
        print(f"  {field:20s}: {filled:>4}/{total} ({pct}%)")

    # Dates
    filled = run_sql("SELECT count(*) FROM media_plans WHERE start_date IS NOT NULL;")
    total = run_sql("SELECT count(*) FROM media_plans;")
    pct = round(100 * int(filled) / max(int(total), 1), 1)
    print(f"  {'start_date':20s}: {filled:>4}/{total} ({pct}%)")

    print("\n✓ Done. Reload the app to see enriched data.")

if __name__ == "__main__":
    main()
