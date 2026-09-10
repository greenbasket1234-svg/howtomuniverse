import type { Recommendation } from '../analytics/recommendations/recommendationTypes';

// AI 심층 분석은 광고 RAW 데이터를 통째로 보내지 않습니다. HOWTOM 추천 엔진이 이미
// 정리한 신호·근거·현재 추천만 구조화해서 전달합니다 - 토큰 비용을 줄이고, 모델이
// 근거 없는 숫자를 만들어내지 않도록 입력 자체를 제한하기 위해서입니다.
// 단, 구체적인 광고주명·캠페인명(소재명·키워드명)·매체명·수치는 반드시 포함해야
// AI가 "여러 캠페인이..." 같은 뭉뚱그린 문장 대신 실제로 어떤 캠페인/소재/키워드를
// 말하는지 짚어줄 수 있습니다 - 예전엔 이 필드들이 통째로 빠져 있었습니다.

export type AIRecommendationContext = {
  advertiser: string;
  period: string;
  recommendations: Pick<Recommendation, 'title' | 'summary' | 'type' | 'priorityLabel' | 'evidence' | 'confidence' | 'advertiserName' | 'targetLabel' | 'targetType' | 'mediaName' | 'metrics'>[];
};

export function buildAIRecommendationContext(
  advertiser: string,
  period: string,
  recommendations: Recommendation[],
): AIRecommendationContext {
  return {
    advertiser,
    period,
    recommendations: recommendations.map(({ title, summary, type, priorityLabel, evidence, confidence, advertiserName, targetLabel, targetType, mediaName, metrics }) => ({
      title, summary, type, priorityLabel, evidence, confidence, advertiserName, targetLabel, targetType, mediaName, metrics,
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
  '가능하면 항상 구체적인 광고주명·캠페인명(또는 소재명·키워드명)·매체명과 수치를 그대로 인용한다 - "여러 캠페인이" 같이 뭉뚱그린 표현 대신 실제 이름을 짚어서 말한다.',
] as const;

const TARGET_TYPE_LABEL: Record<string, string> = { campaign: '캠페인', creative: '소재', keyword: '키워드' };

export function buildAIRecommendationPrompt(context: AIRecommendationContext): string {
  const lines = [
    `광고주: ${context.advertiser}`,
    `기간: ${context.period}`,
    '',
    '아래는 HOWTOM 추천 엔진이 이미 계산한 추천 목록입니다. 이걸 다시 계산하지 말고,',
    '1) 데이터에서 확인되는 사실 2) 가능성이 높은 원인 3) 우선 확인할 항목',
    '4) 권장 액션 5) 주의할 사항 순서로 종합해 주세요.',
    '각 발견 사항을 쓸 때는 반드시 아래 목록에 있는 실제 광고주명·캠페인/소재/키워드 이름·매체명·수치를',
    '그대로 인용하세요. "여러 캠페인", "일부 소재"처럼 뭉뚱그리지 말고 이름을 명시하세요.',
    '',
    ...context.recommendations.map(rec => {
      const targetKind = rec.targetType ? TARGET_TYPE_LABEL[rec.targetType] || rec.targetType : '';
      const target = rec.targetLabel ? `${targetKind ? `${targetKind} "` : ''}${rec.targetLabel}${targetKind ? '"' : ''}` : '';
      const media = rec.mediaName ? ` (${rec.mediaName})` : '';
      const metricsText = rec.metrics?.length ? rec.metrics.map(m => `${m.label}=${m.detail}`).join(', ') : '';
      return [
        `- [${rec.priorityLabel}] 광고주 "${rec.advertiserName}"${target ? ` / ${target}${media}` : media}`,
        `  ${rec.title}: ${rec.summary}`,
        metricsText ? `  지표: ${metricsText}` : '',
        `  근거: ${rec.evidence.join(' / ')}`,
      ].filter(Boolean).join('\n');
    }),
  ];
  return lines.join('\n');
}
