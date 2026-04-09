import type {
  Audience, Benchmark, CalculatedKpis, Client, CreativeType, MediaPlan, MediaPlanRow,
  AccuracyHeatmap, AccuracyDetail, SeasonalAlert, MonthlyTrendEntry,
  ConfidenceScore, BenchmarkSuggestion, BenchmarkHistoryEntry,
} from './types';

// Payload type for create/update — rows use partial fields (no id required)
type PlanRowPayload = Omit<Partial<MediaPlanRow>, 'id'> & { platform: string };
type PlanPayload = Omit<Partial<MediaPlan>, 'rows'> & { rows?: PlanRowPayload[] };

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('planflow_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init?.headers) {
    Object.assign(headers, init.headers);
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('planflow_token');
      localStorage.removeItem('planflow_user');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path}: ${res.status} — ${msg}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Benchmarks ──────────────────────────────────────────────────────────────

export function fetchBenchmarks(params?: {
  audienceType?: string;
  objective?: string;
}): Promise<Benchmark[]> {
  const qs = params
    ? '?' + new URLSearchParams(Object.fromEntries(
        Object.entries(params).filter(([, v]) => v != null) as [string, string][],
      )).toString()
    : '';
  return request<Benchmark[]>(`/benchmarks${qs}`);
}

export function updateBenchmark(id: string, data: Partial<Benchmark>): Promise<Benchmark> {
  return request<Benchmark>(`/benchmarks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function calculateKpis(payload: {
  platform: string;
  objective: string;
  audienceType: string;
  budget: number;
  currency?: string;
}): Promise<CalculatedKpis> {
  return request<CalculatedKpis>('/benchmarks/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export function fetchClients(): Promise<Client[]> {
  return request<Client[]>('/clients');
}

// ─── Audiences ───────────────────────────────────────────────────────────────

export function fetchAudiences(clientId?: string): Promise<Audience[]> {
  const qs = clientId ? `?clientId=${clientId}` : '';
  return request<Audience[]>(`/audiences${qs}`);
}

export function createAudience(data: Partial<Audience>): Promise<Audience> {
  return request<Audience>('/audiences', { method: 'POST', body: JSON.stringify(data) });
}

// ─── Creative Types ───────────────────────────────────────────────────────────

export function fetchCreativeTypes(): Promise<CreativeType[]> {
  return request<CreativeType[]>('/creative-types');
}

// ─── Media Plans ─────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function fetchPlans(opts?: {
  page?: number;
  limit?: number;
  status?: string;
  clientId?: string;
  search?: string;
}): Promise<MediaPlan[]> {
  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.status) params.set('status', opts.status);
  if (opts?.clientId) params.set('clientId', opts.clientId);
  if (opts?.search) params.set('search', opts.search);
  const qs = params.toString();
  const res = await request<PaginatedResponse<MediaPlan>>(`/media-plans${qs ? '?' + qs : ''}`);
  return res.data;
}

export function fetchPlan(id: string): Promise<MediaPlan> {
  return request<MediaPlan>(`/media-plans/${id}`);
}

export function createPlan(data: PlanPayload): Promise<MediaPlan> {
  return request<MediaPlan>('/media-plans', { method: 'POST', body: JSON.stringify(data) });
}

export function updatePlan(id: string, data: PlanPayload): Promise<MediaPlan> {
  return request<MediaPlan>(`/media-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deletePlan(id: string): Promise<void> {
  return request<void>(`/media-plans/${id}`, { method: 'DELETE' });
}

export function updatePlanStatus(id: string, status: string): Promise<MediaPlan> {
  return request<MediaPlan>(`/media-plans/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function fetchPlanGroup(groupId: string): Promise<MediaPlan[]> {
  return request<MediaPlan[]>(`/media-plans/group/${groupId}`);
}

export function duplicatePlan(planId: string): Promise<MediaPlan> {
  return request<MediaPlan>(`/media-plans/${planId}/duplicate`, { method: 'POST' });
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface PlanTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  clientId: string | null;
  productId: string | null;
  fee1Pct: number;
  fee1Label: string;
  fee2Pct: number | null;
  fee2Label: string | null;
  bufferPct: number;
  currency: string;
  notes: string | null;
  templateRows: Record<string, unknown>[];
  createdById: string | null;
  isGlobal: boolean;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export function fetchTemplates(): Promise<PlanTemplate[]> {
  return request<PlanTemplate[]>('/templates');
}

export function fetchTemplate(id: string): Promise<PlanTemplate> {
  return request<PlanTemplate>(`/templates/${id}`);
}

export function createTemplateFromPlan(
  planId: string,
  data: { name: string; description?: string; category?: string; isGlobal?: boolean },
): Promise<PlanTemplate> {
  return request<PlanTemplate>(`/templates/from-plan/${planId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function useTemplate(
  templateId: string,
  data: {
    campaignName: string;
    clientId?: string;
    productId?: string;
    totalBudget: number;
    startDate?: string;
    endDate?: string;
    currency?: string;
  },
): Promise<MediaPlan> {
  return request<MediaPlan>(`/templates/${templateId}/use`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteTemplate(id: string): Promise<void> {
  return request<void>(`/templates/${id}`, { method: 'DELETE' });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fetchDashboardStats(): Promise<any> {
  return request('/dashboard/stats');
}

// ─── Export ───────────────────────────────────────────────────────────────────

async function downloadExport(path: string, filename: string): Promise<void> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('planflow_token') : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { headers });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('planflow_token');
      localStorage.removeItem('planflow_user');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Export ${path}: ${res.status} — ${msg}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportPlanExcel(planId: string, filename: string): Promise<void> {
  return downloadExport(`/media-plans/${planId}/export/excel`, filename);
}

export async function importBenchmarksCsv(
  file: File,
): Promise<{ imported: number; updated: number }> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('planflow_token') : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE}/benchmarks/import`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('planflow_token');
      localStorage.removeItem('planflow_user');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Import failed: ${msg}`);
  }
  return res.json() as Promise<{ imported: number; updated: number }>;
}

export function exportPlanPptx(planId: string, filename: string): Promise<void> {
  return downloadExport(`/media-plans/${planId}/export/pptx`, filename);
}

// ─── Actuals ──────────────────────────────────────────────────────────────────

export interface CampaignActual {
  id: string;
  planId: string;
  rowId: string | null;
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  actualImpressions: number | null;
  actualReach: number | null;
  actualClicks: number | null;
  actualEngagements: number | null;
  actualVideoViews: number | null;
  actualLeads: number | null;
  actualLandingPageViews: number | null;
  actualSpend: number | null;
  actualCpm: number | null;
  actualCpc: number | null;
  actualCtr: number | null;
  actualFrequency: number | null;
  source: string;
  notes: string | null;
  row?: { id: string; platform: string; audienceName: string | null } | null;
  createdAt: string;
}

export interface ActualsSummary {
  totalImpressions: number;
  totalReach: number;
  totalClicks: number;
  totalEngagements: number;
  totalVideoViews: number;
  totalLeads: number;
  totalLandingPageViews: number;
  totalSpend: number;
  periodCount: number;
  periods: string[];
  avgCpm?: number;
  avgCtr?: number;
  avgCpc?: number;
}

export function fetchActuals(planId: string): Promise<CampaignActual[]> {
  return request<CampaignActual[]>(`/actuals/plan/${planId}`);
}

export function fetchActualsSummary(planId: string): Promise<ActualsSummary> {
  return request<ActualsSummary>(`/actuals/plan/${planId}/summary`);
}

export function createActual(data: Partial<CampaignActual>): Promise<CampaignActual> {
  return request<CampaignActual>('/actuals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function bulkCreateActuals(data: {
  planId: string;
  periodLabel?: string;
  periodStart?: string;
  periodEnd?: string;
  entries: Record<string, unknown>[];
}): Promise<{ created: number }> {
  return request<{ created: number }>('/actuals/bulk', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateActual(
  id: string,
  data: Partial<CampaignActual>,
): Promise<CampaignActual> {
  return request<CampaignActual>(`/actuals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteActual(id: string): Promise<void> {
  return request<void>(`/actuals/${id}`, { method: 'DELETE' });
}

// ─── Sharing ──────────────────────────────────────────────────────────────────

export function enableSharing(
  planId: string,
  expiresInDays?: number,
): Promise<{ shareToken: string; shareUrl: string }> {
  return request<{ shareToken: string; shareUrl: string }>(
    `/media-plans/${planId}/share`,
    { method: 'POST', body: JSON.stringify({ expiresInDays }) },
  );
}

export function disableSharing(planId: string): Promise<void> {
  return request<void>(`/media-plans/${planId}/share`, { method: 'DELETE' });
}

export function fetchSharedPlan(token: string): Promise<Record<string, unknown>> {
  return fetch(`${BASE}/shared/${token}`).then((r) => {
    if (!r.ok) throw new Error('Plan not found');
    return r.json() as Promise<Record<string, unknown>>;
  });
}

export function submitComment(
  token: string,
  data: { content: string; authorName: string; authorEmail?: string },
): Promise<Record<string, unknown>> {
  return fetch(`${BASE}/shared/${token}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => {
    if (!r.ok) throw new Error('Failed to submit comment');
    return r.json() as Promise<Record<string, unknown>>;
  });
}

export function fetchPlanComments(planId: string): Promise<Record<string, unknown>[]> {
  return request<Record<string, unknown>[]>(`/media-plans/${planId}/comments`);
}

// ─── Analytics (Sprint 3A) ────────────────────────────────────────────────────

export function fetchAccuracyHeatmap(): Promise<AccuracyHeatmap> {
  return request<AccuracyHeatmap>('/analytics/heatmap');
}

export function fetchAccuracyDetail(platform: string, objective: string): Promise<AccuracyDetail> {
  return request<AccuracyDetail>(`/analytics/detail?platform=${encodeURIComponent(platform)}&objective=${encodeURIComponent(objective)}`);
}

export function fetchSeasonalAlerts(params?: {
  platform?: string;
  objective?: string;
  month?: number;
}): Promise<{ data: SeasonalAlert[]; message?: string }> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, String(v)]),
        ),
      ).toString()
    : '';
  return request<{ data: SeasonalAlert[]; message?: string }>(`/analytics/seasonal${qs}`);
}

