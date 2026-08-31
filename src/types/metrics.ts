export type MetricConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connector_unimplemented';

export type MetricConnection = {
  advertiserId: string;
  advertiserName: string;
  channel: string;
  status: MetricConnectionStatus;
  lastSyncedAt: string | null;
  lastRowCount: number;
  error: string | null;
};

export type MetricsMeta = {
  from: string | null;
  to: string | null;
  connections: MetricConnection[];
  generatedAt: string;
};

export type BaseMetricRow = {
  advertiserId: string;
  advertiserName?: string;
  channel: string;
  date?: string;
  impressions: number;
  clicks: number;
  spend: number;
  dbCount: number;
  purchases: number;
  // 이커머스 퍼널 단계별 전환(Meta 전용 - 네이버는 API가 이 구분을 제공하지 않아 항상 0입니다).
  addToCart?: number;
  completeRegistration?: number;
  initiateCheckout?: number;
  // 상세 리포트가 아직 없는 시점(주로 당일)이라 구매/장바구니/DB 등으로 확정 분류하지 못한
  // 전환입니다. 예전에는 이 몫이 전부 DB(리드)로 잘못 합산됐습니다. 다음날 리포트가
  // 생성되면 자동으로 정확한 유형으로 재분류됩니다.
  unconfirmed?: number;
  revenue: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  cvr?: number;
  cpa?: number;
  roas?: number;
};

export type DailyMetricRow = BaseMetricRow & { date: string };
export type CampaignMetricRow = BaseMetricRow & { campaignId: string; campaignName: string; campaignType?: string };
export type CampaignDailyMetricRow = CampaignMetricRow & { date: string };
export type CreativeMetricRow = BaseMetricRow & {
  campaignId?: string; campaignName?: string; campaignType?: string; adgroupId?: string; adgroupName?: string;
  adId: string; adName: string; thumbnailUrl?: string | null; mediaType?: 'image'|'video'|'text'|'carousel'|null; videoUrl?: string | null;
  carouselImages?: string[] | null;
  title?: string; body?: string; description?: string; cta?: string;
};
export type CreativeDailyMetricRow = CreativeMetricRow & { date: string };
export type KeywordMetricRow = BaseMetricRow & {
  campaignId?: string; campaignName?: string; campaignType?: string; adgroupId?: string; adgroupName?: string; keywordId?: string; keyword: string;
};
export type KeywordDailyMetricRow = KeywordMetricRow & { date: string };

export type MetricsResponse<T> = { rows: T[]; meta: MetricsMeta };
