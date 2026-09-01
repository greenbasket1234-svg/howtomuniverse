const KEY = 'howtom-universe-brand-profiles-v1';

export type BrandProfile = {
  advertiserId: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontName?: string;
  tagline?: string;
  toneDescription?: string;
  keyPhrases: string[];
  prohibitedPhrases: string[];
  updatedAt: string;
};

function parse(): Record<string, BrandProfile> {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
function save(map: Record<string, BrandProfile>) {
  localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent('howtom:brand-profiles-changed'));
}

export function loadBrandProfile(advertiserId: string): BrandProfile {
  const map = parse();
  return map[advertiserId] || {
    advertiserId, keyPhrases: [], prohibitedPhrases: [], updatedAt: '',
  };
}

export function saveBrandProfile(profile: BrandProfile) {
  const map = parse();
  map[profile.advertiserId] = { ...profile, updatedAt: new Date().toISOString() };
  save(map);
  return map[profile.advertiserId];
}
