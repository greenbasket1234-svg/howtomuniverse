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
const root = path.join(baseDir, 'dist');
const port = Number(process.env.PORT || 5173);
const isPublicRuntime = process.env.NODE_ENV === 'production'
  || Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID);
const allowInsecureDemoApi = process.env.HOWTOM_ALLOW_INSECURE_DEMO_API === 'true';
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json; charset=utf-8' };

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
  name: '관리자',
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

function isLoopbackAddress(address = '') {
  const value = String(address).toLowerCase();
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
}

function demoApiAllowedForRequest(req) {
  if (allowInsecureDemoApi) return true;
  if (isPublicRuntime) return false;
  return isLoopbackAddress(req.socket?.remoteAddress);
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


const SAMPLE_ADVERTISERS = [
  { id: 'dabang-move', name: '다방이사', monthly_budget: 9000000, brand_color: '#2563eb', accounts: [] },
  { id: 'dashima-abalone', name: '다시마전복수산', monthly_budget: 6000000, brand_color: '#10b981', accounts: [] },
  { id: 'seoul-woori-kids-dental', name: '서울우리아이치과', monthly_budget: 10000000, brand_color: '#f59e0b', accounts: [] },
  { id: 'wando-fisheries', name: '완도군수산', monthly_budget: 4000000, brand_color: '#059669', accounts: [] },
  { id: 'ondong-animal', name: '온동물병원', monthly_budget: 2500000, brand_color: '#8b5cf6', accounts: [] },
  { id: 'rs-company', name: 'RS컴퍼니', monthly_budget: 8000000, brand_color: '#0ea5e9', accounts: [] },
  { id: 'unmyeong', name: '운명백과', monthly_budget: 2000000, brand_color: '#a855f7', accounts: [] },
];

function sampleLogs() {
  const now = Date.now();
  return [
    { id: 1, type: 'batch', channel: 'meta', advertiser_name: '다방이사', message: 'Meta 일일 데이터 수집 완료', detail: 'DB, 클릭수, 노출수, 광고비 자동 입력', status: 'success', created_at: new Date(now).toISOString() },
    { id: 2, type: 'connect', channel: 'naver', advertiser_name: '다시마전복수산', message: '네이버 광고 API 연결 대기', detail: '실제 API 키 등록 후 자동 수집 활성화 예정', status: 'warning', created_at: new Date(now - 3600_000).toISOString() },
    { id: 3, type: 'batch', channel: 'google', advertiser_name: '서울우리아이치과', message: '클릭 성과형 리포트 데모 데이터 갱신', detail: '클릭수, 광고비, CPC 계산 완료', status: 'info', created_at: new Date(now - 7200_000).toISOString() },
  ];
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
      return sendJson(res, 200, {
        ok: true,
        service: 'howtom-universe-static-server',
        publicRuntime: isPublicRuntime,
        demoApiEnabled: demoApiAllowedForRequest(req),
        authBackendImplemented: true,
      });
    }
    // 인증 라우트는 공개 배포 환경에서도 항상 동작해야 하므로,
    // 데모 API 차단 게이트보다 먼저 처리합니다.
    if (await handleAuth(req, res, pathname)) return;

    if (!demoApiAllowedForRequest(req)) {
      return sendJson(res, 503, {
        error: '공개 환경에서는 인증 없는 내장 데모 API가 차단됩니다. 실제 인증·DB 백엔드를 연결하세요.',
        code: 'DEMO_API_DISABLED_PUBLIC',
      });
    }
    if (req.method === 'GET' && pathname === '/api/advertisers') return sendJson(res, 200, SAMPLE_ADVERTISERS);
    if (req.method === 'GET' && pathname === '/api/logs') return sendJson(res, 200, sampleLogs());
    if (req.method === 'PUT' && /^\/api\/advertisers\/[^/]+$/.test(pathname)) {
      await readJson(req);
      return sendJson(res, 200, { ok: true, mode: 'demo', message: '데모 모드에서 광고계정 정보가 저장 처리되었습니다.' });
    }
    if (req.method === 'POST' && /^\/api\/advertisers\/[^/]+\/channels\/[^/]+\/test$/.test(pathname)) {
      await readJson(req);
      return sendJson(res, 200, { ok: true, mode: 'demo', message: '데모 모드 연결 성공' });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: '지원하지 않는 요청 방식입니다.' });
    const payload = await readJson(req);
    if (pathname === '/api/reports/daily-performance') {
      return sendJson(res, 200, { ok: true, mode: 'demo', collectedAt: new Date().toISOString(), advertiserName: payload.advertiserName, reportType: payload.reportType, source: {} });
    }
    if (pathname === '/api/integrations/google-sheets') {
      const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      if (!url) throw new Error('GOOGLE_SHEETS_WEBHOOK_URL 환경변수를 설정하거나 환경설정에 Apps Script URL을 입력하세요.');
      const result = await forwardWebhook(url, payload);
      return sendJson(res, 200, { ok: true, result });
    }
    if (pathname === '/api/integrations/notion') {
      if (process.env.NOTION_WEBHOOK_URL) {
        const result = await forwardWebhook(process.env.NOTION_WEBHOOK_URL, payload);
        return sendJson(res, 200, { ok: true, result });
      }
      const result = await createNotionPage(payload);
      return sendJson(res, 200, result);
    }
    return sendJson(res, 404, { error: 'API 경로를 찾을 수 없습니다.' });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : '연동 처리에 실패했습니다.' });
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
  if (isPublicRuntime && !allowInsecureDemoApi) console.log('[보안] 공개 실행 환경 감지: 인증 없는 내장 데모 API를 차단했습니다.');
});
