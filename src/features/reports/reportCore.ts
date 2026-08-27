// 보고서 관리(AdvertiserDailyReportPage)의 데이터 레이어(타입·목데이터·계산 함수)입니다.
// 컴포넌트(화면)와 분리해서, 월간 보고서 등 다른 화면이 보고서 관리 컴포넌트를 거치지 않고
// 이 데이터 레이어만 바로 가져다 쓸 수 있게 합니다. (컴포넌트 파일을 가져오면 그 컴포넌트가
// 다시 다른 화면을 가져오는 순환 참조가 생길 수 있어서, 이 파일은 데이터 레이어만 담습니다.)

import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { loadAdvertiserSettings } from '../../utils/advertiserSettings';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { evaluateFormula, type CustomMetricDefinition } from '../../utils/metricCatalog';


export type ReportType = 'lead' | 'revenue' | 'click' | 'reach' | 'integrated' | 'custom';
export type ClickMode = 'simple' | 'efficiency';
export type ReportTab = 'preview' | 'media' | 'data' | 'api' | 'input' | 'upload' | 'template' | 'savedTemplates' | 'generated' | 'monthly';
export type CellFormat = 'number' | 'currency' | 'percent' | 'decimal';
export type MetricKey = 'leads' | 'purchases' | 'clicks' | 'impressions' | 'reach' | 'frequency' | 'spend' | 'cpa' | 'cpc' | 'ctr' | 'conversionRate' | 'revenue' | 'roas' | 'payments' | 'refunds' | 'netRevenue';

export type DailyReportProfile = {
  advertiserName: string;
  reportType: ReportType;
  clickMode?: ClickMode;
  platforms: string[];
  metrics: MetricKey[];
  customRows?: ReportRow[];
  customMetricIds?: string[];
  hiddenRowIds?: string[];
  showFutureDates: boolean;
  futureDateDisplay: 'zero' | 'blank' | 'dash';
};

export type MetricBundle = {
  leads?: number[];
  purchases?: number[];
  clicks?: number[];
  impressions?: number[];
  reach?: number[];
  spend?: number[];
  revenue?: number[];
  payments?: number[];
  refunds?: number[];
};

export type SourceMap = Record<string, MetricBundle>;

export type ReportRow = {
  id: string;
  group: string;
  label: string;
  platform?: string;
  metric: MetricKey;
  format: CellFormat;
  values: number[];
  total: number;
  emphasis?: boolean;
  derived?: boolean;
  // 비율/파생 지표(CPC, CPA, CTR, 전환률, ROAS)는 일별 값을 그대로 더하면 틀립니다.
  // 기간을 재계산할 수 있도록 원본 분자/분모 일별 배열을 함께 보관합니다.
  // total = multiplier * sum(numerator) / sum(denominator)
  ratioComponents?: { numerator: number[]; denominator: number[]; multiplier: number };
  // 환경설정에서 만든 사용자 수식 지표 행임을 표시합니다. metric 필드는 ReportRow가 요구하는
  // 형식상 값(예: 'spend')을 그대로 두되, 실제 집계·차트 계산에서는 이 필드로 커스텀 지표를
  // 구분해서 광고비 등 실제 지표 합계에 절대 섞이지 않도록 합니다.
  customMetricId?: string;
  customMetricName?: string;
  customMetricUnit?: string;
  customMetricDirection?: 'up' | 'down' | 'neutral';
  customMetricFormula?: string;
  customMetricAggregation?: 'sum' | 'ratio' | 'average' | 'last';
  // 커스텀 비율형을 일별/주별/월별 어느 화면에서든 같은 방식으로 재계산하기 위한
  // 원본 지표 일자별 배열입니다. resolveRangeTotal이 이 값을 사용해 선택 기간 합계로
  // 수식을 다시 계산하므로 표·CSV·엑셀·PDF TOTAL이 모두 일치합니다.
  customMetricInputs?: Partial<Record<MetricKey, number[]>>;
};

export type GeneratedReport = {
  id: string;
  advertiserName: string;
  month: string;
  reportType: ReportType;
  createdAt: string;
  rowCount: number;
  rows?: ReportRow[];
  summary?: { clicks: number; spend: number; leads: number; purchases?: number; revenue: number; impressions?: number; reach?: number; cpc: number; cpa: number; roas: number; frequency?: number };
  source?: 'api' | 'manual' | 'upload' | 'demo' | 'sample';
  isSample?: boolean;
  periodType?: 'daily' | 'weekly' | 'monthly';
  periodLabel?: string;
  visibleDayIndexes?: number[];
  profile?: DailyReportProfile;
  reportName?: string;
  // 저장 시점에 실제 쓰인 커스텀 지표의 이름·수식·단위·판정 방향을 그대로 남겨둡니다.
  // 나중에 환경설정에서 그 지표의 수식이나 이름을 바꾸거나 삭제해도, 이미 저장된 이 보고서를
  // (특히 전체 통합형에서 여러 보고서를 합칠 때) 다시 읽을 때는 저장 당시 정의 그대로
  // 계산되어야 하기 때문입니다.
  customMetricSnapshots?: { id: string; name: string; formula: string; unit: string; direction?: 'up' | 'down' | 'neutral'; aggregationType?: 'sum' | 'ratio' | 'average' | 'last' }[];
};

export type SavedReportTemplate = {
  id: string;
  name: string;
  advertiserName: string;
  reportType: ReportType;
  createdAt: string;
  profile: DailyReportProfile;
};

export const GENERATED_STORAGE_KEY = 'adcc-generated-daily-reports-v1';
export const SAMPLE_GENERATED_STORAGE_KEY = 'adcc-sample-generated-reports-v1';
export const PROFILE_STORAGE_KEY = 'adcc-advertiser-daily-report-profiles-v1';
export const SAVED_TEMPLATE_STORAGE_KEY = 'adcc-saved-daily-report-templates-v1';

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  lead: 'DB 전환형',
  revenue: '매출 ROAS형',
  click: '클릭 성과형',
  reach: '노출 도달형',
  integrated: '전체 통합형',
  custom: '사용자 지정형',
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  leads: 'DB 개수',
  purchases: '구매 전환',
  clicks: '클릭수',
  impressions: '노출수',
  reach: '도달',
  frequency: '반복 노출',
  spend: '광고비',
  cpa: 'DB 1개당 비용',
  cpc: '클릭당 비용',
  ctr: '클릭률',
  conversionRate: '전환률',
  revenue: '매출',
  roas: 'ROAS',
  payments: '결제',
  refunds: '환불',
  netRevenue: '순매출',
};

export const REPORT_TYPE_DESCRIPTIONS: Record<ReportType, string> = {
  lead: '문의, 상담, 견적 신청처럼 DB 확보가 목표인 광고주용입니다.',
  revenue: '카페24, 스마트스토어 등 실제 매출과 광고비, ROAS를 함께 보는 쇼핑몰용입니다.',
  click: 'DB나 매출 추적 없이 유입 클릭과 클릭당 비용을 보는 병원, 브랜드, 방문 유도형 광고주용입니다.',
  reach: '전환보다 브랜드 인지도가 목표인 광고주용입니다. 노출수, 도달, 광고비를 중심으로 봅니다.',
  integrated: '선택한 광고주가 진행한 모든 매체와 전체 성과·비용·매출·도달 지표를 한 번에 조회합니다.',
  custom: '광고주별로 매체와 지표를 직접 골라 만드는 사용자 지정 양식입니다.',
};

export const BASE_ADVERTISERS: string[] = [];

export function pad31(values: number[], daysInMonth = 31) {
  return [...values, ...Array(Math.max(0, daysInMonth - values.length)).fill(0)].slice(0, daysInMonth);
}

/**
 * 선택된 기간(일간/주간/월간)에 맞는 행의 합계를 계산합니다.
 * - 원본 지표(노출, 클릭, DB 등): 선택 기간의 일별 값을 그대로 합산합니다.
 * - 비율/파생 지표(CPC, CPA, CTR, 전환률, ROAS): 선택 기간의 분자·분모를 각각 합산한 뒤
 *   다시 나눠서 계산합니다. (일별 비율의 평균이 아니라, 기간 전체 기준 비율이어야 합니다.)
 * - visibleDayIndexes가 없으면(월간 보기) 이미 계산되어 있는 row.total을 그대로 사용합니다.
 */
export function resolveRangeTotal(row: ReportRow, indexes: number[], visibleDayIndexes?: number[]) {
  if (!visibleDayIndexes) return row.total;

  if (row.ratioComponents) {
    const { numerator, denominator, multiplier } = row.ratioComponents;
    const num = indexes.reduce((s, i) => s + (numerator[i] ?? 0), 0);
    const den = indexes.reduce((s, i) => s + (denominator[i] ?? 0), 0);
    return den > 0 ? (num / den) * multiplier : 0;
  }

  // 커스텀 지표도 저장된 원본 입력 배열을 이용해 선택 기간 기준으로 재계산합니다.
  if (row.customMetricId && row.customMetricAggregation === 'ratio' && row.customMetricFormula && row.customMetricInputs) {
    const vars = Object.fromEntries(RAW_METRICS.map(key => [
      key,
      indexes.reduce((sumValue, index) => sumValue + (row.customMetricInputs?.[key]?.[index] ?? 0), 0),
    ]));
    return evaluateFormula(row.customMetricFormula, vars) ?? NaN;
  }
  if (row.customMetricId && row.customMetricAggregation === 'average') {
    const vals = indexes.map(i => row.values[i] ?? 0);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }
  if (row.customMetricId && row.customMetricAggregation === 'last') {
    const lastIndex = indexes[indexes.length - 1];
    return lastIndex === undefined ? 0 : (row.values[lastIndex] ?? 0);
  }

  // netRevenue처럼 선형(가산) 파생 지표와 커스텀 합계형은 일별 값을 더합니다.
  return indexes.reduce((s, i) => s + (row.values[i] ?? 0), 0);
}

