import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildReferenceConnectors } from './lib/referenceConnectors.mjs';

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
const EMPTY_DB = Object.freeze({ advertisers: [], blogProjects: [], blogStyles: [], blogAssets: [], logs: [], dailyMetrics: [], campaignMetrics: [], creativeMetrics: [], creativeDailyMetrics: [], keywordMetrics: [], keywordDailyMetrics: [], syncValidationLogs: [], scheduleSlots: [] });

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
      campaignMetrics: Array.isArray(parsed.campaignMetrics) ? parsed.campaignMetrics : [],
      creativeMetrics: Array.isArray(parsed.creativeMetrics) ? parsed.creativeMetrics : [],
      creativeDailyMetrics: Array.isArray(parsed.creativeDailyMetrics) ? parsed.creativeDailyMetrics : [],
      keywordMetrics: Array.isArray(parsed.keywordMetrics) ? parsed.keywordMetrics : [],
      keywordDailyMetrics: Array.isArray(parsed.keywordDailyMetrics) ? parsed.keywordDailyMetrics : [],
      syncValidationLogs: Array.isArray(parsed.syncValidationLogs) ? parsed.syncValidationLogs : [],
      scheduleSlots: Array.isArray(parsed.scheduleSlots) ? parsed.scheduleSlots : [],
    };
  } catch {
    return { advertisers: [], blogProjects: [], blogStyles: [], blogAssets: [], logs: [], dailyMetrics: [], campaignMetrics: [], creativeMetrics: [], creativeDailyMetrics: [], keywordMetrics: [], keywordDailyMetrics: [], syncValidationLogs: [], scheduleSlots: [] };
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

/* ========================================================================
   PostgreSQL (멀티테넌트 SaaS 전환용) — 이 단계에서는 "그림자 저장소"입니다.
   실제 서비스는 여전히 JSON 파일로 동작하고, Postgres에는 관리자가 마이그레이션을
   실행했을 때만 데이터가 채워집니다. 다음 단계에서 실제 읽기/쓰기를 Postgres로 옮깁니다.
   ======================================================================== */
const DATABASE_URL = process.env.DATABASE_URL || '';
let pgPool = null;
if (DATABASE_URL) {
  try {
    const pgModule = await import('pg');
    const pg = pgModule.default || pgModule;
    // pg 드라이버는 기본적으로 NUMERIC(소수 가능한 숫자) 컬럼을 문자열로 돌려줍니다.
    // 이걸 그대로 두면 "1000" + "2000" 같은 덧셈이 3000이 아니라 "10002000"(문자열 이어붙이기)이 되어버려서,
    // 반드시 실제 숫자(float)로 파싱하도록 설정해야 합니다.
    pg.types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val))); // 1700 = NUMERIC OID
    pg.types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10))); // 20 = BIGINT OID (노출수/클릭수 등)
    pgPool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  } catch (error) {
    console.error('[오류] DATABASE_URL이 설정됐지만 pg 패키지를 불러오지 못했습니다:', error?.message || error);
    if (isPublicRuntime) process.exit(1);
  }
}

const ENCRYPTION_KEY_HEX = process.env.SECRET_ENCRYPTION_KEY || '';
const ENCRYPTION_KEY = ENCRYPTION_KEY_HEX.length === 64 ? Buffer.from(ENCRYPTION_KEY_HEX, 'hex') : null;
function encryptSecret(plaintext) {
  if (!plaintext || !ENCRYPTION_KEY) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}
function decryptSecret(encoded) {
  if (!encoded || !ENCRYPTION_KEY) return null;
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 12), authTag = buf.subarray(12, 28), encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derived) => err ? reject(err) : resolve(derived));
  });
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

// 현재는 테넌트(고객사)가 "howtom" 하나뿐입니다. 실제 회원가입/다중 테넌트 로그인이
// 만들어지기 전까지는, 로그인한 관리자를 항상 이 테넌트로 취급합니다. 매 요청마다
// DB를 조회하지 않도록 한 번 조회한 뒤 캐시합니다.
let cachedTenantId = null;
async function getCurrentTenantId() {
  if (cachedTenantId) return cachedTenantId;
  if (!pgPool) return null;
  const res = await pgPool.query(`SELECT id FROM tenants WHERE slug = 'howtom' LIMIT 1`);
  cachedTenantId = res.rows[0]?.id || null;
  return cachedTenantId;
}

/** 접속/보안/연동 로그를 남깁니다 - '접속·보안 기록' 화면이 이 값을 읽습니다. */
async function addLog(entry) {
  if (!pgPool) return; // Postgres 미설정 환경(예: 로컬 개발)에서는 조용히 건너뜁니다.
  const tenantId = await getCurrentTenantId();
  await pgPool.query(`INSERT INTO activity_logs (tenant_id, action, data) VALUES ($1,$2,$3)`, [tenantId, entry.action || 'unknown', JSON.stringify(entry)]).catch(err => console.error('[addLog 실패]', err?.message || err));
}

/**
 * JSON 시절의 readDb()와 같은 모양(shape)을 PostgreSQL에서 만들어 돌려줍니다. 성과 데이터를
 * 다루는 여러 화면(전환 퍼널/캠페인·소재·키워드 분석 등)이 기존의 필터링·집계 로직을
 * 그대로 재사용할 수 있도록, 컬럼명을 JSON 시절과 동일한 camelCase로 맞춰서 반환합니다.
 */
/**
 * tenantId의 데이터를 읽어옵니다. filters(from/to/advertiserId/channels)를 넘기면
 * SQL 단계에서 미리 걸러서 가져오므로, 데이터가 쌓일수록 전체를 다 읽어와서 자바스크립트로
 * 거르던 예전 방식보다 훨씬 빠릅니다. filters를 생략하면(관리자 화면 등) 예전처럼 전체를 읽습니다.
 */
async function pgReadDb(tenantId, filters = {}) {
  const { from, to, advertiserId, channels } = filters;
  // 일별/캠페인별/소재별/키워드별 4개 테이블에 공통으로 적용할 WHERE 조각을 만듭니다.
  // 파라미터 번호($2, $3...)는 테이블마다 다시 매겨야 하므로, 이 함수가 그 값들을 직접 만들어 돌려줍니다.
  function dateScopedWhere() {
    const clauses = ['tenant_id = $1'];
    const params = [tenantId];
    if (from) { params.push(from); clauses.push(`date >= $${params.length}`); }
    if (to) { params.push(to); clauses.push(`date <= $${params.length}`); }
    if (advertiserId) { params.push(advertiserId); clauses.push(`advertiser_id = $${params.length}`); }
    if (channels && channels.length) { params.push(channels); clauses.push(`channel = ANY($${params.length}::text[])`); }
    return { where: clauses.join(' AND '), params };
  }
  const dm = dateScopedWhere(), cm = dateScopedWhere(), cdm = dateScopedWhere(), kdm = dateScopedWhere();
  const [advRes, dmRes, cmRes, cdmRes, kdmRes, svRes, logRes] = await Promise.all([
    pgPool.query(
      `SELECT a.id, a.name,
              COALESCE(json_agg(json_build_object(
                'channel', m.channel, 'status', m.status, 'account_id', m.account_id,
                'last_synced_at', m.last_synced_at, 'last_row_count', m.last_row_count, 'last_sync_error', m.last_sync_error
              )) FILTER (WHERE m.id IS NOT NULL), '[]') as accounts
       FROM advertisers a LEFT JOIN media_accounts m ON m.advertiser_id = a.id
       WHERE a.tenant_id = $1 GROUP BY a.id`, [tenantId]),
    pgPool.query(`SELECT advertiser_id as "advertiserId", channel, to_char(date,'YYYY-MM-DD') as date, impressions, clicks, spend, db_count as "dbCount", purchases, revenue, add_to_cart as "addToCart", complete_registration as "completeRegistration", initiate_checkout as "initiateCheckout" FROM daily_metrics WHERE ${dm.where}`, dm.params),
    pgPool.query(`SELECT advertiser_id as "advertiserId", channel, to_char(date,'YYYY-MM-DD') as date, campaign_id as "campaignId", campaign_name as "campaignName", campaign_type as "campaignType", impressions, clicks, spend, db_count as "dbCount", purchases, revenue FROM campaign_daily_metrics WHERE ${cm.where}`, cm.params),
    pgPool.query(`SELECT advertiser_id as "advertiserId", channel, to_char(date,'YYYY-MM-DD') as date, campaign_id as "campaignId", campaign_name as "campaignName", campaign_type as "campaignType", adgroup_id as "adgroupId", adgroup_name as "adgroupName", ad_id as "adId", ad_name as "adName", impressions, clicks, spend, db_count as "dbCount", purchases, revenue, thumbnail_url as "thumbnailUrl", media_type as "mediaType", video_url as "videoUrl", title, body, description, cta, carousel_images as "carouselImages" FROM creative_daily_metrics WHERE ${cdm.where}`, cdm.params),
    pgPool.query(`SELECT advertiser_id as "advertiserId", channel, to_char(date,'YYYY-MM-DD') as date, campaign_id as "campaignId", campaign_name as "campaignName", campaign_type as "campaignType", adgroup_id as "adgroupId", adgroup_name as "adgroupName", keyword_id as "keywordId", keyword, impressions, clicks, spend, db_count as "dbCount", purchases, revenue FROM keyword_daily_metrics WHERE ${kdm.where}`, kdm.params),
    pgPool.query(`SELECT id, advertiser_id as "advertiserId", channel, to_char(date_from,'YYYY-MM-DD') as since, to_char(date_to,'YYYY-MM-DD') as until, source_label as "sourceLabel", source_totals as source, stored_totals as stored, delta, ok, created_at as "createdAt" FROM sync_validation_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 500`, [tenantId]),
    pgPool.query(`SELECT id, action, data, created_at as "createdAt" FROM activity_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 500`, [tenantId]),
  ]);
  return {
    advertisers: advRes.rows.map(r => ({ id: r.id, name: r.name, accounts: r.accounts || [] })),
    dailyMetrics: dmRes.rows,
    campaignMetrics: cmRes.rows,
    creativeDailyMetrics: cdmRes.rows,
    keywordDailyMetrics: kdmRes.rows,
    syncValidationLogs: svRes.rows,
    // activity_logs의 data(JSONB)에 담긴 세부 필드(advertiserName, email, ip 등)를 펼쳐서, 최상위 컬럼과 합칩니다.
    logs: logRes.rows.map(r => ({ ...(r.data || {}), id: r.id, action: r.action, createdAt: r.createdAt })),
  };
}

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

/**
 * Meta 그래프 API 호출. 에러코드 2("Service temporarily unavailable")나 4(rate limit) 같은
 * Meta 쪽의 일시적인 문제는 몇 초 대기 후 최대 3번까지 자동으로 재시도합니다.
 */
async function metaGraphGet(path, params = {}, attempt = 1) {
  if (!META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN이 설정되지 않았습니다.');
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('access_token', META_ACCESS_TOKEN);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.error) {
    const code = data?.error?.code;
    const retryable = code === 1 || code === 2 || code === 4 || code === 17 || res.status >= 500;
    if (retryable && attempt < 3) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return metaGraphGet(path, params, attempt + 1);
    }
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
// 장바구니 담기/회원가입/결제시작은 서로 다른 이커머스 퍼널 단계라 하나로 합치지 않고 각각 따로 집계합니다.
// 리드/구매와 마찬가지로 같은 이벤트를 여러 action_type으로 중복 보고하므로, 종류별로 "우선순위상 하나만" 고릅니다.
const ADD_TO_CART_ACTION_PRIORITY = ['omni_add_to_cart', 'add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart'];
const COMPLETE_REGISTRATION_ACTION_PRIORITY = ['omni_complete_registration', 'complete_registration', 'offsite_conversion.fb_pixel_complete_registration'];
const INITIATE_CHECKOUT_ACTION_PRIORITY = ['omni_initiated_checkout', 'initiate_checkout', 'offsite_conversion.fb_pixel_initiate_checkout'];
function pickAction(list, priorityTypes) {
  for (const type of priorityTypes) {
    const match = (list || []).find(a => a.action_type === type);
    if (match) return Number(match.value || 0);
  }
  return 0;
}
/** 장바구니 담기/회원가입/결제시작 3개를 한 번에 계산해서 객체로 돌려줍니다. */
function pickFunnelActions(list) {
  return {
    addToCart: pickAction(list, ADD_TO_CART_ACTION_PRIORITY),
    completeRegistration: pickAction(list, COMPLETE_REGISTRATION_ACTION_PRIORITY),
    initiateCheckout: pickAction(list, INITIATE_CHECKOUT_ACTION_PRIORITY),
  };
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
    ...pickFunnelActions(row.actions),
  }));
}

/** Meta 레벨별 일별 인사이트. campaign/ad 모두 time_increment=1을 강제합니다. */
async function metaFetchLevelInsights(accountId, since, until, level) {
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const identityFields = level === 'campaign'
    ? 'campaign_id,campaign_name'
    : 'campaign_id,campaign_name,ad_id,ad_name';
  const allRows = [];
  // 캠페인/소재가 많은 계정은 90일치를 한 번에 요청하면 응답이 너무 커져서 Meta가
  // "Service temporarily unavailable"로 거부하는 경우가 있어, 30일 단위로 나눠서 요청합니다.
  for (const range of splitIntoChunks(since, until, 30)) {
    let rows = [];
    let after;
    for (let page = 0; page < 40; page++) {
      const data = await metaGraphGet(`/${id}/insights`, {
        time_range: JSON.stringify({ since: range.since, until: range.until }),
        fields: `${identityFields},impressions,clicks,spend,actions,action_values,date_start,date_stop`,
        time_increment: '1',
        level,
        limit: '500',
        ...(after ? { after } : {}),
      });
      rows = rows.concat(Array.isArray(data.data) ? data.data : []);
      after = data.paging?.cursors?.after;
      if (!after || !data.paging?.next) break;
    }
    allRows.push(...rows);
  }
  return allRows.map(row => ({
    date: row.date_start,
    campaignId: row.campaign_id || '',
    campaignName: row.campaign_name || '(이름 없음)',
    ...(level === 'ad' ? { adId: row.ad_id || '', adName: row.ad_name || '(이름 없음)' } : {}),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    spend: Number(row.spend || 0),
    dbCount: pickAction(row.actions, LEAD_ACTION_PRIORITY),
    purchases: pickAction(row.actions, PURCHASE_ACTION_PRIORITY),
    revenue: pickAction(row.action_values, PURCHASE_ACTION_PRIORITY),
    ...pickFunnelActions(row.actions),
  }));
}

async function metaFetchCampaignInsights(accountId, since, until) {
  return metaFetchLevelInsights(accountId, since, until, 'campaign');
}

async function metaFetchAdInsights(accountId, since, until) {
  return metaFetchLevelInsights(accountId, since, until, 'ad');
}

/** 광고 ID 목록으로 실제 소재 썸네일(이미지/영상) URL을 가져옵니다. */
// Meta의 call_to_action_type은 영어 enum이라, 화면에는 한국어로 번역해서 보여줍니다.
const CTA_LABEL_KO = {
  LEARN_MORE: '더 알아보기', SHOP_NOW: '지금 구매하기', SIGN_UP: '가입하기', BOOK_TRAVEL: '예약하기',
  CONTACT_US: '문의하기', DOWNLOAD: '다운로드', GET_QUOTE: '견적 받기', SUBSCRIBE: '구독하기',
  WATCH_MORE: '더 보기', APPLY_NOW: '지금 신청하기', CALL_NOW: '전화하기', GET_DIRECTIONS: '길찾기',
  MESSAGE_PAGE: '메시지 보내기', SEND_MESSAGE: '메시지 보내기', GET_OFFER: '혜택 받기', ORDER_NOW: '지금 주문하기',
  BOOK_NOW: '지금 예약하기', LISTEN_NOW: '듣기', PLAY_GAME: '게임 플레이', INSTALL_MOBILE_APP: '앱 설치',
  USE_APP: '앱 사용하기', OPEN_LINK: '링크 열기', GET_STARTED: '시작하기', REQUEST_TIME: '상담 예약',
  SEE_MENU: '메뉴 보기', DONATE_NOW: '기부하기', RECORD_NOW: '녹화하기', VISIT_PROFILE: '프로필 방문',
  FOLLOW_PAGE: '팔로우하기', SAVE: '저장하기', WHATSAPP_MESSAGE: '왓츠앱 메시지', NO_BUTTON: '버튼 없음',
};
function ctaLabelKo(raw) {
  if (!raw) return '';
  return CTA_LABEL_KO[raw] || raw;
}

/**
 * 광고의 실제 원본 영상 파일(source)은 더 높은 권한이 필요해 (#10) 에러로 막히는 계정이 많습니다.
 * 대신 Meta의 "광고 미리보기" 기능(광고관리자에서 보이는 것과 동일한 재생 가능한 미리보기)을 쓰면
 * 지금 갖고 있는 권한(ads_read) 그대로 동작합니다. iframe 태그 하나만 돌려줍니다.
 */
async function metaFetchAdPreview(adId, adFormat = 'MOBILE_FEED_STANDARD') {
  const data = await metaGraphGet(`/${adId}/previews`, { ad_format: adFormat });
  const body = data?.data?.[0]?.body || '';
  const srcMatch = body.match(/src="([^"]+)"/);
  return srcMatch ? srcMatch[1].replace(/&amp;/g, '&') : null;
}

// 레퍼런스 수집(콘텐츠 → 레퍼런스 수집 메뉴)에서 쓰는 플랫폼별 Connector 레지스트리입니다.
// 이 시점엔 metaGraphGet/metaConfigured/ctaLabelKo가 이미 함수 호이스팅으로 사용 가능합니다.
const REFERENCE_CONNECTORS = buildReferenceConnectors({ metaGraphGet, metaConfigured, ctaLabelKo });

