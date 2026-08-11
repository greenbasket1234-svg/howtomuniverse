// Signal Engine
//
// 기존 분석 엔진(campaignAnalysis, mediaAnalysis, advertiserAnalysis, creativeAnalysis,
// creativeFatigueAnalysis)이 이미 계산해 둔 이상 감지 결과를 그대로 읽어서 InsightSignal로
// 정규화합니다. 여기서 CPA/ROAS/CTR 같은 지표를 다시 계산하지 않습니다 - 계산식이
// 여러 곳에 흩어지는 걸 막기 위해서입니다.

import type { AdvertiserAnomaly, AdvertiserComparisonRow } from '../advertiserAnalysis';
import type { CampaignAnomaly, CampaignComparisonRow } from '../campaignAnalysis';
import { detectAdvertiserAnomalies } from '../advertiserAnalysis';
import { detectCampaignAnomalies } from '../campaignAnalysis';
import { detectMediaAnomalies, type MediaAnomaly, type MediaComparisonRow } from '../mediaAnalysis';
import type { CreativeAnalysisRow } from '../creativeAnalysis';
import { calculateCreativeFatigue } from '../creativeFatigueAnalysis';
import type { KeywordAnalysisRow } from '../../data/keywordAnalysisMock';
import type { InsightSignal, SignalType } from './recommendationTypes';

const CAMPAIGN_TYPE_BY_TITLE: Record<string, SignalType> = {
  'KPI 목표 이탈': 'kpi_miss',
  'CPA 급등': 'cpa_spike',
  'ROAS 급락': 'roas_drop',
  'CTR 급락': 'ctr_drop',
  'CVR 급락': 'cvr_drop',
  'CPC 급등': 'cpc_spike',
  '예산 과소진 위험': 'budget_overpace',
  '예산 미소진 위험': 'budget_underpace',
  '광고비 대비 성과 악화': 'spend_vs_performance',
};

const MEDIA_TYPE_BY_TITLE: Record<string, SignalType> = {
  '예산 급증': 'spend_spike',
  'CPA 급등': 'cpa_spike',
  'ROAS 하락': 'roas_drop',
  'CTR 하락': 'ctr_drop',
};

const ADVERTISER_TYPE_BY_TITLE: Record<string, SignalType> = {
  'KPI 목표 미달': 'kpi_miss',
  'CPA 악화': 'cpa_spike',
  'ROAS 하락': 'roas_drop',
  '광고비 대비 성과 악화': 'spend_vs_performance',
  '예산 초과 예상': 'budget_overpace',
  '예산 미소진 예상': 'budget_underpace',
};

function severityFromTone(tone: 'danger' | 'warning' | 'info' | 'success', score: number): InsightSignal['severity'] {
  if (tone === 'danger') return score >= 82 ? 'critical' : 'high';
  if (tone === 'warning') return 'medium';
  return 'low';
}

export function signalsFromCampaigns(rows: CampaignComparisonRow[], detectedAt: string): InsightSignal[] {
  const anomalies: CampaignAnomaly[] = detectCampaignAnomalies(rows);
  const byId = new Map(rows.map(row => [row.campaign.id, row]));
  return anomalies.map((anomaly, index) => {
    const row = byId.get(anomaly.campaignId);
    return {
      signalId: `campaign:${anomaly.campaignId}:${index}`,
      advertiserName: anomaly.advertiserName,
      entityType: 'campaign',
      entityId: anomaly.campaignId,
      entityLabel: anomaly.campaignName,
      mediaName: row?.mediaName,
      type: CAMPAIGN_TYPE_BY_TITLE[anomaly.title] ?? 'kpi_miss',
      severity: severityFromTone(anomaly.tone, anomaly.score),
      title: anomaly.title,
      description: anomaly.description,
      score: anomaly.score,
      changeRate: row?.primaryChange,
      detectedAt,
    };
  });
}

export function signalsFromMedia(rows: MediaComparisonRow[], advertiserName: string, detectedAt: string): InsightSignal[] {
  const anomalies: MediaAnomaly[] = detectMediaAnomalies(rows);
  const byName = new Map(rows.map(row => [row.name, row]));
  return anomalies.map((anomaly, index) => {
    const row = byName.get(anomaly.media);
    return {
      signalId: `media:${advertiserName}:${anomaly.media}:${index}`,
      advertiserName,
      entityType: 'media',
      entityId: anomaly.media,
      entityLabel: anomaly.media,
      mediaName: anomaly.media,
      type: MEDIA_TYPE_BY_TITLE[anomaly.title] ?? 'spend_vs_performance',
      severity: severityFromTone(anomaly.tone, anomaly.score),
      title: anomaly.title,
      description: anomaly.description,
      score: anomaly.score,
      changeRate: row?.primaryChange,
      detectedAt,
    };
  });
}