export function sum(values: number[]) {
  return values.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);
}

export function safeDivide(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

export function byIndex(source: number[] | undefined, index: number) {
  return source?.[index] ?? 0;
}

export function formatCell(value: number, format: CellFormat) {
  if (!Number.isFinite(value)) return '-';
  if (format === 'currency') return value ? `₩${Math.round(value).toLocaleString()}` : '₩0';
  if (format === 'percent') return `${value.toFixed(value >= 100 ? 0 : 2)}%`;
  if (format === 'decimal') return value.toFixed(1);
  return Math.round(value).toLocaleString();
}

// 환경설정 > 광고주 설정에 저장한 통화를 실제 표시에 반영합니다. 기본은 원화(₩) 그대로이고,
// 그 광고주가 'USD 미국 달러'로 저장했을 때만 통화 기호를 $로 바꿉니다(환율 환산은 하지 않고
// 표시 기호만 바꿉니다 — 정확한 환율 연동은 별도 작업이 필요합니다).
// 환경설정 > 광고주 설정에 저장한 시간대를 실제 날짜·시각 표시에 반영합니다. 저장된 시간대가
// 없으면 기존처럼 브라우저 기본 시간대(Asia/Seoul)로 표시합니다.
export function formatDateForAdvertiser(dateInput: string | Date, advertiserName: string) {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const timezone = loadAdvertiserSettings()[advertiserName]?.timezone;
  try {
    return date.toLocaleString('ko-KR', timezone ? { timeZone: timezone } : undefined);
  } catch {
    return date.toLocaleString('ko-KR');
  }
}

export function formatCellForAdvertiser(value: number, format: CellFormat, advertiserName: string) {
  const base = formatCell(value, format);
  if (format !== 'currency') return base;
  const currency = loadAdvertiserSettings()[advertiserName]?.currency;
  if (!currency || !currency.startsWith('USD')) return base;
  return base.replace('₩', '$');
}

// 쉼표로 단순히 자르면 "₩2,642,363"처럼 따옴표 안에 쉼표가 든 값이 깨집니다.
// 이 앱이 내보낸 CSV를 그대로 다시 올려도 안전하도록 따옴표를 인식하는 파서를 씁니다.
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') { current += '"'; i += 1; }
    else if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { cells.push(current.trim()); current = ''; }
    else { current += char; }
  }
  cells.push(current.trim());
  return cells;
}

export function parseNumber(value: string) {
  const cleaned = value.replace(/[₩,%\s]/g, '').replace(/,/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getMonthDays(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    const date = new Date(year, monthNumber - 1, day);
    return {
      day,
      date,
      iso: `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      dayLabel: `${monthNumber} / ${day}`,
      fullLabel: `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      weekday: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()],
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });
}

export function inferReportType(advertiserName: string): ReportType {
  // 환경설정 > 광고주 설정에서 지표 프리셋을 저장해뒀으면 그걸 우선 따릅니다.
  // (상담형=DB 중심, 커머스형=매출·ROAS 중심, 혼합형=여러 지표를 함께 보는 전체 통합형).
  // 저장된 설정이 없으면 기존처럼 광고주명 기반으로 추정합니다.
  const saved = loadAdvertiserSettings()[advertiserName];
  if (saved?.preset === '상담형') return 'lead';
  if (saved?.preset === '커머스형') return 'revenue';
  if (saved?.preset === '혼합형') return 'integrated';
  if (saved?.preset === '클릭 성과형') return 'click';
  if (saved?.preset === '노출 도달형') return 'reach';
  if (advertiserName.includes('치과') || advertiserName.includes('병원')) return 'click';
  return 'lead';
}

export function defaultProfileFor(advertiserName: string): DailyReportProfile {
  const reportType = inferReportType(advertiserName);
  if (reportType === 'revenue') {
    return {
      advertiserName,
      reportType,
      platforms: ['메타', '네이버', 'GFA', '카카오키워드', '카카오모먼트', '모비온', 'ADN', '구글', '카페24', '스마트스토어'],
      metrics: ['purchases', 'revenue', 'spend', 'roas'],
      showFutureDates: true,
      futureDateDisplay: 'zero',
    };
  }
  if (reportType === 'click') {
    return {
      advertiserName,
      reportType,
      clickMode: 'efficiency',
      platforms: ['메타', '네이버', '구글', '카카오모먼트', 'GFA', '당근'],
      metrics: ['impressions', 'clicks', 'ctr', 'spend', 'cpc'],
      showFutureDates: true,
      futureDateDisplay: 'zero',
    };
  }
  if (reportType === 'integrated') {
    // 혼합형 프리셋은 이름 그대로 "전체 통합형"으로 만들어져야 합니다. 이 분기가 없으면
    // reportType 이름표만 전체 통합형이고 실제 매체·지표 구성은 DB 전환형 기본값으로
    // 만들어지는 문제가 있었습니다.
    return integratedProfileFor(advertiserName);
  }
  if (reportType === 'reach') {
    // 노출 도달형 프리셋도 마찬가지로 전용 구성을 써야 합니다.
    return reachProfileFor(advertiserName);
  }
  return {
    advertiserName,
    reportType,
    platforms: ['메타', '당근', '네이버', '구글 SA', 'YouTube AD', '틱톡'],
    metrics: ['leads', 'clicks', 'impressions', 'spend', 'cpa', 'cpc', 'ctr', 'conversionRate'],
    showFutureDates: true,
    futureDateDisplay: 'zero',
  };
}

export function reachProfileFor(advertiserName: string): DailyReportProfile {
  return {
    advertiserName,
    reportType: 'reach',
    platforms: ['메타', 'YouTube AD', '카카오모먼트', 'GFA', '네이버'],
    metrics: ['impressions', 'reach', 'frequency', 'spend'],
    showFutureDates: true,
    futureDateDisplay: 'zero',
  };
}

export const ALL_REPORT_METRICS: MetricKey[] = [
  'spend', 'impressions', 'reach', 'frequency', 'clicks', 'ctr', 'cpc',
  'leads', 'purchases', 'conversionRate', 'cpa', 'revenue', 'payments', 'refunds',
  'netRevenue', 'roas',
];

export function integratedProfileFor(advertiserName: string): DailyReportProfile {
  return {
    advertiserName,
    reportType: 'integrated',
    platforms: Object.keys(COMBINED_SOURCE),
    metrics: [...ALL_REPORT_METRICS],
    showFutureDates: true,
    futureDateDisplay: 'zero',
  };
}

export function customProfileFor(advertiserName: string): DailyReportProfile {
  // 사용자 지정형은 이름 그대로 전체 매체·전체 지표 중에서 자유롭게 고를 수 있어야 합니다.
  return {
    advertiserName,
    reportType: 'custom',
    platforms: Object.keys(COMBINED_SOURCE),
    metrics: [...ALL_REPORT_METRICS],
    showFutureDates: true,
    futureDateDisplay: 'zero',
  };
}

export function withoutFrequency(metrics: MetricKey[] = []) {
  return metrics.filter(metric => metric !== 'frequency');
}

export function sanitizeReportProfile(profile: DailyReportProfile): DailyReportProfile {
  return { ...profile };
}

// 클릭수만 있고 노출수가 없는 매체는 평균 클릭률을 가정해 노출수를 역산합니다.
export function estimateImpressionsFromClicks(clicks: number[], assumedCtrPercent = 2.4) {
  return clicks.map(value => value > 0 ? Math.round(value / (assumedCtrPercent / 100)) : 0);
}
// 광고비만 있고 노출/클릭이 둘 다 없는 매체(매출형의 매체별 귀속매출 등)는 가정 CPM으로 노출수를 역산합니다.
export function estimateImpressionsFromSpend(spend: number[], assumedCpm = 12000) {
  return spend.map(value => value > 0 ? Math.round((value / assumedCpm) * 1000) : 0);
}
// 도달(순사용자수)은 항상 노출수보다 적거나 같습니다. 매체별 노출 특성에 맞춰 대략적인 비율로 추정합니다.
export function withReach(bundle: MetricBundle, reachRatio = 0.7): MetricBundle {
  const impressions = bundle.impressions?.length ? bundle.impressions
    : bundle.clicks?.length ? estimateImpressionsFromClicks(bundle.clicks)
    : bundle.spend?.length ? estimateImpressionsFromSpend(bundle.spend)
    : undefined;
  if (!impressions) return bundle;
  const reach = impressions.map(value => Math.round(value * reachRatio));
  return { ...bundle, impressions: bundle.impressions ?? impressions, reach };
}

export const LEAD_SOURCE_RAW: SourceMap = {};

export const REVENUE_SOURCE_RAW: SourceMap = {};

export const CLICK_SOURCE_RAW: SourceMap = {};

// 매체별 도달 비율(대략치): 소셜/영상은 반복노출이 잦아 낮게, 검색광고는 사용자당 노출이 적어 높게 잡습니다.
export const REACH_RATIO_BY_PLATFORM: Record<string, number> = {
  '메타': 0.62, '당근': 0.8, '네이버': 0.85, '구글 SA': 0.85, '구글': 0.85,
  'YouTube AD': 0.55, '틱톡': 0.58, GFA: 0.75, '카카오키워드': 0.85, '카카오모먼트': 0.68, '모비온': 0.7, ADN: 0.7,
};
export function applyReach(raw: SourceMap): SourceMap {
  return Object.fromEntries(Object.entries(raw).map(([platform, bundle]) => [platform, withReach(bundle, REACH_RATIO_BY_PLATFORM[platform] ?? 0.7)]));
}
export const LEAD_SOURCE: SourceMap = applyReach(LEAD_SOURCE_RAW);
export const REVENUE_SOURCE: SourceMap = applyReach(REVENUE_SOURCE_RAW);
export const CLICK_SOURCE: SourceMap = applyReach(CLICK_SOURCE_RAW);