async function metaFetchAdCreativeThumbnails(adIds, accountId) {
  const result = {};
  const chunkSize = 50; // 한 번에 너무 많은 ID를 요청하지 않도록 나눕니다.
  const videoIds = [];
  const allImageHashes = new Set();
  const existingPostAdIds = []; // { adId, postId } - "기존 게시물 활용" 방식 광고들
  for (let i = 0; i < adIds.length; i += chunkSize) {
    const chunk = adIds.slice(i, i + chunkSize).filter(Boolean);
    if (!chunk.length) continue;
    try {
      // image_url/thumbnail_url은 계정·소재 유형에 따라 저화질 캐시본을 돌려주는 경우가 있어,
      // Meta가 공식적으로 권장하는 방식대로 image_hash를 받아서 별도의 /adimages 조회로
      // "항상 원본 그대로"인 URL을 다시 받아옵니다.
      const data = await metaGraphGet('/', { ids: chunk.join(','), fields: 'creative{image_url,image_hash,thumbnail_url.width(1080).height(1080),video_id,object_type,title,body,call_to_action_type,effective_object_story_id,object_story_id,effective_instagram_media_id,object_story_spec{link_data{picture,image_hash,message,name,description,call_to_action,child_attachments{picture.width(600).height(600),image_hash}},video_data{image_url,message,call_to_action}}}' });
      for (const id of chunk) {
        const creative = data?.[id]?.creative;
        if (!creative) { console.error('[meta-creative] 소재 정보 없음', id, JSON.stringify(data?.[id] || {}).slice(0, 200)); continue; }
        const linkData = creative.object_story_spec?.link_data || creative.object_story_spec?.video_data || {};
        // 캐러셀(슬라이드) 광고는 child_attachments에 카드가 여러 장 들어있습니다. 각 카드의
        // 해시를 모아서, 아래에서 한 번에 원본 이미지로 바꿉니다(기존엔 첫 장만 쓰고 나머지는 버렸습니다).
        const carouselCards = Array.isArray(linkData.child_attachments) ? linkData.child_attachments : [];
        const isCarousel = carouselCards.length > 0;
        const mainImageHash = creative.image_hash || linkData.image_hash || null;
        if (mainImageHash) allImageHashes.add(mainImageHash);
        for (const c of carouselCards) if (c.image_hash) allImageHashes.add(c.image_hash);
        // "새 소재"가 아니라 "기존 게시물(인스타그램/페이스북 포스트)을 그대로 광고로 돌리는" 방식이면
        // object_story_spec 안에 이미지/영상 정보가 아예 없고, 게시물 ID로 그 게시물을 가리키기만
        // 합니다. 이 경우 게시물 자체를 별도로 조회해야 미리보기를 가져올 수 있습니다.
        // 페이스북 게시물은 effective_object_story_id(또는 object_story_id), 인스타그램 게시물은
        // effective_instagram_media_id를 쓰는 경우가 있어 둘 다 확인합니다.
        const postId = creative.effective_object_story_id || creative.object_story_id || null;
        const igMediaId = creative.effective_instagram_media_id || null;
        const hasOwnMedia = !!(mainImageHash || isCarousel || creative.image_url || linkData.picture);
        if (!hasOwnMedia && (postId || igMediaId)) {
          console.log(`[meta-existing-post] 소재 ${id}: 자체 이미지 없음, postId=${postId || '-'} igMediaId=${igMediaId || '-'}`);
          existingPostAdIds.push({ adId: id, postId, igMediaId });
        } else if (!hasOwnMedia) {
          console.log(`[meta-existing-post] 소재 ${id}: 자체 이미지도 없고 게시물 ID도 없음 (object_type=${creative.object_type || '-'})`);
        }
        result[id] = {
          mainImageHash,
          carouselHashes: isCarousel ? carouselCards.map(c => c.image_hash || null) : null,
          // 해시로 원본을 못 찾을 때를 대비한 대체값들 (아래 해시 조회 후에도 비어있으면 이걸 씁니다).
          // 캐러셀(슬라이드)의 link_data.picture는 "이 캐러셀을 지원하지 않는 구형 지면"에 보여줄
          // 대표 이미지일 뿐 실제 카드 내용과 무관해서 쓰지 않지만, creative.thumbnail_url은
          // 소재(ad) 하나하나마다 따로 생성되는 값이라 안전하게 최종 대비책으로 둡니다
          // (이게 없으면 카드 이미지 조회가 전부 실패했을 때 완전히 까맣게 뜹니다).
          thumbnailUrlFallback: isCarousel ? (creative.thumbnail_url || null) : (creative.image_url || linkData.picture || creative.thumbnail_url || null),
          carouselFallback: isCarousel ? carouselCards.map(c => c.picture || null) : null,
          mediaType: creative.video_id ? 'video' : (isCarousel ? 'carousel' : 'image'),
          videoId: creative.video_id || null,
          videoUrl: null, // 아래에서 비디오 소스를 한 번 더 조회해 채웁니다.
          title: creative.title || linkData.name || '',
          body: creative.body || linkData.message || '', // 설명란(인스타그램 캡션에 해당하는 본문 텍스트)
          description: linkData.description || '', // 링크 하단 보조 설명
          cta: ctaLabelKo(creative.call_to_action_type || linkData.call_to_action?.type || ''),
        };
        if (creative.video_id) videoIds.push(creative.video_id);
      }
    } catch (err) { console.error('[meta-creative 조회 실패]', chunk.length, '개 ID,', err?.message || err); }
  }

  // "기존 게시물 활용" 광고는 게시물/미디어 자체를 별도로 조회해서 미리보기를 채웁니다.
  if (existingPostAdIds.length) {
    console.log(`[meta-existing-post] 기존 게시물 활용 광고 ${existingPostAdIds.length}개 발견, 조회 시작`);
    const postIds = [...new Set(existingPostAdIds.map(x => x.postId).filter(Boolean))];
    const igMediaIds = [...new Set(existingPostAdIds.map(x => x.igMediaId).filter(Boolean))];
    const postInfo = {};
    const igMediaInfo = {};
    for (let i = 0; i < postIds.length; i += chunkSize) {
      const chunk = postIds.slice(i, i + chunkSize);
      try {
        // full_picture: 게시물의 대표 이미지(고화질). attachments: 캐러셀이면 subattachments에 카드별
        // 이미지가, 영상이면 target.id에 실제 영상 오브젝트 ID가 들어있어 재생 정보를 더 가져올 수 있습니다.
        const data = await metaGraphGet('/', {
          ids: chunk.join(','),
          fields: 'full_picture,message,attachments{media_type,media,url,target,subattachments{media,target}}',
        });
        for (const postId of chunk) {
          if (data?.[postId]) postInfo[postId] = data[postId];
          else console.error('[meta-existing-post] 페이스북 게시물 정보 없음(삭제되었거나 접근 권한 없음)', postId);
        }
      } catch (err) { console.error('[meta-existing-post 조회 실패]', chunk.length, '개, ', err?.message || err); }
    }
    for (let i = 0; i < igMediaIds.length; i += chunkSize) {
      const chunk = igMediaIds.slice(i, i + chunkSize);
      try {
        // 인스타그램 미디어 오브젝트는 페이스북 게시물과 필드 체계가 달라 따로 조회합니다.
        const data = await metaGraphGet('/', {
          ids: chunk.join(','),
          fields: 'media_url,thumbnail_url,permalink,caption,media_type,children{media_url,media_type}',
        });
        for (const mid of chunk) {
          if (data?.[mid]) igMediaInfo[mid] = data[mid];
          else console.error('[meta-existing-post] 인스타그램 미디어 정보 없음(삭제되었거나 접근 권한 없음)', mid);
        }
      } catch (err) { console.error('[meta-ig-media 조회 실패]', chunk.length, '개, ', err?.message || err); }
    }
    for (const { adId, postId, igMediaId } of existingPostAdIds) {
      const row = result[adId];
      const post = postId ? postInfo[postId] : null;
      const igMedia = igMediaId ? igMediaInfo[igMediaId] : null;
      if (igMedia) {
        const children = igMedia.children?.data || [];
        if (igMedia.media_type === 'CAROUSEL_ALBUM' && children.length > 1) {
          row.mediaType = 'carousel';
          row.carouselFallback = children.map(c => c.media_url || null);
          row.thumbnailUrlFallback = row.carouselFallback[0] || row.thumbnailUrlFallback;
        } else if (igMedia.media_type === 'VIDEO') {
          row.mediaType = 'video';
          row.videoUrl = igMedia.media_url || null; // IG 미디어는 media_url 자체가 재생 가능한 영상 파일입니다.
          row.thumbnailUrlFallback = igMedia.thumbnail_url || row.thumbnailUrlFallback;
        } else {
          row.thumbnailUrlFallback = igMedia.media_url || row.thumbnailUrlFallback;
        }
        if (!row.body && igMedia.caption) row.body = igMedia.caption;
      } else if (post) {
        const attachment = post.attachments?.data?.[0];
        const subAttachments = attachment?.subattachments?.data || [];
        if (subAttachments.length > 1) {
          // 캐러셀 게시물: 카드별 이미지를 모두 모읍니다.
          row.mediaType = 'carousel';
          row.carouselFallback = subAttachments.map(s => s.media?.image?.src || null);
          row.thumbnailUrlFallback = row.carouselFallback[0] || post.full_picture || row.thumbnailUrlFallback;
        } else if (attachment?.media_type === 'video_inline' || attachment?.media_type === 'video_autoplay') {
          // 영상 게시물: 실제 영상 오브젝트 ID를 알아내서, 기존 영상 처리 로직(고화질 썸네일·재생)에 그대로 태웁니다.
          const videoObjectId = attachment.target?.id;
          if (videoObjectId) { row.videoId = videoObjectId; videoIds.push(videoObjectId); row.mediaType = 'video'; }
          row.thumbnailUrlFallback = attachment.media?.image?.src || post.full_picture || row.thumbnailUrlFallback;
        } else {
          row.thumbnailUrlFallback = post.full_picture || attachment?.media?.image?.src || row.thumbnailUrlFallback;
        }
        if (!row.body && post.message) row.body = post.message;
      }
    }
    const resolvedCount = existingPostAdIds.filter(({ adId }) => result[adId]?.thumbnailUrlFallback || result[adId]?.videoUrl).length;
    console.log(`[meta-existing-post] ${existingPostAdIds.length}개 중 ${resolvedCount}개 미리보기 확보`);
  }
  // image_hash를 실제 "항상 원본 해상도"인 URL로 바꿉니다. 이게 Meta가 공식적으로 권장하는,
  // 화질이 들쭉날쭉하지 않는 유일한 방법입니다.
  const hashUrlMap = {};
  if (accountId && allImageHashes.size) {
    const hashList = [...allImageHashes];
    const acctId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    for (let i = 0; i < hashList.length; i += chunkSize) {
      const chunk = hashList.slice(i, i + chunkSize);
      try {
        const data = await metaGraphGet(`/${acctId}/adimages`, { hashes: JSON.stringify(chunk) });
        for (const img of data?.data || []) if (img.hash && img.url) hashUrlMap[img.hash] = img.url;
      } catch (err) { console.error('[meta-adimages 조회 실패]', chunk.length, '개 해시,', err?.message || err); }
    }
    console.log(`[meta-adimages] 해시 ${hashList.length}개 중 ${Object.keys(hashUrlMap).length}개 원본 URL 확보`);
  }
  let carouselCardsTotal = 0, carouselCardsResolved = 0;
  for (const id of Object.keys(result)) {
    const row = result[id];
    row.thumbnailUrl = (row.mainImageHash && hashUrlMap[row.mainImageHash])
      || (row.carouselHashes?.[0] && hashUrlMap[row.carouselHashes[0]])
      || row.carouselFallback?.[0]
      || row.thumbnailUrlFallback
      || null;
    if (row.carouselHashes) {
      carouselCardsTotal += row.carouselHashes.length;
      carouselCardsResolved += row.carouselHashes.filter(h => h && hashUrlMap[h]).length;
    }
    row.carouselImages = row.carouselHashes
      ? row.carouselHashes.map((h, idx) => (h && hashUrlMap[h]) || row.carouselFallback?.[idx] || null).filter(Boolean)
      : (row.carouselFallback ? row.carouselFallback.filter(Boolean) : null);
    delete row.mainImageHash; delete row.carouselHashes; delete row.thumbnailUrlFallback; delete row.carouselFallback;
  }
  if (carouselCardsTotal) console.log(`[meta-carousel] 카드 ${carouselCardsTotal}개 중 해시로 원본 확보 ${carouselCardsResolved}개, 나머지는 카드 자체 picture(600px)로 대체`);
  console.log(`[meta-creative] 요청 ${adIds.length}개 중 ${Object.keys(result).length}개 소재 정보 확보, 영상 ${videoIds.length}개`);
  // 영상 소재는 실제 재생 가능한 원본 URL과 고화질 포스터 이미지를 별도로 조회합니다.
  if (videoIds.length) {
    const videoInfo = {};
    const uniqueVideoIds = [...new Set(videoIds)];
    // 배치(ids) 방식으로 여러 영상을 한 번에 조회하면 thumbnails 같은 중첩된 목록이 제대로
    // 안 올 때가 있어, 영상 하나하나에 직접 /{video_id}/thumbnails로 개별 요청합니다.
    await mapWithConcurrency(uniqueVideoIds, 4, async vid => {
      try {
        const [videoData, thumbData] = await Promise.all([
          metaGraphGet(`/${vid}`, { fields: 'source,picture' }),
          metaGraphGet(`/${vid}/thumbnails`, { limit: '10' }).catch(err => { console.error('[meta-video-thumbnails 실패]', vid, err?.message || err); return null; }),
        ]);
        const thumbs = thumbData?.data || [];
        const best = thumbs.length ? thumbs.reduce((a, b) => (Number(b.width) || 0) > (Number(a.width) || 0) ? b : a) : null;
        console.log(`[meta-video] ${vid}: thumbnails ${thumbs.length}개 중 최대 ${best?.width || 0}px 선택`);
        videoInfo[vid] = { source: videoData?.source || null, picture: best?.uri || videoData?.picture || null };
      } catch (err) { console.error('[meta-video 조회 실패]', vid, err?.message || err); }
    });
    let videoUrlFilled = 0;
    for (const id of Object.keys(result)) {
      const row = result[id];
      if (row.videoId && videoInfo[row.videoId]) {
        row.videoUrl = videoInfo[row.videoId].source;
        row.thumbnailUrl = videoInfo[row.videoId].picture || row.thumbnailUrl; // 영상 포스터가 더 고화질입니다.
        if (row.videoUrl) videoUrlFilled++;
      }
    }
    console.log(`[meta-video] videoUrl 채워짐: ${videoUrlFilled}/${videoIds.length}`);
  }
  return result;
}

/** 네이버 광고그룹/소재 마스터를 수집합니다. */
async function naverFetchAdMasters(credentials) {
  const campaigns = await naverFetchCampaigns(credentials);
  const campaignNameMap = new Map(campaigns.map(c => [c.nccCampaignId, c.name]));
  const campaignTypeMap = new Map(campaigns.map(c => [c.nccCampaignId, naverCampaignTypeKo(c.campaignTp)]));
  const adgroups = [];
  await mapWithConcurrency(campaigns, 4, async c => {
    const rows = await naverApiRequest('GET', '/ncc/adgroups', { nccCampaignId: c.nccCampaignId }, credentials).catch(() => []);
    if (Array.isArray(rows)) adgroups.push(...rows.map(a => ({ ...a, campaignName: campaignNameMap.get(c.nccCampaignId) || '', campaignType: campaignTypeMap.get(c.nccCampaignId) || '' })));
  });
  const adgroupNameMap = new Map(adgroups.map(ag => [ag.nccAdgroupId, ag.name || '']));
  const ads = [];
  await mapWithConcurrency(adgroups, 4, async ag => {
    const rows = await naverApiRequest('GET', '/ncc/ads', { nccAdgroupId: ag.nccAdgroupId }, credentials).catch(() => []);
    if (Array.isArray(rows)) ads.push(...rows.map(a => ({ ...a, campaignId: ag.nccCampaignId, campaignName: ag.campaignName, campaignType: ag.campaignType, adgroupId: ag.nccAdgroupId, adgroupName: ag.name || '' })));
  });
  return { ads, adgroupNameMap };
}

/** 네이버 /stats의 ID 묶음을 일별 행으로 정규화합니다. timeIncrement=1이 무시되는 계정은 일자별 재요청합니다. */
async function naverStatsForIdsDaily(credentials, ids, since, until) {
  if (!ids.length) return [];
  const FULL_FIELDS = ['impCnt', 'clkCnt', 'salesAmt', 'ccnt', 'convAmt'];
  const BASIC_FIELDS = ['impCnt', 'clkCnt', 'salesAmt'];
  // 네이버 /stats는 ids(복수, 배열)로 요청하면 계정에 따라 형식 오류(11001)를 자주 일으켜서,
  // id가 하나뿐일 때는 단수 파라미터(id)로 보냅니다 - 이 형식이 훨씬 안정적으로 동작합니다.
  const idParams = ids.length === 1 ? { id: ids[0] } : { ids };
  const fetchRange = async (rangeSince, rangeUntil) => {
    let data = await naverApiRequest('GET', '/stats', {
      ...idParams,
      fields: JSON.stringify(FULL_FIELDS),
      timeRange: JSON.stringify({ since: rangeSince, until: rangeUntil }),
      timeIncrement: '1',
    }, credentials).catch(() => null);
    if (!data) {
      data = await naverApiRequest('GET', '/stats', {
        ...idParams,
        fields: JSON.stringify(BASIC_FIELDS),
        timeRange: JSON.stringify({ since: rangeSince, until: rangeUntil }),
        timeIncrement: '1',
      }, credentials).catch(() => null);
    }
    return Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  };

  const output = [];
  for (const range of splitIntoChunks(since, until, 90)) {
    const rows = await fetchRange(range.since, range.until);
    // rows가 진짜 빈 배열이면(네이버가 "이 기간엔 데이터가 없습니다"라고 정상 응답한 것) 그대로
    // 빈 결과로 처리합니다. 빈 배열에 대한 .some()은 항상 false라서, 이 케이스를 "날짜 필드가
    // 안 나뉜 것"으로 잘못 판단하면 아래 else 분기(일별 재조회, 90일마다 최대 90번의 API 호출)를
    // 데이터가 없는 기간마다 반복하게 되어 13개월 같은 긴 동기화가 시간 초과로 끊기는 원인이 됩니다.
    if (rows.length === 0) continue;
    const hasDates = rows.some(row => row.dateStart || row.date);
    if (hasDates || range.since === range.until) {
      for (const row of rows) output.push({ ...row, date: row.dateStart || row.date || range.since });
    } else {
      // 일부 계정은 timeIncrement를 무시하고 기간 합계를 돌려주므로, 정확한 기간 필터를 위해 일자별로 재조회합니다.
      let d = new Date(`${range.since}T00:00:00`);
      const end = new Date(`${range.until}T00:00:00`);
      while (d <= end) {
        const day = d.toISOString().slice(0, 10);
        const dailyRows = await fetchRange(day, day);
        for (const row of dailyRows) output.push({ ...row, date: row.dateStart || row.date || day });
        d.setDate(d.getDate() + 1);
        await new Promise(r => setTimeout(r, 120));
      }
    }
  }
  return output;
}

async function naverFetchCreativeDailyMetrics(credentials, since, until) {
  const { ads: adsAll } = await naverFetchAdMasters(credentials);
  const ads = adsAll.slice(0, 300); // 너무 많으면 동기화가 오래 걸려 상위 300개로 제한합니다.
  const master = new Map(ads.map(a => [a.nccAdId, a]));
  const rows = [];
  await mapWithConcurrency(ads, 4, async ad => {
    const stats = await naverStatsForIdsDaily(credentials, [ad.nccAdId], since, until);
    for (const row of stats) {
      const adId = row.id || row.nccAdId || ad.nccAdId;
      if (!master.has(adId)) continue;
      rows.push({
        date: row.date,
        campaignId: ad.campaignId || '',
        campaignName: ad.campaignName || '',
        campaignType: ad.campaignType || '',
        adgroupId: ad.adgroupId || '',
        adgroupName: ad.adgroupName || '',
        adId,
        adName: ad.ad?.headline || ad.ad?.description || adId,
        impressions: Number(row.impCnt || 0),
        clicks: Number(row.clkCnt || 0),
        spend: Number(row.salesAmt || 0),
        dbCount: Number(row.ccnt || 0),
        purchases: Number(row.ccnt || 0),
        revenue: Number(row.convAmt || 0),
        thumbnailUrl: null,
        mediaType: 'text', // 네이버 파워링크는 이미지/영상 없이 제목+설명 텍스트로만 구성된 키워드 기반 소재입니다.
        title: ad.ad?.headline || '',
        body: ad.ad?.description || '',
        description: '',
        cta: '',
      });
    }
  });
  return rows;
}

