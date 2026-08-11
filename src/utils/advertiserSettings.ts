export type AdvertiserPreset = '상담형' | '커머스형' | '혼합형' | '클릭 성과형' | '노출 도달형';
export const AD_PLATFORM_OPTIONS = ['네이버', '구글', '유튜브', '당근', '틱톡', '토스', '카카오', '메타', '인스타그램', '모비온', 'ADN'];
export const AD_PLACEMENT_OPTIONS = ['카페', '블로그', '피드', '검색광고', '네이티브 광고', '메인화면', 'SNS'];
export const AD_TYPE_OPTIONS = ['DA(Display Ads)', 'SA(Search Ads)'];
export type AdvertiserSetting = {
  advertiserName: string;
  industry: string;
  currency: string;
  timezone: string;
  preset: AdvertiserPreset;
  owners: string[];
  platforms: string[]; // 사용 중인 플랫폼(매체)
  placements: string[]; // 주로 노출되는 광고 지면
  adTypes: string[]; // 주로 쓰는 광고 유형(DA/SA 등)
  updatedAt: string;
};

const STORAGE_KEY = 'adcc-advertiser-settings-v1';

export function loadAdvertiserSettings(): Record<string, AdvertiserSetting> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function saveAdvertiserSetting(setting: AdvertiserSetting): boolean {
  try {
    const all = loadAdvertiserSettings();
    all[setting.advertiserName] = setting;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch { return false; }
}

export function deleteAdvertiserSetting(advertiserName: string): boolean {
  try {
    const all = loadAdvertiserSettings();
    delete all[advertiserName];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch { return false; }
}
