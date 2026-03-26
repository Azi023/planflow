import { useState, useCallback } from "react";

const PLATFORMS = {
  meta_ig: { label: "Meta + IG", ad_types: ["Feed", "Stories", "Reels", "Carousel"], currency: "LKR" },
  meta: { label: "Meta only", ad_types: ["Feed", "Stories", "Carousel", "Page Like"], currency: "LKR" },
  ig: { label: "IG only", ad_types: ["Feed", "Stories", "Reels", "Explore"], currency: "LKR" },
  youtube: { label: "YouTube", ad_types: ["Skippable Video", "Bumper Ad", "Efficient Reach", "Audio Ad"], currency: "USD" },
  gdn: { label: "GDN", ad_types: ["Display Banner", "Responsive Display"], currency: "USD" },
  search: { label: "Google Search", ad_types: ["Search Ads", "Demand Gen", "Performance Max"], currency: "USD" },
  tiktok: { label: "TikTok", ad_types: ["In-Feed Video", "TopView", "Spark Ads"], currency: "USD" },
  linkedin: { label: "LinkedIn", ad_types: ["Sponsored Content", "Message Ads", "Text Ads"], currency: "USD" },
};

const OBJECTIVES = ["Awareness", "Engagement", "Traffic", "Leads", "Conversions"];
const AUDIENCES = [
  { id: 1, name: "Mass Youth (18-34)", type: "mass", size: "3M - 4M" },
  { id: 2, name: "Mass General (18-60)", type: "mass", size: "4M - 5M" },
  { id: 3, name: "Niche - Entrepreneurs", type: "niche", size: "200K - 400K" },
  { id: 4, name: "Niche - Parents", type: "niche", size: "500K - 800K" },
  { id: 5, name: "Niche - High Income", type: "niche", size: "150K - 300K" },
];

const BENCHMARKS = {
  "meta_ig|awareness|mass": { cpm: [35, 65], cpr: [37, 75], cpe: [3, 8], cpc: [150, 250], ctr: [0.001, 0.1] },
  "meta_ig|awareness|niche": { cpm: [65, 85], cpr: [75, 90], cpe: [3, 8], cpc: [200, 350], ctr: [0.001, 0.1] },
  "meta_ig|engagement|mass": { cpm: [110, 160], cpr: [150, 200], cpe: [1, 4], cpc: [60, 150], ctr: [0.001, 0.1], cpv2s: [0.15, 0.20], cpvtv: [0.9, 2] },
  "meta_ig|engagement|niche": { cpm: [119, 230], cpr: [130, 230], cpe: [3, 7], cpc: [78, 90], ctr: [0.001, 0.1], cpv2s: [0.30, 1], cpvtv: [1, 2.5] },
  "meta_ig|traffic|mass": { cpm: [55, 90], cpr: [62, 90], cpe: [3, 8], cpc: [3, 6], ctr: [0.07, 2], cplv: [20, 100] },
  "youtube|awareness|mass": { cpm: [0.1, 2], cpv: [0.001, 0.003] },
  "youtube|awareness|niche": { cpm: [2, 3], cpv: [0.001, 0.003] },
  "gdn|awareness|mass": { cpm: [0.06, 0.1], cpc: [0.06, 0.1], ctr: [0.01, 1] },
  "search|traffic|mass": { cpm: [0.88, 1.2], cpc: [0.03, 0.2], ctr: [1.3, 4.44] },
  "meta_ig|leads|mass": { cpl: [35, 75] },
  "search|leads|mass": { cpl: [7, 12], cpm: [9, 15], cpc: [0.05, 0.1] },
};

function calcKpis(budget, benchmarks) {
  if (!benchmarks || !budget) return {};
  const k = {};
  if (benchmarks.cpm) {
    k.impressions = [Math.round(budget / benchmarks.cpm[1] * 1000), Math.round(budget / benchmarks.cpm[0] * 1000)];
  }
  if (benchmarks.cpr) {
    k.reach = [Math.round(budget / benchmarks.cpr[1] * 1000), Math.round(budget / benchmarks.cpr[0] * 1000)];
  }
  if (benchmarks.cpc) {
    k.clicks = [Math.round(budget / benchmarks.cpc[1]), Math.round(budget / benchmarks.cpc[0])];
  }
  if (benchmarks.cpe) {
    k.engagements = [Math.round(budget / benchmarks.cpe[1]), Math.round(budget / benchmarks.cpe[0])];
  }
  if (benchmarks.cpv) {
    k.views = [Math.round(budget / benchmarks.cpv[1]), Math.round(budget / benchmarks.cpv[0])];
  }
  if (benchmarks.cpl) {
    k.leads = [Math.round(budget / benchmarks.cpl[1]), Math.round(budget / benchmarks.cpl[0])];
  }
  if (benchmarks.cplv) {
    k.landingPageViews = [Math.round(budget / benchmarks.cplv[1]), Math.round(budget / benchmarks.cplv[0])];
  }
  if (k.impressions && k.reach) {
    k.frequency = [(k.impressions[0] / k.reach[1]).toFixed(1), (k.impressions[1] / k.reach[0]).toFixed(1)];
  }
  return k;
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K";
  return n.toString();
}

