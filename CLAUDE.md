# PlanFlow — Project Context

## What is this?
A B2B SaaS media plan calculator for Jasmin Media / DC Group, a digital marketing agency in Sri Lanka. It replaces their current manual Excel workflow where media planners look up KPI benchmarks from a spreadsheet, manually calculate projected reach/impressions/clicks for a given budget, and then format the results into client-facing spreadsheets or PPTX decks.

## Tech Stack
- Frontend: Next.js (App Router) + Tailwind CSS + TypeScript
- Backend: NestJS + TypeORM + PostgreSQL
- UI Style: Replicate Metronic v9.4.7 patterns (see metronic-reference/ folder for component examples). Use Inter font, their blue primary color (#006098), clean white cards, subtle borders, data-dense tables.
- Database: PostgreSQL 16 (Docker, see docker-compose.yml)

## CEO Phase 1 Priorities (BUILD ONLY THESE)
The CEO wants exactly 3 things delivered, all on ONE integrated page:

### 1. Benchmark Management (TOP section of page)
An editable data table storing KPI benchmark ranges. Data structure comes from apps/api/seed-data/JM___Media_KPI_Forcast_.xlsx which has:
- Two tabs = two audience types: "Local-Mass" (audience 1M+) and "Local-Niche" (audience <1M)
- Four objective sections per tab: Awareness, Engagement, Traffic, Leads
- Platform rows per objective: Meta+IG, Meta only, IG only, IG Follower, Meta Page Like, GDN, YouTube Video Views, YouTube Bumper, Search, Demand Gen, Performance Max
- Each row stores RANGE-BASED metrics (low/high): Est. CPM, Est. CPR (Reach), Est. CPE, Est. CPC, Est. CTR, Est. Frequency, Est. CPV (2sec), Est. CPV (TrueView), Per Page Like, Est. CPLV, Est. CPL
- Some metrics use LKR currency, Google/YouTube metrics use USD
- Includes conditions: minimum duration, minimum daily budget
- Must be inline editable — planners update these values as market rates change
- Toggle between Local-Mass and Local-Niche views
- Support CSV import for bulk updates

### 2. Test Calculator (BELOW benchmark table, collapsible panel)
Like a commission calculator — quick verification tool. Inspired by FareForYou's commission calculator UI pattern where rules are listed on top and a test panel sits below.
- Left side: Select Platform, Objective, Audience Type (Mass/Niche), enter Budget amount, select Currency (LKR/USD)
- Right side: Shows which benchmark row was matched + all calculated KPIs as ranges
- Formulas:
  - Impressions = (Budget / CPM) × 1000 (low uses high CPM, high uses low CPM)
  - Reach = (Budget / CPR) × 1000
  - Clicks = Budget / CPC
  - Engagements = Budget / CPE
  - Video Views = Budget / CPV
  - Leads = Budget / CPL
  - Landing Page Views = Budget / CPLV
  - Frequency = Impressions / Reach
  - CTR = Clicks / Impressions × 100

### 3. Small Media Plan Builder (BELOW test calculator)
A spreadsheet-like table where the planner builds a complete media plan:
- Header: Client dropdown, Product/Category dropdown, Campaign Name, Campaign Period (e.g., "2 Weeks", "1 Month", "30 Days"), Total Budget, Management Fee %, Currency
- Management fee calculation: Media Spend = Total Budget / (1 + Fee%), Fee = Total Budget - Media Spend
- Editable rows, each row = Platform + Ad Type + Audience + Budget allocation
- KPIs auto-calculate per row using benchmark data (same formulas as test calculator)
- Show all KPIs as ranges (low-high)
- Support multiple plan variants (Option 1, Option 2 tabs)
- Strategic notes textarea for platform caveats and recommendations
- Summary cards: Total Media Spend, Total Reach (range), Total Impressions (range), Avg CPM
- Columns matching real agency sheets: Campaign Name, Objective, Platform, Creative, Campaign Period, Audience, Estimated Audience Size, Targeting Criteria, Budget (LKR), Percentage (%), Reach, Impressions, Frequency, CPM, CPC, CPL

## Real-World Context
- Clients have multiple products/categories. Example: People's Bank has Credit Cards, Leasing, Women's Day, SME, Remittance, FX-FUTURE, Christmas Campaign — each gets separate media plans.
- Another client: Fonterra has products like Anchor PediaPro, Anchor Hot Chocolate, Anchor Milk, Anchor Newdale.
- Media plans can have multiple audience segments on the same platform. Example: "Overseas audience" (1.2M, CPM 130) and "Local audience" (1M, CPM 65) both on Meta Reach, same campaign, different budgets.
- Plans include agency fee (typically 15%) separated from media spend.
- Monthly KPI folders track historical performance.

## What NOT to build in Phase 1
- No user authentication (use dummy data for now)
- No client portal
- No PDF/PPTX export
- No version control
- No approval workflow
- No multi-tenancy
These come in later phases.

## File Structure
- apps/web/ — Next.js frontend
- apps/api/ — NestJS backend
- apps/api/seed-data/JM___Media_KPI_Forcast_.xlsx — benchmark source data
- metronic-reference/ — Metronic theme for UI pattern reference (DO NOT import, just study the patterns)
- docs/reference/ — real media plan examples for column structure reference

## Database Schema (Phase 1 — simplified)

### benchmarks table
Stores the KPI forecast data from the Excel sheet.
```sql
CREATE TABLE benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_type VARCHAR(20) NOT NULL,  -- 'mass' or 'niche'
  objective VARCHAR(20) NOT NULL,       -- 'awareness','engagement','traffic','leads'
  platform VARCHAR(50) NOT NULL,        -- 'meta_ig','meta','ig','ig_follower','meta_page_like','gdn','youtube_video','youtube_bumper','search','demand_gen','perf_max'
  min_duration VARCHAR(50),             -- '3 weeks or above', 'Below 2 weeks'
  min_daily_budget VARCHAR(50),         -- 'LKR 1K', 'USD 10'
  currency VARCHAR(3) DEFAULT 'LKR',
  cpm_low DECIMAL(10,4), cpm_high DECIMAL(10,4),
  cpr_low DECIMAL(10,4), cpr_high DECIMAL(10,4),
  cpe_low DECIMAL(10,4), cpe_high DECIMAL(10,4),
  cpc_low DECIMAL(10,4), cpc_high DECIMAL(10,4),
  ctr_low DECIMAL(8,6), ctr_high DECIMAL(8,6),
  cpv_2s_low DECIMAL(10,4), cpv_2s_high DECIMAL(10,4),
  cpv_tv_low DECIMAL(10,4), cpv_tv_high DECIMAL(10,4),
  cplv_low DECIMAL(10,4), cplv_high DECIMAL(10,4),
  cpl_low DECIMAL(10,4), cpl_high DECIMAL(10,4),
  page_like_low DECIMAL(10,4), page_like_high DECIMAL(10,4),
  frequency VARCHAR(20),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### clients table
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### products table
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### media_plans table
```sql
CREATE TABLE media_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  product_id UUID REFERENCES products(id),
  campaign_name VARCHAR(200),
  campaign_period VARCHAR(50),
  total_budget DECIMAL(15,2),
  management_fee_pct DECIMAL(5,2) DEFAULT 15,
  currency VARCHAR(3) DEFAULT 'LKR',
  variant_name VARCHAR(50) DEFAULT 'Option 1',
  notes TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### media_plan_rows table
```sql
CREATE TABLE media_plan_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES media_plans(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  ad_type VARCHAR(50),
  objective VARCHAR(20),
  audience_name VARCHAR(100),
  audience_size VARCHAR(50),
  targeting_criteria TEXT,
  creative VARCHAR(100),
  budget DECIMAL(15,2),
  benchmark_id UUID REFERENCES benchmarks(id),
  projected_kpis JSONB DEFAULT '{}',
  sort_order INT DEFAULT 0
);
```

## Dummy Seed Data for Phase 1
Create these dummy clients and products so the dropdowns have data:

Client: "People's Bank"
  Products: Credit Cards, Leasing, Remittance, FX-FUTURE, Christmas Campaign, SME

Client: "Fonterra"
  Products: Anchor PediaPro, Anchor Hot Chocolate, Anchor Milk, Anchor Newdale

Client: "Ritzbury"
  Products: Deckers, Choco Bar

## Port Assignments (DO NOT CHANGE)
- PlanFlow Frontend (Next.js): 3002
- PlanFlow Backend (NestJS): 3001
- PostgreSQL: 5435 (via Docker)
- Redis: 6379 (via Docker)

Other projects on this machine:
- CSE Dashboard Frontend: 4100
- CSE Dashboard Backend: 4101
- CSE PostgreSQL: 5433

NEVER use ports 3000, 4100, or 4101 — they belong to other projects.

## Reference: Full Media Plan Analysis
See docs/reference/gemini-analysis.md for a comprehensive analysis of 80+ real media plan Excel files from the agency. Key findings that affect future development:
- 7 different template families identified
- Multiple fee structures (15% mgmt fee, 12% + 6.25% ASP for Fonterra)
- Missing columns: Buy Type, Country, Reference Number, Video Views, CPV, CPE
- Audience naming is freeform (not Mass/Niche classification)
- Most KPI values are manually typed estimates, not formula-calculated
- Campaign periods have inconsistent formatting
