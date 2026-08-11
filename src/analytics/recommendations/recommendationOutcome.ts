import type { RecommendationFeedback, RecommendationOutcomeRecord, RecommendationStatus } from './recommendationTypes';

// 추천마다 [도움됨]/[적용함]/[보류]/[적합하지 않음] 피드백과 상태를 기록합니다.
// 실제 서버가 없는 데모 모드 구조라 다른 *Store.ts 파일들과 동일하게 localStorage에 저장합니다.
// 나중에 실제 백엔드가 붙으면 이 파일의 read/persist만 API 호출로 바꾸면 되고, 나머지는
// 그대로 씁니다.

const STORAGE_KEY = 'adcc-recommendation-outcomes-v1';
export const RECOMMENDATION_OUTCOME_EVENT = 'adcc:recommendation-outcome-changed';

function read(): RecommendationOutcomeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persist(list: RecommendationOutcomeRecord[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(RECOMMENDATION_OUTCOME_EVENT));
    return true;
  } catch { return false; }
}

export function loadOutcomes(): RecommendationOutcomeRecord[] {
  return read();
}

export function getOutcome(recommendationId: string): RecommendationOutcomeRecord | undefined {
  return read().find(item => item.recommendationId === recommendationId);
}

function upsert(recommendationId: string, patch: Partial<RecommendationOutcomeRecord>): RecommendationOutcomeRecord {
  const list = read();
  const existing = list.find(item => item.recommendationId === recommendationId);
  const next: RecommendationOutcomeRecord = {
    recommendationId,
    status: existing?.status ?? 'new',
    feedback: existing?.feedback,
    note: existing?.note,
    actedBy: existing?.actedBy,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const rest = list.filter(item => item.recommendationId !== recommendationId);
  persist([...rest, next]);
  return next;
}

export function setStatus(recommendationId: string, status: RecommendationStatus, actedBy?: string): RecommendationOutcomeRecord {
  return upsert(recommendationId, { status, actedBy });
}

export function setFeedback(recommendationId: string, feedback: RecommendationFeedback, actedBy?: string): RecommendationOutcomeRecord {
  const status: RecommendationStatus = feedback === 'applied' ? 'accepted' : feedback === 'not_relevant' ? 'dismissed' : 'reviewing';
  return upsert(recommendationId, { feedback, status, actedBy });
}

export type OutcomeSummary = {
  totalTracked: number;
  applied: number;
  dismissed: number;
};

export function summarizeOutcomes(outcomes: RecommendationOutcomeRecord[]): OutcomeSummary {
  return {
    totalTracked: outcomes.length,
    applied: outcomes.filter(o => o.status === 'accepted' || o.status === 'completed').length,
    dismissed: outcomes.filter(o => o.status === 'dismissed').length,
  };
}
