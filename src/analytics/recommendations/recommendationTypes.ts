// AI 추천(인사이트 → AI 추천) 기능의 공유 타입.
//
// 설계 원칙: 기존 analytics 엔진(campaignAnalysis, mediaAnalysis, advertiserAnalysis,
// creativeAnalysis, creativeFatigueAnalysis)의 계산 결과를 "다시 계산"하지 않고 그대로
// 소비해서 Signal로 정규화합니다. 이 파일에는 계산 로직이 없고 타입만 있습니다.
//
// 참고: 기존 analytics 레이어는 advertiserId가 아니라 advertiserName(광고주 표시 이름)을
// 조인 키로 일관되게 사용합니다(campaignAnalysis, mediaAnalysis 등 전부 동일). 새 기능만
// advertiserId를 쓰면 기존 코드와 매번 이름↔ID 변환이 필요해지므로, 이 레이어도
// advertiserName을 식별자로 사용합니다.

export type SignalEntityType = 'advertiser' | 'media' | 'campaign' | 'creative' | 'keyword';

export type SignalType =
  | 'kpi_miss'
  | 'cpa_spike'
  | 'roas_drop'
  | 'ctr_drop'
  | 'cvr_drop'
  | 'cpc_spike'
  | 'spend_spike'
  | 'spend_vs_performance'
  | 'budget_overpace'
  | 'budget_underpace'
  | 'creative_fatigue'
  | 'keyword_waste'
  | 'kpi_outperformance';

export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';

export type InsightSignal = {
  signalId: string;
  advertiserName: string;
  entityType: SignalEntityType;
  entityId: string;
  entityLabel: string;
  mediaName?: string;
  type: SignalType;
  severity: SignalSeverity;
  title: string;
  description: string;
  /** 0~100. 기존 anomaly detector들의 score를 그대로 재사용합니다. */
  score: number;
  changeRate?: number;
  detectedAt: string;
};

export type RecommendationType =
  | 'urgent'
  | 'increase_budget'
  | 'decrease_budget'
  | 'replace_creative'
  | 'review_campaign'
  | 'adjust_keyword'
  | 'monitor';

export type RecommendationConfidenceLevel = 'low' | 'medium' | 'high';

export type RecommendationConfidence = {
  level: RecommendationConfidenceLevel;
  label: string;
  reason: string;
  /** 신뢰도 산정에 쓰인 표본(집행일수/전환수 등) 설명 - 화면에 그대로 노출 */
  sampleNote: string;
};

export type RecommendationEvidence = {
  label: string;
  detail: string;
};

export type SuggestedAction = {
  label: string;
  /** 라우터 경로. 광고 on/off 같은 파괴적 액션은 절대 넣지 않고, 관련 분석·관리 화면으로만 이동합니다. */
  to: string;
};

export type Recommendation = {
  recommendationId: string;
  advertiserName: string;
  targetType: SignalEntityType;
  targetId: string;
  targetLabel: string;
  mediaName?: string;
  type: RecommendationType;
  title: string;
  summary: string;
  priorityScore: number;
  priorityLabel: '긴급' | '높음' | '보통' | '낮음';
  confidence: RecommendationConfidence;
  signalIds: string[];
  metrics: RecommendationEvidence[];
  evidence: string[];
  suggestedActions: SuggestedAction[];
  /** 계산 가능한 경우에만 채움 - 없으면 화면에서 절대 추정치를 만들어내지 않습니다. */
  estimatedImpact?: string;
  insufficientData: boolean;
  createdAt: string;
};

export type RecommendationStatus = 'new' | 'reviewing' | 'accepted' | 'dismissed' | 'completed';

export type RecommendationFeedback = 'helpful' | 'applied' | 'later' | 'not_relevant';

export type RecommendationOutcomeRecord = {
  recommendationId: string;
  status: RecommendationStatus;
  feedback?: RecommendationFeedback;
  note?: string;
  actedBy?: string;
  updatedAt: string;
};

export type RecommendationFilters = {
  period: string;
  comparison: string;
  advertiserName: string;
  mediaName: string;
  type: RecommendationType | '';
  priority: '' | Recommendation['priorityLabel'];
};

export type RecommendationSummary = {
  urgent: number;
  needsImprovement: number;
  expansionCandidate: number;
  monitoring: number;
  insufficientData: number;
};
