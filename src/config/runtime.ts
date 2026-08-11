const envDemoRequested = import.meta.env.VITE_DEMO_MODE === 'true';
const envAllowRemoteDemo = import.meta.env.VITE_ALLOW_REMOTE_DEMO === 'true';

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === '[::1]';
}

function currentHostname(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname || '';
}

/**
 * 데모 모드는 기본적으로 localhost/127.0.0.1에서만 허용합니다.
 * 같은 dist를 Railway·Vercel·공개 도메인에 올려도 관리자 데모 세션이 자동으로 열리지 않습니다.
 * 외부 데모를 정말 의도한 경우에만 VITE_ALLOW_REMOTE_DEMO=true를 명시하세요.
 */
export const DEMO_MODE = envDemoRequested && (isLoopbackHostname(currentHostname()) || envAllowRemoteDemo);
export const REMOTE_DEMO_BLOCKED = envDemoRequested && !DEMO_MODE;
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || '/api';
export const SECURE_CREDENTIAL_BACKEND_ENABLED = import.meta.env.VITE_SECURE_CREDENTIAL_BACKEND === 'true';

export const runtimeInfo = {
  demoRequested: envDemoRequested,
  demoMode: DEMO_MODE,
  remoteDemoBlocked: REMOTE_DEMO_BLOCKED,
  allowRemoteDemo: envAllowRemoteDemo,
  apiBase: API_BASE,
  secureCredentialBackendEnabled: SECURE_CREDENTIAL_BACKEND_ENABLED,
};
