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
};

export const DEFAULT_ADVERTISERS: Advertiser[] = [
  {
    id: 'dabang-move', name: '다방이사', monthlyBudget: 9000000, color: '#2563eb', initial: '다',
    links: CHANNELS.map(channel => ({ channel, status: ['Meta','네이버','구글','당근','틱톡'].includes(channel) ? '연결됨' : '미연동', keyRegistered: ['Meta','네이버','구글','당근','틱톡'].includes(channel) })),
  },
  {
    id: 'dashima-abalone', name: '다시마전복수산', monthlyBudget: 6000000, color: '#10b981', initial: '다',
    links: CHANNELS.map(channel => ({ channel, status: ['Meta','네이버','구글','카카오'].includes(channel) ? '연결됨' : '미연동', keyRegistered: ['Meta','네이버','구글','카카오'].includes(channel) })),
  },
  {
    id: 'seoul-woori-kids-dental', name: '서울우리아이치과', monthlyBudget: 10000000, color: '#f59e0b', initial: '서',
    links: CHANNELS.map(channel => ({ channel, status: ['Meta','네이버','구글','당근','카카오'].includes(channel) ? '연결됨' : '미연동', keyRegistered: ['Meta','네이버','구글','당근','카카오'].includes(channel) })),
  },

  {
    id: 'wando-fisheries', name: '완도군수산', monthlyBudget: 4000000, color: '#059669', initial: '완',
    links: CHANNELS.map(channel => ({ channel, status: ['Meta','네이버','구글','카카오'].includes(channel) ? '연결됨' : '미연동', keyRegistered: ['Meta','네이버','구글','카카오'].includes(channel) })),
  },
  {
    id: 'ondong-animal', name: '온동물병원', monthlyBudget: 2500000, color: '#8b5cf6', initial: '온',
    links: CHANNELS.map(channel => ({ channel, status: ['Meta','네이버','구글'].includes(channel) ? '연결됨' : '미연동', keyRegistered: ['Meta','네이버','구글'].includes(channel) })),
  },
  {
    id: 'rs-company', name: 'RS컴퍼니', monthlyBudget: 8000000, color: '#0ea5e9', initial: 'R',
    links: CHANNELS.map(channel => ({ channel, status: ['Meta','네이버','구글','당근'].includes(channel) ? '연결됨' : '미연동', keyRegistered: ['Meta','네이버','구글','당근'].includes(channel) })),
  },
  {
    id: 'unmyeong', name: '운명백과', monthlyBudget: 2000000, color: '#a855f7', initial: '운',
    links: CHANNELS.map(channel => ({ channel, status: ['Meta','구글','틱톡'].includes(channel) ? '연결됨' : '미연동', keyRegistered: ['Meta','구글','틱톡'].includes(channel) })),
  },
  {
    id: 'default', name: '광고주', monthlyBudget: 0, color: '#6b7280', initial: '광',
    links: CHANNELS.map(channel => ({ channel, status: '미연동', keyRegistered: false })),
  },
];

const STORAGE_KEY = 'ad-control-center-advertisers-v1';

export function loadAdvertisers(): Advertiser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ADVERTISERS;
    const parsed = JSON.parse(raw) as Advertiser[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ADVERTISERS;
  } catch {
    return DEFAULT_ADVERTISERS;
  }
}

export function saveAdvertisers(advertisers: Advertiser[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(advertisers)); } catch { /* 무시 */ }
  window.dispatchEvent(new CustomEvent('adcc:advertisers-changed', { detail: advertisers }));
}
