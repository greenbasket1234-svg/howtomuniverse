// ============================================================
// HOWTOM 콘텐츠 제작소 서버
// ------------------------------------------------------------
// 현재 실제 기능:
//   1) 관리자 로그인 (Universe와 같은 계정, 세션은 별도)
//   2) 공통 PostgreSQL 광고주 조회
//   3) 제작: 광고/블로그/영상대본/문서/템플릿/자산 CRUD (전부 PostgreSQL)
//   4) 레퍼런스: Meta 광고 라이브러리 / YouTube / Instagram 검색·저장·보드·경쟁사
//   5) 레퍼런스 자동 수집 Worker (매일 KST 8·20시)
//   6) 공용 AI Gateway (레퍼런스 AI 분석 등 - 블로그 원고 생성과는 별개)
//   7) dist/ 정적 파일 + SPA 라우팅
//
// 미구현: 이미지 제작, TikTok/Threads 커넥터, AI 의미 기반 검색
// 상세 상태·우선순위는 저장소 루트 PRD.md 참고.
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4100);
const DIST_DIR = path.join(__dirname, 'dist');

const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_EMAIL = process.env.HOWTOM_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.HOWTOM_ADMIN_PASSWORD || '';
const ADMIN_NAME = process.env.HOWTOM_ADMIN_NAME || '관리자';
const DATABASE_URL = process.env.DATABASE_URL || '';

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlDecode(input) {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
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
  try {
    const payload = JSON.parse(base64urlDecode(body));
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
function cleanText(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}
function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

const AD_STATUSES = new Set(['draft','in-progress','review','completed','archived']);
function normalizeAdProject(body = {}, current = null) {
  const stamp = new Date().toISOString();
  const base = current || {};
  const stringList = (value, fallback = []) => Array.isArray(value) ? value.map(x => cleanText(x, 500)).slice(0, 20) : fallback;
  const variantsSource = Array.isArray(body.copyVariants) ? body.copyVariants : (Array.isArray(base.copyVariants) ? base.copyVariants : []);
  const copyVariants = variantsSource.slice(0, 3).map((v, index) => ({
    variantId: cleanText(v?.variantId || `variant-${index + 1}`, 120),
    label: cleanText(v?.label || `${String.fromCharCode(65 + index)}안`, 40),
    headline: cleanText(v?.headline || '', 500),
    description: cleanText(v?.description || '', 1000),
    body: cleanText(v?.body || '', 12000),
    cta: cleanText(v?.cta || '더 알아보기', 120),
  }));
  while (copyVariants.length < 3) {
    const index = copyVariants.length;
    copyVariants.push({ variantId:`variant-${index+1}`, label:`${String.fromCharCode(65+index)}안`, headline:'', description:'', body:'', cta:'더 알아보기' });
  }
  const imageSource = body.imagePlan && typeof body.imagePlan === 'object' ? body.imagePlan : (base.imagePlan || {});
  const videoSource = body.videoPlan && typeof body.videoPlan === 'object' ? body.videoPlan : (base.videoPlan || {});
  const statusCandidate = cleanText(body.status ?? base.status ?? 'draft', 40);
  return {
    ...base,
    projectId: base.projectId || cleanText(body.projectId || '', 120),
    title: cleanText(body.title ?? base.title ?? '새 광고 제작', 240),
    advertiserId: cleanText(body.advertiserId ?? base.advertiserId ?? '', 120),
    advertiserName: cleanText(body.advertiserName ?? base.advertiserName ?? '', 160),
    channel: cleanText(body.channel ?? base.channel ?? '메타', 120),
    objective: cleanText(body.objective ?? base.objective ?? 'DB 수집', 120),
    creativeType: cleanText(body.creativeType ?? base.creativeType ?? '정사각형 이미지', 120),
    representativeKpi: cleanText(body.representativeKpi ?? base.representativeKpi ?? 'DB당 비용', 120),
    target: cleanText(body.target ?? base.target ?? '', 3000),
    keyBenefit: cleanText(body.keyBenefit ?? base.keyBenefit ?? '', 3000),
    price: cleanText(body.price ?? base.price ?? '', 1000),
    mandatoryText: cleanText(body.mandatoryText ?? base.mandatoryText ?? '', 6000),
    prohibitedText: cleanText(body.prohibitedText ?? base.prohibitedText ?? '', 6000),
    landingUrl: cleanText(body.landingUrl ?? base.landingUrl ?? '', 2000),
    format: cleanText(body.format ?? base.format ?? '1:1', 80),
    hookType: cleanText(body.hookType ?? base.hookType ?? '', 120),
    hooks: (() => { const values = stringList(body.hooks, Array.isArray(base.hooks) ? base.hooks : ['', '', '']).slice(0, 3); while (values.length < 3) values.push(''); return values; })(),
    copyVariants,
    imagePlan: {
      visualType: cleanText(imageSource.visualType || '', 500), subject: cleanText(imageSource.subject || '', 3000),
      background: cleanText(imageSource.background || '', 3000), mainText: cleanText(imageSource.mainText || '', 1500),
      subText: cleanText(imageSource.subText || '', 1500), ratio: cleanText(imageSource.ratio || '1:1', 80), textRatio: cleanText(imageSource.textRatio || '', 120),
    },
    videoPlan: {
      length: cleanText(videoSource.length || '', 120), style: cleanText(videoSource.style || '', 500),
      hook3s: cleanText(videoSource.hook3s || '', 3000), scenes: cleanText(videoSource.scenes || '', 12000), endingCta: cleanText(videoSource.endingCta || '', 1500),
    },
    referenceIds: stringList(body.referenceIds, Array.isArray(base.referenceIds) ? base.referenceIds : []).slice(0, 100),
    resultAssetIds: stringList(body.resultAssetIds, Array.isArray(base.resultAssetIds) ? base.resultAssetIds : []).slice(0, 100),
    status: AD_STATUSES.has(statusCandidate) ? statusCandidate : 'draft',
    createdAt: base.createdAt || cleanText(body.createdAt || stamp, 80),
    updatedAt: stamp,
  };
}

let pgPool = null;
if (DATABASE_URL) {
  try {
    const pg = await import('pg');
    pgPool = new pg.default.Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  } catch (error) {
    console.error('[오류] PostgreSQL 연결 모듈을 초기화하지 못했습니다:', error?.message || error);
  }
} else {
  console.warn('[안내] DATABASE_URL이 없어 DB 기능은 사용할 수 없습니다.');
}

let cachedTenantId = null;
async function getCurrentTenantId() {
  if (cachedTenantId) return cachedTenantId;
  if (!pgPool) return null;
  const result = await pgPool.query(`SELECT id FROM tenants WHERE slug = 'howtom' LIMIT 1`);
  cachedTenantId = result.rows[0]?.id || null;
  return cachedTenantId;
}

async function ensureAdTables() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS ad_projects (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_ad_projects_tenant ON ad_projects(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_ad_projects_advertiser ON ad_projects(tenant_id, advertiser_id);
  `);
}

function normalizeTemplate(body = {}, current = null) {
  const base = current || {};
  const blocksSource = Array.isArray(body.blocks) ? body.blocks : (Array.isArray(base.blocks) ? base.blocks : []);
  const blocks = blocksSource.slice(0, 20).map((b, i) => ({
    blockId: cleanText(b?.blockId || `block-${i + 1}`, 60),
    label: cleanText(b?.label || `블록 ${i + 1}`, 120),
    blockType: cleanText(b?.blockType || 'textarea', 30),
    defaultValue: cleanText(b?.defaultValue || '', 4000),
  }));
  const rulesSource = Array.isArray(body.rules) ? body.rules : (Array.isArray(base.rules) ? base.rules : []);
  const rules = rulesSource.slice(0, 10).map(r => ({ field: cleanText(r?.field || '', 60), type: cleanText(r?.type || 'maxLength', 30), value: typeof r?.value === 'number' ? r.value : cleanText(r?.value || '', 200) }));
  const tags = Array.isArray(body.tags) ? body.tags.map(x => cleanText(x, 60)).filter(Boolean).slice(0, 20) : (base.tags || []);
  return {
    ...base,
    templateId: base.templateId || cleanText(body.templateId || '', 120),
    name: cleanText(body.name ?? base.name ?? '새 템플릿', 200),
    templateType: cleanText(body.templateType ?? base.templateType ?? 'ad-copy', 40),
    advertiserId: cleanText(body.advertiserId ?? base.advertiserId ?? '', 120) || null,
    advertiserName: cleanText(body.advertiserName ?? base.advertiserName ?? '', 160),
    channel: cleanText(body.channel ?? base.channel ?? '', 120),
    description: cleanText(body.description ?? base.description ?? '', 500),
    blocks, rules, tags,
    version: Number.isFinite(body.version) ? body.version : (base.version ?? 1),
    isFavorite: typeof body.isFavorite === 'boolean' ? body.isFavorite : (base.isFavorite ?? false),
    useCount: Number.isFinite(body.useCount) ? body.useCount : (base.useCount ?? 0),
    parentTemplateId: cleanText(body.parentTemplateId ?? base.parentTemplateId ?? '', 120) || null,
  };
}

async function ensureTemplateTables() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS content_templates (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      template_type TEXT NOT NULL DEFAULT 'ad-copy',
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_content_templates_tenant ON content_templates(tenant_id);
  `);
}

function normalizeDocumentProject(body = {}, current = null) {
  const base = current || {};
  const blocksSource = Array.isArray(body.blocks) ? body.blocks : (Array.isArray(base.blocks) ? base.blocks : []);
  const blocks = blocksSource.slice(0, 60).map((b, i) => ({
    blockId: cleanText(b?.blockId || `doc-${i + 1}`, 60),
    type: cleanText(b?.type || 'paragraph', 20),
    title: cleanText(b?.title || '', 200),
    text: cleanText(b?.text || '', 8000),
  }));
  return {
    ...base,
    projectId: base.projectId || cleanText(body.projectId || '', 120),
    title: cleanText(body.title ?? base.title ?? '새 문서', 240),
    advertiserId: cleanText(body.advertiserId ?? base.advertiserId ?? '', 120),
    advertiserName: cleanText(body.advertiserName ?? base.advertiserName ?? '', 160),
    documentType: cleanText(body.documentType ?? base.documentType ?? '기획서', 60),
    blocks,
    status: cleanText(body.status ?? base.status ?? 'draft', 40),
  };
}

async function ensureDocumentTables() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS document_projects (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_document_projects_tenant ON document_projects(tenant_id);
  `);
}

function normalizeVideoScriptProject(body = {}, current = null) {
  const base = current || {};
  const scenesSource = Array.isArray(body.scenes) ? body.scenes : (Array.isArray(base.scenes) ? base.scenes : []);
  const scenes = scenesSource.slice(0, 40).map((s, i) => ({
    sceneId: cleanText(s?.sceneId || `scene-${i + 1}`, 60),
    order: Number.isFinite(s?.order) ? s.order : i + 1,
    startSecond: Number.isFinite(s?.startSecond) ? s.startSecond : 0,
    endSecond: Number.isFinite(s?.endSecond) ? s.endSecond : 0,
    purpose: cleanText(s?.purpose || 'other', 20),
    visual: cleanText(s?.visual || '', 500),
    narration: cleanText(s?.narration || '', 1000),
    caption: cleanText(s?.caption || '', 500),
  }));
  return {
    ...base,
    projectId: base.projectId || cleanText(body.projectId || '', 120),
    title: cleanText(body.title ?? base.title ?? '새 영상 대본', 240),
    advertiserId: cleanText(body.advertiserId ?? base.advertiserId ?? '', 120),
    advertiserName: cleanText(body.advertiserName ?? base.advertiserName ?? '', 160),
    videoType: cleanText(body.videoType ?? base.videoType ?? '숏폼 광고', 60),
    targetSeconds: Number.isFinite(body.targetSeconds) ? body.targetSeconds : (base.targetSeconds ?? 30),
    ratio: cleanText(body.ratio ?? base.ratio ?? '9:16', 20),
    keyMessage: cleanText(body.keyMessage ?? base.keyMessage ?? '', 500),
    cta: cleanText(body.cta ?? base.cta ?? '', 120),
    scenes,
    status: cleanText(body.status ?? base.status ?? 'draft', 40),
  };
}

async function ensureVideoScriptTables() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS video_script_projects (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_video_script_projects_tenant ON video_script_projects(tenant_id);
  `);
}

async function ensureAssetTables() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS content_assets (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      asset_type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      memo TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_content_assets_tenant ON content_assets(tenant_id, asset_type);
  `);
}

async function ensureReferenceTables() {
  if (!pgPool) return;
  await pgPool.query(`
    -- 저장된 레퍼런스(광고). 검색 결과 자체는 저장하지 않고, 사용자가 "저장" 누른 것만 여기 들어옵니다.
    CREATE TABLE IF NOT EXISTS content_references (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      platform TEXT NOT NULL DEFAULT 'meta',
      external_id TEXT,
      page_name TEXT,
      is_competitor BOOLEAN NOT NULL DEFAULT false,
      body TEXT,
      headline TEXT,
      description TEXT,
      cta TEXT,
      landing_url TEXT,
      thumbnail_url TEXT,
      media_type TEXT,
      ad_snapshot_url TEXT,
      country TEXT,
      start_date DATE,
      is_active BOOLEAN,
      flight_days INTEGER,
      view_count BIGINT,
      like_count BIGINT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      memo TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_content_references_tenant ON content_references(tenant_id, advertiser_id);

    -- 광고주별로 등록해두는 경쟁 브랜드 목록
    CREATE TABLE IF NOT EXISTS reference_competitors (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
      brand_name TEXT NOT NULL,
      page_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_reference_competitors_advertiser ON reference_competitors(advertiser_id);

    -- 레퍼런스 보드(폴더처럼 레퍼런스를 모아두는 단위)
    CREATE TABLE IF NOT EXISTS reference_boards (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_reference_boards_tenant ON reference_boards(tenant_id);

    -- 하나의 레퍼런스가 여러 보드에 동시에 들어갈 수 있도록 하는 다대다 연결 테이블
    CREATE TABLE IF NOT EXISTS reference_board_items (
      board_id TEXT NOT NULL REFERENCES reference_boards(id) ON DELETE CASCADE,
      reference_id TEXT NOT NULL REFERENCES content_references(id) ON DELETE CASCADE,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (board_id, reference_id)
    );
    ALTER TABLE content_references ADD COLUMN IF NOT EXISTS view_count BIGINT;
    ALTER TABLE content_references ADD COLUMN IF NOT EXISTS like_count BIGINT;
    ALTER TABLE content_references ADD COLUMN IF NOT EXISTS ai_analysis JSONB;
    ALTER TABLE content_references ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;
  `);
}

/**
 * Meta 광고 라이브러리(Ad Library) 연동
 * ------------------------------------------------------------
 * 중요: 광고 성과 조회용 META_ACCESS_TOKEN과는 완전히 별개입니다. 신원 확인(Identity
 * Confirmation, facebook.com/ID)을 통과한 계정/앱의 토큰이 필요합니다. 이미지·영상 원본
 * 파일은 제공하지 않으며(ad_snapshot_url로 미리보기 페이지만 제공), 상업 광고의 노출·지출
 * 데이터도 기본적으로 제공되지 않습니다 - 지원되지 않는 성과 데이터를 지어내지 않습니다.
 */
const META_AD_LIBRARY_TOKEN = process.env.META_AD_LIBRARY_ACCESS_TOKEN || '';
const AD_LIBRARY_FIELDS = [
  'id', 'page_id', 'page_name', 'ad_creation_time', 'ad_delivery_start_time', 'ad_delivery_stop_time',
  'ad_creative_bodies', 'ad_creative_link_titles', 'ad_creative_link_descriptions', 'ad_creative_link_captions',
  'ad_snapshot_url', 'publisher_platforms', 'languages',
].join(',');
function adLibraryConfigured() { return Boolean(META_AD_LIBRARY_TOKEN); }

/** 광고 시작일과 종료 여부로 게재일수를 계산합니다(종료됐으면 종료일까지, 운영 중이면 오늘까지). */
function computeFlightDays(startTime, stopTime) {
  if (!startTime) return null;
  const start = new Date(startTime);
  const end = stopTime ? new Date(stopTime) : new Date();
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Number.isFinite(days) && days >= 0 ? days : null;
}
function normalizeAdLibraryRow(row) {
  const flightDays = computeFlightDays(row.ad_delivery_start_time, row.ad_delivery_stop_time);
  return {
    externalId: row.id, pageId: row.page_id || null, pageName: row.page_name || '(페이지명 없음)',
    body: (row.ad_creative_bodies || [])[0] || '', headline: (row.ad_creative_link_titles || [])[0] || '',
    description: (row.ad_creative_link_descriptions || [])[0] || '', cta: (row.ad_creative_link_captions || [])[0] || '',
    adSnapshotUrl: row.ad_snapshot_url || null,
    startDate: row.ad_delivery_start_time ? row.ad_delivery_start_time.slice(0, 10) : null,
    isActive: !row.ad_delivery_stop_time, flightDays,
    // 30일 이상 계속 게재 중이면 "장기 게재" 후보로 봅니다. 실제 성과(ROAS 등)를 확인한 게
    // 아니므로 "성과 우수"라고 단정하지 않고 "장기 게재"라고만 표현합니다.
    isLongRunning: flightDays !== null && flightDays >= 30 && !row.ad_delivery_stop_time,
    platforms: row.publisher_platforms || [],
  };
}
/** 키워드 또는 특정 페이지 ID로 Meta 광고 라이브러리를 검색합니다. */
async function searchMetaAdLibrary({ keyword, pageIds, country = 'KR' }) {
  if (!adLibraryConfigured()) throw new Error('Meta 광고 라이브러리 API가 연결되지 않았습니다. 관리자가 META_AD_LIBRARY_ACCESS_TOKEN(신원 확인을 마친 토큰)을 설정해야 합니다.');
  if (!keyword && (!pageIds || !pageIds.length)) throw new Error('검색어 또는 경쟁 브랜드(페이지)를 선택하세요.');
  const params = new URLSearchParams({ access_token: META_AD_LIBRARY_TOKEN, ad_reached_countries: JSON.stringify([country]), ad_type: 'ALL', fields: AD_LIBRARY_FIELDS, limit: '50' });
  if (keyword) params.set('search_terms', keyword);
  if (pageIds && pageIds.length) params.set('search_page_ids', JSON.stringify(pageIds));
  const res = await fetch(`https://graph.facebook.com/v21.0/ads_archive?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Meta 광고 라이브러리 API HTTP ${res.status}`);
  return (data.data || []).map(normalizeAdLibraryRow);
}

/**
 * YouTube 커넥터 (PHASE 5)
 * ------------------------------------------------------------
 * Meta 광고 라이브러리와 달리 YouTube는 "광고 라이브러리" 개념이 없어, 일반 공개
 * 영상을 검색합니다(경쟁사 채널 리서치·인기 영상 참고용). 조회수·좋아요 수는 YouTube가
 * 공개적으로 제공하는 값이라 표시해도 되지만, 실제 광고 성과(클릭·전환 등)는 알 수 없으므로
 * 절대 표시하지 않습니다.
 */
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
function youtubeConfigured() { return Boolean(YOUTUBE_API_KEY); }

async function searchYoutubeVideos({ keyword, channelId }) {
  if (!youtubeConfigured()) throw new Error('YouTube 연동이 설정되지 않았습니다. 관리자가 YOUTUBE_API_KEY(YouTube Data API v3)를 등록해야 합니다.');
  if (!keyword && !channelId) throw new Error('검색어 또는 경쟁 채널을 선택하세요.');
  const searchParams = new URLSearchParams({ key: YOUTUBE_API_KEY, part: 'snippet', type: 'video', order: 'date', maxResults: '25', regionCode: 'KR', relevanceLanguage: 'ko' });
  if (keyword) searchParams.set('q', keyword);
  if (channelId) searchParams.set('channelId', channelId);
  const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`);
  const searchData = await searchRes.json();
  if (!searchRes.ok) throw new Error(searchData?.error?.message || `YouTube API HTTP ${searchRes.status}`);
  const videoIds = (searchData.items || []).map(item => item.id?.videoId).filter(Boolean);
  if (!videoIds.length) return [];

  // 조회수·좋아요 수는 검색 결과에 없어서, videos.list로 한 번 더 조회합니다.
  const statsParams = new URLSearchParams({ key: YOUTUBE_API_KEY, part: 'statistics,contentDetails', id: videoIds.join(',') });
  const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${statsParams.toString()}`);
  const statsData = await statsRes.json();
  const statsById = new Map((statsData.items || []).map(item => [item.id, item]));

  return (searchData.items || []).map(item => {
    const videoId = item.id?.videoId;
    const stats = statsById.get(videoId);
    return {
      externalId: videoId,
      pageId: item.snippet?.channelId || null,
      pageName: item.snippet?.channelTitle || '(채널명 없음)',
      headline: item.snippet?.title || '',
      description: item.snippet?.description || '',
      body: '', cta: '',
      thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
      adSnapshotUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
      startDate: item.snippet?.publishedAt ? item.snippet.publishedAt.slice(0, 10) : null,
      isActive: true, flightDays: null, isLongRunning: false, platforms: ['youtube'],
      viewCount: stats?.statistics?.viewCount ? Number(stats.statistics.viewCount) : null,
      likeCount: stats?.statistics?.likeCount ? Number(stats.statistics.likeCount) : null,
    };
  });
}

/**
 * Instagram 일반 콘텐츠 (PHASE 6) — 해시태그 검색
 * ------------------------------------------------------------
 * Instagram Graph API의 공식 해시태그 검색만 사용합니다(비공식 스크래핑 없음).
 * 이 API는 특성상 "내가 연결한 비즈니스 계정을 대신해서" 검색하는 구조라 매번
 * ig_business_account_id가 필요하고, 그 계정 기준으로 주당 30개 해시태그까지만
 * 검색할 수 있습니다(Meta의 API 제약, HOWTOM이 만든 제약이 아닙니다).
 */
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
function instagramConfigured() { return Boolean(META_ACCESS_TOKEN); }

async function searchInstagramHashtag({ hashtag, igBusinessAccountId }) {
  if (!instagramConfigured()) throw new Error('Instagram 연동이 설정되지 않았습니다. 관리자가 META_ACCESS_TOKEN을 등록해야 합니다.');
  if (!hashtag) throw new Error('검색할 해시태그를 입력하세요.');
  if (!igBusinessAccountId) throw new Error('Instagram 비즈니스 계정 ID를 입력하세요. (설정 > 매체 계정 연동에서 연결한 Instagram 계정 ID)');
  const clean = hashtag.replace(/^#/, '');

  const hashtagRes = await fetch(`https://graph.facebook.com/v21.0/ig_hashtag_search?user_id=${igBusinessAccountId}&q=${encodeURIComponent(clean)}&access_token=${META_ACCESS_TOKEN}`);
  const hashtagData = await hashtagRes.json();
  if (!hashtagRes.ok) throw new Error(hashtagData?.error?.message || `Instagram 해시태그 검색 API HTTP ${hashtagRes.status}`);
  const hashtagId = hashtagData?.data?.[0]?.id;
  if (!hashtagId) return [];

  const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,like_count,comments_count,timestamp';
  const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${hashtagId}/top_media?user_id=${igBusinessAccountId}&fields=${fields}&access_token=${META_ACCESS_TOKEN}`);
  const mediaData = await mediaRes.json();
  if (!mediaRes.ok) throw new Error(mediaData?.error?.message || `Instagram 미디어 조회 API HTTP ${mediaRes.status}`);

  return (mediaData.data || []).map(item => ({
    externalId: item.id, pageId: null, pageName: `#${clean}`,
    headline: '', description: item.caption || '', body: item.caption || '', cta: '',
    thumbnailUrl: item.media_type === 'VIDEO' ? (item.thumbnail_url || null) : (item.media_url || null),
    adSnapshotUrl: item.permalink || null,
    startDate: item.timestamp ? item.timestamp.slice(0, 10) : null,
    isActive: true, flightDays: null, isLongRunning: false, platforms: ['instagram'],
    viewCount: null, likeCount: item.like_count ?? null,
  }));
}

/**
 * AI Gateway (PHASE 7)
 * ------------------------------------------------------------
 * 콘텐츠 제작소 안의 여러 기능(블로그 초안, 레퍼런스 분석 등)이 전부 이 함수 하나를
 * 공유합니다. 나중에 AI 공급사를 바꾸거나 추가할 때 이 파일의 이 부분만 고치면 됩니다.
 * 각 기능은 "무엇을 물어볼지(system/user 프롬프트)"만 책임지고, "어떻게 호출할지"는
 * 여기서 전부 처리합니다.
 */
const AI_PROVIDER = (process.env.AI_PROVIDER || '').trim().toLowerCase();
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_API_URL = process.env.AI_API_URL || '';
const AI_MODEL = process.env.AI_MODEL || '';
function aiConfigured() {
  if (AI_PROVIDER === 'anthropic' || AI_PROVIDER === 'openai') return Boolean(AI_API_KEY);
  if (AI_PROVIDER === 'custom') return Boolean(AI_API_URL);
  return false;
}
/** system/user 프롬프트를 받아 AI의 텍스트 응답(문자열)을 그대로 돌려줍니다. */
async function callAI({ system, user, maxTokens = 1500 }) {
  if (!aiConfigured()) throw new Error('AI가 연결되지 않았습니다. 관리자가 AI_PROVIDER/AI_API_KEY(또는 AI_API_URL)를 설정해야 합니다.');
  if (AI_PROVIDER === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': AI_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_MODEL || 'claude-sonnet-4-6', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Anthropic API HTTP ${res.status}`);
    return Array.isArray(data.content) ? data.content.map(b => b.text || '').join('') : '';
  }
  if (AI_PROVIDER === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_MODEL || 'gpt-4o-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.7 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `OpenAI API HTTP ${res.status}`);
    return data?.choices?.[0]?.message?.content || '';
  }
  // 커스텀: 사내 AI 서버 등 자체 API를 붙일 때 사용합니다.
  const res = await fetch(AI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system, user }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `커스텀 AI API HTTP ${res.status}`);
  return data.text || data.result || JSON.stringify(data);
}
/** AI 응답에서 ```json 코드블록 등을 걷어내고 JSON으로 해석합니다. */
function parseAiJsonResponse(text) {
  const cleaned = String(text ?? '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { throw new Error('AI 응답을 JSON으로 해석할 수 없습니다.'); }
}

/**
 * BlogGenerationProvider (제휴 업체 API Adapter)
 * ------------------------------------------------------------
 * 블로그 원고 생성은 위의 공용 AI Gateway(callAI)와 의도적으로 분리합니다.
 * 이유: 나중에 블로그 원고 제휴 업체가 바뀌거나 확정되어도, 레퍼런스 분석 등
 * 다른 AI 기능(공용 Gateway 사용)에는 영향이 없도록 하기 위함입니다.
 * 제휴 업체가 확정되기 전까지는 아래 두 환경변수가 비어있고, 이 경우
 * "연동 필요" 상태를 정직하게 반환합니다(가짜 원고를 만들지 않음).
 */
const BLOG_PARTNER_API_URL = process.env.BLOG_PARTNER_API_URL || '';
const BLOG_PARTNER_API_KEY = process.env.BLOG_PARTNER_API_KEY || '';
function blogGenerationConfigured() { return Boolean(AUTOPOST_PRO_API_KEY) || Boolean(BLOG_PARTNER_API_URL); }

/* ========================================================================
   오토포스트 Pro 연동 (㈜시온랩스 제휴 API, aiblog.zionlabs.org)
   -----------------------------------------------------------------------
   HOWTOM Universe에서 먼저 만들어 검증한 연동을 그대로 옮겨왔습니다(같은
   DATABASE_URL을 공유하므로 advertisers.business_reg_no/autopost_pro_industry,
   autopost_pro_seats 테이블도 그대로 씁니다). 광고주(사업자등록번호) 기준으로
   좌석(seat)을 만들고, 그 좌석으로 블로그 초안을 생성합니다. 무료체험 3건 이후
   유료 전환, 월 한도 초과 시 건당 3,000원 과금 - 실제 돈이 오가는 연동이라
   서버가 임의로 confirm_overage=true를 보내는 일은 없고, 프론트에서 사용자가
   명시적으로 동의한 경우에만 전달합니다.
   ======================================================================== */
const AUTOPOST_PRO_API_KEY = process.env.AUTOPOST_PRO_API_KEY || '';
const AUTOPOST_PRO_BASE_URL = process.env.AUTOPOST_PRO_BASE_URL || 'https://aiblog.zionlabs.org';
function autopostProConfigured() { return Boolean(AUTOPOST_PRO_API_KEY); }

/**
 * 오토포스트 Pro 호출 - Timeout과 재시도 정책을 명시적으로 둡니다.
 * - Timeout: 90초 (60~120초 권장 범위 중간값)
 * - 재시도 대상: 네트워크 오류, Timeout, 503만 - 최대 2회, 1초 → 3초 간격
 * - 재시도 키: 최초 호출과 완전히 동일한 Idempotency-Key를 그대로 재사용합니다
 *   (다른 키를 쓰면 오토포스트 Pro 쪽에서 별개 요청으로 처리해 중복 과금될 수 있습니다).
 * - 재시도 금지: 400(입력 오류)·401(키 오류)·404(seat 없음)·409(한도 초과 동의 필요)는
 *   재시도해도 결과가 달라지지 않거나, 사용자 확인이 먼저 필요한 상태라 그대로 던집니다.
 */
const AUTOPOST_PRO_TIMEOUT_MS = 90_000;
const AUTOPOST_PRO_RETRY_DELAYS_MS = [1000, 3000];
// 재시도 대상은 네트워크 오류·Timeout·503뿐입니다. 400(입력 오류)·401(키 오류)·
// 404(seat 없음)·409(한도 초과 동의 필요)는 아래에서 503이 아니면 재시도하지 않는
// 분기로 이미 자연스럽게 제외됩니다 - 재시도해도 결과가 달라지지 않거나 사용자
// 확인이 먼저 필요한 상태이기 때문입니다.

async function autopostProRequest(method, path, body, extraHeaders, attempt = 0) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTOPOST_PRO_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${AUTOPOST_PRO_BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${AUTOPOST_PRO_API_KEY}`, 'Content-Type': 'application/json', ...(extraHeaders || {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (networkError) {
    clearTimeout(timeoutId);
    // AbortError(Timeout 포함)와 일반 네트워크 오류만 재시도 대상입니다.
    if (attempt < AUTOPOST_PRO_RETRY_DELAYS_MS.length) {
      await new Promise(r => setTimeout(r, AUTOPOST_PRO_RETRY_DELAYS_MS[attempt]));
      return autopostProRequest(method, path, body, extraHeaders, attempt + 1);
    }
    const timedOut = networkError?.name === 'AbortError';
    const err = new Error(timedOut ? '오토포스트 Pro API 응답이 지연되어 시간 초과되었습니다(재시도 2회 모두 실패).' : `오토포스트 Pro API 연결에 실패했습니다: ${networkError?.message || networkError}`);
    err.code = timedOut ? 'timeout' : 'network_error';
    throw err;
  }
  clearTimeout(timeoutId);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 503 && attempt < AUTOPOST_PRO_RETRY_DELAYS_MS.length) {
      await new Promise(r => setTimeout(r, AUTOPOST_PRO_RETRY_DELAYS_MS[attempt]));
      return autopostProRequest(method, path, body, extraHeaders, attempt + 1);
    }
    const err = new Error(data?.error?.message || `오토포스트 Pro API HTTP ${res.status}`);
    err.code = data?.error?.code; err.status = res.status;
    throw err;
  }
  return data;
}

// HOWTOM 자체 업종(한글)을 오토포스트 Pro의 업종 코드(영문)로 매핑합니다. 매핑에 없는
// 업종은 advertiser.autopost_pro_industry에 제휴사가 안내해준 코드를 직접 입력해 쓰면 됩니다.
const AUTOPOST_INDUSTRY_MAP = {
  '병원·의료기관': 'medical', '치과': 'medical', '한의원': 'medical',
  '동물병원': 'vet', '세무사·세무법인': 'tax', '학원·교육': 'academy',
};
function mapIndustryToAutopostCode(advertiser) {
  if (advertiser.autopost_pro_industry) return advertiser.autopost_pro_industry;
  return AUTOPOST_INDUSTRY_MAP[advertiser.industry || ''] || advertiser.industry || '';
}
/** 오토포스트 Pro API가 실제로 받는 길이 값은 이 4개뿐입니다(짧게 700~900 / 보통
 * 1,100~1,500 / 길게 1,800~2,400 / 자동). 그 외 값은 API가 거부하므로, 화면에서
 * 어떤 값이 와도 이 4개 중 하나로 정확히 매핑합니다. */
const AUTOPOST_LENGTH_VALUES = ['short', 'medium', 'long', 'auto'];
/**
 * PostgreSQL의 텍스트/JSONB 타입은 두 가지를 담지 못합니다:
 * 1) NUL(\u0000) 바이트
 * 2) 서로 짝이 안 맞는 surrogate 문자(깨진 이모지 등 - AI가 이모지를 생성하다 잘리면 흔히 생김)
 * 이 중 하나라도 있으면 INSERT/UPDATE 자체가 "invalid input syntax" 류 오류로 실패합니다.
 * 예전엔 blog_projects에 저장하기 "직전"에만 개별 필드를 정제했는데, 그보다 먼저 실행되는
 * blog_generation_requests INSERT(외부 API 응답을 그대로 캐싱하는 단계)가 깨진 문자 때문에
 * 이미 실패해버리면 정제 코드까지 도달하지도 못했습니다. 그래서 외부 API 응답을 받은
 * "직후", 첫 DB 저장보다 먼저, 객체 전체(중첩 배열·객체 포함)를 재귀적으로 정제합니다.
 */
function sanitizeDeep(value) {
  if (typeof value === 'string') {
    return value
      .replace(/\u0000/g, '')
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
      .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
  }
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = sanitizeDeep(value[k]);
    return out;
  }
  return value;
}
function mapLengthToAutopostCode(input) {
  if (AUTOPOST_LENGTH_VALUES.includes(input)) return input;
  const n = Number(input);
  if (Number.isFinite(n)) {
    if (n <= 900) return 'short';
    if (n <= 1500) return 'medium';
    return 'long'; // 1,800~2,400 이상 요청도 API 최대치인 long으로 보냅니다(3,000자 등 초과 요청 포함).
  }
  return 'auto';
}

/** 이 광고주가 오토포스트 Pro를 쓸 수 있는지(업종 지원 여부)만 가볍게 확인합니다 -
 * 실제로 좌석을 만들지는 않아서, 생성 버튼을 누르기 전에 화면에서 안내만 하고 싶을 때 씁니다. */
function isAutopostSupportedAdvertiser(advertiser) {
  if (!advertiser) return false;
  const industryCode = mapIndustryToAutopostCode(advertiser);
  return ['medical', 'tax', 'academy', 'vet'].includes(industryCode);
}

async function ensureAutopostProSeatsTable() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS autopost_pro_seats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
      seat_id TEXT NOT NULL,
      plan TEXT, trial_remaining INTEGER, status TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(advertiser_id)
    );
  `);
  // 중복 과금 방지: 생성 시도 하나당 Idempotency-Key 하나를 끝까지 재사용합니다.
  // status: requested(시도 중) → ai_completed(AI 생성 성공, HOWTOM 저장 전) → completed(저장까지 완료).
  // ai_completed에서 멈춘 경우는 "생성 실패"가 아니라 "이미 과금됐을 수 있으니 저장만
  // 재시도"로 취급해야 합니다 - 같은 키로 다시 생성 요청이 오면 AI를 다시 부르지 않고
  // 캐시해둔 결과로 저장만 재시도합니다.
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS blog_generation_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      project_id TEXT,
      idempotency_key TEXT NOT NULL,
      provider_draft_id TEXT,
      status TEXT NOT NULL DEFAULT 'requested',
      billing JSONB,
      result JSONB,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ,
      UNIQUE(idempotency_key)
    );
  `);
  // 오토포스트 Pro의 업종별 규정검수(/v1/compliance) 결과를 HOWTOM 자체 사전점검과
  // 구분해서 보관합니다 - 둘은 서로 다른 검수이므로 하나가 다른 하나를 대체하지 않습니다.
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS blog_compliance_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      project_id TEXT,
      passed BOOLEAN,
      issues JSONB NOT NULL DEFAULT '[]'::jsonb,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 캐시된 좌석만 조회합니다(없으면 null) - GET 요청은 절대 좌석을 새로 만들지 않습니다. */
async function findAutopostProSeat(advertiserId) {
  if (!UUID_RE.test(advertiserId || '')) return null; // 형식이 아예 틀린 ID는 DB에 묻지 않고 "없음"으로 처리합니다.
  const cached = await pgPool.query('SELECT * FROM autopost_pro_seats WHERE advertiser_id = $1', [advertiserId]);
  return cached.rows[0] || null;
}

/** 이 광고주의 좌석을 캐시에서 찾고, 없으면 제휴 API에 실제로 새로 만듭니다(POST 전용 -
 * 초안 생성처럼 실제로 좌석이 필요한 시점에만 호출해야 합니다). */
async function ensureAutopostProSeat(tenantId, advertiser) {
  const cached = await findAutopostProSeat(advertiser.id);
  if (cached) return cached;
  if (!advertiser.business_reg_no) { const e = new Error('이 광고주는 사업자등록번호가 등록되어 있지 않습니다. HOWTOM Universe의 광고주 정보에서 먼저 입력하세요.'); e.status = 400; throw e; }
  if (!advertiser.industry) { const e = new Error('이 광고주는 업종이 등록되어 있지 않습니다.'); e.status = 400; throw e; }
  const industryCode = mapIndustryToAutopostCode(advertiser);
  if (!['medical', 'tax', 'academy', 'vet'].includes(industryCode)) {
    const e = new Error(`'${advertiser.industry}' 업종은 아직 오토포스트 Pro에 등록되지 않았습니다. 제휴사에 업종 추가를 요청한 뒤, 광고주 정보의 '오토포스트 Pro 업종 코드'에 안내받은 코드를 입력하세요.`);
    e.status = 400; throw e;
  }
  const seat = await autopostProRequest('POST', '/v1/seats', {
    business_reg_no: advertiser.business_reg_no, name: advertiser.name, industry: industryCode, external_id: advertiser.id,
  });
  const insert = await pgPool.query(
    `INSERT INTO autopost_pro_seats (tenant_id, advertiser_id, seat_id, plan, trial_remaining, status)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (advertiser_id) DO UPDATE SET seat_id=EXCLUDED.seat_id, plan=EXCLUDED.plan, trial_remaining=EXCLUDED.trial_remaining, status=EXCLUDED.status, updated_at=now()
     RETURNING *`,
    [tenantId, advertiser.id, seat.id, seat.plan || null, seat.trial_remaining ?? null, seat.status || null]
  );
  return insert.rows[0];
}
/** 좌석을 정지/재개하고 우리 캐시도 같이 갱신합니다 - 계약 종료·서비스 중단 시 씁니다. */
async function setAutopostProSeatStatus(advertiserId, action) {
  const seatRow = await findAutopostProSeat(advertiserId);
  if (!seatRow) { const e = new Error('이 광고주는 아직 오토포스트 Pro 좌석이 없습니다.'); e.status = 404; throw e; }
  const updated = await autopostProRequest('POST', `/v1/seats/${seatRow.seat_id}/${action}`);
  await pgPool.query('UPDATE autopost_pro_seats SET status=$2, updated_at=now() WHERE advertiser_id=$1', [advertiserId, updated.status || (action === 'suspend' ? 'suspended' : 'active')]);
  return updated;
}

/** 제휴 업체 API를 호출합니다. 오토포스트 Pro가 연결되어 있으면 우선 사용하고,
 * 없으면 기존 범용 BLOG_PARTNER_API_URL(다른 업체용)로 대체합니다. */
async function callBlogGenerationProvider(brief) {
  if (autopostProConfigured() && brief.advertiserId) {
    const tenantId = await getCurrentTenantId();
    const advRes = await pgPool.query('SELECT id, name, industry, business_reg_no, autopost_pro_industry FROM advertisers WHERE tenant_id=$1 AND id::text=$2', [tenantId, brief.advertiserId]);
    const advertiser = advRes.rows[0];
    if (!advertiser) throw new Error('광고주를 찾을 수 없습니다.');
    const seatRow = await ensureAutopostProSeat(tenantId, advertiser);
    const idempotencyKey = brief.idempotencyKey ? String(brief.idempotencyKey) : undefined;
    try {
      const draft = await autopostProRequest('POST', `/v1/seats/${seatRow.seat_id}/drafts`, {
        keyword: brief.primaryKeyword, length: mapLengthToAutopostCode(brief.length ?? brief.targetLength), num_images: Number.isFinite(Number(brief.numImages)) ? Number(brief.numImages) : 1,
        confirm_overage: Boolean(brief.confirmOverage),
      }, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined);
      // Draft.body는 완성된 HTML이라, 우리 블록 구조 중 'html' 타입 블록 하나로 그대로 담습니다.
      // title/body 외의 값(id, seat_id, tags, meta_description, billing 전체)도 버리지 않고
      // 그대로 돌려줘서 호출부가 프로젝트에 저장할 수 있게 합니다.
      return {
        generator: 'autopost-pro',
        titles: [draft.title], blocks: [{ blockId: `html-${Date.now()}`, type: 'html', title: '', text: draft.body }],
        billing: draft.billing, providerDraftId: draft.id, seatId: draft.seat_id, tags: draft.tags || [], metaDescription: draft.meta_description || '',
      };
    } catch (error) {
      if (error.code === 'overage_confirm_required') { const e = new Error(error.message); e.code = 'overage_confirm_required'; e.status = 409; throw e; }
      throw error;
    }
  }
  if (!blogGenerationConfigured()) throw new Error('블로그 원고 생성 제휴 업체 API가 아직 연결되지 않았습니다. 관리자가 AUTOPOST_PRO_API_KEY 또는 BLOG_PARTNER_API_URL/BLOG_PARTNER_API_KEY를 설정해야 합니다. 그동안은 직접 작성·편집 기능을 사용하세요.');
  const res = await fetch(BLOG_PARTNER_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(BLOG_PARTNER_API_KEY ? { Authorization: `Bearer ${BLOG_PARTNER_API_KEY}` } : {}) },
    body: JSON.stringify(brief),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `제휴 업체 API HTTP ${res.status}`);
  // 표준 응답 형식: { title/titles, content/blocks, ... }. 업체 응답이 이 형식과 다르면 이 부분만 맞춰 변환합니다.
  const titles = Array.isArray(data.titles) ? data.titles : (data.title ? [data.title] : []);
  const blocks = Array.isArray(data.blocks) ? data.blocks : [];
  return {
    generator: 'partner',
    titles: titles.slice(0, 5).map(t => cleanText(String(t), 200)),
    blocks: blocks.slice(0, 10).map((b, i) => ({ blockId: `block-${Date.now()}-${i}`, type: cleanText(String(b?.type || 'paragraph'), 20), title: cleanText(String(b?.title || ''), 200), text: cleanText(String(b?.text || ''), 4000) })),
  };
}

async function ensureBlogTables() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS blog_projects (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_blog_projects_tenant ON blog_projects(tenant_id);
    -- HOWTOM Universe에 있던 광고 제작·영상 대본·문서 작성을 콘텐츠 제작소로 이관하면서
    -- 새로 추가합니다. 예전엔 Universe 쪽에서 브라우저 localStorage에만 저장되어 팀
    -- 전체 공유가 안 되고 기기를 바꾸면 사라졌습니다 - 블로그와 같은 방식(서버 JSONB)으로
    -- 저장해서 이 문제를 같이 해결합니다.
    CREATE TABLE IF NOT EXISTS content_projects (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      project_type TEXT NOT NULL, -- 'ad' | 'video-script' | 'document'
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_content_projects_tenant ON content_projects(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_content_projects_type ON content_projects(project_type);
    CREATE TABLE IF NOT EXISTS blog_styles (
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (tenant_id, advertiser_id)
    );
    CREATE TABLE IF NOT EXISTS blog_assets (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
if (pgPool) {
  ensureBlogTables().catch(error => console.error('[Content Studio] blog table check failed:', error?.message || error));
  ensureAutopostProSeatsTable().catch(error => console.error('[Content Studio] autopost pro seats table check failed:', error?.message || error));
  ensureAdTables().catch(error => console.error('[Content Studio] ad table check failed:', error?.message || error));
  ensureTemplateTables().catch(error => console.error('[Content Studio] template table check failed:', error?.message || error));
  ensureDocumentTables().catch(error => console.error('[Content Studio] document table check failed:', error?.message || error));
  ensureVideoScriptTables().catch(error => console.error('[Content Studio] video script table check failed:', error?.message || error));
  ensureAssetTables().catch(error => console.error('[Content Studio] asset table check failed:', error?.message || error));
  ensureReferenceTables().catch(error => console.error('[Content Studio] reference table check failed:', error?.message || error));
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  return await new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) reject(new Error('요청 본문이 너무 큽니다.'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON 형식이 올바르지 않습니다.')); }
    });
    req.on('error', reject);
  });
}
function hashUserPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyUserPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const parts = stored.split(':'); const salt = parts[0]; const hash = parts[1];
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash); const b = Buffer.from(check);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// 구독 상품명으로 등급을 판정합니다. HOWTOM Universe의 판정 로직과 정확히 동일해야
// 합니다 - 다르면 같은 광고주인데 두 앱에서 등급이 다르게 보이는 혼란이 생깁니다.
function portalTierFromPlanName(planName) {
  const upper = (planName || '').toUpperCase();
  if (upper.includes('CONTENT PRO')) return 3;
  if (upper.includes('INSIGHT')) return 2;
  if (upper.includes('VIEW')) return 1;
  return 0;
}
/**
 * 요청 토큰이 광고주 계정(app_users.is_advertiser_account=true)인지 확인합니다.
 * HOWTOM Universe와 완전히 같은 DB(app_users/app_memberships)를 공유하므로, 계정을
 * 별도로 만들지 않고 그대로 재사용합니다 - Universe에서 발급한 광고주 계정으로
 * Content Studio에도 로그인할 수 있습니다(단, Universe 로그인과는 별개의 토큰입니다).
 */
async function resolveAdvertiserAccount(email) {
  if (!pgPool) return null;
  const result = await pgPool.query(
    `SELECT u.id, u.email, u.name, u.password_hash, u.status, m.advertiser_ids
     FROM app_users u LEFT JOIN app_memberships m ON m.user_id = u.id
     WHERE u.email = $1 AND u.is_advertiser_account = true`,
    [email]
  );
  return result.rows[0] || null;
}

function requireAuth(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  return verifyToken(header.slice(7));
}
function requireDb(res) {
  if (!pgPool) {
    sendJson(res, 503, { error: 'DATABASE_URL이 설정되지 않아 데이터베이스 기능을 사용할 수 없습니다.' });
    return false;
  }
  return true;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
function serveStatic(pathname, res) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(DIST_DIR, requested);
  if (!filePath.startsWith(path.resolve(DIST_DIR))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (error, data) => {
    if (!error) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data); return;
    }
    fs.readFile(path.join(DIST_DIR, 'index.html'), (indexError, indexData) => {
      if (indexError) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Content Studio build not found. Run npm run build first.'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(indexData);
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url || '/', 'http://localhost');

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true, service: 'howtom-content-studio', phase: '3-autopost-pro-integrated', databaseConfigured: Boolean(DATABASE_URL),
        aiConfigured: blogGenerationConfigured(), blogProvider: autopostProConfigured() ? 'autopost-pro' : (blogGenerationConfigured() ? 'partner' : null),
      });
    }

    if (req.method === 'POST' && pathname === '/api/login') {
      if (!JWT_SECRET) return sendJson(res, 500, { error: '로그인 환경변수를 설정하세요.' });
      const body = await readJson(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      // 1) 기존 관리자 단일 계정 로그인(그대로 유지)
      if (ADMIN_EMAIL && ADMIN_PASSWORD && timingSafeStringEqual(email, ADMIN_EMAIL.toLowerCase()) && timingSafeStringEqual(password, ADMIN_PASSWORD)) {
        const token = signToken({ email, name: ADMIN_NAME, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 });
        return sendJson(res, 200, { token, user: { email, name: ADMIN_NAME } });
      }
      // 2) HOWTOM Universe에서 발급한 광고주 계정 로그인(같은 DB의 app_users 재사용)
      const account = await resolveAdvertiserAccount(email);
      if (account && account.password_hash && account.status === 'active' && verifyUserPassword(password, account.password_hash)) {
        const advertiserId = (account.advertiser_ids || [])[0] || null;
        const token = signToken({ email, name: account.name, isAdvertiserAccount: true, advertiserId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 });
        return sendJson(res, 200, { token, user: { email, name: account.name, isAdvertiserAccount: true, advertiserId } });
      }
      return sendJson(res, 401, { error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    if (pathname.startsWith('/api/')) {
      const payload = requireAuth(req);
      if (!payload) return sendJson(res, 401, { error: '인증이 필요합니다.' });
      // 광고주 계정이면 매 요청마다 최신 구독 등급을 다시 확인합니다(관리자가 등급을
      // 바꿔도 재로그인 없이 반영). CONTENT PRO(3) 미달이면 콘텐츠 제작소 접근 자체를
      // 차단합니다 - Universe 사이드바에 링크가 안 보이는 것과 별개로, 서버 쪽에서도
      // 직접 URL로 들어오는 것까지 막아야 합니다.
      if (payload.isAdvertiserAccount) {
        if (!payload.advertiserId) return sendJson(res, 403, { error: '이 계정에 연결된 광고주가 없습니다.' });
        const sub = pgPool ? await pgPool.query('SELECT plan_name FROM advertiser_subscriptions WHERE advertiser_id = $1', [payload.advertiserId]) : { rows: [] };
        const tier = portalTierFromPlanName(sub.rows[0]?.plan_name || '');
        if (tier < 3) return sendJson(res, 403, { error: `콘텐츠 제작소는 CONTENT PRO 구독에서 이용할 수 있습니다. (현재 등급 미달)` });
        payload.advertiserScopeId = payload.advertiserId; // 이후 모든 조회를 이 값으로만 제한합니다.
      }

      if (req.method === 'GET' && pathname === '/api/advertisers') {
        if (!pgPool) return sendJson(res, 200, []);
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 200, []);
        const result = await pgPool.query(`
          SELECT a.id::text AS id, a.name,
                 COALESCE(to_jsonb(a)->>'industry','') AS industry,
                 COALESCE(to_jsonb(a)->>'website','') AS website,
                 COALESCE(to_jsonb(a)->>'phone','') AS phone,
                 COALESCE(to_jsonb(a)->>'address','') AS address,
                 to_jsonb(a)->>'business_reg_no' AS business_reg_no,
                 to_jsonb(a)->>'autopost_pro_industry' AS autopost_pro_industry
          FROM advertisers a WHERE a.tenant_id=$1 ${payload.advertiserScopeId ? 'AND a.id::text=$2' : ''} ORDER BY a.name
        `, payload.advertiserScopeId ? [tenantId, payload.advertiserScopeId] : [tenantId]);
        return sendJson(res, 200, result.rows);
      }

      if (pathname.startsWith('/api/ad/')) {
        if (!requireDb(res)) return;
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 409, { error: 'HOWTOM tenant를 찾을 수 없습니다.' });

        if (req.method === 'GET' && pathname === '/api/ad/projects') {
          const r = await pgPool.query(`SELECT id, data FROM ad_projects WHERE tenant_id=$1 ORDER BY updated_at DESC`, [tenantId]);
          return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), projectId: row.id })));
        }
        if (req.method === 'POST' && pathname === '/api/ad/projects') {
          const body = await readJson(req);
          let row = normalizeAdProject(body);
          row.projectId = makeId('ad');
          if (!row.advertiserId) return sendJson(res, 400, { error: '광고주를 선택하세요.' });
          const advRes = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
          row.advertiserName = advRes.rows[0].name;
          await pgPool.query(`INSERT INTO ad_projects (id, tenant_id, advertiser_id, data) VALUES ($1,$2,$3,$4)`, [row.projectId, tenantId, advRes.rows[0].id, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }

        const adProjectMatch = pathname.match(/^\/api\/ad\/projects\/([^/]+)$/);
        if (adProjectMatch && req.method === 'GET') {
          const id = decodeURIComponent(adProjectMatch[1]);
          const r = await pgPool.query(`SELECT id, data FROM ad_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return r.rows[0] ? sendJson(res, 200, { ...(r.rows[0].data || {}), projectId: r.rows[0].id }) : sendJson(res, 404, { error: '광고 제작 프로젝트를 찾을 수 없습니다.' });
        }
        if (adProjectMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
          const id = decodeURIComponent(adProjectMatch[1]);
          const patch = await readJson(req);
          const cur = await pgPool.query(`SELECT data FROM ad_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          const current = cur.rows[0]?.data;
          if (!current) return sendJson(res, 404, { error: '광고 제작 프로젝트를 찾을 수 없습니다.' });
          const updated = normalizeAdProject(patch, { ...current, projectId:id });
          if (!updated.advertiserId) return sendJson(res, 400, { error: '광고주를 선택하세요.' });
          const advRes = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, updated.advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
          updated.advertiserName = advRes.rows[0].name;
          await pgPool.query(`UPDATE ad_projects SET advertiser_id=$3, data=$4, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, advRes.rows[0].id, JSON.stringify(updated)]);
          return sendJson(res, 200, updated);
        }
        if (adProjectMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(adProjectMatch[1]);
          await pgPool.query(`DELETE FROM ad_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return sendJson(res, 200, { ok: true });
        }
      }

      if (pathname.startsWith('/api/templates')) {
        if (!requireDb(res)) return;
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 409, { error: 'HOWTOM tenant를 찾을 수 없습니다.' });

        if (req.method === 'GET' && pathname === '/api/templates') {
          const r = await pgPool.query(`SELECT id, data FROM content_templates WHERE tenant_id=$1 ORDER BY updated_at DESC`, [tenantId]);
          return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), templateId: row.id })));
        }
        if (req.method === 'POST' && pathname === '/api/templates') {
          const body = await readJson(req);
          const row = normalizeTemplate(body);
          row.templateId = makeId('tpl');
          let advertiserUuid = null;
          if (row.advertiserId) {
            const advRes = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]);
            if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
            advertiserUuid = advRes.rows[0].id; row.advertiserName = advRes.rows[0].name;
          }
          await pgPool.query(`INSERT INTO content_templates (id, tenant_id, advertiser_id, template_type, data) VALUES ($1,$2,$3,$4,$5)`, [row.templateId, tenantId, advertiserUuid, row.templateType, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }
        const templateMatch = pathname.match(/^\/api\/templates\/([^/]+)$/);
        if (templateMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
          const id = decodeURIComponent(templateMatch[1]);
          const patch = await readJson(req);
          const cur = await pgPool.query(`SELECT data FROM content_templates WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          if (!cur.rows[0]?.data) return sendJson(res, 404, { error: '템플릿을 찾을 수 없습니다.' });
          const updated = normalizeTemplate(patch, { ...cur.rows[0].data, templateId: id });
          await pgPool.query(`UPDATE content_templates SET template_type=$3, data=$4, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, updated.templateType, JSON.stringify(updated)]);
          return sendJson(res, 200, updated);
        }
        if (templateMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(templateMatch[1]);
          await pgPool.query(`DELETE FROM content_templates WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return sendJson(res, 200, { ok: true });
        }
        // 템플릿 복제: 이름 뒤에 "복사본"을 붙여 새 템플릿으로 저장합니다.
        const duplicateMatch = pathname.match(/^\/api\/templates\/([^/]+)\/duplicate$/);
        if (duplicateMatch && req.method === 'POST') {
          const id = decodeURIComponent(duplicateMatch[1]);
          const cur = await pgPool.query(`SELECT data FROM content_templates WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          if (!cur.rows[0]?.data) return sendJson(res, 404, { error: '템플릿을 찾을 수 없습니다.' });
          const source = cur.rows[0].data;
          const row = normalizeTemplate({ ...source, name: `${source.name} 복사본`, useCount: 0, isFavorite: false }, null);
          row.templateId = makeId('tpl');
          const advertiserUuid = row.advertiserId ? (await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId])).rows[0]?.id || null : null;
          await pgPool.query(`INSERT INTO content_templates (id, tenant_id, advertiser_id, template_type, data) VALUES ($1,$2,$3,$4,$5)`, [row.templateId, tenantId, advertiserUuid, row.templateType, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }
        // 새 버전 만들기: 같은 이름 계열로 버전 번호를 올려 새 템플릿으로 저장합니다.
        const versionMatch = pathname.match(/^\/api\/templates\/([^/]+)\/new-version$/);
        if (versionMatch && req.method === 'POST') {
          const id = decodeURIComponent(versionMatch[1]);
          const cur = await pgPool.query(`SELECT data FROM content_templates WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          if (!cur.rows[0]?.data) return sendJson(res, 404, { error: '템플릿을 찾을 수 없습니다.' });
          const source = cur.rows[0].data;
          const rootId = source.parentTemplateId || source.templateId;
          const related = await pgPool.query(`SELECT data FROM content_templates WHERE tenant_id=$1 AND (id=$2 OR data->>'parentTemplateId'=$2)`, [tenantId, rootId]);
          const maxVersion = Math.max(1, ...related.rows.map(r => Number(r.data?.version) || 1));
          const row = normalizeTemplate({ ...source, version: maxVersion + 1, parentTemplateId: rootId, useCount: 0 }, null);
          row.templateId = makeId('tpl');
          const advertiserUuid = row.advertiserId ? (await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId])).rows[0]?.id || null : null;
          await pgPool.query(`INSERT INTO content_templates (id, tenant_id, advertiser_id, template_type, data) VALUES ($1,$2,$3,$4,$5)`, [row.templateId, tenantId, advertiserUuid, row.templateType, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }
      }

      if (pathname.startsWith('/api/documents')) {
        if (!requireDb(res)) return;
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 409, { error: 'HOWTOM tenant를 찾을 수 없습니다.' });

        if (req.method === 'GET' && pathname === '/api/documents') {
          const r = await pgPool.query(`SELECT id, data FROM document_projects WHERE tenant_id=$1 ORDER BY updated_at DESC`, [tenantId]);
          return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), projectId: row.id })));
        }
        if (req.method === 'POST' && pathname === '/api/documents') {
          const body = await readJson(req);
          const row = normalizeDocumentProject(body);
          row.projectId = makeId('doc');
          if (!row.advertiserId) return sendJson(res, 400, { error: '광고주를 선택하세요.' });
          const advRes = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
          row.advertiserName = advRes.rows[0].name;
          await pgPool.query(`INSERT INTO document_projects (id, tenant_id, advertiser_id, data) VALUES ($1,$2,$3,$4)`, [row.projectId, tenantId, advRes.rows[0].id, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }
        const docMatch = pathname.match(/^\/api\/documents\/([^/]+)$/);
        if (docMatch && req.method === 'GET') {
          const id = decodeURIComponent(docMatch[1]);
          const r = await pgPool.query(`SELECT id, data FROM document_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return r.rows[0] ? sendJson(res, 200, { ...(r.rows[0].data || {}), projectId: r.rows[0].id }) : sendJson(res, 404, { error: '문서를 찾을 수 없습니다.' });
        }
        if (docMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
          const id = decodeURIComponent(docMatch[1]);
          const patch = await readJson(req);
          const cur = await pgPool.query(`SELECT data FROM document_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          const current = cur.rows[0]?.data;
          if (!current) return sendJson(res, 404, { error: '문서를 찾을 수 없습니다.' });
          const updated = normalizeDocumentProject(patch, { ...current, projectId: id });
          await pgPool.query(`UPDATE document_projects SET data=$3, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, JSON.stringify(updated)]);
          return sendJson(res, 200, updated);
        }
        if (docMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(docMatch[1]);
          await pgPool.query(`DELETE FROM document_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return sendJson(res, 200, { ok: true });
        }
      }

      if (pathname.startsWith('/api/video-scripts')) {
        if (!requireDb(res)) return;
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 409, { error: 'HOWTOM tenant를 찾을 수 없습니다.' });

        if (req.method === 'GET' && pathname === '/api/video-scripts') {
          const r = await pgPool.query(`SELECT id, data FROM video_script_projects WHERE tenant_id=$1 ORDER BY updated_at DESC`, [tenantId]);
          return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), projectId: row.id })));
        }
        if (req.method === 'POST' && pathname === '/api/video-scripts') {
          const body = await readJson(req);
          const row = normalizeVideoScriptProject(body);
          row.projectId = makeId('vs');
          if (!row.advertiserId) return sendJson(res, 400, { error: '광고주를 선택하세요.' });
          const advRes = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
          row.advertiserName = advRes.rows[0].name;
          await pgPool.query(`INSERT INTO video_script_projects (id, tenant_id, advertiser_id, data) VALUES ($1,$2,$3,$4)`, [row.projectId, tenantId, advRes.rows[0].id, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }
        const vsMatch = pathname.match(/^\/api\/video-scripts\/([^/]+)$/);
        if (vsMatch && req.method === 'GET') {
          const id = decodeURIComponent(vsMatch[1]);
          const r = await pgPool.query(`SELECT id, data FROM video_script_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return r.rows[0] ? sendJson(res, 200, { ...(r.rows[0].data || {}), projectId: r.rows[0].id }) : sendJson(res, 404, { error: '영상 대본을 찾을 수 없습니다.' });
        }
        if (vsMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
          const id = decodeURIComponent(vsMatch[1]);
          const patch = await readJson(req);
          const cur = await pgPool.query(`SELECT data FROM video_script_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          const current = cur.rows[0]?.data;
          if (!current) return sendJson(res, 404, { error: '영상 대본을 찾을 수 없습니다.' });
          const updated = normalizeVideoScriptProject(patch, { ...current, projectId: id });
          await pgPool.query(`UPDATE video_script_projects SET data=$3, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, JSON.stringify(updated)]);
          return sendJson(res, 200, updated);
        }
        if (vsMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(vsMatch[1]);
          await pgPool.query(`DELETE FROM video_script_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return sendJson(res, 200, { ok: true });
        }
      }

      if (pathname.startsWith('/api/assets')) {
        if (!requireDb(res)) return;
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 409, { error: 'HOWTOM tenant를 찾을 수 없습니다.' });

        if (req.method === 'GET' && pathname === '/api/assets') {
          const q = new URL(req.url, 'http://x').searchParams;
          const assetType = cleanText(q.get('type') || '', 20);
          const clauses = ['tenant_id = $1']; const params = [tenantId];
          if (assetType) { params.push(assetType); clauses.push(`asset_type = $${params.length}`); }
          const r = await pgPool.query(`SELECT id, advertiser_id::text as "advertiserId", asset_type as "assetType", name, url, tags, memo, created_at as "createdAt" FROM content_assets WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, params);
          return sendJson(res, 200, r.rows);
        }
        if (req.method === 'POST' && pathname === '/api/assets') {
          const body = await readJson(req);
          const name = cleanText(body.name, 200); const assetType = cleanText(body.assetType, 20);
          if (!name || !assetType) return sendJson(res, 400, { error: '이름과 유형을 입력하세요.' });
          const id = makeId('asset');
          const tags = Array.isArray(body.tags) ? body.tags.map(x => cleanText(x, 60)).filter(Boolean) : [];
          let advertiserUuid = null, advertiserName = null;
          if (body.advertiserId) {
            const advRes = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, body.advertiserId]);
            if (advRes.rows[0]) { advertiserUuid = advRes.rows[0].id; advertiserName = advRes.rows[0].name; }
          }
          await pgPool.query(`INSERT INTO content_assets (id, tenant_id, advertiser_id, asset_type, name, url, tags, memo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [id, tenantId, advertiserUuid, assetType, name, cleanText(body.url || '', 1000) || null, tags, cleanText(body.memo || '', 1000) || null]);
          return sendJson(res, 201, { id, advertiserId: advertiserUuid, advertiserName, assetType, name, url: body.url || null, tags, createdAt: new Date().toISOString() });
        }
        const assetMatch = pathname.match(/^\/api\/assets\/([^/]+)$/);
        if (assetMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(assetMatch[1]);
          await pgPool.query(`DELETE FROM content_assets WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return sendJson(res, 200, { ok: true });
        }
      }

      if (pathname.startsWith('/api/reference')) {
        if (!requireDb(res)) return;
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 409, { error: 'HOWTOM tenant를 찾을 수 없습니다.' });

        // 실시간 검색 - 저장하지 않고 결과만 보여줍니다.
        if (req.method === 'POST' && pathname === '/api/references/search') {
          const body = await readJson(req);
          const platform = cleanText(body.platform || 'meta', 20);
          if (platform === 'threads') {
            return sendJson(res, 200, { status: 'error', error: 'Threads는 Meta 공식 keyword_search API가 존재하지만, HOWTOM 커넥터가 아직 준비되지 않았습니다(연동 필요). 플랫폼 자체가 불가능한 것은 아닙니다.' });
          }
          if (platform === 'tiktok') {
            return sendJson(res, 200, { status: 'error', error: 'TikTok Commercial Content API는 현재 EU 지역 데이터만 제공하고 연구자 승인제로 운영되어, 한국 상업 광고주 대상인 HOWTOM에서 바로 사용하기 어렵습니다(연동 필요, 자격·지역 요건 재확인 필요).' });
          }
          try {
            const results = platform === 'youtube'
              ? await searchYoutubeVideos({ keyword: cleanText(body.keyword || '', 200), channelId: cleanText(body.channelId || '', 100) || undefined })
              : platform === 'instagram'
              ? await searchInstagramHashtag({ hashtag: cleanText(body.keyword || '', 100), igBusinessAccountId: cleanText(body.igBusinessAccountId || '', 60) })
              : await searchMetaAdLibrary({ keyword: cleanText(body.keyword || '', 200), pageIds: Array.isArray(body.pageIds) ? body.pageIds : undefined, country: cleanText(body.country || 'KR', 5) });
            return sendJson(res, 200, { status: 'ok', results });
          } catch (error) {
            return sendJson(res, 200, { status: 'error', error: error instanceof Error ? error.message : String(error) });
          }
        }
        if (req.method === 'GET' && pathname === '/api/references/connector-status') {
          return sendJson(res, 200, { meta: adLibraryConfigured(), youtube: youtubeConfigured(), instagram: instagramConfigured(), tiktok: false, threads: false });
        }
        if (req.method === 'GET' && pathname === '/api/references/worker-status') {
          return sendJson(res, 200, { enabled: adLibraryConfigured(), hoursKst: REFERENCE_WORKER_HOURS_KST, lastRunAt: referenceWorkerStatus.lastRunAt, lastResult: referenceWorkerStatus.lastResult });
        }
        if (req.method === 'POST' && pathname === '/api/references/worker-run-now') {
          // 사용자가 "지금 바로 실행" 버튼을 눌렀을 때 씁니다. 응답은 바로 보내고, 실제 수집은 뒤에서 계속 진행합니다.
          runReferenceWorkerCycle().catch(error => console.error('[레퍼런스 수집 Worker] 수동 실행 오류:', error?.message || error));
          return sendJson(res, 200, { ok: true, message: '수집을 시작했습니다. 완료까지 몇 분 정도 걸릴 수 있습니다.' });
        }

        // 저장된 레퍼런스 목록/저장/삭제
        if (req.method === 'GET' && pathname === '/api/references') {
          const q = new URL(req.url, 'http://x').searchParams;
          const advertiserId = cleanText(q.get('advertiserId') || '', 120);
          const clauses = ['r.tenant_id = $1']; const params = [tenantId];
          if (advertiserId) { params.push(advertiserId); clauses.push(`r.advertiser_id::text = $${params.length}`); }
          const r = await pgPool.query(
            `SELECT r.id, r.advertiser_id::text as "advertiserId", a.name as "advertiserName", r.platform, r.external_id as "externalId",
                    r.page_name as "pageName", r.is_competitor as "isCompetitor", r.body, r.headline, r.description, r.cta,
                    r.landing_url as "landingUrl", r.thumbnail_url as "thumbnailUrl", r.ad_snapshot_url as "adSnapshotUrl",
                    r.start_date as "startDate", r.is_active as "isActive", r.flight_days as "flightDays", r.view_count as "viewCount", r.like_count as "likeCount", r.ai_analysis as "aiAnalysis", r.tags, r.memo,
                    r.created_at as "createdAt",
                    COALESCE(json_agg(json_build_object('boardId', bi.board_id, 'boardName', b.name)) FILTER (WHERE bi.board_id IS NOT NULL), '[]') as boards
             FROM content_references r
             LEFT JOIN advertisers a ON a.id = r.advertiser_id
             LEFT JOIN reference_board_items bi ON bi.reference_id = r.id
             LEFT JOIN reference_boards b ON b.id = bi.board_id
             WHERE ${clauses.join(' AND ')} GROUP BY r.id, a.name ORDER BY r.created_at DESC`, params);
          return sendJson(res, 200, r.rows);
        }
        if (req.method === 'POST' && pathname === '/api/references') {
          const body = await readJson(req);
          const id = makeId('ref');
          let advertiserUuid = null;
          if (body.advertiserId) {
            const advRes = await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, body.advertiserId]);
            advertiserUuid = advRes.rows[0]?.id || null;
          }
          const flightDays = Number.isFinite(body.flightDays) ? body.flightDays : null;
          const viewCount = Number.isFinite(body.viewCount) ? body.viewCount : null;
          const likeCount = Number.isFinite(body.likeCount) ? body.likeCount : null;
          await pgPool.query(
            `INSERT INTO content_references (id, tenant_id, advertiser_id, platform, external_id, page_name, is_competitor, body, headline, description, cta, landing_url, thumbnail_url, media_type, ad_snapshot_url, country, start_date, is_active, flight_days, view_count, like_count, tags, memo)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
            [id, tenantId, advertiserUuid, cleanText(body.platform || 'meta', 20), cleanText(body.externalId || '', 120) || null,
             cleanText(body.pageName || '', 200), Boolean(body.isCompetitor), cleanText(body.body || '', 4000), cleanText(body.headline || '', 300),
             cleanText(body.description || '', 1000), cleanText(body.cta || '', 100), cleanText(body.landingUrl || '', 1000) || null,
             cleanText(body.thumbnailUrl || '', 1000) || null, cleanText(body.mediaType || '', 30), cleanText(body.adSnapshotUrl || '', 1000) || null,
             cleanText(body.country || 'KR', 5), body.startDate || null, body.isActive === undefined ? null : Boolean(body.isActive), flightDays,
             viewCount, likeCount, Array.isArray(body.tags) ? body.tags.map(x => cleanText(x, 60)).filter(Boolean) : [], cleanText(body.memo || '', 1000) || null]
          );
          return sendJson(res, 201, { id });
        }
        const refMatch = pathname.match(/^\/api\/references\/([^/]+)$/);
        if (refMatch && req.method === 'PATCH') {
          const id = decodeURIComponent(refMatch[1]);
          const body = await readJson(req);
          const sets = []; const params = [tenantId, id];
          if (body.memo !== undefined) { params.push(cleanText(body.memo, 1000)); sets.push(`memo=$${params.length}`); }
          if (body.tags !== undefined) { params.push(Array.isArray(body.tags) ? body.tags.map(x => cleanText(x, 60)).filter(Boolean) : []); sets.push(`tags=$${params.length}`); }
          if (!sets.length) return sendJson(res, 400, { error: '수정할 내용이 없습니다.' });
          await pgPool.query(`UPDATE content_references SET ${sets.join(', ')}, updated_at=now() WHERE tenant_id=$1 AND id=$2`, params);
          return sendJson(res, 200, { ok: true });
        }
        if (refMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(refMatch[1]);
          await pgPool.query(`DELETE FROM content_references WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return sendJson(res, 200, { ok: true });
        }

        // AI 분석: 저장된 레퍼런스 하나를 AI로 분석해서 후킹 유형·핵심 소구점·개선 제안을 뽑아줍니다.
        const refAnalyzeMatch = pathname.match(/^\/api\/references\/([^/]+)\/analyze$/);
        if (refAnalyzeMatch && req.method === 'POST') {
          if (!aiConfigured()) return sendJson(res, 400, { error: 'AI가 연결되지 않았습니다. 관리자가 AI_PROVIDER/AI_API_KEY를 설정해야 합니다.' });
          const id = decodeURIComponent(refAnalyzeMatch[1]);
          const cur = await pgPool.query(`SELECT * FROM content_references WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          const ref = cur.rows[0];
          if (!ref) return sendJson(res, 404, { error: '레퍼런스를 찾을 수 없습니다.' });
          const contentText = [ref.headline, ref.body, ref.description].filter(Boolean).join('\n');
          if (!contentText.trim()) return sendJson(res, 400, { error: '분석할 텍스트(제목·본문)가 없는 레퍼런스입니다.' });
          const system = `당신은 광고·콘텐츠 카피를 분석하는 전문가입니다. 주어진 광고/콘텐츠 문구를 분석해서 반드시 아래 JSON 형식으로만 응답하세요. 그 외 설명이나 코드블록 표시는 절대 포함하지 마세요.\n{"hookType": "이 콘텐츠가 쓰는 후킹 방식 한 단어(예: 가격 소구, 후기형, 문제제기형, 희소성, 숫자 제시 등)", "keyMessage": "핵심 소구점 한 문장", "ctaAssessment": "CTA(행동유도) 문구에 대한 짧은 평가", "suggestions": ["우리 광고에 참고할 만한 개선 아이디어 1", "개선 아이디어 2", "개선 아이디어 3"]}`;
          const user = `플랫폼: ${ref.platform}\n제목: ${ref.headline || '(없음)'}\n본문: ${ref.body || '(없음)'}\n설명: ${ref.description || '(없음)'}\nCTA: ${ref.cta || '(없음)'}`;
          try {
            const raw = await callAI({ system, user, maxTokens: 800 });
            const parsed = parseAiJsonResponse(raw);
            const analysis = {
              hookType: cleanText(String(parsed.hookType || ''), 100),
              keyMessage: cleanText(String(parsed.keyMessage || ''), 300),
              ctaAssessment: cleanText(String(parsed.ctaAssessment || ''), 300),
              suggestions: (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).slice(0, 5).map(s => cleanText(String(s), 200)),
            };
            await pgPool.query(`UPDATE content_references SET ai_analysis=$3, ai_analyzed_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, JSON.stringify(analysis)]);
            return sendJson(res, 200, { analysis, analyzedAt: new Date().toISOString() });
          } catch (error) {
            return sendJson(res, 502, { error: error instanceof Error ? `AI 분석에 실패했습니다: ${error.message}` : 'AI 분석에 실패했습니다.' });
          }
        }

        // 레퍼런스 보드 CRUD
        if (req.method === 'GET' && pathname === '/api/reference-boards') {
          const r = await pgPool.query(
            `SELECT b.id, b.advertiser_id::text as "advertiserId", b.name, b.created_at as "createdAt", COUNT(bi.reference_id)::int as "itemCount"
             FROM reference_boards b LEFT JOIN reference_board_items bi ON bi.board_id = b.id
             WHERE b.tenant_id=$1 GROUP BY b.id ORDER BY b.created_at DESC`, [tenantId]);
          return sendJson(res, 200, r.rows);
        }
        if (req.method === 'POST' && pathname === '/api/reference-boards') {
          const body = await readJson(req);
          const name = cleanText(body.name, 120);
          if (!name) return sendJson(res, 400, { error: '보드 이름을 입력하세요.' });
          const id = makeId('board');
          let advertiserUuid = null;
          if (body.advertiserId) { const advRes = await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, body.advertiserId]); advertiserUuid = advRes.rows[0]?.id || null; }
          await pgPool.query(`INSERT INTO reference_boards (id, tenant_id, advertiser_id, name) VALUES ($1,$2,$3,$4)`, [id, tenantId, advertiserUuid, name]);
          return sendJson(res, 201, { id, name });
        }
        const boardMatch = pathname.match(/^\/api\/reference-boards\/([^/]+)$/);
        if (boardMatch && req.method === 'PATCH') {
          const id = decodeURIComponent(boardMatch[1]);
          const body = await readJson(req);
          const name = cleanText(body.name, 120);
          if (!name) return sendJson(res, 400, { error: '보드 이름을 입력하세요.' });
          await pgPool.query(`UPDATE reference_boards SET name=$3 WHERE tenant_id=$1 AND id=$2`, [tenantId, id, name]);
          return sendJson(res, 200, { ok: true });
        }
        if (boardMatch && req.method === 'DELETE') {
          await pgPool.query(`DELETE FROM reference_boards WHERE tenant_id=$1 AND id=$2`, [tenantId, decodeURIComponent(boardMatch[1])]);
          return sendJson(res, 200, { ok: true });
        }
        const boardDetailMatch = pathname.match(/^\/api\/reference-boards\/([^/]+)\/items$/);
        if (boardDetailMatch && req.method === 'GET') {
          const r = await pgPool.query(
            `SELECT r.id, r.advertiser_id::text as "advertiserId", a.name as "advertiserName", r.platform, r.external_id as "externalId",
                    r.page_name as "pageName", r.is_competitor as "isCompetitor", r.body, r.headline, r.description, r.cta,
                    r.landing_url as "landingUrl", r.thumbnail_url as "thumbnailUrl", r.ad_snapshot_url as "adSnapshotUrl",
                    r.start_date as "startDate", r.is_active as "isActive", r.flight_days as "flightDays", r.view_count as "viewCount", r.like_count as "likeCount", r.ai_analysis as "aiAnalysis", r.tags, r.memo, r.created_at as "createdAt"
             FROM reference_board_items bi
             JOIN content_references r ON r.id = bi.reference_id
             LEFT JOIN advertisers a ON a.id = r.advertiser_id
             WHERE bi.board_id=$1 AND r.tenant_id=$2 ORDER BY bi.added_at DESC`,
            [decodeURIComponent(boardDetailMatch[1]), tenantId]
          );
          return sendJson(res, 200, r.rows.map(row => ({ ...row, boards: [] })));
        }
        const boardItemMatch = pathname.match(/^\/api\/reference-boards\/([^/]+)\/items$/);
        if (boardItemMatch && req.method === 'POST') {
          const body = await readJson(req);
          const referenceId = cleanText(body.referenceId || '', 120);
          if (!referenceId) return sendJson(res, 400, { error: 'referenceId가 필요합니다.' });
          await pgPool.query(`INSERT INTO reference_board_items (board_id, reference_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [decodeURIComponent(boardItemMatch[1]), referenceId]);
          return sendJson(res, 200, { ok: true });
        }
        const boardItemRemoveMatch = pathname.match(/^\/api\/reference-boards\/([^/]+)\/items\/([^/]+)$/);
        if (boardItemRemoveMatch && req.method === 'DELETE') {
          await pgPool.query(`DELETE FROM reference_board_items WHERE board_id=$1 AND reference_id=$2`, [decodeURIComponent(boardItemRemoveMatch[1]), decodeURIComponent(boardItemRemoveMatch[2])]);
          return sendJson(res, 200, { ok: true });
        }

        // 경쟁 브랜드 CRUD
        if (req.method === 'GET' && pathname === '/api/reference-competitors') {
          const q = new URL(req.url, 'http://x').searchParams;
          const advertiserId = cleanText(q.get('advertiserId') || '', 120);
          const clauses = ['tenant_id=$1']; const params = [tenantId];
          if (advertiserId) { params.push(advertiserId); clauses.push(`advertiser_id::text=$${params.length}`); }
          const r = await pgPool.query(`SELECT id, advertiser_id::text as "advertiserId", brand_name as "brandName", page_name as "pageName", created_at as "createdAt" FROM reference_competitors WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, params);
          return sendJson(res, 200, r.rows);
        }
        if (req.method === 'POST' && pathname === '/api/reference-competitors') {
          const body = await readJson(req);
          const brandName = cleanText(body.brandName, 120);
          if (!brandName || !body.advertiserId) return sendJson(res, 400, { error: '광고주와 경쟁 브랜드명을 입력하세요.' });
          const advRes = await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, body.advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
          const id = makeId('competitor');
          await pgPool.query(`INSERT INTO reference_competitors (id, tenant_id, advertiser_id, brand_name, page_name) VALUES ($1,$2,$3,$4,$5)`, [id, tenantId, advRes.rows[0].id, brandName, cleanText(body.pageName || '', 200) || null]);
          return sendJson(res, 201, { id, brandName });
        }
        const competitorMatch = pathname.match(/^\/api\/reference-competitors\/([^/]+)$/);
        if (competitorMatch && req.method === 'DELETE') {
          await pgPool.query(`DELETE FROM reference_competitors WHERE tenant_id=$1 AND id=$2`, [tenantId, decodeURIComponent(competitorMatch[1])]);
          return sendJson(res, 200, { ok: true });
        }
      }

      if (pathname.startsWith('/api/blog/')) {
        if (!requireDb(res)) return;
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 409, { error: 'HOWTOM tenant를 찾을 수 없습니다.' });

        if (req.method === 'GET' && pathname === '/api/blog/projects') {
          const r = await pgPool.query(
            `SELECT id, data FROM blog_projects WHERE tenant_id=$1 ${payload.advertiserScopeId ? `AND data->>'advertiserId'=$2` : ''} ORDER BY created_at DESC`,
            payload.advertiserScopeId ? [tenantId, payload.advertiserScopeId] : [tenantId]
          );
          return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), projectId: row.id })));
        }
        if (req.method === 'POST' && pathname === '/api/blog/projects') {
          const body = await readJson(req); const stamp = new Date().toISOString();
          // 광고주 계정은 body.advertiserId를 신뢰하지 않고 항상 본인 광고주로 고정합니다.
          const forcedAdvertiserId = payload.advertiserScopeId || cleanText(body.advertiserId, 120);
          const row = {
            projectId: makeId('blog'), advertiserId: forcedAdvertiserId, advertiserName: cleanText(body.advertiserName, 120),
            industry: cleanText(body.industry || '일반 서비스업', 120), platform: cleanText(body.platform || '네이버 블로그', 120), contentType: cleanText(body.contentType || '정보형 블로그', 120),
            purpose: cleanText(body.purpose || '정보 제공', 120), primaryKeyword: cleanText(body.primaryKeyword || '', 200), secondaryKeywords: Array.isArray(body.secondaryKeywords) ? body.secondaryKeywords.map(x => cleanText(x, 100)).filter(Boolean).slice(0, 20) : [],
            region: cleanText(body.region || '', 120), targetLength: Number(body.targetLength || 2000), tone: cleanText(body.tone || '광고주 문체 자동 적용', 120), referenceText: cleanText(body.referenceText || '', 20000),
            options: { style: true, advertiserInfo: true, photos: true, compliance: true, seo: true, medical: false, ...(body.options || {}) },
            titleOptions: [], selectedTitle: '', blocks: [], status: 'draft', complianceStatus: 'not-reviewed', medicalReview: { required: null, status: 'not-reviewed', reviewNumber: '', reviewedAt: '', locked: false },
            seoScore: 0, complianceIssues: [], assetIds: [], publishStatus: 'draft', scheduledAt: '', publishedUrl: '', createdAt: stamp, updatedAt: stamp,
          };
          if (!row.advertiserId) return sendJson(res, 400, { error: '광고주를 선택하세요.' });
          const advRes = await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
          await pgPool.query(`INSERT INTO blog_projects (id, tenant_id, advertiser_id, data) VALUES ($1,$2,$3,$4)`, [row.projectId, tenantId, advRes.rows[0].id, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }

        const projectMatch = pathname.match(/^\/api\/blog\/projects\/([^/]+)$/);
        if (projectMatch && req.method === 'GET') {
          const id = decodeURIComponent(projectMatch[1]);
          const r = await pgPool.query(`SELECT id, data FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          if (!r.rows[0]) return sendJson(res, 404, { error: '블로그 프로젝트를 찾을 수 없습니다.' });
          if (payload.advertiserScopeId && r.rows[0].data?.advertiserId !== payload.advertiserScopeId) return sendJson(res, 403, { error: '이 프로젝트에 접근할 권한이 없습니다.' });
          return sendJson(res, 200, { ...(r.rows[0].data || {}), projectId: r.rows[0].id });
        }
        if (projectMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
          const id = decodeURIComponent(projectMatch[1]); const patch = await readJson(req);
          const cur = await pgPool.query(`SELECT data FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          const current = cur.rows[0]?.data;
          if (!current) return sendJson(res, 404, { error: '블로그 프로젝트를 찾을 수 없습니다.' });
          if (payload.advertiserScopeId && current.advertiserId !== payload.advertiserScopeId) return sendJson(res, 403, { error: '이 프로젝트에 접근할 권한이 없습니다.' });
          if (current.medicalReview?.locked && (patch.blocks || patch.selectedTitle) && !patch.unlockForRevision) return sendJson(res, 409, { error: '심의 완료 문안이 잠겨 있습니다. 재검토로 전환한 뒤 수정하세요.' });
          const safePatch = { ...patch }; delete safePatch.projectId; delete safePatch.createdAt; delete safePatch.unlockForRevision; delete safePatch.advertiserId;
          const updated = { ...current, ...safePatch, projectId: id, updatedAt: new Date().toISOString() };
          await pgPool.query(`UPDATE blog_projects SET data=$3, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, JSON.stringify(updated)]);
          return sendJson(res, 200, updated);
        }
        if (projectMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(projectMatch[1]);
          if (payload.advertiserScopeId) {
            const cur = await pgPool.query(`SELECT data FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
            if (cur.rows[0] && cur.rows[0].data?.advertiserId !== payload.advertiserScopeId) return sendJson(res, 403, { error: '이 프로젝트에 접근할 권한이 없습니다.' });
          }
          await pgPool.query(`DELETE FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return sendJson(res, 200, { ok: true });
        }

        if (req.method === 'GET' && pathname === '/api/blog/ai-status') {
          return sendJson(res, 200, { configured: blogGenerationConfigured(), provider: autopostProConfigured() ? 'autopost-pro' : (blogGenerationConfigured() ? 'partner' : null) });
        }

        // 환경변수가 "설정되어 있는지"와 "실제로 유효해서 API가 응답하는지"는 다른 문제라,
        // 실제로 오토포스트 Pro 서버에 호출을 한 번 날려보고 결과를 그대로 보여줍니다.
        if (req.method === 'GET' && pathname === '/api/blog/autopost-pro/test-connection') {
          if (!autopostProConfigured()) return sendJson(res, 200, { connected: false, reason: 'AUTOPOST_PRO_API_KEY가 설정되어 있지 않습니다.' });
          try {
            await autopostProRequest('GET', '/v1/usage');
            return sendJson(res, 200, { connected: true, reason: '정상적으로 연결되어 응답을 받았습니다.' });
          } catch (error) {
            const status = error?.status;
            const reason = status === 401 || status === 403 ? 'API 키가 유효하지 않습니다(401/403). 발급받은 키가 정확한지 확인하세요.'
              : status ? `오토포스트 Pro 서버가 오류를 반환했습니다(HTTP ${status}): ${error?.message || ''}`
              : `오토포스트 Pro 서버에 연결하지 못했습니다: ${error?.message || error}`;
            return sendJson(res, 200, { connected: false, reason, status: status || null });
          }
        }

        // ── 좌석(seat) 관리: 조회(GET)는 절대 새로 만들지 않고, 생성은 POST로만 ────
        if (req.method === 'GET' && pathname === '/api/blog/autopost-pro/seat') {
          if (!autopostProConfigured()) return sendJson(res, 400, { error: '오토포스트 Pro가 아직 연결되지 않았습니다.' });
          const q = new URL(req.url, 'http://x').searchParams;
          const advertiserId = q.get('advertiserId');
          if (!advertiserId) return sendJson(res, 400, { error: 'advertiserId가 필요합니다.' });
          if (payload.advertiserScopeId && advertiserId !== payload.advertiserScopeId) return sendJson(res, 403, { error: '이 광고주에 접근할 권한이 없습니다.' });
          const cached = await findAutopostProSeat(advertiserId);
          if (!cached) return sendJson(res, 404, { error: '아직 좌석이 없습니다. 먼저 초안을 생성하거나 좌석을 만드세요.', noSeat: true });
          try {
            const fresh = await autopostProRequest('GET', `/v1/seats/${cached.seat_id}`);
            await pgPool.query('UPDATE autopost_pro_seats SET plan=$2, trial_remaining=$3, status=$4, updated_at=now() WHERE advertiser_id=$1', [advertiserId, fresh.plan || null, fresh.trial_remaining ?? null, fresh.status || null]);
            return sendJson(res, 200, fresh);
          } catch (error) {
            return sendJson(res, error?.status || 502, { error: error?.message || '좌석 정보를 가져오지 못했습니다.' });
          }
        }
        if (req.method === 'POST' && pathname === '/api/blog/autopost-pro/seat') {
          if (!autopostProConfigured()) return sendJson(res, 400, { error: '오토포스트 Pro가 아직 연결되지 않았습니다.' });
          const body = await readJson(req);
          const advertiserId = cleanText(body.advertiserId || '', 120);
          if (!advertiserId) return sendJson(res, 400, { error: 'advertiserId가 필요합니다.' });
          if (payload.advertiserScopeId && advertiserId !== payload.advertiserScopeId) return sendJson(res, 403, { error: '이 광고주에 접근할 권한이 없습니다.' });
          const advRes = await pgPool.query('SELECT id, name, industry, business_reg_no, autopost_pro_industry FROM advertisers WHERE tenant_id=$1 AND id::text=$2', [tenantId, advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 404, { error: '광고주를 찾을 수 없습니다.' });
          try {
            const seatRow = await ensureAutopostProSeat(tenantId, advRes.rows[0]);
            return sendJson(res, 201, seatRow);
          } catch (error) {
            return sendJson(res, error?.status || 502, { error: error?.message || '좌석 생성에 실패했습니다.' });
          }
        }
        // ── 아래 3개는 여러 광고주를 관리하는 내부 직원 전용 기능입니다.
        // 광고주 계정은 본인 좌석 하나만 조회/생성할 수 있고, 정지·재개·전체목록·
        // 전체사용량 같은 관리 기능에는 아예 접근할 수 없습니다. ──
        if (payload.advertiserScopeId && (
          (req.method === 'POST' && (pathname === '/api/blog/autopost-pro/seat/suspend' || pathname === '/api/blog/autopost-pro/seat/activate')) ||
          (req.method === 'GET' && (pathname === '/api/blog/autopost-pro/seats' || pathname === '/api/blog/autopost-pro/usage'))
        )) {
          return sendJson(res, 403, { error: '이 기능은 관리자 전용입니다.' });
        }
        if (req.method === 'POST' && (pathname === '/api/blog/autopost-pro/seat/suspend' || pathname === '/api/blog/autopost-pro/seat/activate')) {
          if (!autopostProConfigured()) return sendJson(res, 400, { error: '오토포스트 Pro가 아직 연결되지 않았습니다.' });
          const body = await readJson(req);
          const advertiserId = cleanText(body.advertiserId || '', 120);
          if (!advertiserId) return sendJson(res, 400, { error: 'advertiserId가 필요합니다.' });
          const action = pathname.endsWith('suspend') ? 'suspend' : 'activate';
          try {
            const updated = await setAutopostProSeatStatus(advertiserId, action);
            return sendJson(res, 200, updated);
          } catch (error) {
            return sendJson(res, error?.status || 502, { error: error?.message || '좌석 상태 변경에 실패했습니다.' });
          }
        }
        if (req.method === 'GET' && pathname === '/api/blog/autopost-pro/seats') {
          // 광고주 계약 종료 시 정지할 대상을 찾기 위한 전체 목록(HOWTOM 광고주명 포함).
          if (!autopostProConfigured()) return sendJson(res, 400, { error: '오토포스트 Pro가 아직 연결되지 않았습니다.' });
          const rows = await pgPool.query(
            `SELECT s.*, a.name as advertiser_name FROM autopost_pro_seats s JOIN advertisers a ON a.id = s.advertiser_id WHERE s.tenant_id = $1 ORDER BY s.updated_at DESC`,
            [tenantId]
          );
          return sendJson(res, 200, { items: rows.rows });
        }

        // ── 월 사용량·정산 조회 ───────────────────────────────────────────
        if (req.method === 'GET' && pathname === '/api/blog/autopost-pro/usage') {
          if (!autopostProConfigured()) return sendJson(res, 400, { error: '오토포스트 Pro가 아직 연결되지 않았습니다.' });
          const q = new URL(req.url, 'http://x').searchParams;
          const month = q.get('month');
          try {
            const usage = await autopostProRequest('GET', `/v1/usage${month ? `?month=${encodeURIComponent(month)}` : ''}`);
            return sendJson(res, 200, usage);
          } catch (error) {
            return sendJson(res, error?.status || 502, { error: error?.message || '사용량 조회에 실패했습니다.' });
          }
        }

        // ── 업종별 규정검수(/v1/compliance) - HOWTOM 자체 사전점검(complianceEngine.ts)과는
        // 별개입니다. 여기서는 오토포스트 Pro가 실제로 계산한 결과만 반환·저장합니다.
        if (req.method === 'POST' && pathname === '/api/blog/compliance') {
          if (!autopostProConfigured()) return sendJson(res, 400, { error: '오토포스트 Pro가 아직 연결되지 않았습니다.' });
          const body = await readJson(req);
          const industry = cleanText(body.industry || '', 40);
          const text = cleanText(body.text || '', 20000);
          const orgName = cleanText(body.orgName || body.org_name || '', 200);
          if (!industry || !text) return sendJson(res, 400, { error: 'industry와 text가 필요합니다.' });
          try {
            const result = await autopostProRequest('POST', '/v1/compliance', { industry, text, org_name: orgName });
            await pgPool.query(
              `INSERT INTO blog_compliance_checks (tenant_id, project_id, passed, issues) VALUES ($1,$2,$3,$4)`,
              [tenantId, cleanText(body.projectId || '', 120) || null, Boolean(result.passed), JSON.stringify(result.issues || [])]
            );
            return sendJson(res, 200, result);
          } catch (error) {
            return sendJson(res, error?.status || 502, { error: error?.message || '규정검수에 실패했습니다.' });
          }
        }

        // ── 초안 생성 (중복 과금 방지: 같은 idempotencyKey는 AI를 다시 부르지 않습니다) ──
        if (req.method === 'POST' && pathname === '/api/blog/generate') {
          const body = await readJson(req);
          const keyword = cleanText(body.primaryKeyword, 200);
          if (!keyword) return sendJson(res, 400, { error: '메인 키워드를 입력하세요.' });
          const idempotencyKey = cleanText(body.idempotencyKey || '', 100);
          if (!idempotencyKey) return sendJson(res, 400, { error: 'idempotencyKey가 필요합니다(중복 생성·중복 과금 방지용).' });
          const projectId = cleanText(body.projectId || '', 120);
          if (!projectId) return sendJson(res, 400, { error: 'projectId가 필요합니다.' });

          // 외부(과금 가능) API를 부르기 전에 반드시 먼저 확인합니다: 이 프로젝트가
          // 실제로 존재하는가? 존재하지 않으면 여기서 즉시 404로 끝내고, 오토포스트 Pro는
          // 아예 호출하지 않습니다 - 잘못된 projectId로 과금만 발생하고 저장은 안 되는
          // 상황을 원천적으로 막습니다.
          const projectRow = await pgPool.query('SELECT data FROM blog_projects WHERE tenant_id=$1 AND id=$2', [tenantId, projectId]);
          if (!projectRow.rows.length) return sendJson(res, 404, { error: '존재하지 않는 프로젝트입니다.' });
          // advertiserId는 클라이언트가 보낸 값을 신뢰하지 않고, 이 프로젝트에 실제로
          // 연결된 광고주로 항상 덮어씁니다 - 클라이언트 값과 프로젝트 소속 광고주가
          // 달라도(또는 조작되어도) 항상 프로젝트의 진짜 광고주 기준으로만 과금·좌석이 결정됩니다.
          const verifiedAdvertiserId = cleanText(projectRow.rows[0].data?.advertiserId || '', 120);
          if (payload.advertiserScopeId && verifiedAdvertiserId !== payload.advertiserScopeId) return sendJson(res, 403, { error: '이 프로젝트에 접근할 권한이 없습니다.' });

          // 이미 같은 키로 완전히 끝난 시도가 있으면 그 결과를 그대로 재사용합니다(재클릭·재요청 방지).
          const existing = await pgPool.query('SELECT * FROM blog_generation_requests WHERE idempotency_key=$1', [idempotencyKey]);
          const reqRow = existing.rows[0];
          if (reqRow?.status === 'completed') {
            return sendJson(res, 200, { ...reqRow.result, billing: reqRow.billing, idempotencyKey, replayed: true });
          }

          let genResult;
          if (reqRow?.status === 'ai_completed') {
            // AI 호출은 이미 성공(=이미 과금됐을 수 있음)했는데 저장에서 멈춘 경우 - AI를
            // 다시 부르지 않고, 캐시해둔 결과로 저장만 다시 시도합니다. 이 fix 배포 전에
            // 이미 저장된(정제 안 된) 캐시일 수도 있으니 여기서도 한 번 더 정제합니다.
            genResult = sanitizeDeep({ ...reqRow.result, billing: reqRow.billing });
          } else {
            try {
              const brief = {
                advertiserId: verifiedAdvertiserId,
                industry: cleanText(body.industry || '업종 무관', 60), platform: cleanText(body.platform || '블로그', 60),
                primaryKeyword: keyword,
                // 서브 키워드·지역·톤앤매너·참고자료는 오토포스트 Pro API 규격에 없는 필드라
                // 실제 생성 요청에는 반영되지 않습니다 - HOWTOM 내부 참고용으로만 저장됩니다.
                secondaryKeywords: Array.isArray(body.secondaryKeywords) ? body.secondaryKeywords : [],
                region: cleanText(body.region || '', 60), targetLength: Number(body.targetLength) || undefined, tone: cleanText(body.tone || '자연스러운 정보 전달형', 60),
                length: cleanText(body.length || '', 20), numImages: body.numImages, confirmOverage: Boolean(body.confirmOverage),
                idempotencyKey,
              };
              genResult = sanitizeDeep(await callBlogGenerationProvider(brief));
              await pgPool.query(
                `INSERT INTO blog_generation_requests (tenant_id, project_id, idempotency_key, provider_draft_id, status, billing, result)
                 VALUES ($1,$2,$3,$4,'ai_completed',$5,$6)
                 ON CONFLICT (idempotency_key) DO UPDATE SET status='ai_completed', billing=$5, result=$6, provider_draft_id=$4`,
                [tenantId, projectId, idempotencyKey, genResult.providerDraftId || null, JSON.stringify(genResult.billing || null), JSON.stringify(genResult)]
              );
            } catch (error) {
              const status = error?.code === 'overage_confirm_required' ? 409 : (error?.status || 502);
              return sendJson(res, status, { error: error instanceof Error ? error.message : 'AI 원고 생성에 실패했습니다.', code: error?.code });
            }
          }

          // 생성된 내용을 프로젝트에 저장합니다(위에서 이미 존재를 확인했으니 여기선 항상 있습니다).
          // 이 저장이 실패해도 "생성 실패"가 아니라 "생성은 끝났고(이미 과금됐을 수 있음)
          // 저장만 재시도가 필요"한 상태입니다.
          try {
            const cur = await pgPool.query('SELECT data FROM blog_projects WHERE tenant_id=$1 AND id=$2', [tenantId, projectId]);
            if (cur.rows[0]) {
              // genResult는 이미 위에서(callBlogGenerationProvider 직후, 첫 DB 저장 전에)
              // sanitizeDeep으로 정제됐으므로 여기서 다시 필드별로 정제할 필요가 없습니다.
              const updated = {
                ...cur.rows[0].data,
                titleOptions: genResult.titles || [], selectedTitle: genResult.titles?.[0] || '', blocks: genResult.blocks || [], status: 'writing',
                billing: genResult.billing || null, providerDraftId: genResult.providerDraftId || null, tags: genResult.tags || [], metaDescription: genResult.metaDescription || '',
                updatedAt: new Date().toISOString(),
              };
              await pgPool.query('UPDATE blog_projects SET data=$3, updated_at=now() WHERE tenant_id=$1 AND id=$2', [tenantId, projectId, JSON.stringify(updated)]);
            }
            await pgPool.query(`UPDATE blog_generation_requests SET status='completed', completed_at=now() WHERE idempotency_key=$1`, [idempotencyKey]);
            return sendJson(res, 200, { ...genResult, idempotencyKey });
          } catch (saveError) {
            // 예전엔 이 에러가 콘솔에 전혀 안 남아서, 저장이 왜 계속 실패하는지 로그로도
            // 알 방법이 없었습니다 - 반드시 남깁니다(Railway 배포 로그에서 확인 가능).
            console.error('[블로그 생성] 저장 실패:', { projectId, idempotencyKey, error: saveError?.message || saveError, stack: saveError?.stack });
            return sendJson(res, 200, {
              ...genResult, idempotencyKey,
              saveWarning: `초안 생성은 완료됐지만 저장 중 오류가 발생했습니다(이미 과금됐을 수 있어 다시 생성하지 마세요): ${saveError?.message || '알 수 없는 오류'}. 같은 화면에서 다시 시도하면 재생성 없이 저장만 재시도합니다.`,
            });
          }
        }

        const styleMatch = pathname.match(/^\/api\/blog\/styles\/([^/]+)$/);
        if (styleMatch && req.method === 'GET') {
          const advertiserId = decodeURIComponent(styleMatch[1]);
          const r = await pgPool.query(`SELECT data FROM blog_styles WHERE tenant_id=$1 AND advertiser_id::text=$2`, [tenantId, advertiserId]);
          return sendJson(res, 200, r.rows[0]?.data || { advertiserId, tone: '', rules: [], preferredPhrases: [], prohibitedPhrases: [], cta: '', sourceTexts: [] });
        }
        if (styleMatch && req.method === 'PUT') {
          const advertiserId = decodeURIComponent(styleMatch[1]); const body = await readJson(req);
          const advRes = await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '광고주를 찾을 수 없습니다.' });
          const updated = { ...body, advertiserId, updatedAt: new Date().toISOString() };
          await pgPool.query(`INSERT INTO blog_styles (tenant_id, advertiser_id, data) VALUES ($1,$2,$3) ON CONFLICT (tenant_id, advertiser_id) DO UPDATE SET data=EXCLUDED.data`, [tenantId, advRes.rows[0].id, JSON.stringify(updated)]);
          return sendJson(res, 200, updated);
        }

        if (req.method === 'GET' && pathname === '/api/blog/assets') {
          const r = await pgPool.query(`SELECT id, data FROM blog_assets WHERE tenant_id=$1 ORDER BY created_at DESC`, [tenantId]);
          return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), assetId: row.id })));
        }
        if (req.method === 'POST' && pathname === '/api/blog/assets') {
          const body = await readJson(req);
          const row = { assetId: makeId('asset'), advertiserId: cleanText(body.advertiserId, 120), name: cleanText(body.name, 200), url: cleanText(body.url, 1000), tags: Array.isArray(body.tags) ? body.tags.map(x => cleanText(x, 80)).filter(Boolean) : [], createdAt: new Date().toISOString() };
          if (!row.advertiserId || !row.name) return sendJson(res, 400, { error: '광고주와 자산명을 입력하세요.' });
          const advRes = await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '광고주를 찾을 수 없습니다.' });
          await pgPool.query(`INSERT INTO blog_assets (id, tenant_id, data) VALUES ($1,$2,$3)`, [row.assetId, tenantId, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }
      }

      // ── 광고 제작·영상 대본·문서 작성 (HOWTOM Universe에서 이관) ────────────
      // blog_projects와 완전히 같은 방식(서버 JSONB)입니다. project_type으로
      // 'ad'|'video-script'|'document' 3종류를 한 테이블에서 나눠서 관리합니다.
      if (pathname.startsWith('/api/content-projects')) {
        if (!requireDb(res)) return;
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 409, { error: 'HOWTOM tenant를 찾을 수 없습니다.' });

        if (req.method === 'GET' && pathname === '/api/content-projects') {
          const q = new URL(req.url, 'http://x').searchParams;
          const type = q.get('type');
          const conditions = ['tenant_id=$1']; const params = [tenantId];
          if (type) { params.push(type); conditions.push(`project_type=$${params.length}`); }
          if (payload.advertiserScopeId) { params.push(payload.advertiserScopeId); conditions.push(`data->>'advertiserId'=$${params.length}`); }
          const r = await pgPool.query(`SELECT id, data FROM content_projects WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`, params);
          return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), projectId: row.id })));
        }
        if (req.method === 'POST' && pathname === '/api/content-projects') {
          const body = await readJson(req);
          const projectType = cleanText(body.projectType || '', 20);
          if (!['ad', 'video-script', 'document'].includes(projectType)) return sendJson(res, 400, { error: 'projectType은 ad, video-script, document 중 하나여야 합니다.' });
          const forcedAdvertiserId = payload.advertiserScopeId || cleanText(body.advertiserId, 120);
          if (!forcedAdvertiserId) return sendJson(res, 400, { error: '광고주를 선택하세요.' });
          const advRes = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, forcedAdvertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
          const stamp = new Date().toISOString();
          const row = { ...body, projectId: makeId('content'), projectType, advertiserId: forcedAdvertiserId, advertiserName: advRes.rows[0].name, status: body.status || 'draft', createdAt: stamp, updatedAt: stamp };
          await pgPool.query(`INSERT INTO content_projects (id, tenant_id, project_type, advertiser_id, data) VALUES ($1,$2,$3,$4,$5)`, [row.projectId, tenantId, projectType, advRes.rows[0].id, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }
        const cpMatch = pathname.match(/^\/api\/content-projects\/([^/]+)$/);
        if (cpMatch && req.method === 'GET') {
          const id = decodeURIComponent(cpMatch[1]);
          const r = await pgPool.query(`SELECT id, data FROM content_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          if (!r.rows[0]) return sendJson(res, 404, { error: '프로젝트를 찾을 수 없습니다.' });
          if (payload.advertiserScopeId && r.rows[0].data?.advertiserId !== payload.advertiserScopeId) return sendJson(res, 403, { error: '이 프로젝트에 접근할 권한이 없습니다.' });
          return sendJson(res, 200, { ...(r.rows[0].data || {}), projectId: r.rows[0].id });
        }
        if (cpMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
          const id = decodeURIComponent(cpMatch[1]); const patch = await readJson(req);
          const cur = await pgPool.query(`SELECT data FROM content_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          const current = cur.rows[0]?.data;
          if (!current) return sendJson(res, 404, { error: '프로젝트를 찾을 수 없습니다.' });
          if (payload.advertiserScopeId && current.advertiserId !== payload.advertiserScopeId) return sendJson(res, 403, { error: '이 프로젝트에 접근할 권한이 없습니다.' });
          const safePatch = { ...patch }; delete safePatch.projectId; delete safePatch.createdAt; delete safePatch.projectType; delete safePatch.advertiserId;
          const updated = { ...current, ...safePatch, projectId: id, updatedAt: new Date().toISOString() };
          await pgPool.query(`UPDATE content_projects SET data=$3, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, JSON.stringify(updated)]);
          return sendJson(res, 200, updated);
        }
        if (cpMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(cpMatch[1]);
          if (payload.advertiserScopeId) {
            const cur = await pgPool.query(`SELECT data FROM content_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
            if (cur.rows[0] && cur.rows[0].data?.advertiserId !== payload.advertiserScopeId) return sendJson(res, 403, { error: '이 프로젝트에 접근할 권한이 없습니다.' });
          }
          await pgPool.query(`DELETE FROM content_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return sendJson(res, 200, { ok: true });
        }
      }

      return sendJson(res, 404, { error: '현재 단계에서 제공하지 않는 API입니다.' });
    }

    serveStatic(pathname, res);
  } catch (error) {
    console.error('[Content Studio]', error);
    sendJson(res, 500, { error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' });
  }
});

// ============================================================
// 레퍼런스 자동 수집 Worker (PHASE 4)
// ------------------------------------------------------------
// 별도 서비스로 분리하지 않고, 유니버스의 자동 동기화와 같은 방식으로 이 서버 프로세스
// 안에서 정해진 시간마다 실행합니다. 수집이 느리거나 하나 실패해도 웹 화면 응답에는
// 영향을 주지 않도록, 흐름을 절대 막지 않고(non-blocking) 에러를 전부 잡아서 넘어갑니다.
// ============================================================
let referenceWorkerStatus = { lastRunAt: null, lastResult: null };

/** 등록된 경쟁 브랜드를 전부 순회하며, 새 광고는 저장하고 기존 광고는 게재 상태를 갱신합니다. */
async function runReferenceWorkerCycle() {
  if (!pgPool || !adLibraryConfigured()) {
    console.log('[레퍼런스 수집 Worker] DB 또는 Meta 광고 라이브러리 연동이 없어 건너뜁니다.');
    return;
  }
  const competitors = await pgPool.query(`SELECT id, tenant_id, advertiser_id::text as advertiser_id, brand_name, page_name FROM reference_competitors`);
  console.log(`[레퍼런스 수집 Worker] 시작 - 경쟁 브랜드 ${competitors.rows.length}개`);
  let newCount = 0, updatedCount = 0, failedCount = 0;
  for (const c of competitors.rows) {
    try {
      const results = await searchMetaAdLibrary({ keyword: c.page_name || c.brand_name });
      for (const r of results) {
        const existing = await pgPool.query(`SELECT id FROM content_references WHERE tenant_id=$1 AND platform='meta' AND external_id=$2`, [c.tenant_id, r.externalId]);
        if (existing.rows[0]) {
          // 이미 저장된 광고면 게재 상태(운영 중/종료, 게재일수)만 최신으로 갱신합니다. 문구 등 나머지 내용은 사용자가 저장한 그대로 둡니다.
          await pgPool.query(`UPDATE content_references SET is_active=$3, flight_days=$4, updated_at=now() WHERE id=$1 AND tenant_id=$2`, [existing.rows[0].id, c.tenant_id, r.isActive, r.flightDays]);
          updatedCount++;
        } else {
          // 새로 발견된 경쟁사 광고는 자동으로 레퍼런스로 저장합니다.
          const id = makeId('ref');
          await pgPool.query(
            `INSERT INTO content_references (id, tenant_id, advertiser_id, platform, external_id, page_name, is_competitor, body, headline, description, cta, ad_snapshot_url, start_date, is_active, flight_days)
             VALUES ($1,$2,$3,'meta',$4,$5,true,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [id, c.tenant_id, c.advertiser_id, r.externalId, r.pageName, r.body, r.headline, r.description, r.cta, r.adSnapshotUrl, r.startDate, r.isActive, r.flightDays]
          );
          newCount++;
        }
      }
    } catch (error) {
      failedCount++;
      console.error(`[레퍼런스 수집 Worker 실패] ${c.brand_name}:`, error?.message || error);
    }
    // Meta API 요청이 한꺼번에 몰리지 않도록 브랜드 사이에 약간의 간격을 둡니다.
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`[레퍼런스 수집 Worker] 완료 - 신규 ${newCount}건, 갱신 ${updatedCount}건, 실패 ${failedCount}개 브랜드`);
  referenceWorkerStatus = { lastRunAt: new Date().toISOString(), lastResult: { competitors: competitors.rows.length, newCount, updatedCount, failedCount } };
}

