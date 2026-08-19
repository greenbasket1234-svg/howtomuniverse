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
  revenue: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  cvr?: number;
  cpa?: number;
  roas?: number;
};

export type DailyMetricRow = BaseMetricRow & { date: string };
export type CampaignMetricRow = BaseMetricRow & { campaignId: string; campaignName: string };
export type CampaignDailyMetricRow = CampaignMetricRow & { date: string };
export type CreativeMetricRow = BaseMetricRow & {
  campaignId?: string; campaignName?: string; adgroupId?: string;
  adId: string; adName: string; thumbnailUrl?: string | null; mediaType?: 'image'|'video'|null;
  title?: string; body?: string; description?: string; cta?: string;
};
export type CreativeDailyMetricRow = CreativeMetricRow & { date: string };
export type KeywordMetricRow = BaseMetricRow & {
  campaignId?: string; campaignName?: string; adgroupId?: string; keywordId?: string; keyword: string;
};
export type KeywordDailyMetricRow = KeywordMetricRow & { date: string };

export type MetricsResponse<T> = { rows: T[]; meta: MetricsMeta };
