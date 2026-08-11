export type PlatformKey =
  | 'meta' | 'naver' | 'google' | 'karrot' | 'kakao' | 'tiktok'
  | 'youtube' | 'instagram' | 'blog';

export const PLATFORM_LABEL: Record<PlatformKey, string> = {
  meta: 'Meta', naver: 'Naver', google: 'Google', karrot: 'Karrot', kakao: 'Kakao',
  tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram', blog: 'Blog',
};

export type CampaignStatus = 'on' | 'off' | 'scheduled' | 'review' | 'error' | 'unsupported';
export type Campaign = {
  id: string;
  advertiserId: string;
  platform: PlatformKey;
  name: string;
  accountName: string;
  budget: number;
  budgetType: 'daily' | 'total';
  startAt: string;
  endAt?: string;
  status: CampaignStatus;
  schedule?: { onAt?: string; offAt?: string; repeat?: string; rules?: string[] };
  lastSyncedAt?: string;
  capability: { upload: boolean; toggle: boolean; schedule: boolean };
};

export type FunnelMetricKey =
  | 'spend' | 'impressions' | 'reach' | 'clicks' | 'ctr' | 'cpc' | 'cpm'
  | 'leads' | 'validLeads' | 'contracts' | 'clickToLeadRate' | 'validLeadRate'
  | 'leadToContractRate' | 'validLeadToContractRate' | 'costPerLead'
  | 'costPerValidLead' | 'costPerContract' | 'signUps' | 'itemViews'
  | 'addToCarts' | 'checkoutStarts' | 'purchases' | 'purchaseValue'
  | 'signUpRate' | 'addToCartRate' | 'checkoutRate' | 'purchaseConversionRate'
  | 'costPerPurchase' | 'averageOrderValue' | 'roas';

export type FunnelMetricDefinition = {
  key: FunnelMetricKey;
  label: string;
  group: 'traffic' | 'lead' | 'commerce' | 'cost' | 'revenue';
  format: 'number' | 'currency' | 'percent';
};

export type FunnelRow = {
  platform: PlatformKey;
  status: 'connected' | 'pending' | 'unsupported';
  values: Partial<Record<FunnelMetricKey, number>>;
};

export type MetricView = {
  id: string;
  advertiserId: string;
  name: string;
  selectedMetrics: FunnelMetricKey[];
  isDefault?: boolean;
};

export type SlotType = 'campaign' | 'creative' | 'report' | 'promotion' | 'event';
export type SlotStatus = 'planned' | 'confirmed' | 'approval' | 'in_progress' | 'completed' | 'delayed' | 'cancelled' | 'conflict';
export type ScheduleSlot = {
  id: string;
  advertiserId: string;
  title: string;
  type: SlotType;
  platform?: PlatformKey;
  startAt: string;
  endAt: string;
  owner: string;
  status: SlotStatus;
  note?: string;
};

export type SeasonEventType = 'weather' | 'holiday' | 'season' | 'brand';
export type SeasonEvent = {
  id: string;
  date: string;
  title: string;
  type: SeasonEventType;
  region?: string;
  severity?: 'info' | 'warning' | 'critical';
  recommendation?: string;
};
