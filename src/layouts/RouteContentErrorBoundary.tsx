import React from 'react';
import { Link, useLocation } from 'react-router-dom';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

class Boundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Phase 1 placeholder — 실제 환경에서는 로깅 서비스로 전송합니다.
    console.error('[RouteContentErrorBoundary]', error, info);
  }

  handleRetry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>페이지를 불러오는 중 문제가 발생했습니다.</h2>
          <p>잠시 후 다시 시도하거나 대시보드로 이동해주세요.</p>
          <div className="error-boundary-actions">
            <button className="btn" onClick={this.handleRetry}>
              다시 시도
            </button>
            <Link className="btn btn-primary" to="/dashboard">
              대시보드로 이동
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// 경로가 바뀌면 key가 바뀌면서 바운더리가 자동으로 리셋됩니다.
// (이전 페이지의 오류 상태가 다음 페이지까지 이어지지 않도록)
export function RouteContentErrorBoundary({ children }: Props) {
  const location = useLocation();
  return <Boundary key={location.pathname}>{children}</Boundary>;
}
