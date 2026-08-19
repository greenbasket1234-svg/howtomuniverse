export type CreativePerformanceSampleRow = {
  id: string;
  creativeId?: string;
  name: string;
  advertiser: string;
  campaign: string;
  campaignId?: string;
  media: string;
  spend: number;
  impressions: number;
  clicks: number;
  frequency?: number;
  status: '라이브'|'보관됨';
  days: number;
  health: number;
  trend: number[];
};

/** Zero State: 실제 소재 성과 API가 연결되기 전에는 빈 배열입니다. */

