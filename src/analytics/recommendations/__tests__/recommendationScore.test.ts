import { describe, it, expect } from 'vitest';
import { calculatePriorityScore, priorityLabel } from '../recommendationScore';
import { evaluateConfidence } from '../recommendationConfidence';

const highConfidence = evaluateConfidence({ days: 30, sampleSize: 200 });
const lowConfidence = evaluateConfidence({ days: 1, sampleSize: 1 });

describe('calculatePriorityScore', () => {
  it('스펙 예시: 월 3천만원 쓰는 광고주의 심각도가 하루 5천원짜리보다 우선순위가 높다', () => {
    const bigSpender = calculatePriorityScore({ severityScore: 60, periodSpend: 30_000_000, confidence: highConfidence });
    const tinySpender = calculatePriorityScore({ severityScore: 60, periodSpend: 5_000, confidence: highConfidence });
    expect(bigSpender).toBeGreaterThan(tinySpender);
  });

  it('신뢰도가 낮으면 같은 심각도라도 점수가 깎인다', () => {
    const withHighConfidence = calculatePriorityScore({ severityScore: 80, periodSpend: 1_000_000, confidence: highConfidence });
    const withLowConfidence = calculatePriorityScore({ severityScore: 80, periodSpend: 1_000_000, confidence: lowConfidence });
    expect(withLowConfidence).toBeLessThan(withHighConfidence);
  });

  it('점수는 0~100 범위를 벗어나지 않는다', () => {
    const score = calculatePriorityScore({ severityScore: 100, periodSpend: 100_000_000, confidence: highConfidence });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('priorityLabel', () => {
  it('점수 구간에 따라 긴급/높음/보통/낮음으로 분류한다', () => {
    expect(priorityLabel(90)).toBe('긴급');
    expect(priorityLabel(65)).toBe('높음');
    expect(priorityLabel(40)).toBe('보통');
    expect(priorityLabel(10)).toBe('낮음');
  });
});
