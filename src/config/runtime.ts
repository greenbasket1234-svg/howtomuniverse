export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || '/api';
export const SECURE_CREDENTIAL_BACKEND_ENABLED = import.meta.env.VITE_SECURE_CREDENTIAL_BACKEND === 'true';

export const runtimeInfo = {
  apiBase: API_BASE,
  secureCredentialBackendEnabled: SECURE_CREDENTIAL_BACKEND_ENABLED,
};
