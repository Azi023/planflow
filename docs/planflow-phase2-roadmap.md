# PlanFlow — Phase 2 Development Roadmap

## Where We Are (Phase 1 Complete ✅)

Phase 1 MVP delivered: JWT auth, Dashboard, Benchmark Management (40 rows, editable), Test Calculator, Media Plan Builder (multi-row, variant tabs, auto-KPI calc, persistence), PPTX/Excel export. 11 commits on main.

Bug fix prompt delivered separately — apply that FIRST before starting Phase 2.

---

## Phase 2 — Broken Into 4 Sprints

### Sprint 2A: "Polish & Internal Workflow" (Highest Priority — Start Here)
**Goal:** Make PlanFlow ready for daily use by Jasmin Media planners.

| Feature | What it does | Why now |
|---------|-------------|---------|
| Plan Status Workflow | Draft → Pending Review → Approved → Sent to Client | Planners need to track where plans are in the pipeline |
| Role-Based Access | Admin sees everything, Planner can create/edit own plans, Account Manager can view/export only | CEO asked for this — prevents accidental edits |
| Reference Number Auto-Gen | Auto-generate JM-2026-001 format on plan creation | Plans list currently shows "—" in REF column |
| CEO's Option C Display | Conservative number prominent + range smaller in gray below | CEO confirmed this display approach |
| CSV Benchmark Import | Upload CSV to bulk-update benchmark data | Listed in Phase 1 scope but not built — planners need to update benchmarks without dev help |
| Benchmark Edit Toast | Success/error feedback when inline-editing benchmarks | Currently edits silently — no confirmation |
| Export Polish | Add Jasmin Media logo to PPTX/Excel, match real agency deliverable formatting | Current exports are functional but basic |

---

### Sprint 2B: "Actual vs Projected Tracking" (Intelligence Foundation)
**Goal:** Start capturing real campaign performance data — this feeds the self-learning intelligence layer later.

| Feature | What it does | Why now |
|---------|-------------|---------|
| Actuals Entity + API | New `campaign_actuals` table: plan_id, row_id, actual_impressions, actual_reach, actual_clicks, actual_spend, actual_cpm, period_start, period_end | Data model must exist before intelligence layer can learn |
| Actuals Input UI | Per-plan "Enter Actuals" tab — simple form to log weekly/monthly actual numbers per row | Account managers can start logging real results |
| Projected vs Actual Dashboard | Per-plan comparison view: projected range vs actual, variance % | CEO's #1 Phase 2 request — shows if agency over/under delivered |
| KPI Accuracy Score | Per platform/objective: how close were projections to reality over time | Foundation for benchmark auto-tuning |

---

### Sprint 2C: "Plan Templates & Efficiency"
**Goal:** Speed up plan creation — planners shouldn't start from scratch every time.

| Feature | What it does | Why now |
|---------|-------------|---------|
| Plan Templates | Save any plan as template, create new plans from templates | Planners make similar plans for same client monthly |
| Duplicate Plan | One-click duplicate an entire plan (all variants) for next month | Saves 15+ min per plan |
| Bulk Row Operations | Select multiple rows → change platform/objective/audience at once | Real plans have 10-20 rows — editing one by one is slow |
| Campaign Period Templates | Preset durations: "1 Month", "2 Weeks", "Q1 2026" | Gemini analysis showed inconsistent period formatting |
| Notes Per Row | Strategic notes at row level, not just plan level | Real plans have platform-specific caveats |

---

### Sprint 2D: "Client Portal (Read-Only)" 
**Goal:** Clients can view their plans online instead of receiving Excel attachments.

| Feature | What it does | Why now |
|---------|-------------|---------|
| Shareable Plan Link | Generate a unique URL per plan — no login required | Replace email attachments with live links |
| Client View Page | Read-only branded view: campaign summary, KPI projections, audience breakdown | Professional presentation layer |
| Client Comments | Client can leave comments on the shared plan | Replaces back-and-forth email feedback |
| PDF Export | Generate PDF from client view | Some clients want printable format |

---