/** 네이버 캠페인 유형(campaignTp)을 한글로 바꿔줍니다. */
function naverCampaignTypeKo(tp) {
  const map = { WEB_SITE: '파워링크', SHOPPING: '쇼핑검색', POWER_CONTENTS: '파워컨텐츠', BRAND_SEARCH: '브랜드검색', PLACE: '플레이스' };
  return map[tp] || tp || '';
}

async function naverFetchKeywordDailyMetrics(credentials, since, until) {
  const campaigns = await naverFetchCampaigns(credentials);
  const campaignNameMap = new Map(campaigns.map(c => [c.nccCampaignId, c.name]));
  const campaignTypeMap = new Map(campaigns.map(c => [c.nccCampaignId, naverCampaignTypeKo(c.campaignTp)]));
  const adgroups = [];
  await mapWithConcurrency(campaigns, 4, async c => {
    const rows = await naverApiRequest('GET', '/ncc/adgroups', { nccCampaignId: c.nccCampaignId }, credentials).catch(err => { console.error('[naver-adgroups 실패]', c.nccCampaignId, err?.message || err); return []; });
    if (Array.isArray(rows)) adgroups.push(...rows);
  });
  const adgroupCampaignMap = new Map(adgroups.map(a => [a.nccAdgroupId, a.nccCampaignId]));
  const adgroupNameMap = new Map(adgroups.map(a => [a.nccAdgroupId, a.name || '']));
  const keywords = [];
  await mapWithConcurrency(adgroups.map(a => a.nccAdgroupId).filter(Boolean), 4, async agid => {
    const rows = await naverApiRequest('GET', '/ncc/keywords', { nccAdgroupId: agid }, credentials).catch(err => { console.error('[naver-keywords 목록 실패]', agid, err?.message || err); return []; });
    if (Array.isArray(rows)) keywords.push(...rows);
  });
  console.log(`[naver-keywords] 캠페인 ${campaigns.length}개 → 광고그룹 ${adgroups.length}개 → 키워드 ${keywords.length}개 수집`);
  // 캠페인 유형별로 몇 개씩 모였는지 나눠서 보여줍니다 - 특정 유형(쇼핑검색/브랜드검색 등)만
  // 키워드가 0개로 나오면, 그 매체 유형은 애초에 "키워드" 단위 타겟팅을 쓰지 않는 구조라는 뜻입니다.
  const byType = new Map();
  for (const c of campaigns) {
    const tp = naverCampaignTypeKo(c.campaignTp) || c.campaignTp || '(알수없음)';
    const agCount = adgroups.filter(a => a.nccCampaignId === c.nccCampaignId).length;
    const kwCount = keywords.filter(k => adgroupCampaignMap.get(k.nccAdgroupId) === c.nccCampaignId).length;
    const cur = byType.get(tp) || { campaigns: 0, adgroups: 0, keywords: 0 };
    cur.campaigns++; cur.adgroups += agCount; cur.keywords += kwCount;
    byType.set(tp, cur);
  }
  for (const [tp, v] of byType) console.log(`[naver-keywords] 유형=${tp} 캠페인${v.campaigns}개 광고그룹${v.adgroups}개 키워드${v.keywords}개`);
  const selected = keywords.slice(0, 300); // 너무 많으면 동기화가 오래 걸려 상위 300개로 제한합니다.
  const result = [];
  await mapWithConcurrency(selected, 4, async kw => {
    const adgroupId = kw.nccAdgroupId || '';
    const campaignId = adgroupCampaignMap.get(adgroupId) || '';
    const stats = await naverStatsForIdsDaily(credentials, [kw.nccKeywordId], since, until);
    for (const row of stats) {
      const keywordId = row.id || row.nccKeywordId || kw.nccKeywordId;
      result.push({
        date: row.date,
        campaignId,
        campaignName: campaignNameMap.get(campaignId) || '',
        campaignType: campaignTypeMap.get(campaignId) || '',
        adgroupId,
        adgroupName: adgroupNameMap.get(adgroupId) || '',
        keywordId,
        keyword: kw.keyword || keywordId,
        impressions: Number(row.impCnt || 0),
        clicks: Number(row.clkCnt || 0),
        spend: Number(row.salesAmt || 0),
        dbCount: Number(row.ccnt || 0),
        purchases: Number(row.ccnt || 0),
        revenue: Number(row.convAmt || 0),
      });
    }
  });
  // 쇼핑검색·브랜드검색 등은 네이버 API 구조상 "키워드" 단위로 등록되지 않는 경우가 많아,
  // /ncc/keywords로 아무것도 안 잡힙니다(0개). 이런 광고그룹까지 화면에서 안 보이면 안 되니,
  // 키워드가 하나도 없는 광고그룹은 그 광고그룹 자체를 하나의 항목으로 대체해서 보여줍니다.
  const adgroupsWithKeyword = new Set(keywords.map(k => k.nccAdgroupId).filter(Boolean));
  const adgroupsWithoutKeyword = adgroups.filter(a => a.nccAdgroupId && !adgroupsWithKeyword.has(a.nccAdgroupId)).slice(0, 150);
  await mapWithConcurrency(adgroupsWithoutKeyword, 4, async ag => {
    const campaignId = ag.nccCampaignId || '';
    const stats = await naverStatsForIdsDaily(credentials, [ag.nccAdgroupId], since, until);
    for (const row of stats) {
      result.push({
        date: row.date,
        campaignId,
        campaignName: campaignNameMap.get(campaignId) || '',
        campaignType: campaignTypeMap.get(campaignId) || '',
        adgroupId: ag.nccAdgroupId,
        adgroupName: ag.name || '',
        keywordId: ag.nccAdgroupId,
        keyword: `${ag.name || '광고그룹'} (광고그룹 전체)`, // 이 유형은 키워드 단위가 아니라 광고그룹 단위로 집계됨을 표시
        impressions: Number(row.impCnt || 0),
        clicks: Number(row.clkCnt || 0),
        spend: Number(row.salesAmt || 0),
        dbCount: Number(row.ccnt || 0),
        purchases: Number(row.ccnt || 0),
        revenue: Number(row.convAmt || 0),
      });
    }
  });
  return result;
}

/** 구글/카카오 등 미구현 커넥터는 데이터를 0으로 가장하지 않고 명시적으로 미구현 상태를 반환합니다. */
const KEYWORD_CAPABLE_CHANNELS = ['naver', 'google', 'kakao'];
const IMPLEMENTED_METRIC_CHANNELS = new Set(['meta', 'naver']);

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