// 노출 도달형(브랜드 인지도) 전용 매체 데이터입니다. 노출수·도달·광고비 중심입니다.
export const REACH_SOURCE_RAW: SourceMap = {};
export const REACH_SOURCE: SourceMap = applyReach(REACH_SOURCE_RAW);

// 사용자 지정형: 4개 유형의 매체를 전부 합쳐서, 어떤 매체든 어떤 지표든 자유롭게 고를 수 있게 합니다.
// 같은 매체명이 여러 유형에 걸쳐 있으면(예: 네이버) 그 매체의 지표 필드를 전부 합칩니다.
export function buildCombinedSource(): SourceMap {
  const merged: SourceMap = {};
  [LEAD_SOURCE, REVENUE_SOURCE, CLICK_SOURCE, REACH_SOURCE].forEach(source => {
    Object.entries(source).forEach(([platform, bundle]) => {
      merged[platform] = { ...merged[platform], ...bundle };
    });
  });
  return merged;
}
export const COMBINED_SOURCE: SourceMap = buildCombinedSource();

export function sourceFor(_type: ReportType, _advertiserName?: string): SourceMap {
  // Zero State: 저장/API 데이터가 없을 때 임의의 성과값을 만들어내지 않습니다.
  return {};
}

export function inferFormat(metric: MetricKey): CellFormat {
  if (['spend', 'cpa', 'cpc', 'revenue', 'payments', 'refunds', 'netRevenue'].includes(metric)) return 'currency';
  if (['ctr', 'conversionRate', 'roas'].includes(metric)) return 'percent';
  if (metric === 'frequency') return 'decimal';
  return 'number';
}

export function totalLabel(metric: MetricKey) {
  if (metric === 'leads') return '총 DB 개수';
  if (metric === 'purchases') return '총 구매 전환';
  if (metric === 'clicks') return '총 클릭수';
  if (metric === 'impressions') return '총 노출수';
  if (metric === 'reach') return '총 도달';
  if (metric === 'frequency') return '전체 평균 빈도';
  if (metric === 'spend') return '총 광고비';
  if (metric === 'cpa') return 'DB 1개당 평균단가';
  if (metric === 'cpc') return '전체 클릭당비용';
  if (metric === 'ctr') return '총 클릭률';
  if (metric === 'conversionRate') return '총 전환률';
  if (metric === 'revenue') return '총 매출';
  if (metric === 'roas') return '전체 ROAS';
  if (metric === 'netRevenue') return '순매출';
  return `총 ${METRIC_LABELS[metric]}`;
}

export function metricGroup(metric: MetricKey) {
  if (['leads', 'purchases', 'clicks', 'impressions', 'reach'].includes(metric)) return '성과 데이터';
  if (['spend', 'cpa', 'cpc'].includes(metric)) return '광고비 효율';
  if (['ctr', 'conversionRate', 'roas', 'frequency'].includes(metric)) return '비율 지표';
  return '매출 데이터';
}

export function deriveMetric(metric: MetricKey, bundle: MetricBundle, days: number) {
  const values = Array.from({ length: days }, (_, index) => {
    const spend = byIndex(bundle.spend, index);
    const clicks = byIndex(bundle.clicks, index);
    const leads = byIndex(bundle.leads, index);
    const impressions = byIndex(bundle.impressions, index);
    const reach = byIndex(bundle.reach, index);
    const revenue = byIndex(bundle.revenue, index);
    const payments = byIndex(bundle.payments, index);
    const refunds = byIndex(bundle.refunds, index);

    if (metric === 'cpa') return safeDivide(spend, leads);
    if (metric === 'cpc') return safeDivide(spend, clicks);
    if (metric === 'ctr') return safeDivide(clicks, impressions) * 100;
    if (metric === 'conversionRate') return safeDivide(leads, clicks) * 100;
    if (metric === 'roas') return safeDivide(revenue, spend) * 100;
    if (metric === 'netRevenue') return payments - refunds;
    if (metric === 'frequency') return safeDivide(impressions, reach);
    return byIndex(bundle[metric], index);
  });

  const totalSpend = sum(bundle.spend ?? []);
  const totalClicks = sum(bundle.clicks ?? []);
  const totalLeads = sum(bundle.leads ?? []);
  const totalImpressions = sum(bundle.impressions ?? []);
  const totalReach = sum(bundle.reach ?? []);
  const totalRevenue = sum(bundle.revenue ?? []);
  const totalPayments = sum(bundle.payments ?? []);
  const totalRefunds = sum(bundle.refunds ?? []);

  // 비율 지표는 분자/분모 일별 배열을 함께 내보내, 기간(일간/주간)을 다시 선택했을 때
  // "선택 기간 분자 합계 ÷ 선택 기간 분모 합계"로 정확히 재계산할 수 있게 합니다.
  const pad = (arr: number[] | undefined) => Array.from({ length: days }, (_, i) => byIndex(arr, i));

  if (metric === 'cpa') return {
    values, total: safeDivide(totalSpend, totalLeads),
    ratioComponents: { numerator: pad(bundle.spend), denominator: pad(bundle.leads), multiplier: 1 },
  };
  if (metric === 'cpc') return {
    values, total: safeDivide(totalSpend, totalClicks),
    ratioComponents: { numerator: pad(bundle.spend), denominator: pad(bundle.clicks), multiplier: 1 },
  };
  if (metric === 'ctr') return {
    values, total: safeDivide(totalClicks, totalImpressions) * 100,
    ratioComponents: { numerator: pad(bundle.clicks), denominator: pad(bundle.impressions), multiplier: 100 },
  };
  if (metric === 'conversionRate') return {
    values, total: safeDivide(totalLeads, totalClicks) * 100,
    ratioComponents: { numerator: pad(bundle.leads), denominator: pad(bundle.clicks), multiplier: 100 },
  };
  if (metric === 'roas') return {
    values, total: safeDivide(totalRevenue, totalSpend) * 100,
    ratioComponents: { numerator: pad(bundle.revenue), denominator: pad(bundle.spend), multiplier: 100 },
  };
  if (metric === 'frequency') return {
    values, total: safeDivide(totalImpressions, totalReach),
    ratioComponents: { numerator: pad(bundle.impressions), denominator: pad(bundle.reach), multiplier: 1 },
  };
  if (metric === 'netRevenue') return { values, total: totalPayments - totalRefunds };
  return { values, total: sum(values) };
}

export function mergeBundles(source: SourceMap, platforms: string[], days: number): MetricBundle {
  const keys: (keyof MetricBundle)[] = ['leads', 'purchases', 'clicks', 'impressions', 'reach', 'spend', 'revenue', 'payments', 'refunds'];
  return keys.reduce((acc, key) => {
    acc[key] = Array.from({ length: days }, (_, index) => platforms.reduce((total, platform) => total + byIndex(source[platform]?.[key], index), 0));
    return acc;
  }, {} as MetricBundle);
}

