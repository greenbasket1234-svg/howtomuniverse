import type { Recommendation } from '../analytics/recommendations/recommendationTypes';

// AI 심층 분석은 광고 RAW 데이터를 통째로 보내지 않습니다. HOWTOM 추천 엔진이 이미
// 정리한 신호·근거·현재 추천만 구조화해서 전달합니다 - 토큰 비용을 줄이고, 모델이
// 근거 없는 숫자를 만들어내지 않도록 입력 자체를 제한하기 위해서입니다.

export type AIRecommendationContext = {
  advertiser: string;
  period: string;
  recommendations: Pick<Recommendation, 'title' | 'summary' | 'type' | 'priorityLabel' | 'evidence' | 'confidence'>[];
};

export function buildAIRecommendationContext(
  advertiser: string,
  period: string,
  recommendations: Recommendation[],
): AIRecommendationContext {
  return {
    advertiser,
    period,
    recommendations: recommendations.map(({ title, summary, type, priorityLabel, evidence, confidence }) => ({
      title, summary, type, priorityLabel, evidence, confidence,
    })),
  };
}

/**
 * 실제 연동 시 시스템 프롬프트에 그대로 사용할 규칙.
 * 스펙에서 명시한 4가지 제약을 그대로 유지합니다 - 특히 "근거 없는 원인을 확정하지 않는다"가
 * 핵심입니다.
 */
export const AI_RECOMMENDATION_SYSTEM_RULES = [
  '제공되지 않은 수치를 만들지 않는다.',
  '근거 없는 원인을 확정하지 않는다.',
  '추정은 추정이라고 표시한다.',
  '광고비 조정은 검토안으로만 제시하고, 즉시 실행 가능한 것처럼 말하지 않는다.',
] as const;

export function buildAIRecommendationPrompt(context: AIRecommendationContext): string {
  const lines = [
    `광고주: ${context.advertiser}`,
    `기간: ${context.period}`,
    '',
    '아래는 HOWTOM 추천 엔진이 이미 계산한 추천 목록입니다. 이걸 다시 계산하지 말고,',
    '1) 데이터에서 확인되는 사실 2) 가능성이 높은 원인 3) 우선 확인할 항목',
    '4) 권장 액션 5) 주의할 사항 순서로 종합해 주세요.',
    '',
    ...context.recommendations.map(rec => `- [${rec.priorityLabel}] ${rec.title}: ${rec.summary} (근거: ${rec.evidence.join(' / ')})`),
  ];
  return lines.join('\n');
}
