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

export const CREATIVE_LIBRARY: Creative[] = [
  { id: 'cr-1001', name: '20260609_인스타1 야장', brand: '완도군수산', platform: '메타', type: '이미지', objective: '트래픽', thumb: '🌆', copy: '퇴근 후 야장에서 즐기는 바비큐 감성을 담은 소재입니다.', status: '성과 좋음', liveStatus: '노출중', fatigue: '정상', tags: ['완도군수산', '메타', '트래픽_이미지'], spend: 88236, uses: 5, date: '2026-06-09' },
  { id: 'cr-1002', name: '20260609_인스타2 퇴근캠핑', brand: '완도군수산', platform: '메타', type: '영상', objective: 'DB 수집', thumb: '🏕️', copy: '도심 속 캠핑과 수영장을 함께 즐기는 여름 콘텐츠입니다.', status: '성과 좋음', liveStatus: '노출중', fatigue: '정상', tags: ['완도군수산', '메타', '전환_동영상'], spend: 83141, uses: 5, date: '2026-06-09' },
  { id: 'cr-1003', name: '20260610_인스타3 수영장', brand: '완도군수산', platform: '메타', type: '영상', objective: '판매', thumb: '🏊', copy: '무더운 여름 시원한 수영장과 바비큐 조합을 보여줍니다.', status: '성과 좋음', liveStatus: '노출중', fatigue: '주의', tags: ['완도군수산', '메타'], spend: 60073, uses: 3, date: '2026-06-10' },
  { id: 'cr-1004', name: '20260610_인스타4 삼겹살', brand: '완도군수산', platform: '메타', type: '이미지', objective: '판매', thumb: '🍖', copy: '두툼한 삼겹살과 숯불의 풍미를 강조했습니다.', status: '보통', liveStatus: '노출중', fatigue: '데이터 부족', tags: ['완도군수산', '메타'], spend: 39051, uses: 4, date: '2026-06-10' },
  { id: 'cr-1005', name: '20260701_인스타5 소형견', brand: '완도군수산', platform: '메타', type: '영상', objective: 'DA(Display Ads)', thumb: '🐶', copy: '반려견과 함께 즐길 수 있는 공간을 소개합니다.', status: '성과 좋음', liveStatus: '노출중', fatigue: '정상', tags: ['완도군수산', '메타', '전환_이미지'], spend: 16130, uses: 6, date: '2026-07-01' },
  { id: 'cr-1006', name: '수영장', brand: '완도군수산', platform: '구글', type: '키워드', objective: 'SA(Search Ads)', thumb: '🌊', copy: '시원한 물놀이 공간을 중심으로 구성된 검색 키워드입니다.', status: '보통', liveStatus: '노출중', fatigue: '정상', tags: ['완도군수산', '구글'], spend: 8388, uses: 2, date: '2026-07-03' },
  { id: 'cr-1007', name: '20260615_이사견적1', brand: '다방이사', platform: '메타', type: '이미지', objective: 'DB 수집', thumb: '📦', copy: '무료 견적 신청을 유도하는 이사 서비스 소재입니다.', status: '성과 좋음', liveStatus: '노출중', fatigue: '정상', tags: ['다방이사', '메타', '전환_동영상'], spend: 72400, uses: 8, date: '2026-06-15' },
  { id: 'cr-1008', name: '사무실이사', brand: '다방이사', platform: '네이버', type: '키워드', objective: 'SA(Search Ads)', thumb: '🏢', copy: '사무실 이사 전문 서비스를 강조한 검색 키워드입니다.', status: '보통', liveStatus: '노출중', fatigue: '주의', tags: ['다방이사', '네이버', '전환_이미지'], spend: 41200, uses: 3, date: '2026-06-18' },
  { id: 'cr-1009', name: '20260622_포장이사영상', brand: '다방이사', platform: '메타', type: '영상', objective: '트래픽', thumb: '🚚', copy: '포장이사 전 과정을 보여주는 신뢰감 있는 영상입니다.', status: '성과 좋음', liveStatus: '반려', fatigue: '교체 권장', tags: ['다방이사', '메타'], spend: 95600, uses: 6, date: '2026-06-22' },
  { id: 'cr-1010', name: '20260701_스케일링이벤트', brand: '서울우리아이치과', platform: '메타', type: '이미지', objective: 'DB 수집', thumb: '🦷', copy: '여름맞이 스케일링 이벤트를 안내하는 소재입니다.', status: '성과 좋음', liveStatus: '노출중', fatigue: '정상', tags: ['서울우리아이치과', '메타'], spend: 53200, uses: 4, date: '2026-07-01' },
  { id: 'cr-1011', name: '소아치과안내', brand: '서울우리아이치과', platform: '네이버', type: '키워드', objective: 'SA(Search Ads)', thumb: '🧸', copy: '아이가 무서워하지 않는 진료 환경을 강조한 검색 키워드입니다.', status: '피로', liveStatus: '노출중', fatigue: '교체 권장', tags: ['서울우리아이치과', '네이버'], spend: 28900, uses: 9, date: '2026-07-05' },
];
