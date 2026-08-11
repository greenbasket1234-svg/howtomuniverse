import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>페이지를 찾을 수 없습니다.</h1>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 20 }}>
        요청한 주소가 변경되었거나 존재하지 않습니다.
      </p>
      <Link className="btn btn-primary" to="/dashboard">
        대시보드로 돌아가기
      </Link>
    </div>
  );
}
