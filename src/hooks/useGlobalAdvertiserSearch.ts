/**
 * useGlobalAdvertiserSearch
 *
 * 기존 코드 호환성을 위해 string을 반환합니다.
 * 내부적으로 AdvertiserFilterContext를 사용합니다.
 */
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';

export function useGlobalAdvertiserSearch(): string {
  const { filterValue } = useAdvertiserFilter();
  return filterValue;
}

/** @deprecated Context의 setFilter를 직접 사용하세요 */
export function getGlobalAdvertiserSearch(): string {
  try { return localStorage.getItem('adcc-global-advertiser-search') ?? ''; } catch { return ''; }
}

/** @deprecated Context의 setFilter를 직접 사용하세요 */
export function setGlobalAdvertiserSearch(_value: string): void {
  /* Context 기반으로 이전됨 */
}
