export type MenuAccessLevel = 'view' | 'manage';

export type CustomRole = {
  id: string;
  name: string;
  // key: 사이드바 메뉴 key, value: 이 역할이 그 메뉴에 대해 갖는 권한 수준
  menuAccess: Record<string, MenuAccessLevel>;
};

const STORAGE_KEY = 'adcc-custom-roles-v1';

export function loadCustomRoles(): CustomRole[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveCustomRoles(roles: CustomRole[]): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(roles)); return true; } catch { return false; }
}
