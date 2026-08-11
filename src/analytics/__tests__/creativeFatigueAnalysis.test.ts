import { describe, it, expect } from 'vitest';
import { calculateCreativeFatigue, classifyCreativeLifecycle } from '../creativeFatigueAnalysis';
import type { CreativeAnalysisRow } from '../creativeAnalysis';
import type { Creative } from '../../data/creativeLibrary';
import type { CreativePerformanceSampleRow } from '../../data/creativePerformance';

function creative(overrides: Partial<Creative> = {}): Creative {
  return {
    id: 'cr-test', name: '테스트 소재', brand: '테스트브랜드', platform: '메타',
    type: '이미지', objective: '트래픽', thumb: '🧪', copy: '테스트 카피',
    status: '보통', liveStatus: '노출중', fatigue: '정상', tags: [],
    spend: 10000, uses: 1, date: '2026-08-01',
    ...overrides,
  };
}

function performance(overrides: Partial<CreativePerformanceSampleRow> = {}): CreativePerformanceSampleRow {
  return {
    id: 'perf-test', name: '테스트 소재', advertiser: '테스트브랜드', campaign: '테스트캠페인',
    media: '메타', spend: 10000, impressions: 10000, clicks: 100,
    status: '라이브', days: 5, health: 0, trend: [50, 55, 52, 58],
    ...overrides,
  };
}

function row(overrides: Partial<CreativeAnalysisRow> = {}): CreativeAnalysisRow {
  return {
    creative: creative(),
    performance: performance(),
    dbRows: [],
    campaignName: '테스트캠페인',
    spend: 10000, impressions: 10000, clicks: 100, ctr: 1, cpc: 100, cpm: 10,
    db: 5, validDb: 4, contracts: 1, revenue: 0, cvr: 5, cpa: 2000,
    validDbRate: 80, contractRate: 20, roas: 0,
    hookTypes: [], cta: '',
    fatigueScore: 20, fatigueLevel: '정상', lifecycle: '성장',
    score: 70, analysisStatus: '정상', kpiLabel: 'CPA',
    peerKey: 'meta', peerCount: 1,
    hasPerformance: true, hasDb: true, dataNotes: [],
    ...overrides,
  };
}

describe('calculateCreativeFatigue', () => {
  it('fatigueScore가 없으면 "평가 보류"로 분류하고 이유를 설명한다', () => {
    const result = calculateCreativeFatigue(row({ fatigueScore: undefined }));
    expect(result.level).toBe('평가 보류');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('점수 구간에 따라 낮음/보통/높음/매우 높음으로 분류한다', () => {
    expect(calculateCreativeFatigue(row({ fatigueScore: 10 })).level).toBe('낮음');
    expect(calculateCreativeFatigue(row({ fatigueScore: 40 })).level).toBe('보통');
    expect(calculateCreativeFatigue(row({ fatigueScore: 65 })).level).toBe('높음');
    expect(calculateCreativeFatigue(row({ fatigueScore: 90 })).level).toBe('매우 높음');
  });

  it('집행 기간이 21일 이상이면 장기화 사유를 포함한다', () => {
    const result = calculateCreativeFatigue(row({
      fatigueScore: 50,
      performance: performance({ days: 25, trend: [50, 50] }),
    }));
    expect(result.reasons.some(r => r.includes('장기화'))).toBe(true);
  });

  it('노출 빈도가 3 이상이면 반복 노출 피로 사유를 포함한다', () => {
    const result = calculateCreativeFatigue(row({
      fatigueScore: 50,
      performance: performance({ frequency: 3.5, days: 5, trend: [50, 50] }),
    }));
    expect(result.reasons.some(r => r.includes('반복 노출'))).toBe(true);
  });

  it('최근 추이가 초반 대비 15% 넘게 하락하면 하락 추세 사유를 포함한다', () => {
    const result = calculateCreativeFatigue(row({
      fatigueScore: 50,
      performance: performance({ trend: [80, 80, 20, 20], days: 5 }),
    }));
    expect(result.reasons.some(r => r.includes('하락'))).toBe(true);
  });

  it('fatigueLevel이 "교체 권장"이면 해당 사유를 포함한다', () => {
    const result = calculateCreativeFatigue(row({ fatigueScore: 50, fatigueLevel: '교체 권장' }));
    expect(result.reasons.some(r => r.includes('교체 권장'))).toBe(true);
  });

  it('특별한 신호가 없으면 기본 안내 문구를 반환한다', () => {
    const result = calculateCreativeFatigue(row({
      fatigueScore: 50,
      fatigueLevel: '정상',
      performance: performance({ days: 5, frequency: 1, trend: [50, 51] }),
    }));
    expect(result.reasons).toEqual(['현재 연결 데이터에서 뚜렷한 피로 신호가 없습니다.']);
  });
});

describe('classifyCreativeLifecycle', () => {
  it('calculateCreativeFatigue가 반환하는 lifecycle 값을 그대로 반환한다', () => {
    expect(classifyCreativeLifecycle(row({ lifecycle: '피로' }))).toBe('피로');
  });
});
