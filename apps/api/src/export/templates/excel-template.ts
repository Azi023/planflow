import ExcelJS from 'exceljs';
import { MediaPlan } from '../../entities/media-plan.entity';
import { MediaPlanRow } from '../../entities/media-plan-row.entity';

interface KpiRange {
  low?: number | null;
  high?: number | null;
}

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

export async function buildExcelBuffer(
  plan: MediaPlan,
  rows: MediaPlanRow[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Media Plan');

  const clientName =
    (plan as unknown as { client?: { name?: string } }).client?.name ??
    'Unknown Client';
  const campaignName = plan.campaignName ?? 'Campaign';
  const currency = plan.currency ?? 'LKR';

  // ── Column widths ──────────────────────────────────────────────────────────
  ws.columns = [
    { width: 28 }, // Campaign Name
    { width: 18 }, // Budget
    { width: 18 }, // Campaign Period
    { width: 18 }, // Platform
    { width: 20 }, // Audience
    { width: 28 }, // Detailed Targeting
    { width: 20 }, // Est. Audience Size
    { width: 22 }, // Channels/Objectives
    { width: 18 }, // Budget (LKR)
    { width: 12 }, // Percentage
    { width: 18 }, // Reach
    { width: 18 }, // Impressions
    { width: 12 }, // Frequency
    { width: 14 }, // CPM
    { width: 14 }, // CPC
    { width: 14 }, // CPL
    { width: 18 }, // Video Views
  ];

  // ── Row 1-2: Agency header ─────────────────────────────────────────────────
  ws.mergeCells('A1:Q1');
  const headerCell = ws.getCell('A1');
  headerCell.value = 'DC Group | Jasmin Media';
  headerCell.font = { bold: true, size: 14, color: { argb: 'FF006098' } };
  headerCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:Q2');
  ws.getRow(2).height = 6;

  // ── Row 3-4: Plan title & metadata ────────────────────────────────────────
  ws.mergeCells('A3:Q3');
  const titleCell = ws.getCell('A3');
  titleCell.value = `Media Plan — ${clientName} — ${campaignName}`;
  titleCell.font = { bold: true, size: 13, color: { argb: 'FF071437' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(3).height = 24;

  ws.mergeCells('A4:Q4');
  const metaDate = plan.createdAt
    ? new Date(plan.createdAt).toLocaleDateString('en-GB')
    : '—';
  ws.getCell('A4').value = [
    plan.referenceNumber ? `Ref: ${plan.referenceNumber}` : null,
    plan.preparedBy ? `Prepared by: ${plan.preparedBy}` : null,
    `Date: ${metaDate}`,
  ]
    .filter(Boolean)
    .join('   |   ');
  ws.getCell('A4').font = { size: 10, color: { argb: 'FF4B5675' } };
  ws.getRow(4).height = 18;

  // ── Row 5: Spacer ─────────────────────────────────────────────────────────
  ws.getRow(5).height = 8;

  // ── Row 6: Column headers ─────────────────────────────────────────────────
  const HEADERS = [
    'Campaign Name',
    `Campaign Budget (${currency})`,
    'Campaign Period',
    'Platform',
    'Audience',
    'Detailed Targeting',
    'Estimated Audience Size',
    'Channels / Objectives',
    `Budget (${currency})`,
    'Percentage (%)',
    'Reach',
    'Impressions',
    'Frequency',
    'CPM',
    'CPC',
    'CPL',
    'Video Views',
  ];

  const headerRow = ws.getRow(6);
  headerRow.height = 22;
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E7D32' },
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1B5E20' } },
      bottom: { style: 'thin', color: { argb: 'FF1B5E20' } },
      left: { style: 'thin', color: { argb: 'FF1B5E20' } },
      right: { style: 'thin', color: { argb: 'FF1B5E20' } },
    };
  });

  // ── Data rows ─────────────────────────────────────────────────────────────
  let budgetTotal = 0;

  rows.forEach((row, idx) => {
    const kpis = (row.projectedKpis ?? {}) as Record<string, unknown>;
    const budget = Number(row.budget) || 0;
    budgetTotal += budget;

    const dataRow = ws.getRow(7 + idx);
    dataRow.height = 18;

    const rowData = [
      idx === 0 ? campaignName : '', // A: Campaign Name (first row only)
      idx === 0 && plan.totalBudget ? Number(plan.totalBudget) : '', // B: Total Budget (first row only)
      idx === 0 ? (plan.campaignPeriod ?? '') : '', // C: Campaign Period (first row only)
      row.platform ?? '', // D: Platform
      row.audienceName ?? '', // E: Audience
      row.targetingCriteria ?? '', // F: Detailed Targeting
      row.audienceSize ?? '', // G: Est. Audience Size
      row.objective ?? '', // H: Channels / Objectives
      budget || '', // I: Budget
      row.percentage != null ? Number(row.percentage) : '', // J: Percentage
      fmtRange(
        extractKpi(kpis, 'reach.low', 'reachLow'),
        extractKpi(kpis, 'reach.high', 'reachHigh'),
      ), // K: Reach
      fmtRange(
        extractKpi(kpis, 'impressions.low', 'impressionsLow'),
        extractKpi(kpis, 'impressions.high', 'impressionsHigh'),
      ), // L: Impressions
      fmtRange(
        extractKpi(kpis, 'frequency.low', 'frequencyLow'),
        extractKpi(kpis, 'frequency.high', 'frequencyHigh'),
        1,
      ), // M: Frequency
      fmtRange(
        extractKpi(kpis, 'benchmark.cpmLow', 'cpmLow'),
        extractKpi(kpis, 'benchmark.cpmHigh', 'cpmHigh'),
        2,
      ), // N: CPM
      fmtRange(
        extractKpi(kpis, 'benchmark.cpcLow', 'cpcLow'),
        extractKpi(kpis, 'benchmark.cpcHigh', 'cpcHigh'),
        2,
      ), // O: CPC
      fmtRange(
        extractKpi(kpis, 'benchmark.cplLow', 'cplLow'),
        extractKpi(kpis, 'benchmark.cplHigh', 'cplHigh'),
        2,
      ), // P: CPL
      fmtRange(
        extractKpi(kpis, 'videoViews2s.low', 'videoViewsLow'),
        extractKpi(kpis, 'videoViews2s.high', 'videoViewsHigh'),
      ), // Q: Video Views
    ];

    rowData.forEach((val, ci) => {
      const cell = dataRow.getCell(ci + 1);
      cell.value = val as ExcelJS.CellValue;
      cell.font = { size: 10, color: { argb: 'FF071437' } };
      cell.alignment = {
        vertical: 'middle',
        wrapText: true,
        horizontal: ci <= 2 ? 'left' : 'center',
      };
      cell.border = {
        top: { style: 'hair', color: { argb: 'FFE1E3EA' } },
        bottom: { style: 'hair', color: { argb: 'FFE1E3EA' } },
        left: { style: 'hair', color: { argb: 'FFE1E3EA' } },
        right: { style: 'hair', color: { argb: 'FFE1E3EA' } },
      };
    });

    // Format budget column as number with thousands separator
    const budgetCell = dataRow.getCell(9);
    if (typeof budgetCell.value === 'number') {
      budgetCell.numFmt = '#,##0';
    }
    const totalBudgetCell = dataRow.getCell(2);
    if (typeof totalBudgetCell.value === 'number') {
      totalBudgetCell.numFmt = '#,##0';
    }

    // Alternate row shading
    if (idx % 2 === 0) {
      for (let ci = 1; ci <= 17; ci++) {
        const cell = dataRow.getCell(ci);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8F9FA' },
        };
      }
    }
  });

  // ── Total row ─────────────────────────────────────────────────────────────
  const totalRowIdx = 7 + rows.length;
  const totalRow = ws.getRow(totalRowIdx);
  totalRow.height = 20;
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(1).font = {
    bold: true,
    size: 10,
    color: { argb: 'FF071437' },
  };
  totalRow.getCell(9).value = budgetTotal;
  totalRow.getCell(9).numFmt = '#,##0';
  totalRow.getCell(9).font = { bold: true, size: 10 };

  for (let ci = 1; ci <= 17; ci++) {
    const cell = totalRow.getCell(ci);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F5E9' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF2E7D32' } },
      bottom: { style: 'medium', color: { argb: 'FF2E7D32' } },
      left: { style: 'hair', color: { argb: 'FFE1E3EA' } },
      right: { style: 'hair', color: { argb: 'FFE1E3EA' } },
    };
  }

  // ── Spacer ─────────────────────────────────────────────────────────────────
  const spacerIdx = totalRowIdx + 1;
  ws.getRow(spacerIdx).height = 10;

  // ── Disclaimer ─────────────────────────────────────────────────────────────
  const disclaimerIdx = spacerIdx + 1;
  ws.mergeCells(`A${disclaimerIdx}:Q${disclaimerIdx}`);
  const disclaimerCell = ws.getCell(`A${disclaimerIdx}`);
  disclaimerCell.value =
    'Results and costs are influenced by several external factors including audience competition, seasonality, creative quality, and platform algorithm changes. All KPI estimates are indicative ranges based on historical benchmarks and are not guaranteed.';
  disclaimerCell.font = { italic: true, size: 9, color: { argb: 'FFC62828' } };
  disclaimerCell.alignment = { wrapText: true, horizontal: 'left' };
  ws.getRow(disclaimerIdx).height = 30;

  // ── Fee breakdown ──────────────────────────────────────────────────────────
  const feeIdx = disclaimerIdx + 2;
  const fee1Pct = Number(plan.fee1Pct ?? 15) / 100;
  const fee2Pct = Number(plan.fee2Pct ?? 0) / 100;
  const totalFeePct = fee1Pct + fee2Pct;
  const totalBudgetNum = Number(plan.totalBudget ?? 0);
  const mediaSpend =
    totalFeePct > 0 ? totalBudgetNum / (1 + totalFeePct) : totalBudgetNum;
  const fee1Amount = mediaSpend * fee1Pct;
  const fee2Amount = mediaSpend * fee2Pct;

  const fee1Label = plan.fee1Label ?? 'Management Fee';

  ws.mergeCells(`A${feeIdx}:C${feeIdx}`);
  ws.getCell(`A${feeIdx}`).value =
    `Media Spend: ${currency} ${fmt(mediaSpend)}`;
  ws.getCell(`A${feeIdx}`).font = {
    size: 10,
    bold: true,
    color: { argb: 'FF071437' },
  };

  ws.mergeCells(`D${feeIdx}:F${feeIdx}`);
  ws.getCell(`D${feeIdx}`).value =
    `${fee1Label} (${plan.fee1Pct ?? 15}%): ${currency} ${fmt(fee1Amount)}`;
  ws.getCell(`D${feeIdx}`).font = { size: 10, color: { argb: 'FF4B5675' } };

  if (fee2Pct > 0 && plan.fee2Label) {
    ws.mergeCells(`G${feeIdx}:I${feeIdx}`);
    ws.getCell(`G${feeIdx}`).value =
      `${plan.fee2Label} (${plan.fee2Pct}%): ${currency} ${fmt(fee2Amount)}`;
    ws.getCell(`G${feeIdx}`).font = { size: 10, color: { argb: 'FF4B5675' } };

    ws.mergeCells(`J${feeIdx}:M${feeIdx}`);
    ws.getCell(`J${feeIdx}`).value =
      `Total Budget: ${currency} ${fmt(totalBudgetNum)}`;
    ws.getCell(`J${feeIdx}`).font = {
      size: 10,
      bold: true,
      color: { argb: 'FF2E7D32' },
    };
  } else {
    ws.mergeCells(`G${feeIdx}:K${feeIdx}`);
    ws.getCell(`G${feeIdx}`).value =
      `Total Budget: ${currency} ${fmt(totalBudgetNum)}`;
    ws.getCell(`G${feeIdx}`).font = {
      size: 10,
      bold: true,
      color: { argb: 'FF2E7D32' },
    };
  }

  ws.getRow(feeIdx).height = 20;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
