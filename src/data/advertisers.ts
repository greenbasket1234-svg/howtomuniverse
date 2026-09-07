export const CHANNELS = ['Meta', '네이버', '구글', '당근', '틱톡', '카카오'] as const;
export type Channel = typeof CHANNELS[number];
export type LinkStatus = '연결됨' | '미연동' | '토큰 만료' | '권한 오류' | '수집 실패';

export type AccountLink = {
  channel: Channel;
  accountName?: string;
  accountId?: string;
  status: LinkStatus;
  lastSync?: string;
  keyRegistered?: boolean;
};

export type Advertiser = {
  id: string;
  name: string;
  monthlyBudget: number;
  color: string;
  initial: string;
  links: AccountLink[];
  industry?: string;
  website?: string;
  phone?: string;
  address?: string;
  // 사업자등록번호 - 오토포스트 Pro 등 외부 제휴 API의 좌석 생성 기준입니다.
  businessRegNo?: string;
  // 오토포스트 Pro가 요구하는 업종 코드(영문). HOWTOM 자체 업종(위 industry, 한글)에서
  // 자동 매핑되지만, 제휴사가 새 업종을 추가해주면 여기에 직접 그 코드를 입력해 덮어씁니다.
  autopostProIndustry?: string;
};

export const DEFAULT_ADVERTISERS: Advertiser[] = [];

// useAdvertisers() 훅이 서버에서 데이터를 받아올 때마다 saveAdvertisers()를 호출해
// 이 캐시를 채웁니다. 리액트 훅을 쓸 수 없는 순수 로직 파일(controlStore/contentStore/
// assetStore 등)은 이 캐시를 통해 실제 광고주 데이터를 읽습니다 - 단, 화면이 최소 한 번
// useAdvertisers()로 데이터를 불러온 "이후"에만 값이 채워집니다(그 전에는 빈 배열).
let cachedAdvertisers: Advertiser[] = [];

/** 광고주 데이터의 Source of Truth는 백엔드입니다. 브라우저에는 업무 데이터를 영구 저장하지 않고,
 * useAdvertisers() 훅이 마지막으로 받아온 결과를 메모리에만 캐시해서 돌려줍니다. */
export function loadAdvertisers(): Advertiser[] {
  return cachedAdvertisers;
}

export function saveAdvertisers(advertisers: Advertiser[]): void {
  cachedAdvertisers = advertisers;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('adcc:advertisers-changed', { detail: advertisers }));
}
