export const REPORT_INTEGRATION_STORAGE_KEY = 'adcc-report-integrations-v1';
export const REPORT_INTEGRATION_EVENT = 'adcc-report-integrations-updated';

export type ReportIntegrationSettings = {
  googleSheets: {
    enabled: boolean;
    webhookUrl: string;
    spreadsheetId: string;
    sheetName: string;
    autoSync: boolean;
  };
  notion: {
    enabled: boolean;
    webhookUrl: string;
    dataSourceId: string;
    autoSync: boolean;
  };
  pdf: {
    enabled: boolean;
    autoGenerate: boolean;
    landscape: boolean;
    includeCover: boolean;
    fileNameTemplate: string;
  };
};

export const DEFAULT_REPORT_INTEGRATION_SETTINGS: ReportIntegrationSettings = {
  googleSheets: {
    enabled: false,
    webhookUrl: '',
    spreadsheetId: '',
    sheetName: '일일보고',
    autoSync: false,
  },
  notion: {
    enabled: false,
    webhookUrl: '',
    dataSourceId: '',
    autoSync: false,
  },
  pdf: {
    enabled: true,
    autoGenerate: false,
    landscape: true,
    includeCover: true,
    fileNameTemplate: '{광고주}_{기간}_일일보고',
  },
};

export function loadReportIntegrationSettings(): ReportIntegrationSettings {
  try {
    const raw = localStorage.getItem(REPORT_INTEGRATION_STORAGE_KEY);
    if (!raw) return DEFAULT_REPORT_INTEGRATION_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      googleSheets: { ...DEFAULT_REPORT_INTEGRATION_SETTINGS.googleSheets, ...(parsed.googleSheets ?? {}) },
      notion: { ...DEFAULT_REPORT_INTEGRATION_SETTINGS.notion, ...(parsed.notion ?? {}) },
      pdf: { ...DEFAULT_REPORT_INTEGRATION_SETTINGS.pdf, ...(parsed.pdf ?? {}) },
    };
  } catch {
    return DEFAULT_REPORT_INTEGRATION_SETTINGS;
  }
}

export function saveReportIntegrationSettings(settings: ReportIntegrationSettings) {
  localStorage.setItem(REPORT_INTEGRATION_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(REPORT_INTEGRATION_EVENT));
}
