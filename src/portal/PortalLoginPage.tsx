import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { portalApi, setPortalToken } from './portalApi';

export function PortalLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('이메일과 비밀번호를 입력하세요.'); return; }
    setLoading(true);
    try {
      const { token } = await portalApi.login(email.trim(), password);
      setPortalToken(token);
      navigate('/portal/dashboard', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <form onSubmit={submit} style={{ width: 360, background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 8px 30px rgba(15,23,42,.08)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 900, letterSpacing: '.03em', color: '#0f1b35' }}>HOWTOM <span style={{ color: '#2563eb' }}>포털</span></div>
          <p style={{ color: '#64748b', fontSize: 13, margin: '6px 0 0' }}>광고주 전용 로그인입니다.</p>
        </div>
        {error && <div style={{ padding: '10px 12px', borderRadius: 9, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>{error}</div>}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#475569' }}>
          이메일
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ border: '1px solid #dbe3ee', borderRadius: 9, padding: '10px 12px', font: 'inherit' }} autoFocus />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#475569' }}>
          비밀번호
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ border: '1px solid #dbe3ee', borderRadius: 9, padding: '10px 12px', font: 'inherit' }} />
        </label>
        <button type="submit" disabled={loading} style={{ marginTop: 8, padding: '11px 0', borderRadius: 9, border: 0, background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
        <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', margin: 0 }}>계정 정보는 담당자에게 문의해주세요.</p>
      </form>
    </div>
  );
}
