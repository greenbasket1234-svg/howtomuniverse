-- HOWTOM 유니버스 — 멀티테넌트 SaaS 스키마
-- 이 파일은 몇 번을 실행해도 안전하도록(IF NOT EXISTS) 작성되어 있습니다.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid() 사용을 위해 필요합니다.

-- ────────────────────────────────────────────────────────────
-- 고객사(Tenant) — HOWTOM을 구매/사용하는 회사 단위입니다.
-- 모든 업무 테이블은 반드시 tenant_id를 가지고, 조회할 때 항상 이 값으로 걸러야 합니다.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'basic', -- basic | pro | agency
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended | canceled
  -- Entitlement(요금제별 권한)는 "if plan==='pro'"처럼 코드에 박지 않고, 이 컬럼들로 제어합니다.
  max_advertisers INTEGER NOT NULL DEFAULT 1,
  max_members INTEGER NOT NULL DEFAULT 1,
  max_media_accounts INTEGER NOT NULL DEFAULT 2,
  monthly_ai_limit INTEGER NOT NULL DEFAULT 30,
  can_use_automation BOOLEAN NOT NULL DEFAULT false,
  can_use_client_portal BOOLEAN NOT NULL DEFAULT false,
  -- 이 값이 채워지면 '마이그레이션 실행'이 광고주 목록을 다시 만들지 않습니다(광고주는 Postgres가
  -- 진짜 데이터이고, 원본 JSON 파일은 그대로 남아있어서 삭제한 광고주가 되살아나는 걸 막기 위함).
  advertisers_migrated_at TIMESTAMPTZ,
  -- 자동 동기화 실행 이력. 서버 메모리에만 두면 배포(재시작)할 때마다 초기화되어
  -- "이력 없음"으로 잘못 표시되는 문제가 있어, 여기 DB에 영구 저장합니다.
  auto_sync_last_run_at TIMESTAMPTZ,
  auto_sync_last_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 사용자(로그인 계정). 한 사람이 여러 테넌트에 속할 수 있어(예: 프리랜서), tenant_members로 소속을 따로 관리합니다.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 사용자 ↔ 테넌트 소속 + 역할(RBAC)
