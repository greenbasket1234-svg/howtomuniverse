// AI 심층 분석(OpenAI/Claude)이 돌려줘야 하는 구조화 응답 스키마.
// 텍스트로 그대로 받으면 화면 재사용이 어려워지므로, 실제 연동 전에 형태부터 고정해 둡니다.

export type AIFindingConfidence = 'low' | 'medium' | 'high';

export type AIFinding = {
  title: string;
  description: string;
  evidenceIds: string[];
  confidence: AIFindingConfidence;
};

export type AISuggestedAction = {
  priority: number;
  action: string;
  reason: string;
  targetType: string;
  targetId?: string;
};

export type AIAnalysisResult = {
  executiveSummary: string;
  findings: AIFinding[];
  actions: AISuggestedAction[];
  cautions: string[];
};

/** 실제 API 응답(JSON 문자열)을 최소한으로 검증해서 파싱합니다. 형태가 어긋나면 null. */
export function parseAIAnalysisResult(raw: string): AIAnalysisResult | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.executiveSummary !== 'string' ||
      !Array.isArray(parsed?.findings) ||
      !Array.isArray(parsed?.actions) ||
      !Array.isArray(parsed?.cautions)
    ) {
      return null;
    }
    return parsed as AIAnalysisResult;
  } catch {
    return null;
  }
}
