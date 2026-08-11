// Recommendation Rules
//
// Signal 여러 개를 entity(캠페인/매체/광고주/소재/키워드) 단위로 묶어서 Recommendation
// 하나로 합칩니다. "CPA 급등 + 광고비 증가 + 구매 감소 + 소재 피로도"를 경고 4개로
// 따로 보여주지 않고 "캠페인 효율 악화 — 소재 교체 우선 검토" 하나로 합치는 부분입니다.

import { formatMetric } from '../integratedPerformance';
import type { CampaignComparisonRow } from '../campaignAnalysis';
import type { MediaComparisonRow } from '../mediaAnalysis';
import type {
  InsightSignal,
  RecommendationEvidence,
  RecommendationType,
  SuggestedAction,
} from './recommendationTypes';

export type RecommendationContext = {
  campaignRowsById: Map<string, CampaignComparisonRow>;
  mediaRowsByKey: Map<string, MediaComparisonRow>; // key: `${advertiserName}:${mediaName}`
};

export function groupSignalsByEntity(signals: InsightSignal[]): InsightSignal[][] {
  const groups = new Map<string, InsightSignal[]>();
  signals.forEach(signal => {
    const key = `${signal.entityType}:${signal.entityId}`;
    const list = groups.get(key) ?? [];
    list.push(signal);
    groups.set(key, list);
  });
  return [...groups.values()];
}

const SEVERITY_RANK: Record<InsightSignal['severity'], number> = { critical: 3, high: 2, medium: 1, low: 0 };

export function worstSeverity(signals: InsightSignal[]): InsightSignal['severity'] {
  return signals.reduce((worst, s) => (SEVERITY_RANK[s.severity] > SEVERITY_RANK[worst] ? s.severity : worst), 'low' as InsightSignal['severity']);
}

const NEGATIVE_TYPES = new Set<InsightSignal['type']>([
  'kpi_miss', 'cpa_spike', 'roas_drop', 'ctr_drop', 'cvr_drop', 'cpc_spike', 'spend_vs_performance',
]);

export function determineRecommendationType(signals: InsightSignal[]): RecommendationType {
  const types = new Set(signals.map(s => s.type));
  const hasNegative = [...types].some(t => NEGATIVE_TYPES.has(t));

  if (worstSeverity(signals) === 'critical') return 'urgent';
  if (types.has('creative_fatigue')) return 'replace_creative';
  if (types.has('keyword_waste')) return 'adjust_keyword';
  if (types.has('kpi_outperformance') && !hasNegative) return 'increase_budget';
  if (types.has('budget_overpace') && hasNegative) return 'decrease_budget';
  if (hasNegative) return 'review_campaign';
  return 'monitor';
}

const TYPE_LABEL: Record<RecommendationType, string> = {
  urgent: '긴급 대응 필요',
  increase_budget: '예산 확대 후보',
  decrease_budget: '예산 축소 검토',
  replace_creative: '소재 교체 검토',
  review_campaign: '캠페인 점검 필요',
  adjust_keyword: '키워드 정리 필요',
  monitor: '모니터링',
};

const TYPE_SUMMARY: Record<RecommendationType, string> = {
  urgent: '예산 확대보다 원인 점검을 먼저 진행하세요.',
  increase_budget: '성과를 유지하는 범위에서 예산 확대를 검토할 수 있습니다.',
  decrease_budget: '현재 조건이 유지되면 예산 축소를 검토하세요.',
  replace_creative: '소재의 후킹·CTA·이미지를 교체하는 것을 검토하세요.',
  review_campaign: '타겟·소재·입찰 구조를 먼저 점검하세요.',
  adjust_keyword: '전환이 없는 키워드는 축소하고 확장 후보를 검토하세요.',
  monitor: '아직 조치보다 추가 관찰이 적절한 상태입니다.',
};

function buildTitle(type: RecommendationType, entityLabel: string, mediaName: string | undefined): string {
  const scope = mediaName && mediaName !== entityLabel ? `${entityLabel} · ${mediaName}` : entityLabel;
  return `[${TYPE_LABEL[type]}] ${scope}`;
}

