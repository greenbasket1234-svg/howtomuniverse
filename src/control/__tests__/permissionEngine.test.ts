import { beforeEach, describe, expect, it } from 'vitest';

// 이 프로젝트의 vitest 환경에는 기본적으로 브라우저 localStorage가 없습니다(node 환경).
// control 스토어 전체가 localStorage 기반이라, 테스트에서만 쓰는 아주 단순한 메모리 폴리필을
// 붙여줍니다. 실제 앱 코드는 그대로 브라우저 localStorage를 사용합니다.
function installLocalStorageStub() {
  const memory = new Map<string, string>();
  const stub = {
    getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
    key: (index: number) => Array.from(memory.keys())[index] ?? null,
    get length() { return memory.size; },
  };
  (globalThis as unknown as { localStorage: Storage }).localStorage = stub as unknown as Storage;
  // controlStore가 window.dispatchEvent도 호출하므로 최소한의 스텁을 넣어줍니다.
  if (!(globalThis as { dispatchEvent?: unknown }).dispatchEvent) {
    (globalThis as unknown as { dispatchEvent: () => boolean }).dispatchEvent = () => true;
  }
  if (!(globalThis as { window?: unknown }).window) {
    (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
  }
  return memory;
}

describe('permissionEngine.canAccess', () => {
  beforeEach(() => {
    installLocalStorageStub();
  });

  it('조직 소속(멤버십)이 없는 사용자는 차단한다', async () => {
    const { canAccess } = await import('../permissionEngine');
    const result = canAccess({ userId: 'nobody', featureKey: 'dashboard.view' });
    expect(result.allowed).toBe(false);
  });

  it('기본 시드의 데모 관리자는 관리자 전용 기능에도 접근할 수 있다', async () => {
    const { canAccess } = await import('../permissionEngine');
    const result = canAccess({ userId: 'demo-admin', featureKey: 'admin.users.manage' });
    expect(result.allowed).toBe(true);
  });

  it("Feature Flag를 'disabled'로 두면 관리자여도 차단된다", async () => {
    const { canAccess } = await import('../permissionEngine');
    const { loadFeatureFlags, saveFeatureFlags } = await import('../controlStore');
    const flags = loadFeatureFlags();
    saveFeatureFlags(flags.map(f => f.featureKey === 'insights.ai' ? { ...f, state: 'disabled' as const } : f));
    const result = canAccess({ userId: 'demo-admin', featureKey: 'insights.ai.use' });
    expect(result.allowed).toBe(false);
  });

  it("Feature Flag가 'internal'이면 광고주 역할만 가진 사용자는 차단된다", async () => {
    const { canAccess } = await import('../permissionEngine');
    const { upsertMembership, saveControlUsers, loadControlUsers } = await import('../controlStore');
    const users = loadControlUsers();
    saveControlUsers([...users, { userId: 'advertiser-user', name: '광고주 담당자', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
    upsertMembership({ userId: 'advertiser-user', roleIds: ['role-advertiser-basic'] });
    // 기본 시드에서 insights.ai는 internal 상태이며, 광고주 Basic 역할에는 insights.ai.use 권한 자체가 없어
    // "역할 권한에서 허용되지 않음"으로 먼저 막힙니다. 그래서 광고주 역할에도 해당 권한키를 열어준 뒤
    // internal 판정 자체가 동작하는지 확인합니다.
    const { loadRoles, saveRoles } = await import('../controlStore');
    const roles = loadRoles();
    saveRoles(roles.map(r => r.roleId === 'role-advertiser-basic' ? { ...r, permissionKeys: [...r.permissionKeys, 'insights.ai.use'] } : r));
    const result = canAccess({ userId: 'advertiser-user', featureKey: 'insights.ai.use' });
    expect(result.allowed).toBe(false);
  });

  it("Feature Flag가 'beta'이고 허용 목록이 있으면 목록 밖 사용자는 차단된다", async () => {
    const { canAccess } = await import('../permissionEngine');
    const { loadFeatureFlags, saveFeatureFlags } = await import('../controlStore');
    const flags = loadFeatureFlags();
    saveFeatureFlags(flags.map(f => f.featureKey === 'insights.ai' ? { ...f, state: 'beta' as const, allowedUserIds: ['someone-else'] } : f));
    const result = canAccess({ userId: 'demo-admin', featureKey: 'insights.ai.use' });
    expect(result.allowed).toBe(false);
  });

  it("담당 광고주 범위 밖의 advertiserId로 조회하면 차단된다", async () => {
    const { canAccess } = await import('../permissionEngine');
    const { upsertMembership, saveControlUsers, loadControlUsers } = await import('../controlStore');
    const users = loadControlUsers();
    saveControlUsers([...users, { userId: 'scoped-user', name: '담당자', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
    upsertMembership({ userId: 'scoped-user', roleIds: ['role-marketer'], advertiserIds: ['advertiser-a'] });
    const result = canAccess({ userId: 'scoped-user', featureKey: 'ads.view', advertiserId: 'advertiser-b' });
    expect(result.allowed).toBe(false);
  });
});
