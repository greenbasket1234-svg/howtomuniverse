import { describe, it, expect } from 'vitest';
import { evaluateConfidence, shouldHoldForMoreData } from '../recommendationConfidence';

describe('evaluateConfidence', () => {
  it('기간이 짧고 표본이 적으면 신뢰도 낮음이다', () => {
    const confidence = evaluateConfidence({ days: 2, sampleSize: 3 });
    expect(confidence.level).toBe('low');
  });

  it('스펙 예시 그대로: 데이터 2일 · 전환 3건은 신뢰도 낮음이다', () => {
    const confidence = evaluateConfidence({ days: 2, sampleSize: 3, sampleUnit: '전환' });
    expect(confidence.level).toBe('low');
    expect(confidence.sampleNote).toBe('데이터 2일 · 전환 3건');
  });

  it('기간과 표본이 중간이면 신뢰도 보통이다', () => {
    const confidence = evaluateConfidence({ days: 7, sampleSize: 15 });
    expect(confidence.level).toBe('medium');
  });

  it('스펙 예시 그대로: 데이터 30일 · 전환 423건은 신뢰도 높음이다', () => {
    const confidence = evaluateConfidence({ days: 30, sampleSize: 423 });
    expect(confidence.level).toBe('high');
  });

  it('기간은 충분해도 표본이 적으면 높음으로 올라가지 않는다', () => {
    const confidence = evaluateConfidence({ days: 30, sampleSize: 4 });
    expect(confidence.level).toBe('low');
  });

  it('표본은 충분해도 기간이 짧으면 높음으로 올라가지 않는다', () => {
    const confidence = evaluateConfidence({ days: 1, sampleSize: 500 });
    expect(confidence.level).toBe('low');
  });
});

describe('shouldHoldForMoreData', () => {
  it('신뢰도 낮음일 때만 true를 반환한다', () => {
    expect(shouldHoldForMoreData(evaluateConfidence({ days: 1, sampleSize: 1 }))).toBe(true);
    expect(shouldHoldForMoreData(evaluateConfidence({ days: 30, sampleSize: 100 }))).toBe(false);
  });
});
