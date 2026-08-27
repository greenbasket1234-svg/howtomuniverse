import { buildRows, getMonthDays, sourceFor, defaultProfileFor, loadGeneratedReports, loadSampleReports, resolveRangeTotal, RAW_METRICS, mergeIntegratedReports, reachProfileFor, integratedProfileFor, customProfileFor, type DailyReportProfile, type ReportRow, type MetricKey, type GeneratedReport, type ReportType } from '../features/reports/reportCore';
import { evaluateFormula } from './metricCatalog';

function money(v: number) { return `₩${Math.round(v).toLocaleString()}`; }
function pct(v: number) { return `${v.toFixed(1)}%`; }

export type MonthlyKpiTotals = {
  impressions: number; clicks: number; spend: number; leads: number; purchases: number; revenue: number;
  reach: number; payments: number; refunds: number;
  ctr: number; cpc: number; cvr: number; cpa: number; roas: number; cpm: number; frequency: number; netRevenue: number;
};

function sumMetric(rows: ReportRow[], metric: MetricKey, visibleDayIndexes?: number[]): number {
  const totalRow = rows.find(r => !r.platform && r.metric === metric && !r.derived);
  // visibleDayIndexes가 있으면 그 날짜들만 실제 합산 범위로 씁니다(전체 월이 아니라).
  const rangeTotal = (row: ReportRow) => visibleDayIndexes ? resolveRangeTotal(row, visibleDayIndexes, visibleDayIndexes) : row.total;
  if (totalRow) return rangeTotal(totalRow);
  return rows.filter(r => r.platform && r.metric === metric && !r.derived).reduce((s, r) => s + rangeTotal(r), 0);
}

export function summarizeMonth(rows: ReportRow[], visibleDayIndexes?: number[]): MonthlyKpiTotals {
  const impressions = sumMetric(rows, 'impressions', visibleDayIndexes);
  const clicks = sumMetric(rows, 'clicks', visibleDayIndexes);
  const spend = sumMetric(rows, 'spend', visibleDayIndexes);
  const leads = sumMetric(rows, 'leads', visibleDayIndexes);
  const purchases = sumMetric(rows, 'purchases', visibleDayIndexes);
  const revenue = sumMetric(rows, 'revenue', visibleDayIndexes);
  const reach = sumMetric(rows, 'reach', visibleDayIndexes);
  const payments = sumMetric(rows, 'payments', visibleDayIndexes);
  const refunds = sumMetric(rows, 'refunds', visibleDayIndexes);
  return {
    impressions, clicks, spend, leads, purchases, revenue, reach, payments, refunds,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cvr: clicks > 0 ? (leads / clicks) * 100 : 0,
    cpa: leads > 0 ? spend / leads : 0,
    roas: spend > 0 ? (revenue / spend) * 100 : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    frequency: reach > 0 ? impressions / reach : 0,
    netRevenue: payments - refunds,
  };
}

export type MonthlyCustomMetricSummary = {
  id: string;
  name: string;
  unit: string;
  current: number;
  previous: number;
  direction: 'up' | 'down' | 'neutral';
  aggregation: 'sum' | 'ratio' | 'average' | 'last';
  formula?: string;
};

export type MediaCustomMetricValue = {
  id: string;
  name: string;
  unit: string;
  value: number;
  direction: 'up' | 'down' | 'neutral';
  aggregation: 'sum' | 'ratio' | 'average' | 'last';
};

export type MediaPerformanceRow = {
  platform: string; impressions: number; clicks: number; ctr: number; cpc: number;
  spend: number; leads: number; purchases: number; cvr: number; cpa: number; purchaseCvr: number; purchaseCpa: number; revenue: number; roas: number;
  reach: number; cpm: number; frequency: number; payments: number; refunds: number; netRevenue: number;
  // 사용자 지정형의 다음달 제안서에서는 이 값을 기준으로 매체별 증액·감액을 판단합니다.
  // 가능한 커스텀 수식은 매체별 원본 지표(광고비·클릭·DB·매출 등)를 다시 넣어 계산하고,
  // 계산 불가능한 수식은 제외해 기존 표준 지표 판단으로 안전하게 폴백합니다.
  customMetrics?: MediaCustomMetricValue[];
};

// currentRows/previousRows에서 커스텀 지표(customMetricId가 있는 행)만 뽑아 이번 달/전월 합계로 정리합니다.
function summarizeCustomMetrics(currentRows: ReportRow[], previousRows: ReportRow[], currentVisible?: number[], previousVisible?: number[]) {
  const currentCustom = currentRows.filter(r => r.customMetricId);
  // 비율형(기본값) 커스텀 지표를 부분 기간으로 다시 계산할 때는, 일별 값을 그냥 더하지 않고
  // 그 기간의 원본 지표(광고비·DB 등) 합계로 수식을 다시 계산합니다.
  const rangeValue = (row: ReportRow, allRows: ReportRow[], visible?: number[]) => {
    if (!visible) return row.total;
    const aggregation = row.customMetricAggregation ?? 'ratio';
    if (aggregation === 'ratio' && row.customMetricFormula) {
      const totalsByMetric: Partial<Record<MetricKey, ReportRow>> = {};
      allRows.forEach(r => { if (!r.platform && RAW_METRICS.includes(r.metric) && !r.derived && !totalsByMetric[r.metric]) totalsByMetric[r.metric] = r; });
      const varValues = Object.fromEntries(RAW_METRICS.map(key => {
        const metricRow = totalsByMetric[key];
        return [key, metricRow ? resolveRangeTotal(metricRow, visible, visible) : 0];
      }));
      return evaluateFormula(row.customMetricFormula, varValues) ?? NaN;
    }
    if (aggregation === 'average') {
      const vals = visible.map(i => row.values[i]).filter(v => Number.isFinite(v));
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : NaN;
    }
    if (aggregation === 'last') {
      const validIndexes = visible.filter(i => Number.isFinite(row.values[i]));
      const lastValidIndex = validIndexes[validIndexes.length - 1];
      return lastValidIndex === undefined ? NaN : row.values[lastValidIndex];
    }
    // 합계형: 산출 가능한 날짜만 더합니다(산출 불가한 날은 0으로 채우지 않고 제외).
    const summable = visible.map(i => row.values[i]).filter(v => Number.isFinite(v));
    return summable.length > 0 ? summable.reduce((s, v) => s + v, 0) : NaN;
  };
  return currentCustom.map(r => {
    const prevRow = previousRows.find(p => p.customMetricId === r.customMetricId);
    const current = rangeValue(r, currentRows, currentVisible);
    const previous = prevRow ? rangeValue(prevRow, previousRows, previousVisible) : 0;
    return {
      id: r.customMetricId!,
      name: r.customMetricName ?? r.label,
      unit: r.customMetricUnit ?? '',
      current,
      previous,
      direction: r.customMetricDirection ?? 'up',
      aggregation: r.customMetricAggregation ?? 'ratio',
      formula: r.customMetricFormula,
    };
  });
}

