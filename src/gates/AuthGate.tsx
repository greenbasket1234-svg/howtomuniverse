import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { LoginPage } from '../pages/LoginPage';

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 36, height: 36,
          border: '3px solid #e5e7eb', borderTop: '3px solid #2563eb',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>로딩 중...</span>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return <>{children}</>;
}