function fmtRange(arr) {
  if (!arr) return "—";
  return fmtNum(arr[0]) + " – " + fmtNum(arr[1]);
}

const Badge = ({ children, color = "gray" }) => {
  const colors = {
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[color]}`}>{children}</span>;
};

const MetricCard = ({ label, value, sub, color = "text-gray-900" }) => (
  <div className="bg-gray-50 rounded-lg p-4">
    <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
    <div className={`text-xl font-semibold ${color}`}>{value}</div>
    {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
  </div>
);

export default function MediaPlanBuilder() {
  const [campaign, setCampaign] = useState({
    client: "People's Bank",
    product: "Credit Card Offers",
    name: "Avurudu Meta Campaign - Clothing Category",
    startDate: "2026-04-01",
    endDate: "2026-04-28",
    totalBudget: 300000,
    mgmtFeePct: 15,
    currency: "LKR",
  });

  const mediaBudget = Math.round(campaign.totalBudget / (1 + campaign.mgmtFeePct / 100));
  const mgmtFee = campaign.totalBudget - mediaBudget;

  const [activeVariant, setActiveVariant] = useState(0);
  const [variants, setVariants] = useState([
    {
      name: "Option 1",
      rows: [
        { id: 1, platform: "meta_ig", adType: "Feed", objective: "Awareness", audience: 1, budget: 200000 },
        { id: 2, platform: "meta_ig", adType: "Stories", objective: "Awareness", audience: 1, budget: 100000 },
      ],
    },
  ]);

  const [notes, setNotes] = useState("");
  const [showTestCalc, setShowTestCalc] = useState(false);
  const [testPlatform, setTestPlatform] = useState("meta_ig");
  const [testObjective, setTestObjective] = useState("awareness");
  const [testAudience, setTestAudience] = useState("mass");
  const [testBudget, setTestBudget] = useState(100000);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState("plans");

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" },
    { id: "clients", label: "Clients", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { id: "campaigns", label: "Campaigns", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
    { id: "plans", label: "Media plans", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
    { id: "audiences", label: "Audiences", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
    { id: "benchmarks", label: "Benchmarks", icon: "M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm4 3h8m-8 4h5" },
    { id: "settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  ];

  const addRow = () => {
    const v = [...variants];
    const rows = v[activeVariant].rows;
    v[activeVariant] = {
      ...v[activeVariant],
      rows: [...rows, { id: Date.now(), platform: "meta_ig", adType: "Feed", objective: "Awareness", audience: 1, budget: 0 }],
    };
    setVariants(v);
  };

  const updateRow = (rowId, field, value) => {
    const v = [...variants];
    v[activeVariant] = {
      ...v[activeVariant],
      rows: v[activeVariant].rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)),
    };
    setVariants(v);
  };

  const removeRow = (rowId) => {
    const v = [...variants];
    v[activeVariant] = {
      ...v[activeVariant],
      rows: v[activeVariant].rows.filter((r) => r.id !== rowId),
    };
    setVariants(v);
  };

  const duplicateVariant = () => {
    const src = variants[activeVariant];
    setVariants([...variants, { name: `Option ${variants.length + 1}`, rows: src.rows.map((r) => ({ ...r, id: Date.now() + Math.random() })) }]);
    setActiveVariant(variants.length);
  };

  const currentRows = variants[activeVariant]?.rows || [];
  const totalAllocated = currentRows.reduce((s, r) => s + (r.budget || 0), 0);
  const totalReach = currentRows.reduce((s, r) => {
    const key = `${r.platform}|${r.objective.toLowerCase()}|${AUDIENCES.find((a) => a.id === r.audience)?.type || "mass"}`;
    const b = BENCHMARKS[key];
    const kpis = calcKpis(r.budget, b);
    return [s[0] + (kpis.reach?.[0] || 0), s[1] + (kpis.reach?.[1] || 0)];
  }, [0, 0]);
  const totalImpressions = currentRows.reduce((s, r) => {
    const key = `${r.platform}|${r.objective.toLowerCase()}|${AUDIENCES.find((a) => a.id === r.audience)?.type || "mass"}`;
    const b = BENCHMARKS[key];
    const kpis = calcKpis(r.budget, b);
    return [s[0] + (kpis.impressions?.[0] || 0), s[1] + (kpis.impressions?.[1] || 0)];
  }, [0, 0]);

  const testKey = `${testPlatform}|${testObjective}|${testAudience}`;
  const testBench = BENCHMARKS[testKey];
  const testKpis = calcKpis(testBudget, testBench);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 text-sm">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? "w-16" : "w-56"} bg-white border-r border-gray-200 flex flex-col transition-all duration-200 flex-shrink-0`}>
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">PF</div>
          {!sidebarCollapsed && <span className="font-semibold text-base">PlanFlow</span>}
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map((n) => (
            <button key={n.id} onClick={() => setActivePage(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${activePage === n.id ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={n.icon} /></svg>
              {!sidebarCollapsed && <span className="text-sm font-medium">{n.label}</span>}
            </button>
          ))}
        </nav>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-3 border-t border-gray-100 text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={sidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} /></svg>
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Media plan builder</h1>
            <Badge color="amber">Draft</Badge>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Save draft</button>
            <button className="px-3 py-1.5 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Preview</button>
            <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium">Export PPTX</button>
            <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Export Excel</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Campaign Header */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Client</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" value={campaign.client} onChange={(e) => setCampaign({ ...campaign, client: e.target.value })}>
                  <option>People's Bank</option>
                  <option>Ritzbury</option>
                  <option>Dialog Axiata</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Product / category</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" value={campaign.product} onChange={(e) => setCampaign({ ...campaign, product: e.target.value })}>
                  <option>Credit Card Offers</option>
                  <option>Leasing</option>
                  <option>Women's Day</option>
                  <option>SME Campaign</option>
                  <option>Remittance</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Campaign name</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={campaign.name} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Flight dates</label>
                <div className="flex gap-2">
                  <input type="date" className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm" value={campaign.startDate} onChange={(e) => setCampaign({ ...campaign, startDate: e.target.value })} />
                  <input type="date" className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm" value={campaign.endDate} onChange={(e) => setCampaign({ ...campaign, endDate: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Total budget</label>
                <div className="flex">
                  <select className="border border-r-0 border-gray-200 rounded-l-lg px-2 py-2 text-sm bg-gray-50 text-gray-500" value={campaign.currency} onChange={(e) => setCampaign({ ...campaign, currency: e.target.value })}>
                    <option>LKR</option>
                    <option>USD</option>
                  </select>
                  <input type="number" className="flex-1 border border-gray-200 rounded-r-lg px-3 py-2 text-sm" value={campaign.totalBudget} onChange={(e) => setCampaign({ ...campaign, totalBudget: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Management fee %</label>
                <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={campaign.mgmtFeePct} onChange={(e) => setCampaign({ ...campaign, mgmtFeePct: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Media spend</label>
                <div className="border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm font-medium">{campaign.currency} {mediaBudget.toLocaleString()}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Management fee</label>
                <div className="border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500">{campaign.currency} {mgmtFee.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-3">
            <MetricCard label="Media spend" value={`${campaign.currency} ${mediaBudget.toLocaleString()}`} sub={`of ${campaign.currency} ${campaign.totalBudget.toLocaleString()} total`} />
            <MetricCard label="Allocated" value={`${campaign.currency} ${totalAllocated.toLocaleString()}`} sub={totalAllocated > mediaBudget ? "Over budget!" : `${Math.round(totalAllocated / mediaBudget * 100)}% allocated`} color={totalAllocated > mediaBudget ? "text-red-600" : "text-gray-900"} />
            <MetricCard label="Est. reach" value={totalReach[1] > 0 ? fmtRange(totalReach) : "—"} sub="Combined" />
            <MetricCard label="Est. impressions" value={totalImpressions[1] > 0 ? fmtRange(totalImpressions) : "—"} sub="Combined" />
            <MetricCard label="Duration" value={Math.round((new Date(campaign.endDate) - new Date(campaign.startDate)) / 86400000) + " days"} sub={`${campaign.startDate} → ${campaign.endDate}`} />
          </div>

          {/* Variant Tabs */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="border-b border-gray-200 px-5 flex items-center justify-between">
              <div className="flex gap-1">
                {variants.map((v, i) => (
                  <button key={i} onClick={() => setActiveVariant(i)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${i === activeVariant ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{v.name}</button>
                ))}
                <button onClick={duplicateVariant} className="px-3 py-3 text-gray-400 hover:text-blue-600 text-sm">+ Duplicate as option</button>
              </div>
              <button onClick={addRow} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100">+ Add row</button>
            </div>

            {/* Plan Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs font-medium">
                    <th className="text-left px-4 py-3">Platform</th>
                    <th className="text-left px-3 py-3">Ad type</th>
                    <th className="text-left px-3 py-3">Objective</th>
                    <th className="text-left px-3 py-3">Audience</th>
                    <th className="text-right px-3 py-3">Budget ({campaign.currency})</th>
                    <th className="text-right px-3 py-3">%</th>
                    <th className="text-right px-3 py-3">Reach</th>
                    <th className="text-right px-3 py-3">Impressions</th>
                    <th className="text-right px-3 py-3">CPM</th>
                    <th className="text-right px-3 py-3">CPC</th>
                    <th className="text-right px-3 py-3">CTR</th>
                    <th className="text-right px-3 py-3">Freq</th>
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.map((row) => {
                    const aud = AUDIENCES.find((a) => a.id === row.audience);
                    const key = `${row.platform}|${row.objective.toLowerCase()}|${aud?.type || "mass"}`;
                    const bench = BENCHMARKS[key];
                    const kpis = calcKpis(row.budget, bench);
                    const pct = mediaBudget > 0 ? Math.round((row.budget / mediaBudget) * 100) : 0;
                    return (
                      <tr key={row.id} className="border-t border-gray-100 hover:bg-blue-50/30">
                        <td className="px-4 py-2.5">
                          <select className="border border-gray-200 rounded px-2 py-1.5 text-sm bg-white w-full" value={row.platform} onChange={(e) => updateRow(row.id, "platform", e.target.value)}>
                            {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <select className="border border-gray-200 rounded px-2 py-1.5 text-sm bg-white w-full" value={row.adType} onChange={(e) => updateRow(row.id, "adType", e.target.value)}>
                            {PLATFORMS[row.platform]?.ad_types.map((t) => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <select className="border border-gray-200 rounded px-2 py-1.5 text-sm bg-white w-full" value={row.objective} onChange={(e) => updateRow(row.id, "objective", e.target.value)}>
                            {OBJECTIVES.map((o) => <option key={o}>{o}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <select className="border border-gray-200 rounded px-2 py-1.5 text-sm bg-white w-full" value={row.audience} onChange={(e) => updateRow(row.id, "audience", Number(e.target.value))}>
                            {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="number" className="w-24 border border-gray-200 rounded px-2 py-1.5 text-sm text-right" value={row.budget} onChange={(e) => updateRow(row.id, "budget", Number(e.target.value))} />
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500">{pct}%</td>
                        <td className="px-3 py-2.5 text-right font-medium">{fmtRange(kpis.reach)}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{fmtRange(kpis.impressions)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{bench?.cpm ? `${bench.cpm[0]}–${bench.cpm[1]}` : "—"}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{bench?.cpc ? `${bench.cpc[0]}–${bench.cpc[1]}` : "—"}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{bench?.ctr ? `${bench.ctr[0]}–${bench.ctr[1]}%` : "—"}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{fmtRange(kpis.frequency)}</td>
                        <td className="px-2 py-2.5">
                          <button onClick={() => removeRow(row.id)} className="text-gray-300 hover:text-red-500 p-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-sm">
                    <td className="px-4 py-3" colSpan={4}>Totals</td>
                    <td className="px-3 py-3 text-right">{totalAllocated.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right">{mediaBudget > 0 ? Math.round(totalAllocated / mediaBudget * 100) : 0}%</td>
                    <td className="px-3 py-3 text-right">{fmtRange(totalReach)}</td>
                    <td className="px-3 py-3 text-right">{fmtRange(totalImpressions)}</td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Strategic Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-xs text-gray-500 font-medium mb-2">Strategic notes and remarks</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm min-h-[80px] resize-y" placeholder="Platform caveats, creative recommendations, audience insights..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            <p className="text-xs text-gray-400 mt-2">These notes will be included in the exported deliverable (PPTX/PDF).</p>
          </div>

          {/* Test Calculator */}
          <div className="bg-white rounded-xl border border-gray-200">
            <button onClick={() => setShowTestCalc(!showTestCalc)} className="w-full px-5 py-4 flex items-center justify-between text-left">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm1.746 4.5h3.75a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75h-3.75a.75.75 0 00-.75.75v11.25c0 .414.336.75.75.75z" /></svg>
                <span className="font-medium">Test calculator</span>
                <span className="text-xs text-gray-400">Verify individual KPI calculations against the benchmark dataset</span>
              </div>
              <svg className={`w-5 h-5 text-gray-400 transition-transform ${showTestCalc ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>

            {showTestCalc && (
              <div className="border-t border-gray-200 p-5">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1.5">Platform</label>
                      <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" value={testPlatform} onChange={(e) => setTestPlatform(e.target.value)}>
                        {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1.5">Objective</label>
                      <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" value={testObjective} onChange={(e) => setTestObjective(e.target.value)}>
                        {OBJECTIVES.map((o) => <option key={o} value={o.toLowerCase()}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1.5">Audience type</label>
                      <div className="flex gap-2">
                        {["mass", "niche"].map((t) => (
                          <button key={t} onClick={() => setTestAudience(t)} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${testAudience === t ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                            {t === "mass" ? "Mass (1M+)" : "Niche (<1M)"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1.5">Budget ({campaign.currency})</label>
                      <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={testBudget} onChange={(e) => setTestBudget(Number(e.target.value))} />
                    </div>
                  </div>

                  <div>
                    {testBench ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="text-sm font-semibold text-emerald-800">Benchmark matched</span>
                        </div>
                        <div className="text-xs text-emerald-700 mb-4">
                          {PLATFORMS[testPlatform]?.label} · {testObjective} · {testAudience === "mass" ? "Mass audience" : "Niche audience"}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {testKpis.reach && <div className="bg-white rounded-lg p-3"><div className="text-xs text-gray-500">Reach</div><div className="text-base font-semibold">{fmtRange(testKpis.reach)}</div></div>}
                          {testKpis.impressions && <div className="bg-white rounded-lg p-3"><div className="text-xs text-gray-500">Impressions</div><div className="text-base font-semibold">{fmtRange(testKpis.impressions)}</div></div>}
                          {testKpis.clicks && <div className="bg-white rounded-lg p-3"><div className="text-xs text-gray-500">Clicks</div><div className="text-base font-semibold">{fmtRange(testKpis.clicks)}</div></div>}
                          {testKpis.engagements && <div className="bg-white rounded-lg p-3"><div className="text-xs text-gray-500">Engagements</div><div className="text-base font-semibold">{fmtRange(testKpis.engagements)}</div></div>}
                          {testKpis.views && <div className="bg-white rounded-lg p-3"><div className="text-xs text-gray-500">Video views</div><div className="text-base font-semibold">{fmtRange(testKpis.views)}</div></div>}
                          {testKpis.leads && <div className="bg-white rounded-lg p-3"><div className="text-xs text-gray-500">Leads</div><div className="text-base font-semibold">{fmtRange(testKpis.leads)}</div></div>}
                          {testKpis.frequency && <div className="bg-white rounded-lg p-3"><div className="text-xs text-gray-500">Frequency</div><div className="text-base font-semibold">{testKpis.frequency[0]}x – {testKpis.frequency[1]}x</div></div>}
                          {testKpis.landingPageViews && <div className="bg-white rounded-lg p-3"><div className="text-xs text-gray-500">Landing page views</div><div className="text-base font-semibold">{fmtRange(testKpis.landingPageViews)}</div></div>}
                        </div>
                        <div className="mt-3 pt-3 border-t border-emerald-200">
                          <div className="text-xs text-emerald-700 font-medium mb-2">Benchmark values used:</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(testBench).map(([k, v]) => (
                              <span key={k} className="bg-white text-xs px-2 py-1 rounded text-emerald-700">{k.toUpperCase()}: {Array.isArray(v) ? `${v[0]} – ${v[1]}` : v}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center h-full text-center">
                        <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        <p className="text-sm text-gray-500 font-medium">No benchmark match</p>
                        <p className="text-xs text-gray-400 mt-1">No data for this platform + objective + audience combination. Try a different selection.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
            <p className="text-xs text-amber-800">Results and costs are influenced by several external factors including placement, topic, audience behavior, platform algorithms, content relevance, and inventory availability. Therefore, we cannot guarantee specific performance figures — any numbers provided are estimates based on past performance trends and platform data.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