function customMetricValueForPlatform(row: ReportRow, rows: ReportRow[], platform: string, visibleDayIndexes?: number[]): MediaCustomMetricValue | null {
  if (!row.customMetricId || !row.customMetricFormula) return null;
  const maxDays = Math.max(...rows.map(r => r.values.length), row.values.length, 0);
  const indexes = visibleDayIndexes?.length ? visibleDayIndexes : Array.from({ length: maxDays }, (_, index) => index);
  if (indexes.length === 0) return null;

  const platformRows: Partial<Record<MetricKey, ReportRow>> = {};
  rows.forEach(candidate => {
    if (candidate.platform === platform && RAW_METRICS.includes(candidate.metric) && !candidate.derived && !platformRows[candidate.metric]) {
      platformRows[candidate.metric] = candidate;
    }
  });
  // 수식이 실제로 참조하는 원본 지표(예: payments, refunds) 중, 이 매체에는 그 지표 자체가
  // 없는 게 있으면 "값이 0"이 아니라 "계산 불가"로 봐야 합니다(예: 결제·환불 데이터를 아예
  // 수집하지 않는 매체). 값이 진짜 0인 경우와 구분하기 위해, 수식 문자열에 등장하는
  // 지표명을 확인해서 하나라도 그 매체에 없으면 계산을 포기하고 폴백시킵니다.
  const referencedMetrics = RAW_METRICS.filter(key => row.customMetricFormula!.includes(key));
  if (referencedMetrics.length > 0 && referencedMetrics.some(key => !platformRows[key])) return null;
  const valueAt = (metric: MetricKey, dayIndex: number) => platformRows[metric]?.values[dayIndex] ?? 0;
  const sumFor = (metric: MetricKey) => indexes.reduce((total, dayIndex) => total + valueAt(metric, dayIndex), 0);
  const aggregation = row.customMetricAggregation ?? 'ratio';
  let value: number;

  if (aggregation === 'ratio') {
    const vars = Object.fromEntries(RAW_METRICS.map(key => [key, sumFor(key)]));
    const evaluated = evaluateFormula(row.customMetricFormula, vars);
    // 수식이 0/0처럼 산출 불가능한 결과를 내면(예: 결제 0건일 때 환불률), 그걸 "실제 값 0"으로
    // 바꿔치기하지 않고 이 매체는 계산 불가로 처리합니다. 0을 최고 성과로 오판해 예산을
    // 증액하는 것을 막기 위함입니다.
    if (evaluated === null) return null;
    value = evaluated;
  } else {
    const dailyEvaluations = indexes.map(dayIndex => {
      const vars = Object.fromEntries(RAW_METRICS.map(key => [key, valueAt(key, dayIndex)]));
      return evaluateFormula(row.customMetricFormula!, vars);
    });
    // 산출 불가능한 날(null)은 존재하지 않는 값으로 취급해 집계에서 제외합니다(0으로 채워
    // 넣지 않습니다) — average는 유효한 날만 평균, sum은 유효한 날만 더하고, last는 마지막
    // 유효값을 사용합니다.
    const validValues = dailyEvaluations.filter((v): v is number => v !== null);
    if (validValues.length === 0) return null;
    if (aggregation === 'average') {
      value = validValues.reduce((total, current) => total + current, 0) / validValues.length;
    } else if (aggregation === 'last') {
      value = validValues[validValues.length - 1];
    } else {
      value = validValues.reduce((total, current) => total + current, 0);
    }
  }

  if (!Number.isFinite(value)) return null;
  return {
    id: row.customMetricId,
    name: row.customMetricName ?? row.label,
    unit: row.customMetricUnit ?? '',
    value,
    direction: row.customMetricDirection ?? 'up',
    aggregation,
  };
}

function summarizeMediaCustomMetrics(rows: ReportRow[], platform: string, visibleDayIndexes?: number[]): MediaCustomMetricValue[] {
  const customRows = rows.filter(row => row.customMetricId && row.customMetricFormula);
  const uniqueCustomRows = Array.from(new Map(customRows.map(row => [row.customMetricId, row])).values());
  return uniqueCustomRows
    .map(row => customMetricValueForPlatform(row, rows, platform, visibleDayIndexes))
    .filter((value): value is MediaCustomMetricValue => Boolean(value));
}

export function buildMediaPerformanceTable(rows: ReportRow[], visibleDayIndexes?: number[]): MediaPerformanceRow[] {
  const platforms = Array.from(new Set(rows.filter(r => r.platform).map(r => r.platform as string)));
  const pick = (platform: string, metric: MetricKey) => {
    const row = rows.find(r => r.platform === platform && r.metric === metric && !r.derived);
    if (!row) return 0;
    return visibleDayIndexes ? resolveRangeTotal(row, visibleDayIndexes, visibleDayIndexes) : row.total;
  };
  return platforms.map(platform => {
    const impressions = pick(platform, 'impressions');
    const clicks = pick(platform, 'clicks');
    const spend = pick(platform, 'spend');
    const leads = pick(platform, 'leads');
    const purchases = pick(platform, 'purchases');
    const revenue = pick(platform, 'revenue');
    const reach = pick(platform, 'reach');
    const payments = pick(platform, 'payments');
    const refunds = pick(platform, 'refunds');
    return {
      platform, impressions, clicks, spend, leads, purchases, revenue, reach, payments, refunds,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cvr: clicks > 0 ? (leads / clicks) * 100 : 0,
      cpa: leads > 0 ? spend / leads : 0,
      purchaseCvr: clicks > 0 ? (purchases / clicks) * 100 : 0,
      purchaseCpa: purchases > 0 ? spend / purchases : 0,
      roas: spend > 0 ? (revenue / spend) * 100 : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      frequency: reach > 0 ? impressions / reach : 0,
      netRevenue: payments - refunds,
      customMetrics: summarizeMediaCustomMetrics(rows, platform, visibleDayIndexes),
    };
  })
    // 실제로 집행 실적(노출·클릭·광고비·전환·매출)이 전혀 없는 매체는 "진행하지 않은 매체"로 보고 뺍니다.
    .filter(m => m.impressions > 0 || m.clicks > 0 || m.spend > 0 || m.leads > 0 || m.purchases > 0 || m.revenue > 0)
    .sort((a, b) => b.spend - a.spend);
}