export function fetchMonthlyTrend(platform: string, objective: string): Promise<{ data: MonthlyTrendEntry[]; message?: string }> {
  return request<{ data: MonthlyTrendEntry[]; message?: string }>(`/analytics/trend?platform=${encodeURIComponent(platform)}&objective=${encodeURIComponent(objective)}`);
}

// ─── Benchmark Intelligence (Sprint 3A) ──────────────────────────────────────

export function fetchConfidenceLevels(): Promise<ConfidenceScore[]> {
  return request<ConfidenceScore[]>('/benchmarks/confidence');
}

export function fetchBenchmarkSuggestions(benchmarkId?: string): Promise<BenchmarkSuggestion[]> {
  const qs = benchmarkId ? `?benchmarkId=${benchmarkId}` : '';
  return request<BenchmarkSuggestion[]>(`/benchmarks/suggestions${qs}`);
}

export function computeBenchmarkSuggestions(): Promise<{ created: number; skipped: number }> {
  return request<{ created: number; skipped: number }>('/benchmarks/suggestions/compute', {
    method: 'POST',
  });
}

export function acceptBenchmarkSuggestion(id: string): Promise<void> {
  return request<void>(`/benchmarks/suggestions/${id}/accept`, { method: 'POST' });
}

export function rejectBenchmarkSuggestion(id: string): Promise<void> {
  return request<void>(`/benchmarks/suggestions/${id}/reject`, { method: 'POST' });
}