export function buildRows(profile: DailyReportProfile, month: string, sourceOverride?: SourceMap, options?: { includeCustomRows?: boolean }) {
  const days = getMonthDays(month);
  const source = sourceOverride ?? sourceFor(profile.reportType, profile.advertiserName);
  const sourcePlatforms = Object.keys(source).filter(platform => profile.platforms.includes(platform));
  const rows: ReportRow[] = [];
  const metrics = (profile.reportType === 'click' && profile.clickMode === 'simple'
    ? ['clicks'] as MetricKey[]
    : profile.metrics);

  const includeTotal = (metric: MetricKey) => {
    if (profile.reportType === 'revenue' && metric === 'revenue') return true;
    if (['leads','purchases','clicks','impressions','reach','frequency','spend','cpa','cpc','ctr','conversionRate','revenue','roas','payments','refunds','netRevenue'].includes(metric)) return true;
    return false;
  };

  metrics.forEach(metric => {
    sourcePlatforms.forEach(platform => {
      const bundle = source[platform] ?? {};
      const { values, total, ratioComponents } = deriveMetric(metric, bundle, days.length);
      const hasRawMetric = Boolean((bundle as Record<string, number[] | undefined>)[metric]?.some(value => value !== 0));
      const has = (key: keyof MetricBundle) => Boolean(bundle[key]?.some(value => value !== 0));
      let shouldShow = hasRawMetric;
      if (metric === 'cpa') shouldShow = has('spend') && has('leads');
      if (metric === 'cpc') shouldShow = has('spend') && has('clicks');
      if (metric === 'ctr') shouldShow = has('clicks') && has('impressions');
      if (metric === 'conversionRate') shouldShow = has('leads') && has('clicks');
      if (metric === 'roas') shouldShow = has('revenue') && has('spend');
      if (metric === 'netRevenue') shouldShow = has('payments') || has('refunds');
      if (metric === 'frequency') shouldShow = has('impressions') && has('reach');
      if (profile.reportType === 'revenue') {
        const isSalesChannel = ['카페24', '스마트스토어', '간접전환'].includes(platform);
        if (metric === 'roas' && isSalesChannel) shouldShow = false;
      }
      if (!shouldShow) return;
      rows.push({
        id: `${platform}-${metric}`,
        group: metricGroup(metric),
        label: `${platform} ${METRIC_LABELS[metric]}`,
        platform,
        metric,
        format: inferFormat(metric),
        values,
        total,
        derived: ['cpa','cpc','ctr','conversionRate','roas','netRevenue','frequency'].includes(metric),
        ratioComponents,
      });
    });

    if (includeTotal(metric)) {
      const totalBundle = mergeBundles(source, sourcePlatforms, days.length);
      const { values, total, ratioComponents } = deriveMetric(metric, totalBundle, days.length);
      const revenueLike = profile.reportType === 'revenue' || profile.reportType === 'integrated' || profile.reportType === 'custom';
      const cafe24 = source['카페24']?.revenue ?? pad31([]);
      const smartStore = source['스마트스토어']?.revenue ?? pad31([]);
      const storeSalesValues = days.map((_, index) => byIndex(cafe24, index) + byIndex(smartStore, index));
      const hasStoreSales = sum(storeSalesValues) !== 0;
      if (revenueLike && metric === 'revenue' && hasStoreSales) {
        // 매출 채널이 연결된 경우에는 매체별 귀속매출을 중복 합산하지 않고 실제 주문 채널 매출을 총매출로 사용합니다.
        rows.push({ id:'store-total-revenue', group:'매출 데이터', label:'총 매출', metric, format:'currency', values:storeSalesValues, total:sum(storeSalesValues), emphasis:true });
      } else if (revenueLike && metric === 'roas' && hasStoreSales) {
        // 전체 ROAS의 분자는 카페24·스마트스토어 실제 매출, 분모는 광고비가 집행된 매체 합계로 계산합니다.
        const adSpendPlatforms = sourcePlatforms.filter(platform => !['카페24', '스마트스토어', '간접전환'].includes(platform));
        const totalSpendValues = days.map((_, index) => adSpendPlatforms.reduce((total, platform) => total + byIndex(source[platform]?.spend, index), 0));
        const totalRoasValues = days.map((_, index) => safeDivide(storeSalesValues[index], totalSpendValues[index]) * 100);
        rows.push({
          id: 'total-roas', group: metricGroup(metric), label: totalLabel(metric), metric, format: 'percent',
          values: totalRoasValues, total: safeDivide(sum(storeSalesValues), sum(totalSpendValues)) * 100,
          emphasis: true, derived: true,
          ratioComponents: { numerator: storeSalesValues, denominator: totalSpendValues, multiplier: 100 },
        });
      } else {
        rows.push({
          id: `total-${metric}`,
          group: metricGroup(metric),
          label: totalLabel(metric),
          metric,
          format: inferFormat(metric),
          values,
          total,
          emphasis: true,
          derived: ['cpa','cpc','ctr','conversionRate','roas','frequency','netRevenue'].includes(metric),
          ratioComponents,
        });
      }
    }
  });

  const visible = profile.hiddenRowIds?.length ? rows.filter(row => !profile.hiddenRowIds!.includes(row.id)) : rows;
  if (options?.includeCustomRows === false) return visible;
  return profile.customRows?.length ? [...visible, ...profile.customRows] : visible;
}

/**
 * 환경설정의 사용자 지표를 표준 원본 TOTAL 행으로부터 계산합니다.
 * 이 함수를 보고서 화면과 샘플 생성기가 함께 사용해서, 저장 경로마다 커스텀 지표 값이
 * 달라지는 문제를 막습니다.
 */
export function buildCustomMetricRows(
  rows: ReportRow[],
  month: string,
  definitions: CustomMetricDefinition[],
  selectedIds: string[],
  visibleDayIndexes?: number[],
): ReportRow[] {
  if (selectedIds.length === 0) return [];
  const days = getMonthDays(month);
  const totalsByMetric: Partial<Record<MetricKey, ReportRow>> = {};
  rows.forEach(row => {
    if (!row.platform && RAW_METRICS.includes(row.metric) && !totalsByMetric[row.metric]) totalsByMetric[row.metric] = row;
  });
  const inputs: Partial<Record<MetricKey, number[]>> = {};
  RAW_METRICS.forEach(key => { inputs[key] = totalsByMetric[key]?.values ? pad31(totalsByMetric[key]!.values, days.length) : new Array(days.length).fill(0); });
  const targetIndexes = visibleDayIndexes ?? days.map((_, index) => index);

  return selectedIds
    .map(id => definitions.find(metric => metric.id === id))
    .filter((metric): metric is CustomMetricDefinition => Boolean(metric))
    .map(metric => {
      // 산출 불가(예: 0/0)인 날은 0으로 채우지 않고 NaN으로 둡니다 — formatCell이 NaN을
      // "-"로 표시해서, 일별 표에서도 "실제 값 0"과 "그날은 계산할 수 없음"을 구분할 수
      // 있게 합니다. 평균·합계·최종값 집계도 이 NaN인 날짜는 제외하고 계산합니다(0으로
      // 채워서 계산하면 산출 불가한 날이 평균을 왜곡시킵니다).
      const values = days.map((_, index) => {
        const vars = Object.fromEntries(RAW_METRICS.map(key => [key, inputs[key]?.[index] ?? 0]));
        return evaluateFormula(metric.formula, vars) ?? NaN;
      });
      const aggregation = metric.aggregationType ?? 'ratio';
      let total = 0;
      if (aggregation === 'ratio') {
        const vars = Object.fromEntries(RAW_METRICS.map(key => [
          key,
          targetIndexes.reduce((sumValue, index) => sumValue + (inputs[key]?.[index] ?? 0), 0),
        ]));
        // 산출 불가(예: 0/0)를 0으로 바꾸지 않고 NaN으로 둡니다 — formatCell이 NaN을 "-"로
        // 표시해서 "실제 값 0"과 "계산 불가"를 화면에서 구분할 수 있게 합니다.
        total = evaluateFormula(metric.formula, vars) ?? NaN;
      } else if (aggregation === 'average') {
        const range = targetIndexes.map(index => values[index]).filter(v => Number.isFinite(v));
        total = range.length ? sum(range) / range.length : NaN;
      } else if (aggregation === 'last') {
        const validIndexes = targetIndexes.filter(index => Number.isFinite(values[index]));
        const lastValidIndex = validIndexes[validIndexes.length - 1];
        total = lastValidIndex === undefined ? NaN : values[lastValidIndex];
      } else {
        const range = targetIndexes.map(index => values[index]).filter(v => Number.isFinite(v));
        total = range.length ? sum(range) : NaN;
      }
      const format: CellFormat = metric.unit === '%' ? 'percent' : metric.unit === '원' ? 'currency' : ['회', '배'].includes(metric.unit) ? 'decimal' : 'number';
      return {
        id: `formula-${metric.id}`,
        group: '커스텀 지표',
        label: metric.name,
        metric: 'spend' as MetricKey,
        format,
        values,
        total,
        derived: true,
        customMetricId: metric.id,
        customMetricName: metric.name,
        customMetricUnit: metric.unit,
        customMetricDirection: metric.direction,
        customMetricFormula: metric.formula,
        customMetricAggregation: aggregation,
        customMetricInputs: inputs,
      } as ReportRow;
    });
}

export const RAW_METRICS: MetricKey[] = ['leads', 'purchases', 'clicks', 'impressions', 'reach', 'spend', 'revenue', 'payments', 'refunds'];

export function rowsToSource(rows: ReportRow[], days: number): SourceMap {
  const source: SourceMap = {};
  rows.forEach(row => {
    if (!row.platform || row.derived || row.emphasis) return;
    if (!RAW_METRICS.includes(row.metric)) return;
    const bundle = source[row.platform] ?? {};
    (bundle as Record<string, number[]>)[row.metric] = pad31(row.values, days);
    source[row.platform] = bundle;
  });
  return source;
}

export function normalizeApiSource(source: SourceMap | undefined, fallback: SourceMap): SourceMap {
  if (!source || typeof source !== 'object') return fallback;
  return Object.keys(source).length ? source : fallback;
}

export type IntegratedMergeResult = {
  source: SourceMap;
  customRows: ReportRow[];
  reportCount: number;
  visibleDayIndexes: number[];
  sourceReportIds: string[];
  sourceReportInfos: { id: string; createdAt: string; periodLabel?: string }[];
};

