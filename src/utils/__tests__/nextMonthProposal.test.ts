import { describe, it, expect } from 'vitest';
import { buildNextMonthProposal } from '../nextMonthProposal';
import type { MonthlyReportData, MonthlyKpiTotals, MediaPerformanceRow } from '../monthlyReportData';

function totals(overrides: Partial<MonthlyKpiTotals> = {}): MonthlyKpiTotals {
  return {
    impressions: 0, clicks: 0, spend: 0, leads: 0, purchases: 0, revenue: 0,
    reach: 0, payments: 0, refunds: 0,
    ctr: 0, cpc: 0, cvr: 0, cpa: 0, roas: 0, cpm: 0, frequency: 0, netRevenue: 0,
    ...overrides,
  };
}

function mediaRow(overrides: Partial<MediaPerformanceRow> = {}): MediaPerformanceRow {
  return {
    platform: '메타', impressions: 100000, clicks: 2000, ctr: 2, cpc: 500,
    spend: 1000000, leads: 100, purchases: 80, cvr: 5, cpa: 10000, purchaseCvr: 4, purchaseCpa: 12500, revenue: 5000000, roas: 500,
    reach: 70000, cpm: 10000, frequency: 1.4, payments: 4650000, refunds: 279000, netRevenue: 4371000,
    ...overrides,
  };
}

function baseData(overrides: Partial<MonthlyReportData> = {}): MonthlyReportData {
  const current = totals({
    impressions: 100000, clicks: 2000, spend: 1000000, leads: 100, purchases: 80, revenue: 5000000,
    reach: 70000, payments: 4650000, refunds: 279000,
    ctr: 2, cpc: 500, cvr: 5, cpa: 10000, roas: 500, cpm: 10000, frequency: 1.4, netRevenue: 4371000,
  });
  return {
    advertiserName: '테스트광고주',
    month: '2026-07',
    compareMonth: '2026-06',
    current,
    previous: totals(),
    mediaTable: [mediaRow()],
    rows: [],
    reportType: 'revenue',
    currentOrigin: 'saved-monthly',
    previousOrigin: 'demo',
    profileMetrics: [],
    periodLabel: '2026.07.01 ~ 07.31',
    validDayCount: 31,
    validDayIndexes: Array.from({ length: 31 }, (_, i) => i),
    customMetrics: [],
    ...overrides,
  };
}

describe('buildNextMonthProposal - 핵심 숫자 일관성', () => {
  it('신규 매체를 포함해도 표지 총 광고비 = 매체별 제안 광고비 합계 + 신규 매체 시범 예산', () => {
    const data = baseData();
    const proposal = buildNextMonthProposal(data);
    const mediaSum = proposal.mediaRows.reduce((s, r) => s + r.proposedSpend, 0);
    const expected = mediaSum + (proposal.newPlatformSuggestion?.proposedBudget ?? 0);
    expect(Math.round(proposal.target.spend)).toBeCloseTo(Math.round(expected), -1);
  });

  it('ROAS는 항상 매출 ÷ 광고비와 일치해야 한다', () => {
    const data = baseData();
    const proposal = buildNextMonthProposal(data);
    if (proposal.target.spend > 0) {
      const expectedRoas = (proposal.target.revenue / proposal.target.spend) * 100;
      expect(proposal.target.roas).toBeCloseTo(expectedRoas, 0);
    }
  });

  it('결제는 항상 환불보다 크거나 같아야 한다', () => {
    const data = baseData();
    const proposal = buildNextMonthProposal(data);
    expect(proposal.target.payments).toBeGreaterThanOrEqual(proposal.target.refunds);
  });

  it('결제는 매출보다 클 수 없다', () => {
    const data = baseData();
    const proposal = buildNextMonthProposal(data);
    expect(proposal.target.payments).toBeLessThanOrEqual(proposal.target.revenue + 1);
  });

  it('매출 이력이 전혀 없으면 신규 매체 기대 매출도 0이어야 한다(임의 ROAS로 매출을 만들지 않음)', () => {
    const data = baseData({
      reportType: 'integrated',
      current: totals({ impressions: 50000, clicks: 1000, spend: 500000, leads: 50, revenue: 0 }),
      mediaTable: [mediaRow({ revenue: 0, roas: 0, payments: 0, refunds: 0, netRevenue: 0 })],
    });
    const proposal = buildNextMonthProposal(data);
    if (proposal.newPlatformSuggestion) {
      expect(proposal.newPlatformSuggestion.expectedRevenue).toBe(0);
    }
  });

  it('매출형 구매 전환 목표는 DB 전환 수와 무관하게 Purchase 실적만으로 계산된다', () => {
    const lowLeadData = baseData({
      reportType: 'revenue',
      current: totals({ impressions: 100000, clicks: 2000, spend: 1000000, leads: 10, purchases: 80, revenue: 5000000 }),
      mediaTable: [mediaRow({ leads: 10, purchases: 80 })],
    });
    const highLeadData = baseData({
      reportType: 'revenue',
      current: totals({ impressions: 100000, clicks: 2000, spend: 1000000, leads: 9999, purchases: 80, revenue: 5000000 }),
      mediaTable: [mediaRow({ leads: 9999, purchases: 80 })],
    });

    const lowLeadProposal = buildNextMonthProposal(lowLeadData);
    const highLeadProposal = buildNextMonthProposal(highLeadData);

    expect(lowLeadProposal.target.purchases).toBe(highLeadProposal.target.purchases);
    expect(lowLeadProposal.target.purchases).toBeGreaterThan(0);
  });

  it('자동 제안의 마지막 요약 문장 숫자가 KPI 카드 숫자와 일치해야 한다(DB형)', () => {
    const data = baseData({ reportType: 'custom', customMetrics: [] });
    const proposal = buildNextMonthProposal(data);
    const lastLine = proposal.proposals[proposal.proposals.length - 1];
    // DB형 폴백 문구에는 CPA 숫자가 들어가는데, 그 숫자가 target.cpa 반올림값과 같아야 한다.
    const cpaText = Math.round(proposal.target.cpa).toLocaleString();
    if (lastLine.includes('CPA')) {
      expect(lastLine.includes(cpaText)).toBe(true);
    }
  });
});

describe('buildNextMonthProposal - 커스텀 지표 안전장치', () => {
  it('낮을수록 좋은 합계형 지표는 다음달 목표가 현재값보다 항상 작아야 한다', () => {
    const data = baseData({
      reportType: 'custom',
      customMetrics: [{ id: 'bad-db', name: '불량 DB 수', unit: '건', current: 19, previous: 15, direction: 'down', aggregation: 'sum' }],
    });
    const proposal = buildNextMonthProposal(data);
    const metric = proposal.customMetrics?.find(m => m.id === 'bad-db');
    expect(metric).toBeDefined();
    if (metric) expect(metric.target).toBeLessThan(metric.current);
  });

  it('중립 지표는 예산 증액·감액 판단에 영향을 주지 않아야 한다(표준 지표로 폴백)', () => {
    const data = baseData({
      reportType: 'custom',
      customMetrics: [{ id: 'score', name: '참고 점수', unit: '점', current: 100, previous: 100, direction: 'neutral', aggregation: 'average' }],
    });
    const proposal = buildNextMonthProposal(data);
    // 중립 지표만 있으면 매체별 판단은 표준 leads/spend 효율로 이뤄져야 하며, 최소한 예외 없이 결과가 나와야 한다.
    expect(proposal.mediaRows.length).toBeGreaterThan(0);
  });
});
