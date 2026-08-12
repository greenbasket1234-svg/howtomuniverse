// 여러 광고주 6개의 실제 보고서를
// 대조해보니, 채널을 7개짜리 고정 enum으로 두는 이전 모델(channelReport.ts)로는 부족했습니다.
// - 라인아이템 자체가 브랜드마다 다름 (메타/GFA/카카오키워드/카카오모먼트 플러스친구/
//   모비온/ADN/카페24/스마트스토어/간접전환 등 — 광고 채널이 아닌 매출 소스도 있음)
// - 브랜드마다 완전히 다른 지표 철학을 씀 (매출·ROAS 기반 / 클릭·CPC 기반 / DB·CPA 기반)
// - 같은 지표 그룹 안에서도 특정 라인아이템만 다른 지표를 쓰는 경우가 있음
//   (완도군수산: "카카오모먼트 플친"은 ROAS 대신 CPA로 표시)
// 그래서 채널을 고정 enum이 아니라 브랜드가 자유롭게 정의하는 "라인아이템" 목록으로 바꿨습니다.

export type RawFields = {
  impressions?: number;
  clicks?: number;
  spend?: number;
  dbCount?: number; // 전환·DB·리드·친구추가 등 "액션 수" 전부 이 필드 하나로 통일
  revenue?: number; // 매출
};

export type LineItem = {
  key: string; // 자유 문자열 — 'facebook' | 'gfa' | 'kakao_plus_friend' | 'cafe24' ...
  label: string; // 화면에 보여줄 라벨. 브랜드가 실제 쓰는 이름 그대로 (메타 vs META 등)
};

export type RowMetricKey =
  | 'revenue' | 'ad_spend' | 'db_count' | 'clicks' | 'impressions'
  | 'cpc' | 'cost_per_db' | 'ctr' | 'conversion_rate' | 'roas';

export const ROW_METRIC_FORMAT: Record<RowMetricKey, 'currency' | 'count' | 'percent'> = {
  revenue: 'currency', ad_spend: 'currency', db_count: 'count', clicks: 'count', impressions: 'count',
  cpc: 'currency', cost_per_db: 'currency', ctr: 'percent', conversion_rate: 'percent', roas: 'percent',
};

// 실제 시트를 보면 CTR·전환율은 소수 둘째 자리까지(예: 5.68%), ROAS는 정수로(예: 427%)
// 표기하는 관행이 서로 다릅니다. 지표별로 소수점 자리수를 다르게 둡니다.
export const PERCENT_DECIMALS: Partial<Record<RowMetricKey, number>> = {
  ctr: 2,
  conversion_rate: 2,
  roas: 0,
};

// 특정 필드가 아예 없으면(추적 안 함) null, 필드는 있는데 값이 0이면 0을 반환합니다.
// null은 "-"(미지원/해당없음)로, 0은 "0" 또는 "0.00%"로 표시됩니다 — 3차 검토에서 정한 구분.
export function computeMetric(metric: RowMetricKey, raw: RawFields): number | null {
  const has = (v: number | undefined): v is number => v !== undefined;
  switch (metric) {
    case 'revenue': return has(raw.revenue) ? raw.revenue : null;
    case 'ad_spend': return has(raw.spend) ? raw.spend : null;
    case 'db_count': return has(raw.dbCount) ? raw.dbCount : null;
    case 'clicks': return has(raw.clicks) ? raw.clicks : null;
    case 'impressions': return has(raw.impressions) ? raw.impressions : null;
    case 'cpc':
      if (!has(raw.clicks) || !has(raw.spend)) return null;
      return raw.clicks ? raw.spend / raw.clicks : 0;
    case 'cost_per_db':
      if (!has(raw.dbCount) || !has(raw.spend)) return null;
      return raw.dbCount ? raw.spend / raw.dbCount : 0;
    case 'ctr':
      if (!has(raw.impressions) || !has(raw.clicks)) return null;
      return raw.impressions ? (raw.clicks / raw.impressions) * 100 : 0;
    case 'conversion_rate':
      if (!has(raw.clicks) || !has(raw.dbCount)) return null;
      return raw.clicks ? (raw.dbCount / raw.clicks) * 100 : 0;
    case 'roas':
      if (!has(raw.spend) || !has(raw.revenue)) return null;
      return raw.spend ? (raw.revenue / raw.spend) * 100 : 0;
  }
}