CREATE TABLE IF NOT EXISTS tenant_members (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin', -- owner | admin | marketer | viewer
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

-- ────────────────────────────────────────────────────────────
-- 광고주(Advertiser) — 그 테넌트가 "관리하는 대상" 업체입니다. (테넌트 자신과는 다른 개념)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advertisers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  monthly_budget NUMERIC NOT NULL DEFAULT 0,
  brand_color TEXT,
  industry TEXT,
  website TEXT,
  phone TEXT,
  address TEXT,
  business_reg_no TEXT, -- 사업자등록번호. 오토포스트 Pro 등 외부 제휴 API의 seat(좌석) 생성·중복 판별 기준으로 씁니다.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_advertisers_tenant ON advertisers(tenant_id);
ALTER TABLE advertisers ADD COLUMN IF NOT EXISTS business_reg_no TEXT;
-- HOWTOM 자체 업종(위 industry, 한글 라벨)과 오토포스트 Pro가 요구하는 업종 코드(영문,
-- medical/tax/academy/vet)는 서로 다른 값입니다. 대부분은 자동 매핑되지만(server.mjs의
-- mapIndustryToAutopostCode), 제휴사가 새 업종을 추가해주면 그 코드를 여기 직접 입력해
-- 자동 매핑을 덮어쓸 수 있습니다.
ALTER TABLE advertisers ADD COLUMN IF NOT EXISTS autopost_pro_industry TEXT;

-- ============================================================
-- ============================================================
-- 구독 상품 / 광고주별 구독 / 사용량 (구독 상품 서버 이전)
-- ------------------------------------------------------------
-- 예전엔 전부 브라우저 localStorage에 있어서, 실제로는 사용량 제한이 작동하는
-- 것처럼 보여도 개발자도구로 손쉽게 우회 가능했고, 팀원이나 기기가 바뀌면
-- 사용량 집계가 서로 다르게 보였습니다. 이제 광고주당 사용량은 서버가 유일한
-- 원본(source of truth)이라, 어느 팀원이 어느 기기로 봐도 같은 값입니다.
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price NUMERIC,
  vat_included BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'active' | 'archived'
  entitlements JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{featureKey, enabled, limit}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_tenant ON subscription_plans(tenant_id);

CREATE TABLE IF NOT EXISTS advertiser_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL DEFAULT '미설정',
  status TEXT NOT NULL DEFAULT 'active', -- 'trial' | 'active' | 'past_due' | 'paused' | 'cancelled'
  entitlements JSONB NOT NULL DEFAULT '{}'::jsonb, -- FeatureEntitlements (blogEnabled, blogPostsPerMonth 등) - 상품 적용 시 통째로 교체
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  renews_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(advertiser_id)
);

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES advertiser_subscriptions(id) ON DELETE SET NULL,
  feature TEXT NOT NULL, -- 'blog' | 'video-script' | 'document' | 'ad-creation' | 'ai-generation'
  action TEXT NOT NULL,  -- 'create' | 'complete' | 'generate' | 'publish' | 'export'
  quantity INTEGER NOT NULL DEFAULT 1,
  source_id TEXT, -- 같은 결과물에 대해 중복 집계되지 않도록(recordUsageOnce와 동일한 dedupe 기준)
  provider TEXT,
  provider_cost NUMERIC,
  ai_cost NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_events_advertiser_feature ON usage_events(advertiser_id, feature, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant ON usage_events(tenant_id, created_at DESC);


-- ============================================================
-- 오토포스트 Pro 연동 (블로그 자동 생성 - ㈜시온랩스 제휴 API)
-- ------------------------------------------------------------
-- 이 API는 광고주(사업자등록번호)마다 먼저 "좌석(seat)"을 만들어야 합니다.
-- 매번 새로 만들면 API 쪽에서는 중복 판별로 기존 seat을 그대로 돌려주긴 하지만,
-- 우리 쪽에서 seat_id를 캐시해두면 불필요한 API 호출을 줄일 수 있습니다.
-- ============================================================
CREATE TABLE IF NOT EXISTS autopost_pro_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  seat_id TEXT NOT NULL, -- 오토포스트 Pro 쪽 seat 식별자 (예: seat_9f83a1)
  plan TEXT, -- 'trial' | 'paid' (마지막으로 확인한 값, 매 호출 시 최신화)
  trial_remaining INTEGER,
  status TEXT, -- 'active' | 'suspended'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(advertiser_id)
);

