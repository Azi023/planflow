import PDFDocument from 'pdfkit';
import { MediaPlan } from '../../entities/media-plan.entity';
import { MediaPlanRow } from '../../entities/media-plan-row.entity';

const BLUE = '#006098';
const GRAY = '#6B7280';
const LIGHT_BG = '#F3F4F6';

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

function extractKpi(
  kpis: Record<string, unknown>,
  nestedPath: string,
): number | null {
  const parts = nestedPath.split('.');
  let val: unknown = kpis;
  for (const part of parts) {
    if (val == null || typeof val !== 'object') return null;
    val = (val as Record<string, unknown>)[part];
  }
  if (val != null && !isNaN(Number(val))) return Number(val);
  return null;
}

const PLATFORM_LABELS: Record<string, string> = {
  meta_ig: 'Meta + IG',
  meta: 'Meta',
  Meta: 'Meta',
  ig: 'Instagram',
  ig_follower: 'IG Followers',
  meta_page_like: 'Page Likes',
  gdn: 'GDN',
  youtube_video: 'YouTube Video',
  youtube_bumper: 'YouTube Bumper',
  search: 'Google Search',
  demand_gen: 'Demand Gen',
  perf_max: 'Perf Max',
  tiktok: 'TikTok',
};

export async function buildPdfBuffer(
  plan: MediaPlan,
  rows: MediaPlanRow[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const clientName =
      (plan as unknown as { client?: { name?: string } }).client?.name ??
      'Unknown Client';
    const campaignName = plan.campaignName ?? 'Media Plan';
    const currency = plan.currency ?? 'LKR';
    const totalBudget = Number(plan.totalBudget ?? 0);
    const fee1Pct = Number(plan.fee1Pct ?? 15);
    const mediaSpend = totalBudget / (1 + fee1Pct / 100);
    const feeAmount = totalBudget - mediaSpend;
    const pageWidth = 495; // A4 minus margins

    // =================== COVER SECTION ===================
    doc.rect(0, 0, 595, 120).fill(BLUE);
    doc
      .fontSize(10)
      .fillColor('#FFFFFF')
      .text('DC Group | Jasmin Media', 50, 30, { align: 'left' });
    doc
      .fontSize(22)
      .fillColor('#FFFFFF')
      .text(campaignName, 50, 55, { width: pageWidth });
    doc
      .fontSize(11)
      .fillColor('#CCDDEE')
      .text(`${clientName}  •  ${plan.referenceNumber ?? ''}`, 50, 90, {
        width: pageWidth,
      });

    doc.moveDown(3);
    const infoY = 140;

    // =================== PLAN INFO ===================
    doc.fillColor(GRAY).fontSize(8).text('CAMPAIGN DETAILS', 50, infoY);
    doc
      .fillColor('#111')
      .fontSize(10)
      .text(`Client: ${clientName}`, 50, infoY + 15)
      .text(
        `Period: ${plan.startDate ?? '—'} to ${plan.endDate ?? '—'}`,
        50,
        infoY + 30,
      )
      .text(`Currency: ${currency}`, 50, infoY + 45)
      .text(`Prepared by: ${plan.preparedBy ?? '—'}`, 50, infoY + 60);

    doc
      .fillColor('#111')
      .text(
        `Total Budget: ${currency} ${fmt(totalBudget)}`,
        300,
        infoY + 15,
      )
      .text(
        `Media Spend: ${currency} ${fmt(mediaSpend)}`,
        300,
        infoY + 30,
      )
      .text(
        `${plan.fee1Label ?? 'Management Fee'} (${fee1Pct}%): ${currency} ${fmt(feeAmount)}`,
        300,
        infoY + 45,
      );

    // =================== KPI SUMMARY ===================
    const summaryY = infoY + 95;
    doc.fillColor(GRAY).fontSize(8).text('KPI SUMMARY (PROJECTED)', 50, summaryY);

    let totalImpLow = 0, totalImpHigh = 0;
    let totalReachLow = 0, totalReachHigh = 0;
    let totalClicksLow = 0, totalClicksHigh = 0;

    for (const row of rows) {
      const kpis = (row.projectedKpis ?? {}) as Record<string, unknown>;
      totalImpLow += extractKpi(kpis, 'impressions.low') ?? 0;
      totalImpHigh += extractKpi(kpis, 'impressions.high') ?? 0;
      totalReachLow += extractKpi(kpis, 'reach.low') ?? 0;
      totalReachHigh += extractKpi(kpis, 'reach.high') ?? 0;
      totalClicksLow += extractKpi(kpis, 'clicks.low') ?? 0;
      totalClicksHigh += extractKpi(kpis, 'clicks.high') ?? 0;
    }

    const boxW = pageWidth / 3 - 8;
    const boxes = [
      { label: 'Impressions', value: fmtRange(totalImpLow, totalImpHigh) },
      { label: 'Reach', value: fmtRange(totalReachLow, totalReachHigh) },
      { label: 'Clicks', value: fmtRange(totalClicksLow, totalClicksHigh) },
    ];
    boxes.forEach((box, i) => {
      const x = 50 + i * (boxW + 12);
      doc.rect(x, summaryY + 15, boxW, 45).fill(LIGHT_BG);
      doc.fillColor(GRAY).fontSize(8).text(box.label, x + 8, summaryY + 22);
      doc.fillColor(BLUE).fontSize(12).text(box.value, x + 8, summaryY + 36);
    });

    // =================== PLATFORM BREAKDOWN TABLE ===================
    let tableY = summaryY + 80;
    doc.fillColor(GRAY).fontSize(8).text('PLATFORM BREAKDOWN', 50, tableY);
    tableY += 15;

    // Table header
    const cols = [
      { label: 'Platform', x: 50, w: 80 },
      { label: 'Objective', x: 130, w: 65 },
      { label: 'Audience', x: 195, w: 80 },
      { label: 'Budget', x: 275, w: 70 },
      { label: 'Impressions', x: 345, w: 100 },
      { label: 'Reach', x: 445, w: 100 },
    ];

    doc.rect(50, tableY, pageWidth, 18).fill(BLUE);
    cols.forEach((col) => {
      doc
        .fillColor('#FFFFFF')
        .fontSize(7)
        .text(col.label, col.x + 3, tableY + 4, { width: col.w - 6 });
    });
    tableY += 18;

    // Table rows
    rows.forEach((row, idx) => {
      if (tableY > 750) {
        doc.addPage();
        tableY = 50;
      }

      const kpis = (row.projectedKpis ?? {}) as Record<string, unknown>;
      const bgColor = idx % 2 === 0 ? '#FFFFFF' : LIGHT_BG;
      doc.rect(50, tableY, pageWidth, 16).fill(bgColor);

      const platform = PLATFORM_LABELS[row.platform] ?? row.platform;
      const cellData = [
        platform,
        row.objective ?? '—',
        row.audienceName ?? '—',
        `${currency} ${fmt(Number(row.budget ?? 0))}`,
        fmtRange(
          extractKpi(kpis, 'impressions.low'),
          extractKpi(kpis, 'impressions.high'),
        ),
        fmtRange(
          extractKpi(kpis, 'reach.low'),
          extractKpi(kpis, 'reach.high'),
        ),
      ];

      cols.forEach((col, ci) => {
        doc
          .fillColor('#333')
          .fontSize(7)
          .text(cellData[ci], col.x + 3, tableY + 4, {
            width: col.w - 6,
            ellipsis: true,
          });
      });
      tableY += 16;
    });

    // =================== NOTES ===================
    if (plan.notes) {
      tableY += 15;
      if (tableY > 700) {
        doc.addPage();
        tableY = 50;
      }
      doc.fillColor(GRAY).fontSize(8).text('STRATEGIC NOTES', 50, tableY);
      doc
        .fillColor('#333')
        .fontSize(9)
        .text(plan.notes, 50, tableY + 15, { width: pageWidth });
    }

    // =================== FOOTER ===================
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc
        .fillColor(GRAY)
        .fontSize(7)
        .text(
          `${campaignName} — ${clientName} — Page ${i + 1} of ${pages.count}`,
          50,
          790,
          { width: pageWidth, align: 'center' },
        );
    }

    doc.end();
  });
}
