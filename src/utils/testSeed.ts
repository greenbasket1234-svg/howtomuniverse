// 테스트 샘플 데이터 생성 도구입니다. 샘플은 실제 보고서와 다른 localStorage 저장소에 보관되며,
// 월간 보고서는 같은 광고주·월에 실제 데이터가 있으면 샘플을 자동으로 제외합니다.
import {
  ALL_REPORT_METRICS,
  BASE_ADVERTISERS,
  buildCustomMetricRows,
  buildRows,
  customProfileFor,
  defaultProfileFor,
  getMonthDays,
  integratedProfileFor,
  loadExtraAdvertisers,
  loadProfiles,
  loadSampleReports,
  reachProfileFor,
  saveSampleReports,
  sourceFor,
  type DailyReportProfile,
  type GeneratedReport,
  type MetricBundle,
  type MetricKey,
  type ReportType,
  type SourceMap,
} from '../features/reports/reportCore';
import { loadCustomMetrics, type CustomMetricDefinition } from './metricCatalog';
import { deleteSampleMonthlyReports, loadSampleMonthlyReports } from './monthlyReportStore';

function seedFromName(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  return hash || 1;
}

function makeRng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function extendMetric(values: number[] | undefined, validDays: number, totalDays: number, rng: () => number): number[] | undefined {
  if (!values) return undefined;
  const result = new Array(totalDays).fill(0);
  const known = values.slice(0, Math.min(21, validDays));
  const positive = known.filter(value => value > 0);
  const average = positive.length ? positive.reduce((sum, value) => sum + value, 0) / positive.length : 0;
  for (let day = 0; day < validDays; day += 1) {
    const raw = values[day] ?? 0;
    const base = raw > 0 ? raw : (day >= 21 && average > 0 ? average * (0.86 + rng() * 0.28) : raw);
    result[day] = Math.max(0, Math.round(base));
  }
  return result;
}

function prepareSource(source: SourceMap, validDays: number, totalDays: number, sizeFactor: number, rng: () => number): SourceMap {
  const result: SourceMap = {};
  Object.entries(source).forEach(([platform, bundle]) => {
    const next: MetricBundle = {};
    (Object.keys(bundle) as (keyof MetricBundle)[]).forEach(key => {
      const extended = extendMetric(bundle[key], validDays, totalDays, rng);
      if (!extended) return;
      const platformJitter = 0.88 + rng() * 0.24;
      next[key] = extended.map(value => Math.max(0, Math.round(value * sizeFactor * platformJitter)));
    });
    result[platform] = next;
  });
  return result;
}

type Scenario = 'improve' | 'steady' | 'worsen';

function metricFactors(type: ReportType, scenario: Scenario): Partial<Record<keyof MetricBundle, number>> {
  if (scenario === 'steady') return { spend: 1.01, impressions: 1.02, reach: 1.01, clicks: 1.01, leads: 1.0, revenue: 1.01, payments: 1.01, refunds: 1.0 };
  if (type === 'revenue' || type === 'integrated' || type === 'custom') {
    return scenario === 'improve'
      ? { spend: 1.07, impressions: 1.14, reach: 1.12, clicks: 1.18, leads: 1.2, revenue: 1.32, payments: 1.3, refunds: 0.82 }
      : { spend: 1.16, impressions: 1.04, reach: 1.02, clicks: 0.96, leads: 0.86, revenue: 0.82, payments: 0.84, refunds: 1.38 };
  }
  if (type === 'click') {
    return scenario === 'improve'
      ? { spend: 1.05, impressions: 1.22, reach: 1.18, clicks: 1.28 }
      : { spend: 1.18, impressions: 1.03, reach: 1.01, clicks: 0.9 };
  }
  if (type === 'reach') {
    return scenario === 'improve'
      ? { spend: 1.06, impressions: 1.24, reach: 1.22 }
      : { spend: 1.17, impressions: 0.93, reach: 0.88 };
  }
  return scenario === 'improve'
    ? { spend: 1.05, impressions: 1.16, reach: 1.14, clicks: 1.2, leads: 1.34 }
    : { spend: 1.17, impressions: 1.04, reach: 1.01, clicks: 0.95, leads: 0.78 };
}

