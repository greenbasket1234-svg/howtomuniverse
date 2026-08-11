import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

// 앱 셸 전체(사이드바 포함) 수준의 치명적 오류를 잡습니다.
// 여기서 오류가 나면 사이드바까지 같이 무너진 상태이므로,
// 사이드바 UI에 의존하지 않는 최소한의 안내만 보여줍니다.
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Phase 1 placeholder — 실제 환경에서는 로깅 서비스로 전송합니다.
    console.error('[AppErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" style={{ maxWidth: 480, margin: '80px auto' }}>
          <h2>화면을 불러오지 못했습니다.</h2>
          <p>앱을 다시 불러오거나 대시보드로 이동해 주세요.</p>
          <div className="error-boundary-actions">
            <button className="btn" onClick={() => window.location.reload()}>
              새로고침
            </button>
            <a className="btn btn-primary" href="/dashboard">
              대시보드로 이동
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