function buildEvidence(signals: InsightSignal[]): string[] {
  const seen = new Set<string>();
  const evidence: string[] = [];
  signals
    .slice()
    .sort((a, b) => b.score - a.score)
    .forEach(signal => {
      if (seen.has(signal.description)) return;
      seen.add(signal.description);
      evidence.push(signal.description);
    });
  return evidence.slice(0, 5);
}

function buildCampaignMetrics(row: CampaignComparisonRow): RecommendationEvidence[] {
  const metrics: RecommendationEvidence[] = [];
  const add = (label: string, metric: Parameters<typeof formatMetric>[0], change: number) => {
    const prevValue = (row.previous as Record<string, number>)[metric];
    const curValue = (row.current as Record<string, number>)[metric];
    if (prevValue === undefined || curValue === undefined) return;
    metrics.push({
      label,
      detail: `${formatMetric(metric, prevValue)} → ${formatMetric(metric, curValue)} (${change >= 0 ? '+' : ''}${change.toFixed(1)}%)`,
    });
  };
  add(row.primaryLabel, row.primaryMetric, row.primaryChange);
  if (row.primaryMetric !== 'spend') add('광고비', 'spend', row.spendChange);
  if (row.primaryMetric !== 'leads') add('DB/전환', 'leads', row.leadChange);
  return metrics.slice(0, 3);
}

function buildMediaMetrics(row: MediaComparisonRow): RecommendationEvidence[] {
  const metrics: RecommendationEvidence[] = [];
  const add = (label: string, metric: Parameters<typeof formatMetric>[0], change: number) => {
    const prevValue = (row.previous as Record<string, number>)[metric];
    const curValue = (row.current as Record<string, number>)[metric];
    if (prevValue === undefined || curValue === undefined) return;
    metrics.push({
      label,
      detail: `${formatMetric(metric, prevValue)} → ${formatMetric(metric, curValue)} (${change >= 0 ? '+' : ''}${change.toFixed(1)}%)`,
    });
  };
  add(row.primaryMetric === 'roas' ? 'ROAS' : 'CPA', row.primaryMetric, row.primaryChange);
  add('광고비', 'spend', row.spendChange);
  return metrics.slice(0, 3);
}

export function buildMetricsForGroup(signals: InsightSignal[], context: RecommendationContext): RecommendationEvidence[] {
  const first = signals[0];
  if (!first) return [];
  if (first.entityType === 'campaign') {
    const row = context.campaignRowsById.get(first.entityId);
    return row ? buildCampaignMetrics(row) : [];
  }
  if (first.entityType === 'media') {
    const row = context.mediaRowsByKey.get(`${first.advertiserName}:${first.entityId}`);
    return row ? buildMediaMetrics(row) : [];
  }
  return [];
}

export function buildSuggestedActions(type: RecommendationType, signals: InsightSignal[]): SuggestedAction[] {
  const first = signals[0];
  const actions: SuggestedAction[] = [];
  if (!first) return actions;

  if (first.entityType === 'campaign') actions.push({ label: '캠페인 분석 보기', to: '/insights/campaigns' });
  if (first.entityType === 'media') actions.push({ label: '매체별 분석 보기', to: '/insights/media' });
  if (first.entityType === 'advertiser') actions.push({ label: '광고주별 분석 보기', to: '/insights/advertisers' });
  if (first.entityType === 'creative') actions.push({ label: '소재 분석 보기', to: '/insights/creatives' });
  if (first.entityType === 'keyword') actions.push({ label: '키워드 분석 보기', to: '/keywords' });

  if (type === 'replace_creative') actions.push({ label: '새 소재 제작', to: '/content/ad-creation' });
  if (type === 'adjust_keyword') actions.push({ label: '키워드 관리에서 검토', to: '/keywords' });
  if (type === 'increase_budget' || type === 'decrease_budget') actions.push({ label: '브랜드 예산 보기', to: '/brands-budget' });
  if (type === 'urgent' || type === 'review_campaign') actions.push({ label: '캠페인 관리에서 검토', to: '/campaigns' });

  return actions;
}

export function buildTitleAndSummary(type: RecommendationType, entityLabel: string, mediaName: string | undefined) {
  return { title: buildTitle(type, entityLabel, mediaName), summary: TYPE_SUMMARY[type] };
}

export { buildEvidence };