## Phase 3 Preview (After Phase 2)
- Multi-tenancy / RLS (support other agencies beyond Jasmin Media)
- AI-suggested budget allocation based on historical actuals
- Benchmark auto-tuning from actuals data
- Agency onboarding flow + Stripe billing
- API integrations (Meta Ads, Google Ads — pull actuals automatically)

---

## Recommended Start Order

**Apply bug fixes first** (from the separate prompt), then:

1. **Sprint 2A** — immediate, makes PlanFlow usable daily
2. **Sprint 2B** — builds the data foundation for intelligence 
3. **Sprint 2C** — quality of life for planners
4. **Sprint 2D** — client-facing layer

---

## Sprint 2A — Claude Code Development Prompt

Below is the prompt for Sprint 2A. Copy and paste into Claude Code.

---

```
# PlanFlow Sprint 2A — Polish & Internal Workflow

## CONTEXT
Working on PlanFlow at ~/workspace/planflow. Phase 1 MVP is complete and bug fixes have been applied. Now building Sprint 2A features to make PlanFlow ready for daily use.

**CRITICAL:** Never touch ports 3000, 4100, 4101, 5433. PlanFlow uses 3001 (API), 3002 (frontend), 5435 (Postgres).

Read CLAUDE.md for full project context before starting.

---

## FEATURE 1: Plan Status Workflow

### Database Changes
Add a status enum to the media_plans entity. The `status` column already exists as a string — keep it but enforce these values:

```typescript
// apps/api/src/entities/media-plan.entity.ts
// Change status column to:
@Column({ type: 'varchar', default: 'draft' })
status: 'draft' | 'pending_review' | 'approved' | 'sent';
```

### API Changes
Add a PATCH endpoint for status transitions:

```
PATCH /api/media-plans/:id/status
Body: { status: 'pending_review' | 'approved' | 'sent' }
```

Validation rules:
- draft → pending_review (any role)
- pending_review → approved (admin only)
- pending_review → draft (any role — reject back to draft)
- approved → sent (admin or account_manager)
- No skipping steps (e.g., draft → sent is invalid)

### Frontend Changes
1. In the plans list page (`apps/web/src/app/media-plans/page.tsx`), replace the static "Draft" badge with a colored status badge:
   - draft: gray badge
   - pending_review: amber/yellow badge "Pending Review"
   - approved: green badge "Approved"  
   - sent: blue badge "Sent to Client"

2. In the Media Plan Builder, add status action buttons next to the Save button:
   - If draft: "Submit for Review" button (sets pending_review)
   - If pending_review: "Approve" button (admin only) + "Return to Draft" button
   - If approved: "Mark as Sent" button

3. Use the existing auth context to check user role for button visibility.

### Status badge component
Create `apps/web/src/components/StatusBadge.tsx`:
```tsx
const STATUS_CONFIG = {
  draft: { label: 'Draft', bg: 'bg-[#F1F1F4]', text: 'text-[#4B5675]' },
  pending_review: { label: 'Pending Review', bg: 'bg-[#FFF8DD]', text: 'text-[#F6B100]' },
  approved: { label: 'Approved', bg: 'bg-[#DFFFEA]', text: 'text-[#17C653]' },
  sent: { label: 'Sent to Client', bg: 'bg-[#EEF6FF]', text: 'text-[#1B84FF]' },
};
```

---

## FEATURE 2: Role-Based Access Control

### API Guard
Create a `@Roles()` decorator and RolesGuard:

File: `apps/api/src/auth/roles.guard.ts`
```typescript
import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

Register RolesGuard globally in `app.module.ts` (after JwtAuthGuard).

### Access Rules
Apply these restrictions:

| Endpoint | Roles Allowed |
|----------|--------------|
| POST /media-plans | admin, planner |
| PUT /media-plans/:id | admin, planner (own plans only) |
| DELETE /media-plans/:id | admin only |
| PATCH /media-plans/:id/status (to approved) | admin only |
| PATCH /media-plans/:id/status (to sent) | admin, account_manager |
| PATCH /benchmarks/:id | admin only |
| GET /media-plans, /dashboard, /benchmarks | all roles |
| Export endpoints | all roles |

