import type { NextMonthProposalData } from './nextMonthProposal';

export type ValidationIssue = {
  level: 'error' | 'warning';
  message: string;
};

// PDF로 내보내기 전에 숫자 일관성과 데이터 상태를 자동으로 점검합니다. 여기서 잡아내는
// 항목들은 지금까지 여러 차례 리뷰에서 지적됐던 "표지와 본문 숫자가 다르게 보이는" 유형의
// 오류들입니다 — 계산 로직 자체는 이미 고쳐졌지만, 향후 수정 과정에서 같은 문제가 다시
// 생기지 않는지 매번 자동으로 재확인하는 안전망 역할입니다.
export function validateProposal(data: NextMonthProposalData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const round = (n: number) => Math.round(n);

  // 1) 광고비 합계 = 매체별 제안 광고비 합계(+신규 매체 시범 예산)
  const mediaSpendSum = data.mediaRows.reduce((sum, row) => sum + row.proposedSpend, 0);
  const expectedTotalSpend = mediaSpendSum + (data.newPlatformSuggestion?.proposedBudget ?? 0);
  if (Math.abs(round(data.target.spend) - round(expectedTotalSpend)) > 10) {
    issues.push({ level: 'error', message: `총 광고비(${round(data.target.spend).toLocaleString()}원)가 매체별 제안 광고비 합계(${round(expectedTotalSpend).toLocaleString()}원)와 맞지 않습니다.` });
  }

  // 2) ROAS = 매출 ÷ 광고비 × 100
  if (data.target.spend > 0) {
    const expectedRoas = (data.target.revenue / data.target.spend) * 100;
    if (Math.abs(data.target.roas - expectedRoas) > 1) {
      issues.push({ level: 'error', message: `표시된 ROAS(${data.target.roas.toFixed(1)}%)가 매출÷광고비로 계산한 값(${expectedRoas.toFixed(1)}%)과 맞지 않습니다.` });
    }
  }

  // 3) 결제 ≥ 환불이어야 함
  if (data.target.refunds > data.target.payments) {
    issues.push({ level: 'error', message: `환불(${round(data.target.refunds).toLocaleString()}원)이 결제(${round(data.target.payments).toLocaleString()}원)보다 큽니다.` });
  }

  // 3-1) 결제가 매출보다 큰 것도 수학적으로 불가능
  if (data.target.payments > data.target.revenue) {
    issues.push({ level: 'error', message: `결제(${round(data.target.payments).toLocaleString()}원)가 매출(${round(data.target.revenue).toLocaleString()}원)보다 큽니다.` });
  }

  // 4) 산출 불가(NaN) 커스텀 지표가 섞여 있는지
  const invalidCustomMetrics = (data.customMetrics ?? []).filter(m => !Number.isFinite(m.current) || !Number.isFinite(m.target));
  if (invalidCustomMetrics.length > 0) {
    issues.push({ level: 'error', message: `산출할 수 없는 커스텀 지표가 있습니다: ${invalidCustomMetrics.map(m => m.name).join(', ')}` });
  }

  // 5) 매체별 표 안에서도 제안 광고비가 음수이거나 비정상인 경우
  const negativeSpendRows = data.mediaRows.filter(row => row.proposedSpend < 0);
  if (negativeSpendRows.length > 0) {
    issues.push({ level: 'error', message: `제안 광고비가 음수로 계산된 매체가 있습니다: ${negativeSpendRows.map(r => r.platform).join(', ')}` });
  }

  // 6) 샘플(테스트) 데이터 기반으로 만든 제안서인지 — 오류는 아니지만 실수로 광고주에게
  // 전달하지 않도록 눈에 띄게 경고합니다.
  if (data.isSample) {
    issues.push({ level: 'warning', message: '테스트 샘플 데이터로 만든 제안서입니다. 실제 데이터가 아니므로 광고주에게 전달하지 않도록 주의하세요.' });
  }

  // 7) 신규 매체 제안이 있는데 시범 예산이 0원인 경우(광고비 데이터가 없을 때 생길 수 있음)
  if (data.newPlatformSuggestion && data.newPlatformSuggestion.proposedBudget <= 0) {
    issues.push({ level: 'warning', message: `신규 매체(${data.newPlatformSuggestion.platform}) 제안의 시범 예산이 0원입니다.` });
  }

  // 8) 매체별 표에 행이 하나도 없는 경우
  if (data.mediaRows.length === 0) {
    issues.push({ level: 'error', message: '매체별 제안 데이터가 없습니다. 이번 달 실제 데이터가 저장돼 있는지 확인해 주세요.' });
  }

  // 9) 파생 지표(CPA·CPC·CTR·CVR·CPM·빈도·순매출)가 원본 지표로 다시 계산한 값과 일치하는지
  const checkDerived = (label: string, shown: number, expected: number, tolerance = 1) => {
    if (Number.isFinite(expected) && Math.abs(shown - expected) > tolerance) {
      issues.push({ level: 'error', message: `표시된 ${label}(${shown.toFixed(1)})가 계산값(${expected.toFixed(1)})과 맞지 않습니다.` });
    }
  };
  if (data.target.leads > 0) checkDerived('CPA', data.target.cpa, data.target.spend / data.target.leads);
  if (data.target.clicks > 0) checkDerived('CPC', data.target.cpc, data.target.spend / data.target.clicks);
  if (data.target.impressions > 0) {
    checkDerived('CTR(%)', data.target.ctr, (data.target.clicks / data.target.impressions) * 100, 0.5);
    checkDerived('CPM', data.target.cpm, (data.target.spend / data.target.impressions) * 1000);
  }
  if (data.target.clicks > 0) checkDerived('CVR(%)', data.target.cvr, (data.target.leads / data.target.clicks) * 100, 0.5);
  if (data.target.reach > 0) checkDerived('빈도', data.target.frequency, data.target.impressions / data.target.reach, 0.1);
  checkDerived('순매출', data.target.netRevenue, data.target.payments - data.target.refunds, 10);

  return issues;
}
