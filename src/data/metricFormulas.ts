export type MetricFormula = {
  id: string;
  label: string;
  group: string;
  channel?: string;
  formula: string;
  description?: string;
  enabled: boolean;
};

export const METRIC_FORMULA_GROUPS = ['DB 개수','DB 단가','클릭수','클릭율','클릭당 비용','전환률','노출수','매출','광고비','ROAS','기타'];
export const METRIC_FORMULA_CHANNELS = ['전체','메타','당근','네이버','구글 SA','YouTube AD','틱톡','카카오키워드','카카오모먼트','GFA','모비온','ADN','구글','카페24','스마트스토어'];

export const METRIC_FORMULA_STORAGE_KEY = 'adcc-metric-formulas-v1';
export const METRIC_FORMULA_EVENT = 'adcc-metric-formulas-updated';

const metricLabels = [
  '메타 DB 개수','당근 DB 개수','네이버 DB 개수','구글 SA DB 개수','YouTube AD DB 개수','틱톡 DB 개수','총 DB 개수',
  '메타 클릭수','당근 클릭수','네이버 클릭수','구글 SA 클릭수','YouTube AD 클릭수','틱톡 클릭수','카카오키워드 클릭수','카카오모먼트 플러스친구','총 클릭수',
  '메타 노출수','당근 노출수','네이버 노출수','구글 SA 노출수','YouTube AD 노출수','틱톡 노출수','총 노출수',
  '메타 광고비','당근 광고비','네이버 광고비','구글 SA 광고비','YouTube AD 광고비','틱톡 광고비','카카오키워드 광고비','카카오모먼트 채널추가 광고비','총 광고비',
  '메타 DB 1개당 비용','당근 DB 1개당 비용','네이버 DB 1개당 비용','구글 SA DB 1개당 비용','YouTube AD DB 1개당 비용','틱톡 DB 1개당 비용','DB 1개당 평균단가',
  '메타 CPC','당근 CPC','네이버 CPC','구글 SA CPC','YouTube AD CPC','틱톡 CPC','카카오키워드 클릭당비용','카카오모먼트 채널추가당 비용','전체 클릭당비용',
  '메타 클릭율','당근 클릭율','네이버 클릭율','구글 SA 클릭율','YouTube AD 클릭율','틱톡 클릭율','총 클릭율',
  '메타 전환률','당근 전환률','네이버 전환률','구글 SA 전환률','YouTube AD 전환률','틱톡 전환율','총 전환률',
  '메타 매출','네이버 매출','GFA 매출','카카오키워드 매출','카카오모먼트 전환매출','카카오모먼트 메시지(도달) 매출','모비온 매출','ADN 매출','당근 매출','구글 매출','간접전환 매출','카페24 매출액','스마트스토어 매출','총 매출(카페24+스마트스토어)',
  '메타 광고비','GFA 광고비','카카오모먼트 전환 광고비','카카오모먼트 메시지(도달) 광고비','모비온 광고비','ADN 광고비','구글 광고비','카카오모먼트 광고비',
  '메타 ROAS','네이버 ROAS','GFA ROAS','카카오키워드 ROAS','카카오모먼트 ROAS','카카오모먼트 메시지(도달) ROAS','모비온 ROAS','ADN ROAS','당근 ROAS','구글 ROAS','전체 ROAS',
  '메타 클릭수','구글 클릭수','카카오모먼트 클릭수','GFA 클릭수',
  '메타 클릭당비용','네이버 클릭당비용','구글 클릭당비용','카카오모먼트 클릭당비용','GFA 클릭당비용','당근 클릭당비용'
];

const uniqueLabels = [...new Set(metricLabels)];

function slugify(label: string) {
  return `metric-${Array.from(label).map((char) => char.charCodeAt(0).toString(36)).join('-')}`;
}

function inferGroup(label: string) {
  if (label.includes('DB 1개당') || label.includes('DB 1개당 평균')) return 'DB 단가';
  if (label.includes('DB 개수')) return 'DB 개수';
  if (label.includes('클릭당') || label.includes('CPC')) return '클릭당 비용';
  if (label.includes('클릭율')) return '클릭율';
  if (label.includes('전환률') || label.includes('전환율')) return '전환률';
  if (label.includes('ROAS')) return 'ROAS';
  if (label.includes('매출')) return '매출';
  if (label.includes('광고비')) return '광고비';
  if (label.includes('노출수')) return '노출수';
  if (label.includes('클릭수') || label.includes('플러스친구')) return '클릭수';
  return '기타';
}

function platformPrefix(label: string) {
  const candidates = ['메타','당근','네이버','구글 SA','YouTube AD','틱톡','카카오키워드','카카오모먼트','GFA','모비온','ADN','구글'];
  return candidates.find((item) => label.startsWith(item)) ?? '';
}

function inferFormula(label: string) {
  const prefix = platformPrefix(label);
  if (label === '총 DB 개수') return 'SUM(모든 매체 DB 개수)';
  if (label === '총 클릭수') return 'SUM(모든 매체 클릭수)';
  if (label === '총 노출수') return 'SUM(모든 매체 노출수)';
  if (label === '총 광고비') return 'SUM(모든 매체 광고비)';
  if (label === 'DB 1개당 평균단가') return '총 광고비 ÷ 총 DB 개수';
  if (label === '전체 클릭당비용') return '총 광고비 ÷ 총 클릭수';
  if (label === '총 클릭율') return '총 클릭수 ÷ 총 노출수 × 100';
  if (label === '총 전환률') return '총 DB 개수 ÷ 총 클릭수 × 100';
  if (label === '총 매출(카페24+스마트스토어)') return '카페24 매출액 + 스마트스토어 매출';
  if (label === '전체 ROAS') return '총 매출 ÷ 총 광고비 × 100';
  if (label.includes('DB 1개당 비용')) return `${prefix} 광고비 ÷ ${prefix} DB 개수`;
  if (label.includes('CPC') || label.includes('클릭당비용')) return `${prefix} 광고비 ÷ ${prefix} 클릭수`;
  if (label.includes('채널추가당 비용')) return '카카오모먼트 채널추가 광고비 ÷ 카카오모먼트 플러스친구';
  if (label.includes('클릭율')) return `${prefix} 클릭수 ÷ ${prefix} 노출수 × 100`;
  if (label.includes('전환률') || label.includes('전환율')) return `${prefix} DB 개수 ÷ ${prefix} 클릭수 × 100`;
  if (label.includes('ROAS')) return `${prefix || label.replace(' ROAS','')} 매출 ÷ ${prefix || label.replace(' ROAS','')} 광고비 × 100`;
  return `SUM(${label} 원천 데이터)`;
}

export const METRIC_FORMULA_CATALOG: MetricFormula[] = uniqueLabels.map((label) => ({
  id: slugify(label),
  label,
  group: inferGroup(label),
  channel: platformPrefix(label) || '전체',
  formula: inferFormula(label),
  enabled: true,
}));

export function loadMetricFormulas(): MetricFormula[] {
  try {
    const raw = localStorage.getItem(METRIC_FORMULA_STORAGE_KEY);
    if (!raw) return METRIC_FORMULA_CATALOG;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : METRIC_FORMULA_CATALOG;
  } catch {
    return METRIC_FORMULA_CATALOG;
  }
}

export function saveMetricFormulas(formulas: MetricFormula[]) {
  localStorage.setItem(METRIC_FORMULA_STORAGE_KEY, JSON.stringify(formulas));
  window.dispatchEvent(new CustomEvent(METRIC_FORMULA_EVENT, { detail: formulas }));
}
