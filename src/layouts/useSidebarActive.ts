import { SidebarMenuItem } from '../types/common';
export function isItemActive(item: SidebarMenuItem, pathname: string): boolean {
  if (item.activeMatch === 'prefix') {
    const base=item.prefixPath ?? item.path;
    return pathname===base || pathname.startsWith(base+'/');
  }
  return pathname===item.path;
}
