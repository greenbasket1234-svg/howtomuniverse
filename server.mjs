import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// 요청 처리 중 예상하지 못한 예외가 있어도 서버 프로세스 전체가 죽지 않도록 최상위
// 안전장치를 둡니다. 개별 요청 핸들러에서 이미 잡히지 않은 예외만 여기서 잡습니다.
process.on('uncaughtException', (error) => {
  console.error('[안내] 처리되지 않은 오류가 있었지만 서버는 계속 실행됩니다:', error?.message || error);
});
process.on('unhandledRejection', (reason) => {
  console.error('[안내] 처리되지 않은 Promise 오류가 있었지만 서버는 계속 실행됩니다:', reason);
});

const baseDir = path.dirname(fileURLToPath(import.meta.url));

// 로컬 개발 편의를 위해 .env 파일이 있으면 읽어서 process.env에 채워 넣습니다. 이미 실제
// 환경(Railway Variables 등)에 설정된 값은 덮어쓰지 않습니다 - 배포 환경에는 보통 .env
// 파일 자체가 없으므로 이 블록은 아무 영향이 없고, 로컬에서만 의미가 있습니다.
try {
  const envPath = path.join(baseDir, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key && !(key in process.env)) process.env[key] = value;
    }
  }
} catch (error) {
  console.error('[안내] .env 파일을 읽는 중 문제가 있었지만 서버는 계속 실행됩니다:', error?.message || error);
}

const root = path.join(baseDir, 'dist');
const port = Number(process.env.PORT || 5173);
const isPublicRuntime = process.env.NODE_ENV === 'production'
  || Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json; charset=utf-8' };


/* ========================================================================
   HOWTOM 최소 백엔드 저장소
   -----------------------------------------------------------------------
   - 초기값은 완전한 Zero State입니다. 샘플/시드 데이터는 넣지 않습니다.
   - Railway에서는 Volume을 /data 등에 마운트하고 HOWTOM_DATA_DIR=/data 로
     지정하면 재배포/재시작 후에도 데이터가 유지됩니다.
   - Volume이 없으면 프로젝트의 .data/howtom-db.json에 저장됩니다.
   ======================================================================== */
const DATA_DIR = process.env.HOWTOM_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(baseDir, '.data');
const DB_FILE = path.join(DATA_DIR, 'howtom-db.json');
const EMPTY_DB = Object.freeze({ advertisers: [], blogProjects: [], blogStyles: [], blogAssets: [], logs: [], dailyMetrics: [], creativeMetrics: [], keywordMetrics: [], scheduleSlots: [] });

function ensureDbFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
}
function readDb() {
  ensureDbFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return {
      advertisers: Array.isArray(parsed.advertisers) ? parsed.advertisers : [],
      blogProjects: Array.isArray(parsed.blogProjects) ? parsed.blogProjects : [],
      blogStyles: Array.isArray(parsed.blogStyles) ? parsed.blogStyles : [],
      blogAssets: Array.isArray(parsed.blogAssets) ? parsed.blogAssets : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      dailyMetrics: Array.isArray(parsed.dailyMetrics) ? parsed.dailyMetrics : [],
      creativeMetrics: Array.isArray(parsed.creativeMetrics) ? parsed.creativeMetrics : [],
      keywordMetrics: Array.isArray(parsed.keywordMetrics) ? parsed.keywordMetrics : [],
      scheduleSlots: Array.isArray(parsed.scheduleSlots) ? parsed.scheduleSlots : [],
    };
  } catch {
    return { advertisers: [], blogProjects: [], blogStyles: [], blogAssets: [], logs: [], dailyMetrics: [], creativeMetrics: [], keywordMetrics: [], scheduleSlots: [] };
  }
}
function writeDb(next) {
  ensureDbFile();
  const temp = `${DB_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(temp, DB_FILE);
}
function mutateDb(mutator) {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
  return result;
}
function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
/** 접속/보안 기록(로그인 성공·실패 등)을 DB에 남깁니다. 최근 500건만 보관합니다. */
function addLog(entry) {
  mutateDb(db => {
    const row = { id: makeId('log'), createdAt: new Date().toISOString(), ...entry };
    db.logs = [row, ...db.logs].slice(0, 500);
  });
}
function cleanText(value, max = 5000) {
  return String(value ?? '').trim().slice(0, max);
}
function isAuthorizedRequest(req) {
  return Boolean(verifyToken(bearerToken(req)));
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function sendJson(res, status, payload) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

/* ========================================================================
   인증 백엔드 (JWT, 외부 패키지 없이 node:crypto만 사용)
   -----------------------------------------------------------------------
   - 관리자 1계정 로그인용 최소 구현입니다. 광고주별 다중 계정·DB 연동이
     필요해지면 이 부분을 실제 사용자 테이블(Postgres 등)로 교체하세요.
   - 비밀번호는 코드에 넣지 않고 Railway 환경변수로만 주입합니다.
     HOWTOM_ADMIN_EMAIL, HOWTOM_ADMIN_PASSWORD, JWT_SECRET 3개가 필요합니다.
   ======================================================================== */
const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_EMAIL = process.env.HOWTOM_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.HOWTOM_ADMIN_PASSWORD || '';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7일

/* ========================================================================
   Meta(Facebook/Instagram) 광고 API 연동
   -----------------------------------------------------------------------
   - META_ACCESS_TOKEN 은 Business Manager의 System User Access Token입니다.
   - 이 토큰은 반드시 Railway Variables로만 주입하고, 코드/깃 저장소에는 절대
     직접 적지 않습니다.
   ======================================================================== */
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

function metaConfigured() {
  return Boolean(META_ACCESS_TOKEN);
}

async function metaGraphGet(path, params = {}) {
  if (!META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN이 설정되지 않았습니다.');
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('access_token', META_ACCESS_TOKEN);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.error) {
    const message = data?.error?.message || `Meta API HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

/** System User Access Token에 연결된(자산 할당된) 광고 계정 목록을 가져옵니다. */
async function metaListAdAccounts() {
  const data = await metaGraphGet('/me/adaccounts', {
    fields: 'id,account_id,name,account_status,currency,timezone_name',
    limit: '200',
  });
  return Array.isArray(data.data) ? data.data : [];
}

/**
 * 광고 계정의 특정 기간 인사이트(노출/클릭/광고비/전환)를 가져옵니다.
 * accountId는 'act_XXXXXXXXX' 형식이어야 합니다.
 */
/** 광고 계정의 캠페인 목록(이름/상태/예산)을 가져옵니다. */
async function metaListCampaigns(accountId) {
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const data = await metaGraphGet(`/${id}/campaigns`, {
    fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time',
    limit: '200',
  });
  return Array.isArray(data.data) ? data.data : [];
}

function metaCampaignStatus(effectiveStatus) {
  if (effectiveStatus === 'ACTIVE') return 'on';
  if (effectiveStatus === 'PAUSED') return 'off';
  if (effectiveStatus === 'IN_PROCESS' || effectiveStatus === 'PENDING_REVIEW') return 'review';
  if (effectiveStatus === 'CAMPAIGN_PAUSED' || effectiveStatus === 'ADSET_PAUSED') return 'off';
  return 'scheduled';
}

// Meta는 구매/리드 하나를 omni_purchase, purchase, offsite_conversion.fb_pixel_purchase 등
// 여러 action_type으로 "중복"해서 돌려줍니다. 전부 더하면 실제보다 부풀려집니다(광고 관리자
// 화면 값과 안 맞음). 반드시 우선순위상 "하나만" 골라 씁니다 — 절대 합산하지 않습니다.
const PURCHASE_ACTION_PRIORITY = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'];
const LEAD_ACTION_PRIORITY = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'];
function pickAction(list, priorityTypes) {
  for (const type of priorityTypes) {
    const match = (list || []).find(a => a.action_type === type);
    if (match) return Number(match.value || 0);
  }
  return 0;
}

async function metaFetchInsights(accountId, since, until) {
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  // 기간이 길면(예: 90일) Meta가 결과를 여러 페이지로 나눠서 줍니다.
  // limit을 넉넉히 주고, 그래도 다음 페이지(paging.next)가 있으면 끝까지 따라가서 다 가져옵니다.
  let rows = [];
  let after;
  for (let page = 0; page < 20; page++) { // 최대 20페이지(=대략 2000일치)까지 안전장치
    const data = await metaGraphGet(`/${id}/insights`, {
      time_range: JSON.stringify({ since, until }),
      fields: 'impressions,clicks,spend,actions,action_values,date_start,date_stop',
      time_increment: '1', // 날짜별로 쪼개서 반환
      level: 'account',
      limit: '100',
      ...(after ? { after } : {}),
    });
    rows = rows.concat(Array.isArray(data.data) ? data.data : []);
    after = data.paging?.cursors?.after;
    if (!after || !data.paging?.next) break;
  }
  return rows.map(row => ({
    date: row.date_start,
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    spend: Number(row.spend || 0),
    dbCount: pickAction(row.actions, LEAD_ACTION_PRIORITY),
    // 구매 건수는 actions(횟수), 구매 전환값(매출)은 action_values(금액)에서 가져옵니다.
    purchases: pickAction(row.actions, PURCHASE_ACTION_PRIORITY),
    revenue: pickAction(row.action_values, PURCHASE_ACTION_PRIORITY),
  }));
}

/** 광고(소재) 단위 인사이트를 가져옵니다. 기간 전체 합산값 하나씩 돌려줍니다. */
async function metaFetchAdInsights(accountId, since, until) {
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const data = await metaGraphGet(`/${id}/insights`, {
    time_range: JSON.stringify({ since, until }),
    fields: 'ad_id,ad_name,campaign_name,impressions,clicks,spend,actions,action_values',
    level: 'ad',
    limit: '500',
  });
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(row => ({
    adId: row.ad_id, adName: row.ad_name || '(이름 없음)', campaignName: row.campaign_name || '',
    impressions: Number(row.impressions || 0), clicks: Number(row.clicks || 0), spend: Number(row.spend || 0),
    dbCount: pickAction(row.actions, LEAD_ACTION_PRIORITY), revenue: pickAction(row.action_values, PURCHASE_ACTION_PRIORITY),
  }));
}

/** 광고 ID 목록으로 실제 소재 썸네일(이미지/영상) URL을 가져옵니다. */
async function metaFetchAdCreativeThumbnails(adIds) {
  const result = {};
  const chunkSize = 50; // 한 번에 너무 많은 ID를 요청하지 않도록 나눕니다.
  for (let i = 0; i < adIds.length; i += chunkSize) {
    const chunk = adIds.slice(i, i + chunkSize).filter(Boolean);
    if (!chunk.length) continue;
    try {
      const data = await metaGraphGet('/', { ids: chunk.join(','), fields: 'creative{image_url,thumbnail_url,video_id,object_type,title,body,call_to_action_type,object_story_spec}', thumbnail_width: '1080', thumbnail_height: '1080' });
      for (const id of chunk) {
        const creative = data?.[id]?.creative;
        if (!creative) continue;
        const linkData = creative.object_story_spec?.link_data || creative.object_story_spec?.video_data || {};
        result[id] = {
          thumbnailUrl: creative.image_url || creative.thumbnail_url || null,
          mediaType: creative.video_id ? 'video' : 'image',
          title: creative.title || linkData.name || '',
          body: creative.body || linkData.message || '',
          cta: creative.call_to_action_type || linkData.call_to_action?.type || '',
        };
      }
    } catch { /* 썸네일 조회 실패는 조용히 넘어갑니다 - 성과 데이터 자체는 그대로 유지합니다. */ }
  }
  return result;
}

/** 검색광고 키워드 단위 인사이트 — 지금은 구현된 매체가 없어 항상 빈 배열입니다.
    네이버/구글/카카오 검색광고 커넥터가 추가되면 이 함수들이 실제 데이터를 반환하게 됩니다. */
async function naverFetchKeywordMetrics(credentials, since, until) {
  const campaigns = await naverFetchCampaigns(credentials);
  const campaignIds = campaigns.map(c => c.nccCampaignId).filter(Boolean);
  if (!campaignIds.length) return [];
  const campaignNameMap = new Map(campaigns.map(c => [c.nccCampaignId, c.name]));

  // 캠페인 → 광고그룹 → 키워드 순으로 마스터 데이터를 모읍니다.
  const adgroups = [];
  for (const cid of campaignIds) {
    const rows = await naverApiRequest('GET', '/ncc/adgroups', { nccCampaignId: cid }, credentials).catch(() => []);
    if (Array.isArray(rows)) adgroups.push(...rows);
    await new Promise(r => setTimeout(r, 300));
  }
  const adgroupCampaignMap = new Map(adgroups.map(a => [a.nccAdgroupId, a.nccCampaignId]));

  const keywords = [];
  for (const agid of adgroups.map(a => a.nccAdgroupId).filter(Boolean)) {
    const rows = await naverApiRequest('GET', '/ncc/keywords', { nccAdgroupId: agid }, credentials).catch(() => []);
    if (Array.isArray(rows)) keywords.push(...rows);
    await new Promise(r => setTimeout(r, 300));
  }
  const keywordIds = keywords.map(k => k.nccKeywordId).filter(Boolean).slice(0, 300); // 한 계정에서 너무 많으면 동기화가 오래 걸려 상위 300개로 제한합니다.
  if (!keywordIds.length) return [];
  const keywordNameMap = new Map(keywords.map(k => [k.nccKeywordId, k.keyword]));
  const keywordAdgroupMap = new Map(keywords.map(k => [k.nccKeywordId, k.nccAdgroupId]));

  const byKeyword = new Map();
  for (const range of splitIntoChunks(since, until, 90)) {
    for (let i = 0; i < keywordIds.length; i += 100) {
      const chunk = keywordIds.slice(i, i + 100);
      let data = await naverApiRequest('GET', '/stats', {
        ids: chunk,
        fields: JSON.stringify(['impCnt', 'clkCnt', 'salesAmt', 'ccnt']),
        timeRange: JSON.stringify({ since: range.since, until: range.until }),
      }, credentials).catch(() => null);
      if (!data) {
        // ccnt(전환) 필드가 이 계정에서 지원되지 않을 수 있어, 기본 필드로 한 번 더 시도합니다.
        data = await naverApiRequest('GET', '/stats', {
          ids: chunk,
          fields: JSON.stringify(['impCnt', 'clkCnt', 'salesAmt']),
          timeRange: JSON.stringify({ since: range.since, until: range.until }),
        }, credentials).catch(() => null);
      }
      const rows = Array.isArray(data?.data) ? data.data : [];
      for (const row of rows) {
        const kid = row.id;
        const cur = byKeyword.get(kid) || { impressions: 0, clicks: 0, spend: 0, dbCount: 0 };
        cur.impressions += Number(row.impCnt || 0);
        cur.clicks += Number(row.clkCnt || 0);
        cur.spend += Number(row.salesAmt || 0);
        cur.dbCount += Number(row.ccnt || 0);
        byKeyword.set(kid, cur);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return Array.from(byKeyword.entries()).map(([kid, v]) => {
    const agid = keywordAdgroupMap.get(kid);
    const cid = adgroupCampaignMap.get(agid);
    return { keyword: keywordNameMap.get(kid) || kid, campaignName: campaignNameMap.get(cid) || '', ...v };
  });
}
/** 구글/카카오처럼 아직 커넥터가 없는 매체는 항상 빈 배열입니다. */
async function fetchKeywordMetrics(channel, _accountId, _since, _until) {
  void channel;
  return [];
}
const KEYWORD_CAPABLE_CHANNELS = ['naver', 'google', 'kakao']; // Meta는 키워드 개념이 없어 제외

/* ========================================================================
   네이버 검색광고 API 연동
   -----------------------------------------------------------------------
   Meta와 달리, 네이버는 광고주마다 CUSTOMER_ID/API Key/Secret Key가 전부 다릅니다
   (대행사 계정 하나로 여러 광고주를 조회하는 구조가 아님). 그래서 이 값들은
   Railway 환경변수가 아니라 광고주별로 DB(advertisers[].accounts[])에 저장합니다.
   인증은 OAuth 토큰이 아니라 매 요청마다 HMAC-SHA256 서명을 직접 만들어 보냅니다.
   ======================================================================== */
const NAVER_API_BASE = 'https://api.searchad.naver.com';

function naverSignature(timestamp, method, uri, secretKey) {
  const message = `${timestamp}.${method}.${uri}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

async function naverApiRequestOnce(method, uri, params, credentials) {
  const { customerId, apiKey, secretKey } = credentials;
  const timestamp = String(Date.now());
  const signature = naverSignature(timestamp, method, uri, secretKey);
  const url = new URL(`${NAVER_API_BASE}${uri}`);
  if (method === 'GET') {
    for (const [key, value] of Object.entries(params || {})) {
      // ids처럼 배열 값은 JSON 문자열 하나가 아니라, 같은 이름의 파라미터를 여러 개
      // 반복해서 보내야 합니다 (예: ?ids=A&ids=B). fields/timeRange 같은 JSON 문자열은 그대로 둡니다.
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, v);
      } else {
        url.searchParams.set(key, value);
      }
    }
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'X-Timestamp': timestamp,
      'X-API-KEY': apiKey,
      'X-Customer': String(customerId),
      'X-Signature': signature,
      'Content-Type': 'application/json; charset=UTF-8',
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // 비밀키는 로그에 남기지 않고, 진단에 필요한 나머지 정보만 서버 콘솔에 남깁니다.
    console.error('[naver-api-error]', {
      uri, status: res.status, serverTime: timestamp, customerId,
      apiKeyPrefix: apiKey ? apiKey.slice(0, 8) : null,
      naverResponse: data,
    });
    const err = new Error(`${data?.title || data?.message || `Naver API HTTP ${res.status}`}${data?.code ? ` (code: ${data.code})` : ''} · status ${res.status}`);
    err.naverCode = data?.code;
    err.httpStatus = res.status;
    throw err;
  }
  return data;
}

/**
 * 네이버 stats API는 파라미터가 정확해도 간헐적으로(네이버 측에서도 인지하고 있는 불안정 이슈)
 * code 11001("잘못된 파라미터 형식입니다")을 랜덤하게 반환하는 경우가 있습니다.
 * (naver/searchad-apidoc GitHub 이슈 #1295, #1300 등에서 동일 증상 다수 보고됨)
 * 그래서 이 코드가 뜨면 잠깐 대기 후 최대 3번까지 자동으로 재시도합니다.
 */
async function naverApiRequest(method, uri, params, credentials, attempt = 1) {
  try {
    return await naverApiRequestOnce(method, uri, params, credentials);
  } catch (error) {
    const retryable = error.naverCode === 11001 || (error.httpStatus >= 500);
    if (retryable && attempt < 3) {
      await new Promise(r => setTimeout(r, 800 * attempt));
      return naverApiRequest(method, uri, params, credentials, attempt + 1);
    }
    throw error;
  }
}

async function naverFetchCampaigns(credentials) {
  const data = await naverApiRequest('GET', '/ncc/campaigns', {}, credentials);
  return Array.isArray(data) ? data : [];
}

/** 92일 제한이 있어 기간을 나눠서 요청합니다. */
function splitIntoChunks(since, until, maxDays) {
  const chunks = [];
  let start = new Date(`${since}T00:00:00`);
  const end = new Date(`${until}T00:00:00`);
  while (start <= end) {
    const chunkEnd = new Date(start);
    chunkEnd.setDate(chunkEnd.getDate() + maxDays - 1);
    const actualEnd = chunkEnd > end ? end : chunkEnd;
    chunks.push({ since: start.toISOString().slice(0, 10), until: actualEnd.toISOString().slice(0, 10) });
    start = new Date(actualEnd); start.setDate(start.getDate() + 1);
  }
  return chunks;
}

/** 계정(고객) 전체의 일별 성과를 캠페인 단위로 조회해 날짜별로 합산합니다. */
async function naverFetchDailyMetrics(credentials, since, until) {
  const campaigns = await naverFetchCampaigns(credentials);
  const campaignIds = campaigns.map(c => c.nccCampaignId).filter(Boolean);
  if (!campaignIds.length) return [];

  // 전환 추적(구매 매출)이 설정 안 된 계정은 convAmt/ccnt 필드 요청 자체를 거부하는 경우가 있어서,
  // 전체 필드로 먼저 시도하고 실패하면 기본 필드(노출/클릭/광고비)만으로 다시 시도합니다.
  const FULL_FIELDS = ['impCnt', 'clkCnt', 'salesAmt', 'ccnt', 'convAmt'];
  const BASIC_FIELDS = ['impCnt', 'clkCnt', 'salesAmt'];
  let fields = FULL_FIELDS;

  const byDate = new Map();
  for (const range of splitIntoChunks(since, until, 90)) {
    let data;
    try {
      data = await naverApiRequest('GET', '/stats', {
        ids: campaignIds,
        fields: JSON.stringify(fields),
        timeRange: JSON.stringify({ since: range.since, until: range.until }),
        timeIncrement: '1',
      }, credentials);
    } catch (error) {
      if (fields === FULL_FIELDS) {
        // 매출/전환 필드가 이 계정에서 지원되지 않는 것으로 보고, 기본 필드로 다시 시도합니다.
        fields = BASIC_FIELDS;
        data = await naverApiRequest('GET', '/stats', {
          ids: campaignIds,
          fields: JSON.stringify(fields),
          timeRange: JSON.stringify({ since: range.since, until: range.until }),
          timeIncrement: '1',
        }, credentials);
      } else {
        throw error;
      }
    }
    const rows = Array.isArray(data?.data) ? data.data : [];
    for (const row of rows) {
      const date = row.dateStart || row.date;
      if (!date) continue;
      const cur = byDate.get(date) || { impressions: 0, clicks: 0, spend: 0, dbCount: 0, revenue: 0 };
      cur.impressions += Number(row.impCnt || 0);
      cur.clicks += Number(row.clkCnt || 0);
      cur.spend += Number(row.salesAmt || 0);
      cur.dbCount += Number(row.ccnt || 0);
      cur.revenue += Number(row.convAmt || 0);
      byDate.set(date, cur);
    }
    await new Promise(r => setTimeout(r, 500)); // 네이버 API 호출 간 간격을 둡니다.
  }
  return Array.from(byDate.entries()).map(([date, v]) => ({ date, ...v }));
}

/* ========================================================================
   블로그 원고 작성 — 외부 AI API 연동
   -----------------------------------------------------------------------
   - BLOG_AI_PROVIDER 가 설정되어 있지 않으면(기본값) 규칙 기반 초안으로 동작합니다.
   - 'anthropic' | 'openai' | 'custom' 중 하나로 설정하면 실제 외부 AI가 제목/본문을 생성합니다.
   - custom은 BLOG_AI_API_URL 로 { systemPrompt, userPrompt, brief } 를 POST하고
     { titles: string[], blocks: {type,title,text}[] } 형태의 JSON을 그대로 돌려주는
     사내/외부 엔드포인트를 붙일 때 사용합니다.
   ======================================================================== */
const BLOG_AI_PROVIDER = (process.env.BLOG_AI_PROVIDER || '').trim().toLowerCase();
const BLOG_AI_API_KEY = process.env.BLOG_AI_API_KEY || '';
const BLOG_AI_API_URL = process.env.BLOG_AI_API_URL || '';
const BLOG_AI_MODEL = process.env.BLOG_AI_MODEL || '';

function blogAiConfigured() {
  if (BLOG_AI_PROVIDER === 'anthropic' || BLOG_AI_PROVIDER === 'openai') return Boolean(BLOG_AI_API_KEY);
  if (BLOG_AI_PROVIDER === 'custom') return Boolean(BLOG_AI_API_URL);
  return false;
}

function blogAiStatus() {
  return {
    configured: blogAiConfigured(),
    provider: BLOG_AI_PROVIDER || null,
  };
}

function parseAiJson(text) {
  const cleaned = String(text ?? '').replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch { throw new Error('AI 응답을 JSON으로 해석할 수 없습니다.'); }
  if (!Array.isArray(parsed.titles) || !Array.isArray(parsed.blocks)) {
    throw new Error('AI 응답 형식이 올바르지 않습니다. (titles, blocks 필요)');
  }
  return {
    titles: parsed.titles.slice(0, 5).map(t => cleanText(String(t), 200)),
    blocks: parsed.blocks.slice(0, 10).map(b => ({
      blockId: makeId('block'),
      type: cleanText(String(b?.type || 'paragraph'), 20),
      title: cleanText(String(b?.title || ''), 200),
      text: cleanText(String(b?.text || ''), 4000),
    })),
  };
}

function buildBlogAiPrompts(brief) {
  const system = `당신은 ${brief.industry || '업종 무관'} 업종 광고주를 위한 ${brief.platform || '블로그'} 원고를 쓰는 전문 카피라이터입니다.
과장·단정 표현, 치료효과 단정, 비교·비방 표현은 피하고 확인 가능한 사실 중심으로 작성합니다.
반드시 아래 JSON 형식으로만 응답하세요. 그 외 설명 문장이나 코드블록 표시(\`\`\`)는 절대 포함하지 마세요.
{"titles": ["제목1", "제목2", "제목3"], "blocks": [{"type": "paragraph|h2|faq|cta", "title": "블록 제목", "text": "본문"}]}
blocks는 도입 1개, 핵심정보 h2 1개 이상, 확인사항 h2 1개, FAQ 1개, CTA 1개를 포함해 5~7개로 구성하세요.`;
  const user = `광고주명: ${brief.advertiser}
업종: ${brief.industry || '미지정'}
플랫폼: ${brief.platform || '미지정'}
콘텐츠 유형: ${brief.contentType || '정보형'}
메인 키워드: ${brief.keyword}
서브 키워드: ${(brief.secondaryKeywords || []).join(', ') || '없음'}
지역: ${brief.region || '없음'}
목표 글자 수: 약 ${brief.targetLength || 2000}자
톤앤매너: ${brief.tone || '자연스러운 정보 전달형'}
선호 표현: ${(brief.preferredPhrases || []).join(', ') || '없음'}
금지 표현: ${(brief.prohibitedPhrases || []).join(', ') || '없음'}
CTA에 포함할 연락처/문구: ${brief.cta || '공식 채널 안내'}`;
  return { system, user };
}

async function callExternalBlogAi(brief) {
  const { system, user } = buildBlogAiPrompts(brief);

  if (BLOG_AI_PROVIDER === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': BLOG_AI_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: BLOG_AI_MODEL || 'claude-sonnet-4-6',
        max_tokens: 2200,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Anthropic API HTTP ${res.status}`);
    const text = Array.isArray(data.content) ? data.content.map(b => b.text || '').join('') : '';
    return parseAiJson(text);
  }

  if (BLOG_AI_PROVIDER === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${BLOG_AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: BLOG_AI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `OpenAI API HTTP ${res.status}`);
    const text = data?.choices?.[0]?.message?.content || '';
    return parseAiJson(text);
  }

  if (BLOG_AI_PROVIDER === 'custom') {
    const res = await fetch(BLOG_AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt: system, userPrompt: user, brief }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `외부 AI API HTTP ${res.status}`);
    if (Array.isArray(data.titles) && Array.isArray(data.blocks)) {
      return {
        titles: data.titles.slice(0, 5).map(t => cleanText(String(t), 200)),
        blocks: data.blocks.slice(0, 10).map(b => ({ blockId: makeId('block'), type: cleanText(String(b?.type || 'paragraph'), 20), title: cleanText(String(b?.title || ''), 200), text: cleanText(String(b?.text || ''), 4000) })),
      };
    }
    return parseAiJson(JSON.stringify(data));
  }

  throw new Error('BLOG_AI_PROVIDER가 설정되지 않았습니다.');
}

function ruleBasedBlogDraft(keyword, advertiser, region, advertiserRow) {
  const prefix = region ? `${region} ${keyword}` : keyword;
  const titles = [`${prefix}, 꼭 알아야 할 핵심 정보`, `${keyword} 알아보기: 증상·원인·관리 방법`, `${advertiser}가 알려드리는 ${keyword} 체크포인트`];
  const blocks = [
    { blockId: makeId('block'), type: 'paragraph', title: '도입', text: `${keyword}에 대해 궁금해하는 분들이 확인하면 좋은 기본 정보를 정리했습니다. 상황에 따라 필요한 판단이 달라질 수 있으므로 아래 내용을 참고해 주세요.` },
    { blockId: makeId('block'), type: 'h2', title: `${keyword} 핵심 정보`, text: `${keyword}의 의미와 확인해야 할 핵심 포인트를 설명하는 영역입니다. 실제 발행 전 광고주 고유 정보와 객관적인 근거를 추가해 주세요.` },
    { blockId: makeId('block'), type: 'h2', title: '확인해야 할 사항', text: `대상과 상황에 따라 고려할 사항이 달라질 수 있습니다. 과장된 단정 표현보다 확인 가능한 사실과 조건을 중심으로 작성하는 것이 좋습니다.` },
    { blockId: makeId('block'), type: 'faq', title: '자주 묻는 질문', text: `${keyword}에 대해 자주 묻는 질문과 답변을 광고주 기준에 맞게 추가해 주세요.` },
    { blockId: makeId('block'), type: 'cta', title: '안내', text: `${advertiser}의 공식 안내 채널${advertiserRow?.phone ? `(${advertiserRow.phone})` : ''}에서 자세한 내용을 확인해 주세요.` },
  ];
  return { titles, blocks };
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlDecode(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(input.length + ((4 - (input.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  let payload;
  try { payload = JSON.parse(base64urlDecode(body)); } catch { return null; }
  if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) {
    // 길이가 다르면 항상 false지만, 타이밍 공격 방지를 위해 같은 길이의 더미 비교를 한 번 수행합니다.
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

const ADMIN_USER = {
  id: 1,
  email: ADMIN_EMAIL,
  name: process.env.HOWTOM_ADMIN_NAME || '관리자',
  nickname: process.env.HOWTOM_ADMIN_NICKNAME || '',
  role: 'admin',
  advertiser_id: null,
};

async function handleAuth(req, res, pathname) {
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    if (!JWT_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
      sendJson(res, 500, { error: '서버에 로그인 정보가 설정되지 않았습니다. Railway 환경변수(HOWTOM_ADMIN_EMAIL, HOWTOM_ADMIN_PASSWORD, JWT_SECRET)를 확인하세요.' });
      return true;
    }
    let body;
    try { body = await readJson(req); } catch (e) { sendJson(res, 400, { error: e instanceof Error ? e.message : '요청 본문이 올바르지 않습니다.' }); return true; }
    const email = String(body.email ?? '').trim();
    const password = String(body.password ?? '');
    const ip = getClientIp(req);
    if (!email || !password) { sendJson(res, 400, { error: '아이디와 비밀번호를 입력하세요.' }); return true; }

    const emailOk = timingSafeStringEqual(email, ADMIN_EMAIL);
    const passwordOk = timingSafeStringEqual(password, ADMIN_PASSWORD);
    if (!emailOk || !passwordOk) {
      addLog({ action: 'login_failed', email, ip, result: 'fail' });
      sendJson(res, 401, { error: '아이디 또는 비밀번호가 올바르지 않습니다.' }); return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const token = signToken({ sub: ADMIN_USER.id, email: ADMIN_USER.email, role: ADMIN_USER.role, iat: now, exp: now + TOKEN_TTL_SECONDS });
    addLog({ action: 'login_success', email, ip, result: 'success' });
    sendJson(res, 200, { token, user: ADMIN_USER });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const token = bearerToken(req);
    const payload = verifyToken(token);
    if (!payload) { sendJson(res, 401, { error: '인증이 만료되었거나 유효하지 않습니다.' }); return true; }
    sendJson(res, 200, { user: ADMIN_USER });
    return true;
  }

  return false; // 이 라우터가 처리하지 않는 경로 → 호출부에서 다음 단계로 계속 진행
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5_000_000) { req.destroy(); reject(new Error('요청 데이터가 너무 큽니다.')); }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('JSON 형식이 올바르지 않습니다.')); }
    });
    req.on('error', reject);
  });
}

async function forwardWebhook(url, payload) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Webhook HTTP ${response.status}`);
  try { return JSON.parse(text); } catch { return { ok: true, response: text }; }
}

function notionText(content) {
  return [{ type: 'text', text: { content: String(content).slice(0, 1900) } }];
}

function notionParagraph(content) {
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: notionText(content) } };
}

function notionHeading(content, level = 2) {
  const type = `heading_${level}`;
  return { object: 'block', type, [type]: { rich_text: notionText(content) } };
}



async function createNotionPage(payload) {
  const token = process.env.NOTION_API_TOKEN;
  const pageId = process.env.NOTION_PARENT_PAGE_ID || payload?.notion?.dataSourceId;
  if (!token || !pageId) throw new Error('NOTION_API_TOKEN과 NOTION_PARENT_PAGE_ID를 서버 환경변수에 설정하세요.');
  const report = payload.report;
  const children = [
    notionParagraph(`${report.advertiser} · ${report.period} · ${report.createdAt}`),
    notionHeading('핵심 지표', 2),
    notionParagraph(`총 광고비: ₩${Math.round(report.summary.spend).toLocaleString()} | 총 DB: ${report.summary.db.toLocaleString()} | 총 매출: ₩${Math.round(report.summary.sales).toLocaleString()} | ROAS: ${Math.round(report.summary.roas)}%`),
    notionHeading('매체별 성과', 2),
    ...report.channelRows.map((row) => notionParagraph(`${row.channel} | 노출 ${row.impressions.toLocaleString()} | 클릭 ${row.clicks.toLocaleString()} | 광고비 ₩${row.spend.toLocaleString()} | DB ${row.db} | 매출 ₩${row.sales.toLocaleString()} | ROAS ${Math.round(row.roas)}%`)),
    notionHeading('주요 인사이트', 2),
    ...report.insights.map((item) => ({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: notionText(item) } })),
    notionHeading('다음 액션', 2),
    ...report.actions.map((item) => ({ object: 'block', type: 'to_do', to_do: { rich_text: notionText(item), checked: false } })),
  ];
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': process.env.NOTION_VERSION || '2026-03-11',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: pageId },
      properties: { title: { type: 'title', title: notionText(report.title) } },
      children,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || `Notion HTTP ${response.status}`);
  return { ok: true, id: body.id, url: body.url };
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      const db = readDb();
      return sendJson(res, 200, {
        ok: true,
        service: 'howtom-universe-backend',
        publicRuntime: isPublicRuntime,
        authBackendImplemented: true,
        storage: DATA_DIR === path.join(baseDir, '.data') ? 'local-file' : 'mounted-volume',
        zeroState: db.advertisers.length === 0 && db.blogProjects.length === 0,
      });
    }

    if (await handleAuth(req, res, pathname)) return;

    // 공개 운영 API는 로그인 토큰을 필수로 사용합니다. localhost의 데모 API도
    // 데이터용 엔드포인트에서는 더 이상 샘플 응답을 만들지 않습니다.
    if (!isAuthorizedRequest(req)) return sendJson(res, 401, { error: '로그인이 필요합니다.' });

    // 네이버 등 매체별 비밀키는 절대 브라우저로 보내지 않습니다 - accounts[].secret_key/api_key는 항상 가려서 응답합니다.
    function redactAdvertiser(adv) {
      if (!adv?.accounts) return adv;
      return { ...adv, accounts: adv.accounts.map(a => ({ ...a, secret_key: a.secret_key ? '••••••••' : undefined, api_key: a.api_key ? `${String(a.api_key).slice(0, 6)}••••` : undefined })) };
    }

    if (req.method === 'GET' && pathname === '/api/advertisers') {
      return sendJson(res, 200, readDb().advertisers.map(redactAdvertiser));
    }
    if (req.method === 'POST' && pathname === '/api/advertisers') {
      const body = await readJson(req);
      const row = {
        id: cleanText(body.id || makeId('adv'), 120),
        name: cleanText(body.name, 120),
        monthly_budget: Number(body.monthly_budget ?? body.monthlyBudget ?? 0) || 0,
        brand_color: cleanText(body.brand_color || body.color || '#2563eb', 30),
        industry: cleanText(body.industry || '', 120),
        website: cleanText(body.website || '', 500),
        phone: cleanText(body.phone || '', 100),
        address: cleanText(body.address || '', 300),
        meta_account_id: cleanText(body.meta_account_id || '', 60),
        accounts: Array.isArray(body.accounts) ? body.accounts : [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (!row.name) return sendJson(res, 400, { error: '광고주명을 입력하세요.' });
      mutateDb(db => { if (db.advertisers.some(x => x.id === row.id)) throw new Error('이미 존재하는 광고주 ID입니다.'); db.advertisers.unshift(row); });
      return sendJson(res, 201, redactAdvertiser(row));
    }
    const advertiserMatch = pathname.match(/^\/api\/advertisers\/([^/]+)$/);
    if (advertiserMatch && (req.method === 'PUT' || req.method === 'PATCH')) {
      const id = decodeURIComponent(advertiserMatch[1]); const body = await readJson(req); let updated = null;
      mutateDb(db => {
        const index = db.advertisers.findIndex(x => String(x.id) === id);
        if (index < 0) return;
        // accounts 배열은 통째로 덮어쓰지 않고 채널별로 병합합니다 - 그래야 네이버 키를 등록해도
        // 이미 저장돼 있던 Meta 연결 정보가 함께 사라지지 않습니다.
        const existing = db.advertisers[index];
        let mergedAccounts = existing.accounts || [];
        if (Array.isArray(body.accounts)) {
          // 채널 전체를 통째로 교체하지 않고, 채널 안의 필드끼리 병합합니다.
          // (다른 화면이 api_key/secret_key를 모른 채로 저장해도 조용히 지워지지 않도록)
          const next = [...mergedAccounts];
          for (const incoming of body.accounts) {
            const idx = next.findIndex(a => a.channel === incoming.channel);
            if (incoming._remove) { if (idx >= 0) next.splice(idx, 1); continue; } // 명시적 연결 해제 신호
            if (idx >= 0) next[idx] = { ...next[idx], ...incoming };
            else next.push(incoming);
          }
          mergedAccounts = next;
        }
        updated = { ...existing, ...body, accounts: mergedAccounts, id: existing.id, updated_at: new Date().toISOString() };
        db.advertisers[index] = updated;
      });
      return updated ? sendJson(res, 200, redactAdvertiser(updated)) : sendJson(res, 404, { error: '광고주를 찾을 수 없습니다.' });
    }
    if (advertiserMatch && req.method === 'DELETE') {
      const id = decodeURIComponent(advertiserMatch[1]);
      mutateDb(db => { db.advertisers = db.advertisers.filter(x => String(x.id) !== id); db.blogProjects = db.blogProjects.filter(x => x.advertiserId !== id); db.blogStyles = db.blogStyles.filter(x => x.advertiserId !== id); db.blogAssets = db.blogAssets.filter(x => x.advertiserId !== id); });
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'GET' && pathname === '/api/logs') return sendJson(res, 200, readDb().logs);

    // ---- Meta 광고 API 연동 ----
    if (req.method === 'GET' && pathname === '/api/integrations/meta/status') {
      return sendJson(res, 200, { configured: metaConfigured() });
    }

    // ---- 보고서 관리(AdvertiserDailyReportPage) 'API 자동수집' 버튼이 호출하는 엔드포인트 ----
    if (req.method === 'POST' && pathname === '/api/reports/daily-performance') {
      const body = await readJson(req);
      const advertiserName = cleanText(body.advertiserName || '', 120);
      const month = cleanText(body.month || '', 7); // 'YYYY-MM'
      const platforms = Array.isArray(body.platforms) ? body.platforms : [];
      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr), monthNum = Number(monthStr);
      if (!advertiserName || !year || !monthNum) return sendJson(res, 200, { ok: true, source: {} });

      const advertiser = readDb().advertisers.find(a => a.name === advertiserName);
      const metaAccount = advertiser?.accounts?.find(a => a.channel === 'meta' && a.status === 'connected');

      const source = {};
      if (platforms.includes('메타') && metaAccount?.account_id && metaConfigured()) {
        try {
          const daysInMonth = new Date(year, monthNum, 0).getDate();
          const pad = n => String(n).padStart(2, '0');
          const since = `${year}-${pad(monthNum)}-01`;
          const todayIso = new Date().toISOString().slice(0, 10);
          const monthEndIso = `${year}-${pad(monthNum)}-${pad(daysInMonth)}`;
          const until = monthEndIso > todayIso ? todayIso : monthEndIso; // 미래 날짜는 요청하지 않습니다.
          if (since <= until) {
            const rows = await metaFetchInsights(metaAccount.account_id, since, until);
            const byDate = new Map(rows.map(r => [r.date, r]));
            const impressions = [], clicks = [], spend = [], leads = [], revenue = [], payments = [];
            for (let day = 1; day <= daysInMonth; day++) {
              const iso = `${year}-${pad(monthNum)}-${pad(day)}`;
              const row = byDate.get(iso);
              impressions.push(row?.impressions || 0);
              clicks.push(row?.clicks || 0);
              spend.push(row?.spend || 0);
              leads.push(row?.dbCount || 0);
              revenue.push(row?.revenue || 0);
              payments.push(row?.purchases || 0);
            }
            source['메타'] = { impressions, clicks, spend, leads, revenue, payments };
          }
        } catch (error) {
          // Meta API 호출이 실패해도 다른 매체 데이터는 그대로 반환합니다.
          void error;
        }
      }
      return sendJson(res, 200, { ok: true, source, mode: 'live', collectedAt: new Date().toISOString() });
    }
    if (req.method === 'GET' && pathname === '/api/integrations/meta/accounts') {
      if (!metaConfigured()) return sendJson(res, 400, { error: 'META_ACCESS_TOKEN이 설정되지 않았습니다.' });
      try {
        const accounts = await metaListAdAccounts();
        return sendJson(res, 200, { accounts });
      } catch (error) {
        return sendJson(res, 502, { error: error instanceof Error ? error.message : 'Meta API 호출에 실패했습니다.' });
      }
    }
    if (req.method === 'GET' && pathname === '/api/integrations/meta/insights') {
      if (!metaConfigured()) return sendJson(res, 400, { error: 'META_ACCESS_TOKEN이 설정되지 않았습니다.' });
      const query = new URLSearchParams((req.url || '').split('?')[1] || '');
      const accountId = query.get('accountId');
      const since = query.get('since');
      const until = query.get('until');
      if (!accountId || !since || !until) return sendJson(res, 400, { error: 'accountId, since, until 파라미터가 모두 필요합니다.' });
      try {
        const rows = await metaFetchInsights(accountId, since, until);
        return sendJson(res, 200, { rows });
      } catch (error) {
        return sendJson(res, 502, { error: error instanceof Error ? error.message : 'Meta API 호출에 실패했습니다.' });
      }
    }

    // ---- 중앙 성과 데이터 저장소(dailyMetrics / creativeMetrics / keywordMetrics) -------
    // 매체 계정 연동(설정 > 매체 계정 연동 > 광고 매체 계정)에서 연결에 성공하면 이 저장소에
    // 데이터를 채워 넣고, 보고서/통합 홈/캠페인 관리/소재 관리/키워드 관리 등 모든 화면이
    // 이 한 곳만 읽습니다.
    function upsertDailyMetrics(advertiserId, channel, rows) {
      mutateDb(db => {
        const kept = db.dailyMetrics.filter(m => !(m.advertiserId === advertiserId && m.channel === channel && rows.some(r => r.date === m.date)));
        const added = rows.map(r => ({ advertiserId, channel, date: r.date, impressions: r.impressions || 0, clicks: r.clicks || 0, spend: r.spend || 0, dbCount: r.dbCount || 0, purchases: r.purchases || 0, revenue: r.revenue || 0, updatedAt: new Date().toISOString() }));
        db.dailyMetrics = [...kept, ...added];
      });
    }
    function upsertCreativeMetrics(advertiserId, channel, rows) {
      mutateDb(db => {
        const kept = db.creativeMetrics.filter(m => !(m.advertiserId === advertiserId && m.channel === channel && rows.some(r => r.adId === m.adId)));
        const added = rows.map(r => ({ advertiserId, channel, adId: r.adId, adName: r.adName, campaignName: r.campaignName, impressions: r.impressions || 0, clicks: r.clicks || 0, spend: r.spend || 0, dbCount: r.dbCount || 0, revenue: r.revenue || 0, thumbnailUrl: r.thumbnailUrl || null, mediaType: r.mediaType || null, title: r.title || '', body: r.body || '', cta: r.cta || '', updatedAt: new Date().toISOString() }));
        db.creativeMetrics = [...kept, ...added];
      });
    }
    function upsertKeywordMetrics(advertiserId, channel, rows) {
      mutateDb(db => {
        const kept = db.keywordMetrics.filter(m => !(m.advertiserId === advertiserId && m.channel === channel && rows.some(r => r.keyword === m.keyword)));
        const added = rows.map(r => ({ advertiserId, channel, keyword: r.keyword, campaignName: r.campaignName, impressions: r.impressions || 0, clicks: r.clicks || 0, spend: r.spend || 0, dbCount: r.dbCount || 0, updatedAt: new Date().toISOString() }));
        db.keywordMetrics = [...kept, ...added];
      });
    }

/** 동기화 성공/실패 결과를 해당 광고주·매체 연결 정보에 기록합니다 - '데이터 수집 현황' 화면이 이 값을 읽습니다. */
function recordSyncResult(advertiserId, channel, { ok, count, error }) {
  mutateDb(db => {
    const adv = db.advertisers.find(a => String(a.id) === advertiserId);
    const acc = adv?.accounts?.find(a => a.channel === channel);
    if (!acc) return;
    acc.last_synced_at = new Date().toISOString();
    if (ok) { acc.last_row_count = count ?? 0; acc.last_sync_error = null; }
    else { acc.last_sync_error = error || '알 수 없는 오류'; }
  });
}

    if (req.method === 'POST' && pathname === '/api/integrations/sync') {
      const body = await readJson(req);
      const advertiserId = cleanText(body.advertiserId || '', 120);
      const channel = cleanText(body.channel || '', 40);
      const days = Math.min(Math.max(Number(body.days || 90), 1), 180);
      if (!advertiserId || !channel) return sendJson(res, 400, { error: 'advertiserId, channel이 필요합니다.' });

      const advertiser = readDb().advertisers.find(a => String(a.id) === advertiserId);
      if (!advertiser) return sendJson(res, 404, { error: '광고주를 찾을 수 없습니다.' });
      const account = advertiser.accounts?.find(a => a.channel === channel && a.status === 'connected');
      if (!account?.account_id) return sendJson(res, 400, { error: `${channel} 계정이 연결되어 있지 않습니다.` });

      if (channel === 'meta') {
        if (!metaConfigured()) return sendJson(res, 400, { error: 'META_ACCESS_TOKEN이 설정되지 않았습니다.' });
        try {
          const until = new Date().toISOString().slice(0, 10);
          const sinceDate = new Date(); sinceDate.setDate(sinceDate.getDate() - days);
          const since = sinceDate.toISOString().slice(0, 10);
          const [dailyRows, adRows] = await Promise.all([
            metaFetchInsights(account.account_id, since, until),
            metaFetchAdInsights(account.account_id, since, until).catch(() => []), // 소재 데이터 실패는 전체 동기화를 막지 않습니다.
          ]);
          upsertDailyMetrics(advertiserId, channel, dailyRows);
          if (adRows.length) {
            const thumbnails = await metaFetchAdCreativeThumbnails(adRows.map(r => r.adId)).catch(() => ({}));
            const enrichedAdRows = adRows.map(r => ({ ...r, ...(thumbnails[r.adId] || {}) }));
            upsertCreativeMetrics(advertiserId, channel, enrichedAdRows);
          }
          recordSyncResult(advertiserId, channel, { ok: true, count: dailyRows.length });
          return sendJson(res, 200, { ok: true, channel, count: dailyRows.length, creativeCount: adRows.length, since, until });
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Meta API 호출에 실패했습니다.';
          recordSyncResult(advertiserId, channel, { ok: false, error: msg });
          return sendJson(res, 502, { error: msg });
        }
      }

      if (channel === 'naver') {
        if (!account.api_key || !account.secret_key) return sendJson(res, 400, { error: '네이버 API Key/Secret Key가 저장되어 있지 않습니다.' });
        try {
          const until = new Date().toISOString().slice(0, 10);
          const sinceDate = new Date(); sinceDate.setDate(sinceDate.getDate() - days);
          const since = sinceDate.toISOString().slice(0, 10);
          const credentials = { customerId: account.account_id, apiKey: account.api_key, secretKey: account.secret_key };
          const dailyRows = await naverFetchDailyMetrics(credentials, since, until);
          upsertDailyMetrics(advertiserId, channel, dailyRows);
          const keywordRows = await naverFetchKeywordMetrics(credentials, since, until).catch(() => []); // 실패해도 일별 데이터는 저장된 채로 유지합니다.
          if (keywordRows.length) upsertKeywordMetrics(advertiserId, channel, keywordRows);
          recordSyncResult(advertiserId, channel, { ok: true, count: dailyRows.length });
          return sendJson(res, 200, { ok: true, channel, count: dailyRows.length, keywordCount: keywordRows.length, since, until });
        } catch (error) {
          const msg = error instanceof Error ? error.message : '네이버 API 호출에 실패했습니다.';
          recordSyncResult(advertiserId, channel, { ok: false, error: msg });
          return sendJson(res, 502, { error: msg });
        }
      }

      if (KEYWORD_CAPABLE_CHANNELS.includes(channel)) {
        // 구글/카카오 검색광고 커넥터가 아직 없어서, 연결은 되어도 실제 값은 비어 있습니다.
        const until = new Date().toISOString().slice(0, 10);
        const sinceDate = new Date(); sinceDate.setDate(sinceDate.getDate() - days);
        const since = sinceDate.toISOString().slice(0, 10);
        const rows = await fetchKeywordMetrics(channel, account.account_id, since, until);
        upsertKeywordMetrics(advertiserId, channel, rows);
        return sendJson(res, 200, { ok: true, channel, count: rows.length, note: rows.length ? undefined : `${channel} 키워드 커넥터가 아직 구현되지 않아 0건입니다.` });
      }

      return sendJson(res, 400, { error: `${channel} 커넥터는 아직 구현되지 않았습니다.` });
    }

    if (req.method === 'GET' && pathname === '/api/creative-metrics') {
      const query = new URLSearchParams((req.url || '').split('?')[1] || '');
      const advertiserId = query.get('advertiserId');
      let rows = readDb().creativeMetrics;
      if (advertiserId) rows = rows.filter(m => m.advertiserId === advertiserId);
      return sendJson(res, 200, { rows: rows.sort((a, b) => b.spend - a.spend) });
    }

    if (req.method === 'GET' && pathname === '/api/keyword-metrics') {
      const query = new URLSearchParams((req.url || '').split('?')[1] || '');
      const advertiserId = query.get('advertiserId');
      let rows = readDb().keywordMetrics;
      if (advertiserId) rows = rows.filter(m => m.advertiserId === advertiserId);
      const db = readDb();
      const connectedKeywordChannels = advertiserId
        ? (db.advertisers.find(a => String(a.id) === advertiserId)?.accounts || []).filter(a => KEYWORD_CAPABLE_CHANNELS.includes(a.channel) && a.status === 'connected').map(a => a.channel)
        : [];
      return sendJson(res, 200, { rows: rows.sort((a, b) => b.spend - a.spend), connectedKeywordChannels, keywordCapableChannels: KEYWORD_CAPABLE_CHANNELS });
    }

    if (req.method === 'GET' && pathname === '/api/daily-metrics') {
      const query = new URLSearchParams((req.url || '').split('?')[1] || '');
      const advertiserId = query.get('advertiserId');
      const since = query.get('since');
      const until = query.get('until');

      // 오늘·어제처럼 최근 날짜는 마지막 동기화 이후 갱신이 안 되어 있을 수 있어서,
      // 조회할 때마다 연결된 계정의 최근 3일치를 자동으로 다시 가져와 채워 넣습니다.
      if (metaConfigured()) {
        const db = readDb();
        const todayIso = new Date().toISOString().slice(0, 10);
        const topUpSince = new Date(); topUpSince.setDate(topUpSince.getDate() - 3);
        const topUpSinceIso = topUpSince.toISOString().slice(0, 10);
        const targets = advertiserId ? db.advertisers.filter(a => String(a.id) === advertiserId) : db.advertisers;
        await Promise.all(targets.map(async adv => {
          const account = adv.accounts?.find(a => a.channel === 'meta' && a.status === 'connected');
          if (!account?.account_id) return;
          const alreadyFresh = db.dailyMetrics.some(m => m.advertiserId === String(adv.id) && m.channel === 'meta' && m.date === todayIso);
          if (alreadyFresh) return; // 오늘 데이터가 이미 있으면 다시 부르지 않습니다(호출 최소화).
          try {
            const rows = await metaFetchInsights(account.account_id, topUpSinceIso, todayIso);
            upsertDailyMetrics(String(adv.id), 'meta', rows);
          } catch { /* 자동 보충 실패는 조용히 넘어가고, 기존 저장된 값을 그대로 보여줍니다. */ }
        }));
      }

      let rows = readDb().dailyMetrics;
      if (advertiserId) rows = rows.filter(m => m.advertiserId === advertiserId);
      if (since) rows = rows.filter(m => m.date >= since);
      if (until) rows = rows.filter(m => m.date <= until);
      return sendJson(res, 200, { rows: rows.sort((a, b) => a.date.localeCompare(b.date)) });
    }

    // ---- 캠페인 관리 / 전환 퍼널 (ApiAdControlRepository가 호출) --------------------------
    if (req.method === 'GET' && pathname === '/api/campaigns') {
      const db = readDb();
      const campaigns = [];
      if (metaConfigured()) {
        for (const adv of db.advertisers) {
          const account = adv.accounts?.find(a => a.channel === 'meta' && a.status === 'connected');
          if (!account?.account_id) continue;
          try {
            const rows = await metaListCampaigns(account.account_id);
            for (const c of rows) {
              campaigns.push({
                id: c.id, advertiserId: adv.id, platform: 'meta', name: c.name,
                accountName: `${adv.name} Meta`, budget: Number(c.daily_budget || c.lifetime_budget || 0),
                budgetType: c.daily_budget ? 'daily' : 'total',
                startAt: c.start_time || new Date().toISOString(), endAt: c.stop_time,
                status: metaCampaignStatus(c.effective_status || c.status),
                lastSyncedAt: new Date().toISOString(),
                capability: { upload: false, toggle: false, schedule: false }, // 읽기 전용 토큰(ads_read) 기준
              });
            }
          } catch { /* 한 광고주에서 실패해도 나머지는 계속 보여줍니다. */ }
        }
      }
      return sendJson(res, 200, campaigns);
    }
    if (req.method === 'PUT' && pathname === '/api/campaigns') {
      // 캠페인 on/off 전환 등 실제 Meta 반영은 ads_management 권한이 필요합니다(현재 ads_read만 사용).
      return sendJson(res, 200, { ok: true, note: '읽기 전용 토큰이라 실제 매체에는 반영되지 않았습니다.' });
    }

    if (req.method === 'GET' && pathname === '/api/funnels/channels') {
      const db = readDb();
      const byChannel = new Map();
      for (const m of db.dailyMetrics) {
        const cur = byChannel.get(m.channel) || { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, purchaseValue: 0 };
        cur.spend += m.spend || 0; cur.impressions += m.impressions || 0; cur.clicks += m.clicks || 0;
        cur.leads += m.dbCount || 0; cur.purchases += m.purchases || 0; cur.purchaseValue += m.revenue || 0;
        byChannel.set(m.channel, cur);
      }
      const rows = Array.from(byChannel.entries()).map(([platform, v]) => ({
        platform, status: 'connected',
        values: { spend: v.spend, impressions: v.impressions, clicks: v.clicks, leads: v.leads, purchases: v.purchases, purchaseValue: v.purchaseValue },
      }));
      return sendJson(res, 200, rows);
    }

    // ---- 광고 캘린더 (schedule-slots) --------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/schedule-slots') {
      return sendJson(res, 200, readDb().scheduleSlots);
    }
    const slotMatch = pathname.match(/^\/api\/schedule-slots\/([^/]+)$/);
    if (slotMatch && req.method === 'PUT') {
      const id = decodeURIComponent(slotMatch[1]);
      const body = await readJson(req);
      let saved = null;
      mutateDb(db => {
        const index = db.scheduleSlots.findIndex(s => String(s.id) === id);
        saved = { ...body, id };
        if (index < 0) db.scheduleSlots.push(saved); else db.scheduleSlots[index] = saved;
      });
      return sendJson(res, 200, saved);
    }
    if (slotMatch && req.method === 'DELETE') {
      const id = decodeURIComponent(slotMatch[1]);
      mutateDb(db => { db.scheduleSlots = db.scheduleSlots.filter(s => String(s.id) !== id); });
      return sendJson(res, 200, { ok: true });
    }

    // ---- 데이터 수집 현황 -----------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/integrations/status') {
      const db = readDb();
      const rows = [];
      for (const adv of db.advertisers) {
        for (const acc of adv.accounts || []) {
          if (acc.status !== 'connected') continue;
          rows.push({
            advertiserId: adv.id, advertiserName: adv.name, channel: acc.channel,
            lastSyncedAt: acc.last_synced_at || null,
            rowCount: acc.last_row_count || 0,
            error: acc.last_sync_error || null,
          });
        }
      }
      return sendJson(res, 200, { rows });
    }

    if (req.method === 'GET' && pathname === '/api/blog/projects') return sendJson(res, 200, readDb().blogProjects);
    if (req.method === 'POST' && pathname === '/api/blog/projects') {
      const body = await readJson(req); const stamp = new Date().toISOString();
      const row = {
        projectId: makeId('blog'), advertiserId: cleanText(body.advertiserId, 120), advertiserName: cleanText(body.advertiserName, 120),
        industry: cleanText(body.industry || '일반 서비스업', 120), platform: cleanText(body.platform || '네이버 블로그', 120), contentType: cleanText(body.contentType || '정보형 블로그', 120),
        purpose: cleanText(body.purpose || '정보 제공', 120), primaryKeyword: cleanText(body.primaryKeyword || '', 200), secondaryKeywords: Array.isArray(body.secondaryKeywords) ? body.secondaryKeywords.map(x=>cleanText(x,100)).filter(Boolean).slice(0,20) : [],
        region: cleanText(body.region || '', 120), targetLength: Number(body.targetLength || 2000), tone: cleanText(body.tone || '광고주 문체 자동 적용', 120), referenceText: cleanText(body.referenceText || '', 20000),
        options: { style: true, advertiserInfo: true, photos: true, compliance: true, seo: true, medical: false, ...(body.options || {}) },
        titleOptions: [], selectedTitle: '', blocks: [], status: 'draft', complianceStatus: 'not-reviewed', medicalReview: { required: null, status: 'not-reviewed', reviewNumber: '', reviewedAt: '', locked: false },
        seoScore: 0, complianceIssues: [], assetIds: [], publishStatus: 'draft', scheduledAt: '', publishedUrl: '', createdAt: stamp, updatedAt: stamp,
      };
      if (!row.advertiserId) return sendJson(res, 400, { error: '광고주를 선택하세요.' });
      mutateDb(db => db.blogProjects.unshift(row));
      return sendJson(res, 201, row);
    }
    const projectMatch = pathname.match(/^\/api\/blog\/projects\/([^/]+)$/);
    if (projectMatch && req.method === 'GET') {
      const row = readDb().blogProjects.find(x => x.projectId === decodeURIComponent(projectMatch[1]));
      return row ? sendJson(res, 200, row) : sendJson(res, 404, { error: '블로그 프로젝트를 찾을 수 없습니다.' });
    }
    if (projectMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
      const id = decodeURIComponent(projectMatch[1]); const patch = await readJson(req); let updated = null;
      const currentBeforeUpdate = readDb().blogProjects.find(x => x.projectId === id);
      if (!currentBeforeUpdate) return sendJson(res, 404, { error: '블로그 프로젝트를 찾을 수 없습니다.' });
      if (currentBeforeUpdate.medicalReview?.locked && (patch.blocks || patch.selectedTitle) && !patch.unlockForRevision) {
        return sendJson(res, 409, { error: '심의 완료 문안이 잠겨 있습니다. 재검토로 전환한 뒤 수정하세요.' });
      }
      mutateDb(db => {
        const index = db.blogProjects.findIndex(x => x.projectId === id); if (index < 0) return;
        const current = db.blogProjects[index];
        const safePatch = { ...patch }; delete safePatch.projectId; delete safePatch.createdAt; delete safePatch.unlockForRevision;
        updated = { ...current, ...safePatch, updatedAt: new Date().toISOString() };
        db.blogProjects[index] = updated;
      });
      return updated ? sendJson(res, 200, updated) : sendJson(res, 404, { error: '블로그 프로젝트를 찾을 수 없습니다.' });
    }
    if (projectMatch && req.method === 'DELETE') {
      const id = decodeURIComponent(projectMatch[1]); mutateDb(db => { db.blogProjects = db.blogProjects.filter(x => x.projectId !== id); }); return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && pathname === '/api/blog/ai-status') {
      return sendJson(res, 200, blogAiStatus());
    }

    if (req.method === 'POST' && pathname === '/api/blog/generate') {
      const body = await readJson(req); const keyword = cleanText(body.primaryKeyword, 200); const advertiser = cleanText(body.advertiserName || '광고주', 120); const region = cleanText(body.region || '', 80); const advertiserRow = readDb().advertisers.find(x => String(x.id) === String(body.advertiserId || ''));
      if (!keyword) return sendJson(res, 400, { error: '메인 키워드를 입력하세요.' });

      if (blogAiConfigured()) {
        try {
          const ai = await callExternalBlogAi({
            advertiser, industry: body.industry, platform: body.platform, contentType: body.contentType,
            keyword, secondaryKeywords: body.secondaryKeywords, region, targetLength: body.targetLength,
            tone: body.tone, preferredPhrases: body.preferredPhrases, prohibitedPhrases: body.prohibitedPhrases, cta: body.cta,
          });
          return sendJson(res, 200, { generator: `external-ai:${BLOG_AI_PROVIDER}`, titles: ai.titles, blocks: ai.blocks });
        } catch (error) {
          const fallback = ruleBasedBlogDraft(keyword, advertiser, region, advertiserRow);
          return sendJson(res, 200, {
            generator: 'rule-based-fallback',
            aiError: error instanceof Error ? error.message : '외부 AI 호출에 실패했습니다.',
            titles: fallback.titles, blocks: fallback.blocks,
          });
        }
      }

      const fallback = ruleBasedBlogDraft(keyword, advertiser, region, advertiserRow);
      return sendJson(res, 200, { generator: 'rule-based-backend', titles: fallback.titles, blocks: fallback.blocks });
    }

    const styleMatch = pathname.match(/^\/api\/blog\/styles\/([^/]+)$/);
    if (styleMatch && req.method === 'GET') {
      const advertiserId = decodeURIComponent(styleMatch[1]); const row = readDb().blogStyles.find(x => x.advertiserId === advertiserId);
      return sendJson(res, 200, row || { advertiserId, tone: '', rules: [], preferredPhrases: [], prohibitedPhrases: [], cta: '', sourceTexts: [] });
    }
    if (styleMatch && req.method === 'PUT') {
      const advertiserId = decodeURIComponent(styleMatch[1]); const body = await readJson(req); let updated;
      mutateDb(db => { const index=db.blogStyles.findIndex(x=>x.advertiserId===advertiserId); updated={advertiserId,...body,advertiserId,updatedAt:new Date().toISOString()}; if(index<0)db.blogStyles.unshift(updated);else db.blogStyles[index]=updated; });
      return sendJson(res, 200, updated);
    }

    if (req.method === 'GET' && pathname === '/api/blog/assets') return sendJson(res, 200, readDb().blogAssets);
    if (req.method === 'POST' && pathname === '/api/blog/assets') {
      const body=await readJson(req); const row={assetId:makeId('asset'),advertiserId:cleanText(body.advertiserId,120),name:cleanText(body.name,200),url:cleanText(body.url,1000),tags:Array.isArray(body.tags)?body.tags.map(x=>cleanText(x,80)).filter(Boolean):[],createdAt:new Date().toISOString()};
      if(!row.advertiserId||!row.name)return sendJson(res,400,{error:'광고주와 자산명을 입력하세요.'}); mutateDb(db=>db.blogAssets.unshift(row)); return sendJson(res,201,row);
    }

    if (req.method === 'POST' && pathname === '/api/integrations/google-sheets') {
      const payload = await readJson(req); const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      if (!url) throw new Error('GOOGLE_SHEETS_WEBHOOK_URL 환경변수를 설정하거나 환경설정에 Apps Script URL을 입력하세요.');
      const result = await forwardWebhook(url, payload); return sendJson(res, 200, { ok: true, result });
    }
    if (req.method === 'POST' && pathname === '/api/integrations/notion') {
      const payload = await readJson(req);
      if (process.env.NOTION_WEBHOOK_URL) { const result = await forwardWebhook(process.env.NOTION_WEBHOOK_URL, payload); return sendJson(res, 200, { ok: true, result }); }
      const result = await createNotionPage(payload); return sendJson(res, 200, result);
    }
    return sendJson(res, 404, { error: 'API 경로를 찾을 수 없습니다.' });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : '처리에 실패했습니다.' });
  }
}

