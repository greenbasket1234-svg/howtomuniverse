export type ProposalCalculationSettings = {
  // 신규 매체 시범 예산 = 다음달 총 예산 × 이 비율
  newPlatformBudgetRatio: number;
  // 신규 매체 광고 귀속 매출 중, 전체 목표 매출에 순수 증분으로 반영하는 비율
  newPlatformRevenueContributionRatio: number;
  // 효율 우수 매체 증액 폭(%)
  increasePercent: number;
  // 효율 저조 매체 감액 폭(%)
  decreasePercent: number;
  // '낮을수록 좋음' 합계형 커스텀 지표(예: 불량 DB 수)의 다음달 목표 개선폭(%)
  lowerIsBetterImprovementPercent: number;
  // 신규 매체 초기 CPA 추정 기본값(원) — 벤치마크가 없을 때 사용
  defaultInitialCpa: number;
};

export type ProposalSettingsPreset = 'conservative' | 'standard' | 'aggressive' | 'custom';

export const PROPOSAL_SETTINGS_PRESETS: Record<Exclude<ProposalSettingsPreset, 'custom'>, ProposalCalculationSettings> = {
  conservative: {
    newPlatformBudgetRatio: 0.06,
    newPlatformRevenueContributionRatio: 0.25,
    increasePercent: 12,
    decreasePercent: 12,
    lowerIsBetterImprovementPercent: 1,
    defaultInitialCpa: 18000,
  },
  standard: {
    newPlatformBudgetRatio: 0.1,
    newPlatformRevenueContributionRatio: 0.4,
    increasePercent: 20,
    decreasePercent: 20,
    lowerIsBetterImprovementPercent: 2,
    defaultInitialCpa: 15000,
  },
  aggressive: {
    newPlatformBudgetRatio: 0.16,
    newPlatformRevenueContributionRatio: 0.55,
    increasePercent: 30,
    decreasePercent: 15,
    lowerIsBetterImprovementPercent: 3,
    defaultInitialCpa: 12000,
  },
};

const STORAGE_KEY = 'adcc-proposal-calc-settings-v1';

export function loadProposalSettings(): ProposalCalculationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return PROPOSAL_SETTINGS_PRESETS.standard;
    const parsed = JSON.parse(raw);
    return { ...PROPOSAL_SETTINGS_PRESETS.standard, ...parsed };
  } catch {
    return PROPOSAL_SETTINGS_PRESETS.standard;
  }
}

export function saveProposalSettings(settings: ProposalCalculationSettings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function detectPreset(settings: ProposalCalculationSettings): ProposalSettingsPreset {
  for (const [name, preset] of Object.entries(PROPOSAL_SETTINGS_PRESETS)) {
    if (JSON.stringify(preset) === JSON.stringify(settings)) return name as ProposalSettingsPreset;
  }
  return 'custom';
}
