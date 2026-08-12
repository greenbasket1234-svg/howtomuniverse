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
};

export const DEFAULT_ADVERTISERS: Advertiser[] = [];

/** 광고주 데이터의 Source of Truth는 백엔드입니다. 브라우저에는 업무 데이터를 영구 저장하지 않습니다. */
export function loadAdvertisers(): Advertiser[] {
  return [];
}

export function saveAdvertisers(advertisers: Advertiser[]): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('adcc:advertisers-changed', { detail: advertisers }));
}
