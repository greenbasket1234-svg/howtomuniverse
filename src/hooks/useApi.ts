/** apiFetch — 인증 토큰을 자동으로 포함하는 fetch 헬퍼 */
import { API_BASE } from '../config/runtime';

function getToken(): string | null {
  try { return localStorage.getItem('acc_token'); } catch { return null; }
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('acc_token');
    localStorage.removeItem('acc_user');
    window.location.reload();
    throw new Error('인증이 만료되었습니다.');
  }

  const data = await res.json() as T & { error?: string; code?: string };
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error ?? res.statusText) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = (data as { code?: string }).code;
    throw err;
  }
  return data;
}
