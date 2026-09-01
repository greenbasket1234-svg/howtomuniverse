import { apiFetch } from '../hooks/useApi';
import { buildAIRecommendationPrompt, type AIRecommendationContext } from './aiRecommendationPrompt';
import { parseAIAnalysisResult, type AIAnalysisResult } from './aiRecommendationSchema';

// HOWTOM 추천 엔진이 이미 계산한 추천 목록을 Claude(Anthropic API)로 요약·해석합니다.
// 안전 규칙(허위 수치 금지 등)은 클라이언트가 아니라 서버(server.mjs)가 시스템 프롬프트로
// 강제합니다 - 여기서는 데이터를 사람이 읽을 수 있는 프롬프트로 정리해서 보내기만 합니다.
// 기존 광고 매체 커넥터(src/integrations/connectors/*.ts)가 ConnectorNotImplementedError를
// 던지는 것과 같은 패턴으로, API 키가 설정 안 된 서버 환경에서는 명확한 미구현 상태를 보여줍니다.

export class AIGatewayNotImplementedError extends Error {
  constructor(message?: string) {
    super(message || '[GATE] AI 심층 분석은 아직 실제 API에 연결되지 않았습니다.');
  }
}

export async function requestAIDeepDive(context: AIRecommendationContext): Promise<AIAnalysisResult> {
  const prompt = buildAIRecommendationPrompt(context);
  try {
    const data = await apiFetch<AIAnalysisResult & { error?: string; configured?: boolean }>('/ai/recommendations', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
    const parsed = parseAIAnalysisResult(JSON.stringify(data));
    if (!parsed) throw new Error('AI 응답 형식이 올바르지 않습니다.');
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ANTHROPIC_API_KEY')) throw new AIGatewayNotImplementedError(message);
    throw error;
  }
}
