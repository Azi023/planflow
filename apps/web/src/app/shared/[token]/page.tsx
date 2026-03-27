'use client';

import { useEffect, useState } from 'react';
import { fetchSharedPlan, submitComment } from '@/lib/api';
import { fmtNum, fmtKpi, fmtKpiRange } from '@/lib/format';
import { PLATFORM_LABEL, OBJECTIVE_LABEL } from '@/lib/types';

interface SharedRow {
  platform: string;
  objective: string | null;
  audienceName: string | null;
  audienceSize: string | null;
  creative: string | null;
  country: string | null;
  budget: number | null;
  projectedKpis: Record<string, unknown> | null;
}

interface SharedComment {
  id: string;
  authorName: string;
  content: string;
  isClient: boolean;
  createdAt: string;
}

interface SharedPlan {
  campaignName: string | null;
  clientName: string | null;
  productName: string | null;
  campaignPeriod: string | null;
  startDate: string | null;
  endDate: string | null;
  totalBudget: number | null;
  currency: string;
  variantName: string;
  preparedBy: string | null;
  notes: string | null;
  referenceNumber: string | null;
  status: string;
  rows: SharedRow[];
  comments: SharedComment[];
}

function getKpiRange(kpis: Record<string, unknown> | null, key: string): { low: number | null; high: number | null } {
  if (!kpis) return { low: null, high: null };
  const val = kpis[key];
  if (!val || typeof val !== 'object') return { low: null, high: null };
  const v = val as Record<string, unknown>;
  return {
    low: v.low != null ? Number(v.low) : null,
    high: v.high != null ? Number(v.high) : null,
  };
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function SharedPlanPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [plan, setPlan] = useState<SharedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  useEffect(() => {
    fetchSharedPlan(token)
      .then((data) => setPlan(data as unknown as SharedPlan))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load plan'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !authorName.trim()) return;
    setSubmitting(true);
    try {
      const result = await submitComment(token, {
        content: commentText.trim(),
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim() || undefined,
      });
      setCommentText('');
      setSubmitMsg('Comment submitted!');
      setTimeout(() => setSubmitMsg(''), 3000);
      // Add comment to local state
      if (plan) {
        setPlan({
          ...plan,
          comments: [result as unknown as SharedComment, ...plan.comments],
        });
      }
    } catch {
      setSubmitMsg('Failed to submit comment. Please try again.');
      setTimeout(() => setSubmitMsg(''), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1B84FF]/30 border-t-[#1B84FF] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-[12px] border border-[#E1E3EA] p-8 text-center max-w-md">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-semibold text-[#071437] mb-2">Plan Not Available</h2>
          <p className="text-sm text-[#99A1B7]">
            {error === 'Plan not found' || !error
              ? 'This link is invalid, has expired, or sharing has been disabled.'
              : error}
          </p>
        </div>
      </div>
    );
  }

  const totalBudget = plan.totalBudget ?? 0;
  const currency = plan.currency ?? 'LKR';

  // Compute summary KPIs across all rows
  const sumKpi = (key: string): { low: number | null; high: number | null } => {
    let sumLow = 0;
    let sumHigh = 0;
    let hasAny = false;
    for (const row of plan.rows) {
      const r = getKpiRange(row.projectedKpis, key);
      if (r.low != null) { sumLow += r.low; hasAny = true; }
      if (r.high != null) { sumHigh += r.high; hasAny = true; }
    }
    return hasAny ? { low: sumLow || null, high: sumHigh || null } : { low: null, high: null };
  };

  const totalImpressions = sumKpi('impressions');
  const totalReach = sumKpi('reach');
  const totalClicks = sumKpi('clicks');

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Agency header */}
      <div className="bg-white border-b border-[#E1E3EA] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-[#006098] rounded-[6px] flex items-center justify-center">
            <span className="text-white text-xs font-bold">DC</span>
          </div>
          <div>
            <span className="text-sm font-semibold text-[#071437]">DC Group</span>
            <span className="text-sm text-[#99A1B7] mx-1">|</span>
            <span className="text-sm text-[#4B5675]">Jasmin Media</span>
          </div>
          <div className="ml-auto">
            <span className="text-xs text-[#99A1B7]">Media Plan Proposal</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Campaign info card */}
        <div className="bg-white rounded-[12px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-[#071437]">
                {plan.campaignName ?? 'Media Plan'}
              </h1>
              {(plan.clientName || plan.productName) && (
                <p className="text-sm text-[#4B5675] mt-1">
                  {[plan.clientName, plan.productName].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {plan.referenceNumber && (
              <span className="text-xs font-mono bg-[#F9F9F9] border border-[#E1E3EA] rounded px-2 py-1 text-[#4B5675]">
                {plan.referenceNumber}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {plan.campaignPeriod && (
              <div>
                <span className="text-[#99A1B7] text-xs block">Period</span>
                <span className="font-medium text-[#4B5675]">{plan.campaignPeriod}</span>
              </div>
            )}
            {(plan.startDate || plan.endDate) && (
              <div>
                <span className="text-[#99A1B7] text-xs block">Dates</span>
                <span className="font-medium text-[#4B5675]">
                  {[plan.startDate, plan.endDate].filter(Boolean).join(' → ')}
                </span>
              </div>
            )}
            {plan.variantName && (
              <div>
                <span className="text-[#99A1B7] text-xs block">Option</span>
                <span className="font-medium text-[#4B5675]">{plan.variantName}</span>
              </div>
            )}
            {plan.preparedBy && (
              <div>
                <span className="text-[#99A1B7] text-xs block">Prepared by</span>
                <span className="font-medium text-[#4B5675]">{plan.preparedBy}</span>
              </div>
            )}
          </div>
        </div>

        {/* KPI summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Budget', value: `${currency} ${fmtNum(totalBudget)}`, accent: '#006098' },
            {
              label: 'Est. Reach',
              value: fmtKpi(totalReach.low),
              sub: totalReach.high != null ? fmtKpiRange(totalReach.low, totalReach.high) : undefined,
            },
            {
              label: 'Est. Impressions',
              value: fmtKpi(totalImpressions.low),
              sub: totalImpressions.high != null ? fmtKpiRange(totalImpressions.low, totalImpressions.high) : undefined,
            },
            {
              label: 'Est. Clicks',
              value: fmtKpi(totalClicks.low),
              sub: totalClicks.high != null ? fmtKpiRange(totalClicks.low, totalClicks.high) : undefined,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-[12px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4"
            >
              <p className="text-[11px] text-[#99A1B7] font-medium uppercase tracking-wide">{card.label}</p>
              <p
                className="text-xl font-bold mt-1"
                style={{ color: card.accent ?? '#071437' }}
              >
                {card.value ?? '—'}
              </p>
              {card.sub && (
                <p className="text-[10px] text-[#99A1B7] mt-0.5">{card.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* Platform breakdown table */}
        {plan.rows.length > 0 && (
          <div className="bg-white rounded-[12px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#F1F1F4]">
              <h2 className="text-sm font-semibold text-[#071437]">Platform Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F9F9F9] text-[#99A1B7] uppercase text-[10px] tracking-wide">
                    <th className="px-4 py-2.5 text-left font-medium">Platform</th>
                    <th className="px-4 py-2.5 text-left font-medium">Objective</th>
                    <th className="px-4 py-2.5 text-left font-medium">Audience</th>
                    <th className="px-4 py-2.5 text-right font-medium">Budget</th>
                    <th className="px-4 py-2.5 text-right font-medium">Impressions</th>
                    <th className="px-4 py-2.5 text-right font-medium">Reach</th>
                    <th className="px-4 py-2.5 text-right font-medium">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.rows.map((row, idx) => {
                    const impressions = getKpiRange(row.projectedKpis, 'impressions');
                    const reach = getKpiRange(row.projectedKpis, 'reach');
                    const clicks = getKpiRange(row.projectedKpis, 'clicks');
                    return (
                      <tr key={idx} className="border-t border-[#F1F1F4] hover:bg-[#F9F9F9] transition-colors">
                        <td className="px-4 py-3 font-medium text-[#071437]">
                          {PLATFORM_LABEL[row.platform] ?? row.platform}
                        </td>
                        <td className="px-4 py-3 text-[#4B5675]">
                          {row.objective ? (OBJECTIVE_LABEL[row.objective] ?? row.objective) : '—'}
                        </td>
                        <td className="px-4 py-3 text-[#4B5675]">
                          <div>{row.audienceName ?? '—'}</div>
                          {row.audienceSize && (
                            <div className="text-[10px] text-[#99A1B7]">{row.audienceSize}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[#071437]">
                          {row.budget != null ? `${currency} ${fmtNum(row.budget)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {impressions.low != null ? (
                            <div>
                              <span className="font-semibold text-[#071437]">{fmtKpi(impressions.low)}</span>
                              {impressions.high != null && impressions.high !== impressions.low && (
                                <div className="text-[9px] text-[#99A1B7]">{fmtKpiRange(impressions.low, impressions.high)}</div>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {reach.low != null ? (
                            <div>
                              <span className="font-semibold text-[#071437]">{fmtKpi(reach.low)}</span>
                              {reach.high != null && reach.high !== reach.low && (
                                <div className="text-[9px] text-[#99A1B7]">{fmtKpiRange(reach.low, reach.high)}</div>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {clicks.low != null ? (
                            <div>
                              <span className="font-semibold text-[#071437]">{fmtKpi(clicks.low)}</span>
                              {clicks.high != null && clicks.high !== clicks.low && (
                                <div className="text-[9px] text-[#99A1B7]">{fmtKpiRange(clicks.low, clicks.high)}</div>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes */}
        {plan.notes && (
          <div className="bg-white rounded-[12px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-sm font-semibold text-[#071437] mb-3">Notes & Recommendations</h2>
            <p className="text-sm text-[#4B5675] whitespace-pre-wrap leading-relaxed">{plan.notes}</p>
          </div>
        )}

        {/* Leave a comment */}
        <div className="bg-white rounded-[12px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
          <h2 className="text-sm font-semibold text-[#071437] mb-4">Leave a Comment</h2>
          <form onSubmit={handleSubmitComment} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#4B5675] mb-1">
                  Name <span className="text-[#F8285A]">*</span>
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4B5675] mb-1">
                  Email <span className="text-[#99A1B7]">(optional)</span>
                </label>
                <input
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5675] mb-1">
                Comment <span className="text-[#F8285A]">*</span>
              </label>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Share your feedback or questions about this plan…"
                required
                rows={3}
                className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting || !commentText.trim() || !authorName.trim()}
                className="bg-[#1B84FF] text-white rounded-[6px] px-5 py-2 text-sm font-medium hover:bg-[#056EE9] transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {submitting && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {submitting ? 'Submitting…' : 'Submit Comment'}
              </button>
              {submitMsg && (
                <span className={`text-sm ${submitMsg.includes('Failed') ? 'text-[#F8285A]' : 'text-[#17C653]'}`}>
                  {submitMsg}
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Previous comments */}
        {plan.comments.length > 0 && (
          <div className="bg-white rounded-[12px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-sm font-semibold text-[#071437] mb-4">
              Comments ({plan.comments.length})
            </h2>
            <div className="space-y-4">
              {plan.comments.map((comment) => (
                <div key={comment.id} className="border-b border-[#F1F1F4] last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-6 h-6 rounded-full bg-[#EEF6FF] flex items-center justify-center text-[10px] font-bold text-[#1B84FF]">
                      {comment.authorName.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-[#071437]">{comment.authorName}</span>
                    <span className="text-[11px] text-[#99A1B7]">{timeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm text-[#4B5675] leading-relaxed pl-8">{comment.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-[#99A1B7] py-4 border-t border-[#E1E3EA]">
          <p>Results are indicative ranges based on historical benchmarks and are not guaranteed.</p>
          <p className="mt-1">© DC Group | Jasmin Media</p>
        </div>
      </div>
    </div>
  );
}
