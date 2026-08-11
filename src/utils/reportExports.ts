import * as XLSX from 'xlsx';
import type { ReportIntegrationSettings } from '../data/reportIntegrations';

export type DailyReportMetricRow = {
  category: string;
  metric: string;
  value: string | number;
  previousValue?: string | number;
  change?: string;
  note?: string;
};

export type DailyReportChannelRow = {
  channel: string;
  impressions: number;
  clicks: number;
  spend: number;
  db: number;
  sales: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
};

export type DailyReportDocument = {
  id: string;
  title: string;
  advertiser: string;
  period: string;
  createdAt: string;
  sections: string[];
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    db: number;
    sales: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
  };
  channelRows: DailyReportChannelRow[];
  metricRows: DailyReportMetricRow[];
  insights: string[];
  actions: string[];
};

const CHANNEL_BASE = [
  { channel: '메타', impressions: 184220, clicks: 3420, spend: 1680000, db: 104, sales: 7420000 },
  { channel: '네이버', impressions: 96840, clicks: 2180, spend: 1230000, db: 76, sales: 5140000 },
  { channel: 'Google SA', impressions: 72400, clicks: 1470, spend: 980000, db: 41, sales: 3910000 },
  { channel: 'YouTube AD', impressions: 228300, clicks: 1640, spend: 870000, db: 27, sales: 2860000 },
  { channel: '당근', impressions: 45100, clicks: 760, spend: 510000, db: 19, sales: 1340000 },
  { channel: '틱톡', impressions: 130500, clicks: 1830, spend: 620000, db: 23, sales: 1780000 },
];

function hashText(text: string) {
  return [...text].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
}

function formatWon(value: number) {
  return `₩${Math.round(value).toLocaleString('ko-KR')}`;
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString('ko-KR');
}

function resolveMetricValue(label: string, totals: DailyReportDocument['summary'], channels: DailyReportChannelRow[]) {
  const upper = label.toUpperCase();
  const channel = channels.find((item) => upper.includes(item.channel.toUpperCase().replace(' SA', '').replace(' AD', ''))) ?? channels.find((item) => upper.includes(item.channel.toUpperCase()));
  const target = channel ?? totals;
  if (label.includes('DB 1개당') || label.includes('평균단가') || label.includes('CPA')) return formatWon('cpa' in target ? target.cpa : totals.cpa);
  if (label.includes('CPC') || label.includes('클릭당비용')) return formatWon('cpc' in target ? target.cpc : totals.cpc);
  if (label.includes('ROAS')) return `${Math.round('roas' in target ? target.roas : totals.roas)}%`;
  if (label.includes('클릭율') || label.includes('CTR')) return `${('ctr' in target ? target.ctr : totals.ctr).toFixed(2)}%`;
  if (label.includes('전환률')) {
    const clicks = 'clicks' in target ? target.clicks : totals.clicks;
    const db = 'db' in target ? target.db : totals.db;
    return clicks ? `${((db / clicks) * 100).toFixed(2)}%` : '0.00%';
  }
  if (label.includes('매출')) return formatWon('sales' in target ? target.sales : totals.sales);
  if (label.includes('광고비')) return formatWon('spend' in target ? target.spend : totals.spend);
  if (label.includes('노출')) return formatNumber('impressions' in target ? target.impressions : totals.impressions);
  if (label.includes('클릭')) return formatNumber('clicks' in target ? target.clicks : totals.clicks);
  if (label.includes('DB') || label.includes('플러스친구')) return formatNumber('db' in target ? target.db : totals.db);
  return '-';
}

