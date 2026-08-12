/**
 * Zero State 마이그레이션
 *
 * 이전 프론트 빌드가 브라우저에 남긴 샘플/시드/임시 업무 데이터를 한 번 전부 비웁니다.
 * 로그인 세션만 유지합니다. 이후 새로 입력한 데이터는 각 기능의 현재 저장 정책을 따릅니다.
 */
const MIGRATION_KEY = 'howtom-zero-state-20260811-v2';
const KEEP_KEYS = new Set(['acc_token', 'acc_user', MIGRATION_KEY]);

export function runZeroStateMigration() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(MIGRATION_KEY) === 'done') return;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    keys.forEach(key => { if (!KEEP_KEYS.has(key)) localStorage.removeItem(key); });
    localStorage.setItem(MIGRATION_KEY, 'done');
  } catch {
    // localStorage 사용이 막힌 환경에서도 서버 측 Zero State는 유지됩니다.
  }
}
