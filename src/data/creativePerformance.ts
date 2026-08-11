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

/**
 * 기존 Meta 소재 보고서에서 이미 사용하던 데모 성과 데이터입니다.
 * 소재 분석은 이 값을 임의 확장하지 않고, 소재 라이브러리와 이름/ID가 정확히 연결되는 행만 사용합니다.
 * 실제 API 또는 소재 단위 업로드 데이터가 연결되면 이 데모 소스를 대체할 수 있습니다.
 */
// 매체 연동 전에는 실제 소재 성과 데이터가 없으므로 빈 배열로 시작합니다.
// 실제 API 또는 소재 단위 업로드 데이터가 연결되면 이 배열이 채워집니다.
export const CREATIVE_PERFORMANCE_SAMPLE: CreativePerformanceSampleRow[] = [];
