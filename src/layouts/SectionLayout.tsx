import { Outlet } from 'react-router-dom';
import { SectionTabs, type SectionTab } from '../components/SectionTabs';

export function SectionLayout({ tabs }: { tabs: SectionTab[] }) {
  return (
    <div>
      <SectionTabs tabs={tabs} />
      <Outlet />
    </div>
  );
}