// 전체 통합형 전용 병합 함수입니다. 보고서 관리 화면과 월간 보고서 화면이 반드시 같은 결과를
// 쓰도록, 병합 로직을 이 한 곳에만 둡니다(예전에는 두 화면이 각자 구현을 갖고 있어서 서로 다른
// 숫자가 나오는 문제가 있었습니다).
//
// 두 가지를 날짜 단위로 병합합니다.
// 1) 표준 지표(광고비·클릭 등): 같은 매체·지표라도 각 보고서가 실제로 담당한 날짜만 그 보고서
//    값으로 반영하고, 담당하지 않은 날짜는 다른 보고서가 채운 값을 그대로 둡니다.
// 2) 커스텀 지표(환경설정 수식): 저장 당시 계산해둔 일별 값(values 배열)을 그대로 날짜 단위로
//    병합합니다. 수식을 다시 계산하지 않으므로, 중간에 수식이 바뀌었어도 "가장 오래된 수식이
//    전체 기간에 적용되는" 문제가 생기지 않습니다 — 각 날짜는 그 날짜를 담당한 보고서가
//    저장 당시 계산해둔 값을 그대로 씁니다.
export function mergeIntegratedReports(candidates: GeneratedReport[], month: string): IntegratedMergeResult | null {
  if (candidates.length === 0) return null;
  const days = getMonthDays(month).length;
  const sorted = [...candidates].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const merged: Record<string, Record<string, number[]>> = {};
  const allVisibleDays = new Set<number>();
  const customMerged = new Map<string, { values: number[]; name: string; unit: string; direction?: 'up' | 'down' | 'neutral'; formula?: string; aggregation?: 'sum' | 'ratio' | 'average' | 'last'; inputs: Partial<Record<MetricKey, number[]>> }>();

  sorted.forEach(report => {
    const reportSource = rowsToSource(report.rows ?? [], days);
    const ownDays = report.visibleDayIndexes ?? Array.from({ length: days }, (_, i) => i);
    ownDays.forEach(d => allVisibleDays.add(d));
    Object.entries(reportSource).forEach(([platform, bundle]) => {
      if (!merged[platform]) merged[platform] = {};
      Object.entries(bundle).forEach(([metricKey, values]) => {
        if (!merged[platform][metricKey]) merged[platform][metricKey] = new Array(days).fill(0);
        ownDays.forEach(d => { merged[platform][metricKey][d] = (values as number[])[d] ?? merged[platform][metricKey][d]; });
      });
    });
    (report.rows ?? []).filter(r => r.customMetricId).forEach(r => {
      const id = r.customMetricId!;
      const prevValues = customMerged.get(id)?.values ?? new Array(days).fill(0);
      // candidates는 오래된 순서로 처리되므로, 매번 메타데이터(이름·단위·판정방향·수식·집계방식)를
      // 덮어쓰면 마지막에는 자연히 가장 최근 보고서의 정의가 남습니다. 값(values)은 날짜 단위로만
      // 갱신해서, 그 보고서가 담당하지 않은 날짜의 기존 값은 그대로 보존합니다.
      const previousInputs = customMerged.get(id)?.inputs ?? {};
      customMerged.set(id, { values: prevValues, name: r.customMetricName ?? r.label, unit: r.customMetricUnit ?? '', direction: r.customMetricDirection, formula: r.customMetricFormula, aggregation: r.customMetricAggregation ?? 'ratio', inputs: previousInputs });
      const slot = customMerged.get(id)!;
      ownDays.forEach(d => {
        slot.values[d] = r.values[d] ?? slot.values[d];
        RAW_METRICS.forEach(key => {
          if (!slot.inputs[key]) slot.inputs[key] = new Array(days).fill(0);
          slot.inputs[key]![d] = r.customMetricInputs?.[key]?.[d] ?? slot.inputs[key]![d] ?? 0;
        });
      });
    });
  });

  const includedDays = allVisibleDays.size
    ? Array.from(allVisibleDays).sort((a, b) => a - b)
    : Array.from({ length: days }, (_, index) => index);
  const customRows: ReportRow[] = Array.from(customMerged.entries()).map(([id, info]) => {
    const aggregation = info.aggregation ?? 'ratio';
    let total: number;
    if (aggregation === 'ratio' && info.formula) {
      const vars = Object.fromEntries(RAW_METRICS.map(key => [
        key,
        includedDays.reduce((sumValue, index) => sumValue + (info.inputs[key]?.[index] ?? 0), 0),
      ]));
      total = evaluateFormula(info.formula, vars) ?? NaN;
    } else if (aggregation === 'average') {
      const values = includedDays.map(index => info.values[index]).filter(v => Number.isFinite(v));
      total = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : NaN;
    } else if (aggregation === 'last') {
      const validIndexes = includedDays.filter(index => Number.isFinite(info.values[index]));
      const lastValidIndex = validIndexes[validIndexes.length - 1];
      total = lastValidIndex === undefined ? NaN : info.values[lastValidIndex];
    } else {
      const values = includedDays.map(index => info.values[index]).filter(v => Number.isFinite(v));
      total = values.length > 0 ? values.reduce((s, v) => s + v, 0) : NaN;
    }
    return {
      id: `formula-${id}`,
      group: '커스텀 지표',
      label: info.name,
      metric: 'spend' as MetricKey,
      format: (info.unit === '%' ? 'percent' : info.unit === '원' ? 'currency' : ['회', '배'].includes(info.unit) ? 'decimal' : 'number') as CellFormat,
      values: info.values,
      total,
      derived: true,
      customMetricId: id,
      customMetricName: info.name,
      customMetricUnit: info.unit,
      customMetricDirection: info.direction,
      customMetricFormula: info.formula,
      customMetricAggregation: aggregation,
      customMetricInputs: info.inputs,
    } as ReportRow;
  });

  const mergedVisibleDays = Array.from(allVisibleDays).sort((a, b) => a - b);
  return {
    source: merged,
    customRows,
    reportCount: sorted.length,
    visibleDayIndexes: mergedVisibleDays,
    sourceReportIds: sorted.map(c => c.id),
    sourceReportInfos: sorted.map(c => ({ id: c.id, createdAt: c.createdAt, periodLabel: c.periodLabel })),
  };
}

export function loadProfiles(): Record<string, DailyReportProfile> {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, DailyReportProfile>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveProfiles(profiles: Record<string, DailyReportProfile>) {
  try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles)); } catch { /* ignore */ }
}

