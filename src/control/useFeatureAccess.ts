import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { canAccess, type AccessDecision } from './permissionEngine';

/**
 * 서버에서 인증된 관리자는 프론트의 로컬 샘플 사용자/멤버십에 의존하지 않습니다.
 * 일반 사용자는 향후 서버 권한 API 연결 전까지 controlStore에 실제로 등록된 사용자 ID를 사용합니다.
 */
export function useFeatureAccess(featureKey: string, advertiserId?: string): AccessDecision {
  const { user, isAdmin } = useAuth();
  return useMemo(() => {
    if (isAdmin) return { allowed: true, reasons: ['관리자'], matchedRoles: [] };
    if (!user) return { allowed: false, reasons: ['로그인이 필요합니다.'], matchedRoles: [] };
    return canAccess({ userId: String(user.id), featureKey, advertiserId });
  }, [user?.id, isAdmin, featureKey, advertiserId]);
}
