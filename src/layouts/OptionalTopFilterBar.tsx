import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { shouldShowFilterBar } from '../data/sidebarMenuItems';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';

export function OptionalTopFilterBar() {
  const { pathname }                        = useLocation();
  const [advertisers]                       = useAdvertisers();
  const { filterValue, setFilter, clearFilter } = useAdvertiserFilter();

  const knownAdvertisers = useMemo(
    () => advertisers.map(a => a.name).sort((a, b) => a.localeCompare(b, 'ko')),
    [advertisers],
  );

  if (!shouldShowFilterBar(pathname)) return null;

  return (
    <div className="global-advertiser-filter">
      <div className="global-advertiser-filter-main">
        <div className="global-advertiser-search">
          <Search size={16} />
          <input
            placeholder="광고주 이름 검색"
            list="global-advertiser-options"
            value={filterValue}
            onChange={e => setFilter(e.target.value)}
          />
          {filterValue && (
            <button
              type="button"
              className="global-filter-clear"
              onClick={clearFilter}
              aria-label="광고주 필터 해제"
            >
              <X size={14} />
            </button>
          )}
          <datalist id="global-advertiser-options">
            {knownAdvertisers.map(name => <option key={name} value={name} />)}
          </datalist>
        </div>

        <select
          className="global-advertiser-select"
          value={knownAdvertisers.includes(filterValue) ? filterValue : ''}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="">광고주 목록</option>
          {knownAdvertisers.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

    </div>
  );
}
