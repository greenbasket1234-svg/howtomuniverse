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
    // 서버는 "아직 API 키가 설정 안 됨"이면 항상 400을, 키는 있지만 실제 호출이 실패하면
    // 502를 돌려줍니다. 예전엔 에러 메시지에 "ANTHROPIC_API_KEY"라는 문자열이 들어있는지로
    // 판정했는데, ChatGPT(OpenAI)로 전환하면 메시지가 "AI_INSIGHTS_API_KEY"로 바뀌어서
    // 이 판정이 깨지는 버그가 있었습니다 - 상태 코드 기준으로 판정해 어떤 프로바이더를
    // 쓰든 정확히 동작하도록 고쳤습니다.
    const status = (error as { status?: number })?.status;
    if (status === 400) throw new AIGatewayNotImplementedError(error instanceof Error ? error.message : undefined);
    throw error;
  }
}
