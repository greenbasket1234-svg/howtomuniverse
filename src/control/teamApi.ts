import { apiFetch } from '../hooks/useApi';

export type TeamUserRow = {
  id: string;
  email: string;
  name: string;
  title: string | null;
  department: string | null;
  status: 'pending' | 'invited' | 'active' | 'disabled' | 'rejected';
  is_owner: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  role_ids: string[] | null;
  advertiser_ids: string[] | null;
};

export type PasswordResetRequest = {
  id: string;
  user_id: string | null;
  email: string;
  status: 'requested' | 'resolved';
  requested_at: string;
  resolved_at: string | null;
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
  // 회원가입 승인/거절 - status='pending'인 계정에만 적용됩니다.
  approveUser: (id: string, input?: { roleIds?: string[]; advertiserIds?: string[] | null }) =>
    apiFetch<{ ok: true }>(`/users/${id}/approve`, { method: 'POST', body: JSON.stringify(input || {}) }),
  rejectUser: (id: string) => apiFetch<{ ok: true }>(`/users/${id}/reject`, { method: 'POST' }),

  listRoles: () => apiFetch<{ items: AppRole[] }>('/roles').then(r => r.items),
  createRole: (input: { name: string; description?: string; scope?: 'internal' | 'advertiser'; permissionKeys?: string[] }) =>
    apiFetch<AppRole>('/roles', { method: 'POST', body: JSON.stringify(input) }),
  patchRole: (id: string, patch: Partial<{ name: string; description: string; permissionKeys: string[] }>) =>
    apiFetch<AppRole>(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteRole: (id: string) => apiFetch<{ ok: true }>(`/roles/${id}`, { method: 'DELETE' }),
};

// 비밀번호 찾기 요청함 - 관리자가 확인하고 직접 새 비밀번호를 지정합니다(이메일 미연동).
export const passwordResetApi = {
  list: () => apiFetch<{ items: PasswordResetRequest[] }>('/password-reset-requests').then(r => r.items),
  resolve: (id: string, newPassword?: string) =>
    apiFetch<{ ok: true }>(`/password-reset-requests/${id}/resolve`, { method: 'POST', body: JSON.stringify(newPassword ? { newPassword } : {}) }),
};

// 공개(비로그인) 인증 관련 - 회원가입 신청과 비밀번호 찾기 요청. apiFetch는 401을 받으면
// 자동으로 로그인 화면으로 보내버리므로, 여기서는 인증 헤더가 필요 없는 순수 fetch를 씁니다.
import { API_BASE } from '../config/runtime';
async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || '요청에 실패했습니다.');
  return data as T;
}
export const publicAuthApi = {
  signup: (input: { email: string; name: string; password: string }) => publicPost<{ ok: true; message: string }>('/auth/signup', input),
  requestPasswordReset: (email: string) => publicPost<{ ok: true; message: string }>('/auth/password-reset-request', { email }),
};