export function signalsFromAdvertisers(rows: AdvertiserComparisonRow[], detectedAt: string): InsightSignal[] {
  const anomalies: AdvertiserAnomaly[] = detectAdvertiserAnomalies(rows);
  const byName = new Map(rows.map(row => [row.name, row]));
  return anomalies.map((anomaly, index) => {
    const row = byName.get(anomaly.advertiser);
    return {
      signalId: `advertiser:${anomaly.advertiser}:${index}`,
      advertiserName: anomaly.advertiser,
      entityType: 'advertiser',
      entityId: anomaly.advertiser,
      entityLabel: anomaly.advertiser,
      type: ADVERTISER_TYPE_BY_TITLE[anomaly.title] ?? 'kpi_miss',
      severity: severityFromTone(anomaly.tone, anomaly.score),
      title: anomaly.title,
      description: anomaly.description,
      score: anomaly.score,
      changeRate: row?.primaryChange,
      detectedAt,
    };
  });
}

const FATIGUE_SEVERITY: Record<string, InsightSignal['severity'] | undefined> = {
  '매우 높음': 'critical',
  '높음': 'high',
  '보통': 'medium',
};

const FATIGUE_SCORE_FLOOR: Record<string, number> = {
  '매우 높음': 88,
  '높음': 68,
  '보통': 45,
};

export function signalsFromCreatives(rows: CreativeAnalysisRow[], detectedAt: string): InsightSignal[] {
  const out: InsightSignal[] = [];
  rows.forEach((row, index) => {
    const fatigue = calculateCreativeFatigue(row);
    const severity = FATIGUE_SEVERITY[fatigue.level];
    if (!severity) return; // '낮음' · '평가 보류'는 신호로 만들지 않음
    out.push({
      signalId: `creative:${row.creative.id}:${index}`,
      advertiserName: row.creative.brand,
      entityType: 'creative',
      entityId: row.creative.id,
      entityLabel: row.creative.name,
      mediaName: row.creative.platform,
      type: 'creative_fatigue',
      severity,
      title: `소재 피로도 ${fatigue.level}`,
      description: fatigue.reasons.join(' '),
      score: FATIGUE_SCORE_FLOOR[fatigue.level] ?? 50,
      changeRate: undefined,
      detectedAt,
    });
  });
  return out;
}

// "문제 있는 것"만 찾으면 금방 피곤해지는 도구가 된다는 스펙 지적대로, 잘 되고 있는 것도
// 신호로 만듭니다. 새 이상 감지 로직을 만들지 않고, 각 엔진이 이미 계산해 둔
// budgetVerdict(확대 검토 / 효율적 확대 / 성장 기회)를 그대로 읽습니다.

export function expansionSignalsFromCampaigns(rows: CampaignComparisonRow[], detectedAt: string): InsightSignal[] {
  return rows
    .filter(row => row.budgetVerdict === '확대 검토')
    .map((row, index) => ({
      signalId: `campaign-expand:${row.campaign.id}:${index}`,
      advertiserName: row.advertiserName,
      entityType: 'campaign' as const,
      entityId: row.campaign.id,
      entityLabel: row.campaign.name,
      mediaName: row.mediaName,
      type: 'kpi_outperformance' as const,
      severity: 'low' as const,
      title: '예산 확대 후보',
      description: `${row.primaryLabel} 기준 목표 대비 우수하고 예산 여력이 있습니다.`,
      score: Math.min(90, row.kpiAchievement ?? 70),
      changeRate: row.primaryChange,
      detectedAt,
    }));
}

export function expansionSignalsFromMedia(rows: MediaComparisonRow[], advertiserName: string, detectedAt: string): InsightSignal[] {
  return rows
    .filter(row => row.budgetVerdict === '효율적 확대' || row.budgetVerdict === '성장 기회')
    .map((row, index) => ({
      signalId: `media-expand:${advertiserName}:${row.name}:${index}`,
      advertiserName,
      entityType: 'media' as const,
      entityId: row.name,
      entityLabel: row.name,
      mediaName: row.name,
      type: 'kpi_outperformance' as const,
      severity: 'low' as const,
      title: row.budgetVerdict === '효율적 확대' ? '효율적 확대 후보' : '성장 기회',
      description: row.budgetVerdict === '효율적 확대'
        ? '광고비 대비 성과 증가폭이 더 커서 확대 여지가 있습니다.'
        : '광고비 비중보다 성과 비중이 높아 예산을 늘릴 여지가 있습니다.',
      score: Math.round(row.healthScore),
      changeRate: row.primaryChange,
      detectedAt,
    }));
}

const KEYWORD_MIN_WASTE_SPEND = 30_000;

export function signalsFromKeywords(rows: KeywordAnalysisRow[], advertiserName: string, detectedAt: string): InsightSignal[] {
  const out: InsightSignal[] = [];
  rows.forEach((row, index) => {
    if (row.status !== 'active') return;
    if (row.spend >= KEYWORD_MIN_WASTE_SPEND && row.conversions === 0) {
      const score = Math.min(95, 55 + Math.round(row.spend / 20_000));
      out.push({
        signalId: `keyword:${row.id}:${index}`,
        advertiserName,
        entityType: 'keyword',
        entityId: row.id,
        entityLabel: row.keyword,
        mediaName: row.platform,
        type: 'keyword_waste',
        severity: score >= 80 ? 'high' : 'medium',
        title: '고비용 무전환 키워드',
        description: `${row.platform}에서 ${row.spend.toLocaleString()}원을 소진했지만 전환이 없습니다.`,
        score,
        detectedAt,
      });
    }
  });
  return out;
}
