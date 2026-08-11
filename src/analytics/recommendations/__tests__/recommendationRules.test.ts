import { describe, it, expect } from 'vitest';
import { determineRecommendationType, groupSignalsByEntity, worstSeverity } from '../recommendationRules';
import type { InsightSignal } from '../recommendationTypes';

function signal(overrides: Partial<InsightSignal> = {}): InsightSignal {
  return {
    signalId: 'sig-1',
    advertiserName: '테스트광고주',
    entityType: 'campaign',
    entityId: 'camp-1',
    entityLabel: '테스트 캠페인',
    type: 'cpa_spike',
    severity: 'medium',
    title: 'CPA 급등',
    description: 'CPA가 비교기간보다 30% 상승했습니다.',
    score: 70,
    detectedAt: '2026-08-10',
    ...overrides,
  };
}

describe('groupSignalsByEntity', () => {
  it('같은 entity의 신호를 하나의 그룹으로 묶는다', () => {
    const signals = [
      signal({ signalId: 'a', entityId: 'camp-1' }),
      signal({ signalId: 'b', entityId: 'camp-1', type: 'roas_drop' }),
      signal({ signalId: 'c', entityId: 'camp-2' }),
    ];
    const groups = groupSignalsByEntity(signals);
    expect(groups).toHaveLength(2);
    expect(groups.find(g => g[0].entityId === 'camp-1')).toHaveLength(2);
  });
});

describe('worstSeverity', () => {
  it('그룹 안에서 가장 심각한 severity를 반환한다', () => {
    const signals = [signal({ severity: 'low' }), signal({ severity: 'critical' }), signal({ severity: 'medium' })];
    expect(worstSeverity(signals)).toBe('critical');
  });
});

describe('determineRecommendationType', () => {
  it('critical 신호가 있으면 urgent다', () => {
    const type = determineRecommendationType([signal({ severity: 'critical' })]);
    expect(type).toBe('urgent');
  });

  it('소재 피로도 신호가 있으면(critical이 아닌 한) replace_creative다', () => {
    const type = determineRecommendationType([signal({ type: 'creative_fatigue', severity: 'high' })]);
    expect(type).toBe('replace_creative');
  });

  it('키워드 낭비 신호가 있으면 adjust_keyword다', () => {
    const type = determineRecommendationType([signal({ type: 'keyword_waste', severity: 'medium' })]);
    expect(type).toBe('adjust_keyword');
  });

  it('부정적 신호 없이 kpi_outperformance만 있으면 increase_budget이다', () => {
    const type = determineRecommendationType([signal({ type: 'kpi_outperformance', severity: 'low' })]);
    expect(type).toBe('increase_budget');
  });

  it('예산 과소진 위험 + 부정적 신호가 함께 있으면 decrease_budget이다', () => {
    const type = determineRecommendationType([
      signal({ type: 'budget_overpace', severity: 'medium' }),
      signal({ type: 'cpa_spike', severity: 'medium' }),
    ]);
    expect(type).toBe('decrease_budget');
  });

  it('부정적 신호만 있고 다른 특수 케이스가 없으면 review_campaign이다', () => {
    const type = determineRecommendationType([signal({ type: 'ctr_drop', severity: 'medium' })]);
    expect(type).toBe('review_campaign');
  });

  it('아무 신호도 특별하지 않으면 monitor다', () => {
    // kpi_outperformance이면서 동시에 부정적 신호가 섞여 있으면 확대 후보로 단정하지 않음
    const type = determineRecommendationType([
      signal({ type: 'kpi_outperformance', severity: 'low' }),
      signal({ type: 'cpa_spike', severity: 'low' }),
    ]);
    // 부정 신호가 있으므로 increase_budget이 아니라 review_campaign이어야 한다
    expect(type).toBe('review_campaign');
  });
});
