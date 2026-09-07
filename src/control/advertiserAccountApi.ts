import { apiFetch } from '../hooks/useApi';

export type AdvertiserAccountRow = {
  id: string;
  email: string;
  name: string;
  status: 'invited' | 'active' | 'disabled';
  advertiser_id: string;
  advertiser_name: string;
  last_login_at: string | null;
  created_at: string;
};

export const advertiserAccountApi = {
  list: (advertiserId?: string) =>
    apiFetch<{ items: AdvertiserAccountRow[] }>(`/advertiser-accounts${advertiserId ? `?advertiserId=${encodeURIComponent(advertiserId)}` : ''}`).then(r => r.items),
  create: (input: { advertiserId: string; email: string; name: string; initialPassword: string }) =>
    apiFetch<AdvertiserAccountRow>('/advertiser-accounts', { method: 'POST', body: JSON.stringify(input) }),
  patch: (id: string, patch: Partial<{ status: 'active' | 'disabled'; resetPassword: string }>) =>
    apiFetch<{ ok: true }>(`/advertiser-accounts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => apiFetch<{ ok: true }>(`/advertiser-accounts/${id}`, { method: 'DELETE' }),
};
