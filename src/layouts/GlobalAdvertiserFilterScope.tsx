import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { ADVERTISERS as OPERATIONS_ADVERTISERS } from '../data/operationsMock';
import { BRAND_REPORTS } from '../data/brandReports';

/**
 * ⚠️ 이 컴포넌트는 "보조 안전장치"입니다. 주 필터링 방식이 아닙니다.
 *
 * 원래 이 컴포넌트가 유일한 필터링 수단이었을 때는(DOM에서 textContent를 읽어
 * display:none 처리) 카드 합계·차트·다운로드·PDF·Google Sheets 전송 데이터가
 * 화면에 보이는 표와 다르게 나갈 수 있다는 구조적 문제가 있었습니다.
 *
 * 지금은 각 페이지(대시보드, 보고서, 운영 관리 등)가 useAdvertiserFilter()를
 * 직접 구독해서 데이터 레벨에서 필터링합니다(src/utils/advertiserMatch.ts 참고).
 * 즉, 화면에 보이는 표/카드/다운로드 파일이 전부 같은 필터링된 데이터에서 나옵니다.
 *
 * 이 컴포넌트는 아직 데이터 레벨 필터를 연결하지 못한 극히 일부의 레거시 화면
 * (예: 아직 리팩터링되지 않은 정적 mock 목록)에 대한 최후의 시각적 보정 역할만
 * 합니다. 새 페이지를 만들 때 이 컴포넌트에 의존하지 말고, 반드시
 * useAdvertiserFilter() + matchesAdvertiserFilter()로 데이터를 직접 필터링하세요.
 */
const TARGET_SELECTOR = [
  '.generated-report-item',
  '.brand-card',
  '.brand-list-card',
  '.dashboard-brand-card',
  '.share-link-item',
  '[data-advertiser-name]',
].join(',');

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function GlobalAdvertiserFilterScope() {
  const { pathname } = useLocation();
  const { filterValue } = useAdvertiserFilter();
  const [advertisers] = useAdvertisers();

  useEffect(() => {
    const selected = normalize(filterValue);
    const knownNames = Array.from(new Set([
      ...advertisers.map(item => item.name),
      ...OPERATIONS_ADVERTISERS.map(a => a.name),
      ...OPERATIONS_ADVERTISERS.map(a => a.name.replace(/몰$/, '')),
      ...BRAND_REPORTS.map(r => r.config.brandName),
    ].filter(Boolean)));

    const apply = () => {
      const root = document.querySelector('.page-content');
      if (!root) return;

      root.querySelectorAll('.adcc-hidden-by-advertiser-filter').forEach(element => {
        element.classList.remove('adcc-hidden-by-advertiser-filter');
      });

      if (!selected) return;

      root.querySelectorAll<HTMLElement>(TARGET_SELECTOR).forEach(element => {
        if (element.closest('.global-advertiser-filter')) return;
        const text = normalize(element.dataset.advertiserName || element.textContent || '');
        const containsKnownAdvertiser = knownNames.some(name => text.includes(normalize(name)));
        if (containsKnownAdvertiser && !text.includes(selected)) {
          element.classList.add('adcc-hidden-by-advertiser-filter');
        }
      });
    };

    const runTimer = window.setTimeout(apply, 0);
    const root = document.querySelector('.page-content');
    const observer = root
      ? new MutationObserver(() => {
          window.requestAnimationFrame(apply);
        })
      : null;
    if (root && observer) observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      window.clearTimeout(runTimer);
      observer?.disconnect();
      document.querySelectorAll('.adcc-hidden-by-advertiser-filter').forEach(element => {
        element.classList.remove('adcc-hidden-by-advertiser-filter');
      });
    };
  }, [filterValue, advertisers, pathname]);

  return null;
}