-- 매체 계정 연동 정보. api_key/secret_key는 평문이 아니라 암호화된 값(*_encrypted)으로만 저장합니다.
CREATE TABLE IF NOT EXISTS media_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- meta | naver | google | daangn | tiktok | kakao
  status TEXT NOT NULL DEFAULT 'connected',
  account_id TEXT,
  api_key_encrypted TEXT,
  secret_key_encrypted TEXT,
  last_synced_at TIMESTAMPTZ,
  last_row_count INTEGER,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(advertiser_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_media_accounts_tenant ON media_accounts(tenant_id);

-- ────────────────────────────────────────────────────────────
-- 성과 데이터 (일별 / 소재별 / 키워드별)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_metrics (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  date DATE NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  spend NUMERIC NOT NULL DEFAULT 0,
  db_count BIGINT NOT NULL DEFAULT 0,
  purchases BIGINT NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  add_to_cart BIGINT NOT NULL DEFAULT 0,
  complete_registration BIGINT NOT NULL DEFAULT 0,
  initiate_checkout BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(advertiser_id, channel, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_tenant ON daily_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_adv_date ON daily_metrics(advertiser_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_tenant_date ON daily_metrics(tenant_id, date);


CREATE TABLE IF NOT EXISTS campaign_daily_metrics (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  campaign_type TEXT,
  date DATE NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  spend NUMERIC NOT NULL DEFAULT 0,
  db_count BIGINT NOT NULL DEFAULT 0,
  purchases BIGINT NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(advertiser_id, channel, campaign_id, date)
);
CREATE INDEX IF NOT EXISTS idx_campaign_daily_tenant ON campaign_daily_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_daily_adv_date ON campaign_daily_metrics(advertiser_id, date);
CREATE INDEX IF NOT EXISTS idx_campaign_daily_tenant_date ON campaign_daily_metrics(tenant_id, date);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS advertisers_migrated_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_sync_last_run_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_sync_last_result JSONB;
ALTER TABLE campaign_daily_metrics ADD COLUMN IF NOT EXISTS campaign_type TEXT;
ALTER TABLE campaign_daily_metrics ADD COLUMN IF NOT EXISTS add_to_cart BIGINT NOT NULL DEFAULT 0;
ALTER TABLE campaign_daily_metrics ADD COLUMN IF NOT EXISTS complete_registration BIGINT NOT NULL DEFAULT 0;
ALTER TABLE campaign_daily_metrics ADD COLUMN IF NOT EXISTS initiate_checkout BIGINT NOT NULL DEFAULT 0;
-- '구매 외 나머지'를 확실치 않은 채로 DB(리드)에 단정해서 섞어 넣던 문제 수정: 실시간 세부
-- 전환 필드(장바구니 등)를 이 계정/이 시점에 확인할 수 없어 분류가 불확실한 몫을 DB와
-- 구분되는 '미확인' 전환으로 별도 집계합니다(주로 당일 데이터, 상세 리포트가 아직 없는 경우).
ALTER TABLE campaign_daily_metrics ADD COLUMN IF NOT EXISTS unconfirmed_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS add_to_cart BIGINT NOT NULL DEFAULT 0;
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS complete_registration BIGINT NOT NULL DEFAULT 0;
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS initiate_checkout BIGINT NOT NULL DEFAULT 0;
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS unconfirmed_count BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS creative_daily_metrics (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  campaign_type TEXT,
  adgroup_id TEXT,
  adgroup_name TEXT,
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  date DATE NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  spend NUMERIC NOT NULL DEFAULT 0,
  db_count BIGINT NOT NULL DEFAULT 0,
  purchases BIGINT NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  media_type TEXT,
  video_url TEXT,
  title TEXT,
  body TEXT,
  description TEXT,
  cta TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(advertiser_id, channel, ad_id, date)
);
-- 이미 만들어진 테이블에도 안전하게 컬럼을 추가합니다 (영상 실제 재생 URL, 광고그룹명, 캐러셀 카드 이미지 목록).
ALTER TABLE creative_daily_metrics ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE creative_daily_metrics ADD COLUMN IF NOT EXISTS adgroup_name TEXT;
ALTER TABLE creative_daily_metrics ADD COLUMN IF NOT EXISTS carousel_images JSONB;
ALTER TABLE creative_daily_metrics ADD COLUMN IF NOT EXISTS campaign_type TEXT;
ALTER TABLE creative_daily_metrics ADD COLUMN IF NOT EXISTS add_to_cart BIGINT NOT NULL DEFAULT 0;
ALTER TABLE creative_daily_metrics ADD COLUMN IF NOT EXISTS complete_registration BIGINT NOT NULL DEFAULT 0;
ALTER TABLE creative_daily_metrics ADD COLUMN IF NOT EXISTS initiate_checkout BIGINT NOT NULL DEFAULT 0;
ALTER TABLE creative_daily_metrics ADD COLUMN IF NOT EXISTS unconfirmed_count BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_creative_daily_tenant ON creative_daily_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_creative_daily_adv_date ON creative_daily_metrics(advertiser_id, date);
CREATE INDEX IF NOT EXISTS idx_creative_daily_tenant_date ON creative_daily_metrics(tenant_id, date);

CREATE TABLE IF NOT EXISTS keyword_daily_metrics (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  campaign_type TEXT,
  adgroup_id TEXT,
  adgroup_name TEXT,
  keyword_id TEXT NOT NULL DEFAULT '',
  keyword TEXT NOT NULL,
  date DATE NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  spend NUMERIC NOT NULL DEFAULT 0,
  db_count BIGINT NOT NULL DEFAULT 0,
  purchases BIGINT NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(advertiser_id, channel, keyword_id, keyword, date)
);
ALTER TABLE keyword_daily_metrics ADD COLUMN IF NOT EXISTS adgroup_name TEXT;
ALTER TABLE keyword_daily_metrics ADD COLUMN IF NOT EXISTS campaign_type TEXT;
ALTER TABLE keyword_daily_metrics ADD COLUMN IF NOT EXISTS add_to_cart BIGINT NOT NULL DEFAULT 0;
ALTER TABLE keyword_daily_metrics ADD COLUMN IF NOT EXISTS complete_registration BIGINT NOT NULL DEFAULT 0;
ALTER TABLE keyword_daily_metrics ADD COLUMN IF NOT EXISTS initiate_checkout BIGINT NOT NULL DEFAULT 0;
ALTER TABLE keyword_daily_metrics ADD COLUMN IF NOT EXISTS unconfirmed_count BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_keyword_daily_tenant ON keyword_daily_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_keyword_daily_adv_date ON keyword_daily_metrics(advertiser_id, date);
CREATE INDEX IF NOT EXISTS idx_keyword_daily_tenant_date ON keyword_daily_metrics(tenant_id, date);

CREATE TABLE IF NOT EXISTS sync_validation_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID REFERENCES advertisers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  date_from DATE,
  date_to DATE,
  source_label TEXT,
  source_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  stored_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  delta JSONB NOT NULL DEFAULT '{}'::jsonb,
  ok BOOLEAN NOT NULL DEFAULT false,
  account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sync_validation_tenant ON sync_validation_logs(tenant_id, created_at DESC);
ALTER TABLE sync_validation_logs ADD COLUMN IF NOT EXISTS account_id TEXT;

CREATE TABLE IF NOT EXISTS creative_metrics (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  campaign_name TEXT,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  spend NUMERIC NOT NULL DEFAULT 0,
  db_count BIGINT NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  media_type TEXT,
  title TEXT,
  body TEXT,
  description TEXT,
  cta TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(advertiser_id, channel, ad_id)
);
CREATE INDEX IF NOT EXISTS idx_creative_metrics_tenant ON creative_metrics(tenant_id);

CREATE TABLE IF NOT EXISTS keyword_metrics (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  keyword TEXT NOT NULL,
  campaign_name TEXT,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  spend NUMERIC NOT NULL DEFAULT 0,
  db_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(advertiser_id, channel, keyword)
);
CREATE INDEX IF NOT EXISTS idx_keyword_metrics_tenant ON keyword_metrics(tenant_id);

-- ────────────────────────────────────────────────────────────
-- 콘텐츠 / 운영 데이터 — 필드가 자주 바뀌는 영역이라 세부 내용은 JSONB로 유연하게 둡니다.
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS blog_projects CASCADE;
CREATE TABLE blog_projects (
  id TEXT PRIMARY KEY, -- 예: makeId('blog')로 만든 projectId를 그대로 씁니다.
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_projects_tenant ON blog_projects(tenant_id);

CREATE TABLE IF NOT EXISTS blog_styles (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (tenant_id, advertiser_id)
);

DROP TABLE IF EXISTS blog_assets CASCADE;
CREATE TABLE blog_assets (
  id TEXT PRIMARY KEY, -- 예: makeId('asset')
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TABLE IF EXISTS schedule_slots CASCADE;
CREATE TABLE schedule_slots (
  id TEXT PRIMARY KEY, -- 프론트에서 만든 슬롯 ID를 그대로 씁니다.
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 접속/연동/관리 활동 로그 (테넌트별로 격리해서 조회합니다)
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant ON activity_logs(tenant_id, created_at DESC);
-- ============================================================
-- 레퍼런스 수집 (콘텐츠 → 레퍼런스 수집 메뉴)
-- 광고/일반 콘텐츠를 수집·저장·분류하고, 광고주·컬렉션과 연결하며,
-- 콘텐츠 제작 기능으로 전달하기 위한 테이블들입니다.
-- ============================================================

-- 수집 규칙(자동/수동 수집 조건을 저장해두고 재사용)
CREATE TABLE IF NOT EXISTS reference_collection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  content_kind TEXT NOT NULL DEFAULT 'BOTH', -- 'ADVERTISEMENT' | 'ORGANIC_CONTENT' | 'BOTH'
  platforms TEXT[] NOT NULL DEFAULT '{}',    -- ['meta','youtube','tiktok','threads']
  keywords TEXT[] NOT NULL DEFAULT '{}',
  exclude_keywords TEXT[] NOT NULL DEFAULT '{}',
  language TEXT,
  country TEXT,
  date_range_days INTEGER DEFAULT 30,
  min_metrics JSONB NOT NULL DEFAULT '{}'::jsonb, -- 예: {"views":100000,"comments":100,"followers":10000}
  mode TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'auto'
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_collected_at TIMESTAMPTZ,
  last_collected_count INTEGER,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_rules_tenant ON reference_collection_rules(tenant_id);

-- 레퍼런스 본체
CREATE TABLE IF NOT EXISTS references_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,

  reference_type TEXT NOT NULL, -- 'ADVERTISEMENT' | 'ORGANIC_CONTENT'
  platform TEXT NOT NULL,       -- 'meta' | 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'threads' | 'manual'
  source_type TEXT NOT NULL DEFAULT 'collected', -- 'collected' | 'manual_url'

  external_id TEXT,             -- 플랫폼 원본 ID (중복 방지 기준 1)
  url TEXT,
  canonical_url TEXT,           -- 정규화된 URL (중복 방지 기준 2)

  title TEXT,
  body TEXT,
  headline TEXT,
  description TEXT,
  cta TEXT,

  author_id TEXT,
  author_name TEXT,
  author_followers BIGINT,      -- null = 미제공, 0 = 실제 0

  thumbnail_url TEXT,
  media_url TEXT,
  media_type TEXT, -- 'image' | 'video' | 'carousel' | 'text'
  content_type TEXT, -- '영상' | '숏폼' | '이미지' | '카드뉴스' | '텍스트' | '광고' | '기타'

  ad_status TEXT, -- 광고 전용: 'active' | 'inactive' 등
  ad_started_at TIMESTAMPTZ,

  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 성과 지표: null=플랫폼이 제공 안 함, 0=실제 값 0 (반드시 구분)
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  shares BIGINT,
  saves BIGINT,

  available_metrics TEXT[] NOT NULL DEFAULT '{}', -- 이 레퍼런스에서 실제로 제공된 지표 목록

  status TEXT NOT NULL DEFAULT 'unread', -- 'unread' | 'reviewing' | 'saved' | 'used_in_production' | 'archived'
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  note TEXT,

  raw_text TEXT,
  transcript TEXT,
  raw_metadata JSONB,

  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_references_tenant ON references_store(tenant_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_references_advertiser ON references_store(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_references_platform ON references_store(tenant_id, platform);
CREATE INDEX IF NOT EXISTS idx_references_type ON references_store(tenant_id, reference_type);
-- 중복 방지: 같은 테넌트 안에서 플랫폼+원본ID, 또는 canonical_url이 겹치면 안 됩니다.
CREATE UNIQUE INDEX IF NOT EXISTS uq_references_platform_external ON references_store(tenant_id, platform, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_references_canonical_url ON references_store(tenant_id, canonical_url) WHERE canonical_url IS NOT NULL;

-- 태그
CREATE TABLE IF NOT EXISTS reference_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);
CREATE TABLE IF NOT EXISTS reference_tag_links (
  reference_id UUID NOT NULL REFERENCES references_store(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES reference_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (reference_id, tag_id)
);

-- 컬렉션 (폴더 대신 컬렉션 - 하나의 레퍼런스가 여러 컬렉션에 속할 수 있음)
CREATE TABLE IF NOT EXISTS reference_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_collections_tenant ON reference_collections(tenant_id);
CREATE TABLE IF NOT EXISTS reference_collection_items (
  collection_id UUID NOT NULL REFERENCES reference_collections(id) ON DELETE CASCADE,
  reference_id UUID NOT NULL REFERENCES references_store(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, reference_id)
);

-- 메모(레퍼런스별 여러 개 남길 수 있는 자유 메모 - note 필드와 별개로 이력 남기고 싶을 때 사용)
CREATE TABLE IF NOT EXISTS reference_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES references_store(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "이 레퍼런스로 제작" 사용 이력 (어떤 레퍼런스가 실제로 제작에 얼마나 쓰였는지 추적)
CREATE TABLE IF NOT EXISTS reference_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES references_store(id) ON DELETE CASCADE,
  used_for TEXT NOT NULL, -- 'ad_copy' | 'blog' | 'video_script' | 'image_ad' | 'document'
  reference_scope TEXT,   -- '구조만 참고' | '후킹 참고' | '톤앤매너 참고' | '주제 참고' | '전체적인 방향 참고'
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_usage_reference ON reference_usage(reference_id);

-- ============================================================
-- 실제 팀원 계정 + 역할 기반 권한 (권한 분리 1단계)
-- ------------------------------------------------------------
-- 예전엔 Railway 환경변수(HOWTOM_ADMIN_EMAIL/PASSWORD)로 만든 계정 하나뿐이었고,
-- 로그인하는 사람 전원이 똑같이 관리자 권한을 받았습니다. '사용자 관리/권한 묶음/
-- 기능별 이용 권한' 화면은 있었지만 브라우저 localStorage에만 저장되어 실제로는
-- 아무것도 막지 않는 시안이었습니다. 이제 실제 계정 테이블과 서버 권한 검사로 옮깁니다.
--
-- app_users.is_owner=true인 계정은 기존의 그 최초 관리자와 동등한 최상위 권한이며
-- (삭제・강등 불가), 이 테이블에 새로 추가되는 팀원 계정은 전부 is_owner=false로
-- 시작해 역할(app_roles)과 광고주 범위(app_memberships.advertiser_ids)로 제한됩니다.
-- ============================================================
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT, -- null이면 초대만 되고 아직 초기 비밀번호를 설정 안 한 상태
  name TEXT NOT NULL,
  title TEXT,
  department TEXT,
  status TEXT NOT NULL DEFAULT 'invited', -- 'invited' | 'active' | 'disabled'
  is_owner BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_app_users_tenant ON app_users(tenant_id);

CREATE TABLE IF NOT EXISTS app_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT 'internal', -- 'internal' | 'advertiser'
  permission_keys TEXT[] NOT NULL DEFAULT '{}',
  is_system BOOLEAN NOT NULL DEFAULT false, -- 기본 제공 역할(예: 관리자)은 일부 화면에서 수정 제한
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_roles_tenant ON app_roles(tenant_id);

-- 사용자 1명당 멤버십 1개(여러 역할을 가질 수 있고, 광고주 범위는 전체 공통 적용).
-- advertiser_ids가 NULL이면 "전체 광고주", 배열이 있으면 그 안의 광고주만 접근 가능합니다.
CREATE TABLE IF NOT EXISTS app_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role_ids UUID[] NOT NULL DEFAULT '{}',
  advertiser_ids UUID[], -- NULL = 전체 광고주
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
-- ------------------------------------------------------------
-- 예전엔 브라우저 localStorage에만 저장되어 팀원끼리 공유가 안 되고 기기를 바꾸면
-- 사라졌습니다. 경쟁사 등록·관찰 소재를 references_store와 동일한 Postgres에 저장해
-- 팀 전체가 공유하고, Meta 광고 라이브러리 등 실제 자동 수집 결과도 그대로 연결합니다.
-- ============================================================
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL, -- null = 광고주 공통(전사) 추적
  name TEXT NOT NULL,
  industry TEXT,
  website_url TEXT,
  channels JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{platform, profileUrl}]
  priority TEXT NOT NULL DEFAULT 'normal', -- 'high' | 'normal' | 'low'
  status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'paused'
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_competitors_tenant ON competitors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_competitors_advertiser ON competitors(advertiser_id);

-- references_store를 "이 관찰 소재는 어느 경쟁사 것인지"와 연결합니다. 일반 레퍼런스 수집
-- (콘텐츠 > 레퍼런스)은 특정 경쟁사 추적과 무관할 수 있어 competitor_id는 nullable입니다.
ALTER TABLE references_store ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_references_competitor ON references_store(competitor_id);
-- 후킹 유형(예: 후기형, 가격형)은 자유 태그(reference_tags)와 달리 트렌드 엔진이 직접
-- 집계하는 고정 분석 축이라 별도 배열 컬럼으로 둡니다.
ALTER TABLE references_store ADD COLUMN IF NOT EXISTS hook_types TEXT[] NOT NULL DEFAULT '{}';
-- 같은 경쟁사 소재를 여러 번 관찰할 때 "언제 처음 봤는지/최근까지도 노출 중인지"를 추적합니다.
ALTER TABLE references_store ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ;
ALTER TABLE references_store ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
