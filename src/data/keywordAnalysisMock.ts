export type KeywordAnalysisGrade =
  | 'high_performance'
  | 'stable'
  | 'waste'
  | 'exclude_candidate'
  | 'expansion_candidate';

export type KeywordPlatform = '네이버' | '당근' | '구글' | '카카오';
export const KEYWORD_PLATFORMS: KeywordPlatform[] = ['네이버', '당근', '구글', '카카오'];

export type KeywordAnalysisRow = {
  id: string;
  keyword: string;
  brandId: string;
  brandName: string;
  platform: KeywordPlatform;
  campaign?: string;
  adGroup?: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number | null;
  roas: number | null;
  grade: KeywordAnalysisGrade;
  status: 'active' | 'paused';
  memo?: string;
};

/** Zero State: 키워드 API/업로드 데이터가 없으면 분석 행도 만들지 않습니다. */
export function getKeywordAnalysisRows(_brandId: string, _brandName: string, _platform: KeywordPlatform = '네이버'): KeywordAnalysisRow[] {
  return [];
}
