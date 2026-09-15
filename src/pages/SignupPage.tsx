import { FormEvent, useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { HowtomUniverseLogo } from '../components/HowtomUniverseLogo';
import { publicAuthApi } from '../control/teamApi';

export function SignupPage({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    setLoading(true);
    try {
      await publicAuthApi.signup({ email, name, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입 신청에 실패했습니다.');
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
              <span>가입 신청이 접수되었습니다. 관리자 승인 후 로그인하실 수 있습니다.</span>
            </div>
            <button className="space-login-submit" onClick={onSwitchToLogin}>로그인 화면으로</button>
          </div>
        ) : (
          <form className="space-login-form" onSubmit={submit}>
            <div className="space-login-field">
              <User size={18} />
              <input type="text" required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="이름" />
            </div>
            <div className="space-login-field">
              <Mail size={18} />
              <input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="이메일" />
            </div>
            <div className="space-login-field">
              <Lock size={18} />
              <input type={showPw ? 'text' : 'password'} required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호(8자 이상)" />
              <button type="button" className="space-login-field-toggle" onClick={() => setShowPw(v => !v)} aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {error && <div className="space-login-error"><AlertTriangle size={15} /><span>{error}</span></div>}

            <button type="submit" className="space-login-submit" disabled={loading}>{loading ? '신청 중...' : '가입 신청'}</button>
          </form>
        )}

        {!done && (
          <div className="space-login-notice">
            가입 신청 후 관리자 승인이 필요합니다. 이미 계정이 있으신가요? <button type="button" className="space-login-linkbtn" onClick={onSwitchToLogin}>로그인</button>
          </div>
        )}
      </div>
    </div>
  );
}
