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
const EMPTY_DB = Object.freeze({ advertisers: [], blogProjects: [], blogStyles: [], blogAssets: [], logs: [] });

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
    };
  } catch {
    return { advertisers: [], blogProjects: [], blogStyles: [], blogAssets: [], logs: [] };
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
async function metaFetchInsights(accountId, since, until) {
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const data = await metaGraphGet(`/${id}/insights`, {
    time_range: JSON.stringify({ since, until }),
    fields: 'impressions,clicks,spend,actions,date_start,date_stop',
    time_increment: '1', // 날짜별로 쪼개서 반환
    level: 'account',
  });
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(row => ({
    date: row.date_start,
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    spend: Number(row.spend || 0),
    // actions 배열 안에서 리드/전환에 해당하는 action_type만 골라 합산합니다.
    // 브랜드마다 어떤 action_type을 "전환"으로 볼지 다를 수 있어 대표적인 것만 기본 포함합니다.
    dbCount: (row.actions || [])
      .filter(a => ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'].includes(a.action_type))
      .reduce((sum, a) => sum + Number(a.value || 0), 0),
  }));
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
    if (!email || !password) { sendJson(res, 400, { error: '아이디와 비밀번호를 입력하세요.' }); return true; }

    const emailOk = timingSafeStringEqual(email, ADMIN_EMAIL);
    const passwordOk = timingSafeStringEqual(password, ADMIN_PASSWORD);
    if (!emailOk || !passwordOk) { sendJson(res, 401, { error: '아이디 또는 비밀번호가 올바르지 않습니다.' }); return true; }

    const now = Math.floor(Date.now() / 1000);
    const token = signToken({ sub: ADMIN_USER.id, email: ADMIN_USER.email, role: ADMIN_USER.role, iat: now, exp: now + TOKEN_TTL_SECONDS });
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

    if (req.method === 'GET' && pathname === '/api/advertisers') {
      return sendJson(res, 200, readDb().advertisers);
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
      return sendJson(res, 201, row);
    }
    const advertiserMatch = pathname.match(/^\/api\/advertisers\/([^/]+)$/);
    if (advertiserMatch && (req.method === 'PUT' || req.method === 'PATCH')) {
      const id = decodeURIComponent(advertiserMatch[1]); const body = await readJson(req); let updated = null;
      mutateDb(db => {
        const index = db.advertisers.findIndex(x => String(x.id) === id);
        if (index < 0) return;
        updated = { ...db.advertisers[index], ...body, id: db.advertisers[index].id, updated_at: new Date().toISOString() };
        db.advertisers[index] = updated;
      });
      return updated ? sendJson(res, 200, updated) : sendJson(res, 404, { error: '광고주를 찾을 수 없습니다.' });
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
