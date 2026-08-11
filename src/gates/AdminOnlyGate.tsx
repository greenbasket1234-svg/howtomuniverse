import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Sidebar에서는 관리자 메뉴를 이미 숨기고 있지만(레이아웃 차원), 그동안 /admin 라우트
// 자체에는 진입을 막는 장치가 없어서 non-admin 사용자가 주소를 직접 입력하면 화면이
// 그대로 열렸습니다. 진짜 접근 통제는 서버가 해야 하지만, 프론트엔드 단계에서도 최소한의
// UI 가드는 있는 게 맞아서 라우트 단위로 막습니다.
export function AdminOnlyGate({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/home" replace />;
  return <>{children}</>;
}
