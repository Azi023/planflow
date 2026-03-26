import type { Audience, Benchmark, CalculatedKpis, Client, CreativeType, MediaPlan, MediaPlanRow } from './types';

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

export function fetchPlans(): Promise<MediaPlan[]> {
  return request<MediaPlan[]>('/media-plans');
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

export function fetchPlanGroup(groupId: string): Promise<MediaPlan[]> {
  return request<MediaPlan[]>(`/media-plans/group/${groupId}`);
}
