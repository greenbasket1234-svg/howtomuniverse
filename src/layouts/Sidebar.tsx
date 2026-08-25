import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, LogOut, Menu, Settings, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { activeUniverseGroup, isUniverseItemActive, universeMenuGroups, type UniverseMenuGroup } from '../data/universeMenu';
import { HowtomUniverseLogo } from '../components/HowtomUniverseLogo';
import { loadMenuVisibility } from '../control/controlStore';
const SIDEBAR_COLLAPSED_KEY = 'howtom-universe-v08-sidebar-collapsed';
const ACTIVE_SECTION_KEY = 'howtom-universe-v08-active-section';

function PlanetIcon({ planet }: { planet: UniverseMenuGroup['planet'] }) {
  return <span className={`universe-planet-icon planet-${planet}`} aria-hidden="true"><i /></span>;
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const { user, logout, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);
  return (
    <div className={`sidebar-footer ${collapsed ? 'collapsed' : ''}`} style={{ position: 'relative' }}>
      <button
        type="button"
        className="sidebar-avatar"
        onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
        aria-label="계정 메뉴"
        aria-expanded={menuOpen}
      >
        {(user?.name || '관').slice(0, 1)}
      </button>
      {!collapsed && (
        <div className="sidebar-footer-copy">
          <div className="sidebar-footer-name">{user?.name || user?.email || '사용자'}</div>
          <div className="sidebar-footer-role">{isAdmin ? '관리자' : '광고주'}</div>
        </div>
      )}
      {menuOpen && (
        <div className="sidebar-footer-menu" onClick={(e) => e.stopPropagation()}>
          <div className="sidebar-footer-menu-name">{user?.name || user?.email || '사용자'} · {isAdmin ? '관리자' : '광고주'}</div>
          <Link to="/settings" className="sidebar-footer-menu-item" onClick={() => setMenuOpen(false)}>
            <Settings size={15} /> 설정
          </Link>
          <button type="button" className="sidebar-footer-menu-item danger" onClick={logout}>
            <LogOut size={15} /> 로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const currentGroup = activeUniverseGroup(pathname);
  // 모바일(좁은 화면)에서는 사이드바 전체를 화면 밖에 숨겨두고, 상단 햄버거 버튼을 눌렀을 때만
  // 오프캔버스 드로어로 슬라이드해 들어오게 합니다. 데스크톱 사이드바를 그냥 축소한 아이콘
  // 레일만으로는(72px) 실제 스마트폰 화면에서 여전히 콘텐츠 폭을 크게 잡아먹기 때문입니다.
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
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

  // 서브메뉴는 닫히는 동안에도 내용을 유지해야 자연스럽게 접힙니다.
  // (바로 언마운트하면 폭이 줄기 전에 글자가 사라져 끊겨 보입니다.)
  const [renderedSection, setRenderedSection] = useState<UniverseMenuGroup | null>(activeSection);
  useEffect(() => {
    if (activeSection) setRenderedSection(activeSection);
  }, [activeSection]);

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
      <header className="mobile-topbar">
        <Link to="/home" className="mobile-topbar-brand" aria-label="HOWTOM 유니버스 통합 홈" onClick={resetToHome}>
          <HowtomUniverseLogo compact />
        </Link>
        <button
          type="button"
          className="mobile-topbar-toggle"
          onClick={() => setMobileOpen(v => !v)}
          aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      {mobileOpen && <div className="mobile-sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
      <aside className={`sidebar universe-sidebar universe-primary-sidebar ${railMode ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
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
                  <span className="universe-group-label">{group.label}</span>
                </button>
              </div>
            );
          })}
        </nav>
        <SidebarFooter collapsed={railMode} />
      </aside>

      {renderedSection && (
        <aside
          className={`universe-secondary-sidebar ${activeSection ? 'is-open' : 'is-closed'} ${mobileOpen ? 'mobile-open' : ''}`}
          aria-label={`${renderedSection.label} 서브메뉴`}
          aria-hidden={activeSection ? undefined : true}
        >
          <div className="universe-secondary-head">
            <button type="button" className="universe-secondary-back" onClick={() => setActiveSectionKey(null)} aria-label="메인 메뉴로 돌아가기">
              <ChevronLeft size={17} />
            </button>
            <span>메뉴</span>
            <strong>{renderedSection.label}</strong>
          </div>
          <nav className="universe-secondary-nav" key={renderedSection.key}>
            {renderedSection.items.map((item, index) => {
              const active = isUniverseItemActive(pathname, item);
              const label = `${item.label}${item.planned ? ' (미구현)' : ''}`;
              // 콘텐츠 제작소처럼 완전히 다른 배포 서비스로 이동하는 항목은 내부 라우팅(Link)이 아니라
              // 새 탭에서 여는 일반 링크로 처리합니다(Link는 이 앱 안에서의 이동만 위한 것입니다).
              if (item.external) {
                return (
                  <a
                    key={item.key}
                    href={item.path}
                    target="_blank"
                    rel="noreferrer"
                    style={{ '--stagger': index } as CSSProperties}
                    className="universe-secondary-item"
                  >
                    {label}
                  </a>
                );
              }
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  style={{ '--stagger': index } as CSSProperties}
                  className={`universe-secondary-item ${active ? 'active' : ''} ${item.planned ? 'planned' : ''}`}
                >
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
