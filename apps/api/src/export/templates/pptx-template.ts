import PptxGenJS from 'pptxgenjs';
import { MediaPlan } from '../../entities/media-plan.entity';
import { MediaPlanRow } from '../../entities/media-plan-row.entity';

const BRAND_BLUE = '006098';
const BRAND_DARK = '071437';
const BRAND_GREY = '4B5675';
const BRAND_LIGHT = 'F1F5F9';
const WHITE = 'FFFFFF';
const GREEN = '2E7D32';
const GREEN_LIGHT = 'E8F5E9';
const RED = 'C62828';

function fmt(v: number | null | undefined, decimals = 0): string {
  if (v == null || isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtRange(
  low: number | null | undefined,
  high: number | null | undefined,
  decimals = 0,
): string {
  if (low == null && high == null) return '—';
  if (low == null) return fmt(high, decimals);
  if (high == null) return fmt(low, decimals);
  return `${fmt(low, decimals)} – ${fmt(high, decimals)}`;
}

/** Safely extract a KPI value from either nested or flat projectedKpis structure */
function extractKpi(
  kpis: Record<string, unknown>,
  nestedPath: string,
  flatKey: string,
): number | null {
  const parts = nestedPath.split('.');
  let val: unknown = kpis;
  for (const part of parts) {
    if (val == null || typeof val !== 'object') {
      val = undefined;
      break;
    }
    val = (val as Record<string, unknown>)[part];
  }
  if (val != null && !isNaN(Number(val))) return Number(val);
  const flat = kpis[flatKey];
  if (flat != null && !isNaN(Number(flat))) return Number(flat);
  return null;
}

function monthYear(date?: string | Date | null): string {
  if (!date) return '';
  const d = new Date(date as string);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Typed helper for table cell options to avoid repeated casts
type CellOpts = {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fill?: PptxGenJS.ShapeFillProps;
  align?: PptxGenJS.HAlign;
};

function cell(text: string, opts: CellOpts = {}): PptxGenJS.TableCell {
  return { text, options: opts as PptxGenJS.TableCellProps };
}

function hdrCell(text: string): PptxGenJS.TableCell {
  return cell(text, { bold: true, color: WHITE, fill: { color: GREEN } });
}

function dataCell(
  text: string,
  bg: string,
  align?: PptxGenJS.HAlign,
  bold?: boolean,
  color?: string,
): PptxGenJS.TableCell {
  return cell(text, { fill: { color: bg }, align, bold, color });
}

export async function buildPptxBuffer(
  plan: MediaPlan,
  rows: MediaPlanRow[],
): Promise<Buffer> {
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5"
  pptx.author = plan.preparedBy ?? 'Jasmin Media';
  pptx.company = 'DC Group | Jasmin Media';
  pptx.subject = plan.campaignName ?? 'Media Plan';
  pptx.title = `KPIs for ${plan.campaignName ?? 'Campaign'}`;

  const clientName =
    (plan as unknown as { client?: { name?: string } }).client?.name ??
    'Client';
  const campaignName = plan.campaignName ?? 'Campaign';
  const currency = plan.currency ?? 'LKR';

  // ── Slide 1: Cover ──────────────────────────────────────────────────────────
  const slide1 = pptx.addSlide();

  slide1.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: '55%',
    fill: { color: BRAND_BLUE },
  });

  slide1.addText('DC Group | Jasmin Media', {
    x: 0.5,
    y: 0.3,
    w: 12,
    h: 0.5,
    fontSize: 14,
    color: WHITE,
    fontFace: 'Inter',
  });

  slide1.addText(`KPI's for ${campaignName}`, {
    x: 0.5,
    y: 1.5,
    w: 12,
    h: 1.2,
    fontSize: 32,
    color: WHITE,
    bold: true,
    fontFace: 'Inter',
  });

  slide1.addText(monthYear(plan.startDate) || monthYear(plan.createdAt), {
    x: 0.5,
    y: 2.8,
    w: 10,
    h: 0.6,
    fontSize: 18,
    color: 'D0E8F5',
    fontFace: 'Inter',
  });

  slide1.addText(clientName, {
    x: 0.5,
    y: 4.5,
    w: 12,
    h: 0.6,
    fontSize: 22,
    color: BRAND_DARK,
    bold: true,
    fontFace: 'Inter',
  });

  if (plan.preparedBy) {
    slide1.addText(`Prepared by: ${plan.preparedBy}`, {
      x: 0.5,
      y: 5.2,
      w: 8,
      h: 0.4,
      fontSize: 11,
      color: BRAND_GREY,
      fontFace: 'Inter',
    });
  }

  slide1.addText('www.jasmin-media.com', {
    x: 0.5,
    y: 6.9,
    w: 12,
    h: 0.35,
    fontSize: 10,
    color: BRAND_GREY,
    italic: true,
    fontFace: 'Inter',
    align: 'center',
  });

  // ── Slide 2: Audience & Investment Overview ─────────────────────────────────
  const slide2 = pptx.addSlide();

  slide2.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.8,
    fill: { color: BRAND_BLUE },
  });
  slide2.addText('Investment & KPIs — Audience Targeting', {
    x: 0.3,
    y: 0.1,
    w: 12,
    h: 0.6,
    fontSize: 18,
    color: WHITE,
    bold: true,
    fontFace: 'Inter',
  });

  const audienceHeaderRow: PptxGenJS.TableRow = [
    hdrCell('Audiences'),
    hdrCell('Targeting Criteria'),
    hdrCell('Audience Size'),
    hdrCell(`Budget (${currency})`),
    hdrCell('Campaign Period'),
    hdrCell('CPM'),
    hdrCell('Frequency'),
  ];

  const audienceDataRows: PptxGenJS.TableRow[] = rows.map((row, idx) => {
    const kpis = (row.projectedKpis ?? {}) as Record<string, unknown>;
    const bg = idx % 2 === 0 ? WHITE : BRAND_LIGHT;
    return [
      dataCell(row.audienceName ?? '', bg),
      dataCell(row.targetingCriteria ?? '', bg),
      dataCell(row.audienceSize ?? '', bg),
      dataCell(row.budget ? fmt(Number(row.budget)) : '—', bg, 'right'),
      dataCell(plan.campaignPeriod ?? '', bg),
      dataCell(
        fmtRange(
          extractKpi(kpis, 'benchmark.cpmLow', 'cpmLow'),
          extractKpi(kpis, 'benchmark.cpmHigh', 'cpmHigh'),
          2,
        ),
        bg,
        'center',
      ),
      dataCell(
        fmtRange(
          extractKpi(kpis, 'frequency.low', 'frequencyLow'),
          extractKpi(kpis, 'frequency.high', 'frequencyHigh'),
          1,
        ),
        bg,
        'center',
      ),
    ];
  });

  slide2.addTable([audienceHeaderRow, ...audienceDataRows], {
    x: 0.3,
    y: 1.0,
    w: 12.7,
    h: 5.8,
    fontSize: 10,
    border: { pt: 0.5, color: 'E1E3EA' },
    colW: [2.2, 3.0, 1.5, 1.5, 1.5, 1.5, 1.5],
    autoPage: true,
    autoPageRepeatHeader: true,
    fontFace: 'Inter',
  });

  slide2.addText('www.jasmin-media.com', {
    x: 0.3,
    y: 7.1,
    w: 12.7,
    h: 0.3,
    fontSize: 9,
    color: BRAND_GREY,
    italic: true,
    align: 'center',
    fontFace: 'Inter',
  });

  // ── Slide 3: Investment & KPI Breakdown ────────────────────────────────────
  const slide3 = pptx.addSlide();

  slide3.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.8,
    fill: { color: BRAND_BLUE },
  });
  slide3.addText('Investment & KPIs', {
    x: 0.3,
    y: 0.1,
    w: 12,
    h: 0.6,
    fontSize: 18,
    color: WHITE,
    bold: true,
    fontFace: 'Inter',
  });

  const kpiHeaderRow: PptxGenJS.TableRow = [
    hdrCell('Platform'),
    hdrCell('Campaign'),
    hdrCell('Creative / Assets'),
    hdrCell('Ad Type'),
    hdrCell('Video Views'),
    hdrCell('Impressions'),
    hdrCell(`Investment (${currency})`),
  ];

  let budgetTotal = 0;
  let impressionsLowTotal = 0;
  let impressionsHighTotal = 0;

  const kpiDataRows: PptxGenJS.TableRow[] = rows.map((row, idx) => {
    const kpis = (row.projectedKpis ?? {}) as Record<string, unknown>;
    const budget = Number(row.budget) || 0;
    budgetTotal += budget;
    impressionsLowTotal +=
      extractKpi(kpis, 'impressions.low', 'impressionsLow') ?? 0;
    impressionsHighTotal +=
      extractKpi(kpis, 'impressions.high', 'impressionsHigh') ?? 0;

    const bg = idx % 2 === 0 ? WHITE : BRAND_LIGHT;
    return [
      dataCell(row.platform ?? '', bg),
      dataCell(campaignName, bg),
      dataCell(row.creative ?? '', bg),
      dataCell(row.buyType ?? row.adType ?? '', bg),
      dataCell(
        fmtRange(
          extractKpi(kpis, 'videoViews2s.low', 'videoViewsLow'),
          extractKpi(kpis, 'videoViews2s.high', 'videoViewsHigh'),
        ),
        bg,
        'center',
      ),
      dataCell(
        fmtRange(
          extractKpi(kpis, 'impressions.low', 'impressionsLow'),
          extractKpi(kpis, 'impressions.high', 'impressionsHigh'),
        ),
        bg,
        'center',
      ),
      dataCell(budget ? fmt(budget) : '—', bg, 'right'),
    ];
  });

  const totalRow: PptxGenJS.TableRow = [
    dataCell('TOTAL', GREEN_LIGHT, undefined, true, BRAND_DARK),
    dataCell('', GREEN_LIGHT),
    dataCell('', GREEN_LIGHT),
    dataCell('', GREEN_LIGHT),
    dataCell('', GREEN_LIGHT),
    dataCell(
      fmtRange(impressionsLowTotal || null, impressionsHighTotal || null),
      GREEN_LIGHT,
      'center',
      true,
    ),
    dataCell(fmt(budgetTotal), GREEN_LIGHT, 'right', true, GREEN),
  ];

  slide3.addTable([kpiHeaderRow, ...kpiDataRows, totalRow], {
    x: 0.3,
    y: 1.0,
    w: 12.7,
    h: 5.2,
    fontSize: 10,
    border: { pt: 0.5, color: 'E1E3EA' },
    colW: [1.8, 2.0, 1.8, 1.5, 1.8, 1.8, 2.0],
    autoPage: true,
    autoPageRepeatHeader: true,
    fontFace: 'Inter',
  });

  if (plan.campaignPeriod) {
    slide3.addText(`Campaign Duration: ${plan.campaignPeriod}`, {
      x: 0.3,
      y: 6.35,
      w: 8,
      h: 0.3,
      fontSize: 9,
      color: BRAND_GREY,
      fontFace: 'Inter',
    });
  }

  slide3.addText(
    'Results and costs are influenced by several external factors including audience competition, seasonality, and platform algorithm changes. All KPI estimates are indicative ranges.',
    {
      x: 0.3,
      y: 6.7,
      w: 12.7,
      h: 0.55,
      fontSize: 8,
      color: RED,
      italic: true,
      fontFace: 'Inter',
      align: 'left',
    },
  );

  slide3.addText('www.jasmin-media.com', {
    x: 0.3,
    y: 7.1,
    w: 12.7,
    h: 0.3,
    fontSize: 9,
    color: BRAND_GREY,
    italic: true,
    align: 'center',
    fontFace: 'Inter',
  });

  // ── Last slide: Presented by ───────────────────────────────────────────────
  const slideEnd = pptx.addSlide();

  slideEnd.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: '100%',
    fill: { color: BRAND_BLUE },
  });

  slideEnd.addText('Presented by', {
    x: 0.5,
    y: 2.8,
    w: 12.3,
    h: 0.7,
    fontSize: 20,
    color: 'D0E8F5',
    fontFace: 'Inter',
    align: 'center',
  });

  slideEnd.addText('DC Group | Jasmin Media', {
    x: 0.5,
    y: 3.5,
    w: 12.3,
    h: 1.0,
    fontSize: 36,
    color: WHITE,
    bold: true,
    fontFace: 'Inter',
    align: 'center',
  });

  slideEnd.addText('www.jasmin-media.com', {
    x: 0.5,
    y: 4.8,
    w: 12.3,
    h: 0.5,
    fontSize: 14,
    color: 'D0E8F5',
    italic: true,
    fontFace: 'Inter',
    align: 'center',
  });

  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  return buffer as Buffer;
}
