export type ReportBrandSettings = {
  logoUrl: string;
  brandColor: string;
  companyName: string;
  managerName: string;
  coverMessage: string;
};

const STORAGE_KEY = 'adcc-monthly-report-brand-v1';
const DEFAULT_SETTINGS: ReportBrandSettings = { logoUrl: '', brandColor: '#2563eb', companyName: '하우투엠', managerName: '', coverMessage: '' };

function loadAll(): Record<string, ReportBrandSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

export function loadBrandSettings(advertiserName: string): ReportBrandSettings {
  const all = loadAll();
  return { ...DEFAULT_SETTINGS, ...(all[advertiserName] ?? {}) };
}

export function saveBrandSettings(advertiserName: string, settings: ReportBrandSettings): boolean {
  const all = loadAll();
  all[advertiserName] = settings;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); return true; } catch { return false; }
}
