import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

type FilterContextValue = {
  filterValue: string;
  setFilter: (v: string) => void;
  clearFilter: () => void;
};

const FilterContext = createContext<FilterContextValue>({
  filterValue: '',
  setFilter: () => {},
  clearFilter: () => {},
});

export function AdvertiserFilterProvider({ children }: { children: ReactNode }) {
  const [filterValue, setFilterValue] = useState(() => {
    try { return localStorage.getItem('adcc-global-advertiser-search') ?? ''; } catch { return ''; }
  });
  const setFilter = useCallback((v: string) => {
    const next = v.trim();
    setFilterValue(next);
    try { localStorage.setItem('adcc-global-advertiser-search', next); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('adcc:advertiser-filter-changed', { detail: next }));
  }, []);
  const clearFilter = useCallback(() => {
    setFilterValue('');
    try { localStorage.removeItem('adcc-global-advertiser-search'); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('adcc:advertiser-filter-changed', { detail: '' }));
  }, []);

  useEffect(() => {
    const sync = (event: Event) => setFilterValue((event as CustomEvent<string>).detail ?? '');
    window.addEventListener('adcc:advertiser-filter-changed', sync);
    return () => window.removeEventListener('adcc:advertiser-filter-changed', sync);
  }, []);

  return (
    <FilterContext.Provider value={{ filterValue, setFilter, clearFilter }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useAdvertiserFilter() {
  return useContext(FilterContext);
}