export type DataOrigin = 'saved-monthly' | 'saved-other' | 'demo' | 'none';

export type MonthlyReportData = {
  advertiserName: string;
  month: string;
  compareMonth: string;
  current: MonthlyKpiTotals;
  previous: MonthlyKpiTotals;
  mediaTable: MediaPerformanceRow[];
  rows: ReportRow[];
  reportType: DailyReportProfile['reportType'];
  currentOrigin: DataOrigin;
  previousOrigin: DataOrigin;
  sourceReportId?: string; // 이번 달 숫자의 원본이 된 GeneratedReport id (검증용 이력)
  sourceReportIds?: string[]; // 전체 통합형처럼 여러 보고서를 병합한 경우, 사용된 모든 원본 id
  sourceReportInfos?: { id: string; createdAt: string; periodLabel?: string }[];
  isSample?: boolean; // 이번 달 데이터가 테스트 샘플인지 (화면·PDF에 안내 표시용)
  sourceCreatedAt?: string;
  profileMetrics: MetricKey[]; // 광고주가 실제로 선택한 지표 목록 (custom 유형에서 페이지 구성에 사용)
  periodLabel: string; // 실제 보고 기간 표시용 (예: "2026.07.01 ~ 07.29") - 이번 달이 아직 안 끝났으면 오늘까지만
  validDayCount: number; // 하위 호환용: 실제 마지막 데이터 날짜 인덱스 + 1
  validDayIndexes: number[]; // 실제 보고서에 포함된 날짜 인덱스. 일별·주별 부분 저장도 정확히 보존합니다.
  usedInsteadOfMonthly?: string; // 월간 저장분이 있지만 그보다 최신인 일별·주별 데이터를 대신 쓴 경우, 그 월간 저장분의 저장 시각(정보 안내용 - 이미 최신 반영됨)
  sourcePeriodType?: 'daily' | 'weekly' | 'monthly';
  periodMismatchWarning?: string; // 이번 달과 전월의 저장 기간 유형(일별/주별/월별)이나 날짜 수가 다를 때 안내
  sourcePeriodLabel?: string;
  customMetrics: MonthlyCustomMetricSummary[];
};

// 저장된 보고서(adcc-generated-daily-reports-v1) 중 이 광고주·이 월에 해당하는 것을 찾습니다.
// periodType이 'monthly'인 것을 최우선으로 하고, 없으면 daily/weekly 중 가장 최근 저장분을 씁니다.
// 전체 통합형 전용: 이 광고주·월에 저장된 모든 실제(데모 아닌) 일별/주별/월별 보고서를 찾아
// 매체·지표 단위로 병합합니다. 같은 매체·지표가 여러 보고서에 있으면 더 최근에 저장된 값이
// 우선합니다. 보고서 관리 화면의 integratedSavedSource와 같은 원리를, 월간 보고서에서도
// 그대로 쓸 수 있도록 순수 함수로 만든 것입니다.
function findIntegratedSavedRows(advertiserName: string, month: string, all: GeneratedReport[], profile: DailyReportProfile, allowSample = true) {
  // 보고서 관리 화면과 반드시 같은 숫자가 나오도록, 병합 로직은 mergeIntegratedReports
  // 한 곳에서만 구현하고 여기서는 그 결과를 그대로 가져다 씁니다.
  const scoped = all.filter(r => r.advertiserName === advertiserName && r.month === month && r.source !== 'demo' && r.rows && r.rows.length > 0);
  const actualCandidates = scoped.filter(report => !report.isSample && report.source !== 'sample');
  // 실제 보고서가 하나라도 있으면 샘플은 통합 후보에서 완전히 제외합니다. 실제 데이터가 없을 때만
  // 테스트 전용 저장소의 샘플을 폴백으로 사용합니다.
  const candidates = actualCandidates.length > 0
    ? actualCandidates
    : allowSample ? scoped.filter(report => report.isSample || report.source === 'sample') : [];
  const merged = mergeIntegratedReports(candidates, month);
  if (!merged || (Object.keys(merged.source).length === 0 && merged.customRows.length === 0)) return null;
  const days = getMonthDays(month).length;

  // buildRows는 profile.platforms에 있는 매체만 행으로 만듭니다. 병합된 원본에 있는 매체인데
  // 현재 profile.platforms에는 없는 경우(사용자가 나중에 매체를 추가한 경우 등)가 있으면 합쳐서 넣습니다.
  const runtimeProfile: DailyReportProfile = { ...profile, platforms: Array.from(new Set([...profile.platforms, ...Object.keys(merged.source)])) };
  const rows = buildRows(runtimeProfile, month, merged.source);

  const latest = candidates.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))[candidates.length - 1];
  return {
    rows: [...rows, ...merged.customRows],
    origin: 'saved-monthly' as DataOrigin,
    sourceId: latest.id,
    sourceCreatedAt: latest.createdAt,
    reportType: 'integrated' as const,
    profile,
    usedInsteadOfMonthly: undefined as string | undefined,
    // 통합형은 여러 기간을 합친 것이라 단일 periodType 개념이 없지만, 날짜가 그 달 전체보다
    // 적으면(부분 기간) 'daily'로 표시해 부분 집계 배너가 정확히 뜨도록 합니다.
    periodType: (merged.visibleDayIndexes.length > 0 && merged.visibleDayIndexes.length < days ? 'daily' : undefined) as GeneratedReport['periodType'] | undefined,
    periodLabel: `${candidates.every(c => c.isSample || c.source === 'sample') ? '테스트 샘플 보고서' : '저장된 실제 보고서'} ${merged.reportCount}건 통합 · 실제 데이터 포함일 ${merged.visibleDayIndexes.length}일`,
    // 통합에 쓰인 모든 보고서가 실제로 담당한 날짜를 합쳐서, 월간 보고서의 보고 기간·부분
    // 집계 표시에 이 값을 그대로 쓸 수 있게 합니다.
    visibleDayIndexes: merged.visibleDayIndexes.length < days ? merged.visibleDayIndexes : undefined,
    sourceReportIds: merged.sourceReportIds,
    sourceReportInfos: merged.sourceReportInfos,
    isSample: candidates.some(c => c.isSample),
  };
}

