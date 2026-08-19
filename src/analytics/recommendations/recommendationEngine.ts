// Recommendation Engine — 전체 파이프라인의 진입점.
//
//   기존 분석 엔진 → Signal Engine → (그룹화 → 타입 판정 → 우선순위 → 신뢰도) → 중복 제거
//
// 이 파일 자체는 지표를 계산하지 않습니다. buildCampaignComparison / buildMediaComparison /
// buildAdvertiserComparison / loadCreativeAnalysisRows / getKeywordAnalysisRows가 계산한
// 결과를 모아서 신호로 바꾸고, 신호를 추천으로 합치는 역할만 합니다.

import { buildAdvertiserComparison } from '../advertiserAnalysis';
import { buildCampaignComparison, loadCampaigns, type CampaignComparisonRow } from '../campaignAnalysis';
import { buildMediaComparison, comparisonRange, rangeFor, type MediaComparisonRow } from '../mediaAnalysis';
import { loadCreativeAnalysisRows } from '../creativeAnalysis';
import { EMPTY_PERFORMANCE_DATASET, type PerformanceDataset } from '../integratedPerformance';
import { getKeywordAnalysisRows, KEYWORD_PLATFORMS } from '../../data/keywordAnalysisMock';
import {
  expansionSignalsFromCampaigns,
  expansionSignalsFromMedia,
  signalsFromAdvertisers,
  signalsFromCampaigns,
  signalsFromCreatives,
  signalsFromKeywords,
  signalsFromMedia,
} from './signalEngine';
import {
  buildMetricsForGroup,
  buildSuggestedActions,
  buildTitleAndSummary,
  determineRecommendationType,
  groupSignalsByEntity,
  worstSeverity,
  type RecommendationContext,
} from './recommendationRules';
import { evaluateConfidence } from './recommendationConfidence';
import { calculatePriorityScore, priorityLabel } from './recommendationScore';
import type { InsightSignal, Recommendation } from './recommendationTypes';
import { dedupeRecommendations } from './recommendationDedupe';

// buildEvidence는 recommendationRules 안에서만 쓰는 헬퍼라 재노출된 이름으로 가져옵니다.
import { buildEvidence } from './recommendationRules';

export type BuildRecommendationsOptions = {
  period?: string;
  comparison?: string;
  data?: PerformanceDataset;
};

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((+new Date(end) - +new Date(start)) / 86_400_000) + 1);
}

function sampleForGroup(signals: InsightSignal[], context: RecommendationContext, days: number) {
  const first = signals[0];
  if (first?.entityType === 'campaign') {
    const row = context.campaignRowsById.get(first.entityId);
    if (row) {
      const leads = Math.round(row.current.leads);
      return leads > 0
        ? { days, sampleSize: leads, sampleUnit: 'DB/전환' }
        : { days, sampleSize: Math.round(row.current.clicks), sampleUnit: '클릭' };
    }
  }
  if (first?.entityType === 'media') {
    const row = context.mediaRowsByKey.get(`${first.advertiserName}:${first.entityId}`);
    if (row) {
      const leads = Math.round(row.current.leads);
      return leads > 0
        ? { days, sampleSize: leads, sampleUnit: 'DB/전환' }
        : { days, sampleSize: Math.round(row.current.clicks), sampleUnit: '클릭' };
    }
  }
  // 광고주/소재/키워드는 별도 표본 수를 세지 않고, 신호 점수 기준으로 신뢰도를 보수적으로 잡습니다.
  return { days, sampleSize: days >= 14 ? 30 : 8, sampleUnit: '일자' };
}

function spendForGroup(signals: InsightSignal[], context: RecommendationContext): number {
  const first = signals[0];
  if (first?.entityType === 'campaign') return context.campaignRowsById.get(first.entityId)?.current.spend ?? 0;
  if (first?.entityType === 'media') return context.mediaRowsByKey.get(`${first.advertiserName}:${first.entityId}`)?.current.spend ?? 0;
  return 200_000; // 광고주/소재/키워드 레벨은 개별 spend 조회가 없어 중간값으로 둡니다.
}

