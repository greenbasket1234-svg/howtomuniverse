import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { activeUniverseGroup, isUniverseItemActive, universeMenuGroups, type UniverseMenuGroup } from '../data/universeMenu';
import { HowtomUniverseLogo } from '../components/HowtomUniverseLogo';
import { loadMenuVisibility } from '../control/controlStore';
import { DEMO_MODE } from '../config/runtime';
const SIDEBAR_COLLAPSED_KEY = 'howtom-universe-v08-sidebar-collapsed';
const ACTIVE_SECTION_KEY = 'howtom-universe-v08-active-section';

function PlanetIcon({ planet }: { planet: UniverseMenuGroup['planet'] }) {
  return <span className={`universe-planet-icon planet-${planet}`} aria-hidden="true"><i /></span>;
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const { user, logout, isAdmin } = useAuth();
  return (
    <div className={`sidebar-footer ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-avatar">{(user?.name || '관').slice(0, 1)}</div>
      {!collapsed && (
        <div className="sidebar-footer-copy">
          <div className="sidebar-footer-name">{user?.name || user?.email || '사용자'}</div>
          <div className="sidebar-footer-role">{isAdmin ? '관리자' : '광고주'}{DEMO_MODE ? ' · 데모 모드' : ''}</div>
          {!DEMO_MODE && (
            <button type="button" className="sidebar-footer-logout" onClick={logout}>
              <LogOut size={15} /> 로그아웃
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const currentGroup = activeUniverseGroup(pathname);
  // 관리자 > 메뉴 노출 설정을 실제로 반영합니다. 라우트 자체는 지우지 않고 사이드바
  // 목록에서만 숨기는 방식이라(관리자 설정 화면 설명과 동일한 원칙), 관리자가 직접 주소로
  // 들어가면 여전히 화면은 열립니다 - 이건 "노출 정책"이지 "접근 차단"이 아니기 때문입니다.
  const [menuRevision, setMenuRevision] = useState(0);
  useEffect(() => {
    const bump = () => setMenuRevision(v => v + 1);
    window.addEventListener('howtom:control-changed', bump);
    return () => window.removeEventListener('howtom:control-changed', bump);
  }, []);
  const menuVisibility = useMemo(() => loadMenuVisibility(), [menuRevision]);
  const groups = useMemo(
    () => universeMenuGroups
      .filter(group => !group.adminOnly || isAdmin)
      // 설정 메뉴는 관리자 메뉴 노출 화면 설명대로 "메인 메뉴 마지막 유지" 대상이라 항상 보여줍니다.
      .filter(group => group.label === '설정' || menuVisibility[group.label] !== false),
    [isAdmin, menuVisibility],
  );

  const [manualCollapsed, setManualCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'; }
    catch { return false; }
  });
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(() => {
    try {
      const saved = sessionStorage.getItem(ACTIVE_SECTION_KEY);
      return saved && groups.some(group => group.key === saved) ? saved : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (pathname !== '/home') return;
    setActiveSectionKey(null);
    setManualCollapsed(false);
    try {
      sessionStorage.removeItem(ACTIVE_SECTION_KEY);
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
    } catch { /* ignore */ }
  }, [pathname]);

  const activeSection = groups.find(group => group.key === activeSectionKey) ?? null;
  const railMode = manualCollapsed || Boolean(activeSection);

  const selectMainMenu = (group: UniverseMenuGroup) => {
    setActiveSectionKey(group.key);
    setManualCollapsed(false);
    try {
      sessionStorage.setItem(ACTIVE_SECTION_KEY, group.key);
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
    } catch { /* ignore */ }
  };

  const toggleMainSidebar = () => {
    if (activeSection) {
      setActiveSectionKey(null);
      setManualCollapsed(false);
      try {
        sessionStorage.removeItem(ACTIVE_SECTION_KEY);
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
      } catch { /* ignore */ }
      return;
    }
    setManualCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const resetToHome = () => {
    setActiveSectionKey(null);
    setManualCollapsed(false);
    try {
      sessionStorage.removeItem(ACTIVE_SECTION_KEY);
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
    } catch { /* ignore */ }
  };

  return (
    <Fragment>
      <aside className={`sidebar universe-sidebar universe-primary-sidebar ${railMode ? 'is-collapsed' : ''}`}>
        <div className="universe-brand-row">
          <Link to="/home" className="universe-brand universe-brand-css-link" aria-label="HOWTOM 유니버스 통합 홈" onClick={resetToHome}>
            <HowtomUniverseLogo compact={railMode} />
          </Link>
          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={toggleMainSidebar}
            aria-label={railMode ? '메인메뉴 펼치기' : '메인메뉴 접기'}
            title={railMode ? '메인메뉴 펼치기' : '메인메뉴 접기'}
          >
            {railMode ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav universe-main-nav">
          {groups.map(group => {
            const isActiveGroup = currentGroup === group.key || activeSectionKey === group.key;
            return (
              <div key={group.key} className={`universe-menu-group ${isActiveGroup ? 'active-group' : ''}`}>
                <button
                  type="button"
                  className={`universe-group-button ${isActiveGroup ? 'active' : ''}`}
                  onClick={() => selectMainMenu(group)}
                  title={railMode ? group.label : undefined}
                  aria-pressed={activeSectionKey === group.key}
                >
                  <PlanetIcon planet={group.planet} />
                  {!railMode && <span className="universe-group-label">{group.label}</span>}
                </button>
              </div>
            );
          })}
        </nav>
        <SidebarFooter collapsed={railMode} />
      </aside>

      {activeSection && (
        <aside className="universe-secondary-sidebar" aria-label={`${activeSection.label} 서브메뉴`}>
          <div className="universe-secondary-head">
            <span>메뉴</span>
            <strong>{activeSection.label}</strong>
          </div>
          <nav className="universe-secondary-nav">
            {activeSection.items.map(item => {
              const active = isUniverseItemActive(pathname, item);
              const label = `${item.label}${item.planned ? ' (미구현)' : ''}`;
              return (
                <Link key={item.key} to={item.path} className={`universe-secondary-item ${active ? 'active' : ''} ${item.planned ? 'planned' : ''}`}>
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
      )}
    </Fragment>
  );
}
