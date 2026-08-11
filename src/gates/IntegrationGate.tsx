import { ReactNode } from 'react';

const IS_DEV = import.meta.env.DEV;

/**
 * IntegrationGate — 연동 전 플레이스홀더.
 * 개발 환경에서만 "연동 GATE" 배지를 표시합니다.
 * 프로덕션 빌드에서는 children만 렌더링합니다.
 */
export function IntegrationGate({
  name,
  description,
  children,
}: {
  name: string;
  description: string;
  children?: ReactNode;
}) {
  if (!IS_DEV) {
    return <>{children}</>;
  }

  return (
    <div className="integration-gate">
      <div className="integration-gate-badge">🔌 연동 GATE · {name}</div>
      <p className="integration-gate-desc">{description}</p>
      {children && (
        <div className="integration-gate-preview">{children}</div>
      )}
    </div>
  );
}