async function naverApiRequestOnce(method, uri, params, credentials, body) {
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
    ...(body ? { body: JSON.stringify(body) } : {}),
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
async function naverApiRequest(method, uri, params, credentials, body, attempt = 1) {
  try {
    return await naverApiRequestOnce(method, uri, params, credentials, body);
  } catch (error) {
    const retryable = error.naverCode === 11001 || (error.httpStatus >= 500);
    if (retryable && attempt < 3) {
      await new Promise(r => setTimeout(r, 800 * attempt));
      return naverApiRequest(method, uri, params, credentials, body, attempt + 1);
    }
    throw error;
  }
}

async function naverFetchCampaigns(credentials) {
  const data = await naverApiRequest('GET', '/ncc/campaigns', {}, credentials);
  return Array.isArray(data) ? data : [];
}

/**
 * items를 하나씩(one-by-one) 처리하되, 최대 concurrency개까지는 동시에 실행합니다.
 * 네이버 /stats는 "여러 id를 한 요청에 묶으면" 형식 오류가 나서 개별 요청이 필수인데,
 * 이 함수로 "개별 요청 여러 개를 동시에" 보내 순수 순차 처리보다 훨씬 빠르게 만듭니다.
 */
async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runNext() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
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
/**
 * StatReport(대용량 보고서) API — /stats(빠른 조회용)가 계정별로 형식 오류를 자주 일으켜서,
 * 정기 자동 수집에는 이 방식을 대신 사용합니다: 보고서 생성 요청 → 완료될 때까지 상태 확인 →
 * 완성되면 받은 다운로드 URL에서 탭 구분 파일을 받아 직접 파싱합니다.
 */
async function naverCreateStatReport(credentials, reportTp, statDt) {
  return naverApiRequest('POST', '/stat-reports', {}, credentials, { reportTp, statDt });
}
async function naverGetStatReport(credentials, reportJobId) {
  return naverApiRequest('GET', `/stat-reports/${reportJobId}`, {}, credentials);
}
/** 보고서가 완성될 때까지 몇 초 간격으로 최대 20회(약 1분) 상태를 확인합니다. */
async function naverWaitForStatReport(credentials, reportJobId) {
  for (let i = 0; i < 20; i++) {
    const report = await naverGetStatReport(credentials, reportJobId);
    const status = report?.status;
    if (status === 'BUILT' || report?.downloadUrl) return report;
    if (status === 'REG_ERROR' || status === 'ERROR') throw new Error(`네이버 보고서 생성 실패 (status: ${status})`);
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('네이버 보고서 생성이 시간 내에 끝나지 않았습니다.');
}
/** 완성된 보고서 파일(탭 구분, 헤더 없음)을 다운로드해 배열의 배열로 파싱합니다. */
async function naverDownloadStatReportRows(downloadUrl, credentials) {
  const { customerId, apiKey, secretKey } = credentials;
  const timestamp = String(Date.now());
  const urlObj = new URL(downloadUrl.startsWith('http') ? downloadUrl : `${NAVER_API_BASE}${downloadUrl}`);
  const signature = naverSignature(timestamp, 'GET', urlObj.pathname, secretKey);
  const res = await fetch(urlObj.toString(), {
    headers: { 'X-Timestamp': timestamp, 'X-API-KEY': apiKey, 'X-Customer': String(customerId), 'X-Signature': signature },
  });
  if (!res.ok) throw new Error(`네이버 보고서 파일 다운로드 실패 (status ${res.status})`);
  let text = await res.text();
  // gzip으로 압축되어 오는 경우를 대비합니다.
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('gzip') || urlObj.pathname.endsWith('.gz')) {
    const buf = Buffer.from(text, 'binary');
    text = zlib.gunzipSync(buf).toString('utf8');
  }
  return text.split('\n').filter(Boolean).map(line => line.split('\t'));
}

/**
 * StatReport(대용량 보고서) 방식으로 일별 계정 성과를 가져옵니다. /stats가 계정마다
 * 형식 오류를 일으키는 문제를 피하기 위한 대안입니다. 정확한 컬럼 순서는 공식 문서에서
 * 확인이 어려워, 처음 몇 줄을 서버 로그에 남겨 실제 값을 보고 빠르게 맞출 수 있게 합니다.
 */
async function naverFetchDailyMetricsViaReport(credentials, since, until) {
  // AD_CONVERSION_DETAIL: 소재(광고) 단위 일별 성과+전환 보고서. statDt는 조회 시작일입니다.
  const statDt = `${since}T00:00:00Z`;
  const created = await naverCreateStatReport(credentials, 'AD_CONVERSION_DETAIL', statDt);
  const reportJobId = created?.reportJobId || created?.id;
  if (!reportJobId) throw new Error(`네이버 보고서 생성 응답에 reportJobId가 없습니다: ${JSON.stringify(created)}`);
  const finished = await naverWaitForStatReport(credentials, reportJobId);
  const downloadUrl = finished?.downloadUrl;
  if (!downloadUrl) throw new Error('네이버 보고서가 완료됐지만 다운로드 URL이 없습니다.');
  const rows = await naverDownloadStatReportRows(downloadUrl, credentials);

  console.error('[naver-report-sample]', { totalRows: rows.length, firstRows: rows.slice(0, 5) });

  // 실제 컬럼 순서를 로그로 확인하기 전까지는, 숫자를 추측해서 잘못된 값을 저장하지 않도록
  // 안전하게 빈 배열을 반환합니다. Railway 로그의 [naver-report-sample]을 확인한 뒤
  // 정확한 컬럼 인덱스로 이 부분을 채우면 바로 실제 값이 반영됩니다.
  void since; void until;
  return [];
}

async function naverFetchCampaignDailyMetrics(credentials, since, until) {
  const campaigns = await naverFetchCampaigns(credentials);
  const campaignIds = campaigns.map(c => c.nccCampaignId).filter(Boolean);
  if (!campaignIds.length) return [];
  const campaignNameMap = new Map(campaigns.map(c => [c.nccCampaignId, c.name]));
  const campaignTypeMap = new Map(campaigns.map(c => [c.nccCampaignId, naverCampaignTypeKo(c.campaignTp)]));
  const rowsOut = [];
  const typeDiag = new Map(); // 유형별로 /stats가 실제로 데이터를 돌려주는지 진단합니다.
  await mapWithConcurrency(campaignIds, 4, async campaignId => {
    const tp = campaignTypeMap.get(campaignId) || '(알수없음)';
    const rows = await naverStatsForIdsDaily(credentials, [campaignId], since, until);
    const cur = typeDiag.get(tp) || { campaigns: 0, rowsWithData: 0, totalRows: 0 };
    cur.campaigns++; cur.totalRows += rows.length;
    if (rows.some(r => Number(r.salesAmt || 0) > 0 || Number(r.impCnt || 0) > 0)) cur.rowsWithData++;
    typeDiag.set(tp, cur);
    for (const row of rows) {
      rowsOut.push({
        date: row.date,
        campaignId,
        campaignName: campaignNameMap.get(campaignId) || campaignId,
        campaignType: tp,
        impressions: Number(row.impCnt || 0),
        clicks: Number(row.clkCnt || 0),
        spend: Number(row.salesAmt || 0),
        dbCount: Number(row.ccnt || 0),
        purchases: Number(row.ccnt || 0),
        revenue: Number(row.convAmt || 0),
      });
    }
  });
  for (const [tp, v] of typeDiag) console.log(`[naver-campaign-stats] 유형=${tp} 캠페인${v.campaigns}개 중 실제 노출/비용 있는 캠페인 ${v.rowsWithData}개 (일별 행 ${v.totalRows}개 수집)`);
  return rowsOut;
}

function aggregateDailyFromDetailed(rows) {
  const byDate = new Map();
  for (const row of rows || []) {
    if (!row.date) continue;
    const cur = byDate.get(row.date) || { date: row.date, impressions: 0, clicks: 0, spend: 0, dbCount: 0, purchases: 0, revenue: 0, addToCart: 0, completeRegistration: 0, initiateCheckout: 0 };
    cur.impressions += Number(row.impressions || 0);
    cur.clicks += Number(row.clicks || 0);
    cur.spend += Number(row.spend || 0);
    cur.dbCount += Number(row.dbCount || 0);
    cur.purchases += Number(row.purchases || 0);
    cur.revenue += Number(row.revenue || 0);
    cur.addToCart += Number(row.addToCart || 0);
    cur.completeRegistration += Number(row.completeRegistration || 0);
    cur.initiateCheckout += Number(row.initiateCheckout || 0);
    byDate.set(row.date, cur);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function naverFetchDailyMetrics(credentials, since, until) {
  return aggregateDailyFromDetailed(await naverFetchCampaignDailyMetrics(credentials, since, until));
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

    // 데이터를 다루는 API(광고주·매체·키워드·소재 등)는 전부 Postgres(pgPool)를 직접 사용합니다.
    // DATABASE_URL이 설정되지 않은 환경(예: 로컬에서 npm run dev만 실행한 경우)에서는 pgPool이
    // null이라, 이 API들을 호출하면 "Cannot read properties of null (reading 'query')" 같은
    // 알아보기 어려운 크래시로 죽습니다. 마이그레이션 상태 조회처럼 pgPool 없이도 응답해야 하는
    // 극소수 엔드포인트만 예외로 남기고, 나머지 데이터 API는 여기서 미리 막아 이유를 알려줍니다.
    const PG_OPTIONAL_PATHS = new Set(['/api/admin/migration-status', '/api/admin/migrate-to-postgres']);
    if (!pgPool && !PG_OPTIONAL_PATHS.has(pathname)) {
      return sendJson(res, 503, { error: 'DATABASE_URL이 설정되지 않았습니다. 로컬 개발 환경이라면 .env에 DATABASE_URL을 채우거나, Railway에 Postgres를 연결한 뒤 관리자 > 마이그레이션에서 데이터를 옮겨주세요.' });
    }

    // ---- PostgreSQL 마이그레이션 (SaaS 전환 1단계) --------------------------------------
    // 원본 JSON 파일은 전혀 건드리지 않습니다. 몇 번을 실행해도 안전합니다(ON CONFLICT 처리).
    if (req.method === 'GET' && pathname === '/api/admin/migration-status') {
      return sendJson(res, 200, {
        databaseConfigured: Boolean(pgPool),
        encryptionKeyConfigured: Boolean(ENCRYPTION_KEY),
      });
    }
    if (req.method === 'POST' && pathname === '/api/admin/migrate-to-postgres') {
      if (!pgPool) return sendJson(res, 400, { error: 'DATABASE_URL이 설정되지 않았습니다.' });
      if (!ENCRYPTION_KEY) return sendJson(res, 400, { error: 'SECRET_ENCRYPTION_KEY가 설정되지 않았습니다(64자 16진수).' });
      try {
        const json = readDb();
        const log = [];

        log.push('스키마를 생성합니다...');
        const schemaSql = fs.readFileSync(path.join(baseDir, 'db', 'schema.sql'), 'utf8');
        await pgPool.query(schemaSql);

        // 예전에 잘못 번역되어 저장된 CTA 문구('지금 쇼핑하기')를 정확한 번역('지금 구매하기')으로 일괄 수정합니다.
        // 여러 번 실행해도 안전합니다(이미 고쳐진 값은 조건에 안 걸려 그냥 넘어갑니다).
        const ctaFixResult = await pgPool.query(`UPDATE creative_daily_metrics SET cta = '지금 구매하기' WHERE cta = '지금 쇼핑하기'`);
        if (ctaFixResult.rowCount) log.push(`CTA 문구 정정: '지금 쇼핑하기' → '지금 구매하기' (${ctaFixResult.rowCount}건)`);

        log.push('테넌트(고객사)를 생성합니다...');
        const tenantName = ADMIN_USER.name ? `${ADMIN_USER.name}의 회사` : '하우투엠';
        const tenantRes = await pgPool.query(
          `INSERT INTO tenants (name, slug, plan, max_advertisers, max_members, max_media_accounts, monthly_ai_limit, can_use_automation, can_use_client_portal)
           VALUES ($1, 'howtom', 'agency', 999, 999, 999, 999999, true, true)
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [tenantName]
        );
        const tenantId = tenantRes.rows[0].id;

        log.push('관리자 계정을 만듭니다...');
        const passwordHash = await hashPassword(ADMIN_PASSWORD);
        const userRes = await pgPool.query(
          `INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3)
           ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`,
          [ADMIN_EMAIL, passwordHash, ADMIN_USER.name || '관리자']
        );
        const userId = userRes.rows[0].id;
        await pgPool.query(`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`, [tenantId, userId]);

        // 예전에 마이그레이션을 여러 번 눌러서 생긴 중복 광고주를 정리합니다.
        // 같은 이름이 여러 개면, 실제 성과 데이터(daily_metrics)가 가장 많이 붙어있는 것만 남기고 나머지는 지웁니다.
        const dupRes = await pgPool.query(
          `SELECT a.id, a.name, COUNT(dm.id) as metric_count
           FROM advertisers a LEFT JOIN daily_metrics dm ON dm.advertiser_id = a.id
           WHERE a.tenant_id = $1 GROUP BY a.id, a.name ORDER BY a.name, metric_count DESC`,
          [tenantId]
        );
        const seenNames = new Set(); const toDelete = [];
        for (const row of dupRes.rows) {
          if (seenNames.has(row.name)) toDelete.push(row.id); else seenNames.add(row.name);
        }
        if (toDelete.length) {
          await pgPool.query(`DELETE FROM advertisers WHERE id = ANY($1::uuid[])`, [toDelete]);
          log.push(`중복 광고주 ${toDelete.length}개 정리`);
        }

        log.push('광고주 및 매체 연동 정보를 옮깁니다...');
        const advertiserIdMap = new Map();
        for (const adv of json.advertisers || []) {
          // 같은 이름의 광고주가 이미 있으면 새로 만들지 않고 그 광고주를 그대로 씁니다(중복 생성 방지).
          const existing = await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND name=$2 LIMIT 1`, [tenantId, adv.name]);
          let newAdvId;
          if (existing.rows[0]) {
            newAdvId = existing.rows[0].id;
            await pgPool.query(
              `UPDATE advertisers SET monthly_budget=$3, brand_color=$4, industry=$5, website=$6, phone=$7, address=$8, updated_at=now() WHERE id=$1 AND tenant_id=$2`,
              [newAdvId, tenantId, adv.monthly_budget || 0, adv.brand_color || null, adv.industry || null, adv.website || null, adv.phone || null, adv.address || null]
            );
          } else {
            const advRes = await pgPool.query(
              `INSERT INTO advertisers (tenant_id, name, monthly_budget, brand_color, industry, website, phone, address)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
              [tenantId, adv.name, adv.monthly_budget || 0, adv.brand_color || null, adv.industry || null, adv.website || null, adv.phone || null, adv.address || null]
            );
            newAdvId = advRes.rows[0].id;
          }
          advertiserIdMap.set(adv.id, newAdvId);
          for (const acc of adv.accounts || []) {
            await pgPool.query(
              `INSERT INTO media_accounts (tenant_id, advertiser_id, channel, status, account_id, api_key_encrypted, secret_key_encrypted, last_synced_at, last_row_count, last_sync_error)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               ON CONFLICT (advertiser_id, channel) DO UPDATE SET status = EXCLUDED.status`,
              [tenantId, newAdvId, acc.channel, acc.status || 'connected', acc.account_id || null,
               encryptSecret(acc.api_key), encryptSecret(acc.secret_key),
               acc.last_synced_at || null, acc.last_row_count || null, acc.last_sync_error || null]
            );
          }
        }
        log.push(`광고주 ${advertiserIdMap.size}개 이전 완료`);

        async function copyMetrics(rows, table, columns, valueFn) {
          let count = 0;
          for (const row of rows || []) {
            const newAdvId = advertiserIdMap.get(row.advertiserId);
            if (!newAdvId) continue;
            const values = valueFn(row, newAdvId);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
            await pgPool.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
            count++;
          }
          return count;
        }

        const dmCount = await copyMetrics(json.dailyMetrics, 'daily_metrics',
          ['tenant_id','advertiser_id','channel','date','impressions','clicks','spend','db_count','purchases','revenue'],
          (r, advId) => [tenantId, advId, r.channel, r.date, r.impressions||0, r.clicks||0, r.spend||0, r.dbCount||0, r.purchases||0, r.revenue||0]);
        log.push(`계정 일별 성과 ${dmCount}건`);

        const cpmCount = await copyMetrics(json.campaignMetrics, 'campaign_daily_metrics',
          ['tenant_id','advertiser_id','channel','campaign_id','campaign_name','date','impressions','clicks','spend','db_count','purchases','revenue'],
          (r, advId) => [tenantId, advId, r.channel, r.campaignId, r.campaignName||null, r.date, r.impressions||0, r.clicks||0, r.spend||0, r.dbCount||0, r.purchases||0, r.revenue||0]);
        log.push(`캠페인 일별 성과 ${cpmCount}건`);

        const cdmCount = await copyMetrics(json.creativeDailyMetrics, 'creative_daily_metrics',
          ['tenant_id','advertiser_id','channel','campaign_id','campaign_name','adgroup_id','adgroup_name','ad_id','ad_name','date','impressions','clicks','spend','db_count','purchases','revenue','thumbnail_url','media_type','video_url','title','body','description','cta'],
          (r, advId) => [tenantId, advId, r.channel, r.campaignId||null, r.campaignName||null, r.adgroupId||null, r.adgroupName||null, r.adId, r.adName||null, r.date, r.impressions||0, r.clicks||0, r.spend||0, r.dbCount||0, r.purchases||0, r.revenue||0, r.thumbnailUrl||null, r.mediaType||null, r.videoUrl||null, r.title||null, r.body||null, r.description||null, r.cta||null]);
        log.push(`소재 일별 성과 ${cdmCount}건`);

        const kdmCount = await copyMetrics(json.keywordDailyMetrics, 'keyword_daily_metrics',
          ['tenant_id','advertiser_id','channel','campaign_id','campaign_name','adgroup_id','adgroup_name','keyword_id','keyword','date','impressions','clicks','spend','db_count','purchases','revenue'],
          (r, advId) => [tenantId, advId, r.channel, r.campaignId||null, r.campaignName||null, r.adgroupId||null, r.adgroupName||null, r.keywordId||'', r.keyword, r.date, r.impressions||0, r.clicks||0, r.spend||0, r.dbCount||0, r.purchases||0, r.revenue||0]);
        log.push(`키워드 일별 성과 ${kdmCount}건`);

        let svCount = 0;
        for (const v of json.syncValidationLogs || []) {
          const newAdvId = advertiserIdMap.get(v.advertiserId);
          await pgPool.query(
            `INSERT INTO sync_validation_logs (tenant_id, advertiser_id, channel, date_from, date_to, source_label, source_totals, stored_totals, delta, ok)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [tenantId, newAdvId || null, v.channel, v.since || null, v.until || null, v.sourceLabel || null,
             JSON.stringify(v.source || {}), JSON.stringify(v.stored || {}), JSON.stringify(v.delta || {}), Boolean(v.ok)]
          );
          svCount++;
        }
        log.push(`동기화 검증 로그 ${svCount}건`);

        for (const p of json.blogProjects || []) {
          await pgPool.query(`INSERT INTO blog_projects (id, tenant_id, advertiser_id, data) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
            [p.projectId || makeId('blog'), tenantId, advertiserIdMap.get(p.advertiserId) || null, JSON.stringify(p)]);
        }
        for (const a of json.blogAssets || []) {
          await pgPool.query(`INSERT INTO blog_assets (id, tenant_id, data) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [a.assetId || makeId('asset'), tenantId, JSON.stringify(a)]);
        }
        for (const st of json.blogStyles || []) {
          const newAdvId = advertiserIdMap.get(st.advertiserId);
          if (newAdvId) await pgPool.query(`INSERT INTO blog_styles (tenant_id, advertiser_id, data) VALUES ($1,$2,$3) ON CONFLICT (tenant_id, advertiser_id) DO UPDATE SET data=EXCLUDED.data`, [tenantId, newAdvId, JSON.stringify(st)]);
        }
        for (const s of json.scheduleSlots || []) {
          await pgPool.query(`INSERT INTO schedule_slots (id, tenant_id, data) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [String(s.id || makeId('slot')), tenantId, JSON.stringify(s)]);
        }
        for (const l of json.logs || []) {
          await pgPool.query(`INSERT INTO activity_logs (tenant_id, action, data) VALUES ($1,$2,$3)`, [tenantId, l.action || 'unknown', JSON.stringify(l)]);
        }
        log.push(`블로그 ${json.blogProjects?.length ?? 0}건, 일정 ${json.scheduleSlots?.length ?? 0}건, 로그 ${json.logs?.length ?? 0}건`);

        log.push('완료. 원본 JSON 파일은 그대로 남아있고, 서비스는 계속 정상 동작합니다.');
        return sendJson(res, 200, { ok: true, tenantId, log });
      } catch (error) {
        return sendJson(res, 500, { error: error instanceof Error ? error.message : '마이그레이션에 실패했습니다.' });
      }
    }

    // 네이버 등 매체별 비밀키는 절대 브라우저로 보내지 않습니다 - accounts[].secret_key/api_key는 항상 가려서 응답합니다.
    function redactAdvertiser(adv) {
      if (!adv?.accounts) return adv;
      return { ...adv, accounts: adv.accounts.map(a => ({ ...a, secret_key: a.secret_key ? '••••••••' : undefined, api_key: a.api_key ? `${String(a.api_key).slice(0, 6)}••••` : undefined })) };
    }

    // ---- 광고주 CRUD (PostgreSQL 기반) --------------------------------------------------
    async function pgFetchAdvertisers(tenantId, whereId) {
      const res = await pgPool.query(
        `SELECT a.id, a.name, a.monthly_budget, a.brand_color, a.industry, a.website, a.phone, a.address,
                a.created_at, a.updated_at,
                COALESCE(json_agg(json_build_object(
                  'channel', m.channel, 'status', m.status, 'account_id', m.account_id,
                  'api_key', CASE WHEN m.api_key_encrypted IS NOT NULL THEN 'encrypted' ELSE NULL END,
                  'secret_key', CASE WHEN m.secret_key_encrypted IS NOT NULL THEN 'encrypted' ELSE NULL END,
                  'last_synced_at', m.last_synced_at, 'last_row_count', m.last_row_count, 'last_sync_error', m.last_sync_error
                ) ORDER BY m.channel) FILTER (WHERE m.id IS NOT NULL), '[]') as accounts
         FROM advertisers a
         LEFT JOIN media_accounts m ON m.advertiser_id = a.id
         WHERE a.tenant_id = $1 ${whereId ? 'AND a.id = $2' : ''}
         GROUP BY a.id ORDER BY a.created_at DESC`,
        whereId ? [tenantId, whereId] : [tenantId]
      );
      return res.rows.map(r => ({
        id: r.id, name: r.name, monthly_budget: Number(r.monthly_budget) || 0, brand_color: r.brand_color,
        industry: r.industry, website: r.website, phone: r.phone, address: r.address,
        created_at: r.created_at, updated_at: r.updated_at, accounts: r.accounts || [],
      }));
    }

    if (req.method === 'GET' && pathname === '/api/advertisers') {
      const tenantId = await getCurrentTenantId();
      const rows = await pgFetchAdvertisers(tenantId);
      return sendJson(res, 200, rows.map(redactAdvertiser));
    }
    if (req.method === 'POST' && pathname === '/api/advertisers') {
      const body = await readJson(req);
      const name = cleanText(body.name, 120);
      if (!name) return sendJson(res, 400, { error: '광고주명을 입력하세요.' });
      const tenantId = await getCurrentTenantId();
      const advRes = await pgPool.query(
        `INSERT INTO advertisers (tenant_id, name, monthly_budget, brand_color, industry, website, phone, address)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [tenantId, name, Number(body.monthly_budget ?? body.monthlyBudget ?? 0) || 0,
         cleanText(body.brand_color || body.color || '#2563eb', 30), cleanText(body.industry || '', 120),
         cleanText(body.website || '', 500), cleanText(body.phone || '', 100), cleanText(body.address || '', 300)]
      );
      const newId = advRes.rows[0].id;
      for (const acc of (Array.isArray(body.accounts) ? body.accounts : [])) {
        await pgPool.query(
          `INSERT INTO media_accounts (tenant_id, advertiser_id, channel, status, account_id, api_key_encrypted, secret_key_encrypted)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [tenantId, newId, acc.channel, acc.status || 'connected', acc.account_id || null, encryptSecret(acc.api_key), encryptSecret(acc.secret_key)]
        );
      }
      const [created] = await pgFetchAdvertisers(tenantId, newId);
      return sendJson(res, 201, redactAdvertiser(created));
    }
    const advertiserMatch = pathname.match(/^\/api\/advertisers\/([^/]+)$/);
    if (advertiserMatch && (req.method === 'PUT' || req.method === 'PATCH')) {
      const id = decodeURIComponent(advertiserMatch[1]); const body = await readJson(req);
      const tenantId = await getCurrentTenantId();
      const [existing] = await pgFetchAdvertisers(tenantId, id);
      if (!existing) return sendJson(res, 404, { error: '광고주를 찾을 수 없습니다.' });

      const fields = ['name','monthly_budget','brand_color','industry','website','phone','address'];
      const updates = {};
      for (const f of fields) {
        const camelKey = f === 'monthly_budget' ? 'monthlyBudget' : f === 'brand_color' ? 'color' : f;
        if (body[f] !== undefined) updates[f] = body[f];
        else if (body[camelKey] !== undefined) updates[f] = body[camelKey];
      }
      if (Object.keys(updates).length) {
        const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 3}`).join(', ');
        await pgPool.query(`UPDATE advertisers SET ${setClauses}, updated_at = now() WHERE id = $1 AND tenant_id = $2`,
          [id, tenantId, ...Object.values(updates)]);
      } else {
        await pgPool.query(`UPDATE advertisers SET updated_at = now() WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
      }

      const connectEvents = [];
      if (Array.isArray(body.accounts)) {
        for (const incoming of body.accounts) {
          if (incoming._remove) {
            const del = await pgPool.query(`DELETE FROM media_accounts WHERE advertiser_id=$1 AND channel=$2 RETURNING id`, [id, incoming.channel]);
            if (del.rowCount) connectEvents.push({ channel: incoming.channel, type: 'disconnect' });
            continue;
          }
          const existingAcc = await pgPool.query(`SELECT status FROM media_accounts WHERE advertiser_id=$1 AND channel=$2`, [id, incoming.channel]);
          const wasConnected = existingAcc.rows[0]?.status === 'connected';
          // api_key/secret_key가 이번 요청에 없으면(예: 다른 화면의 부분 저장) 기존 암호화 값을 그대로 유지합니다.
          await pgPool.query(
            `INSERT INTO media_accounts (tenant_id, advertiser_id, channel, status, account_id, api_key_encrypted, secret_key_encrypted)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (advertiser_id, channel) DO UPDATE SET
               status = EXCLUDED.status,
               account_id = COALESCE(EXCLUDED.account_id, media_accounts.account_id),
               api_key_encrypted = COALESCE(EXCLUDED.api_key_encrypted, media_accounts.api_key_encrypted),
               secret_key_encrypted = COALESCE(EXCLUDED.secret_key_encrypted, media_accounts.secret_key_encrypted)`,
            [tenantId, id, incoming.channel, incoming.status || 'connected', incoming.account_id || null,
             incoming.api_key ? encryptSecret(incoming.api_key) : null, incoming.secret_key ? encryptSecret(incoming.secret_key) : null]
          );
          if (incoming.status === 'connected' && !wasConnected) connectEvents.push({ channel: incoming.channel, type: 'connect' });
        }
      }
      for (const ev of connectEvents) {
        try {
          await addLog({ action: ev.type === 'connect' ? 'channel_connected' : 'channel_disconnected', advertiserId: id, advertiserName: existing.name, channel: ev.channel });
        } catch (err) {
          console.error('[매체 연결 기록 실패]', ev.channel, ev.type, err?.message || err);
        }
      }
      if (connectEvents.length) console.log(`[매체 연결] ${existing.name} - ${connectEvents.map(e => `${e.channel}:${e.type}`).join(', ')}`);
      const [updated] = await pgFetchAdvertisers(tenantId, id);
      return sendJson(res, 200, redactAdvertiser(updated));
    }
    if (advertiserMatch && req.method === 'DELETE') {
      const id = decodeURIComponent(advertiserMatch[1]);
      const tenantId = await getCurrentTenantId();
      // ON DELETE CASCADE로 media_accounts/daily_metrics/campaign_daily_metrics/creative_daily_metrics/
      // keyword_daily_metrics/blog_projects까지 함께 삭제됩니다.
      await pgPool.query(`DELETE FROM advertisers WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'GET' && pathname === '/api/logs') { const tenantId = await getCurrentTenantId(); return sendJson(res, 200, (await pgReadDb(tenantId)).logs); }

    // ---- Meta 광고 API 연동 ----
    if (req.method === 'GET' && pathname === '/api/integrations/meta/status') {
      return sendJson(res, 200, { configured: metaConfigured() });
    }

    // ---- 보고서 관리 ---------------------------------------------------------------
    // 보고서도 대시보드/인사이트와 완전히 동일한 중앙 dailyMetrics를 사용합니다.
    // 보고서 요청 시 외부 매체 API를 다시 호출하지 않으므로 같은 광고주·같은 기간의 숫자는 항상 동일합니다.
    if (req.method === 'POST' && pathname === '/api/reports/daily-performance') {
      const body = await readJson(req);
      const advertiserName = cleanText(body.advertiserName || '', 120);
      const month = cleanText(body.month || '', 7);
      const platforms = Array.isArray(body.platforms) ? body.platforms : [];
      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr), monthNum = Number(monthStr);
      if (!advertiserName || !year || !monthNum) return sendJson(res, 400, { error: 'advertiserName과 month가 필요합니다.' });

      const tenantId = await getCurrentTenantId();
      const db = await pgReadDb(tenantId);
      const advertiser = db.advertisers.find(a => a.name === advertiserName);
      if (!advertiser) return sendJson(res, 404, { error: '광고주를 찾을 수 없습니다.' });
      const daysInMonth = new Date(year, monthNum, 0).getDate();
      const pad = n => String(n).padStart(2, '0');
      const since = `${year}-${pad(monthNum)}-01`;
      const monthEndIso = `${year}-${pad(monthNum)}-${pad(daysInMonth)}`;
      const todayIso = new Date().toISOString().slice(0, 10);
      const until = monthEndIso > todayIso ? todayIso : monthEndIso;
      const requestedChannels = new Map([['메타','meta'],['네이버','naver'],['구글','google'],['당근','daangn'],['카카오','kakao'],['틱톡','tiktok']]);
      const selected = platforms.length ? platforms : [...requestedChannels.keys()];
      const source = {};
      const statuses = [];

      for (const label of selected) {
        const channel = requestedChannels.get(label);
        if (!channel) continue;
        const account = (advertiser.accounts || []).find(a => a.channel === channel);
        if (!account || account.status !== 'connected') { statuses.push({ channel, label, status: 'disconnected' }); continue; }
        if (!IMPLEMENTED_METRIC_CHANNELS.has(channel)) { statuses.push({ channel, label, status: 'connector_unimplemented' }); continue; }
        if (account.last_sync_error) { statuses.push({ channel, label, status: 'error', error: account.last_sync_error }); continue; }
        const rows = (db.dailyMetrics || []).filter(r => String(r.advertiserId) === String(advertiser.id) && r.channel === channel && r.date >= since && r.date <= until);
        const byDate = new Map(rows.map(r => [r.date, r]));
        const impressions=[], clicks=[], spend=[], leads=[], revenue=[], payments=[];
        for (let day=1;day<=daysInMonth;day++) {
          const iso=`${year}-${pad(monthNum)}-${pad(day)}`; const row=byDate.get(iso);
          impressions.push(metricNumber(row?.impressions)); clicks.push(metricNumber(row?.clicks)); spend.push(metricNumber(row?.spend)); leads.push(metricNumber(row?.dbCount)); revenue.push(metricNumber(row?.revenue)); payments.push(metricNumber(row?.purchases));
        }
        source[label]={ impressions, clicks, spend, leads, revenue, payments };
        statuses.push({ channel, label, status: 'connected', lastSyncedAt: account.last_synced_at || null, rowCount: rows.length });
      }
      return sendJson(res, 200, { ok: true, source, statuses, mode: 'central-metrics', from: since, to: until, collectedAt: new Date().toISOString() });
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
    function metricNumber(value) { return Number(value || 0) || 0; }
    async function upsertDailyMetrics(tenantId, advertiserId, channel, rows) {
      const valid = (rows || []).filter(r => r.date);
      if (!valid.length) return;
      await pgPool.query(
        `INSERT INTO daily_metrics (tenant_id, advertiser_id, channel, date, impressions, clicks, spend, db_count, purchases, revenue, add_to_cart, complete_registration, initiate_checkout)
         SELECT $1, $2, $3, d, imp, clk, sp, dbc, pur, rev, atc, creg, ichk
         FROM UNNEST($4::date[], $5::bigint[], $6::bigint[], $7::numeric[], $8::bigint[], $9::bigint[], $10::numeric[], $11::bigint[], $12::bigint[], $13::bigint[]) AS t(d, imp, clk, sp, dbc, pur, rev, atc, creg, ichk)
         ON CONFLICT (advertiser_id, channel, date) DO UPDATE SET
           impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks, spend=EXCLUDED.spend,
           db_count=EXCLUDED.db_count, purchases=EXCLUDED.purchases, revenue=EXCLUDED.revenue,
           add_to_cart=EXCLUDED.add_to_cart, complete_registration=EXCLUDED.complete_registration, initiate_checkout=EXCLUDED.initiate_checkout, updated_at=now()`,
        [tenantId, advertiserId, channel,
         valid.map(r => r.date), valid.map(r => metricNumber(r.impressions)), valid.map(r => metricNumber(r.clicks)),
         valid.map(r => metricNumber(r.spend)), valid.map(r => metricNumber(r.dbCount)), valid.map(r => metricNumber(r.purchases)), valid.map(r => metricNumber(r.revenue)),
         valid.map(r => metricNumber(r.addToCart)), valid.map(r => metricNumber(r.completeRegistration)), valid.map(r => metricNumber(r.initiateCheckout))]
      );
    }
    async function upsertCampaignDailyMetrics(tenantId, advertiserId, channel, rows) {
      const valid = (rows || []).filter(r => r.date && r.campaignId);
      if (!valid.length) return;
      await pgPool.query(
        `INSERT INTO campaign_daily_metrics (tenant_id, advertiser_id, channel, campaign_id, campaign_name, campaign_type, date, impressions, clicks, spend, db_count, purchases, revenue)
         SELECT $1, $2, $3, cid, cname, ctype, d, imp, clk, sp, dbc, pur, rev
         FROM UNNEST($4::text[], $5::text[], $6::text[], $7::date[], $8::bigint[], $9::bigint[], $10::numeric[], $11::bigint[], $12::bigint[], $13::numeric[]) AS t(cid, cname, ctype, d, imp, clk, sp, dbc, pur, rev)
         ON CONFLICT (advertiser_id, channel, campaign_id, date) DO UPDATE SET
           campaign_name=EXCLUDED.campaign_name, campaign_type=EXCLUDED.campaign_type, impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks,
           spend=EXCLUDED.spend, db_count=EXCLUDED.db_count, purchases=EXCLUDED.purchases, revenue=EXCLUDED.revenue, updated_at=now()`,
        [tenantId, advertiserId, channel,
         valid.map(r => String(r.campaignId)), valid.map(r => r.campaignName || String(r.campaignId)), valid.map(r => r.campaignType || ''), valid.map(r => r.date),
         valid.map(r => metricNumber(r.impressions)), valid.map(r => metricNumber(r.clicks)), valid.map(r => metricNumber(r.spend)),
         valid.map(r => metricNumber(r.dbCount)), valid.map(r => metricNumber(r.purchases)), valid.map(r => metricNumber(r.revenue))]
      );
    }
    async function upsertCreativeDailyMetrics(tenantId, advertiserId, channel, rows) {
      const valid = (rows || []).filter(r => r.date && r.adId);
      if (!valid.length) return;
      await pgPool.query(
        `INSERT INTO creative_daily_metrics (tenant_id, advertiser_id, channel, campaign_id, campaign_name, campaign_type, adgroup_id, adgroup_name, ad_id, ad_name, date, impressions, clicks, spend, db_count, purchases, revenue, thumbnail_url, media_type, video_url, title, body, description, cta, carousel_images)
         SELECT $1, $2, $3, cid, cname, ctype, agid, agname, aid, aname, d, imp, clk, sp, dbc, pur, rev, thumb, mtype, vurl, ttl, bdy, desc_, cta_, cimg::jsonb
         FROM UNNEST($4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[], $11::date[], $12::bigint[], $13::bigint[], $14::numeric[], $15::bigint[], $16::bigint[], $17::numeric[], $18::text[], $19::text[], $20::text[], $21::text[], $22::text[], $23::text[], $24::text[], $25::text[])
           AS t(cid, cname, ctype, agid, agname, aid, aname, d, imp, clk, sp, dbc, pur, rev, thumb, mtype, vurl, ttl, bdy, desc_, cta_, cimg)
         ON CONFLICT (advertiser_id, channel, ad_id, date) DO UPDATE SET
           campaign_id=EXCLUDED.campaign_id, campaign_name=EXCLUDED.campaign_name, campaign_type=EXCLUDED.campaign_type, adgroup_id=EXCLUDED.adgroup_id, adgroup_name=EXCLUDED.adgroup_name,
           ad_name=EXCLUDED.ad_name, impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks, spend=EXCLUDED.spend,
           db_count=EXCLUDED.db_count, purchases=EXCLUDED.purchases, revenue=EXCLUDED.revenue,
           thumbnail_url=EXCLUDED.thumbnail_url, media_type=EXCLUDED.media_type, video_url=EXCLUDED.video_url, title=EXCLUDED.title,
           body=EXCLUDED.body, description=EXCLUDED.description, cta=EXCLUDED.cta, carousel_images=EXCLUDED.carousel_images, updated_at=now()`,
        [tenantId, advertiserId, channel,
         valid.map(r => r.campaignId || ''), valid.map(r => r.campaignName || ''), valid.map(r => r.campaignType || ''), valid.map(r => r.adgroupId || ''), valid.map(r => r.adgroupName || ''),
         valid.map(r => String(r.adId)), valid.map(r => r.adName || String(r.adId)), valid.map(r => r.date),
         valid.map(r => metricNumber(r.impressions)), valid.map(r => metricNumber(r.clicks)), valid.map(r => metricNumber(r.spend)),
         valid.map(r => metricNumber(r.dbCount)), valid.map(r => metricNumber(r.purchases)), valid.map(r => metricNumber(r.revenue)),
         valid.map(r => r.thumbnailUrl || null), valid.map(r => r.mediaType || null), valid.map(r => r.videoUrl || null), valid.map(r => r.title || ''),
         valid.map(r => r.body || ''), valid.map(r => r.description || ''), valid.map(r => r.cta || ''),
         valid.map(r => JSON.stringify(r.carouselImages || null))]
      );
    }
    async function upsertKeywordDailyMetrics(tenantId, advertiserId, channel, rows) {
      const valid = (rows || []).filter(r => r.date && (r.keywordId || r.keyword));
      if (!valid.length) return;
      await pgPool.query(
        `INSERT INTO keyword_daily_metrics (tenant_id, advertiser_id, channel, campaign_id, campaign_name, campaign_type, adgroup_id, adgroup_name, keyword_id, keyword, date, impressions, clicks, spend, db_count, purchases, revenue)
         SELECT $1, $2, $3, cid, cname, ctype, agid, agname, kwid, kw, d, imp, clk, sp, dbc, pur, rev
         FROM UNNEST($4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[], $11::date[], $12::bigint[], $13::bigint[], $14::numeric[], $15::bigint[], $16::bigint[], $17::numeric[])
           AS t(cid, cname, ctype, agid, agname, kwid, kw, d, imp, clk, sp, dbc, pur, rev)
         ON CONFLICT (advertiser_id, channel, keyword_id, keyword, date) DO UPDATE SET
           campaign_id=EXCLUDED.campaign_id, campaign_name=EXCLUDED.campaign_name, campaign_type=EXCLUDED.campaign_type, adgroup_id=EXCLUDED.adgroup_id, adgroup_name=EXCLUDED.adgroup_name,
           impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks, spend=EXCLUDED.spend,
           db_count=EXCLUDED.db_count, purchases=EXCLUDED.purchases, revenue=EXCLUDED.revenue, updated_at=now()`,
        [tenantId, advertiserId, channel,
         valid.map(r => r.campaignId || ''), valid.map(r => r.campaignName || ''), valid.map(r => r.campaignType || ''), valid.map(r => r.adgroupId || ''), valid.map(r => r.adgroupName || ''),
         valid.map(r => r.keywordId || ''), valid.map(r => r.keyword || r.keywordId), valid.map(r => r.date),
         valid.map(r => metricNumber(r.impressions)), valid.map(r => metricNumber(r.clicks)), valid.map(r => metricNumber(r.spend)),
         valid.map(r => metricNumber(r.dbCount)), valid.map(r => metricNumber(r.purchases)), valid.map(r => metricNumber(r.revenue))]
      );
    }
    function aggregateMetricRows(rows) {
      return (rows || []).reduce((a, r) => ({ impressions: a.impressions + metricNumber(r.impressions), clicks: a.clicks + metricNumber(r.clicks), spend: a.spend + metricNumber(r.spend), dbCount: a.dbCount + metricNumber(r.dbCount), purchases: a.purchases + metricNumber(r.purchases), revenue: a.revenue + metricNumber(r.revenue) }), { impressions: 0, clicks: 0, spend: 0, dbCount: 0, purchases: 0, revenue: 0 });
    }
    async function recordValidation(tenantId, advertiserId, channel, since, until, sourceRows, storedRows, sourceLabel, accountId = '') {
      const source = aggregateMetricRows(sourceRows);
      const stored = aggregateMetricRows(storedRows);
      const delta = Object.fromEntries(Object.keys(source).map(k => [k, metricNumber(stored[k]) - metricNumber(source[k])]));
      const tolerance = (key) => key === 'spend' || key === 'revenue' ? 1 : 0;
      const ok = Object.keys(delta).every(k => Math.abs(delta[k]) <= tolerance(k));
      await pgPool.query(
        `INSERT INTO sync_validation_logs (tenant_id, advertiser_id, channel, date_from, date_to, source_label, source_totals, stored_totals, delta, ok)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [tenantId, advertiserId, channel, since || null, until || null, sourceLabel, JSON.stringify(source), JSON.stringify(stored), JSON.stringify(delta), ok]
      );
      return { ok, source, stored, delta };
    }

/** 동기화 성공/실패 결과를 해당 광고주·매체 연결 정보에 기록합니다 - '데이터 수집 현황' 화면이 이 값을 읽습니다. */
async function recordSyncResult(tenantId, advertiserId, channel, { ok, count, error }) {
  await pgPool.query(
    `UPDATE media_accounts SET last_synced_at = now(),
       last_row_count = CASE WHEN $4 THEN $5 ELSE last_row_count END,
       last_sync_error = CASE WHEN $4 THEN NULL ELSE $6 END
     WHERE advertiser_id = $1 AND channel = $2 AND tenant_id = $3`,
    [advertiserId, channel, tenantId, ok, count ?? 0, error || '알 수 없는 오류']
  );
  const advRes = await pgPool.query(`SELECT name FROM advertisers WHERE id = $1`, [advertiserId]);
  const advertiserName = advRes.rows[0]?.name || advertiserId;
  addLog({ action: ok ? 'sync_success' : 'sync_failed', advertiserId, advertiserName, channel, count: count ?? 0, error: ok ? null : (error || '알 수 없는 오류') });
}

    /** 동기화(백엔드 내부용)에서만 사용합니다 - 실제 API 호출을 위해 복호화된 값을 반환합니다. 프론트로는 절대 내려보내지 않습니다. */
    async function pgGetMediaAccountForSync(tenantId, advertiserId, channel) {
      const r = await pgPool.query(
        `SELECT account_id, api_key_encrypted, secret_key_encrypted, status FROM media_accounts WHERE tenant_id=$1 AND advertiser_id=$2 AND channel=$3`,
        [tenantId, advertiserId, channel]
      );
      const row = r.rows[0];
      if (!row) return null;
      return { account_id: row.account_id, status: row.status, api_key: decryptSecret(row.api_key_encrypted), secret_key: decryptSecret(row.secret_key_encrypted) };
    }

    if (req.method === 'GET' && pathname === '/api/integrations/auto-sync-status') {
      return sendJson(res, 200, {
        enabled: Boolean(pgPool),
        hoursKst: AUTO_SYNC_HOURS_KST,
        lastRunAt: autoSyncStatus.lastRunAt,
        lastResult: autoSyncStatus.lastResult,
      });
    }

    if (req.method === 'POST' && pathname === '/api/integrations/sync') {
      const body = await readJson(req);
      const advertiserId = cleanText(body.advertiserId || '', 120);
      const channel = cleanText(body.channel || '', 40);
      // Meta는 최대 37개월(공식 한도)까지, 네이버는 실제 데이터 보존 한계인 최대 24개월(730일)까지만 지원됩니다.
      // (네이버는 저희 쪽 제한이 아니라 네이버 서버 자체가 그 이상 데이터를 보관하지 않습니다.)
      const maxDays = channel === 'naver' ? 730 : 1110;
      const days = Math.min(Math.max(Number(body.days || 90), 1), maxDays);
      if (!advertiserId || !channel) return sendJson(res, 400, { error: 'advertiserId, channel이 필요합니다.' });

      const tenantId = await getCurrentTenantId();
      const [advertiser] = await pgFetchAdvertisers(tenantId, advertiserId);
      if (!advertiser) return sendJson(res, 404, { error: '광고주를 찾을 수 없습니다.' });
      const account = await pgGetMediaAccountForSync(tenantId, advertiserId, channel);
      if (!account || account.status !== 'connected' || !account.account_id) return sendJson(res, 400, { error: `${channel} 계정이 연결되어 있지 않습니다.` });

      if (channel === 'meta') {
        if (!metaConfigured()) return sendJson(res, 400, { error: 'META_ACCESS_TOKEN이 설정되지 않았습니다.' });
        try {
          const until = new Date().toISOString().slice(0, 10);
          const sinceDate = new Date(); sinceDate.setDate(sinceDate.getDate() - Math.max(0, days - 1));
          const since = sinceDate.toISOString().slice(0, 10);
          // 소재별(ad) 일별 데이터는 광고 개수가 많으면 데이터량이 매우 커지므로, 아주 긴 기간을 요청해도
          // 최근 90일까지만 세부 수집합니다. 계정/캠페인 단위 추이는 요청한 전체 기간(최대 37개월) 그대로 수집됩니다.
          const adSinceDate = new Date(); adSinceDate.setDate(adSinceDate.getDate() - Math.min(89, days - 1));
          const adSince = adSinceDate.toISOString().slice(0, 10);
          const [accountRows, campaignRows, adRows] = await Promise.all([
            metaFetchInsights(account.account_id, since, until),
            metaFetchCampaignInsights(account.account_id, since, until),
            metaFetchAdInsights(account.account_id, adSince, until),
          ]);
          const dailyRows = aggregateDailyFromDetailed(campaignRows);
          await upsertDailyMetrics(tenantId, advertiserId, channel, dailyRows);
          await upsertCampaignDailyMetrics(tenantId, advertiserId, channel, campaignRows);
          if (adRows.length) {
            const thumbnails = await metaFetchAdCreativeThumbnails([...new Set(adRows.map(r => r.adId))], account.account_id).catch(err => { console.error('[meta-creative 전체 실패]', err?.message || err); return {}; });
            const enrichedAdRows = adRows.map(r => ({ ...r, ...(thumbnails[r.adId] || {}) }));
            await upsertCreativeDailyMetrics(tenantId, advertiserId, channel, enrichedAdRows);
          }
          const storedRes = await pgPool.query(`SELECT * FROM daily_metrics WHERE tenant_id=$1 AND advertiser_id=$2 AND channel=$3 AND date>=$4 AND date<=$5`, [tenantId, advertiserId, channel, since, until]);
          const validation = await recordValidation(tenantId, advertiserId, channel, since, until, accountRows, storedRes.rows, 'Meta account insights vs HOWTOM campaign aggregation', account.account_id);
          await recordSyncResult(tenantId, advertiserId, channel, { ok: true, count: dailyRows.length });
          return sendJson(res, 200, { ok: true, channel, count: dailyRows.length, campaignCount: campaignRows.length, creativeCount: adRows.length, since, until, validation });
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Meta API 호출에 실패했습니다.';
          await recordSyncResult(tenantId, advertiserId, channel, { ok: false, error: msg });
          return sendJson(res, 502, { error: msg });
        }
      }

      if (channel === 'naver') {
        if (!account.api_key || !account.secret_key) return sendJson(res, 400, { error: '네이버 API Key/Secret Key가 저장되어 있지 않습니다.' });
        try {
          const until = new Date().toISOString().slice(0, 10);
          const sinceDate = new Date(); sinceDate.setDate(sinceDate.getDate() - Math.max(0, days - 1));
          const since = sinceDate.toISOString().slice(0, 10);
          // 소재별/키워드별 데이터는 항목 하나하나를 순회하며 조회하기 때문에(캠페인/계정 전체보다 훨씬 비쌈)
          // 예전엔 시간 초과를 피하려 최근 90일로 강제 제한했었습니다. 그 원인이었던
          // naverStatsForIdsDaily의 빈 응답 재조회 낭비 버그를 고쳤으므로, 이제 캠페인/계정
          // 단위와 동일하게 요청하신 전체 기간(최대 24개월)을 그대로 수집합니다.
          const detailSinceDate = new Date(); detailSinceDate.setDate(detailSinceDate.getDate() - Math.max(0, days - 1));
          const detailSince = detailSinceDate.toISOString().slice(0, 10);
          const credentials = { customerId: account.account_id, apiKey: account.api_key, secretKey: account.secret_key };
          // 캠페인/소재/키워드를 동시에(Promise.all) 요청하면 네이버 API 호출이 한꺼번에 몰려서
          // 키워드처럼 단계가 많은(캠페인→광고그룹→키워드→통계) 항목이 조용히 비어버리는 경우가 있어,
          // 순서대로 하나씩 처리합니다.
          const campaignRows = await naverFetchCampaignDailyMetrics(credentials, since, until);
          const creativeRows = await naverFetchCreativeDailyMetrics(credentials, detailSince, until);
          const keywordRows = await naverFetchKeywordDailyMetrics(credentials, detailSince, until);
          const dailyRows = aggregateDailyFromDetailed(campaignRows);
          await upsertDailyMetrics(tenantId, advertiserId, channel, dailyRows);
          await upsertCampaignDailyMetrics(tenantId, advertiserId, channel, campaignRows);
          if (creativeRows.length) await upsertCreativeDailyMetrics(tenantId, advertiserId, channel, creativeRows);
          if (keywordRows.length) await upsertKeywordDailyMetrics(tenantId, advertiserId, channel, keywordRows);
          // 같은 네이버 /stats 원천에서 계정 합계를 별도로 한 번 계산해 저장값과 대조합니다.
          const sourceRows = await naverFetchDailyMetrics(credentials, since, until);
          const storedRes = await pgPool.query(`SELECT * FROM daily_metrics WHERE tenant_id=$1 AND advertiser_id=$2 AND channel=$3 AND date>=$4 AND date<=$5`, [tenantId, advertiserId, channel, since, until]);
          const validation = await recordValidation(tenantId, advertiserId, channel, since, until, sourceRows, storedRes.rows, 'Naver account aggregate vs HOWTOM campaign aggregation', account.account_id);
          await recordSyncResult(tenantId, advertiserId, channel, { ok: true, count: dailyRows.length });
          return sendJson(res, 200, { ok: true, channel, count: dailyRows.length, campaignCount: campaignRows.length, creativeCount: creativeRows.length, keywordCount: keywordRows.length, since, until, validation });
        } catch (error) {
          const msg = error instanceof Error ? error.message : '네이버 API 호출에 실패했습니다.';
          await recordSyncResult(tenantId, advertiserId, channel, { ok: false, error: msg });
          return sendJson(res, 502, { error: msg });
        }
      }

      if (!IMPLEMENTED_METRIC_CHANNELS.has(channel)) return sendJson(res, 501, { error: `${channel} 커넥터는 아직 구현되지 않았습니다.`, status: 'connector_unimplemented' });
      return sendJson(res, 400, { error: `${channel} 동기화 요청을 처리할 수 없습니다.` });
    }

    function parseMetricQuery() {
      const query = new URLSearchParams((req.url || '').split('?')[1] || '');
      const from = query.get('from') || query.get('since') || '';
      const to = query.get('to') || query.get('until') || '';
      const advertiserId = query.get('advertiserId') || '';
      const channels = (query.get('channel') || '').split(',').map(v => v.trim()).filter(Boolean);
      return { query, from, to, advertiserId, channels };
    }
    function filterMetricRows(rows, filters) {
      return (rows || []).filter(row =>
        (!filters.advertiserId || String(row.advertiserId) === filters.advertiserId) &&
        (!filters.channels.length || filters.channels.includes(String(row.channel))) &&
        (!filters.from || !row.date || String(row.date) >= filters.from) &&
        (!filters.to || !row.date || String(row.date) <= filters.to)
      );
    }
    function advertiserNameMap(db) { return new Map((db.advertisers || []).map(a => [String(a.id), a.name])); }
    function decorateRows(rows, db) {
      const names = advertiserNameMap(db);
      return rows.map(row => ({ ...row, advertiserName: names.get(String(row.advertiserId)) || String(row.advertiserId) }));
    }
    function withDerived(row) {
      const impressions = metricNumber(row.impressions), clicks = metricNumber(row.clicks), spend = metricNumber(row.spend), dbCount = metricNumber(row.dbCount), purchases = metricNumber(row.purchases), revenue = metricNumber(row.revenue);
      return { ...row, impressions, clicks, spend, dbCount, purchases, revenue, ctr: impressions ? clicks / impressions * 100 : 0, cpc: clicks ? spend / clicks : 0, cpm: impressions ? spend / impressions * 1000 : 0, cvr: clicks ? dbCount / clicks * 100 : 0, cpa: dbCount ? spend / dbCount : 0, roas: spend ? revenue / spend * 100 : 0 };
    }
    function groupMetrics(rows, keyFn, seedFn) {
      const map = new Map();
      for (const row of rows) {
        const key = keyFn(row);
        const cur = map.get(key) || seedFn(row);
        cur.impressions += metricNumber(row.impressions); cur.clicks += metricNumber(row.clicks); cur.spend += metricNumber(row.spend); cur.dbCount += metricNumber(row.dbCount); cur.purchases += metricNumber(row.purchases); cur.revenue += metricNumber(row.revenue);
        if (row.date) { cur.from = !cur.from || row.date < cur.from ? row.date : cur.from; cur.to = !cur.to || row.date > cur.to ? row.date : cur.to; }
        map.set(key, cur);
      }
      return Array.from(map.values()).map(withDerived);
    }
    function metricConnectionStatus(db, filters) {
      const selected = filters.advertiserId ? db.advertisers.filter(a => String(a.id) === filters.advertiserId) : db.advertisers;
      return selected.flatMap(adv => (adv.accounts || []).map(acc => ({
        advertiserId: String(adv.id), advertiserName: adv.name, channel: acc.channel,
        status: acc.status !== 'connected' ? 'disconnected' : IMPLEMENTED_METRIC_CHANNELS.has(acc.channel) ? (acc.last_sync_error ? 'error' : 'connected') : 'connector_unimplemented',
        lastSyncedAt: acc.last_synced_at || null, lastRowCount: acc.last_row_count || 0, error: acc.last_sync_error || null,
      })));
    }
    function metricMeta(db, filters) { return { from: filters.from || null, to: filters.to || null, connections: metricConnectionStatus(db, filters), generatedAt: new Date().toISOString() }; }

    // 중앙 Metrics API — 모든 데이터 화면은 이 계층만 사용합니다.
    if (req.method === 'GET' && pathname === '/api/metrics/daily') {
      const tenantId = await getCurrentTenantId(); const filters = parseMetricQuery(); const db = (await pgReadDb(tenantId, filters));
      const rows = decorateRows(filterMetricRows(db.dailyMetrics, filters), db).sort((a,b) => String(a.date).localeCompare(String(b.date)));
      return sendJson(res, 200, { rows, meta: metricMeta(db, filters) });
    }
    if (req.method === 'GET' && pathname === '/api/metrics/summary') {
      const tenantId = await getCurrentTenantId(); const filters = parseMetricQuery(); const db = (await pgReadDb(tenantId, filters)); const source = filterMetricRows(db.dailyMetrics, filters);
      const summary = withDerived(aggregateMetricRows(source));
      return sendJson(res, 200, { summary, meta: metricMeta(db, filters) });
    }
    if (req.method === 'GET' && pathname === '/api/metrics/media') {
      const tenantId = await getCurrentTenantId(); const filters = parseMetricQuery(); const db = (await pgReadDb(tenantId, filters)); const names = advertiserNameMap(db); const source = filterMetricRows(db.dailyMetrics, filters);
      const rows = groupMetrics(source, r => `${r.channel}`, r => ({ channel: r.channel, impressions:0, clicks:0, spend:0, dbCount:0, purchases:0, revenue:0 })).sort((a,b)=>b.spend-a.spend);
      void names;
      return sendJson(res, 200, { rows, meta: metricMeta(db, filters) });
    }
    if (req.method === 'GET' && pathname === '/api/metrics/advertisers') {
      const tenantId = await getCurrentTenantId(); const filters = parseMetricQuery(); const db = (await pgReadDb(tenantId, filters)); const names = advertiserNameMap(db); const source = filterMetricRows(db.dailyMetrics, filters);
      const rows = groupMetrics(source, r => `${r.advertiserId}`, r => ({ advertiserId: r.advertiserId, advertiserName: names.get(String(r.advertiserId)) || String(r.advertiserId), impressions:0, clicks:0, spend:0, dbCount:0, purchases:0, revenue:0 })).sort((a,b)=>b.spend-a.spend);
      return sendJson(res, 200, { rows, meta: metricMeta(db, filters) });
    }
    if (req.method === 'GET' && pathname === '/api/metrics/campaigns') {
      const tenantId = await getCurrentTenantId(); const filters = parseMetricQuery(); const db = (await pgReadDb(tenantId, filters)); const names = advertiserNameMap(db); const source = filterMetricRows(db.campaignMetrics, filters);
      const rows = groupMetrics(source, r => `${r.advertiserId}|${r.channel}|${r.campaignId}`, r => ({ advertiserId:r.advertiserId, advertiserName:names.get(String(r.advertiserId))||String(r.advertiserId), channel:r.channel, campaignId:r.campaignId, campaignName:r.campaignName, impressions:0, clicks:0, spend:0, dbCount:0, purchases:0, revenue:0 })).sort((a,b)=>b.spend-a.spend);
      return sendJson(res, 200, { rows, dailyRows: decorateRows(source, db), meta: metricMeta(db, filters) });
    }
    if (req.method === 'GET' && pathname === '/api/metrics/creatives') {
      const tenantId = await getCurrentTenantId(); const filters = parseMetricQuery(); const db = (await pgReadDb(tenantId, filters)); const names = advertiserNameMap(db); const source = filterMetricRows(db.creativeDailyMetrics, filters);
      const grouped = new Map();
      for (const row of source) {
        const key=`${row.advertiserId}|${row.channel}|${row.adId}`;
        const cur=grouped.get(key)||{advertiserId:row.advertiserId,advertiserName:names.get(String(row.advertiserId))||String(row.advertiserId),channel:row.channel,campaignId:row.campaignId||'',campaignName:row.campaignName||'',campaignType:row.campaignType||'',adgroupId:row.adgroupId||'',adgroupName:row.adgroupName||'',adId:row.adId,adName:row.adName,thumbnailUrl:row.thumbnailUrl||null,mediaType:row.mediaType||null,carouselImages:row.carouselImages||null,title:row.title||'',body:row.body||'',description:row.description||'',cta:row.cta||'',impressions:0,clicks:0,spend:0,dbCount:0,purchases:0,revenue:0};
        cur.impressions+=metricNumber(row.impressions);cur.clicks+=metricNumber(row.clicks);cur.spend+=metricNumber(row.spend);cur.dbCount+=metricNumber(row.dbCount);cur.purchases+=metricNumber(row.purchases);cur.revenue+=metricNumber(row.revenue);cur.thumbnailUrl=row.thumbnailUrl||cur.thumbnailUrl;cur.mediaType=row.mediaType||cur.mediaType;cur.carouselImages=row.carouselImages||cur.carouselImages;cur.title=row.title||cur.title;cur.body=row.body||cur.body;cur.description=row.description||cur.description;cur.cta=row.cta||cur.cta;grouped.set(key,cur);
      }
      const rows=Array.from(grouped.values()).map(withDerived).sort((a,b)=>b.spend-a.spend);
      return sendJson(res, 200, { rows, dailyRows: decorateRows(source, db), meta: metricMeta(db, filters) });
    }
    // 소재 상세를 열 때만(목록 전체가 아니라) 그 순간 Meta 미리보기를 요청합니다 - 매번 전체 동기화에서
    // 불러오면 API 호출이 너무 많아지고, 실제로 눌러본 소재만 필요하기 때문입니다.
    if (req.method === 'GET' && pathname === '/api/creative-preview') {
      const query = new URL(req.url, 'http://x').searchParams;
      const adId = cleanText(query.get('adId') || '', 60);
      if (!adId) return sendJson(res, 400, { error: 'adId가 필요합니다.' });
      if (!metaConfigured()) return sendJson(res, 400, { error: 'META_ACCESS_TOKEN이 설정되지 않았습니다.' });
      try {
        const previewUrl = await metaFetchAdPreview(adId);
        return sendJson(res, 200, { previewUrl });
      } catch (error) {
        return sendJson(res, 502, { error: error instanceof Error ? error.message : '미리보기 조회에 실패했습니다.' });
      }
    }

    // ============================================================
    // 레퍼런스 수집 (콘텐츠 → 레퍼런스 수집)
    // ============================================================
    if (pathname.startsWith('/api/references') || pathname.startsWith('/api/reference-')) {
      if (!pgPool) return sendJson(res, 400, { error: 'DATABASE_URL이 설정되지 않았습니다.' });
      const tenantId = await getCurrentTenantId();

      // 커넥터별 지원 현황(진짜 상태) 조회 - 화면에서 "준비중"/"API 권한 필요" 등을 표시하는 데 씁니다.
      if (req.method === 'GET' && pathname === '/api/references/connectors/status') {
        const status = Object.entries(REFERENCE_CONNECTORS).map(([key, c]) => ({
          key, platform: c.platform, label: c.label, referenceType: c.referenceType,
          implemented: c.implemented, capabilities: c.capabilities,
        }));
        return sendJson(res, 200, { connectors: status });
      }

      // 실시간 검색(아직 저장은 안 함) - 검색 결과를 보고 사용자가 골라서 저장합니다.
      if (req.method === 'POST' && pathname === '/api/references/search') {
        const body = await readJson(req);
        const connectorKey = cleanText(body.connector || '', 40);
        const connector = REFERENCE_CONNECTORS[connectorKey];
        if (!connector) return sendJson(res, 400, { error: `알 수 없는 커넥터입니다: ${connectorKey}` });
        const result = await connector.search({
          query: cleanText(body.query || '', 200),
          country: cleanText(body.country || '', 10),
          adType: cleanText(body.adType || '', 20),
          igUserId: cleanText(body.igUserId || '', 60),
          limit: Number(body.limit) || 25,
        });
        // 이미 저장된 레퍼런스는 검색 결과에 표시해서, 사용자가 "이미 수집됨"을 바로 알 수 있게 합니다.
        if (result.items.length) {
          const externalIds = result.items.map(i => i.externalId).filter(Boolean);
          const existing = externalIds.length
            ? await pgPool.query(`SELECT external_id FROM references_store WHERE tenant_id=$1 AND platform=$2 AND external_id = ANY($3::text[])`, [tenantId, connector.platform, externalIds])
            : { rows: [] };
          const existingSet = new Set(existing.rows.map(r => r.external_id));
          for (const item of result.items) item.alreadySaved = existingSet.has(item.externalId);
        }
        // apiFetch는 HTTP 상태가 200이 아니면 응답 본문의 message를 무시하고 res.statusText로
        // 대체해버려서, 항상 200으로 응답하고 성공/실패 여부는 body.status 필드로 구분합니다.
        return sendJson(res, 200, { ...result, platform: connector.platform, referenceType: connector.referenceType });
      }

      // 검색 결과(또는 수동 입력)를 실제로 저장합니다.
      if (req.method === 'POST' && pathname === '/api/references') {
        const body = await readJson(req);
        const item = body.item || {};
        const referenceType = cleanText(body.referenceType || item.referenceType || '', 30) || 'ORGANIC_CONTENT';
        const platform = cleanText(body.platform || item.platform || '', 30);
        if (!platform) return sendJson(res, 400, { error: 'platform이 필요합니다.' });
        const canonicalUrl = item.canonicalUrl ? item.canonicalUrl.split('?')[0] : null;
        try {
          const insert = await pgPool.query(
            `INSERT INTO references_store (
              tenant_id, advertiser_id, reference_type, platform, source_type, external_id, url, canonical_url,
              title, body, headline, description, cta, author_id, author_name, author_followers,
              thumbnail_url, media_url, media_type, content_type, ad_status, ad_started_at,
              published_at, views, likes, comments, shares, saves, available_metrics, raw_text, transcript, raw_metadata, created_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
            RETURNING id`,
            [
              tenantId, body.advertiserId || null, referenceType, platform, body.sourceType || 'collected',
              item.externalId || null, item.url || null, canonicalUrl,
              item.title || null, item.body || null, item.headline || null, item.description || null, item.cta || null,
              item.authorId || null, item.authorName || null, item.authorFollowers ?? null,
              item.thumbnailUrl || null, item.mediaUrl || null, item.mediaType || null, item.contentType || null,
              item.adStatus || null, item.adStartedAt || null, item.publishedAt || null,
              item.views ?? null, item.likes ?? null, item.comments ?? null, item.shares ?? null, item.saves ?? null,
              item.availableMetrics || [], item.rawText || null, item.transcript || null,
              item.rawMetadata ? JSON.stringify(item.rawMetadata) : null, body.createdBy || 'admin',
            ]
          );
          await addLog(tenantId, 'reference_saved', { platform, referenceType });
          return sendJson(res, 201, { id: insert.rows[0].id });
        } catch (err) {
          if (String(err?.code) === '23505') return sendJson(res, 409, { error: '이미 수집된 레퍼런스입니다.' });
          return sendJson(res, 500, { error: err instanceof Error ? err.message : '저장에 실패했습니다.' });
        }
      }

      // URL 직접 저장 - 가능한 경우 메타데이터(og:title 등)를 가져와 채웁니다.
      if (req.method === 'POST' && pathname === '/api/references/url') {
        const body = await readJson(req);
        const url = cleanText(body.url || '', 2000);
        if (!url) return sendJson(res, 400, { error: 'url이 필요합니다.' });
        let title = body.title || null, thumbnailUrl = body.thumbnailUrl || null, siteName = null, description = body.description || null;
        try {
          const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
          const html = await resp.text();
          const og = (prop) => html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1]
            || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'))?.[1] || null;
          title = title || og('title') || html.match(/<title>([^<]+)<\/title>/i)?.[1] || null;
          thumbnailUrl = thumbnailUrl || og('image');
          description = description || og('description');
          siteName = og('site_name');
        } catch (err) {
          console.error('[reference-url 메타데이터 조회 실패]', err?.message || err);
          // 메타데이터를 못 가져와도 URL 자체는 저장할 수 있게 계속 진행합니다(사용자가 직접 입력 가능).
        }
        try {
          const insert = await pgPool.query(
            `INSERT INTO references_store (tenant_id, advertiser_id, reference_type, platform, source_type, url, canonical_url, title, description, thumbnail_url, published_at, created_by)
             VALUES ($1,$2,$3,$4,'manual_url',$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
            [tenantId, body.advertiserId || null, body.referenceType || 'ORGANIC_CONTENT', siteName || 'manual', url, url.split('?')[0], title, description, thumbnailUrl, body.publishedAt || null, body.createdBy || 'admin']
          );
          return sendJson(res, 201, { id: insert.rows[0].id, title, thumbnailUrl, description });
        } catch (err) {
          if (String(err?.code) === '23505') return sendJson(res, 409, { error: '이미 수집된 레퍼런스입니다.' });
          return sendJson(res, 500, { error: err instanceof Error ? err.message : '저장에 실패했습니다.' });
        }
      }

      // 목록 조회 (필터 다수 지원)
      if (req.method === 'GET' && pathname === '/api/references') {
        const q = new URL(req.url, 'http://x').searchParams;
        const clauses = ['r.tenant_id = $1']; const params = [tenantId];
        const add = (sql, val) => { params.push(val); clauses.push(sql.replace('?', `$${params.length}`)); };
        if (q.get('referenceType')) add('r.reference_type = ?', q.get('referenceType'));
        if (q.get('platform')) add('r.platform = ?', q.get('platform'));
        if (q.get('advertiserId')) add('r.advertiser_id = ?', q.get('advertiserId'));
        if (q.get('status')) add('r.status = ?', q.get('status'));
        if (q.get('contentType')) add('r.content_type = ?', q.get('contentType'));
        if (q.get('from')) add('r.published_at >= ?', q.get('from'));
        if (q.get('to')) add('r.published_at <= ?', q.get('to'));
        if (q.get('query')) { const kw = `%${q.get('query')}%`; params.push(kw, kw); clauses.push(`(r.title ILIKE $${params.length - 1} OR r.body ILIKE $${params.length})`); }
        if (q.get('minViews')) add('r.views >= ?', Number(q.get('minViews')));
        if (q.get('minLikes')) add('r.likes >= ?', Number(q.get('minLikes')));
        if (q.get('minComments')) add('r.comments >= ?', Number(q.get('minComments')));
        if (q.get('minFollowers')) add('r.author_followers >= ?', Number(q.get('minFollowers')));
        if (q.get('collectionId')) { params.push(q.get('collectionId')); clauses.push(`r.id IN (SELECT reference_id FROM reference_collection_items WHERE collection_id = $${params.length})`); }
        if (q.get('tag')) { params.push(q.get('tag')); clauses.push(`r.id IN (SELECT tl.reference_id FROM reference_tag_links tl JOIN reference_tags t ON t.id=tl.tag_id WHERE t.name = $${params.length})`); }
        const sortMap = { latest: 'r.published_at DESC NULLS LAST', views: 'r.views DESC NULLS LAST', likes: 'r.likes DESC NULLS LAST', comments: 'r.comments DESC NULLS LAST' };
        const sort = sortMap[q.get('sort')] || 'r.collected_at DESC';
        const limit = Math.min(Number(q.get('limit')) || 60, 200);
        const rows = await pgPool.query(
          `SELECT r.*, a.name as advertiser_name,
             COALESCE(json_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '[]') as tags
           FROM references_store r
           LEFT JOIN advertisers a ON a.id = r.advertiser_id
           LEFT JOIN reference_tag_links tl ON tl.reference_id = r.id
           LEFT JOIN reference_tags t ON t.id = tl.tag_id
           WHERE ${clauses.join(' AND ')}
           GROUP BY r.id, a.name
           ORDER BY ${sort} LIMIT ${limit}`, params);
        // 계정 규모 대비 반응(팔로워 대비 조회/좋아요/댓글 비율)을 AI 없이 서버에서 직접 계산합니다.
        const items = rows.rows.map(r => {
          const followers = r.author_followers ? Number(r.author_followers) : null;
          const ratio = (v) => (followers && v != null) ? Number(v) / followers : null;
          return { ...r, viewFollowerRatio: ratio(r.views), likeFollowerRatio: ratio(r.likes), commentFollowerRatio: ratio(r.comments) };
        });
        return sendJson(res, 200, { items });
      }

      // 요약 KPI: 오늘 수집 / 이번 주 수집 / 저장한 레퍼런스 / 등록 키워드(수집 규칙 기준)
      if (req.method === 'GET' && pathname === '/api/references/summary') {
        const [today, week, total, rules] = await Promise.all([
          pgPool.query(`SELECT count(*) FROM references_store WHERE tenant_id=$1 AND collected_at >= CURRENT_DATE`, [tenantId]),
          pgPool.query(`SELECT count(*) FROM references_store WHERE tenant_id=$1 AND collected_at >= CURRENT_DATE - INTERVAL '7 days'`, [tenantId]),
          pgPool.query(`SELECT count(*) FROM references_store WHERE tenant_id=$1 AND status IN ('saved','used_in_production')`, [tenantId]),
          pgPool.query(`SELECT count(*) FROM reference_collection_rules WHERE tenant_id=$1 AND is_active=true`, [tenantId]),
        ]);
        return sendJson(res, 200, {
          todayCollected: Number(today.rows[0].count), weekCollected: Number(week.rows[0].count),
          savedReferences: Number(total.rows[0].count), activeKeywordRules: Number(rules.rows[0].count),
        });
      }

      // 상세 조회
      const detailMatch = pathname.match(/^\/api\/references\/([^/]+)$/);
      if (req.method === 'GET' && detailMatch) {
        const r = await pgPool.query(
          `SELECT r.*, a.name as advertiser_name, COALESCE(json_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '[]') as tags
           FROM references_store r LEFT JOIN advertisers a ON a.id=r.advertiser_id
           LEFT JOIN reference_tag_links tl ON tl.reference_id=r.id LEFT JOIN reference_tags t ON t.id=tl.tag_id
           WHERE r.id=$1 AND r.tenant_id=$2 GROUP BY r.id, a.name`, [detailMatch[1], tenantId]);
        if (!r.rows.length) return sendJson(res, 404, { error: '레퍼런스를 찾을 수 없습니다.' });
        const collections = await pgPool.query(`SELECT c.id, c.name FROM reference_collections c JOIN reference_collection_items ci ON ci.collection_id=c.id WHERE ci.reference_id=$1`, [detailMatch[1]]);
        return sendJson(res, 200, { ...r.rows[0], collections: collections.rows });
      }

      // 수정 (상태/즐겨찾기/광고주/메모/태그)
      if (req.method === 'PATCH' && detailMatch) {
        const body = await readJson(req);
        const sets = []; const params = [detailMatch[1], tenantId];
        const set = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };
        if (body.status !== undefined) set('status', body.status);
        if (body.isFavorite !== undefined) set('is_favorite', !!body.isFavorite);
        if (body.advertiserId !== undefined) set('advertiser_id', body.advertiserId || null);
        if (body.note !== undefined) set('note', body.note);
        if (!sets.length && !body.tags) return sendJson(res, 400, { error: '변경할 값이 없습니다.' });
        if (sets.length) await pgPool.query(`UPDATE references_store SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 AND tenant_id = $2`, params);
        if (Array.isArray(body.tags)) {
          await pgPool.query(`DELETE FROM reference_tag_links WHERE reference_id = $1`, [detailMatch[1]]);
          for (const name of body.tags) {
            const t = await pgPool.query(`INSERT INTO reference_tags (tenant_id, name) VALUES ($1,$2) ON CONFLICT (tenant_id, name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [tenantId, name]);
            await pgPool.query(`INSERT INTO reference_tag_links (reference_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [detailMatch[1], t.rows[0].id]);
          }
        }
        return sendJson(res, 200, { ok: true });
      }

      // 삭제
      if (req.method === 'DELETE' && detailMatch) {
        await pgPool.query(`DELETE FROM references_store WHERE id=$1 AND tenant_id=$2`, [detailMatch[1], tenantId]);
        return sendJson(res, 200, { ok: true });
      }

      // "이 레퍼런스로 제작" 사용 이력 기록
      const usageMatch = pathname.match(/^\/api\/references\/([^/]+)\/usage$/);
      if (req.method === 'POST' && usageMatch) {
        const body = await readJson(req);
        await pgPool.query(`INSERT INTO reference_usage (reference_id, used_for, reference_scope, created_by) VALUES ($1,$2,$3,$4)`,
          [usageMatch[1], body.usedFor || '', body.referenceScope || null, body.createdBy || 'admin']);
        await pgPool.query(`UPDATE references_store SET status='used_in_production', updated_at=now() WHERE id=$1 AND status NOT IN ('used_in_production')`, [usageMatch[1]]);
        return sendJson(res, 200, { ok: true });
      }

      // 태그 목록
      if (req.method === 'GET' && pathname === '/api/reference-tags') {
        const r = await pgPool.query(`SELECT id, name FROM reference_tags WHERE tenant_id=$1 ORDER BY name`, [tenantId]);
        return sendJson(res, 200, { tags: r.rows });
      }

      // 컬렉션 CRUD
      if (req.method === 'GET' && pathname === '/api/reference-collections') {
        const r = await pgPool.query(
          `SELECT c.*, count(ci.reference_id) as item_count FROM reference_collections c
           LEFT JOIN reference_collection_items ci ON ci.collection_id=c.id
           WHERE c.tenant_id=$1 GROUP BY c.id ORDER BY c.updated_at DESC`, [tenantId]);
        return sendJson(res, 200, { collections: r.rows });
      }
      if (req.method === 'POST' && pathname === '/api/reference-collections') {
        const body = await readJson(req);
        if (!body.name?.trim()) return sendJson(res, 400, { error: '컬렉션 이름이 필요합니다.' });
        const r = await pgPool.query(`INSERT INTO reference_collections (tenant_id, advertiser_id, name, description, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [tenantId, body.advertiserId || null, body.name.trim(), body.description || null, body.createdBy || 'admin']);
        return sendJson(res, 201, { id: r.rows[0].id });
      }
      const collectionMatch = pathname.match(/^\/api\/reference-collections\/([^/]+)$/);
      if (req.method === 'PATCH' && collectionMatch) {
        const body = await readJson(req);
        await pgPool.query(`UPDATE reference_collections SET name=COALESCE($3,name), description=COALESCE($4,description), updated_at=now() WHERE id=$1 AND tenant_id=$2`,
          [collectionMatch[1], tenantId, body.name || null, body.description ?? null]);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'DELETE' && collectionMatch) {
        await pgPool.query(`DELETE FROM reference_collections WHERE id=$1 AND tenant_id=$2`, [collectionMatch[1], tenantId]);
        return sendJson(res, 200, { ok: true });
      }
      const collectionItemsMatch = pathname.match(/^\/api\/reference-collections\/([^/]+)\/items$/);
      if (req.method === 'POST' && collectionItemsMatch) {
        const body = await readJson(req);
        await pgPool.query(`INSERT INTO reference_collection_items (collection_id, reference_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [collectionItemsMatch[1], body.referenceId]);
        return sendJson(res, 200, { ok: true });
      }
      const collectionItemMatch = pathname.match(/^\/api\/reference-collections\/([^/]+)\/items\/([^/]+)$/);
      if (req.method === 'DELETE' && collectionItemMatch) {
        await pgPool.query(`DELETE FROM reference_collection_items WHERE collection_id=$1 AND reference_id=$2`, [collectionItemMatch[1], collectionItemMatch[2]]);
        return sendJson(res, 200, { ok: true });
      }

      // 수집 규칙 CRUD
      if (req.method === 'GET' && pathname === '/api/reference-collection-rules') {
        const r = await pgPool.query(`SELECT rr.*, a.name as advertiser_name FROM reference_collection_rules rr LEFT JOIN advertisers a ON a.id=rr.advertiser_id WHERE rr.tenant_id=$1 ORDER BY rr.created_at DESC`, [tenantId]);
        return sendJson(res, 200, { rules: r.rows });
      }
      if (req.method === 'POST' && pathname === '/api/reference-collection-rules') {
        const body = await readJson(req);
        if (!body.name?.trim()) return sendJson(res, 400, { error: '수집 이름이 필요합니다.' });
        const r = await pgPool.query(
          `INSERT INTO reference_collection_rules (tenant_id, advertiser_id, name, content_kind, platforms, keywords, exclude_keywords, language, country, date_range_days, min_metrics, mode, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
          [tenantId, body.advertiserId || null, body.name.trim(), body.contentKind || 'BOTH', body.platforms || [], body.keywords || [], body.excludeKeywords || [],
           body.language || null, body.country || null, body.dateRangeDays || 30, JSON.stringify(body.minMetrics || {}), body.mode || 'manual', body.createdBy || 'admin']);
        return sendJson(res, 201, { id: r.rows[0].id });
      }
      const ruleMatch = pathname.match(/^\/api\/reference-collection-rules\/([^/]+)$/);
      if (req.method === 'PATCH' && ruleMatch) {
        const body = await readJson(req);
        const sets = []; const params = [ruleMatch[1], tenantId];
        const set = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };
        if (body.name !== undefined) set('name', body.name);
        if (body.isActive !== undefined) set('is_active', !!body.isActive);
        if (body.keywords !== undefined) set('keywords', body.keywords);
        if (body.minMetrics !== undefined) set('min_metrics', JSON.stringify(body.minMetrics));
        if (!sets.length) return sendJson(res, 400, { error: '변경할 값이 없습니다.' });
        await pgPool.query(`UPDATE reference_collection_rules SET ${sets.join(', ')}, updated_at=now() WHERE id=$1 AND tenant_id=$2`, params);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'DELETE' && ruleMatch) {
        await pgPool.query(`DELETE FROM reference_collection_rules WHERE id=$1 AND tenant_id=$2`, [ruleMatch[1], tenantId]);
        return sendJson(res, 200, { ok: true });
      }
      // 수집 규칙 복제
      const ruleDuplicateMatch = pathname.match(/^\/api\/reference-collection-rules\/([^/]+)\/duplicate$/);
      if (req.method === 'POST' && ruleDuplicateMatch) {
        const r = await pgPool.query(
          `INSERT INTO reference_collection_rules (tenant_id, advertiser_id, name, content_kind, platforms, keywords, exclude_keywords, language, country, date_range_days, min_metrics, mode, created_by)
           SELECT tenant_id, advertiser_id, name || ' (복제)', content_kind, platforms, keywords, exclude_keywords, language, country, date_range_days, min_metrics, mode, created_by
           FROM reference_collection_rules WHERE id=$1 AND tenant_id=$2 RETURNING id`, [ruleDuplicateMatch[1], tenantId]);
        if (!r.rows.length) return sendJson(res, 404, { error: '수집 규칙을 찾을 수 없습니다.' });
        return sendJson(res, 201, { id: r.rows[0].id });
      }
      // 규칙을 지금 즉시 1회 실행 (수동 트리거 - 백그라운드 자동 스케줄러는 별도 자동화 단계에서 연결)
      const ruleRunMatch = pathname.match(/^\/api\/reference-collection-rules\/([^/]+)\/run$/);
      if (req.method === 'POST' && ruleRunMatch) {
        const rule = await pgPool.query(`SELECT * FROM reference_collection_rules WHERE id=$1 AND tenant_id=$2`, [ruleRunMatch[1], tenantId]);
        if (!rule.rows.length) return sendJson(res, 404, { error: '수집 규칙을 찾을 수 없습니다.' });
        const rr = rule.rows[0];
        const results = {};
        for (const key of (rr.platforms?.length ? rr.platforms : Object.keys(REFERENCE_CONNECTORS))) {
          const connector = REFERENCE_CONNECTORS[key];
          if (!connector) continue;
          if (!connector.implemented) { results[key] = { status: 'connector_unimplemented', saved: 0 }; continue; }
          let saved = 0;
          for (const keyword of (rr.keywords?.length ? rr.keywords : [''])) {
            const search = await connector.search({ query: keyword, limit: 25 });
            for (const item of search.items) {
              try {
                await pgPool.query(
                  `INSERT INTO references_store (tenant_id, advertiser_id, reference_type, platform, source_type, external_id, url, canonical_url, title, body, author_name, author_followers, thumbnail_url, media_type, content_type, published_at, views, likes, comments, shares, saves, available_metrics, raw_metadata, created_by)
                   VALUES ($1,$2,$3,$4,'collected',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) ON CONFLICT DO NOTHING`,
                  [tenantId, rr.advertiser_id, connector.referenceType, connector.platform, item.externalId, item.url, item.canonicalUrl, item.title, item.body,
                   item.authorName, item.authorFollowers ?? null, item.thumbnailUrl, item.mediaType, item.contentType, item.publishedAt,
                   item.views ?? null, item.likes ?? null, item.comments ?? null, item.shares ?? null, item.saves ?? null, item.availableMetrics || [],
                   item.rawMetadata ? JSON.stringify(item.rawMetadata) : null, 'rule:' + rr.name]
                );
                saved++;
              } catch { /* 중복 등은 건너뜁니다 */ }
            }
            results[key] = { status: search.status, saved, message: search.message };
          }
        }
        await pgPool.query(`UPDATE reference_collection_rules SET last_collected_at=now(), last_collected_count=$3 WHERE id=$1 AND tenant_id=$2`,
          [ruleRunMatch[1], tenantId, Object.values(results).reduce((a, r) => a + (r.saved || 0), 0)]);
        return sendJson(res, 200, { results });
      }

      return sendJson(res, 404, { error: 'Not found' });
    }

    if (req.method === 'GET' && pathname === '/api/metrics/keywords') {
      const tenantId = await getCurrentTenantId(); const filters = parseMetricQuery(); const db = (await pgReadDb(tenantId, filters)); const names = advertiserNameMap(db); const source = filterMetricRows(db.keywordDailyMetrics, filters);
      const rows=groupMetrics(source,r=>`${r.advertiserId}|${r.channel}|${r.keywordId||r.keyword}`,r=>({advertiserId:r.advertiserId,advertiserName:names.get(String(r.advertiserId))||String(r.advertiserId),channel:r.channel,campaignId:r.campaignId||'',campaignName:r.campaignName||'',campaignType:r.campaignType||'',adgroupId:r.adgroupId||'',adgroupName:r.adgroupName||'',keywordId:r.keywordId||'',keyword:r.keyword,impressions:0,clicks:0,spend:0,dbCount:0,purchases:0,revenue:0})).sort((a,b)=>b.spend-a.spend);
      const connectedKeywordChannels = [...new Set(metricConnectionStatus(db, filters).filter(x=>KEYWORD_CAPABLE_CHANNELS.includes(x.channel)&&x.status==='connected').map(x=>x.channel))];
      return sendJson(res, 200, { rows, dailyRows: decorateRows(source, db), connectedKeywordChannels, keywordCapableChannels:KEYWORD_CAPABLE_CHANNELS, meta:metricMeta(db,filters) });
    }
    if (req.method === 'GET' && pathname === '/api/metrics/funnel') {
      const tenantId = await getCurrentTenantId(); const filters=parseMetricQuery(); const db=(await pgReadDb(tenantId, filters)); const source=filterMetricRows(db.dailyMetrics,filters);
      const rows=groupMetrics(source,r=>r.channel,r=>({channel:r.channel,impressions:0,clicks:0,spend:0,dbCount:0,purchases:0,revenue:0})).sort((a,b)=>b.spend-a.spend);
      return sendJson(res,200,{rows,meta:metricMeta(db,filters)});
    }
    if (req.method === 'GET' && pathname === '/api/metrics/status') {
      const tenantId = await getCurrentTenantId(); const filters=parseMetricQuery(); const db=(await pgReadDb(tenantId, filters)); return sendJson(res,200,{rows:metricConnectionStatus(db,filters),meta:metricMeta(db,filters)});
    }
    if (req.method === 'GET' && pathname === '/api/integrations/sync-validation') {
      const tenantId = await getCurrentTenantId(); const filters=parseMetricQuery(); const db=(await pgReadDb(tenantId, filters)); let rows=db.syncValidationLogs||[];
      if(filters.advertiserId)rows=rows.filter(r=>String(r.advertiserId)===filters.advertiserId);if(filters.channels.length)rows=rows.filter(r=>filters.channels.includes(String(r.channel)));
      const limit=Math.min(200,Math.max(1,Number(filters.query.get('limit')||50)));
      const names=advertiserNameMap(db);return sendJson(res,200,{rows:rows.slice(0,limit).map(r=>({...r,advertiserName:names.get(String(r.advertiserId))||String(r.advertiserId)}))});
    }

    // 기존 경로 호환: 내부 구현은 중앙 Metrics API와 같은 기간별 저장소를 사용합니다.
    if (req.method === 'GET' && pathname === '/api/daily-metrics') {
      const tenantId = await getCurrentTenantId(); const filters=parseMetricQuery();const db=(await pgReadDb(tenantId, filters));const rows=decorateRows(filterMetricRows(db.dailyMetrics,filters),db).sort((a,b)=>String(a.date).localeCompare(String(b.date)));return sendJson(res,200,{rows,meta:metricMeta(db,filters)});
    }
    if (req.method === 'GET' && pathname === '/api/creative-metrics') {
      const tenantId = await getCurrentTenantId(); const filters=parseMetricQuery();const db=(await pgReadDb(tenantId, filters));const names=advertiserNameMap(db);const source=filterMetricRows(db.creativeDailyMetrics,filters);const grouped=new Map();for(const row of source){const key=`${row.advertiserId}|${row.channel}|${row.adId}`;const cur=grouped.get(key)||{advertiserId:row.advertiserId,advertiserName:names.get(String(row.advertiserId))||String(row.advertiserId),channel:row.channel,campaignId:row.campaignId||'',campaignName:row.campaignName||'',campaignType:row.campaignType||'',adId:row.adId,adName:row.adName,thumbnailUrl:row.thumbnailUrl||null,mediaType:row.mediaType||null,carouselImages:row.carouselImages||null,title:row.title||'',body:row.body||'',description:row.description||'',cta:row.cta||'',impressions:0,clicks:0,spend:0,dbCount:0,purchases:0,revenue:0};cur.impressions+=metricNumber(row.impressions);cur.clicks+=metricNumber(row.clicks);cur.spend+=metricNumber(row.spend);cur.dbCount+=metricNumber(row.dbCount);cur.purchases+=metricNumber(row.purchases);cur.revenue+=metricNumber(row.revenue);grouped.set(key,cur)}return sendJson(res,200,{rows:Array.from(grouped.values()).map(withDerived).sort((a,b)=>b.spend-a.spend),meta:metricMeta(db,filters)});
    }
    if (req.method === 'GET' && pathname === '/api/keyword-metrics') {
      const tenantId = await getCurrentTenantId(); const filters=parseMetricQuery();const db=(await pgReadDb(tenantId, filters));const source=filterMetricRows(db.keywordDailyMetrics,filters);const names=advertiserNameMap(db);const rows=groupMetrics(source,r=>`${r.advertiserId}|${r.channel}|${r.keywordId||r.keyword}`,r=>({advertiserId:r.advertiserId,advertiserName:names.get(String(r.advertiserId))||String(r.advertiserId),channel:r.channel,campaignId:r.campaignId||'',campaignName:r.campaignName||'',campaignType:r.campaignType||'',adgroupId:r.adgroupId||'',adgroupName:r.adgroupName||'',keywordId:r.keywordId||'',keyword:r.keyword,impressions:0,clicks:0,spend:0,dbCount:0,purchases:0,revenue:0})).sort((a,b)=>b.spend-a.spend);const connectedKeywordChannels=[...new Set(metricConnectionStatus(db,filters).filter(x=>KEYWORD_CAPABLE_CHANNELS.includes(x.channel)&&x.status==='connected').map(x=>x.channel))];return sendJson(res,200,{rows,connectedKeywordChannels,keywordCapableChannels:KEYWORD_CAPABLE_CHANNELS,meta:metricMeta(db,filters)});
    }

    // ---- 캠페인 관리 / 전환 퍼널 (ApiAdControlRepository가 호출) --------------------------
    if (req.method === 'GET' && pathname === '/api/campaigns') {
      const tenantId = await getCurrentTenantId();
      const advRes = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id = $1`, [tenantId]);
      const metaAccRes = await pgPool.query(`SELECT advertiser_id, account_id FROM media_accounts WHERE tenant_id=$1 AND channel='meta' AND status='connected'`, [tenantId]);
      const naverAccRes = await pgPool.query(`SELECT advertiser_id, account_id, api_key_encrypted, secret_key_encrypted FROM media_accounts WHERE tenant_id=$1 AND channel='naver' AND status='connected'`, [tenantId]);
      const advNameMap = new Map(advRes.rows.map(a => [a.id, a.name]));
      const campaigns = [];
      if (metaConfigured()) {
        for (const acc of metaAccRes.rows) {
          if (!acc.account_id) continue;
          try {
            const rows = await metaListCampaigns(acc.account_id);
            for (const c of rows) {
              campaigns.push({
                id: c.id, advertiserId: acc.advertiser_id, platform: 'meta', name: c.name,
                accountName: `${advNameMap.get(acc.advertiser_id) || ''} Meta`, budget: Number(c.daily_budget || c.lifetime_budget || 0),
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
      for (const acc of naverAccRes.rows) {
        const apiKey = decryptSecret(acc.api_key_encrypted), secretKey = decryptSecret(acc.secret_key_encrypted);
        if (!apiKey || !secretKey) continue;
        try {
          const credentials = { customerId: acc.account_id, apiKey, secretKey };
          const rows = await naverFetchCampaigns(credentials);
          for (const c of rows) {
            campaigns.push({
              id: c.nccCampaignId, advertiserId: acc.advertiser_id, platform: 'naver', name: c.name,
              accountName: `${advNameMap.get(acc.advertiser_id) || ''} 네이버`, budget: Number(c.dailyBudget || 0),
              budgetType: c.useDailyBudget === false ? 'total' : 'daily',
              startAt: c.regTm || new Date().toISOString(), endAt: undefined,
              status: c.userLock || String(c.status || '').includes('PAUSE') ? 'off' : (c.status === 'ELIGIBLE' ? 'on' : 'review'),
              lastSyncedAt: new Date().toISOString(),
              capability: { upload: false, toggle: false, schedule: false },
            });
          }
        } catch { /* 한 광고주에서 실패해도 나머지는 계속 보여줍니다. */ }
      }
      return sendJson(res, 200, campaigns);
    }
    if (req.method === 'PUT' && pathname === '/api/campaigns') {
      // 캠페인 on/off 전환 등 실제 Meta 반영은 ads_management 권한이 필요합니다(현재 ads_read만 사용).
      return sendJson(res, 200, { ok: true, note: '읽기 전용 토큰이라 실제 매체에는 반영되지 않았습니다.' });
    }

    if (req.method === 'GET' && pathname === '/api/funnels/channels') {
      const tenantId = await getCurrentTenantId();
      const db = await pgReadDb(tenantId);
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

    // ---- 광고 캘린더 (schedule-slots, PostgreSQL) --------------------------------------
    if (req.method === 'GET' && pathname === '/api/schedule-slots') {
      const tenantId = await getCurrentTenantId();
      const r = await pgPool.query(`SELECT id, data FROM schedule_slots WHERE tenant_id=$1`, [tenantId]);
      return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), id: row.id })));
    }
    const slotMatch = pathname.match(/^\/api\/schedule-slots\/([^/]+)$/);
    if (slotMatch && req.method === 'PUT') {
      const id = decodeURIComponent(slotMatch[1]);
      const body = await readJson(req);
      const tenantId = await getCurrentTenantId();
      const saved = { ...body, id };
      await pgPool.query(
        `INSERT INTO schedule_slots (id, tenant_id, data) VALUES ($1,$2,$3)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [id, tenantId, JSON.stringify(saved)]
      );
      return sendJson(res, 200, saved);
    }
    if (slotMatch && req.method === 'DELETE') {
      const id = decodeURIComponent(slotMatch[1]);
      const tenantId = await getCurrentTenantId();
      await pgPool.query(`DELETE FROM schedule_slots WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
      return sendJson(res, 200, { ok: true });
    }

    // ---- 데이터 수집 현황 -----------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/integrations/status') {
      const tenantId = await getCurrentTenantId();
      const db = await pgReadDb(tenantId);
      console.log(`[데이터 수집 현황] tenantId=${tenantId}, 광고주 ${db.advertisers.length}명`);
      for (const adv of db.advertisers) {
        console.log(`[데이터 수집 현황]   - ${adv.name}(${adv.id}): 계정 ${(adv.accounts || []).length}개 ${JSON.stringify(adv.accounts)}`);
      }
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
      console.log(`[데이터 수집 현황] 최종 결과 ${rows.length}행`);
      return sendJson(res, 200, { rows });
    }

    if (req.method === 'GET' && pathname === '/api/blog/projects') {
      const tenantId = await getCurrentTenantId();
      const r = await pgPool.query(`SELECT id, data FROM blog_projects WHERE tenant_id=$1 ORDER BY created_at DESC`, [tenantId]);
      return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), projectId: row.id })));
    }
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
      const tenantId = await getCurrentTenantId();
      // advertiserId는 광고주명을 찾기 위한 값일 뿐, blog_projects.advertiser_id 외래키는 실제 UUID를 찾아 넣습니다(찾지 못해도 저장은 계속합니다).
      const advRes = await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]).catch(() => ({ rows: [] }));
      await pgPool.query(`INSERT INTO blog_projects (id, tenant_id, advertiser_id, data) VALUES ($1,$2,$3,$4)`,
        [row.projectId, tenantId, advRes.rows[0]?.id || null, JSON.stringify(row)]);
      return sendJson(res, 201, row);
    }
    const projectMatch = pathname.match(/^\/api\/blog\/projects\/([^/]+)$/);
    if (projectMatch && req.method === 'GET') {
      const tenantId = await getCurrentTenantId();
      const r = await pgPool.query(`SELECT data FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, decodeURIComponent(projectMatch[1])]);
      return r.rows[0] ? sendJson(res, 200, r.rows[0].data) : sendJson(res, 404, { error: '블로그 프로젝트를 찾을 수 없습니다.' });
    }
    if (projectMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
      const id = decodeURIComponent(projectMatch[1]); const patch = await readJson(req);
      const tenantId = await getCurrentTenantId();
      const cur = await pgPool.query(`SELECT data FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
      const currentBeforeUpdate = cur.rows[0]?.data;
      if (!currentBeforeUpdate) return sendJson(res, 404, { error: '블로그 프로젝트를 찾을 수 없습니다.' });
      if (currentBeforeUpdate.medicalReview?.locked && (patch.blocks || patch.selectedTitle) && !patch.unlockForRevision) {
        return sendJson(res, 409, { error: '심의 완료 문안이 잠겨 있습니다. 재검토로 전환한 뒤 수정하세요.' });
      }
      const safePatch = { ...patch }; delete safePatch.projectId; delete safePatch.createdAt; delete safePatch.unlockForRevision;
      const updated = { ...currentBeforeUpdate, ...safePatch, updatedAt: new Date().toISOString() };
      await pgPool.query(`UPDATE blog_projects SET data=$3, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, JSON.stringify(updated)]);
      return sendJson(res, 200, updated);
    }
    if (projectMatch && req.method === 'DELETE') {
      const id = decodeURIComponent(projectMatch[1]);
      const tenantId = await getCurrentTenantId();
      await pgPool.query(`DELETE FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && pathname === '/api/blog/ai-status') {
      return sendJson(res, 200, blogAiStatus());
    }

    if (req.method === 'POST' && pathname === '/api/blog/generate') {
      const body = await readJson(req); const keyword = cleanText(body.primaryKeyword, 200); const advertiser = cleanText(body.advertiserName || '광고주', 120); const region = cleanText(body.region || '', 80);
      if (!keyword) return sendJson(res, 400, { error: '메인 키워드를 입력하세요.' });

      if (!blogAiConfigured()) {
        return sendJson(res, 400, { error: '블로그 AI가 연결되지 않았습니다. 관리자가 외부 AI API를 연결해주세요.' });
      }
      try {
        const ai = await callExternalBlogAi({
          advertiser, industry: body.industry, platform: body.platform, contentType: body.contentType,
          keyword, secondaryKeywords: body.secondaryKeywords, region, targetLength: body.targetLength,
          tone: body.tone, preferredPhrases: body.preferredPhrases, prohibitedPhrases: body.prohibitedPhrases, cta: body.cta,
        });
        return sendJson(res, 200, { generator: `external-ai:${BLOG_AI_PROVIDER}`, titles: ai.titles, blocks: ai.blocks });
      } catch (error) {
        return sendJson(res, 502, { error: error instanceof Error ? `외부 AI 원고 생성에 실패했습니다: ${error.message}` : '외부 AI 원고 생성에 실패했습니다. 다시 시도해주세요.' });
      }
    }

    const styleMatch = pathname.match(/^\/api\/blog\/styles\/([^/]+)$/);
    if (styleMatch && req.method === 'GET') {
      const advertiserId = decodeURIComponent(styleMatch[1]);
      const tenantId = await getCurrentTenantId();
      const r = await pgPool.query(`SELECT data FROM blog_styles WHERE tenant_id=$1 AND advertiser_id::text=$2`, [tenantId, advertiserId]);
      return sendJson(res, 200, r.rows[0]?.data || { advertiserId, tone: '', rules: [], preferredPhrases: [], prohibitedPhrases: [], cta: '', sourceTexts: [] });
    }
    if (styleMatch && req.method === 'PUT') {
      const advertiserId = decodeURIComponent(styleMatch[1]); const body = await readJson(req);
      const tenantId = await getCurrentTenantId();
      const updated = { advertiserId, ...body, advertiserId, updatedAt: new Date().toISOString() };
      await pgPool.query(
        `INSERT INTO blog_styles (tenant_id, advertiser_id, data) VALUES ($1,$2,$3)
         ON CONFLICT (tenant_id, advertiser_id) DO UPDATE SET data = EXCLUDED.data`,
        [tenantId, advertiserId, JSON.stringify(updated)]
      );
      return sendJson(res, 200, updated);
    }

    if (req.method === 'GET' && pathname === '/api/blog/assets') {
      const tenantId = await getCurrentTenantId();
      const r = await pgPool.query(`SELECT id, data FROM blog_assets WHERE tenant_id=$1 ORDER BY created_at DESC`, [tenantId]);
      return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), assetId: row.id })));
    }
    if (req.method === 'POST' && pathname === '/api/blog/assets') {
      const body=await readJson(req); const row={assetId:makeId('asset'),advertiserId:cleanText(body.advertiserId,120),name:cleanText(body.name,200),url:cleanText(body.url,1000),tags:Array.isArray(body.tags)?body.tags.map(x=>cleanText(x,80)).filter(Boolean):[],createdAt:new Date().toISOString()};
      if(!row.advertiserId||!row.name)return sendJson(res,400,{error:'광고주와 자산명을 입력하세요.'});
      const tenantId = await getCurrentTenantId();
      await pgPool.query(`INSERT INTO blog_assets (id, tenant_id, data) VALUES ($1,$2,$3)`, [row.assetId, tenantId, JSON.stringify(row)]);
      return sendJson(res,201,row);
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

// ============================================================
// 자동 동기화 스케줄러
// ------------------------------------------------------------
// 새 동기화 로직을 따로 만들지 않고, 이미 검증된 handleApi의 '/api/integrations/sync'
// 경로를 내부적으로 그대로 호출합니다(실제 HTTP 요청 없이, 가짜 req/res로 흉내).
// 이렇게 하면 수동 동기화와 자동 동기화가 항상 완전히 같은 코드로 동작합니다.
// ============================================================
const EventEmitter = (await import('node:events')).EventEmitter;

/** handleApi를 실제 HTTP 요청 없이 내부에서 호출합니다. */
async function callApiInternally(method, pathname, bodyObj) {
  const now = Math.floor(Date.now() / 1000);
  const internalToken = signToken({ sub: ADMIN_USER.id, email: ADMIN_USER.email, role: ADMIN_USER.role, iat: now, exp: now + 300 });
  const req = new EventEmitter();
  req.method = method;
  req.url = pathname;
  req.headers = { authorization: `Bearer ${internalToken}`, 'content-type': 'application/json' };
  process.nextTick(() => { req.emit('data', Buffer.from(JSON.stringify(bodyObj || {}))); req.emit('end'); });

  let statusCode = 0; let responseBody = null;
  const res = {
    writeHead(status) { statusCode = status; },
    end(body) { try { responseBody = body ? JSON.parse(body) : null; } catch { responseBody = body; } },
    getHeader() { return undefined; },
    setHeader() {},
  };
  await handleApi(req, res, pathname);
  return { status: statusCode, body: responseBody };
}

/** 지금 이 순간 연결되어 있는 모든 Meta/네이버 계정을 최근 N일 기준으로 자동 동기화합니다. */
/** 화면에서 "자동 동기화 상태"를 보여줄 수 있도록, 가장 최근 실행 결과를 메모리에 기록해둡니다. */
let autoSyncStatus = { lastRunAt: null, lastResult: null };

async function runScheduledSyncForAllAccounts(days = 3) {
  if (!pgPool) { console.log('[자동 동기화] DATABASE_URL이 없어 건너뜁니다.'); return; }
  const accounts = await pgPool.query(
    `SELECT tenant_id, advertiser_id, channel FROM media_accounts WHERE status='connected' AND channel IN ('meta','naver')`
  );
  console.log(`[자동 동기화] 시작 - 연결된 계정 ${accounts.rows.length}개, 최근 ${days}일 기준`);
  let success = 0, failed = 0;
  for (const row of accounts.rows) {
    try {
      const result = await callApiInternally('POST', '/api/integrations/sync', { advertiserId: row.advertiser_id, channel: row.channel, days });
      if (result.status === 200 && result.body?.ok) success++;
      else { failed++; console.error(`[자동 동기화 실패] ${row.channel} advertiser=${row.advertiser_id}:`, result.body?.error || `HTTP ${result.status}`); }
    } catch (error) {
      failed++;
      console.error(`[자동 동기화 예외] ${row.channel} advertiser=${row.advertiser_id}:`, error?.message || error);
    }
    // 매체 API에 요청이 한꺼번에 몰리지 않도록 계정 사이에 약간의 간격을 둡니다.
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`[자동 동기화] 완료 - 성공 ${success}개, 실패 ${failed}개`);
  autoSyncStatus = { lastRunAt: new Date().toISOString(), lastResult: { total: accounts.rows.length, success, failed } };
}

/** 매일 07:00, 09:00, 13:00, 17:00, 19:00(한국 시간)에 자동 동기화를 실행합니다. */
const AUTO_SYNC_HOURS_KST = [7, 9, 13, 17, 19];
let lastAutoSyncKey = '';
function scheduleAutoSync() {
  setInterval(() => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: 'numeric', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const get = (type) => parts.find(p => p.type === type)?.value;
    const hour = Number(get('hour')); const minute = Number(get('minute'));
    const dateKey = `${get('year')}-${get('month')}-${get('day')}-${hour}`;
    // 같은 시각(예: 07시)에 여러 번 실행되지 않도록, 그 시각의 첫 1분(0분)에만 실행하고 키로 중복을 막습니다.
    if (minute === 0 && AUTO_SYNC_HOURS_KST.includes(hour) && lastAutoSyncKey !== dateKey) {
      lastAutoSyncKey = dateKey;
      console.log(`[자동 동기화] 예약 시각 도달: 한국시간 ${hour}시`);
      runScheduledSyncForAllAccounts().catch(error => console.error('[자동 동기화] 처리되지 않은 오류:', error?.message || error));
    }
  }, 60_000);
  console.log(`[자동 동기화] 스케줄러 시작 - 매일 한국시간 ${AUTO_SYNC_HOURS_KST.join(', ')}시에 자동 실행됩니다.`);
}
if (pgPool) scheduleAutoSync();

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
