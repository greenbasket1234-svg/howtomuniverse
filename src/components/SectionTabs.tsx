import { NavLink } from 'react-router-dom';

export type SectionTab = { label: string; to: string; end?: boolean };

export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  return (
    <div className="section-tabs" role="tablist" aria-label="하위 메뉴">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `section-tab${isActive ? ' active' : ''}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
