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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(advertiser_id, channel, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_tenant ON daily_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_adv_date ON daily_metrics(advertiser_id, date);


CREATE TABLE IF NOT EXISTS campaign_daily_metrics (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
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

CREATE TABLE IF NOT EXISTS creative_daily_metrics (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  adgroup_id TEXT,
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
  title TEXT,
  body TEXT,
  description TEXT,
  cta TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(advertiser_id, channel, ad_id, date)
);
CREATE INDEX IF NOT EXISTS idx_creative_daily_tenant ON creative_daily_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_creative_daily_adv_date ON creative_daily_metrics(advertiser_id, date);

CREATE TABLE IF NOT EXISTS keyword_daily_metrics (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  adgroup_id TEXT,
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
CREATE INDEX IF NOT EXISTS idx_keyword_daily_tenant ON keyword_daily_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_keyword_daily_adv_date ON keyword_daily_metrics(advertiser_id, date);

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
CREATE TABLE IF NOT EXISTS blog_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE IF NOT EXISTS blog_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
