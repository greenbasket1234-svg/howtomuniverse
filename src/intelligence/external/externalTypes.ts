export type CompetitorPriority = 'high' | 'normal' | 'low';
export type CompetitorStatus = 'active' | 'paused';

export type Competitor = {
  competitorId: string;
  advertiserId?: string;
  advertiserName?: string;
  name: string;
  industry?: string;
  websiteUrl?: string;
  channels: { platform: string; profileUrl?: string }[];
  priority: CompetitorPriority;
  status: CompetitorStatus;
  createdAt: string;
  updatedAt: string;
};

export type ExternalCreativeType = 'image' | 'video' | 'copy' | 'landing';

export type ExternalCreativeObservation = {
  observationId: string;
  competitorId: string;
  competitorName: string;
  advertiserId?: string;
  advertiserName?: string;
  industry?: string;
  platform: string;
  creativeType: ExternalCreativeType;
  sourceUrl?: string;
  thumbnailUrl?: string;
  headline?: string;
  body?: string;
  cta?: string;
  hookTypes: string[];
  tags: string[];
  memo?: string;
  assetId?: string;
  referenceId?: string;
  capturedAt: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TrendCategory = 'hook' | 'cta' | 'format' | 'message' | 'visual';
export type TrendStatus = 'emerging' | 'rising' | 'stable' | 'declining' | 'insufficient';

export type TrendSignal = {
  trendId: string;
  category: TrendCategory;
  value: string;
  currentCount: number;
  previousCount: number;
  currentShare: number;
  previousShare: number;
  growthRate?: number;
  competitorCoverage: number;
  sampleSize: number;
  confidenceScore: number;
  confidenceLabel: '낮음' | '보통' | '높음';
  status: TrendStatus;
};
