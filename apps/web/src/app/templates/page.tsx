'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchTemplates, deleteTemplate, useTemplate, fetchClients } from '@/lib/api';
import type { PlanTemplate } from '@/lib/api';
import type { Client } from '@/lib/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { PLATFORMS } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';

const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.value, p.label]),
);

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const colors: Record<string, string> = {
    FMCG: 'bg-[#EEF6FF] text-[#1B84FF]',
    Banking: 'bg-[#FFF8DD] text-[#B07D00]',
    Seasonal: 'bg-[#FFF5F8] text-[#F8285A]',
    'E-commerce': 'bg-[#EEFAF3] text-[#17C653]',
    Other: 'bg-[#F9F9F9] text-[#4B5675]',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full ${colors[category] ?? 'bg-[#F9F9F9] text-[#4B5675]'}`}>
      {category}
    </span>
  );
}

// ─── Use Template Modal ───────────────────────────────────────────────────────

interface UseTemplateModalProps {
  template: PlanTemplate;
  clients: Client[];
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

function UseTemplateModal({ template, clients, onClose, onCreated }: UseTemplateModalProps) {
  const [campaignName, setCampaignName] = useState('');
  const [clientId, setClientId] = useState(template.clientId ?? '');
  const [productId, setProductId] = useState(template.productId ?? '');
  const [totalBudget, setTotalBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState(template.currency);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const selectedClient = clients.find((c) => c.id === clientId);
  const products = selectedClient?.products ?? [];

  const fee1 = Number(template.fee1Pct ?? 15) / 100;
  const fee2 = Number(template.fee2Pct ?? 0) / 100;
  const totalFee = fee1 + fee2;
  const budgetNum = parseFloat(totalBudget) || 0;
  const mediaSpend = totalFee > 0 ? budgetNum / (1 + totalFee) : budgetNum;

  const handleCreate = async () => {
    if (!campaignName.trim() || !totalBudget) return;
    setCreating(true);
    setError('');
    try {
      const result = await useTemplate(template.id, {
        campaignName: campaignName.trim(),
        clientId: clientId || undefined,
        productId: productId || undefined,
        totalBudget: budgetNum,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        currency,
      });
      const groupId = result.variantGroupId ?? result.id;
      onCreated(groupId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create plan');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[12px] border border-[#E1E3EA] shadow-xl w-full max-w-lg my-4">
        <div className="px-6 py-4 border-b border-[#F1F1F4]">
          <h3 className="text-base font-semibold text-[#071437]">Create Plan from Template</h3>
          <p className="text-xs text-[#99A1B7] mt-0.5">{template.name}</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Campaign Name</label>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Q2 Brand Awareness"
              autoFocus
              className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:border-[#1B84FF]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Client</label>
              <select
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setProductId(''); }}
                className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:border-[#1B84FF]"
              >
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Product</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                disabled={!clientId}
                className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:border-[#1B84FF] disabled:bg-[#F9F9F9] disabled:text-[#99A1B7]"
              >
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Total Budget</label>
            <div className="flex gap-2">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="border border-[#E1E3EA] rounded-[6px] px-2 py-2 text-sm focus:outline-none focus:border-[#1B84FF] w-20"
              >
                <option value="LKR">LKR</option>
                <option value="USD">USD</option>
                <option value="AED">AED</option>
              </select>
              <input
                type="number"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                placeholder="0"
                className="flex-1 border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:border-[#1B84FF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:border-[#1B84FF]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:border-[#1B84FF]"
              />
            </div>
          </div>

          {/* Row preview + budget split */}
          {template.templateRows.length > 0 && (
            <div className="bg-[#F9F9F9] rounded-[8px] border border-[#E1E3EA] p-3 space-y-2">
              <p className="text-[11px] font-semibold text-[#4B5675] uppercase tracking-wider">Rows from template</p>
              {template.templateRows.map((r, i) => {
                const pct = r.budgetPct as number;
                const rowBudget = budgetNum > 0 ? Math.round(mediaSpend * (pct / 100)) : null;
                const platformLabel = PLATFORM_LABEL[r.platform as string] ?? (r.platform as string);
                return (
                  <div key={i} className="flex items-center justify-between text-xs text-[#4B5675]">
                    <span>
                      <span className="font-medium">{platformLabel}</span>
                      {!!r.objective && <span className="text-[#99A1B7]"> / {String(r.objective)}</span>}
                      {!!r.audienceType && <span className="text-[#99A1B7]"> / {String(r.audienceType)}</span>}
                    </span>
                    <span className="tabular-nums text-right">
                      <span className="text-[#99A1B7]">{pct}%</span>
                      {rowBudget != null && rowBudget > 0 && (
                        <span className="ml-2 font-semibold text-[#071437]">
                          {currency} {rowBudget.toLocaleString()}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-xs text-[#F8285A]">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-[#F1F1F4] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#4B5675] border border-[#E1E3EA] rounded-lg hover:bg-[#F9F9F9] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !campaignName.trim() || !totalBudget}
            className="px-5 py-2 text-sm font-semibold text-white bg-[#1B84FF] rounded-lg hover:bg-[#056EE9] transition-colors disabled:opacity-60"
          >
            {creating ? 'Creating…' : 'Create Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: PlanTemplate;
  currentUserId: string;
  isAdmin: boolean;
  onUse: (t: PlanTemplate) => void;
  onDelete: (id: string) => void;
}

function TemplateCard({ template, currentUserId, isAdmin, onUse, onDelete }: TemplateCardProps) {
  const platforms = [...new Set(
    template.templateRows.map((r) => PLATFORM_LABEL[r.platform as string] ?? (r.platform as string))
  )].slice(0, 3);

  const canDelete = template.createdById === currentUserId || isAdmin;

  return (
    <div className="bg-white border border-[#E1E3EA] rounded-[10px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base">📋</span>
            <h3 className="text-sm font-semibold text-[#071437] truncate">{template.name}</h3>
            {template.isGlobal && (
              <span className="text-[9px] font-bold text-[#17C653] bg-[#EEFAF3] border border-[#17C653]/20 rounded-full px-1.5 py-0.5">
                GLOBAL
              </span>
            )}
          </div>
          <CategoryBadge category={template.category} />
          {template.description && (
            <p className="text-xs text-[#99A1B7] mt-1 line-clamp-2">{template.description}</p>
          )}
        </div>
      </div>

      <div className="text-xs text-[#4B5675] space-y-0.5">
        {platforms.length > 0 && (
          <p className="truncate">{platforms.join(' · ')}{template.templateRows.length > 3 ? ` +${template.templateRows.length - 3}` : ''}</p>
        )}
        <p className="text-[#99A1B7]">
          {template.templateRows.length} row{template.templateRows.length !== 1 ? 's' : ''} · {template.currency}
          {template.useCount > 0 && ` · Used ${template.useCount} time${template.useCount !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-[#F1F1F4]">
        <button
          onClick={() => onUse(template)}
          className="flex-1 bg-[#1B84FF] text-white rounded-[6px] px-3 py-1.5 text-xs font-semibold hover:bg-[#056EE9] transition-colors text-center"
        >
          Use Template
        </button>
        {canDelete && (
          <button
            onClick={() => onDelete(template.id)}
            className="text-[#99A1B7] hover:text-[#F8285A] text-xs transition-colors px-2 py-1.5"
            title="Delete template"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingTemplate, setUsingTemplate] = useState<PlanTemplate | null>(null);

  const isAdmin = user?.role === 'admin';
  const currentUserId = user?.id ?? '';

  useEffect(() => {
    Promise.all([
      fetchTemplates(),
      fetchClients(),
    ])
      .then(([t, c]) => { setTemplates(t); setClients(c); })
      .catch(() => setError('Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await deleteTemplate(id);
      setTemplates((ts) => ts.filter((t) => t.id !== id));
    } catch {
      alert('Failed to delete template');
    }
  };

  const myTemplates = templates.filter((t) => !t.isGlobal || t.createdById === currentUserId);
  const globalTemplates = templates.filter((t) => t.isGlobal && t.createdById !== currentUserId);

  return (
    <>
      <PageHeader
        title="Plan Templates"
        subtitle="Reusable plan structures for faster media plan creation"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Templates' }]}
        action={
          <button
            onClick={() => router.push('/media-plans/new')}
            className="bg-[#1B84FF] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#056EE9] transition-colors flex items-center gap-2 shadow-sm"
          >
            <span className="text-base leading-none">+</span>
            New Plan
          </button>
        }
      />

      <main className="p-6 lg:p-8">
      {usingTemplate && (
        <UseTemplateModal
          template={usingTemplate}
          clients={clients}
          onClose={() => setUsingTemplate(null)}
          onCreated={(groupId) => {
            setUsingTemplate(null);
            router.push(`/media-plans/${groupId}`);
          }}
        />
      )}

      {error && (
        <div className="bg-[#FFEEF3] border border-[#F8285A]/20 rounded-lg px-4 py-3 text-sm text-[#F8285A] mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#99A1B7] text-sm gap-2">
          <div className="w-4 h-4 border-2 border-[#1B84FF]/30 border-t-[#1B84FF] rounded-full animate-spin" />
          Loading templates…
        </div>
      ) : (
        <>
          {/* My Templates */}
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-[#071437] mb-4 flex items-center gap-2">
              My Templates
              <span className="text-xs font-normal text-[#99A1B7]">({myTemplates.length})</span>
            </h2>
            {myTemplates.length === 0 ? (
              <div className="bg-white border border-dashed border-[#E1E3EA] rounded-[10px] p-10 text-center">
                <div className="text-3xl mb-3">📋</div>
                <p className="text-sm font-medium text-[#4B5675]">No templates yet</p>
                <p className="text-xs text-[#99A1B7] mt-1 mb-4">Open a media plan and click &ldquo;Save as Template&rdquo; to create one</p>
                <button
                  onClick={() => router.push('/media-plans')}
                  className="text-sm text-[#1B84FF] hover:underline"
                >
                  Go to Media Plans →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {myTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    onUse={setUsingTemplate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Global Templates */}
          {globalTemplates.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[#071437] mb-4 flex items-center gap-2">
                Global Templates
                <span className="text-xs font-normal text-[#99A1B7]">Shared by admin · ({globalTemplates.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {globalTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    onUse={setUsingTemplate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
      </main>
    </>
  );
}