/** 하루 2번(한국시간 08시, 20시)에 레퍼런스 자동 수집을 실행합니다. 광고 라이브러리는 하루 단위로
 * 갱신되는 데이터라 성과 동기화만큼 자주 돌 필요는 없습니다. */
const REFERENCE_WORKER_HOURS_KST = [8, 20];
let lastReferenceWorkerKey = '';
function scheduleReferenceWorker() {
  setInterval(() => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: 'numeric', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const get = (type) => parts.find(p => p.type === type)?.value;
    const hour = Number(get('hour')); const minute = Number(get('minute'));
    const dateKey = `${get('year')}-${get('month')}-${get('day')}-${hour}`;
    if (minute === 0 && REFERENCE_WORKER_HOURS_KST.includes(hour) && lastReferenceWorkerKey !== dateKey) {
      lastReferenceWorkerKey = dateKey;
      console.log(`[레퍼런스 수집 Worker] 예약 시각 도달: 한국시간 ${hour}시`);
      runReferenceWorkerCycle().catch(error => console.error('[레퍼런스 수집 Worker] 처리되지 않은 오류:', error?.message || error));
    }
  }, 60_000);
  console.log(`[레퍼런스 수집 Worker] 스케줄러 시작 - 매일 한국시간 ${REFERENCE_WORKER_HOURS_KST.join(', ')}시에 자동 실행됩니다.`);
}
if (pgPool) scheduleReferenceWorker();

server.listen(PORT, '0.0.0.0', () => console.log(`[HOWTOM Content Studio] listening on :${PORT}`));
process.on('SIGTERM', async () => { try { await pgPool?.end(); } catch {} server.close(() => process.exit(0)); });
