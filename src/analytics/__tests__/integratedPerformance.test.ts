import { describe, it, expect } from 'vitest';
import { derived, formatMetric, metricValue, normalizeMedia, pctChange, sumRows, type PerformancePoint } from '../integratedPerformance';

function point(overrides: Partial<PerformancePoint> = {}): PerformancePoint {
  return {
    date: '2026-08-01',
    advertiser: '테스트광고주',
    reportType: 'lead',
    media: '메타',
    spend: 100000,
    impressions: 10000,
    clicks: 500,
    leads: 20,
    revenue: 0,
    ...overrides,
  };
}

describe('normalizeMedia', () => {
  it('영문/한글 매체명을 표준 한글 라벨로 통일한다', () => {
    expect(normalizeMedia('facebook')).toBe('메타');
    expect(normalizeMedia('instagram')).toBe('메타');
    expect(normalizeMedia('naver')).toBe('네이버');
    expect(normalizeMedia('google_sa')).toBe('구글 검색');
    expect(normalizeMedia('kakao_moment')).toBe('카카오');
  });

  it('매핑 테이블에 없는 값은 원본 그대로 반환한다', () => {
    expect(normalizeMedia('알수없는매체')).toBe('알수없는매체');
  });
});

describe('sumRows', () => {
  it('여러 행의 지표를 합산한다', () => {
    const rows = [point({ spend: 100, leads: 1 }), point({ spend: 200, leads: 2 })];
    const total = sumRows(rows);
    expect(total.spend).toBe(300);
    expect(total.leads).toBe(3);
  });

  it('빈 배열이면 모든 값이 0이다', () => {
    const total = sumRows([]);
    expect(total).toEqual({ spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0, validLeads: 0, contracts: 0, platformLeads: 0 });
  });

  it('platformLeads가 없으면 leads 값으로 대체해서 합산한다', () => {
    const total = sumRows([point({ leads: 5, platformLeads: undefined })]);
    expect(total.platformLeads).toBe(5);
  });

  it('validLeads/contracts가 없는 행도 안전하게 합산한다', () => {
    const total = sumRows([point({ validLeads: undefined, contracts: undefined })]);
    expect(total.validLeads).toBe(0);
    expect(total.contracts).toBe(0);
  });
});

describe('derived', () => {
  it('CTR/CPA/ROAS를 올바르게 계산한다', () => {
    const t = sumRows([point({ spend: 100000, impressions: 10000, clicks: 500, leads: 20, revenue: 500000 })]);
    const d = derived(t);
    expect(d.ctr).toBeCloseTo(5, 5); // 500/10000*100
    expect(d.cpa).toBeCloseTo(5000, 5); // 100000/20
    expect(d.roas).toBeCloseTo(500, 5); // 500000/100000*100
  });

  it('분모가 0이면 0으로 나누지 않고 0을 반환한다 (노출/DB/광고비 없음)', () => {
    const d = derived(sumRows([]));
    expect(d.ctr).toBe(0);
    expect(d.cpa).toBe(0);
    expect(d.roas).toBe(0);
  });
});

describe('pctChange', () => {
  it('일반적인 증가/감소율을 계산한다', () => {
    expect(pctChange(120, 100)).toBeCloseTo(20, 5);
    expect(pctChange(80, 100)).toBeCloseTo(-20, 5);
  });

  it('이전 값이 음수여도 절대값 기준으로 등락률을 계산한다', () => {
    // prev=-100, now=-50 → (변화량 50) / |-100| * 100 = 50
    expect(pctChange(-50, -100)).toBeCloseTo(50, 5);
  });

  it('이전 값이 0이고 현재 값도 0이면 변화율은 0이다', () => {
    expect(pctChange(0, 0)).toBe(0);
  });

  it('이전 값이 0인데 현재 값이 있으면 100%로 취급한다', () => {
    expect(pctChange(50, 0)).toBe(100);
  });
});

describe('metricValue', () => {
  it('요청한 지표 키의 값을 숫자로 반환한다', () => {
    const d = derived(sumRows([point({ spend: 100000, leads: 10 })]));
    expect(metricValue(d, 'spend')).toBe(100000);
    expect(metricValue(d, 'cpa')).toBe(d.cpa);
  });
});

describe('formatMetric', () => {
  it('금액 지표는 원화 기호와 천단위 콤마로 표시한다', () => {
    expect(formatMetric('spend', 1234567)).toBe('₩1,234,567');
    expect(formatMetric('revenue', 1000)).toBe('₩1,000');
  });

  it('금액 지표 값이 0이면 대시(-)로 표시한다', () => {
    expect(formatMetric('spend', 0)).toBe('-');
    expect(formatMetric('cpa', 0)).toBe('-');
  });

  it('비율 지표(CTR/ROAS)는 %로 표시하고 100 이상이면 정수로 반올림한다', () => {
    expect(formatMetric('ctr', 3.456)).toBe('3.46%');
    expect(formatMetric('roas', 250.4)).toBe('250%');
  });

  it('그 외 지표(노출/클릭/DB)는 정수 콤마 표기로 표시한다', () => {
    expect(formatMetric('impressions', 1234.6)).toBe('1,235');
  });
});