function applyScenario(source: SourceMap, factors: Partial<Record<keyof MetricBundle, number>>, validDays: number, rng: () => number): SourceMap {
  const result: SourceMap = {};
  Object.entries(source).forEach(([platform, bundle]) => {
    const next: MetricBundle = {};
    (Object.keys(bundle) as (keyof MetricBundle)[]).forEach(key => {
      const values = bundle[key];
      if (!values) return;
      const factor = factors[key] ?? 1;
      const jitter = 0.97 + rng() * 0.06;
      next[key] = values.map((value, index) => index < validDays ? Math.max(0, Math.round(value * factor * jitter)) : 0);
    });
    result[platform] = next;
  });
  return result;
}

function makeRevenueRealistic(source: SourceMap, validDays: number, scenario: Scenario, rng: () => number): SourceMap {
  const result: SourceMap = Object.fromEntries(Object.entries(source).map(([platform, bundle]) => [platform, { ...bundle }]));
  const storePlatforms = ['카페24', '스마트스토어'];
  const adPlatforms = Object.keys(result).filter(platform => ![...storePlatforms, '간접전환'].includes(platform));
  const targetRoas = scenario === 'improve' ? 4.2 + rng() * 1.4 : scenario === 'worsen' ? 1.7 + rng() * 0.8 : 2.8 + rng() * 1.0;
  const storeSplit = 0.55 + rng() * 0.18;
  const storeRevenueA = new Array(getAnyLength(result)).fill(0);
  const storeRevenueB = new Array(getAnyLength(result)).fill(0);

  for (let day = 0; day < validDays; day += 1) {
    const spend = adPlatforms.reduce((sum, platform) => sum + (result[platform]?.spend?.[day] ?? 0), 0);
    const dailyRevenue = Math.round(spend * targetRoas * (0.88 + rng() * 0.24));
    storeRevenueA[day] = Math.round(dailyRevenue * storeSplit);
    storeRevenueB[day] = dailyRevenue - storeRevenueA[day];
  }
  if (result['카페24']) result['카페24'] = { ...result['카페24'], revenue: storeRevenueA };
  if (result['스마트스토어']) result['스마트스토어'] = { ...result['스마트스토어'], revenue: storeRevenueB };

  adPlatforms.forEach(platform => {
    const bundle = result[platform] ?? {};
    if (!bundle.spend) return;
    const attributedMultiplier = 1.2 + rng() * 4.8; // 매체별 귀속 ROAS 120~600%
    result[platform] = {
      ...bundle,
      revenue: bundle.spend.map((spend, index) => {
        if (index >= validDays) return 0;
        // 매체별 귀속 ROAS는 120~600% 범위로 제한해 테스트 보고서가 비현실적인 수치로 왜곡되지 않게 합니다.
        const dailyRoasMultiplier = Math.min(6, Math.max(1.2, attributedMultiplier * (0.85 + rng() * 0.3)));
        return Math.round(spend * dailyRoasMultiplier);
      }),
    };
  });

  const refundRatio = scenario === 'improve' ? 0.025 + rng() * 0.025 : scenario === 'worsen' ? 0.1 + rng() * 0.05 : 0.05 + rng() * 0.03;
  Object.entries(result).forEach(([platform, bundle]) => {
    const revenue = bundle.revenue;
    if (!revenue) return;
    const payments = revenue.map((value, index) => index < validDays ? Math.round(value * (0.97 + rng() * 0.05)) : 0);
    const refunds = payments.map((value, index) => index < validDays ? Math.round(value * refundRatio * (0.85 + rng() * 0.3)) : 0);
    result[platform] = { ...bundle, payments, refunds };
  });
  return result;
}

function getAnyLength(source: SourceMap): number {
  for (const bundle of Object.values(source)) {
    for (const values of Object.values(bundle)) if (values) return values.length;
  }
  return 31;
}

