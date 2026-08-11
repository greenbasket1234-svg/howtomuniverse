import type { Recommendation, RecommendationConfidence } from './recommendationTypes';

// 우선순위는 "얼마나 이상한가"만으로 정하지 않습니다. 스펙이 든 예시 그대로 -
// 하루 5천원짜리 캠페인의 CPA 100% 상승보다 월 3천만원 쓰는 광고주의 CPA 20% 상승이
// 더 중요합니다. 그래서 (이상 심각도) × (광고비 영향도) × (신뢰도)로 계산합니다.

export type PriorityInput = {
  /** 기존 anomaly detector가 이미 계산해 둔 심각도 점수(0~100) */
  severityScore: number;
  /** 이번 비교 기간 동안의 광고비(원) - 영향도 가중치 산정용 */
  periodSpend: number;
  confidence: RecommendationConfidence;
};

function spendMultiplier(periodSpend: number): number {
  if (periodSpend >= 10_000_000) return 1.2;
  if (periodSpend >= 3_000_000) return 1.1;
  if (periodSpend >= 500_000) return 1.0;
  if (periodSpend >= 100_000) return 0.9;
  return 0.75;
}

function confidenceMultiplier(confidence: RecommendationConfidence): number {
  if (confidence.level === 'high') return 1;
  if (confidence.level === 'medium') return 0.85;
  return 0.6;
}

export function calculatePriorityScore({ severityScore, periodSpend, confidence }: PriorityInput): number {
  const raw = severityScore * spendMultiplier(periodSpend) * confidenceMultiplier(confidence);
  return Math.round(Math.max(0, Math.min(100, raw)));
}

export function priorityLabel(score: number): Recommendation['priorityLabel'] {
  if (score >= 80) return '긴급';
  if (score >= 60) return '높음';
  if (score >= 35) return '보통';
  return '낮음';
}
