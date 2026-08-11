import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { canAccess, type AccessDecision } from './permissionEngine';

// 지금은 실제 로그인 백엔드가 없어서 AuthContext의 사용자(숫자 id)와 권한 엔진의
// ControlUser(문자열 userId)가 서로 연결되어 있지 않습니다. 데모 모드에서는 항상 시드된
// 'demo-admin' 멤버십을 쓰는 것으로 매핑해 둡니다. 실제 로그인이 붙으면 이 함수 하나만
// AuthUser.id ↔ ControlUser.userId 매핑 테이블 조회로 바꾸면 됩니다.
function controlUserId(authUserId: number | undefined): string {
  if (authUserId === 0 || authUserId === undefined) return 'demo-admin';
  return String(authUserId);
}

export function useFeatureAccess(featureKey: string, advertiserId?: string): AccessDecision {
  const { user } = useAuth();
  return useMemo(
    () => canAccess({ userId: controlUserId(user?.id), featureKey, advertiserId }),
    [user?.id, featureKey, advertiserId],
  );
}