function findSavedRows(advertiserName: string, month: string, all: GeneratedReport[], expectedType: ReportType, allowSample = true): { rows: ReportRow[]; origin: DataOrigin; sourceId: string; sourceCreatedAt: string; reportType: DailyReportProfile['reportType']; profile?: DailyReportProfile; usedInsteadOfMonthly?: string; periodType?: GeneratedReport['periodType']; periodLabel?: string; visibleDayIndexes?: number[]; sourceReportIds?: string[]; sourceReportInfos?: { id: string; createdAt: string; periodLabel?: string }[]; isSample?: boolean } | null {
  // source가 'demo'인 저장분은 화면에 "저장된 것처럼" 보이지만 실제로는 데모 데이터입니다.
  // 이런 항목을 실제 데이터로 착각해서 currentOrigin을 'saved-*'로 분류하면 안 되므로 후보에서 뺍니다.
  const scoped = all.filter(r => r.advertiserName === advertiserName && r.month === month && r.reportType === expectedType && r.rows && r.rows.length > 0 && r.source !== 'demo');
  const actualMatches = scoped.filter(report => !report.isSample && report.source !== 'sample');
  const matches = actualMatches.length > 0
    ? actualMatches
    : allowSample ? scoped.filter(report => report.isSample || report.source === 'sample') : [];
  if (matches.length === 0) return null;
  // "월간 저장분이 있으면 무조건 그것부터" 쓰지 않고, 저장 시각이 가장 최신인 것을 실제로 씁니다.
  // 오래된 월간 저장분보다 최근 일별·주별 데이터가 있으면 그게 선택됩니다.
  const latest = [...matches].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const monthly = matches.filter(r => r.periodType === 'monthly').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  // 월간 저장분이 있는데도 그보다 최신인 다른 저장분을 쓰게 된 경우, 참고용으로 안내합니다
  // (다시 만들 필요 없이 이미 최신 데이터를 반영한 상태라는 뜻입니다).
  const usedInsteadOfMonthly = monthly && monthly.id !== latest.id ? monthly.createdAt : undefined;
  return {
    rows: latest.rows!,
    origin: latest.periodType === 'monthly' ? 'saved-monthly' : 'saved-other',
    sourceId: latest.id,
    sourceCreatedAt: latest.createdAt,
    reportType: latest.reportType,
    profile: latest.profile,
    usedInsteadOfMonthly,
    periodType: latest.periodType,
    periodLabel: latest.periodLabel,
    visibleDayIndexes: latest.visibleDayIndexes,
    isSample: latest.isSample,
  };
}

function profileForType(advertiserName: string, reportType: ReportType, savedProfile?: DailyReportProfile): DailyReportProfile {
  if (savedProfile?.reportType === reportType) return savedProfile;
  if (reportType === 'reach') return reachProfileFor(advertiserName);
  if (reportType === 'integrated') return integratedProfileFor(advertiserName);
  if (reportType === 'custom') return { ...customProfileFor(advertiserName), customMetricIds: savedProfile?.customMetricIds ?? [] };
  if (reportType === 'revenue') return { advertiserName, reportType, platforms: Object.keys(sourceFor('revenue', advertiserName)), metrics: ['revenue','spend','roas','payments','refunds','netRevenue'], showFutureDates: true, futureDateDisplay: 'zero' };
  if (reportType === 'click') return { advertiserName, reportType, clickMode: 'efficiency', platforms: Object.keys(sourceFor('click', advertiserName)), metrics: ['impressions','clicks','ctr','spend','cpc','reach'], showFutureDates: true, futureDateDisplay: 'zero' };
  return { advertiserName, reportType: 'lead', platforms: Object.keys(sourceFor('lead', advertiserName)), metrics: ['leads','clicks','impressions','spend','cpa','cpc','ctr','conversionRate','reach'], showFutureDates: true, futureDateDisplay: 'zero' };
}

