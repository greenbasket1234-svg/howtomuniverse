import type { Recommendation } from './recommendationTypes';

const MAX_PER_ADVERTISER = 6;

/**
 * 캠페인/매체 단위 추천이 이미 있는데 같은 광고주·같은 유형의 "광고주 전체" 추천이
 * 또 있으면, 더 구체적인(campaign/media) 쪽만 남깁니다. 같은 문제를 두 레벨에서
 * 중복해서 보여주지 않기 위해서입니다.
 */
export function dedupeRecommendations(recommendations: Recommendation[]): Recommendation[] {
  const sorted = [...recommendations].sort((a, b) => b.priorityScore - a.priorityScore);

  const hasMoreSpecific = new Set<string>();
  sorted.forEach(rec => {
    if (rec.targetType === 'campaign' || rec.targetType === 'media') {
      hasMoreSpecific.add(`${rec.advertiserName}:${rec.type}`);
    }
  });

  const deduped = sorted.filter(rec => {
    if (rec.targetType !== 'advertiser') return true;
    return !hasMoreSpecific.has(`${rec.advertiserName}:${rec.type}`);
  });

  const perAdvertiserCount = new Map<string, number>();
  return deduped.filter(rec => {
    const count = perAdvertiserCount.get(rec.advertiserName) ?? 0;
    if (count >= MAX_PER_ADVERTISER) return false;
    perAdvertiserCount.set(rec.advertiserName, count + 1);
    return true;
  });
}
