'use client';

import { useState } from 'react';
import {
  suggestBudget,
  findSimilarCampaigns,
  type BudgetSuggestionResult,
  type SimilarCampaignsResult,
} from '@/lib/api';

const OBJECTIVES = [
  { value: 'awareness', label: 'Awareness' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'leads', label: 'Leads' },
];

const AUDIENCE_TYPES = [
  { value: 'mass', label: 'Mass (1M+ reach)' },
  { value: 'niche', label: 'Niche (under 1M)' },
];

interface Props {
  defaultBudget?: number;
  defaultCurrency?: string;
  defaultObjective?: string;
  defaultAudienceType?: string;
  clientName?: string;
  onApply?: (allocations: BudgetSuggestionResult['allocations']) => void;
  onClose: () => void;
}

type Tab = 'suggest' | 'similar';

export function AiSuggestPanel({
  defaultBudget = 0,
  defaultCurrency = 'LKR',
  defaultObjective = 'awareness',
  defaultAudienceType = 'mass',
  clientName,
  onApply,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('suggest');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Budget suggestion form
  const [objective, setObjective] = useState(defaultObjective);
  const [audienceType, setAudienceType] = useState(defaultAudienceType);
  const [budget, setBudget] = useState(defaultBudget);
  const [currency] = useState(defaultCurrency);
  const [audienceDesc, setAudienceDesc] = useState('');
  const [period, setPeriod] = useState('1 Month');
  const [industry, setIndustry] = useState('');
  const [notes, setNotes] = useState('');
  const [suggestion, setSuggestion] = useState<BudgetSuggestionResult | null>(null);

  // Similar campaigns form
  const [simResult, setSimResult] = useState<SimilarCampaignsResult | null>(null);

  async function handleSuggest() {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const result = await suggestBudget({
        objective,
        audienceType,
        budget,
        currency,
        audienceDescription: audienceDesc || undefined,
        campaignPeriod: period || undefined,
        clientIndustry: industry || undefined,
        notes: notes || undefined,
      });
      setSuggestion(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleFindSimilar() {
    setLoading(true);
    setError(null);
    setSimResult(null);
    try {
      const result = await findSimilarCampaigns({
        objective,
        clientIndustry: industry || undefined,
        budget: budget || undefined,
        currency,
        audienceType: audienceType || undefined,
        limit: 3,
      });
      setSimResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" style={{ background: 'rgba(7,20,55,0.3)' }}>
      <div className="h-full w-[520px] max-w-full bg-white flex flex-col shadow-2xl" style={{ borderLeft: '1px solid #E1E3EA' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #E1E3EA' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7239EA] to-[#1B84FF] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-[#071437] text-[14px] leading-tight">AI Planner</div>
              <div className="text-[11px] text-[#99A1B7] leading-tight">Powered by Claude</div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#99A1B7] hover:text-[#071437] transition-colors p-1">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 gap-4 shrink-0" style={{ borderBottom: '1px solid #E1E3EA' }}>
          {[
            { value: 'suggest' as Tab, label: 'Budget Suggestion' },
            { value: 'similar' as Tab, label: 'Similar Campaigns' },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => { setTab(t.value); setError(null); }}
              className={`py-3 text-[13px] font-medium border-b-2 transition-colors ${
                tab === t.value
                  ? 'border-[#1B84FF] text-[#1B84FF]'
                  : 'border-transparent text-[#99A1B7] hover:text-[#4B5675]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Shared fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#4B5675] uppercase tracking-wider mb-1.5">Objective</label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full border border-[#E1E3EA] rounded-lg px-3 py-2 text-[13px] text-[#071437] bg-white focus:outline-none focus:border-[#1B84FF]"
              >
                {OBJECTIVES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#4B5675] uppercase tracking-wider mb-1.5">Audience</label>
              <select
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value)}
                className="w-full border border-[#E1E3EA] rounded-lg px-3 py-2 text-[13px] text-[#071437] bg-white focus:outline-none focus:border-[#1B84FF]"
              >
                {AUDIENCE_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          {tab === 'suggest' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#4B5675] uppercase tracking-wider mb-1.5">Budget ({currency})</label>
                  <input
                    type="number"
                    value={budget || ''}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full border border-[#E1E3EA] rounded-lg px-3 py-2 text-[13px] text-[#071437] focus:outline-none focus:border-[#1B84FF]"
                    placeholder="e.g. 500000"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#4B5675] uppercase tracking-wider mb-1.5">Duration</label>
                  <input
                    type="text"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="w-full border border-[#E1E3EA] rounded-lg px-3 py-2 text-[13px] text-[#071437] focus:outline-none focus:border-[#1B84FF]"
                    placeholder="e.g. 1 Month"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#4B5675] uppercase tracking-wider mb-1.5">Client Industry</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full border border-[#E1E3EA] rounded-lg px-3 py-2 text-[13px] text-[#071437] focus:outline-none focus:border-[#1B84FF]"
                  placeholder="e.g. Banking, FMCG, Retail"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#4B5675] uppercase tracking-wider mb-1.5">Target Audience Description</label>
                <input
                  type="text"
                  value={audienceDesc}
                  onChange={(e) => setAudienceDesc(e.target.value)}
                  className="w-full border border-[#E1E3EA] rounded-lg px-3 py-2 text-[13px] text-[#071437] focus:outline-none focus:border-[#1B84FF]"
                  placeholder="e.g. Sri Lankan women 25-45 interested in banking"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#4B5675] uppercase tracking-wider mb-1.5">Planner Notes <span className="normal-case font-normal text-[#99A1B7]">(optional)</span></label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-[#E1E3EA] rounded-lg px-3 py-2 text-[13px] text-[#071437] focus:outline-none focus:border-[#1B84FF] resize-none"
                  placeholder="Any special requirements or constraints..."
                />
              </div>

              <button
                onClick={handleSuggest}
                disabled={loading || !budget}
                className="w-full py-2.5 bg-[#1B84FF] text-white text-sm font-medium rounded-lg hover:bg-[#056EE9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Asking Claude...
                  </>
                ) : '✦ Generate Budget Suggestion'}
              </button>

              {error && (
                <div className="bg-[#FFEEF3] border border-[#F8285A]/20 rounded-lg px-4 py-3 text-sm text-[#F8285A]">
                  {error}
                </div>
              )}

              {suggestion && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="bg-[#F0F9FF] border border-[#1B84FF]/20 rounded-lg p-4">
                    <p className="text-[13px] text-[#071437]">{suggestion.summary}</p>
                  </div>

                  {/* Allocations */}
                  <div>
                    <p className="text-[11px] font-semibold text-[#4B5675] uppercase tracking-wider mb-2">Suggested Allocation</p>
                    <div className="space-y-2">
                      {suggestion.allocations.map((alloc, i) => (
                        <div key={i} className="border border-[#E1E3EA] rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[13px] font-semibold text-[#071437]">{alloc.platformLabel}</span>
                            <span className="text-[13px] font-semibold text-[#1B84FF]">{alloc.budgetPct}%</span>
                          </div>
                          <div className="text-[12px] text-[#99A1B7] mb-1.5">
                            {suggestion.currency} {alloc.budgetAmount.toLocaleString()}
                          </div>
                          <p className="text-[12px] text-[#4B5675]">{alloc.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strategic notes */}
                  {suggestion.strategicNotes && (
                    <div>
                      <p className="text-[11px] font-semibold text-[#4B5675] uppercase tracking-wider mb-2">Strategic Notes</p>
                      <div className="text-[12.5px] text-[#4B5675] bg-[#F9F9F9] rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                        {suggestion.strategicNotes}
                      </div>
                    </div>
                  )}

                  {onApply && (
                    <button
                      onClick={() => { onApply(suggestion.allocations); onClose(); }}
                      className="w-full py-2.5 bg-[#17C653] text-white text-sm font-medium rounded-lg hover:bg-[#15b04a] transition-colors"
                    >
                      Apply to Plan Builder →
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'similar' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-[#4B5675] uppercase tracking-wider mb-1.5">Client Industry</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full border border-[#E1E3EA] rounded-lg px-3 py-2 text-[13px] text-[#071437] focus:outline-none focus:border-[#1B84FF]"
                  placeholder="e.g. Banking, FMCG"
                />
              </div>

              <button
                onClick={handleFindSimilar}
                disabled={loading}
                className="w-full py-2.5 bg-[#1B84FF] text-white text-sm font-medium rounded-lg hover:bg-[#056EE9] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Searching...
                  </>
                ) : '✦ Find Similar Campaigns'}
              </button>

              {error && (
                <div className="bg-[#FFEEF3] border border-[#F8285A]/20 rounded-lg px-4 py-3 text-sm text-[#F8285A]">
                  {error}
                </div>
              )}

              {simResult && (
                <div className="space-y-3">
                  {simResult.insight && (
                    <div className="bg-[#F0F9FF] border border-[#1B84FF]/20 rounded-lg p-3">
                      <p className="text-[13px] text-[#071437]">{simResult.insight}</p>
                    </div>
                  )}
                  {simResult.campaigns.length === 0 ? (
                    <p className="text-sm text-[#99A1B7] text-center py-4">No similar campaigns found yet. Save more plans to improve results.</p>
                  ) : simResult.campaigns.map((c, i) => (
                    <div key={i} className="border border-[#E1E3EA] rounded-lg p-3">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-[13px] font-semibold text-[#071437]">{c.campaignName}</span>
                        <span className="text-[11px] bg-[#EEF6FF] text-[#1B84FF] px-2 py-0.5 rounded font-medium">{c.objective}</span>
                      </div>
                      <div className="text-[12px] text-[#99A1B7] mb-1.5">{c.clientName} · {c.currency} {c.budget?.toLocaleString()}</div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {c.platforms.map((p) => (
                          <span key={p} className="text-[11px] bg-[#F9F9F9] border border-[#E1E3EA] px-2 py-0.5 rounded text-[#4B5675]">{p}</span>
                        ))}
                      </div>
                      <p className="text-[12px] text-[#4B5675] italic">{c.similarityReason}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer disclaimer */}
        <div className="shrink-0 px-6 py-3 bg-[#F9F9F9]" style={{ borderTop: '1px solid #E1E3EA' }}>
          <p className="text-[11px] text-[#99A1B7] text-center">
            Suggestions are AI-generated from benchmark data. Review before applying.
          </p>
        </div>
      </div>
    </div>
  );
}
