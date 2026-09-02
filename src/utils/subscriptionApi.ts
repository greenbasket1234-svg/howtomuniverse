import { apiFetch } from '../hooks/useApi';

export type SubscriptionFeature = 'blog' | 'video-script' | 'document' | 'ad-creation' | 'ai-generation';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'paused' | 'cancelled';

export type FeatureEntitlements = {
  blogEnabled: boolean;
  blogPostsPerMonth?: number | null;
  videoScriptsPerMonth?: number | null;
  documentsPerMonth?: number | null;
  adCreationsPerMonth?: number | null;
  aiCreditsPerMonth?: number | null;
  blogIntegrations?: number | null;
};

export type AdvertiserSubscriptionRow = {
  id: string;
  advertiser_id: string;
  plan_id: string | null;
  plan_name: string;
  status: SubscriptionStatus;
  entitlements: FeatureEntitlements;
  started_at: string;
  renews_at: string | null;
  note: string | null;
};

export type PlanEntitlement = { featureKey: string; enabled: boolean; limit?: number };
export type SubscriptionPlanRow = {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number | null;
  vat_included: boolean;
  status: 'draft' | 'active' | 'archived';
  entitlements: PlanEntitlement[];
  created_at: string;
};

export type UsageEventRow = {
  id: string;
  advertiser_id: string;
  feature: string;
  action: string;
  quantity: number;
  source_id: string | null;
  provider: string | null;
  provider_cost: number | null;
  ai_cost: number | null;
  created_at: string;
};

export type FeatureCheckResult = {
  allowed: boolean;
  subscription: AdvertiserSubscriptionRow;
  limit?: number;
  used: number;
  remaining?: number;
  reason: string;
};

export const subscriptionApi = {
  // 광고주별 구독 (없으면 서버가 '미설정' 기본값으로 자동 생성)
  getSubscription: (advertiserId: string) => apiFetch<AdvertiserSubscriptionRow>(`/advertisers/${encodeURIComponent(advertiserId)}/subscription`),
  patchSubscription: (advertiserId: string, patch: Partial<{ status: SubscriptionStatus; note: string; renewsAt: string; entitlements: Partial<FeatureEntitlements> }>) =>
    apiFetch<AdvertiserSubscriptionRow>(`/advertisers/${encodeURIComponent(advertiserId)}/subscription`, { method: 'PATCH', body: JSON.stringify(patch) }),
  applyPlan: (advertiserId: string, planId: string) =>
    apiFetch<AdvertiserSubscriptionRow>(`/advertisers/${encodeURIComponent(advertiserId)}/subscription`, { method: 'PATCH', body: JSON.stringify({ planId }) }),
  listAllSubscriptions: () => apiFetch<{ items: AdvertiserSubscriptionRow[] }>('/subscriptions').then(r => r.items),

  // 구독 상품(관리자가 설계하는 템플릿)
  listPlans: () => apiFetch<{ items: SubscriptionPlanRow[] }>('/subscription-plans').then(r => r.items),
  createPlan: (input: { name: string; description?: string; monthlyPrice?: number; entitlements?: PlanEntitlement[]; status?: string }) =>
    apiFetch<SubscriptionPlanRow>('/subscription-plans', { method: 'POST', body: JSON.stringify(input) }),
  patchPlan: (id: string, patch: Partial<{ name: string; description: string; monthlyPrice: number; status: string; entitlements: PlanEntitlement[] }>) =>
    apiFetch<SubscriptionPlanRow>(`/subscription-plans/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deletePlan: (id: string) => apiFetch<{ ok: true }>(`/subscription-plans/${id}`, { method: 'DELETE' }),

  // 사용량 - 한도 체크(허용 여부만 확인, 기록 안 함)와 실제 기록은 별개입니다.
  checkFeature: (advertiserId: string, feature: SubscriptionFeature) =>
    apiFetch<FeatureCheckResult>(`/usage-events/check?advertiserId=${encodeURIComponent(advertiserId)}&feature=${encodeURIComponent(feature)}`),
  listUsage: (params?: { advertiserId?: string; feature?: string }) => {
    const q = new URLSearchParams();
    if (params?.advertiserId) q.set('advertiserId', params.advertiserId);
    if (params?.feature) q.set('feature', params.feature);
    return apiFetch<{ items: UsageEventRow[] }>(`/usage-events?${q.toString()}`).then(r => r.items);
  },
  /** recordUsageOnce와 동일 - sourceId가 이미 기록되어 있으면 서버가 중복 집계 없이 기존 값을 돌려줍니다. */
  recordUsage: (input: { advertiserId: string; feature: SubscriptionFeature; action: string; quantity?: number; sourceId?: string; provider?: string; providerCost?: number; aiCost?: number }) =>
    apiFetch<UsageEventRow>('/usage-events', { method: 'POST', body: JSON.stringify(input) }),
};