export function buildRecommendations(options: BuildRecommendationsOptions = {}): Recommendation[] {
  const data = options.data ?? EMPTY_PERFORMANCE_DATASET;
  const period = options.period ?? '최근 30일';
  const comparisonMode = options.comparison ?? '직전 동일기간';

  const [start, end] = rangeFor(period, data.latestDate);
  const [prevStart, prevEnd] = comparisonRange(start, end, comparisonMode);
  const days = daysBetween(start, end);
  const detectedAt = data.latestDate || new Date().toISOString().slice(0, 10);

  const campaigns = loadCampaigns();
  const campaignRows: CampaignComparisonRow[] = buildCampaignComparison(data, start, end, prevStart, prevEnd, campaigns);
  const advertiserRows = buildAdvertiserComparison(data, start, end, prevStart, prevEnd);

  const mediaRows: MediaComparisonRow[] = [];
  const mediaRowsByKey = new Map<string, MediaComparisonRow>();
  data.advertisers.forEach(advertiserName => {
    const rows = buildMediaComparison(data, start, end, prevStart, prevEnd, advertiserName);
    rows.forEach(row => mediaRowsByKey.set(`${advertiserName}:${row.name}`, row));
    mediaRows.push(...rows);
  });

  const creativeRows = loadCreativeAnalysisRows();

  const context: RecommendationContext = {
    campaignRowsById: new Map(campaignRows.map(row => [row.campaign.id, row])),
    mediaRowsByKey,
  };

  const signals: InsightSignal[] = [
    ...signalsFromCampaigns(campaignRows, detectedAt),
    ...expansionSignalsFromCampaigns(campaignRows, detectedAt),
    ...signalsFromAdvertisers(advertiserRows, detectedAt),
    ...signalsFromCreatives(creativeRows, detectedAt),
  ];
  data.advertisers.forEach(advertiserName => {
    const rows = mediaRows.filter(row => mediaRowsByKey.get(`${advertiserName}:${row.name}`) === row);
    signals.push(...signalsFromMedia(rows, advertiserName, detectedAt));
    signals.push(...expansionSignalsFromMedia(rows, advertiserName, detectedAt));
    KEYWORD_PLATFORMS.forEach(platform => {
      const keywordRows = getKeywordAnalysisRows(advertiserName, advertiserName, platform);
      signals.push(...signalsFromKeywords(keywordRows, advertiserName, detectedAt));
    });
  });

  const groups = groupSignalsByEntity(signals);

  const recommendations: Recommendation[] = groups.map((group, index) => {
    const first = group[0];
    const type = determineRecommendationType(group);
    const confidence = evaluateConfidence(sampleForGroup(group, context, days));
    const priorityScore = calculatePriorityScore({
      severityScore: Math.max(...group.map(s => s.score)),
      periodSpend: spendForGroup(group, context),
      confidence,
    });
    const insufficientData = confidence.level === 'low';
    const effectiveType = insufficientData ? 'monitor' : type;
    const { title, summary } = buildTitleAndSummary(effectiveType, first.entityLabel, first.mediaName);

    const rec: Recommendation = {
      recommendationId: `rec:${first.entityType}:${first.entityId}:${index}`,
      advertiserName: first.advertiserName,
      targetType: first.entityType,
      targetId: first.entityId,
      targetLabel: first.entityLabel,
      mediaName: first.mediaName,
      type: effectiveType,
      title: insufficientData ? `[데이터 부족] ${first.entityLabel}` : title,
      summary: insufficientData ? '판단하기에 데이터가 부족합니다. 추가 데이터를 수집한 뒤 다시 평가하세요.' : summary,
      priorityScore: insufficientData ? Math.min(priorityScore, 20) : priorityScore,
      priorityLabel: insufficientData ? '낮음' : priorityLabel(priorityScore),
      confidence,
      signalIds: group.map(s => s.signalId),
      metrics: insufficientData ? [] : buildMetricsForGroup(group, context),
      evidence: buildEvidence(group),
      suggestedActions: buildSuggestedActions(effectiveType, group),
      insufficientData,
      createdAt: detectedAt,
    };
    return rec;
  });

  // 심각도가 낮음뿐이고 확대 후보도 아닌 그룹은 굳이 카드로 보여줄 필요가 없어 걸러냅니다.
  const meaningful = recommendations.filter(rec => rec.insufficientData || rec.priorityScore >= 15 || rec.type === 'increase_budget');

  return dedupeRecommendations(meaningful).sort((a, b) => b.priorityScore - a.priorityScore);
}

export function summarizeRecommendations(recommendations: Recommendation[]) {
  return {
    urgent: recommendations.filter(r => r.type === 'urgent').length,
    needsImprovement: recommendations.filter(r => r.type === 'review_campaign' || r.type === 'decrease_budget' || r.type === 'replace_creative' || r.type === 'adjust_keyword').length,
    expansionCandidate: recommendations.filter(r => r.type === 'increase_budget').length,
    monitoring: recommendations.filter(r => r.type === 'monitor' && !r.insufficientData).length,
    insufficientData: recommendations.filter(r => r.insufficientData).length,
  };
}

// worstSeverity는 상세 화면에서 신호 심각도를 다시 보여줄 때 쓸 수 있어 재노출합니다.
export { worstSeverity };
