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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_advertisers_tenant ON advertisers(tenant_id);

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
ALTER TABLE campaign_daily_metrics ADD COLUMN IF NOT EXISTS campaign_type TEXT;
ALTER TABLE campaign_daily_metrics ADD COLUMN IF NOT EXISTS add_to_cart BIGINT NOT NULL DEFAULT 0;
ALTER TABLE campaign_daily_metrics ADD COLUMN IF NOT EXISTS complete_registration BIGINT NOT NULL DEFAULT 0;
ALTER TABLE campaign_daily_metrics ADD COLUMN IF NOT EXISTS initiate_checkout BIGINT NOT NULL DEFAULT 0;
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS add_to_cart BIGINT NOT NULL DEFAULT 0;
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS complete_registration BIGINT NOT NULL DEFAULT 0;
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS initiate_checkout BIGINT NOT NULL DEFAULT 0;

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sync_validation_tenant ON sync_validation_logs(tenant_id, created_at DESC);

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