export function buildDailyReportDocument(input: {
  id: string;
  title: string;
  advertiser: string;
  period: string;
  createdAt: string;
  sectionLabels: string[];
}): DailyReportDocument {
  const factor = 0.82 + (hashText(`${input.advertiser}${input.period}`) % 37) / 100;
  const channelRows = CHANNEL_BASE.map((base, index) => {
    const multiplier = factor * (0.92 + index * 0.025);
    const impressions = Math.round(base.impressions * multiplier);
    const clicks = Math.round(base.clicks * multiplier);
    const spend = Math.round(base.spend * multiplier);
    const db = Math.max(0, Math.round(base.db * multiplier));
    const sales = Math.round(base.sales * multiplier);
    return {
      channel: base.channel,
      impressions,
      clicks,
      spend,
      db,
      sales,
      ctr: impressions ? (clicks / impressions) * 100 : 0,
      cpc: clicks ? spend / clicks : 0,
      cpa: db ? spend / db : 0,
      roas: spend ? (sales / spend) * 100 : 0,
    };
  });
  const totals = channelRows.reduce((acc, row) => ({
    spend: acc.spend + row.spend,
    impressions: acc.impressions + row.impressions,
    clicks: acc.clicks + row.clicks,
    db: acc.db + row.db,
    sales: acc.sales + row.sales,
    ctr: 0,
    cpc: 0,
    cpa: 0,
    roas: 0,
  }), { spend: 0, impressions: 0, clicks: 0, db: 0, sales: 0, ctr: 0, cpc: 0, cpa: 0, roas: 0 });
  totals.ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.cpc = totals.clicks ? totals.spend / totals.clicks : 0;
  totals.cpa = totals.db ? totals.spend / totals.db : 0;
  totals.roas = totals.spend ? (totals.sales / totals.spend) * 100 : 0;

  const metricRows = input.sectionLabels.map((label, index) => ({
    category: label.includes('ROAS') ? 'ROAS' : label.includes('광고비') ? '광고비' : label.includes('클릭') ? '클릭' : label.includes('노출') ? '노출' : label.includes('DB') ? 'DB' : label.includes('매출') ? '매출' : '보고서 구성',
    metric: label,
    value: resolveMetricValue(label, totals, channelRows),
    previousValue: index % 2 === 0 ? '-' : undefined,
    change: index % 3 === 0 ? '+8.4%' : index % 3 === 1 ? '-3.1%' : '+1.7%',
    note: index % 4 === 0 ? '전일 대비 기준' : '',
  }));

  const best = [...channelRows].sort((a, b) => b.roas - a.roas)[0];
  const highCpa = [...channelRows].sort((a, b) => b.cpa - a.cpa)[0];
  return {
    id: input.id,
    title: input.title,
    advertiser: input.advertiser,
    period: input.period,
    createdAt: input.createdAt,
    sections: input.sectionLabels,
    summary: totals,
    channelRows,
    metricRows,
    insights: [
      `${best.channel} ROAS가 ${Math.round(best.roas)}%로 가장 높습니다.`,
      `총 광고비 ${formatWon(totals.spend)}로 DB ${formatNumber(totals.db)}개를 확보했습니다.`,
      `${highCpa.channel}의 DB 단가가 ${formatWon(highCpa.cpa)}로 상대적으로 높아 점검이 필요합니다.`,
    ],
    actions: [
      `${best.channel} 고성과 캠페인의 예산 10~15% 증액 검토`,
      `${highCpa.channel} 저효율 광고그룹과 소재 점검`,
      `전환 데이터 누락 여부를 오전 7시 수집 로그에서 확인`,
    ],
  };
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 120);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadReportCsv(report: DailyReportDocument) {
  const rows = [
    ['광고주', report.advertiser],
    ['보고서명', report.title],
    ['기간', report.period],
    ['생성일', report.createdAt],
    [],
    ['매체', '노출', '클릭', 'CTR', 'CPC', '광고비', 'DB', 'CPA', '매출', 'ROAS'],
    ...report.channelRows.map((row) => [row.channel, row.impressions, row.clicks, `${row.ctr.toFixed(2)}%`, Math.round(row.cpc), row.spend, row.db, Math.round(row.cpa), row.sales, `${Math.round(row.roas)}%`]),
    ['합계', report.summary.impressions, report.summary.clicks, `${report.summary.ctr.toFixed(2)}%`, Math.round(report.summary.cpc), report.summary.spend, report.summary.db, Math.round(report.summary.cpa), report.summary.sales, `${Math.round(report.summary.roas)}%`],
    [],
    ['분류', '지표', '값', '증감', '비고'],
    ...report.metricRows.map((row) => [row.category, row.metric, row.value, row.change ?? '', row.note ?? '']),
  ];
  const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${safeFileName(report.title)}.csv`);
}

export function downloadReportXlsx(report: DailyReportDocument) {
  const workbook = XLSX.utils.book_new();
  const summaryData = [
    ['HOWTOM 유니버스 일일보고'],
    ['광고주', report.advertiser],
    ['보고서명', report.title],
    ['기간', report.period],
    ['생성일', report.createdAt],
    [],
    ['핵심 지표', '값'],
    ['총 광고비', report.summary.spend],
    ['총 노출', report.summary.impressions],
    ['총 클릭', report.summary.clicks],
    ['총 DB', report.summary.db],
    ['총 매출', report.summary.sales],
    ['CTR', report.summary.ctr / 100],
    ['CPC', report.summary.cpc],
    ['CPA', report.summary.cpa],
    ['ROAS', report.summary.roas / 100],
    [],
    ['주요 인사이트'],
    ...report.insights.map((item) => [item]),
    [],
    ['다음 액션'],
    ...report.actions.map((item) => [item]),
  ];
  const channelData = [
    ['매체', '노출', '클릭', 'CTR', 'CPC', '광고비', 'DB', 'CPA', '매출', 'ROAS'],
    ...report.channelRows.map((row) => [row.channel, row.impressions, row.clicks, row.ctr / 100, row.cpc, row.spend, row.db, row.cpa, row.sales, row.roas / 100]),
    ['합계', report.summary.impressions, report.summary.clicks, report.summary.ctr / 100, report.summary.cpc, report.summary.spend, report.summary.db, report.summary.cpa, report.summary.sales, report.summary.roas / 100],
  ];
  const metricData = [['분류', '지표', '값', '증감', '비고'], ...report.metricRows.map((row) => [row.category, row.metric, row.value, row.change ?? '', row.note ?? ''])];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  const channelSheet = XLSX.utils.aoa_to_sheet(channelData);
  const metricSheet = XLSX.utils.aoa_to_sheet(metricData);
  summarySheet['!cols'] = [{ wch: 22 }, { wch: 36 }];
  channelSheet['!cols'] = [{ wch: 16 }, ...Array.from({ length: 9 }, () => ({ wch: 14 }))];
  metricSheet['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 20 }, { wch: 12 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, '일일보고');
  XLSX.utils.book_append_sheet(workbook, channelSheet, '매체별 성과');
  XLSX.utils.book_append_sheet(workbook, metricSheet, '선택 지표');
  XLSX.writeFile(workbook, `${safeFileName(report.title)}.xlsx`);
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] ?? char));
}

export function openReportPdfPrint(report: DailyReportDocument, settings: ReportIntegrationSettings['pdf']) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('팝업이 차단되었습니다. 브라우저에서 팝업을 허용하세요.');
  const channelRows = report.channelRows.map((row) => `<tr><td>${escapeHtml(row.channel)}</td><td>${row.impressions.toLocaleString()}</td><td>${row.clicks.toLocaleString()}</td><td>${row.ctr.toFixed(2)}%</td><td>${formatWon(row.cpc)}</td><td>${formatWon(row.spend)}</td><td>${row.db}</td><td>${formatWon(row.cpa)}</td><td>${formatWon(row.sales)}</td><td>${Math.round(row.roas)}%</td></tr>`).join('');
  const metricRows = report.metricRows.map((row) => `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.metric)}</td><td>${escapeHtml(row.value)}</td><td>${escapeHtml(row.change ?? '')}</td><td>${escapeHtml(row.note ?? '')}</td></tr>`).join('');
  popup.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>@page{size:${settings.landscape ? 'A4 landscape' : 'A4 portrait'};margin:14mm}*{box-sizing:border-box}body{font-family:Arial,'Noto Sans KR',sans-serif;color:#111827;margin:0}.cover{page-break-after:${settings.includeCover ? 'always' : 'auto'};min-height:90vh;display:${settings.includeCover ? 'flex' : 'none'};flex-direction:column;justify-content:center}.brand{font-size:13px;color:#2563eb;font-weight:800;letter-spacing:.12em}h1{font-size:32px;margin:14px 0}h2{font-size:18px;margin:24px 0 10px}.meta{color:#6b7280}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.kpi{border:1px solid #e5e7eb;padding:10px;border-radius:8px}.kpi span{display:block;font-size:10px;color:#6b7280}.kpi b{font-size:16px}table{border-collapse:collapse;width:100%;font-size:10px;margin-top:8px}th,td{border:1px solid #d1d5db;padding:6px;text-align:right}th{background:#f3f4f6}th:first-child,td:first-child,th:nth-child(2),td:nth-child(2){text-align:left}ul{font-size:12px;line-height:1.7}.print-note{margin-top:18px;color:#9ca3af;font-size:9px}@media print{.no-print{display:none}}</style></head><body><section class="cover"><div class="brand">AD CONTROL CENTER</div><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.advertiser)} · ${escapeHtml(report.period)}</p><p class="meta">${escapeHtml(report.createdAt)}</p></section><h1>${escapeHtml(report.title)}</h1><p class="meta">${escapeHtml(report.advertiser)} · ${escapeHtml(report.period)}</p><div class="kpis"><div class="kpi"><span>총 광고비</span><b>${formatWon(report.summary.spend)}</b></div><div class="kpi"><span>총 DB</span><b>${report.summary.db.toLocaleString()}</b></div><div class="kpi"><span>총 클릭</span><b>${report.summary.clicks.toLocaleString()}</b></div><div class="kpi"><span>총 매출</span><b>${formatWon(report.summary.sales)}</b></div><div class="kpi"><span>ROAS</span><b>${Math.round(report.summary.roas)}%</b></div></div><h2>매체별 성과</h2><table><thead><tr><th>매체</th><th>노출</th><th>클릭</th><th>CTR</th><th>CPC</th><th>광고비</th><th>DB</th><th>CPA</th><th>매출</th><th>ROAS</th></tr></thead><tbody>${channelRows}</tbody></table><h2>선택 지표</h2><table><thead><tr><th>분류</th><th>지표</th><th>값</th><th>증감</th><th>비고</th></tr></thead><tbody>${metricRows}</tbody></table><h2>주요 인사이트</h2><ul>${report.insights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><h2>다음 액션</h2><ul>${report.actions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p class="print-note">인쇄 대화상자에서 대상 프린터를 ‘PDF로 저장’으로 선택하세요.</p><script>window.onload=()=>setTimeout(()=>window.print(),300);</script></body></html>`);
  popup.document.close();
}

