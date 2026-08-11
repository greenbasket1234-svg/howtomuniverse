import { describe, it, expect } from 'vitest';
import {
  addDays, budgetVerdict, comparisonRange, inRange, iso,
  metricDirection, normalizeCampaignMedia, primaryMetric, rangeFor,
} from '../mediaAnalysis';

describe('iso / addDays', () => {
  it('Date를 YYYY-MM-DD 문자열로 변환한다', () => {
    expect(iso(new Date('2026-08-10T00:00:00'))).toBe('2026-08-10');
  });

  it('addDays는 날짜를 더하거나 뺀다', () => {
    expect(addDays('2026-08-10', 1)).toBe('2026-08-11');
    expect(addDays('2026-08-10', -1)).toBe('2026-08-09');
  });

  it('월 경계를 넘어가는 계산도 올바르게 처리한다', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });
});

describe('rangeFor', () => {
  const latest = '2026-08-10';

  it('latest가 없으면 빈 범위를 반환한다', () => {
    expect(rangeFor('오늘', '')).toEqual(['', '']);
  });

  it('"오늘"은 latest 하루만 포함한다', () => {
    expect(rangeFor('오늘', latest)).toEqual([latest, latest]);
  });

  it('"어제"는 latest 전날 하루만 포함한다', () => {
    expect(rangeFor('어제', latest)).toEqual(['2026-08-09', '2026-08-09']);
  });

  it('"최근 N일"은 latest를 포함해 N일 구간을 반환한다', () => {
    expect(rangeFor('최근 7일', latest)).toEqual(['2026-08-04', latest]);
  });

  it('"이번 달"은 해당 월 1일부터 latest까지다', () => {
    expect(rangeFor('이번 달', latest)).toEqual(['2026-08-01', latest]);
  });
});

describe('comparisonRange', () => {
  it('"비교 안 함"이거나 값이 비어있으면 빈 범위를 반환한다', () => {
    expect(comparisonRange('2026-08-01', '2026-08-10', '비교 안 함')).toEqual(['', '']);
    expect(comparisonRange('', '2026-08-10', '직전 동일기간')).toEqual(['', '']);
  });

  it('"직전 동일기간"은 같은 일수만큼 바로 이전 구간을 반환한다', () => {
    // 2026-08-01~2026-08-10 = 10일 → 직전 10일: 07-22~07-31
    expect(comparisonRange('2026-08-01', '2026-08-10', '직전 동일기간')).toEqual(['2026-07-22', '2026-07-31']);
  });

  it('"전월"은 시작/종료일을 한 달씩 앞으로 이동한다', () => {
    expect(comparisonRange('2026-08-01', '2026-08-10', '전월')).toEqual(['2026-07-01', '2026-07-10']);
  });

  it('그 외(전년)는 1년 앞으로 이동한다', () => {
    expect(comparisonRange('2026-08-01', '2026-08-10', '전년 동기')).toEqual(['2025-08-01', '2025-08-10']);
  });
});

describe('inRange', () => {
  it('시작/종료일이 모두 있을 때 범위 포함 여부를 판정한다', () => {
    expect(inRange('2026-08-05', '2026-08-01', '2026-08-10')).toBe(true);
    expect(inRange('2026-08-15', '2026-08-01', '2026-08-10')).toBe(false);
  });

  it('시작 또는 종료일이 비어있으면 해당 경계는 무시한다', () => {
    expect(inRange('2020-01-01', '', '2026-08-10')).toBe(true);
    expect(inRange('2099-01-01', '2026-08-01', '')).toBe(true);
  });
});

describe('primaryMetric', () => {
  it('리포트 유형별 주요 지표를 반환한다', () => {
    expect(primaryMetric('revenue')).toBe('roas');
    expect(primaryMetric('lead')).toBe('cpa');
    expect(primaryMetric('click')).toBe('clicks');
    expect(primaryMetric(undefined)).toBe('clicks');
  });
});

describe('metricDirection', () => {
  it('CPA는 낮을수록 좋으므로 부호를 반전한다', () => {
    expect(metricDirection('cpa', 10)).toBe(-10);
    expect(metricDirection('cpa', -10)).toBe(10);
  });

  it('그 외 지표는 부호를 그대로 유지한다', () => {
    expect(metricDirection('leads', 10)).toBe(10);
    expect(metricDirection('roas', -5)).toBe(-5);
  });
});

describe('normalizeCampaignMedia', () => {
  it('알려진 플랫폼 값을 표준 매체명으로 변환한다', () => {
    expect(normalizeCampaignMedia('instagram')).toBe('메타');
    expect(normalizeCampaignMedia('naver')).toBe('네이버');
    expect(normalizeCampaignMedia('karrot')).toBe('당근');
  });

  it('목록에 없는 값은 integratedPerformance의 normalizeMedia로 위임한다', () => {
    expect(normalizeCampaignMedia('gfa')).toBe('네이버');
  });
});

describe('budgetVerdict', () => {
  const base = { spendChange: 0, leadChange: 0, cpaChange: 0, roasChange: 0, performanceShare: 50, spendShare: 50 };

  it('광고비가 늘고 DB가 더 크게 늘고 CPA가 유지/개선되면 "효율적 확대"', () => {
    expect(budgetVerdict({ ...base, spendChange: 10, leadChange: 20, cpaChange: -1 })).toBe('효율적 확대');
  });

  it('성과 비중이 예산 비중보다 훨씬 크면 "성장 기회"', () => {
    expect(budgetVerdict({ ...base, spendChange: 0, leadChange: 0, performanceShare: 40, spendShare: 20 })).toBe('성장 기회');
  });

  it('광고비는 늘었는데 DB가 줄면 "비효율 증가"', () => {
    expect(budgetVerdict({ ...base, spendChange: 15, leadChange: -5, performanceShare: 50, spendShare: 50 })).toBe('비효율 증가');
  });

  it('광고비와 DB가 모두 크게 줄면 "축소 검토"', () => {
    expect(budgetVerdict({ ...base, spendChange: -10, leadChange: -20 })).toBe('축소 검토');
  });

  it('변화 폭이 작으면 "안정"', () => {
    expect(budgetVerdict({ ...base, spendChange: 2, leadChange: -3 })).toBe('안정');
  });
});
