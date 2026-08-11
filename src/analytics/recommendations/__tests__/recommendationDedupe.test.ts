import { describe, it, expect } from 'vitest';
import { dedupeRecommendations } from '../recommendationDedupe';
import type { Recommendation } from '../recommendationTypes';

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    recommendationId: `rec-${Math.random()}`,
    advertiserName: '테스트광고주',
    targetType: 'campaign',
    targetId: 'camp-1',
    targetLabel: '테스트 캠페인',
    type: 'review_campaign',
    title: '캠페인 점검 필요',
    summary: '타겟·소재·입찰 구조를 먼저 점검하세요.',
    priorityScore: 60,
    priorityLabel: '높음',
    confidence: { level: 'high', label: '신뢰도 높음', reason: '', sampleNote: '' },
    signalIds: [],
    metrics: [],
    evidence: [],
    suggestedActions: [],
    insufficientData: false,
    createdAt: '2026-08-10',
    ...overrides,
  };
}

describe('dedupeRecommendations', () => {
  it('같은 광고주·같은 type의 campaign 레벨 추천이 있으면 advertiser 레벨 추천은 제거한다', () => {
    const campaignLevel = recommendation({ targetType: 'campaign', targetId: 'camp-1', priorityScore: 70 });
    const advertiserLevel = recommendation({ targetType: 'advertiser', targetId: '테스트광고주', priorityScore: 50 });
    const result = dedupeRecommendations([campaignLevel, advertiserLevel]);
    expect(result).toHaveLength(1);
    expect(result[0].targetType).toBe('campaign');
  });

  it('type이 다르면 advertiser 레벨 추천을 제거하지 않는다', () => {
    const campaignLevel = recommendation({ targetType: 'campaign', type: 'replace_creative' });
    const advertiserLevel = recommendation({ targetType: 'advertiser', targetId: '테스트광고주', type: 'review_campaign' });
    const result = dedupeRecommendations([campaignLevel, advertiserLevel]);
    expect(result).toHaveLength(2);
  });

  it('광고주당 추천 개수를 상한선 이하로 제한하고 우선순위 높은 것부터 남긴다', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      recommendation({ targetType: 'campaign', targetId: `camp-${i}`, priorityScore: 100 - i }),
    );
    const result = dedupeRecommendations(many);
    expect(result.length).toBeLessThan(10);
    expect(result[0].priorityScore).toBe(100);
  });

  it('결과는 우선순위 점수 내림차순으로 정렬된다', () => {
    const low = recommendation({ targetId: 'camp-low', priorityScore: 20 });
    const high = recommendation({ targetId: 'camp-high', priorityScore: 90 });
    const result = dedupeRecommendations([low, high]);
    expect(result[0].priorityScore).toBe(90);
    expect(result[1].priorityScore).toBe(20);
  });
});
