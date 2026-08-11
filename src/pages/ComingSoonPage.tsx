export function ComingSoonPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>{title}</h1>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0 }}>
        현재 준비중인 기능입니다.
        <br />
        {description}
      </p>
    </div>
  );
}
