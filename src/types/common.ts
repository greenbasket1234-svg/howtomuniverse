// Phase 1 범위의 공통 타입만 정의합니다.
// Creative / Keyword / AutomationRule 등 Phase 2 공통 데이터 모델은
// 설계서 지시("Phase 2용 공통 데이터 모델을 과도하게 구현하지 말 것")에 따라
// 이번 단계에서는 만들지 않습니다.

export type DataAvailabilityStatus =
  | 'available'
  | 'empty'
  | 'not_connected'
  | 'token_expired'
  | 'fetch_failed'
  | 'permission_denied'
  | 'unsupported';

export type MetricValue =
  | { status: 'available'; value: string }
  | { status: Exclude<DataAvailabilityStatus, 'available'> };

export function metric(value: string): MetricValue {
  return { status: 'available', value };
}

export function metricStatus(
  status: Exclude<DataAvailabilityStatus, 'available'>
): MetricValue {
  return { status };
}

export const STATUS_LABEL: Record<DataAvailabilityStatus, string> = {
  available: '',
  empty: '-',
  not_connected: '연동 대기',
  token_expired: '토큰 만료',
  fetch_failed: '수집 실패',
  permission_denied: '권한 오류',
  unsupported: '미지원',
};

export type SidebarMenuItem = {
  key: string;
  label: string;
  path: string;
  section: 'overview' | 'advertiser' | 'reports' | 'analysis' | 'creative' | 'budget' | 'calendar' | 'work' | 'automation' | 'settlement' | 'management' | 'support';
  activeMatch: 'exact' | 'prefix';
  prefixPath?: string;
  indent?: boolean;
  badge?: string;
  icon: string; // components/sidebarIcons.ts 의 키
};

// --- 브랜드 / 예산 상태 (4차 부록 A-1 + 5차 보정 기준) ---

export type BudgetStatus =
  | 'normal'
  | 'warning'
  | 'overrun_expected'
  | 'overrun'
  | 'not_configured'
  | 'projection_unavailable';

export type BudgetWarningReason = 'underspending' | 'overrun_risk';

export type BudgetEvaluation =
  | { status: 'warning'; warningReason: BudgetWarningReason; projectedRate: number }
  | { status: Exclude<BudgetStatus, 'warning'>; projectedRate?: number };

export function getBudgetStatus(params: {
  monthlyBudget?: number;
  currentSpend: number;
  projectedMonthEndSpend?: number;
}): BudgetEvaluation {
  const { monthlyBudget, currentSpend, projectedMonthEndSpend } = params;

  if (!monthlyBudget || monthlyBudget <= 0) {
    return { status: 'not_configured' };
  }

  if (currentSpend > monthlyBudget) {
    return { status: 'overrun' };
  }

  if (projectedMonthEndSpend == null) {
    return { status: 'projection_unavailable' };
  }

  const projectedRate = (projectedMonthEndSpend / monthlyBudget) * 100;

  if (projectedRate > 110) {
    return { status: 'overrun_expected', projectedRate };
  }

  if (projectedRate < 90) {
    return { status: 'warning', warningReason: 'underspending', projectedRate };
  }

  if (projectedRate > 100) {
    return { status: 'warning', warningReason: 'overrun_risk', projectedRate };
  }

  return { status: 'normal', projectedRate };
}

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  normal: '정상',
  warning: '주의',
  overrun_expected: '초과 예상',
  overrun: '초과',
  not_configured: '미설정',
  projection_unavailable: '예측 불가',
};

export const BUDGET_WARNING_REASON_LABEL: Record<BudgetWarningReason, string> = {
  underspending: '저소진',
  overrun_risk: '초과 위험',
};