### Frontend
- Hide "Delete" button for non-admin users
- Hide benchmark inline edit for non-admin users (show as read-only)
- Show role badge next to user name in NavBar (e.g., "Rimzan Rizve · Planner")

---

## FEATURE 3: Reference Number Auto-Generation

### Backend
In the media-plans service `create` method, auto-generate a reference number:

Format: `JM-YYYY-NNN` where NNN is a zero-padded sequential number per year.

```typescript
// In media-plans.service.ts create() method, before saving:
const year = new Date().getFullYear();
const count = await this.planRepo.count({
  where: { referenceNumber: Like(`JM-${year}-%`) },
});
plan.referenceNumber = `JM-${year}-${String(count + 1).padStart(3, '0')}`;
```

Import `Like` from TypeORM.

### Frontend
Display the reference number prominently in:
- Plans list table (REF # column — currently shows "—")
- Media Plan Builder header area (read-only display after first save)
- Exports (already handled — the field exists in both templates)

---

## FEATURE 4: CEO's Option C KPI Display

### What Option C Means
Conservative number shown large + range shown smaller below it.

The "conservative number" = the LOW estimate from the KPI range (calculated using HIGH cost benchmarks + buffer applied).

### Frontend Changes — MediaPlanBuilder.tsx PlanRowItem

For each KPI cell in the row, change from showing a range to showing:
- **Bold primary number:** the LOW value (conservative)
- **Small gray sub-text:** the range "low – high"

Example for impressions cell:
```tsx
// Change from:
{fmtKpiRange(kpi.impressions.low, kpi.impressions.high)}

// Change to:
<div>
  <span className="font-semibold tabular-nums">{fmtKpi(kpi.impressions.low)}</span>
  {kpi.impressions.high != null && kpi.impressions.high !== kpi.impressions.low && (
    <span className="block text-[9px] text-[#99A1B7] tabular-nums">
      {fmtKpiRange(kpi.impressions.low, kpi.impressions.high)}
    </span>
  )}
</div>
```

Apply this pattern to: Impressions, Reach, Clicks, Video Views, Leads, Landing Page Views columns.

For Frequency and CTR, keep showing the range (these are ratios, not absolute numbers — a single conservative value doesn't make as much sense).

### Summary Cards
Same pattern — conservative number prominent:
```tsx
<SummaryCard
  label="Total Reach (est.)"
  value={totalReach.low ? fmtKpi(totalReach.low) : '—'}
  sub={totalReach.low && totalReach.high ? `Range: ${fmtKpiRange(totalReach.low, totalReach.high)}` : undefined}
  accent="#17C653"
/>
```

### Excel Export
In the Excel template, show the conservative (low) value as the primary number and the range in parentheses:
```typescript
// Instead of just fmtRange(...), show:
// "3,076,923 (3.1M – 5M)"
// Or simpler: just show the conservative value
```

Actually, for Excel keep showing the range — it's a spreadsheet and planners want the full data. But bold/highlight the low value. Use Excel formatting:
```typescript
// Make the KPI cell show range but the first number bold
// ExcelJS can't do partial bold in one cell easily, so keep the range display for Excel
// The Option C display is primarily for the web UI and PPTX (client-facing)
```

For PPTX, show only the conservative value (low) in the KPI cells — this is what goes to clients.

---

## FEATURE 5: CSV Benchmark Import

### API Endpoint
```
POST /api/benchmarks/import
Content-Type: multipart/form-data
Body: file (CSV)
```

### CSV Format Expected
```csv
audience_type,objective,platform,cpm_low,cpm_high,cpr_low,cpr_high,cpe_low,cpe_high,cpc_low,cpc_high,ctr_low,ctr_high,cpv_2s_low,cpv_2s_high,cpv_tv_low,cpv_tv_high,cplv_low,cplv_high,cpl_low,cpl_high,page_like_low,page_like_high,currency,min_duration,min_daily_budget,frequency
mass,awareness,meta_ig,35,65,37,75,3,8,150,,0.001,0.1,,,,,,,,,,,LKR,3 weeks or above,LKR 1000,varies
```

### Backend Implementation
1. Install multer: `npm install @nestjs/platform-express multer` (should already be available with NestJS)
2. Create `apps/api/src/benchmarks/benchmarks.controller.ts` — add a new endpoint:
   - Parse CSV using a simple line-by-line parser (or install `csv-parse`)
   - For each row, upsert by (audience_type, objective, platform) composite key
   - Return count of inserted/updated rows

3. Admin-only access: `@Roles('admin')`

### Frontend — Benchmarks Page
Add an "Import CSV" button next to the existing audience type toggle:
```tsx
<button className="bg-white border border-[#E1E3EA] rounded-lg px-4 py-2 text-sm text-[#4B5675] hover:bg-[#F9F9F9]">
  📤 Import CSV
</button>
```

On click, show a file picker. Upload the CSV, show a progress indicator, then refresh the benchmark table.

Also add an "Export CSV" button that downloads the current benchmarks as CSV (useful for backup before import).

---

## FEATURE 6: Benchmark Edit Toast Feedback

### Implementation
After a successful PATCH to /api/benchmarks/:id, show a brief success toast.

Create a minimal toast system (don't install a library — keep it simple):

File: `apps/web/src/components/Toast.tsx`
```tsx
'use client';
import { useEffect, useState } from 'react';

export function Toast({ message, type = 'success', onClose }: { message: string; type?: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = type === 'success'
    ? 'bg-[#DFFFEA] text-[#17C653] border-[#17C653]/20'
    : 'bg-[#FFF5F8] text-[#F8285A] border-[#F8285A]/20';

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2.5 rounded-lg border text-sm font-medium shadow-lg z-50 ${colors}`}>
      {message}
    </div>
  );
}
```

Use it in the BenchmarkTable component after successful edits.

---

## FEATURE 7: Export Polish (Logo + Formatting)

### PPTX
1. Add a logo image file at `apps/api/src/export/assets/jasmin-media-logo.png` (ask the user to provide this — for now use a text placeholder).
2. On slide 1, replace the "DC Group | Jasmin Media" text at top with the logo image (if file exists, otherwise keep text).
3. Add a thin colored bar at the bottom of each slide for brand consistency.

### Excel  
1. In row 1, if a logo file exists, embed it. Otherwise keep the text header.
2. Add light green (#E8F5E9) background to the header row.
3. Freeze panes at row 7 (so headers stay visible when scrolling).

Add this after the header row setup in excel-template.ts:
```typescript
// Freeze panes — keep header row visible
ws.views = [{ state: 'frozen', ySplit: 6 }];
```

---

## TESTING CHECKLIST

After implementing all features:

1. **Status workflow:** Create plan → Submit for Review → Login as admin → Approve → Mark as Sent. Verify status badges update in plans list.
2. **RBAC:** Login as planner — verify can't delete plans or edit benchmarks. Login as admin — verify full access.
3. **Reference numbers:** Create 3 plans — verify JM-2026-001, JM-2026-002, JM-2026-003.
4. **Option C display:** Create a plan with Meta+IG/Awareness/Mass/200000 budget — verify KPI cells show conservative number bold + range small.
5. **CSV import:** Export benchmarks as CSV, modify a value, re-import, verify the value updated.
6. **Toast:** Double-click a benchmark value, change it, press Enter — verify green toast appears.
7. **Excel freeze panes:** Export Excel, scroll down — verify headers stay visible.

## COMMIT MESSAGES (one per feature)
```
feat: add plan status workflow (draft → review → approved → sent)
feat: role-based access control with @Roles() decorator
feat: auto-generate reference numbers (JM-YYYY-NNN format)
feat: Option C KPI display — conservative number prominent
feat: CSV benchmark import/export
feat: benchmark edit toast notifications
feat: export polish — freeze panes, fee formatting
```
```

---

## Sprint 2B — Actual vs Projected (Development Prompt)

This prompt is for AFTER Sprint 2A is complete. I'll provide it when you're ready for it. It involves:

1. New `campaign_actuals` entity + migration
2. Actuals CRUD API
3. "Enter Actuals" tab in plan builder
4. Projected vs Actual comparison cards
5. Variance calculation + accuracy scoring
6. Dashboard integration (show delivery status per active plan)

Let me know when Sprint 2A is done and I'll write the Sprint 2B prompt.