http.createServer(async (req,res)=>{
  let pathname;
  try {
    pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    // 브라우저 확장 프로그램이나 외부에서 잘못 인코딩된 URL(예: %E0%A4%A)을 보내면
    // decodeURIComponent가 예외를 던집니다. 이 예외가 콜백 밖으로 나가면 Node.js가
    // 처리되지 않은 예외로 보고 서버 프로세스 전체를 종료시킵니다. 여기서 잡아서
    // 400 응답만 주고 서버는 계속 살아있게 합니다.
    res.writeHead(400, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('잘못된 요청 주소입니다.');
    return;
  }
  if (pathname.startsWith('/api/')) return handleApi(req, res, pathname);
  let file = path.join(root, pathname === '/' ? 'index.html' : pathname);
  if (!file.startsWith(root)) { res.writeHead(403, SECURITY_HEADERS); return res.end('Forbidden'); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root,'index.html');
  fs.readFile(file,(err,buf)=>{
    if(err){
      const message = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>HOWTOM 유니버스 실행 오류</title><body style="font-family:system-ui;padding:40px;line-height:1.7"><h1>HOWTOM 유니버스 화면 파일을 찾지 못했습니다.</h1><p><code>dist/index.html</code>이 없거나 손상됐습니다.</p><p>ZIP을 완전히 압축 해제한 뒤 다시 실행하거나, 인터넷 연결 후 <code>npm run setup</code>을 실행해주세요.</p></body></html>`;
      res.writeHead(503,{...SECURITY_HEADERS,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      return res.end(message);
    }
    res.writeHead(200,{...SECURITY_HEADERS,'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store, no-cache, must-revalidate, max-age=0', 'Pragma':'no-cache', 'Expires':'0'});
    res.end(buf);
  });
}).listen(port,'0.0.0.0',()=>{
  console.log(`HOWTOM 유니버스: http://localhost:${port}`);
  if (isPublicRuntime) console.log('[보안] 공개 실행 환경: /api 데이터 엔드포인트는 로그인 토큰을 요구합니다.');
});
