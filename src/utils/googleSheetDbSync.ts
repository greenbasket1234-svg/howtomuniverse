import {
  loadDbConnections,
  replaceDbRowsForConnection,
  saveDbConnections,
  type DbDataRow,
  type GoogleSheetDbConnection,
  normalizeDbMedia,
} from './dbDataStore';

type RawRow = Record<string, unknown>;

const ALIASES = {
  date: ['날짜','일자','date','day','기준일'],
  advertiser: ['광고주','광고주명','advertiser','brand','brandname','client'],
  advertiserId: ['광고주id','advertiserid','brandid','clientid'],
  media: ['매체','채널','플랫폼','media','channel','platform'],
  accountId: ['계정id','accountid','adaccountid'],
  campaignId: ['campaignid','캠페인id','캠페인아이디'],
  campaignName: ['campaign','campaignname','캠페인','캠페인명'],
  creativeId: ['creativeid','소재id','소재아이디','adid','광고id'],
  creativeName: ['creativename','소재명','광고소재명','광고명','adname'],
  db: ['db','db수','db건수','리드','리드수','lead','leads','문의','문의수'],
  validDb: ['유효db','유효db수','유효db건수','validdb','validlead','validleads','유효리드'],
  contracts: ['계약','계약수','계약건수','contract','contracts','성사','성사수'],
  spend: ['광고비','비용','spend','cost','adspend'],
  revenue: ['매출','매출액','revenue','sales'],
  platformConversions: ['플랫폼전환','광고플랫폼전환','platformconversion','platformconversions','매체전환'],
} as const;

function keyNorm(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_.\-()\[\]\/]/g, '');
}

function pick(row: RawRow, aliases: readonly string[]) {
  const map = new Map(Object.entries(row).map(([key,value]) => [keyNorm(key), value]));
  for (const alias of aliases) if (map.has(keyNorm(alias))) return map.get(keyNorm(alias));
  return undefined;
}

function num(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? '').replace(/[,₩원%\s]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: unknown) {
  if (typeof value === 'number' && value > 25000 && value < 80000) {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(+d) ? '' : d.toISOString().slice(0,10);
  }
  const raw = String(value ?? '').trim();
  const m = raw.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;
  const d = new Date(raw);
  return raw && !Number.isNaN(+d) ? d.toISOString().slice(0,10) : '';
}

function csvToRows(text: string): RawRow[] {
  const lines: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i=0;i<text.length;i++) {
    const ch=text[i];
    if (quoted) {
      if (ch==='"' && text[i+1]==='"') { cell+='"'; i++; }
      else if (ch==='"') quoted=false;
      else cell+=ch;
    } else if (ch==='"') quoted=true;
    else if (ch===',') { row.push(cell); cell=''; }
    else if (ch==='\n') { row.push(cell.replace(/\r$/,'')); lines.push(row); row=[]; cell=''; }
    else cell+=ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/,'')); lines.push(row); }
  const [headers,...data]=lines.filter(line=>line.some(value=>value.trim()));
  if (!headers) return [];
  return data.map(values => Object.fromEntries(headers.map((header,index)=>[header, values[index] ?? ''])));
}

function responseToObjects(payload: unknown): RawRow[] {
  if (Array.isArray(payload)) {
    if (payload.length && Array.isArray(payload[0])) {
      const [headers,...data] = payload as unknown[][];
      return data.map(values => Object.fromEntries(headers.map((header,index)=>[String(header), values[index]])));
    }
    return payload.filter(value => value && typeof value === 'object') as RawRow[];
  }
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  for (const key of ['rows','data','items','records']) if (Array.isArray(obj[key])) return responseToObjects(obj[key]);
  if (Array.isArray(obj.values)) return responseToObjects(obj.values);
  return [];
}

function hash(input: string) {
  let h=2166136261;
  for (let i=0;i<input.length;i++) { h ^= input.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24); }
  return (h>>>0).toString(36);
}