// 광고주·월을 넣으면 저장된 실제 데이터를 우선 사용해서 이번 달·전월 KPI를 계산합니다.
// 저장된 데이터가 전혀 없을 때만 데모 원본으로 대체하며, 이 경우 origin이 'demo'로 표시되어
// 화면·PDF에서 "데모 데이터" 안내를 보여줄 수 있습니다.
export function buildMonthlyReportData(
  advertiserName: string,
  month: string,
  profiles: Record<string, DailyReportProfile>,
  reportTypeOverride?: ReportType,
): MonthlyReportData {
  const storedProfile = profiles[advertiserName] ?? defaultProfileFor(advertiserName);
  const profile = profileForType(advertiserName, reportTypeOverride ?? storedProfile.reportType, storedProfile);
  const [y, m] = month.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const compareMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const allSaved = [...loadGeneratedReports(), ...loadSampleReports()];
  // 실제와 샘플을 한 비교 보고서 안에서 섞지 않습니다. 이번 달 또는 전월 중 하나라도 해당
  // 광고주·유형의 실제 저장분이 있으면 두 달 모두 실제 저장소만 조회하고, 없는 달은 샘플 대신
  // '데이터 없음'으로 처리합니다. 두 달 모두 실제 데이터가 전혀 없을 때만 샘플 모드가 됩니다.
  const pairMonths = new Set([month, compareMonth]);
  const relevantPair = allSaved.filter(report =>
    report.advertiserName === advertiserName &&
    pairMonths.has(report.month) &&
    report.source !== 'demo' &&
    (profile.reportType === 'integrated' || report.reportType === profile.reportType)
  );
  const hasActualInPair = relevantPair.some(report => !report.isSample && report.source !== 'sample');
  const allowSample = !hasActualInPair;
  const savedCurrent = profile.reportType === 'integrated'
    ? findIntegratedSavedRows(advertiserName, month, allSaved, profile, allowSample)
    : findSavedRows(advertiserName, month, allSaved, profile.reportType, allowSample);
  const savedPrevious = profile.reportType === 'integrated'
    ? findIntegratedSavedRows(advertiserName, compareMonth, allSaved, profile, allowSample)
    : findSavedRows(advertiserName, compareMonth, allSaved, profile.reportType, allowSample);

  const currentRows = savedCurrent?.rows ?? buildRows(profile, month, sourceFor(profile.reportType, advertiserName));
  const previousRows = savedPrevious?.rows ?? buildRows(profile, compareMonth, sourceFor(profile.reportType, advertiserName));

  // 이 보고서가 "이번 달" 것이면 아직 안 지난 날짜까지 데이터를 채울 수 없으므로, 오늘까지만
  // 유효한 기간으로 봅니다. 지난 달이면 그 달 전체 일수가 유효합니다.
  const totalDays = getMonthDays(month).length;
  const today = new Date();
  const isCurrentCalendarMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
  const calendarValidDayCount = isCurrentCalendarMonth ? Math.min(today.getDate(), totalDays) : totalDays;
  // 저장된 원본에 실제로 표시했던 날짜 범위(visibleDayIndexes)가 있으면, 달력상 오늘/말일 대신
  // 그 범위를 실제 유효 기간으로 씁니다. 일별·주별로 부분 저장된 경우 이 값이 훨씬 정확합니다.
  const savedIndexes = savedCurrent?.visibleDayIndexes?.filter(index => index >= 0 && index < totalDays);
  const validDayIndexes = savedIndexes && savedIndexes.length > 0
    ? [...new Set(savedIndexes)].sort((a, b) => a - b)
    : Array.from({ length: calendarValidDayCount }, (_, index) => index);
  const validDayCount = validDayIndexes.length > 0 ? Math.max(...validDayIndexes) + 1 : calendarValidDayCount;
  const firstDay = (validDayIndexes[0] ?? 0) + 1;
  const lastDay = (validDayIndexes[validDayIndexes.length - 1] ?? Math.max(calendarValidDayCount - 1, 0)) + 1;
  const periodLabel = `${y}.${String(m).padStart(2, '0')}.${String(firstDay).padStart(2, '0')} ~ ${y}.${String(m).padStart(2, '0')}.${String(lastDay).padStart(2, '0')}`;

  // 이번 달과 전월의 저장 기간 유형(일별/주별/월별)이 서로 다르면, 예를 들어 "이번 달은 7일치인데
  // 전월은 한 달 전체"처럼 애초에 비교 대상이 안 맞는 숫자끼리 증감을 계산하게 됩니다.
  // (전체 통합형처럼 periodType 자체가 없는 경우는 여러 기간을 합친 것이므로 비교하지 않습니다.)
  let periodMismatchWarning: string | undefined;
  // currentOrigin/previousOrigin이 데모면 이미 safeChangeRate 등에서 "비교 불가"로 별도
  // 처리하므로, 여기서는 실제 데이터끼리의 기간 불일치만 판단합니다(중복·모순 메시지 방지).
  // savedCurrent/savedPrevious 자체가 없으면(저장분이 아예 없어 데모로 대체된 경우)
  // origin만으로는 못 걸러지므로, 존재 여부를 먼저 명시적으로 확인합니다.
  if (savedCurrent && savedPrevious && savedCurrent.origin !== 'demo' && savedPrevious.origin !== 'demo') {
    const currentIsFullMonth = !savedCurrent.visibleDayIndexes;
    const previousIsFullMonth = !savedPrevious.visibleDayIndexes;
    // 둘 다 "그 달 전체"(부분 기간이 아님) 저장분이면, 7월(31일)과 6월(30일)처럼 원래 달력상
    // 날짜 수가 다른 게 당연하므로 이 차이를 기간 불일치로 보지 않습니다. 정상적인 월간 전체
    // 대 월간 전체 비교입니다.
    if (!(currentIsFullMonth && previousIsFullMonth)) {
      const currentIdx = savedCurrent.visibleDayIndexes ?? Array.from({ length: totalDays }, (_, i) => i);
      const previousIdx = savedPrevious.visibleDayIndexes ?? Array.from({ length: getMonthDays(compareMonth).length }, (_, i) => i);
      const currentDays = currentIdx.length;
      const previousDays = previousIdx.length;
      // 개수가 조금이라도 다르면(예: 7일 vs 9일) 바로 불일치로 봅니다 — 미세한 차이도 증감률을
      // 왜곡할 수 있어서, "이 정도는 괜찮다"는 임계값을 두지 않습니다.
      if (currentDays !== previousDays) {
        periodMismatchWarning = `이번 달(${currentDays}일 기준)과 전월(${previousDays}일 기준)의 집계 기간 길이가 달라 전월 대비 증감이 정확하지 않을 수 있습니다.`;
      } else {
        // 개수가 같아도 실제 날짜 위치(요일이 아니라 그 달의 몇 번째 날인지 전체)가 다르면
        // 같은 기간이 아닙니다. (예: 1~3일과 21~23일은 둘 다 3일치지만 전혀 다른 기간입니다.)
        const sameDays = currentDays === previousDays && currentIdx.every((v, i) => v === previousIdx[i]);
        if (!sameDays) {
          const currentStart = Math.min(...currentIdx);
          const previousStart = Math.min(...previousIdx);
          periodMismatchWarning = `이번 달은 ${currentStart + 1}일부터, 전월은 ${previousStart + 1}일부터 시작하는 기간이라 날짜 위치가 달라 전월 대비 증감이 정확하지 않을 수 있습니다.`;
        } else if (savedCurrent.periodType && savedPrevious.periodType && savedCurrent.periodType !== savedPrevious.periodType) {
          const periodTypeLabel = (t: string) => t === 'daily' ? '일별' : t === 'weekly' ? '주별' : '월별';
          periodMismatchWarning = `이번 달은 ${periodTypeLabel(savedCurrent.periodType)} 저장분, 전월은 ${periodTypeLabel(savedPrevious.periodType)} 저장분이라 기준이 달라 전월 대비 증감이 정확하지 않을 수 있습니다.`;
        }
      }
    }
  }

  return {
    advertiserName,
    month,
    compareMonth,
    periodMismatchWarning,
    // 저장된 원본이 일별·주별처럼 그 달 일부 기간만 담고 있으면(visibleDayIndexes), 표시 기간과
    // 실제 합계 기준이 어긋나지 않도록 그 구간만 다시 계산합니다. 월간 전체 저장분이거나
    // 데모 데이터면 visibleDayIndexes가 없어 기존처럼 total을 그대로 씁니다.
    current: summarizeMonth(currentRows, savedCurrent?.visibleDayIndexes),
    previous: summarizeMonth(previousRows, savedPrevious?.visibleDayIndexes),
    mediaTable: buildMediaPerformanceTable(currentRows, savedCurrent?.visibleDayIndexes),
    rows: currentRows,
    periodLabel,
    validDayCount,
    validDayIndexes,
    usedInsteadOfMonthly: savedCurrent?.usedInsteadOfMonthly,
    sourcePeriodType: savedCurrent?.periodType,
    sourcePeriodLabel: savedCurrent?.periodLabel,
    customMetrics: summarizeCustomMetrics(currentRows, previousRows, savedCurrent?.visibleDayIndexes, savedPrevious?.visibleDayIndexes),
    // 저장된 원본 보고서가 있으면 그 보고서가 저장될 당시의 유형을 그대로 씁니다.
    // 이후 환경설정에서 광고주 유형을 바꿔도, 과거에 저장한 월간 데이터가 새 유형 화면으로
    // 잘못 렌더링되지 않게 하기 위함입니다.
    reportType: savedCurrent?.reportType ?? profile.reportType,
    currentOrigin: savedCurrent?.origin ?? 'demo',
    previousOrigin: savedPrevious?.origin ?? 'demo',
    sourceReportId: savedCurrent?.sourceId,
    isSample: savedCurrent?.isSample,
    sourceReportIds: savedCurrent?.sourceReportIds,
    sourceReportInfos: savedCurrent?.sourceReportInfos,
    sourceCreatedAt: savedCurrent?.sourceCreatedAt,
    profileMetrics: savedCurrent?.profile?.metrics ?? profile.metrics,
  };
}