function kstIso(year: number, month: number, day: number, hour: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00+09:00`;
}

function validDaysForMonth(month: string, today: Date): number {
  const [year, monthNumber] = month.split('-').map(Number);
  const total = getMonthDays(month).length;
  return today.getFullYear() === year && today.getMonth() + 1 === monthNumber ? Math.min(today.getDate(), total) : total;
}

const SAMPLE_CUSTOM_METRIC: CustomMetricDefinition = {
  id: 'sample-cvr',
  name: '샘플 유효 전환율',
  formula: 'leads / clicks * 100',
  unit: '%',
  description: '샘플 보고서용 커스텀 비율 지표',
  direction: 'up',
  aggregationType: 'ratio',
};

function profileForType(name: string, type: ReportType, base: DailyReportProfile, customDefinitions: CustomMetricDefinition[]): DailyReportProfile {
  if (type === 'reach') return reachProfileFor(name);
  if (type === 'integrated') return integratedProfileFor(name);
  if (type === 'custom') {
    const selected = base.customMetricIds?.length ? base.customMetricIds : [customDefinitions[0]?.id ?? SAMPLE_CUSTOM_METRIC.id];
    return { ...customProfileFor(name), customMetricIds: selected, metrics: [...ALL_REPORT_METRICS] };
  }
  return { ...base, reportType: type };
}


function enrichSampleProfile(profile: DailyReportProfile): DailyReportProfile {
  const metrics = [...profile.metrics];
  const add = (...keys: MetricKey[]) => keys.forEach(key => { if (!metrics.includes(key)) metrics.push(key); });
  if (profile.reportType === 'revenue') add('revenue', 'spend', 'roas', 'payments', 'refunds', 'netRevenue', 'reach');
  if (profile.reportType === 'lead') add('leads', 'clicks', 'impressions', 'reach', 'spend', 'cpa', 'cpc', 'ctr', 'conversionRate');
  if (profile.reportType === 'click') add('impressions', 'reach', 'clicks', 'ctr', 'spend', 'cpc');
  return { ...profile, metrics };
}

function buildSampleReport(
  advertiserName: string,
  profile: DailyReportProfile,
  month: string,
  scenario: Scenario,
  customDefinitions: CustomMetricDefinition[],
  seed: number,
  createdHour: number,
  today: Date,
): GeneratedReport {
  const sampleProfile = enrichSampleProfile(profile);
  const totalDays = getMonthDays(month).length;
  const validDays = validDaysForMonth(month, today);
  // 6월과 7월의 기본 일별 흐름은 같은 고정 시드에서 만들고, 7월에만 시나리오별 지표 배율을
  // 적용합니다. 월마다 완전히 다른 난수를 쓰면 '유지형'인데도 CPC/ROAS가 크게 출렁일 수 있어
  // 개선·유지·악화 검증 목적이 흐려지기 때문입니다.
  const baseRng = makeRng(seed + 101);
  const scenarioRng = makeRng(seed + 202);
  const revenueRng = makeRng(seed + 303);
  const advertiserScale = 0.72 + (seed % 60) / 100;
  let source = prepareSource(sourceFor(sampleProfile.reportType, advertiserName), validDays, totalDays, advertiserScale, baseRng);
  if (month === '2026-07') source = applyScenario(source, metricFactors(sampleProfile.reportType, scenario), validDays, scenarioRng);
  const effectiveScenario: Scenario = month === '2026-07' ? scenario : 'steady';
  if (['revenue', 'integrated', 'custom'].includes(sampleProfile.reportType)) source = makeRevenueRealistic(source, validDays, effectiveScenario, revenueRng);

  const baseRows = buildRows(sampleProfile, month, source, { includeCustomRows: false });
  const selectedDefinitions = [...customDefinitions, SAMPLE_CUSTOM_METRIC].filter((metric, index, arr) => arr.findIndex(item => item.id === metric.id) === index);
  const customRows = buildCustomMetricRows(baseRows, month, selectedDefinitions, sampleProfile.customMetricIds ?? [], validDays < totalDays ? Array.from({ length: validDays }, (_, index) => index) : undefined);
  const rows = [...baseRows, ...customRows];
  const [year, monthNumber] = month.split('-').map(Number);
  const visibleDayIndexes = validDays < totalDays ? Array.from({ length: validDays }, (_, index) => index) : undefined;
  const periodLabel = visibleDayIndexes
    ? `${monthNumber}월 1일~${validDays}일 (진행 중 월간 보고서)`
    : `${monthNumber}월 전체 (월간 보고서)`;
  const typeLabel = REPORT_TYPE_LABEL_KO[sampleProfile.reportType];
  return {
    id: `sample-${advertiserName}-${sampleProfile.reportType}-${month}`,
    advertiserName,
    month,
    reportType: sampleProfile.reportType,
    createdAt: kstIso(year, monthNumber, validDays, createdHour),
    rowCount: rows.length,
    rows,
    source: 'sample',
    isSample: true,
    profile: sampleProfile,
    reportName: `${advertiserName} ${typeLabel} ${year}년 ${monthNumber}월 매체별 광고보고서 (테스트 샘플)`,
    periodType: 'monthly',
    periodLabel,
    visibleDayIndexes,
    customMetricSnapshots: customRows.map(row => ({
      id: row.customMetricId!,
      name: row.customMetricName ?? row.label,
      formula: row.customMetricFormula ?? '',
      unit: row.customMetricUnit ?? '',
      direction: row.customMetricDirection,
      aggregationType: row.customMetricAggregation,
    })),
  };
}

export type SeedResult = { ok: boolean; count?: number; error?: string };

export function generateSampleData(): SeedResult {
  try {
    const profiles = loadProfiles();
    const allNames = Array.from(new Set([...BASE_ADVERTISERS, ...loadExtraAdvertisers(), ...Object.keys(profiles)]));
    const storedCustomMetrics = loadCustomMetrics();
    const customDefinitions = storedCustomMetrics.length ? storedCustomMetrics : [SAMPLE_CUSTOM_METRIC];
    const today = new Date();
    const created: GeneratedReport[] = [];

    const scenarioCounts: Partial<Record<ReportType, number>> = {};
    const scenarioCycle: Scenario[] = ['worsen', 'steady', 'improve'];
    allNames.forEach((advertiserName) => {
      const baseProfile = profiles[advertiserName] ?? defaultProfileFor(advertiserName);
      const scenarioIndex = scenarioCounts[baseProfile.reportType] ?? 0;
      // 같은 유형 안에서도 악화·유지·개선 사례가 골고루 나오게 배정합니다. 특히 매출형 3개
      // 광고주는 ROAS 하락/유지/상승과 환불률 증가/보통/감소를 각각 확인할 수 있습니다.
      const typeCycle: Scenario[] = baseProfile.reportType === 'click'
        ? ['worsen', 'improve', 'steady']
        : scenarioCycle;
      const scenario = typeCycle[scenarioIndex % typeCycle.length];
      scenarioCounts[baseProfile.reportType] = scenarioIndex + 1;
      const seed = seedFromName(advertiserName);
      ['2026-05', '2026-06', '2026-07'].forEach(month => {
        created.push(buildSampleReport(advertiserName, baseProfile, month, scenario, customDefinitions, seed, 18, today));
      });
    });

    const showcase: { name?: string; type: ReportType; hour: number }[] = [
      { name: allNames[0], type: 'reach', hour: 16 },
      { name: allNames[1], type: 'custom', hour: 17 },
      { name: allNames[2], type: 'integrated', hour: 19 },
    ];
    showcase.forEach(({ name, type, hour }, index) => {
      if (!name) return;
      const baseProfile = profiles[name] ?? defaultProfileFor(name);
      const profile = profileForType(name, type, baseProfile, customDefinitions);
      const scenario: Scenario = index === 0 ? 'improve' : index === 1 ? 'steady' : 'worsen';
      ['2026-05', '2026-06', '2026-07'].forEach(month => {
        created.push(buildSampleReport(name, profile, month, scenario, customDefinitions, seedFromName(`${name}-${type}`), hour, today));
      });
    });

    const ok = saveSampleReports(created);
    if (!ok) return { ok: false, error: '브라우저 저장 공간이 부족해 샘플 데이터를 저장하지 못했습니다.' };
    return { ok: true, count: created.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '샘플 데이터 생성 중 알 수 없는 오류가 발생했습니다.' };
  }
}

export function deleteSampleData(): SeedResult {
  try {
    const reportsOk = saveSampleReports([]);
    const monthlyOk = deleteSampleMonthlyReports();
    if (!reportsOk || !monthlyOk) return { ok: false, error: '샘플 보고서 또는 저장된 샘플 월간 보고서를 완전히 삭제하지 못했습니다.' };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '삭제 중 알 수 없는 오류가 발생했습니다.' };
  }
}

export function hasSampleData(): boolean {
  return loadSampleReports().length > 0 || loadSampleMonthlyReports().length > 0;
}

const REPORT_TYPE_LABEL_KO: Record<ReportType, string> = {
  lead: 'DB 전환형',
  revenue: '매출 ROAS형',
  click: '클릭 성과형',
  reach: '노출 도달형',
  integrated: '전체 통합형',
  custom: '사용자 지정형',
};