export function buildIntegrationPayload(report: DailyReportDocument, settings: ReportIntegrationSettings) {
  return {
    source: 'ad-control-center',
    report,
    googleSheets: {
      spreadsheetId: settings.googleSheets.spreadsheetId,
      sheetName: settings.googleSheets.sheetName || '일일보고',
      header: ['매체', '노출', '클릭', 'CTR', 'CPC', '광고비', 'DB', 'CPA', '매출', 'ROAS'],
      rows: report.channelRows.map((row) => [row.channel, row.impressions, row.clicks, row.ctr, row.cpc, row.spend, row.db, row.cpa, row.sales, row.roas]),
      metricHeader: ['분류', '지표', '값', '증감', '비고'],
      metricRows: report.metricRows.map((row) => [row.category, row.metric, row.value, row.change ?? '', row.note ?? '']),
    },
    notion: {
      dataSourceId: settings.notion.dataSourceId,
      title: report.title,
      properties: {
        광고주: report.advertiser,
        기간: report.period,
        광고비: report.summary.spend,
        DB: report.summary.db,
        매출: report.summary.sales,
        ROAS: report.summary.roas,
      },
    },
  };
}

async function postJson(url: string, payload: unknown) {
  const isAppsScript = /script\.google\.com\/macros\/s\//.test(url);
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': isAppsScript ? 'text/plain;charset=utf-8' : 'application/json' }, body: JSON.stringify(payload) });
    const text = await response.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep text */ }
    if (!response.ok) throw new Error(typeof body === 'object' && body && 'error' in body ? String((body as { error: unknown }).error) : `HTTP ${response.status}`);
    return body;
  } catch (error) {
    if (isAppsScript) {
      await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      return { ok: true, opaque: true };
    }
    throw error;
  }
}

export async function syncReportToGoogleSheets(report: DailyReportDocument, settings: ReportIntegrationSettings) {
  if (!settings.googleSheets.enabled) throw new Error('환경설정에서 Google Sheets 연동을 켜세요.');
  const payload = buildIntegrationPayload(report, settings);
  const endpoint = settings.googleSheets.webhookUrl.trim() || '/api/integrations/google-sheets';
  return postJson(endpoint, payload);
}

export async function syncReportToNotion(report: DailyReportDocument, settings: ReportIntegrationSettings) {
  if (!settings.notion.enabled) throw new Error('환경설정에서 Notion 연동을 켜세요.');
  const payload = buildIntegrationPayload(report, settings);
  const endpoint = settings.notion.webhookUrl.trim() || '/api/integrations/notion';
  return postJson(endpoint, payload);
}
