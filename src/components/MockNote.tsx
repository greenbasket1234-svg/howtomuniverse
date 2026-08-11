export function MockNote({ children }: { children?: React.ReactNode }) {
  return (
    <span className="mock-note">
      mock 데이터 · 실제 연동 전 표시용입니다{children ? ` — ${children}` : ''}
    </span>
  );
}
