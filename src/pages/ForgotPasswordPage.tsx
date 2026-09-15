import { FormEvent, useState } from 'react';
import { Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { HowtomUniverseLogo } from '../components/HowtomUniverseLogo';
import { publicAuthApi } from '../control/teamApi';

export function ForgotPasswordPage({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await publicAuthApi.requestPasswordReset(email);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-login">
      <div className="space-login-stars" aria-hidden="true"><i className="layer-far" /><i className="layer-mid" /><i className="layer-near" /></div>
      <div className="space-login-orbits" aria-hidden="true"><i className="orbit-1" /><i className="orbit-2" /></div>
      <div className="space-login-earth-wrap" aria-hidden="true">
        <div className="space-login-earth-atmosphere" />
        <div className="space-login-earth-body">
          <div className="space-login-earth-continents" /><div className="space-login-earth-clouds" /><div className="space-login-earth-citylights" /><div className="space-login-earth-sunflare" /><div className="space-login-earth-rim" />
        </div>
      </div>

      <div className="space-login-card">
        <div className="space-login-logo"><HowtomUniverseLogo theme="dark" /></div>

        {done ? (
          <div className="space-login-form">
            <div className="space-login-notice" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} />
              <span>요청이 접수되었습니다. 아직 이메일 발송 연동 전이라, 관리자가 확인 후 새 비밀번호를 직접 전달해드립니다.</span>
            </div>
            <button className="space-login-submit" onClick={onSwitchToLogin}>로그인 화면으로</button>
          </div>
        ) : (
          <form className="space-login-form" onSubmit={submit}>
            <div className="space-login-field">
              <Mail size={18} />
              <input type="email" required autoFocus autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="가입한 이메일" />
            </div>

            {error && <div className="space-login-error"><AlertTriangle size={15} /><span>{error}</span></div>}

            <button type="submit" className="space-login-submit" disabled={loading}>{loading ? '요청 중...' : '비밀번호 재설정 요청'}</button>
          </form>
        )}

        {!done && (
          <div className="space-login-notice">
            아직 이메일 발송 연동 전이라, 요청 접수 후 관리자가 직접 새 비밀번호를 전달해드립니다. <button type="button" className="space-login-linkbtn" onClick={onSwitchToLogin}>로그인으로 돌아가기</button>
          </div>
        )}
      </div>
    </div>
  );
}
