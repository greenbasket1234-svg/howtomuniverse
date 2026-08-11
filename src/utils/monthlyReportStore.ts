import type { MonthlyReportData } from './monthlyReportData';
import type { ReportBrandSettings } from './reportBrandSettings';

// 월간 보고서를 "저장"하면 그 시점의 실제 데이터(KPI·매체표·일자별 행)를 그대로 스냅샷으로 담아둡니다.
// 실제 보고서와 테스트 샘플은 서로 다른 localStorage 키에 저장합니다. 샘플을 열어 수정하거나
// 복제하더라도 실제 월간 보고서 저장소로 이동하지 않습니다.
export type SavedMonthlyReport = {
  id: string;
  advertiserName: string;
  month: string;
  label: string;
  data: MonthlyReportData;
  insights: string[];
  brand: Omit<ReportBrandSettings, 'logoUrl'>;
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
};

export const MONTHLY_REPORT_STORAGE_KEY = 'adcc-monthly-reports-v2';
export const SAMPLE_MONTHLY_REPORT_STORAGE_KEY = 'adcc-sample-monthly-reports-v1';

function read(key: string): SavedMonthlyReport[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function isSampleMonthlyReport(report: SavedMonthlyReport): boolean {
  return Boolean(report.isSample || report.data?.isSample || report.id?.startsWith('sample-mr-') || report.label?.includes('[테스트 샘플]'));
}

function normalizeSample(report: SavedMonthlyReport): SavedMonthlyReport {
  const plainLabel = report.label.replace(/^\[테스트 샘플\]\s*/, '');
  return {
    ...report,
    isSample: true,
    data: { ...report.data, isSample: true },
    label: `[테스트 샘플] ${plainLabel}`,
  };
}

function persist(key: string, list: SavedMonthlyReport[]): boolean {
  try { localStorage.setItem(key, JSON.stringify(list)); return true; } catch { return false; }
}

/** Claude76 이전에 실제 월간 저장소에 섞여 있던 샘플 스냅샷을 샘플 전용 저장소로 이동합니다. */
export function migrateLegacyMonthlySampleReports(): void {
  try {
    const actual = read(MONTHLY_REPORT_STORAGE_KEY);
    const legacySamples = actual.filter(isSampleMonthlyReport).map(normalizeSample);
    if (legacySamples.length === 0) return;
    const existingSamples = read(SAMPLE_MONTHLY_REPORT_STORAGE_KEY).map(normalizeSample);
    const byId = new Map<string, SavedMonthlyReport>();
    [...legacySamples, ...existingSamples].forEach(report => byId.set(report.id, normalizeSample(report)));
    // 샘플 저장소 기록이 먼저 성공한 뒤 실제 저장소에서 제거합니다.
    if (!persist(SAMPLE_MONTHLY_REPORT_STORAGE_KEY, Array.from(byId.values()))) return;
    persist(MONTHLY_REPORT_STORAGE_KEY, actual.filter(report => !isSampleMonthlyReport(report)));
  } catch { /* 원본 보존 */ }
}

export function loadActualMonthlyReports(): SavedMonthlyReport[] {
  migrateLegacyMonthlySampleReports();
  return read(MONTHLY_REPORT_STORAGE_KEY).filter(report => !isSampleMonthlyReport(report));
}

export function loadSampleMonthlyReports(): SavedMonthlyReport[] {
  migrateLegacyMonthlySampleReports();
  return read(SAMPLE_MONTHLY_REPORT_STORAGE_KEY).map(normalizeSample);
}

export function loadSavedMonthlyReports(): SavedMonthlyReport[] {
  return [...loadActualMonthlyReports(), ...loadSampleMonthlyReports()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function stripLogo(brand: ReportBrandSettings): Omit<ReportBrandSettings, 'logoUrl'> {
  const { logoUrl: _logoUrl, ...rest } = brand;
  return rest;
}

export function saveMonthlyReport(
  id: string | null,
  advertiserName: string,
  month: string,
  data: MonthlyReportData,
  insights: string[],
  brand: ReportBrandSettings,
  label?: string,
): SavedMonthlyReport | null {
  migrateLegacyMonthlySampleReports();
  const actualList = loadActualMonthlyReports();
  const sampleList = loadSampleMonthlyReports();
  const existing = id ? [...actualList, ...sampleList].find(report => report.id === id) : undefined;
  // 저장된 샘플을 열어 편집한 경우에도 샘플 상태를 영구 보존합니다.
  const sample = Boolean(data.isSample || existing?.isSample || (existing && isSampleMonthlyReport(existing)));
  const now = new Date().toISOString();
  const brandWithoutLogo = stripLogo(brand);
  const baseLabel = (label ?? existing?.label ?? `${advertiserName} ${month} 월간 보고서`).replace(/^\[테스트 샘플\]\s*/, '');
  const nextLabel = sample ? `[테스트 샘플] ${baseLabel}` : baseLabel;

  const saved: SavedMonthlyReport = existing
    ? { ...existing, advertiserName, month, data: { ...data, isSample: sample }, insights, brand: brandWithoutLogo, updatedAt: now, label: nextLabel, isSample: sample }
    : {
      id: `${sample ? 'sample-mr' : 'mr'}-${Date.now()}`,
      advertiserName,
      month,
      data: { ...data, isSample: sample },
      insights,
      brand: brandWithoutLogo,
      label: nextLabel,
      createdAt: now,
      updatedAt: now,
      isSample: sample,
    };

  if (sample) {
    const nextSamples = [saved, ...sampleList.filter(report => report.id !== saved.id)];
    if (!persist(SAMPLE_MONTHLY_REPORT_STORAGE_KEY, nextSamples)) return null;
    persist(MONTHLY_REPORT_STORAGE_KEY, actualList.filter(report => report.id !== saved.id));
  } else {
    const nextActual = [saved, ...actualList.filter(report => report.id !== saved.id)];
    if (!persist(MONTHLY_REPORT_STORAGE_KEY, nextActual)) return null;
    persist(SAMPLE_MONTHLY_REPORT_STORAGE_KEY, sampleList.filter(report => report.id !== saved.id));
  }
  return saved;
}

export function deleteMonthlyReport(id: string) {
  const actualOk = persist(MONTHLY_REPORT_STORAGE_KEY, loadActualMonthlyReports().filter(report => report.id !== id));
  const sampleOk = persist(SAMPLE_MONTHLY_REPORT_STORAGE_KEY, loadSampleMonthlyReports().filter(report => report.id !== id));
  return actualOk && sampleOk;
}

export function deleteSampleMonthlyReports(): boolean {
  migrateLegacyMonthlySampleReports();
  return persist(SAMPLE_MONTHLY_REPORT_STORAGE_KEY, []);
}

export function duplicateMonthlyReport(id: string): SavedMonthlyReport | null {
  const original = loadSavedMonthlyReports().find(report => report.id === id);
  if (!original) return null;
  const now = new Date().toISOString();
  const sample = isSampleMonthlyReport(original);
  const copy: SavedMonthlyReport = {
    ...original,
    id: `${sample ? 'sample-mr' : 'mr'}-${Date.now()}`,
    label: `${original.label} (복사본)`,
    data: { ...original.data, isSample: sample },
    isSample: sample,
    createdAt: now,
    updatedAt: now,
  };
  const target = sample ? loadSampleMonthlyReports() : loadActualMonthlyReports();
  const key = sample ? SAMPLE_MONTHLY_REPORT_STORAGE_KEY : MONTHLY_REPORT_STORAGE_KEY;
  return persist(key, [copy, ...target]) ? copy : null;
}

export function findSavedMonthlyReport(advertiserName: string, month: string): SavedMonthlyReport | null {
  // 실제 저장본이 있으면 샘플보다 항상 우선합니다.
  const actual = loadActualMonthlyReports()
    .filter(report => report.advertiserName === advertiserName && report.month === month)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (actual) return actual;
  return loadSampleMonthlyReports()
    .filter(report => report.advertiserName === advertiserName && report.month === month)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}