export function fetchBenchmarkHistory(benchmarkId: string): Promise<BenchmarkHistoryEntry[]> {
  return request<BenchmarkHistoryEntry[]>(`/benchmarks/${benchmarkId}/history`);
}

// ── AI endpoints ───────────────────────────────────────────────────────────

export interface BudgetSuggestPayload {
  objective: string;
  audienceType: string;
  budget: number;
  currency: string;
  audienceDescription?: string;
  campaignPeriod?: string;
  clientIndustry?: string;
  notes?: string;
}

export interface PlatformAllocation {
  platform: string;
  platformLabel: string;
  objective: string;
  audienceType: string;
  budgetPct: number;
  budgetAmount: number;
  rationale: string;
}

export interface BudgetSuggestionResult {
  summary: string;
  allocations: PlatformAllocation[];
  strategicNotes: string;
  totalBudget: number;
  currency: string;
  generatedAt: string;
}

export interface SimilarCampaign {
  planId: string;
  campaignName: string;
  clientName: string;
  objective: string;
  budget: number;
  currency: string;
  platforms: string[];
  similarityReason: string;
}

export interface SimilarCampaignsResult {
  campaigns: SimilarCampaign[];
  insight: string;
}

export async function suggestBudget(
  payload: BudgetSuggestPayload,
): Promise<BudgetSuggestionResult> {
  const res = await request<{ success: boolean; data: BudgetSuggestionResult }>(
    '/ai/budget-suggest',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return res.data;
}

export async function findSimilarCampaigns(payload: {
  objective: string;
  clientIndustry?: string;
  budget?: number;
  currency?: string;
  audienceType?: string;
  platforms?: string;
  limit?: number;
}): Promise<SimilarCampaignsResult> {
  const res = await request<{ success: boolean; data: SimilarCampaignsResult }>(
    '/ai/similar-campaigns',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return res.data;
}

// ── Version control ───────────────────────────────────────────────────────

export interface PlanVersion {
  id: string;
  planId: string;
  versionNumber: number;
  snapshot: Record<string, unknown>;
  changeType: string;
  changeSummary: string | null;
  createdBy: string | null;
  createdAt: string;
}

export function fetchPlanVersions(planId: string): Promise<PlanVersion[]> {
  return request<PlanVersion[]>(`/media-plans/${planId}/versions`);
}

export function fetchPlanVersion(planId: string, versionId: string): Promise<PlanVersion> {
  return request<PlanVersion>(`/media-plans/${planId}/versions/${versionId}`);
}

export function restorePlanVersion(planId: string, versionId: string): Promise<unknown> {
  return request(`/media-plans/${planId}/versions/${versionId}/restore`, { method: 'POST' });
}

export function diffPlanVersions(planId: string, v1: string, v2: string): Promise<Record<string, unknown>> {
  return request(`/media-plans/${planId}/versions/diff?v1=${v1}&v2=${v2}`);
}

// ── Audit logs ────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userId: string | null;
  userEmail: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export function fetchAuditLogs(opts?: {
  page?: number;
  limit?: number;
  entityType?: string;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
}): Promise<{ data: AuditLogEntry[]; total: number; page: number; limit: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.entityType) params.set('entityType', opts.entityType);
  if (opts?.action) params.set('action', opts.action);
  if (opts?.userId) params.set('userId', opts.userId);
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  const qs = params.toString();
  return request(`/audit${qs ? '?' + qs : ''}`);
}

export function fetchEntityAuditLogs(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
  return request<AuditLogEntry[]>(`/audit/entity/${entityType}/${entityId}`);
}
