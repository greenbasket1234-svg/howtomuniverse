import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { API_BASE } from '../config/runtime';

export type UserRole = 'admin' | 'advertiser' | 'member';

export type AuthUser = {
  id: number | string;
  email: string;
  name: string;
  nickname?: string;
  role: UserRole;
  advertiser_id: number | null;
  advertiser_name?: string;
  // 실제 팀원 계정(권한 분리 1단계)에서만 채워집니다. 최초 관리자(owner) 계정은
  // isOwner=true로 항상 모든 권한을 가진 것으로 취급합니다.
  isOwner?: boolean;
  permissionKeys?: string[];
  advertiserIds?: string[] | null;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  /** 세부 기능 단위 권한 확인이 필요할 때 씁니다. owner 계정은 항상 true입니다. */
  hasPermission: (key: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'acc_token';
const USER_KEY  = 'acc_user';

function storedToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function storedUser(): AuthUser | null {
  try { const r = localStorage.getItem(USER_KEY); return r ? (JSON.parse(r) as AuthUser) : null; }
  catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: storedUser(),
    token: storedToken(),
    loading: !!storedToken(), // 토큰 있으면 검증 중
  });

  // 앱 시작 시 토큰 유효성을 항상 서버에서 검증합니다 (로컬·운영 동일).
  useEffect(() => {
    const token = storedToken();
    if (!token) { setState(s => ({ ...s, loading: false })); return; }

    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        if (!r.ok) throw new Error(`인증 확인 실패 (${r.status})`);
        const data = await r.json().catch(() => null) as { user?: AuthUser } | AuthUser | null;
        const verifiedUser = data && 'user' in data ? data.user : data;
        if (!verifiedUser || typeof verifiedUser !== 'object' || !('role' in verifiedUser)) {
          throw new Error('인증 서버 응답에 사용자 정보가 없습니다.');
        }
        localStorage.setItem(USER_KEY, JSON.stringify(verifiedUser));
        setState({ user: verifiedUser as AuthUser, token, loading: false });
      })
      .catch(() => {
        // 운영 모드에서는 서버 검증에 실패한 토큰을 신뢰하지 않습니다.
        // 네트워크가 끊겼다고 해서 로컬에 남은 관리자 토큰으로 계속 통과하면 보안 경계가 무너질 수 있습니다.
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setState({ user: null, token: null, loading: false });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({ error: `인증 서버 응답 오류 (${res.status})` })) as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok) throw new Error(data.error ?? '로그인 실패');
      if (!data.token || !data.user) throw new Error('인증 서버가 토큰 또는 사용자 정보를 반환하지 않았습니다.');
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setState({ user: data.user, token: data.token, loading: false });
    } catch (e) {
      setState(s => ({ ...s, loading: false }));
      throw e;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ user: null, token: null, loading: false });
  }, []);

  const hasPermission = useCallback((key: string) => Boolean(state.user?.isOwner || state.user?.permissionKeys?.includes(key)), [state.user]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission, isAdmin: Boolean(state.user?.isOwner || state.user?.permissionKeys?.includes('admin.system.manage')) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.');
  return ctx;
}