export const EXTRA_ADVERTISER_KEY = 'adcc-extra-advertisers-v1';
// '새 보고서 만들기'에서 기본 목록에 없는 광고주를 추가하면 여기 저장해서, 다음에 다시 켜도
// 광고주 검색·선택 목록에 남아 있게 합니다.
export function loadExtraAdvertisers(): string[] {
  try {
    const raw = localStorage.getItem(EXTRA_ADVERTISER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
export function saveExtraAdvertisers(names: string[]) {
  try { localStorage.setItem(EXTRA_ADVERTISER_KEY, JSON.stringify(names)); } catch { /* ignore */ }
}

export function isSampleReport(report: GeneratedReport): boolean {
  return Boolean(
    report.isSample ||
    report.source === 'sample' ||
    report.id?.startsWith('seed-') ||
    report.id?.startsWith('sample-') ||
    report.reportName?.includes('(테스트 샘플)')
  );
}

function hydrateCustomMetricInputs(report: GeneratedReport): GeneratedReport {
  if (!report.rows?.some(row => row.customMetricId)) return report;
  const days = getMonthDays(report.month).length;
  const rawTotals: Partial<Record<MetricKey, ReportRow>> = {};
  report.rows.forEach(row => {
    if (!row.platform && RAW_METRICS.includes(row.metric) && !row.derived && !rawTotals[row.metric]) rawTotals[row.metric] = row;
  });
  const inputs: Partial<Record<MetricKey, number[]>> = {};
  RAW_METRICS.forEach(key => { inputs[key] = pad31(rawTotals[key]?.values ?? [], days); });
  const snapshotById = new Map((report.customMetricSnapshots ?? []).map(snapshot => [snapshot.id, snapshot]));
  const indexes = report.visibleDayIndexes?.length
    ? report.visibleDayIndexes.filter(index => index >= 0 && index < days)
    : Array.from({ length: days }, (_, index) => index);
  const rows = report.rows.map(row => {
    if (!row.customMetricId) return row;
    const snapshot = snapshotById.get(row.customMetricId);
    const next: ReportRow = {
      ...row,
      customMetricName: row.customMetricName ?? snapshot?.name,
      customMetricFormula: row.customMetricFormula ?? snapshot?.formula,
      customMetricUnit: row.customMetricUnit ?? snapshot?.unit,
      customMetricDirection: row.customMetricDirection ?? snapshot?.direction,
      customMetricAggregation: row.customMetricAggregation ?? snapshot?.aggregationType ?? 'ratio',
      customMetricInputs: row.customMetricInputs ?? inputs,
    };
    return { ...next, total: resolveRangeTotal(next, indexes, indexes) };
  });
  return { ...report, rows };
}

function readReportStorage(key: string): GeneratedReport[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GeneratedReport[];
    return Array.isArray(parsed) ? parsed.map(hydrateCustomMetricInputs) : [];
  } catch { return []; }
}

/** Claude73 이전 샘플을 실제 저장소에서 찾아 테스트 전용 저장소로 이동합니다. */
export function migrateLegacySampleReports(): void {
  try {
    const actual = readReportStorage(GENERATED_STORAGE_KEY);
    const legacySamples = actual.filter(isSampleReport).map(report => ({ ...report, source: 'sample' as const, isSample: true }));
    if (legacySamples.length === 0) return;
    const existingSamples = readReportStorage(SAMPLE_GENERATED_STORAGE_KEY);
    const byId = new Map<string, GeneratedReport>();
    [...legacySamples, ...existingSamples].forEach(report => byId.set(report.id, { ...report, source: 'sample', isSample: true }));
    // 먼저 테스트 전용 저장소에 복사한 뒤 실제 저장소에서 제거합니다. 두 번째 쓰기가 실패해도
    // 샘플 원본이 유실되지는 않고, 다음 실행 때 id 기준으로 다시 중복 제거됩니다.
    localStorage.setItem(SAMPLE_GENERATED_STORAGE_KEY, JSON.stringify(Array.from(byId.values())));
    localStorage.setItem(GENERATED_STORAGE_KEY, JSON.stringify(actual.filter(report => !isSampleReport(report))));
  } catch { /* 저장 공간 오류가 나면 원본을 건드리지 않습니다. */ }
}

export function loadGeneratedReports(): GeneratedReport[] {
  migrateLegacySampleReports();
  return readReportStorage(GENERATED_STORAGE_KEY).filter(report => !isSampleReport(report));
}

export function loadSampleReports(): GeneratedReport[] {
  migrateLegacySampleReports();
  return readReportStorage(SAMPLE_GENERATED_STORAGE_KEY).map(report => ({ ...report, source: 'sample', isSample: true }));
}

export function loadAllGeneratedReports(): GeneratedReport[] {
  return [...loadGeneratedReports(), ...loadSampleReports()];
}

export function saveGeneratedReports(reports: GeneratedReport[]): boolean {
  try {
    localStorage.setItem(GENERATED_STORAGE_KEY, JSON.stringify(reports.filter(report => !isSampleReport(report))));
    return true;
  } catch { return false; }
}

export function saveSampleReports(reports: GeneratedReport[]): boolean {
  try {
    const normalized = reports.map(report => ({ ...report, source: 'sample' as const, isSample: true }));
    localStorage.setItem(SAMPLE_GENERATED_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch { return false; }
}

export function loadSavedTemplates(): SavedReportTemplate[] {
  try {
    const raw = localStorage.getItem(SAVED_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedReportTemplate[];
    // 예전에 frequency가 포함된 채 저장된 양식이 있어도, 불러오는 시점에 바로 정리해서
    // 목록의 "지표 N개" 숫자가 실제 화면에 보이는 지표 수와 항상 일치하게 합니다.
    return Array.isArray(parsed) ? parsed.map(template => ({ ...template, profile: sanitizeReportProfile(template.profile) })) : [];
  } catch { return []; }
}

export function saveSavedTemplates(templates: SavedReportTemplate[]) {
  try { localStorage.setItem(SAVED_TEMPLATE_STORAGE_KEY, JSON.stringify(templates)); } catch { /* ignore */ }
}

export function buildAoA(advertiserName: string, month: string, rows: ReportRow[], visibleDayIndexes?: number[], isSample = false) {
  const allDays = getMonthDays(month);
  const indexes = visibleDayIndexes ?? allDays.map((_, i) => i);
  const days = indexes.map(i => allDays[i]);
  const [year, monthNumber] = month.split('-');
  const totalFor = (row: ReportRow) => resolveRangeTotal(row, indexes, visibleDayIndexes);

  return [
    ...(isSample ? [['[테스트 샘플 데이터] 실제 운영 데이터가 아닙니다.', '', ...days.map(() => '')]] : []),
    [`${advertiserName} ${Number(monthNumber)}월`, 'TOTAL', ...days.map(day => day.fullLabel)],
    ...rows.map(row => [row.label, formatCell(totalFor(row), row.format), ...indexes.map(i => formatCell(row.values[i], row.format))]),
    ['', '', ''],
    [`생성 기준: ${year}년 ${Number(monthNumber)}월`, '', 'HOWTOM 유니버스'],
  ];
}

export function downloadCsv(advertiserName: string, month: string, rows: ReportRow[], visibleDayIndexes?: number[], fileSuffix = '', isSample = false) {
  const csv = buildAoA(advertiserName, month, rows, visibleDayIndexes, isSample)
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${isSample ? '[샘플]_' : ''}${advertiserName}_광고주별_일일보고서_${month}${fileSuffix}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadXlsx(advertiserName: string, month: string, rows: ReportRow[], visibleDayIndexes?: number[], fileSuffix = '', isSample = false) {
  const aoa = buildAoA(advertiserName, month, rows, visibleDayIndexes, isSample);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const dayCount = visibleDayIndexes?.length ?? getMonthDays(month).length;
  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, ...Array.from({ length: dayCount }, () => ({ wch: 12 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '일일보고서');
  XLSX.writeFile(wb, `${isSample ? '[샘플]_' : ''}${advertiserName}_광고주별_일일보고서_${month}${fileSuffix}.xlsx`);
}

export function openPrint(advertiserName: string, month: string, rows: ReportRow[], visibleDayIndexes?: number[], periodLabel?: string, isSample = false) {
  // 인쇄 미리보기 팝업에서도 인터넷 연결 없이 JPG/PNG 저장을 사용할 수 있도록
  // 현재 번들에 포함된 html2canvas를 opener 전역에 노출합니다.
  (window as typeof window & { __howtomHtml2canvas?: typeof html2canvas }).__howtomHtml2canvas = html2canvas;
  const allDays = getMonthDays(month);
  const indexes = visibleDayIndexes ?? allDays.map((_, i) => i);
  const days = indexes.map(i => allDays[i]);
  const totalFor = (row: ReportRow) => resolveRangeTotal(row, indexes, visibleDayIndexes);
  const tableRows = rows.map(row => `
    <tr class="${row.emphasis ? 'sum' : ''}">
      <td>${row.label}</td><td>${formatCell(totalFor(row), row.format)}</td>
      ${indexes.map(i => `<td>${formatCell(row.values[i], row.format)}</td>`).join('')}
    </tr>`).join('');
  const weekdays = days.map(day => `<th class="${day.isWeekend ? 'weekend' : ''}">${day.weekday}</th>`).join('');
  const dates = days.map(day => `<th class="${day.isWeekend ? 'weekend' : ''}">${day.fullLabel}</th>`).join('');
  const titleLabel = periodLabel ?? `${Number(month.split('-')[1])}월`;
  const baseFilename = `${isSample ? '[샘플]_' : ''}${advertiserName}_${month}_광고보고서`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${advertiserName} ${month} 광고보고서</title>
    <style>
      @page{size:A3 landscape;margin:8mm} body{font-family:Arial,'Malgun Gothic',sans-serif;color:#111827;background:white} ${isSample ? 'body::before{content:"TEST SAMPLE · 실제 운영 데이터 아님";position:fixed;top:45%;left:18%;font-size:58px;font-weight:800;color:rgba(180,83,9,.10);transform:rotate(-20deg);z-index:9999;pointer-events:none}' : ''} h1{font-size:18px;margin:0 0 10px}.hint{font-size:11px;color:#6b7280;margin-bottom:10px}
      table{border-collapse:collapse;width:max-content;min-width:100%;font-size:8px} th,td{border:1px solid #e5e7eb;padding:3px 5px;text-align:right;white-space:nowrap} th:first-child,td:first-child{text-align:left;font-weight:700;min-width:116px}.top th{background:#dcd7f5;color:#111827}.sum td{background:#fff4cc;font-weight:800}.weekend{background:#f8fafc}.total-col{background:#eef2ff;font-weight:800}
      .save-toolbar{display:flex;gap:8px;margin-bottom:10px}.save-toolbar button{padding:7px 14px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:12.5px;font-weight:700}.save-toolbar button:hover{background:#f3f4f6}.save-toolbar span{font-size:11.5px;color:#6b7280;align-self:center}
      @media print{.save-toolbar{display:none}}
    </style></head><body>${isSample ? '<div style="background:#111827;color:#fbbf24;padding:8px 12px;margin-bottom:10px;font-weight:800;text-align:center">테스트 샘플 데이터 · 실제 운영 데이터가 아닙니다.</div>' : ''}
    <div class="save-toolbar">
      <button onclick="window.print()">🖨 인쇄</button>
      <button id="save-pdf">PDF로 저장</button>
      <button id="save-jpg">JPG 저장</button>
      <button id="save-png">PNG 저장</button>
      <span id="save-status"></span>
    </div>
    <h1>${advertiserName} ${titleLabel} 매체별 광고보고서</h1><div class="hint">브라우저 인쇄, PDF 저장, JPG 저장, PNG 저장을 사용할 수 있습니다.</div><table id="print-capture-table"><thead><tr class="top"><th></th><th></th>${weekdays}</tr><tr class="top"><th>${advertiserName} ${titleLabel}</th><th class="total-col">TOTAL</th>${dates}</tr></thead><tbody>${tableRows}</tbody></table>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script>
      (function() {
        var statusEl = document.getElementById('save-status');
        function setStatus(msg) { statusEl.textContent = msg; setTimeout(function(){ statusEl.textContent = ''; }, 3000); }
        function capture() {
          setStatus('캡처 중...');
          var captureFn = window.html2canvas || (window.opener && window.opener.__howtomHtml2canvas);
          if (typeof captureFn !== 'function') return Promise.reject(new Error('이미지 저장 모듈을 불러오지 못했습니다.'));
          return captureFn(document.getElementById('print-capture-table'), { scale: 2, backgroundColor: '#ffffff' });
        }
        function saveImage(format) {
          capture().then(function(canvas) {
            var mime = format === 'png' ? 'image/png' : 'image/jpeg';
            var ext = format === 'png' ? 'png' : 'jpg';
            var quality = format === 'png' ? undefined : 0.94;
            canvas.toBlob(function(blob) {
              if (!blob) { setStatus('이미지 변환에 실패했습니다.'); return; }
              var link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = '${baseFilename}.' + ext;
              document.body.appendChild(link);
              link.click();
              link.remove();
              setTimeout(function(){ URL.revokeObjectURL(link.href); }, 1000);
              setStatus((format === 'png' ? 'PNG' : 'JPG') + '로 저장했습니다.');
            }, mime, quality);
          }).catch(function() { setStatus('저장에 실패했습니다.'); });
        }
        document.getElementById('save-jpg').onclick = function() { saveImage('jpeg'); };
        document.getElementById('save-png').onclick = function() { saveImage('png'); };
        document.getElementById('save-pdf').onclick = function() {
          capture().then(function(canvas) {
            var jsPDFCtor = window.jspdf.jsPDF;
            var doc = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a3' });
            var pageWidth = doc.internal.pageSize.getWidth();
            var pageHeight = doc.internal.pageSize.getHeight();
            var margin = 8;
            var ratio = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
            var w = canvas.width * ratio, h = canvas.height * ratio;
            doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', (pageWidth - w) / 2, margin, w, h);
            doc.save('${baseFilename}.pdf');
            setStatus('PDF로 저장했습니다.');
          }).catch(function() { setStatus('저장에 실패했습니다.'); });
        };
      })();
    </script>
    </body></html>`;
  const popup = window.open('', '_blank', 'width=1400,height=900');
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
}

// 실제 PDF 파일을 생성합니다. 지원 브라우저에서는 저장 위치 선택창을 열고,
// 그 외 브라우저에서는 기본 다운로드 폴더에 바로 저장합니다.
export async function savePdfFile(tableElement: HTMLElement, advertiserName: string, month: string, periodLabel?: string, isSample = false) {
  // jsPDF 기본 폰트는 한글을 지원하지 않아 텍스트로 그리면 한글이 깨집니다.
  // 화면에 실제로 렌더링된 표(브라우저가 정확히 그린 한글 포함)를 캡처해서 이미지로 PDF에 넣습니다.
  const titleLabel = periodLabel ?? `${Number(month.split('-')[1])}월`;
  const filename = `${isSample ? '[샘플]_' : ''}${advertiserName}_광고주별_일일보고서_${month}.pdf`;
  // 예전에는 showSaveFilePicker로 저장 위치를 직접 고를 수 있게 했지만, 일부 브라우저
  // 환경(인앱 브라우저, 특정 보안 정책)에서는 이 호출 자체가 자바스크립트 실행을 막아버려
  // PDF 저장이 전혀 진행되지 않는 문제가 있었습니다. 월간 보고서 PDF 저장에서 이미 같은
  // 이유로 이 API를 제거했으므로, 여기도 동일하게 항상 다운로드 폴더에 자동 저장하는
  // 방식만 사용합니다.

  // 제목·생성시각도 표와 같은 방식(임시 DOM을 만들어 캡처)으로 이미지화해서 한글이 깨지지 않게 합니다.
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'padding:6px 4px;font-family:inherit;background:#fff;width:600px;opacity:1;';
  titleEl.innerHTML = `<div style="font-size:20px;font-weight:700;color:#111827;">${advertiserName} ${titleLabel} 매체별 광고보고서</div><div style="font-size:11px;color:#6b7280;margin-top:4px;">생성 시각: ${new Date().toLocaleString('ko-KR')}</div>`;
  // html2canvas가 opacity:0 요소를 완전히 투명한(빈) 캔버스로 캡처하는 문제를 피하기 위해,
  // 캡처 대상 자체는 opacity:1로 두고 크기 0에 overflow:hidden인 래퍼로만 화면에서 숨깁니다.
  const titleWrapper = document.createElement('div');
  titleWrapper.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none;';
  titleWrapper.appendChild(titleEl);
  document.body.appendChild(titleWrapper);
  const titleCanvas = await html2canvas(titleEl, { scale: 2, backgroundColor: '#ffffff' });
  document.body.removeChild(titleWrapper);

  // 표 전체를 한 번에 캡처하면(예: 전체 통합형처럼 100행 이상) 캔버스가 너무 커져 브라우저가
  // 사실상 멈추는 현상이 있었습니다. 행을 일정 개수씩 묶어 그 구간만 보이게 만든 뒤 여러 번
  // 나눠 캡처하는 방식으로 바꿔서, 매번 다루는 캔버스 크기를 작게 유지합니다.
  const bodyRows = Array.from(tableElement.querySelectorAll<HTMLElement>('tbody tr'));
  const CHUNK_SIZE = 25;
  const rowChunks: HTMLElement[][] = [];
  for (let i = 0; i < bodyRows.length; i += CHUNK_SIZE) rowChunks.push(bodyRows.slice(i, i + CHUNK_SIZE));
  if (rowChunks.length === 0) rowChunks.push([]);

  const originalDisplay = new Map<HTMLElement, string>();
  bodyRows.forEach(row => originalDisplay.set(row, row.style.display));

  const tableCanvases: HTMLCanvasElement[] = [];
  try {
    for (const chunk of rowChunks) {
      const chunkSet = new Set(chunk);
      bodyRows.forEach(row => { row.style.display = chunkSet.has(row) ? '' : 'none'; });
      // 스타일 변경이 화면에 반영될 시간을 아주 짧게 줍니다.
      await new Promise(resolve => setTimeout(resolve, 0));
      tableCanvases.push(await html2canvas(tableElement, { scale: 2, backgroundColor: '#ffffff' }));
    }
  } finally {
    // 캡처가 도중에 실패하더라도 표 원래 모습(모든 행 표시)으로 반드시 되돌립니다.
    bodyRows.forEach(row => { row.style.display = originalDisplay.get(row) ?? ''; });
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  const titleWidthMm = Math.min(120, pageWidth - margin * 2);
  const titleHeightMm = (titleCanvas.height / titleCanvas.width) * titleWidthMm;
  doc.addImage(titleCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, titleWidthMm, titleHeightMm);
  let cursorY = margin + titleHeightMm + 4;
  const usableWidth = pageWidth - margin * 2;
  const addSampleStamp = () => {
    if (!isSample) return;
    const stamp = document.createElement('canvas'); stamp.width = 1200; stamp.height = 90;
    const ctx = stamp.getContext('2d');
    if (ctx) { ctx.fillStyle = '#111827'; ctx.fillRect(0,0,1200,90); ctx.fillStyle = '#fbbf24'; ctx.font = '700 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TEST SAMPLE · 실제 운영 데이터가 아닙니다.', 600, 45); }
    doc.addImage(stamp.toDataURL('image/jpeg', 0.95), 'JPEG', margin, pageHeight - 10, pageWidth - margin * 2, 7);
  };

  tableCanvases.forEach((canvas, chunkIndex) => {
    const imgWidthMm = usableWidth;
    const imgHeightMm = (canvas.height / canvas.width) * imgWidthMm;
    const remainingHeight = pageHeight - margin - cursorY;
    // 이 조각이 지금 페이지에 남은 공간보다 크면 새 페이지에서 시작합니다(첫 조각은 예외).
    if (chunkIndex > 0 && imgHeightMm > remainingHeight) {
      doc.addPage();
      cursorY = margin;
    }
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, cursorY, imgWidthMm, imgHeightMm);
    addSampleStamp();
    cursorY += imgHeightMm;
  });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function escapeReportHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] ?? char));
}

function safeReportFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150) || '광고보고서';
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function buildReportExportElement(
  advertiserName: string,
  month: string,
  rows: ReportRow[],
  visibleDayIndexes?: number[],
  periodLabel?: string,
  isSample = false,
  displayDayIndexes?: number[],
) {
  const allDays = getMonthDays(month);
  const indexes = visibleDayIndexes ?? allDays.map((_, index) => index);
  // displayDayIndexes가 있으면(날짜 열을 여러 장으로 나눌 때) 그 날짜들만 화면에 그리되,
  // TOTAL 컬럼은 항상 indexes(원래 전체 보고 기간) 기준으로 계산해서, 페이지를 나눠도
  // TOTAL 값이 그 페이지의 부분 합으로 잘못 보이지 않게 합니다.
  const shownIndexes = displayDayIndexes ?? indexes;
  const dayHeaders = shownIndexes.map(index => `<th>${escapeReportHtml(allDays[index]?.fullLabel ?? `${index + 1}일`)}</th>`).join('');
  const body = rows.map(row => {
    const total = resolveRangeTotal(row, indexes, visibleDayIndexes);
    return `<tr class="${row.emphasis ? 'sum' : ''}"><td>${escapeReportHtml(row.label)}</td><td>${escapeReportHtml(formatCell(total, row.format))}</td>${shownIndexes.map(index => `<td>${escapeReportHtml(formatCell(row.values[index] ?? 0, row.format))}</td>`).join('')}</tr>`;
  }).join('');
  const el = document.createElement('div');
  el.className = 'adcc-report-export-root';
  el.style.cssText = 'background:#fff;color:#111827;padding:26px;width:max-content;min-width:1500px;font-family:Arial,"Malgun Gothic",sans-serif;opacity:1;';
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:14px;">
      <div><div style="font-size:26px;font-weight:800;line-height:1.35;">${escapeReportHtml(advertiserName)} ${escapeReportHtml(periodLabel ?? `${Number(month.split('-')[1])}월`)} 매체별 광고보고서</div><div style="font-size:13px;color:#64748b;margin-top:6px;">생성 시각 ${escapeReportHtml(new Date().toLocaleString('ko-KR'))}</div></div>
      ${isSample ? '<div style="border:2px solid #f59e0b;background:#fffbeb;color:#b45309;padding:8px 14px;border-radius:10px;font-size:15px;font-weight:800;">TEST SAMPLE · 실제 운영 데이터 아님</div>' : ''}
    </div>
    <table style="border-collapse:collapse;width:max-content;min-width:100%;font-size:11px;background:#fff;">
      <thead><tr><th style="text-align:left;min-width:220px;">항목</th><th style="min-width:110px;">TOTAL</th>${dayHeaders}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    ${isSample ? '<div style="margin-top:12px;background:#111827;color:#fbbf24;text-align:center;padding:9px;font-size:15px;font-weight:800;">TEST SAMPLE · 실제 운영 데이터가 아닙니다.</div>' : ''}
  `;
  const style = document.createElement('style');
  style.textContent = `.adcc-report-export-root th,.adcc-report-export-root td{border:1px solid #dbe3ed;padding:6px 8px;text-align:right;white-space:nowrap}.adcc-report-export-root th{background:#eaf2fb;color:#12213b;font-weight:800}.adcc-report-export-root td:first-child,.adcc-report-export-root th:first-child{text-align:left;position:static!important}.adcc-report-export-root tr.sum td{background:#eff6ff;font-weight:800;color:#0f3c75}`;
  el.appendChild(style);
  // html2canvas가 opacity:0 요소를 완전히 투명한(빈) 캔버스로 캡처하는 문제를 피하기 위해,
  // 캡처 대상(el)은 opacity:1로 정상 렌더링하고, 별도의 크기 0·overflow:hidden 래퍼로만 화면에서
  // 숨깁니다. 호출부가 el.remove()를 부르면 래퍼까지 함께 정리되도록 remove를 오버라이드합니다.
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;left:-100000px;top:0;width:max-content;height:auto;overflow:visible;pointer-events:none;opacity:1;';
  wrapper.appendChild(el);
  document.body.appendChild(wrapper);
  el.remove = () => wrapper.remove();
  return el;
}

async function captureReportElement(element: HTMLElement, scale = 1.7) {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const capture = () => html2canvas(element, {
    scale,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: Math.max(element.scrollWidth + 80, 1600),
    windowHeight: Math.max(element.scrollHeight + 80, 900),
  });
  // html2canvas가 화면 밖 요소를 캡처하다가 드물게 완전히 빈(흰색뿐인) 캔버스를 만드는 경우가
  // 있습니다. 그대로 PDF에 넣으면 "내용 없는 PDF"가 되므로, 캡처 직후 실제로 텍스트나 선이
  // 그려졌는지 픽셀을 검사하고, 비어 있으면 한 번 더 시도합니다.
  const isBlank = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.width === 0 || canvas.height === 0) return true;
    // 좌측 상단 일부만 검사하면 제목/표가 중앙에 있는 페이지를 빈 화면으로 오판할 수 있습니다.
    // 전체 캔버스를 64×64로 축소해 페이지 전체에 실제 내용이 있는지 검사합니다.
    const sample = document.createElement('canvas');
    sample.width = 64; sample.height = 64;
    const sampleCtx = sample.getContext('2d');
    if (!sampleCtx) return false;
    sampleCtx.drawImage(canvas, 0, 0, 64, 64);
    const { data } = sampleCtx.getImageData(0, 0, 64, 64);
    let colored = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248) {
        colored += 1;
        if (colored > 8) return false;
      }
    }
    return true;
  };
  let canvas = await capture();
  if (isBlank(canvas)) {
    await new Promise(resolve => setTimeout(resolve, 120));
    canvas = await capture();
    if (isBlank(canvas)) {
      throw new Error('보고서 화면을 캡처하지 못했습니다(빈 화면). 잠시 후 다시 시도해 주세요.');
    }
  }
  return canvas;
}

/** 저장된 보고서의 행 데이터로 PDF를 직접 다시 그립니다. 현재 화면 DOM이나 sticky 표 상태에 의존하지 않아 빈 PDF가 생성되지 않습니다. */
export async function saveReportRowsPdf(
  advertiserName: string,
  month: string,
  rows: ReportRow[],
  visibleDayIndexes?: number[],
  periodLabel?: string,
  isSample = false,
  reportName?: string,
): Promise<'saved' | 'cancelled'> {
  if (!rows.length) throw new Error('PDF로 저장할 보고서 데이터가 없습니다.');
  const filename = `${isSample ? '[샘플]_' : ''}${safeReportFilename(reportName ?? `${advertiserName}_${month}_매체별_광고보고서`)}.pdf`;

  const chunks: ReportRow[][] = [];
  const chunkSize = 22;
  for (let index = 0; index < rows.length; index += chunkSize) chunks.push(rows.slice(index, index + chunkSize));

  const allDays = getMonthDays(month);
  const fullIndexes = visibleDayIndexes ?? allDays.map((_, index) => index);
  const dayChunkSize = 10;
  const dayChunks: number[][] = [];
  for (let index = 0; index < fullIndexes.length; index += dayChunkSize) dayChunks.push(fullIndexes.slice(index, index + dayChunkSize));
  if (dayChunks.length === 0) dayChunks.push([]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;

  let pageIndex = 0;
  const totalPages = chunks.length * dayChunks.length;
  for (let rowChunkIndex = 0; rowChunkIndex < chunks.length; rowChunkIndex += 1) {
    for (let dayChunkIndex = 0; dayChunkIndex < dayChunks.length; dayChunkIndex += 1) {
      const rowPart = totalPages > chunks.length ? ` · 행 ${rowChunkIndex + 1}/${chunks.length}` : (chunks.length > 1 ? ` · ${rowChunkIndex + 1}/${chunks.length}` : '');
      const dayPart = dayChunks.length > 1 ? ` · 날짜 ${dayChunkIndex + 1}/${dayChunks.length}` : '';
      const exportEl = buildReportExportElement(advertiserName, month, chunks[rowChunkIndex], visibleDayIndexes, `${periodLabel ?? `${Number(month.split('-')[1])}월`}${rowPart}${dayPart}`, isSample, dayChunks[dayChunkIndex]);
      try {
        const canvas = await captureReportElement(exportEl, 1.65);
        if (!canvas.width || !canvas.height) throw new Error('보고서 화면 캡처에 실패했습니다.');
        if (pageIndex > 0) doc.addPage();
        pageIndex += 1;
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;
        const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
        const drawWidth = canvas.width * ratio;
        const drawHeight = canvas.height * ratio;
        doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', (pageWidth - drawWidth) / 2, margin, drawWidth, drawHeight, undefined, 'FAST');
      } finally {
        exportEl.remove();
      }
    }
  }

  const blob = doc.output('blob');
  if (blob.size < 1000) throw new Error('PDF 내용 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  const headerBytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const headerText = String.fromCharCode(...headerBytes);
  if (headerText !== '%PDF-') throw new Error('생성된 PDF 파일 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.');
  // 브라우저 인쇄창이나 File System Access API를 거치지 않고 실제 PDF Blob을 바로 다운로드합니다.
  // 이렇게 하면 저장된 파일이 0바이트/빈 파일로 남는 브라우저별 문제도 피할 수 있습니다.
  triggerBlobDownload(blob, filename);
  return 'saved';
}

/** 보고서 전체를 하나의 JPG 또는 PNG 이미지로 저장합니다. */
export async function saveReportRowsImage(
  advertiserName: string,
  month: string,
  rows: ReportRow[],
  format: 'jpeg' | 'png',
  visibleDayIndexes?: number[],
  periodLabel?: string,
  isSample = false,
  reportName?: string,
): Promise<{ count: number }> {
  if (!rows.length) throw new Error('이미지로 저장할 보고서 데이터가 없습니다.');
  // 전체 통합형처럼 행이 매우 많고 날짜도 최대 31일인 보고서를 통째로 하나의 캔버스로 캡처하면,
  // 이미지가 지나치게 가로로 길어지고 브라우저에 따라 메모리 부족·검은 화면 문제가 생길 수
  // 있습니다. PDF 저장과 같은 원칙으로 행은 25개, 날짜는 10일 단위로 나눕니다. 여러 장이 되면
  // 개별 파일을 따로따로 자동 다운로드하지 않고(브라우저가 여러 다운로드를 차단할 수 있음),
  // ZIP 하나로 묶어서 한 번에 저장합니다.
  const rowChunkSize = 25;
  const rowChunks: ReportRow[][] = [];
  for (let index = 0; index < rows.length; index += rowChunkSize) rowChunks.push(rows.slice(index, index + rowChunkSize));

  const allDays = getMonthDays(month);
  const fullIndexes = visibleDayIndexes ?? allDays.map((_, index) => index);
  const dayChunkSize = 10;
  const dayChunks: number[][] = [];
  for (let index = 0; index < fullIndexes.length; index += dayChunkSize) dayChunks.push(fullIndexes.slice(index, index + dayChunkSize));
  if (dayChunks.length === 0) dayChunks.push([]);

  const baseName = safeReportFilename(reportName ?? `${advertiserName}_${month}_매체별_광고보고서`);
  const extension = format === 'png' ? 'png' : 'jpg';
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const totalFiles = rowChunks.length * dayChunks.length;

  const generatedBlobs: { filename: string; blob: Blob }[] = [];
  for (let rowChunkIndex = 0; rowChunkIndex < rowChunks.length; rowChunkIndex += 1) {
    for (let dayChunkIndex = 0; dayChunkIndex < dayChunks.length; dayChunkIndex += 1) {
      const rowPart = rowChunks.length > 1 ? ` · 행 ${rowChunkIndex + 1}/${rowChunks.length}` : '';
      const dayPart = dayChunks.length > 1 ? ` · 날짜 ${dayChunkIndex + 1}/${dayChunks.length}` : '';
      const namePart = totalFiles > 1 ? `${periodLabel ?? `${Number(month.split('-')[1])}월`}${rowPart}${dayPart}` : periodLabel;
      const exportEl = buildReportExportElement(advertiserName, month, rowChunks[rowChunkIndex], visibleDayIndexes, namePart, isSample, dayChunks[dayChunkIndex]);
      try {
        const canvas = await captureReportElement(exportEl, 1.8);
        if (!canvas.width || !canvas.height) throw new Error('보고서 이미지 생성에 실패했습니다.');
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지 파일 변환에 실패했습니다.')), mime, format === 'png' ? undefined : 0.94));
        const filename = totalFiles > 1
          ? `${baseName}_${generatedBlobs.length + 1}of${totalFiles}.${extension}`
          : `${isSample ? '[샘플]_' : ''}${baseName}.${extension}`;
        generatedBlobs.push({ filename, blob });
      } finally {
        exportEl.remove();
      }
    }
  }

  if (generatedBlobs.length === 0) throw new Error('이미지 생성에 실패했습니다.');

  if (generatedBlobs.length === 1) {
    triggerBlobDownload(generatedBlobs[0].blob, generatedBlobs[0].filename);
    return { count: 1 };
  }

  // 여러 장이면 ZIP 하나로 묶습니다. 실제로 담긴 파일 수를 확인한 뒤 반환해서, 호출부가
  // "N개 이미지를 저장했습니다" 같은 정확한 성공 메시지를 보여줄 수 있게 합니다.
  const zip = new JSZip();
  generatedBlobs.forEach(({ filename, blob }) => zip.file(filename, blob));
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFilename = `${isSample ? '[샘플]_' : ''}${baseName}_${generatedBlobs.length}장.zip`;
  triggerBlobDownload(zipBlob, zipFilename);
  return { count: generatedBlobs.length };
}
