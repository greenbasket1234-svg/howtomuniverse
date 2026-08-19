import { useMemo, useState } from 'react';

/**
 * 테이블 항목명(헤더)을 클릭하면 그 기준으로 정렬되는 공용 훅입니다.
 * 여러 화면(캠페인 관리, 소재 분석, 통합 성과 분석 등)에서 똑같은 방식으로 재사용합니다.
 *
 * 사용 예:
 *   const { sorted, sortKey, sortDir, toggleSort, arrow } = useSortableRows(rows, 'spend', (row, key) => row[key]);
 *   <th onClick={()=>toggleSort('spend')} className="sortable-th">광고비{arrow('spend')}</th>
 */
export function useSortableRows<T>(
  rows: T[],
  defaultKey: string,
  getValue: (row: T, key: string) => number | string,
  defaultDir: 'asc' | 'desc' = 'desc',
) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      if (typeof av === 'string' || typeof bv === 'string') {
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const arrow = (key: string) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return { sorted, sortKey, sortDir, toggleSort, arrow };
}
