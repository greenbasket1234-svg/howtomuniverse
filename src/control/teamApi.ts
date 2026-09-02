import { apiFetch } from '../hooks/useApi';

export type TeamUserRow = {
  id: string;
  email: string;
  name: string;
  title: string | null;
  department: string | null;
  status: 'invited' | 'active' | 'disabled';
  is_owner: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  role_ids: string[] | null;
  advertiser_ids: string[] | null;
};

export type AppRole = {
  id: string;
  name: string;
  description: string;
  scope: 'internal' | 'advertiser';
  permission_keys: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export const teamApi = {
  listUsers: () => apiFetch<{ items: TeamUserRow[] }>('/users').then(r => r.items),
  createUser: (input: { email: string; name: string; initialPassword: string; title?: string; department?: string; roleIds?: string[]; advertiserIds?: string[] | null }) =>
    apiFetch<TeamUserRow>('/users', { method: 'POST', body: JSON.stringify(input) }),
  patchUser: (id: string, patch: Partial<{ name: string; title: string; department: string; status: string; newPassword: string; roleIds: string[]; advertiserIds: string[] | null }>) =>
    apiFetch<{ ok: true }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteUser: (id: string) => apiFetch<{ ok: true }>(`/users/${id}`, { method: 'DELETE' }),

  listRoles: () => apiFetch<{ items: AppRole[] }>('/roles').then(r => r.items),
  createRole: (input: { name: string; description?: string; scope?: 'internal' | 'advertiser'; permissionKeys?: string[] }) =>
    apiFetch<AppRole>('/roles', { method: 'POST', body: JSON.stringify(input) }),
  patchRole: (id: string, patch: Partial<{ name: string; description: string; permissionKeys: string[] }>) =>
    apiFetch<AppRole>(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteRole: (id: string) => apiFetch<{ ok: true }>(`/roles/${id}`, { method: 'DELETE' }),
};