const FIELD_KEYS: (keyof RawFields)[] = ['impressions', 'clicks', 'spend', 'dbCount', 'revenue'];

export function sumFields(list: RawFields[]): RawFields {
  const result: RawFields = {};
  for (const k of FIELD_KEYS) {
    const tracked = list.some((r) => r[k] !== undefined);
    if (tracked) result[k] = list.reduce((sum, r) => sum + (r[k] ?? 0), 0);
  }
  return result;
}

export function formatValue(value: number | null, format: 'currency' | 'count' | 'percent', metric?: RowMetricKey): string {
  if (value === null) return '-';
  if (format === 'currency') return `₩${Math.round(value).toLocaleString()}`;
  if (format === 'percent') {
    const decimals = metric ? PERCENT_DECIMALS[metric] ?? 0 : 0;
    return `${value.toFixed(decimals)}%`;
  }
  return value.toLocaleString();
}

// 지표 행 하나의 설정 — 이 그룹에 어떤 라인아이템이 들어가는지, 합계 행을 보여줄지,
// 특정 라인아이템만 다른 지표/라벨을 쓰는지(itemOverrides)까지 브랜드가 정의합니다.
export type RowGroupConfig = {
  metric: RowMetricKey;
  label: string;
  totalLabel?: string; // 없으면 이 그룹은 합계 행을 표시하지 않음 (노멜의 채널별 매출처럼)
  items: string[]; // line item key 목록, 순서 포함
  itemOverrides?: Record<string, { metric: RowMetricKey; label: string }>;
  // ROAS처럼 분자(매출)와 분모(광고비)의 항목 집합이 다를 때만 사용 (예: 간접전환은 매출엔
  // 포함되지만 그 자체로 광고비 라인이 없음). 없으면 items를 그대로 분자·분모 양쪽에 씀.
  totalNumeratorItems?: string[];
};

export type BrandReportConfig = {
  brandId: string;
  brandName: string;
  hasRealData: boolean; // 실제 캡처 기반 구성인지, 캡처 없이 채운 예시 구성인지
  lineItems: LineItem[];
  rowGroups: RowGroupConfig[];
  monthlyBudget?: number;
};

// lineItemKey -> date(YYYY-MM-DD) -> RawFields
export type BrandDailyData = Record<string, Record<string, RawFields>>;

export function lineItemLabel(config: BrandReportConfig, key: string): string {
  return config.lineItems.find((l) => l.key === key)?.label ?? key;
}

// ---------- 기간 단위(일/주/월/연) 버킷팅 ----------

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function bucketKey(date: string, period: PeriodType): string {
  if (period === 'daily') return date;
  if (period === 'monthly') return date.slice(0, 7);
  if (period === 'yearly') return date.slice(0, 4);
  const d = new Date(date + 'T00:00:00');
  const diffToMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return d.toISOString().slice(0, 10);
}

export function bucketLabel(key: string, period: PeriodType): string {
  if (period === 'daily') {
    const [, m, dd] = key.split('-');
    return `${Number(m)}/${Number(dd)}`;
  }
  if (period === 'monthly') return `${Number(key.split('-')[1])}월`;
  if (period === 'yearly') return `${key}년`;
  const start = new Date(key + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(start)}~${fmt(end)}`;
}

export function orderedBuckets(dates: string[], period: PeriodType): string[] {
  const keys = Array.from(new Set(dates.map((d) => bucketKey(d, period))));
  return keys.sort();
}

// 달력에서 선택한 from~to를 날짜 배열로 펼칩니다. 범위가 지나치게 넓으면(예: 연 단위
// 잘못된 입력) 방어적으로 366일로 제한합니다.
export function enumerateDates(from: string, to: string): string[] {
  const start = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  const out: string[] = [];
  const cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 366) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    );
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return out.length ? out : [from];
}
