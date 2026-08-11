import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const FILTER_SKIP_SELECTOR = [
  '[data-no-universal-filter]',
  '.monthly-report-page',
  '.next-month-proposal-page',
  '.report-page',
  '.report-export-root',
  '.print-only',
  '.universe-home-dashboard',
].join(',');

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function numericValue(value: string) {
  const cleaned = value.replace(/[₩,%\s]/g, '').replace(/,/g, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function enhanceTable(table: HTMLTableElement) {
  if (table.dataset.universalFilterReady === '1') return;
  if (table.closest(FILTER_SKIP_SELECTOR)) return;
  const body = table.tBodies.item(0);
  const rows = body ? Array.from(body.rows) : [];
  if (!body || rows.length < 2) return;

  table.dataset.universalFilterReady = '1';
  const headers = Array.from(table.tHead?.rows.item(0)?.cells ?? []).map((cell, index) => normalize(cell.textContent || '') || `${index + 1}열`);
  const wrapper = table.closest('.table-scroll') ?? table;
  const bar = document.createElement('div');
  bar.className = 'universal-table-filter-bar';
  bar.innerHTML = `
    <div class="universal-table-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="표 내용 검색" aria-label="표 내용 검색"></div>
    <select class="universal-table-column" aria-label="검색 열"><option value="-1">전체 항목</option>${headers.map((label, index) => `<option value="${index}">${label}</option>`).join('')}</select>
    <select class="universal-table-value" aria-label="필터 값"><option value="">필터값 전체</option></select>
    <select class="universal-table-sort" aria-label="정렬"><option value="none">기본 순서</option><option value="asc">오름차순</option><option value="desc">내림차순</option></select>
    <button type="button" class="btn secondary sm universal-table-reset">초기화</button>
    <span class="universal-table-count"></span>`;
  wrapper.parentElement?.insertBefore(bar, wrapper);

  const queryInput = bar.querySelector<HTMLInputElement>('.universal-table-search input')!;
  const columnSelect = bar.querySelector<HTMLSelectElement>('.universal-table-column')!;
  const valueSelect = bar.querySelector<HTMLSelectElement>('.universal-table-value')!;
  const sortSelect = bar.querySelector<HTMLSelectElement>('.universal-table-sort')!;
  const resetButton = bar.querySelector<HTMLButtonElement>('.universal-table-reset')!;
  const count = bar.querySelector<HTMLElement>('.universal-table-count')!;
  const originalRows = rows.slice();

  const getRows = () => Array.from(body.rows);
  const updateValues = () => {
    const column = Number(columnSelect.value);
    const source = originalRows.filter(row => row.isConnected);
    const values = Array.from(new Set(source.map(row => normalize(row.cells.item(column)?.textContent || '')).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));
    const selected = valueSelect.value;
    valueSelect.innerHTML = `<option value="">필터값 전체</option>${column >= 0 ? values.map(value => `<option value="${value.replace(/"/g, '&quot;')}">${value}</option>`).join('') : ''}`;
    valueSelect.disabled = column < 0;
    if (values.includes(selected)) valueSelect.value = selected;
  };

  const apply = () => {
    const query = normalize(queryInput.value).toLocaleLowerCase('ko');
    const column = Number(columnSelect.value);
    const selectedValue = valueSelect.value;
    const direction = sortSelect.value;
    let visible = originalRows.filter(row => row.isConnected).filter(row => {
      const cells = Array.from(row.cells).map(cell => normalize(cell.textContent || ''));
      const queryTarget = column >= 0 ? cells[column] || '' : cells.join(' ');
      const matchesQuery = !query || queryTarget.toLocaleLowerCase('ko').includes(query);
      const matchesValue = !selectedValue || (column >= 0 && (cells[column] || '') === selectedValue);
      return matchesQuery && matchesValue;
    });

    if (direction !== 'none') {
      const sortColumn = column >= 0 ? column : 0;
      visible = visible.slice().sort((a, b) => {
        const av = normalize(a.cells.item(sortColumn)?.textContent || '');
        const bv = normalize(b.cells.item(sortColumn)?.textContent || '');
        const an = numericValue(av);
        const bn = numericValue(bv);
        const result = an !== null && bn !== null ? an - bn : av.localeCompare(bv, 'ko', { numeric: true });
        return direction === 'asc' ? result : -result;
      });
    }

    originalRows.forEach(row => { row.hidden = true; });
    visible.forEach(row => { row.hidden = false; body.appendChild(row); });
    originalRows.filter(row => !visible.includes(row)).forEach(row => body.appendChild(row));
    count.textContent = `${visible.length.toLocaleString()}개 표시 / 전체 ${originalRows.length.toLocaleString()}개`;
  };

  queryInput.addEventListener('input', apply);
  columnSelect.addEventListener('change', () => { updateValues(); valueSelect.value = ''; apply(); });
  valueSelect.addEventListener('change', apply);
  sortSelect.addEventListener('change', apply);
  resetButton.addEventListener('click', () => {
    queryInput.value = '';
    columnSelect.value = '-1';
    valueSelect.value = '';
    sortSelect.value = 'none';
    originalRows.forEach(row => { row.hidden = false; body.appendChild(row); });
    updateValues();
    apply();
  });
  updateValues();
  apply();
}

function scanTables() {
  document.querySelectorAll<HTMLTableElement>('.page-content table').forEach(enhanceTable);
}

export function UniversalTableFilterEnhancer() {
  const { pathname } = useLocation();
  useEffect(() => {
    const timer = window.setTimeout(scanTables, 80);
    const observer = new MutationObserver(() => window.setTimeout(scanTables, 30));
    const root = document.querySelector('.page-content');
    if (root) observer.observe(root, { childList: true, subtree: true });
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [pathname]);
  return null;
}
