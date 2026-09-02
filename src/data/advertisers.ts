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

/** 광고주 데이터의 Source of Truth는 백엔드입니다. 브라우저에는 업무 데이터를 영구 저장하지 않습니다. */
export function loadAdvertisers(): Advertiser[] {
  return [];
}

export function saveAdvertisers(advertisers: Advertiser[]): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('adcc:advertisers-changed', { detail: advertisers }));
}
