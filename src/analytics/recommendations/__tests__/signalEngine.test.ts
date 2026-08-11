import { describe, it, expect } from 'vitest';
import { signalsFromKeywords } from '../signalEngine';
import type { KeywordAnalysisRow } from '../../../data/keywordAnalysisMock';

function keyword(overrides: Partial<KeywordAnalysisRow> = {}): KeywordAnalysisRow {
  return {
    id: 'kw-1',
    platform: '네이버',
    keyword: '테스트 키워드',
    campaign: '테스트 캠페인',
    adGroup: '테스트 그룹',
    impressions: 1000,
    clicks: 50,
    spend: 50_000,
    conversions: 0,
    grade: 'stable',
    status: 'active',
    ...overrides,
  };
}

describe('signalsFromKeywords', () => {
  it('전환 없이 일정 금액 이상 소진한 키워드는 고비용 무전환 신호를 만든다', () => {
    const signals = signalsFromKeywords([keyword({ spend: 80_000, conversions: 0 })], '테스트광고주', '2026-08-10');
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('keyword_waste');
  });

  it('전환이 있으면 신호를 만들지 않는다', () => {
    const signals = signalsFromKeywords([keyword({ spend: 80_000, conversions: 3 })], '테스트광고주', '2026-08-10');
    expect(signals).toHaveLength(0);
  });

  it('소진액이 임계값보다 낮으면 신호를 만들지 않는다', () => {
    const signals = signalsFromKeywords([keyword({ spend: 5_000, conversions: 0 })], '테스트광고주', '2026-08-10');
    expect(signals).toHaveLength(0);
  });

  it('일시중지된 키워드는 무시한다', () => {
    const signals = signalsFromKeywords([keyword({ spend: 80_000, conversions: 0, status: 'paused' })], '테스트광고주', '2026-08-10');
    expect(signals).toHaveLength(0);
  });
});
