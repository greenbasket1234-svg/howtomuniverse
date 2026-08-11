// 보고서 관리(AdvertiserDailyReportPage)와 환경설정(SettingsPage)이 함께 쓰는
// 매체·지표 마스터 데이터입니다. 환경설정에서 추가·수정·삭제하면 보고서 관리에도 반영됩니다.

const CUSTOM_PLATFORMS_KEY = 'adcc-custom-platforms-v1';
const METRIC_LABEL_OVERRIDES_KEY = 'adcc-metric-label-overrides-v1';
const CUSTOM_METRICS_KEY = 'adcc-custom-metrics-v1';

export type CustomMetricDefinition = { id:string; name:string; formula:string; unit:string; description:string; direction?: 'up' | 'down' | 'neutral'; aggregationType?: 'sum' | 'ratio' | 'average' | 'last' };

export function loadCustomPlatforms(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PLATFORMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveCustomPlatforms(names: string[]) {
  try { localStorage.setItem(CUSTOM_PLATFORMS_KEY, JSON.stringify(names)); } catch { /* ignore */ }
}

export function loadMetricLabelOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(METRIC_LABEL_OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

export function saveMetricLabelOverrides(overrides: Record<string, string>) {
  try { localStorage.setItem(METRIC_LABEL_OVERRIDES_KEY, JSON.stringify(overrides)); } catch { /* ignore */ }
}


export function loadCustomMetrics(): CustomMetricDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_METRICS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveCustomMetrics(metrics: CustomMetricDefinition[]) {
  try { localStorage.setItem(CUSTOM_METRICS_KEY, JSON.stringify(metrics)); } catch { /* ignore */ }
}

// 커스텀 지표의 수식(예: "revenue / spend * 100")을 안전하게 계산합니다.
// 숫자·괄호·사칙연산·지표 키(영문/숫자/밑줄)만 허용해서, 수식에 다른 코드가 섞여 들어갈 수 없게 막습니다.
export function evaluateFormula(formula: string, values: Record<string, number>): number | null {
  if (!formula || !/^[a-zA-Z0-9_+\-*/().\s]+$/.test(formula)) return null;
  try {
    const keys = Object.keys(values);
    const fn = new Function(...keys, `"use strict"; return (${formula});`);
    const result = fn(...keys.map(k => values[k]));
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  } catch { return null; }
}
