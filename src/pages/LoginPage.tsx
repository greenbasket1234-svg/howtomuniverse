import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HowtomUniverseLogo } from '../components/HowtomUniverseLogo';
import { REMOTE_DEMO_BLOCKED } from '../config/runtime';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [id, setId]           = useState('');
  const [pw, setPw]           = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // AuthContext.login()은 이메일/아이디 형식을 가리지 않고 그대로 인증 백엔드로 전달합니다.
      await login(id, pw);
      navigate('/home', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '로그인 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-login">
      {/* 배경: 별 + 궤도 링 (이미지 파일 없이 CSS로만 렌더링) */}
      <div className="space-login-stars" aria-hidden="true">
        <i className="layer-far" />
        <i className="layer-mid" />
        <i className="layer-near" />
      </div>
      <div className="space-login-orbits" aria-hidden="true">
        <i className="orbit-1" />
        <i className="orbit-2" />
      </div>

      {/* 화면 하단의 지구 */}
      <div className="space-login-earth-wrap" aria-hidden="true">
        <div className="space-login-earth-atmosphere" />
        <div className="space-login-earth-body">
          <div className="space-login-earth-continents" />
          <div className="space-login-earth-clouds" />
          <div className="space-login-earth-citylights" />
          <div className="space-login-earth-sunflare" />
          <div className="space-login-earth-rim" />
        </div>
      </div>

      {/* 로그인 카드 */}
      <div className="space-login-card">
        <div className="space-login-logo">
          <HowtomUniverseLogo theme="dark" />
        </div>

        <form className="space-login-form" onSubmit={submit}>
          <div className="space-login-field">
            <User size={18} />
            <input
              type="text" required autoFocus autoComplete="username"
              value={id} onChange={e => setId(e.target.value)}
              placeholder="아이디를 입력하세요"
            />
          </div>

          <div className="space-login-field">
            <Lock size={18} />
            <input
              type={showPw ? 'text' : 'password'} required autoComplete="current-password"
              value={pw} onChange={e => setPw(e.target.value)}
              placeholder="비밀번호를 입력하세요"
            />
            <button
              type="button" className="space-login-field-toggle"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
            >
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {error && (
            <div className="space-login-error">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="space-login-submit" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className={`space-login-notice${REMOTE_DEMO_BLOCKED ? ' is-blocked' : ''}`}>
          {REMOTE_DEMO_BLOCKED
            ? '외부 주소에서는 관리자 데모 자동 로그인이 차단됩니다. 실제 운영은 /api/auth/login 인증 백엔드를 연결한 뒤 사용하세요.'
            : '운영 로그인은 /api/auth/login 인증 백엔드 연결 후 사용합니다. 로컬 데모는 localhost에서만 자동으로 열립니다.'}
        </div>
      </div>
    </div>
  );
}
