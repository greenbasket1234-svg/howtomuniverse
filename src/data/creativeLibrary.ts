// 소재 라이브러리(목록/카드)와 소재 상세 페이지가 함께 쓰는 소재 데이터입니다.
// 예전엔 두 페이지가 서로 다른 mock 데이터(숫자 id vs 'cr-1001' 형식 id)를 따로 갖고 있어서,
// 라이브러리 카드에서 상세 페이지로 연결하면 "소재를 찾을 수 없습니다"가 뜨는 문제가 있었습니다.
// 이제 이 파일 하나만 두 페이지가 같이 참조합니다.

export type CreativeObjective = '판매' | '트래픽' | 'DB 수집' | 'DA(Display Ads)' | 'SA(Search Ads)';
export type CreativeType = '이미지' | '영상' | '키워드';
export type CreativePerfStatus = '성과 좋음' | '보통' | '피로';
export type CreativeLiveStatus = '노출중' | '반려' | '보관됨';
export type CreativeFatigueLevel = '정상' | '주의' | '교체 권장' | '데이터 부족';

export type Creative = {
  id: string;
  name: string;
  brand: string;
  platform: string;
  type: CreativeType;
  objective: CreativeObjective;
  thumb: string;
  copy: string;
  status: CreativePerfStatus;
  liveStatus: CreativeLiveStatus;
  fatigue: CreativeFatigueLevel;
  tags: string[];
  spend: number;
  uses: number;
  date: string;
  assetId?: string;
  parentCreativeId?: string;
  campaignId?: string;
  campaignName?: string;
  headline?: string;
  primaryText?: string;
  description?: string;
  cta?: string;
  visualTags?: string[];
  videoStyleTags?: string[];
};

// 매체 연동 전에는 실제 소재 데이터가 없으므로 빈 배열로 시작합니다.
// 실제 광고 API가 연결되거나 소재를 직접 업로드하면 그때부터 목록이 채워집니다.
export const CREATIVE_LIBRARY: Creative[] = [];
