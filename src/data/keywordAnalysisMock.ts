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
  platform: KeywordPlatform;
  keyword: string;
  campaign: string;
  adGroup: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  grade: KeywordAnalysisGrade;
  status: 'active' | 'paused';
  memo?: string;
};

const BRAND_KEYWORDS: Record<string, string[]> = {
  'dabang-isa': ['광주 이사', '포장이사 견적', '원룸 이사', '사무실 이사', '이삿짐센터 추천', '이사 비용'],
  nomel: ['노멜', '여성 의류 쇼핑몰', '여름 원피스', '데일리룩', '여성 블라우스', '신상 의류'],
  'wando-fisheries': ['완도 전복', '전복 선물세트', '전복 미역국', '활전복 택배', '완도 수산물', '전복 특가'],
  'dasima-abalone': ['다시마 전복', '완도 활전복', '전복 산지직송', '전복 선물', '전복 삼계탕', '전복 구매'],
  'seoul-uriai-dental': ['광주 치과', '어린이 치과', '소아 치과', '임플란트 상담', '치아 교정', '주말 치과'],
  'welcome-bbq': ['광주 바베큐', '수완지구 맛집', '실내 바베큐', '광주 캠핑 식당', '반려견 동반 식당', '광주 불멍'],
  'renda-direct': ['장기렌트', '신차 장기렌트', '자동차 리스', '무보증 장기렌트', '법인 차량 리스', '장기렌트 견적'],
  'lotte-rentacar': ['롯데 렌터카', '장기렌터카', '신차 렌트', '렌터카 견적', '법인 장기렌트', '무보증 렌트'],
  'on-animal-hospital': ['광주 동물병원', '강아지 스케일링', '고양이 건강검진', '반려동물 중성화', '야간 동물병원', '광주 서구 동물병원'],
  'smart-rentcar': ['스마트 렌트카', '신차 장기렌트', '월 렌트료', '무보증 렌트', '수입차 리스', '법인차 렌트'],
  'sincha-recipe': ['신차 장기렌트', '자동차 리스 비교', '신차 견적', '장기렌트 가격', '무보증 장기렌트', '수입차 장기리스'],
  'kkondae-bbq-gangnam': ['강남역 고기집', '강남 회식 장소', '강남 삼겹살', '강남역 맛집', '단체 회식 고기집', '강남 돼지고기'],
};

const GRADES: KeywordAnalysisGrade[] = [
  'high_performance',
  'stable',
  'waste',
  'exclude_candidate',
  'expansion_candidate',
  'stable',
];

function hash(input: string): number {
  let out = 0;
  for (let i = 0; i < input.length; i += 1) out = (out * 31 + input.charCodeAt(i)) >>> 0;
  return out;
}

// 매체 연동 전에는 실제 키워드 성과 데이터가 없으므로 빈 배열을 반환합니다.
// 실제 네이버/구글/카카오/당근 검색광고 API가 연결되면 이 함수가 실제 키워드 성과를 반환하도록 교체됩니다.
export function getKeywordAnalysisRows(_brandId: string, _brandName: string, _platform: KeywordPlatform = '네이버'): KeywordAnalysisRow[] {
  return [];
}