// 광고비·DB처럼 규모가 있는 지표의 증감률(%)입니다. 전월이 0이고 이번 달에 실적이 생기면
// 수학적으로 무한대가 되므로 "신규"로 별도 표시하도록 label에 담습니다.
export function changeRate(current: number, previous: number): { value: number | null; label: string } {
  if (previous === 0 && current === 0) return { value: 0, label: '변화 없음' };
  if (previous === 0) return { value: null, label: '신규' };
  const v = ((current - previous) / previous) * 100;
  return { value: v, label: `${v > 0 ? '▲' : v < 0 ? '▼' : '－'} ${Math.abs(v).toFixed(1)}%` };
}

// CTR·CVR처럼 이미 %인 지표는 %p(퍼센트포인트) 차이로 비교합니다.
export function changePoint(current: number, previous: number): { value: number; label: string } {
  const v = current - previous;
  return { value: v, label: `${v > 0 ? '▲' : v < 0 ? '▼' : '－'} ${Math.abs(v).toFixed(2)}%p` };
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}년 ${Number(m)}월`;
}

export function generateMonthlyInsights(data: MonthlyReportData): string[] {
  // 화면 KPI 카드는 전월이 데모면 "비교 불가"로 표시하는데, 자동 인사이트가 이걸 무시하고
  // changeRate를 그대로 계산하면 "CPA가 15% 개선됐습니다" 같은, 실제로는 데모 데이터와
  // 비교한 문장이 나올 수 있습니다. 화면과 모순되는 결론을 만들지 않도록 여기서 먼저 막습니다.
  if (data.currentOrigin === 'demo' || data.previousOrigin === 'demo') {
    return ['실제 저장된 데이터가 없어(이번 달 또는 전월) 증감 비교 기반의 자동 인사이트를 생성하지 않았습니다. 보고서 조회에서 데이터를 저장한 뒤 다시 만들어 주세요.'];
  }
  if (data.periodMismatchWarning) {
    return [`${data.periodMismatchWarning} 기간 기준이 맞지 않아 증감 비교 기반의 자동 인사이트는 생성하지 않았습니다.`];
  }

  const insights: string[] = [];
  const { current, previous, mediaTable, reportType } = data;
  const avg = (key: keyof typeof mediaTable[number]) => mediaTable.reduce((s, x) => s + (x[key] as number), 0) / Math.max(mediaTable.length, 1);

  // 매체가 2개 이상이면, 가장 좋은 채널과 가장 아쉬운 채널의 효율 격차를 짚어줍니다(유형 공통).
  const addGapInsight = (metricKey: keyof typeof mediaTable[number], metricLabel: string, lowerIsBetter: boolean, fmt: (v: number) => string) => {
    const values = mediaTable.filter(m => (m[metricKey] as number) > 0);
    if (values.length < 2) return;
    const sorted = [...values].sort((a, b) => lowerIsBetter ? (a[metricKey] as number) - (b[metricKey] as number) : (b[metricKey] as number) - (a[metricKey] as number));
    const best = sorted[0]; const worst = sorted[sorted.length - 1];
    const bestV = best[metricKey] as number; const worstV = worst[metricKey] as number;
    if (best.platform === worst.platform || bestV === 0) return;
    const gap = lowerIsBetter ? worstV / bestV : bestV / worstV;
    if (gap >= 1.5) {
      insights.push(`${metricLabel} 기준으로 ${best.platform}(${fmt(bestV)})와 ${worst.platform}(${fmt(worstV)})의 격차가 ${gap.toFixed(1)}배입니다. 예산을 ${best.platform} 쪽으로 재배분하면 전체 효율을 끌어올릴 여지가 있습니다.`);
    }
  };

  if (reportType === 'custom') {
    const metricLabels: Partial<Record<string, string>> = { spend: '광고비', impressions: '노출수', reach: '도달', frequency: '빈도', clicks: '클릭수', ctr: 'CTR', cpc: 'CPC', leads: 'DB', purchases: '구매 전환', conversionRate: 'CVR', cpa: 'CPA', revenue: '매출', roas: 'ROAS', payments: '결제', refunds: '환불', netRevenue: '순매출' };
    data.profileMetrics.slice(0, 3).forEach(m => {
      const label = metricLabels[m];
      const curV = (current as unknown as Record<string, number>)[m === 'conversionRate' ? 'cvr' : m];
      const prevV = (previous as unknown as Record<string, number>)[m === 'conversionRate' ? 'cvr' : m];
      if (!label || curV === undefined) return;
      const change = changeRate(curV, prevV);
      if (change.value !== null && Math.abs(change.value) >= 10) {
        insights.push(`${label}이(가) 전월 대비 ${change.label} 변화했습니다.`);
      }
    });
  } else if (reportType === 'integrated') {
    // 전체 통합형은 광고비 하나로 뭉뚱그리지 않고, 실제 데이터가 있는 영역별로 나눠서
    // 각각의 핵심 지표 변화를 짚어줍니다. 데이터가 없는 영역(예: 매출 채널이 없는 광고주)은
    // 건너뜁니다.
    if (current.reach > 0 || previous.reach > 0) {
      const cpmChange = changeRate(current.cpm, previous.cpm);
      if (current.cpm > 0 && previous.cpm > 0 && cpmChange.value !== null && Math.abs(cpmChange.value) >= 12) {
        insights.push(`[도달] CPM이 전월 대비 ${cpmChange.label} 변화했습니다. 노출 단가 흐름을 확인해 보세요.`);
      }
      const reachChange = changeRate(current.reach, previous.reach);
      if (reachChange.value !== null && Math.abs(reachChange.value) >= 15) {
        insights.push(`[도달] 도달이 전월 대비 ${reachChange.label} 변화했습니다.`);
      }
    }
    if (current.clicks > 0 || previous.clicks > 0) {
      const ctrChange = changePoint(current.ctr, previous.ctr);
      if (current.ctr > 0 && previous.ctr > 0 && Math.abs(ctrChange.value) >= 0.3) {
        insights.push(`[유입] CTR이 전월 대비 ${ctrChange.label} 변화했습니다.`);
      }
    }
    if (current.leads > 0 || previous.leads > 0) {
      const cpaChange = changeRate(current.cpa, previous.cpa);
      if (current.cpa > 0 && previous.cpa > 0 && cpaChange.value !== null) {
        if (cpaChange.value <= -10) insights.push(`[전환] CPA가 전월 대비 ${Math.abs(cpaChange.value).toFixed(1)}% 개선됐습니다.`);
        else if (cpaChange.value >= 15) insights.push(`[전환] CPA가 전월 대비 ${cpaChange.value.toFixed(1)}% 상승했습니다. 전환 효율 점검이 필요합니다.`);
      }
    }
    if (current.revenue > 0 || previous.revenue > 0) {
      const roasChange = changeRate(current.roas, previous.roas);
      if (current.roas > 0 && previous.roas > 0 && roasChange.value !== null && Math.abs(roasChange.value) >= 10) {
        insights.push(`[매출] ROAS가 전월 대비 ${roasChange.label} 변화했습니다.`);
      }
      const netRevenueChange = changeRate(current.netRevenue, previous.netRevenue);
      if (netRevenueChange.value !== null && Math.abs(netRevenueChange.value) >= 15 && (current.netRevenue !== 0 || previous.netRevenue !== 0)) {
        insights.push(`[매출] 순매출이 전월 대비 ${netRevenueChange.label} 변화했습니다.`);
      }
    }
    const bestBySpend = [...mediaTable].sort((a, b) => b.spend - a.spend)[0];
    if (bestBySpend) insights.push(`전체 매체 중 ${bestBySpend.platform}의 예산 비중이 가장 큽니다.`);
  } else if (reportType === 'revenue') {
    const roasChange = changeRate(current.roas, previous.roas);
    if (current.roas > 0 && previous.roas > 0 && roasChange.value !== null) {
      if (roasChange.value >= 10) insights.push(`ROAS가 전월 대비 ${roasChange.value.toFixed(1)}% 상승했습니다. 광고비 대비 매출 효율이 개선됐습니다.`);
      else if (roasChange.value <= -10) insights.push(`ROAS가 전월 대비 ${Math.abs(roasChange.value).toFixed(1)}% 하락했습니다. 매출 효율이 나빠지고 있어 소재·타겟팅 점검이 필요합니다.`);
    }
    const netRevenueChange = changeRate(current.netRevenue, previous.netRevenue);
    if (netRevenueChange.value !== null && netRevenueChange.value <= -10 && (current.netRevenue !== 0 || previous.netRevenue !== 0)) {
      insights.push(`순매출(결제-환불)이 전월 대비 ${Math.abs(netRevenueChange.value).toFixed(1)}% 감소했습니다.`);
    }
    const refundChange = changeRate(current.refunds, previous.refunds);
    if (refundChange.value !== null && refundChange.value >= 20 && current.refunds > 0) {
      insights.push(`환불이 전월 대비 ${refundChange.value.toFixed(1)}% 늘었습니다. 상품·CS 이슈가 없는지 확인이 필요합니다.`);
    }
    const spendChange = changeRate(current.spend, previous.spend);
    const revenueChange = changeRate(current.revenue, previous.revenue);
    if (spendChange.value !== null && revenueChange.value !== null && current.spend > 0 && previous.spend > 0 && revenueChange.value > spendChange.value && spendChange.value > 0) {
      insights.push(`광고비는 전월 대비 ${spendChange.value.toFixed(1)}% 늘었지만, 매출은 ${revenueChange.value.toFixed(1)}% 늘어 예산 확대 대비 매출 증가 폭이 더 크게 나타났습니다.`);
    }
    const bestRoas = [...mediaTable].filter(m => m.roas > 0).sort((a, b) => b.roas - a.roas)[0];
    if (bestRoas) insights.push(`전체 매체 중 ${bestRoas.platform}가 가장 높은 ROAS(${bestRoas.roas.toFixed(0)}%)를 기록해 예산 확대 우선순위가 높은 채널입니다.`);
    addGapInsight('roas', 'ROAS', false, v => pct(v));
  } else if (reportType === 'click') {
    const cpcChange = changeRate(current.cpc, previous.cpc);
    if (current.cpc > 0 && previous.cpc > 0 && cpcChange.value !== null) {
      if (cpcChange.value <= -10) insights.push(`CPC가 전월 대비 ${Math.abs(cpcChange.value).toFixed(1)}% 감소했습니다. 클릭당 비용이 개선됐습니다.`);
      else if (cpcChange.value >= 15) insights.push(`CPC가 전월 대비 ${cpcChange.value.toFixed(1)}% 상승했습니다. 클릭 단가가 오르고 있어 입찰·소재 점검이 필요합니다.`);
    }
    const ctrChange = changePoint(current.ctr, previous.ctr);
    if (current.ctr > 0 && previous.ctr > 0 && ctrChange.value <= -0.3) {
      insights.push(`CTR이 전월 대비 ${Math.abs(ctrChange.value).toFixed(2)}%p 하락했습니다. 소재 피로도가 누적됐을 가능성이 있어 새 소재 교체를 검토해 보세요.`);
    }
    const spendChange = changeRate(current.spend, previous.spend);
    const clickChange = changeRate(current.clicks, previous.clicks);
    if (spendChange.value !== null && clickChange.value !== null && current.spend > 0 && previous.spend > 0 && clickChange.value > spendChange.value && spendChange.value > 0) {
      insights.push(`광고비는 전월 대비 ${spendChange.value.toFixed(1)}% 늘었지만, 클릭수는 ${clickChange.value.toFixed(1)}% 늘어 예산 확대 대비 클릭 증가 폭이 더 크게 나타났습니다.`);
    }
    const bestCpc = [...mediaTable].filter(m => m.cpc > 0).sort((a, b) => a.cpc - b.cpc)[0];
    if (bestCpc) insights.push(`전체 매체 중 ${bestCpc.platform}가 가장 낮은 CPC(${money(bestCpc.cpc)})를 기록해 클릭 효율이 가장 좋은 채널입니다.`);
    addGapInsight('cpc', 'CPC', true, v => money(v));
  } else if (reportType === 'reach') {
    const impChange = changeRate(current.impressions, previous.impressions);
    if (impChange.value !== null) {
      if (impChange.value >= 10) insights.push(`노출수가 전월 대비 ${impChange.value.toFixed(1)}% 증가했습니다.`);
      else if (impChange.value <= -10) insights.push(`노출수가 전월 대비 ${Math.abs(impChange.value).toFixed(1)}% 감소했습니다. 예산 집행이나 매체 승인 상태를 확인해 보세요.`);
    }
    const cpmChange = changeRate(current.cpm, previous.cpm);
    if (current.cpm > 0 && previous.cpm > 0 && cpmChange.value !== null && cpmChange.value >= 15) {
      insights.push(`CPM이 전월 대비 ${cpmChange.value.toFixed(1)}% 상승했습니다. 노출 단가가 오르고 있어 입찰가·타겟 범위 점검이 필요합니다.`);
    }
    if (current.frequency >= 5) {
      insights.push(`평균 노출 빈도가 ${current.frequency.toFixed(1)}회로 높은 편입니다. 같은 사람에게 반복 노출되는 비중이 커서 소재 피로도가 우려됩니다.`);
    }
    const bestImp = [...mediaTable].sort((a, b) => b.impressions - a.impressions)[0];
    if (bestImp) insights.push(`전체 매체 중 ${bestImp.platform}이 가장 많은 노출(${bestImp.impressions.toLocaleString()}회)을 확보했습니다.`);
    addGapInsight('cpm', 'CPM', true, v => money(v));
  } else {
    const cpaChange = changeRate(current.cpa, previous.cpa);
    if (current.cpa > 0 && previous.cpa > 0 && cpaChange.value !== null) {
      if (cpaChange.value <= -10) insights.push(`CPA가 전월 대비 ${Math.abs(cpaChange.value).toFixed(1)}% 감소했습니다. 전환당 비용이 개선되어 광고 효율이 상승했습니다.`);
      else if (cpaChange.value >= 15) insights.push(`CPA가 전월 대비 ${cpaChange.value.toFixed(1)}% 상승했습니다. 전환당 비용이 오르고 있어 원인 점검이 필요합니다.`);
    }
    const cvrChange = changePoint(current.cvr, previous.cvr);
    if (current.cvr > 0 && previous.cvr > 0 && cvrChange.value <= -1) {
      insights.push(`CVR(전환율)이 전월 대비 ${Math.abs(cvrChange.value).toFixed(2)}%p 하락했습니다. 랜딩페이지나 상담 프로세스에 이탈 요인이 없는지 확인해 보세요.`);
    }
    const spendChange = changeRate(current.spend, previous.spend);
    const leadsChange = changeRate(current.leads, previous.leads);
    if (spendChange.value !== null && leadsChange.value !== null && current.spend > 0 && previous.spend > 0 && leadsChange.value > spendChange.value && spendChange.value > 0) {
      insights.push(`광고비는 전월 대비 ${spendChange.value.toFixed(1)}% 늘었지만, 전환(DB)은 ${leadsChange.value.toFixed(1)}% 늘어 예산 확대 대비 전환 증가 폭이 더 크게 나타났습니다. 효율적인 스케일업이 이뤄졌습니다.`);
    }
    const avgLeads = avg('leads');
    const lowCtrHighLeads = mediaTable.find(m => m.ctr > 0 && m.ctr < (current.ctr || 1) * 0.7 && m.leads >= avgLeads);
    if (lowCtrHighLeads) {
      insights.push(`${lowCtrHighLeads.platform}은 클릭 효율(CTR ${lowCtrHighLeads.ctr.toFixed(2)}%)은 낮지만, 높은 노출 볼륨을 기반으로 안정적인 전환(${lowCtrHighLeads.leads.toLocaleString()}건)을 확보했습니다.`);
    }
    const bestCpa = [...mediaTable].filter(m => m.cpa > 0).sort((a, b) => a.cpa - b.cpa)[0];
    if (bestCpa) {
      insights.push(`전체 매체 중 ${bestCpa.platform}가 가장 낮은 CPA(${money(bestCpa.cpa)})를 기록해 예산 확대 우선순위가 높은 채널입니다.`);
    }
    addGapInsight('cpa', 'CPA', true, v => money(v));
  }

  // 환경설정에서 만든 커스텀 지표(수식)도, 전월 대비 뚜렷한 변화가 있으면 인사이트에 반영합니다.
  data.customMetrics.forEach(cm => {
    if (cm.current === 0 && cm.previous === 0) return;
    const valueLabel = (v: number) => cm.unit === '%' ? `${v.toFixed(1)}%` : cm.unit === '원' ? money(v) : v.toLocaleString();
    if (cm.unit === '%') {
      const change = changePoint(cm.current, cm.previous);
      if (Math.abs(change.value) >= 3) insights.push(`커스텀 지표 "${cm.name}"이(가) 전월 대비 ${change.label} 변화해 ${valueLabel(cm.current)}을 기록했습니다.`);
    } else {
      const change = changeRate(cm.current, cm.previous);
      if (change.value !== null && Math.abs(change.value) >= 15) insights.push(`커스텀 지표 "${cm.name}"이(가) 전월 대비 ${change.label} 변화해 ${valueLabel(cm.current)}을 기록했습니다.`);
    }
  });

  if (insights.length === 0) {
    insights.push('이번 달 성과는 전월과 큰 변화 없이 안정적으로 유지되고 있습니다.');
  }
  return insights;
}
