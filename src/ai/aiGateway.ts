import { buildAIRecommendationPrompt, type AIRecommendationContext } from './aiRecommendationPrompt';
import type { AIAnalysisResult } from './aiRecommendationSchema';

// 1차 구현 범위: 실제 OpenAI/Claude 호출은 후순위입니다(스펙의 "1차 구현 범위" 표 참고).
// 기존 광고 매체 커넥터(src/integrations/connectors/*.ts)가 ConnectorNotImplementedError를
// 던지는 것과 같은 패턴으로, "버튼은 있지만 조용히 실패하지 않고 명확한 미구현 상태를
// 보여주는" 형태로 맞춰 뒀습니다. 실제 연동 시 이 함수 내부만 실제 fetch 호출로 바꾸면
// 나머지(프롬프트 구성, 컨텍스트 축소, 응답 스키마 검증)는 그대로 씁니다.

export class AIGatewayNotImplementedError extends Error {
  constructor() {
    super('[GATE] AI 심층 분석은 아직 실제 API에 연결되지 않았습니다.');
  }
}

export async function requestAIDeepDive(context: AIRecommendationContext): Promise<AIAnalysisResult> {
  // 실제 연동 시 예시:
  //   const prompt = buildAIRecommendationPrompt(context);
  //   const response = await fetch('/api/ai/recommendations', {
  //     method: 'POST',
  //     body: JSON.stringify({ prompt, systemRules: AI_RECOMMENDATION_SYSTEM_RULES }),
  //   });
  //   const raw = await response.text();
  //   const parsed = parseAIAnalysisResult(raw);
  //   if (!parsed) throw new Error('AI 응답 형식이 올바르지 않습니다.');
  //   return parsed;
  void buildAIRecommendationPrompt(context);
  throw new AIGatewayNotImplementedError();
}
