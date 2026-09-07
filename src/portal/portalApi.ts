/** portalApi — 광고주 포털 전용 fetch 헬퍼입니다. 내부 직원 로그인(acc_token)과
 * 완전히 별개의 저장 키(portal_token)를 씁니다 - 같은 브라우저에서 직원 세션과
 * 광고주 세션이 섞이지 않게 하기 위해서입니다. */
import { API_BASE } from '../config/runtime';

const PORTAL_TOKEN_KEY = 'portal_token';

export function getPortalToken(): string | null {
  try { return localStorage.getItem(PORTAL_TOKEN_KEY); } catch { return null; }
}
export function setPortalToken(token: string) {
  try { localStorage.setItem(PORTAL_TOKEN_KEY, token); } catch { /* ignore */ }
}
export function clearPortalToken() {
  try { localStorage.removeItem(PORTAL_TOKEN_KEY); } catch { /* ignore */ }
}

export async function portalFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getPortalToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearPortalToken();
    throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; requiredTier?: number; currentTier?: number };
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error ?? res.statusText) as Error & { requiredTier?: number; currentTier?: number };
    err.requiredTier = (data as { requiredTier?: number }).requiredTier;
    err.currentTier = (data as { currentTier?: number }).currentTier;
    throw err;
  }
  return data;
}

export type PortalAccount = { id: string; email: string; name: string; advertiserId: string; advertiserName: string; tier: number; tierLabel: string; planName: string };
export type PortalCampaignRow = { channel: string; campaignId: string; campaignName: string; impressions: number; clicks: number; spend: number; dbCount: number; purchases: number; revenue: number };
export type PortalDashboardRow = { date: string; advertiserId: string; channel: string; impressions: number; clicks: number; spend: number; dbCount: number; purchases: number; revenue: number; ctr: number; cpc: number; roas: number };
export type PortalDashboardTotals = PortalDashboardRow & { totalConversions: number; cvr: number; cpa: number };

export class TierRestrictedError extends Error {
  requiredTier: number; currentTier: number;
  constructor(message: string, requiredTier: number, currentTier: number) { super(message); this.requiredTier = requiredTier; this.currentTier = currentTier; }
}

export const portalApi = {
  login: (email: string, password: string) => portalFetch<{ token: string; account: PortalAccount }>('/advertiser-portal/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => portalFetch<PortalAccount>('/advertiser-portal/me'),
  dashboard: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString();
    return portalFetch<{ rows: PortalDashboardRow[]; totals: PortalDashboardTotals; meta: { from: string | null; to: string | null; generatedAt: string } }>(`/advertiser-portal/dashboard${qs ? `?${qs}` : ''}`);
  },
  async campaigns() {
    try {
      return await portalFetch<{ rows: PortalCampaignRow[] }>('/advertiser-portal/campaigns');
    } catch (e) {
      const err = e as Error & { requiredTier?: number; currentTier?: number };
      if (err.requiredTier !== undefined) throw new TierRestrictedError(err.message, err.requiredTier, err.currentTier ?? 0);
      throw e;
    }
  },
};
