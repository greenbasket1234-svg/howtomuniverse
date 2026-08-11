import { describe, it, expect } from 'vitest';
import { patternConfidence } from '../creativePatternAnalysis';

describe('patternConfidence', () => {
  it('표본 수가 2개 이하면 "판단 보류"다', () => {
    expect(patternConfidence(0)).toBe('판단 보류');
    expect(patternConfidence(2)).toBe('판단 보류');
  });

  it('표본 수가 3~5개면 "참고"다', () => {
    expect(patternConfidence(3)).toBe('참고');
    expect(patternConfidence(5)).toBe('참고');
  });

  it('표본 수가 6~10개면 "보통"이다', () => {
    expect(patternConfidence(6)).toBe('보통');
    expect(patternConfidence(10)).toBe('보통');
  });

  it('표본 수가 11개 이상이면 "높음"이다', () => {
    expect(patternConfidence(11)).toBe('높음');
    expect(patternConfidence(100)).toBe('높음');
  });
});
