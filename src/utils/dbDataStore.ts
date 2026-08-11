export type DbMedia = '메타'|'네이버'|'구글 검색'|'유튜브'|'당근'|'카카오'|'틱톡'|'기타';

export type DbDataRow = {
  id: string;
  date: string;
  advertiser: string;
  advertiserId?: string;
  media: DbMedia;
  accountId?: string;
  campaignId?: string;
  campaignName?: string;
  creativeId?: string;
  creativeName?: string;
  db: number;
  validDb: number;
  contracts: number;
  spend?: number;
  revenue?: number;
  platformConversions?: number;
  sourceConnectionId: string;
  sourceName: string;
  syncedAt: string;
};

export type GoogleSheetDbConnection = {
  id: string;
  name: string;
  endpointUrl: string;
  sheetName?: string;
  advertiserFallback?: string;
  enabled: boolean;
  autoSync: boolean;
  syncIntervalMinutes: number;
  lastSyncAt?: string;
  lastSyncOk?: boolean;
  lastMessage?: string;
  lastRowCount?: number;
};

export const DB_ROWS_STORAGE_KEY = 'howtom-db-data-v2';
export const DB_CONNECTIONS_STORAGE_KEY = 'howtom-db-connections-v2';
export const DB_DATA_EVENT = 'howtom-db-data-updated';
export const DB_CONNECTION_EVENT = 'howtom-db-connections-updated';

export function normalizeDbMedia(input: unknown): DbMedia {
  const raw = String(input ?? '').trim();
  const v = raw.toLowerCase().replace(/\s+/g, '');
  if (['meta','facebook','instagram','페이스북','인스타그램','메타'].includes(v)) return '메타';
  if (['naver','네이버','gfa','네이버검색','네이버검색광고'].includes(v)) return '네이버';
  if (['google','googleads','googlesa','구글','구글검색','구글검색광고'].includes(v)) return '구글 검색';
  if (['youtube','youtubeads','유튜브','유튜브광고'].includes(v)) return '유튜브';
  if (['danggeun','karrot','당근','당근마켓'].includes(v)) return '당근';
  if (['kakao','카카오','카카오모먼트','카카오키워드'].includes(v)) return '카카오';
  if (['tiktok','틱톡'].includes(v)) return '틱톡';
  return '기타';
}

export function loadDbRows(): DbDataRow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DB_ROWS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch { return []; }
}

export function saveDbRows(rows: DbDataRow[]) {
  localStorage.setItem(DB_ROWS_STORAGE_KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent(DB_DATA_EVENT, { detail: { count: rows.length } }));
}

export function replaceDbRowsForConnection(connectionId: string, rows: DbDataRow[]) {
  const existing = loadDbRows().filter(row => row.sourceConnectionId !== connectionId);
  saveDbRows([...rows, ...existing].sort((a,b) => b.date.localeCompare(a.date) || a.advertiser.localeCompare(b.advertiser, 'ko')));
}

export function deleteDbRowsForConnection(connectionId: string) {
  saveDbRows(loadDbRows().filter(row => row.sourceConnectionId !== connectionId));
}

export function loadDbConnections(): GoogleSheetDbConnection[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DB_CONNECTIONS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean).map((item: GoogleSheetDbConnection) => ({
      ...item,
      enabled: item.enabled !== false,
      autoSync: Boolean(item.autoSync),
      syncIntervalMinutes: Math.max(15, Number(item.syncIntervalMinutes) || 60),
    })) : [];
  } catch { return []; }
}

export function saveDbConnections(connections: GoogleSheetDbConnection[]) {
  localStorage.setItem(DB_CONNECTIONS_STORAGE_KEY, JSON.stringify(connections));
  window.dispatchEvent(new CustomEvent(DB_CONNECTION_EVENT, { detail: { count: connections.length } }));
}

export function updateDbConnection(id: string, patch: Partial<GoogleSheetDbConnection>) {
  const next = loadDbConnections().map(item => item.id === id ? { ...item, ...patch } : item);
  saveDbConnections(next);
  return next.find(item => item.id === id);
}

export function dbRowsForFilter(rows: DbDataRow[], advertiser = '', media = '', from = '', to = '') {
  return rows.filter(row =>
    (!advertiser || row.advertiser === advertiser) &&
    (!media || row.media === media) &&
    (!from || row.date >= from) &&
    (!to || row.date <= to)
  );
}

export function summarizeDbRows(rows: DbDataRow[]) {
  return rows.reduce((acc, row) => {
    acc.db += Number(row.db) || 0;
    acc.validDb += Number(row.validDb) || 0;
    acc.contracts += Number(row.contracts) || 0;
    acc.spend += Number(row.spend) || 0;
    acc.revenue += Number(row.revenue) || 0;
    acc.platformConversions += Number(row.platformConversions) || 0;
    return acc;
  }, { db:0, validDb:0, contracts:0, spend:0, revenue:0, platformConversions:0 });
}
