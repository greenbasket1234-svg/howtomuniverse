import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { OptionalTopFilterBar } from './OptionalTopFilterBar';
import { RouteContentErrorBoundary } from './RouteContentErrorBoundary';
import { GlobalActionModal } from '../components/GlobalActionModal';
import { GlobalAdvertiserFilterScope } from './GlobalAdvertiserFilterScope';
import { UniversalTableFilterEnhancer } from '../components/UniversalTableFilterEnhancer';

// AppErrorBoundary
//  └─ AppLayout            ← 이 컴포넌트
//      ├─ Sidebar
//      └─ MainArea
//          ├─ OptionalTopFilterBar
//          └─ PageContent
//              └─ RouteContentErrorBoundary
//                  └─ Outlet
export function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <OptionalTopFilterBar />
        <GlobalAdvertiserFilterScope />
        <div className="page-content">
          <RouteContentErrorBoundary>
            <Outlet />
          </RouteContentErrorBoundary>
        </div>
      </div>
      <UniversalTableFilterEnhancer />
      <GlobalActionModal />
    </div>
  );
}