export function normalizeGoogleSheetDbRows(rawRows: RawRow[], connection: GoogleSheetDbConnection): DbDataRow[] {
  const syncedAt = new Date().toISOString();
  const seen = new Map<string, DbDataRow>();
  rawRows.forEach(raw => {
    const date = dateValue(pick(raw, ALIASES.date));
    const advertiser = String(pick(raw, ALIASES.advertiser) ?? connection.advertiserFallback ?? '').trim();
    const media = normalizeDbMedia(pick(raw, ALIASES.media));
    const db = Math.max(0, num(pick(raw, ALIASES.db)));
    const validDb = Math.max(0, num(pick(raw, ALIASES.validDb)));
    const contracts = Math.max(0, num(pick(raw, ALIASES.contracts)));
    if (!date || !advertiser || media === '기타' || (!db && !validDb && !contracts)) return;
    const campaignId = String(pick(raw, ALIASES.campaignId) ?? '').trim() || undefined;
    const campaignName = String(pick(raw, ALIASES.campaignName) ?? '').trim() || undefined;
    const accountId = String(pick(raw, ALIASES.accountId) ?? '').trim() || undefined;
    const creativeId = String(pick(raw, ALIASES.creativeId) ?? '').trim() || undefined;
    const creativeName = String(pick(raw, ALIASES.creativeName) ?? '').trim() || undefined;
    const advertiserId = String(pick(raw, ALIASES.advertiserId) ?? '').trim() || undefined;
    const key = `${date}|${advertiser}|${media}|${campaignId ?? campaignName ?? ''}|${creativeId ?? creativeName ?? ''}|${accountId ?? ''}`;
    const row: DbDataRow = {
      id: `sheet-${connection.id}-${hash(key)}`, date, advertiser, advertiserId, media, accountId, campaignId, campaignName, creativeId, creativeName,
      db, validDb: validDb || 0, contracts: contracts || 0,
      spend: num(pick(raw, ALIASES.spend)) || undefined,
      revenue: num(pick(raw, ALIASES.revenue)) || undefined,
      platformConversions: num(pick(raw, ALIASES.platformConversions)) || undefined,
      sourceConnectionId: connection.id, sourceName: connection.name, syncedAt,
    };
    const previous=seen.get(key);
    if (previous) {
      previous.db += row.db; previous.validDb += row.validDb; previous.contracts += row.contracts;
      previous.spend = (previous.spend ?? 0) + (row.spend ?? 0) || undefined;
      previous.revenue = (previous.revenue ?? 0) + (row.revenue ?? 0) || undefined;
      previous.platformConversions = (previous.platformConversions ?? 0) + (row.platformConversions ?? 0) || undefined;
    } else seen.set(key,row);
  });
  return [...seen.values()];
}

export async function fetchGoogleSheetDb(connection: GoogleSheetDbConnection) {
  if (!connection.endpointUrl.trim()) throw new Error('Apps Script 웹앱 URL을 입력해 주세요.');
  const url = new URL(connection.endpointUrl.trim());
  url.searchParams.set('mode','db');
  if (connection.sheetName?.trim()) url.searchParams.set('sheet', connection.sheetName.trim());
  url.searchParams.set('_', String(Date.now()));
  const response = await fetch(url.toString(), { method:'GET', cache:'no-store', redirect:'follow' });
  if (!response.ok) throw new Error(`Google Sheets 응답 오류 (${response.status})`);
  const contentType=response.headers.get('content-type') ?? '';
  const text=await response.text();
  let rawRows: RawRow[]=[];
  if (contentType.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try { rawRows=responseToObjects(JSON.parse(text)); }
    catch { throw new Error('응답 JSON을 읽을 수 없습니다. Apps Script 응답 형식을 확인해 주세요.'); }
  } else rawRows=csvToRows(text);
  const rows=normalizeGoogleSheetDbRows(rawRows,connection);
  if (!rows.length) throw new Error('가져올 DB 집계 행이 없습니다. 날짜·광고주·매체·DB 컬럼을 확인해 주세요.');
  return rows;
}

export async function syncDbConnection(connection: GoogleSheetDbConnection) {
  try {
    const rows=await fetchGoogleSheetDb(connection);
    replaceDbRowsForConnection(connection.id, rows);
    const now=new Date().toISOString();
    const next={...connection,lastSyncAt:now,lastSyncOk:true,lastMessage:`${rows.length}개 집계 행 동기화 완료`,lastRowCount:rows.length};
    saveDbConnections(loadDbConnections().map(item=>item.id===connection.id?next:item));
    return {ok:true,rows,message:next.lastMessage,connection:next};
  } catch (error) {
    const message=error instanceof Error?error.message:'동기화 중 오류가 발생했습니다.';
    const next={...connection,lastSyncAt:new Date().toISOString(),lastSyncOk:false,lastMessage:message,lastRowCount:0};
    saveDbConnections(loadDbConnections().map(item=>item.id===connection.id?next:item));
    return {ok:false,rows:[] as DbDataRow[],message,connection:next};
  }
}

export async function syncAllDbConnections() {
  const enabled=loadDbConnections().filter(item=>item.enabled);
  const results=[];
  for (const connection of enabled) results.push(await syncDbConnection(connection));
  return results;
}

export async function runAutoDbSyncIfDue() {
  const now=Date.now();
  const connections=loadDbConnections().filter(item=>item.enabled&&item.autoSync);
  for (const connection of connections) {
    const last=connection.lastSyncAt ? +new Date(connection.lastSyncAt) : 0;
    const interval=Math.max(15,connection.syncIntervalMinutes||60)*60_000;
    if (!last || now-last>=interval) await syncDbConnection(connection);
  }
}
