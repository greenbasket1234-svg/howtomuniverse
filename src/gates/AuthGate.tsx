import { ReactNode, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';

type AuthScreen = 'login' | 'signup' | 'forgot-password';

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState<AuthScreen>('login');

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

  if (!user) {
    if (screen === 'signup') return <SignupPage onSwitchToLogin={() => setScreen('login')} />;
    if (screen === 'forgot-password') return <ForgotPasswordPage onSwitchToLogin={() => setScreen('login')} />;
    return <LoginPage onSwitchToSignup={() => setScreen('signup')} onSwitchToForgotPassword={() => setScreen('forgot-password')} />;
  }

  return <>{children}</>;
}
