import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { shouldShowFilterBar } from '../data/sidebarMenuItems';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { useAuth } from '../context/AuthContext';

export function OptionalTopFilterBar() {
  const { pathname }                        = useLocation();
  const [advertisers]                       = useAdvertisers();
  const { filterValue, setFilter, clearFilter } = useAdvertiserFilter();
  const { user, isAdmin }                   = useAuth();

  const knownAdvertisers = useMemo(
    () => advertisers.map(a => a.name).sort((a, b) => a.localeCompare(b, 'ko')),
    [advertisers],
  );

  if (!shouldShowFilterBar(pathname)) return null;

  // 광고주 계정: 본인 광고주명만 표시, 드롭다운·검색 없음
  if (!isAdmin && user?.isAdvertiserAccount) {
    // knownAdvertisers는 이 계정이 볼 수 있는 광고주 목록 — 광고주 계정은 1개
    const advertiserName = knownAdvertisers[0] || filterValue || '';
    if (!advertiserName) return null; // 로딩 중이면 표시 안 함

    // localStorage에 다른 광고주 이름이 남아 있으면 본인 이름으로 교정합니다.
    // (관리자가 다른 광고주 선택 후 로그아웃 → 이 계정 로그인 시 잘못된 filterValue 유지 방지)
    if (filterValue !== advertiserName) {
      setFilter(advertiserName);
    }

    return (
      <div className="global-advertiser-filter">
        <div className="global-advertiser-filter-main">
          <div className="global-advertiser-locked-label">
            <span className="global-advertiser-locked-name">{advertiserName}</span>
          </div>
        </div>
      </div>
    );
  }

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
