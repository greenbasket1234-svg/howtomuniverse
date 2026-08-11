/**
 * 광고주 필터 부분 검색 유틸리티
 *
 * 이전에는 페이지마다 `row.advertiser === filterValue` 처럼
 * "정확히 일치"하는 조건으로 필터링하는 곳이 많았습니다.
 * 상단 검색창에 "서울"만 입력해도 "서울우리아이치과"가 걸러지는 게
 * 사용자에게 자연스러운 동작이므로, 부분 검색(포함) 기준으로 통일합니다.
 *
 * 광고주를 "선택"(드롭다운 등)하는 경우는 정확히 일치가 맞으므로
 * 그 경우엔 그대로 두고, "검색 입력값으로 필터링"하는 로직에서는
 * 이 함수를 사용합니다.
 */
export function normalizeAdvertiserName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

/** name(행의 광고주명)이 filterValue(검색어)에 부분 일치하는지 확인합니다. */
export function matchesAdvertiserFilter(name: string | undefined | null, filterValue: string): boolean {
  if (!filterValue.trim()) return true; // 필터가 비어 있으면 전체 표시
  if (!name) return false;
  return normalizeAdvertiserName(name).includes(normalizeAdvertiserName(filterValue));
}

/** 배열을 광고주 필터 기준으로 걸러줍니다. getName으로 각 항목의 광고주명을 뽑아냅니다. */
export function filterByAdvertiser<T>(
  items: T[],
  filterValue: string,
  getName: (item: T) => string | undefined | null,
): T[] {
  if (!filterValue.trim()) return items;
  return items.filter(item => matchesAdvertiserFilter(getName(item), filterValue));
}
