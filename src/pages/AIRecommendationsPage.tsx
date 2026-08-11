import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Eye, RefreshCcw, Sparkles, TrendingUp, Wrench } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { SummaryCard } from '../components/SummaryCard';
import { Badge, type BadgeTone } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useDbDataRevision } from '../hooks/useDbDataRevision';
import { loadPerformanceDataset } from '../analytics/integratedPerformance';
import { buildRecommendations, summarizeRecommendations } from '../analytics/recommendations/recommendationEngine';
import type { Recommendation, RecommendationType } from '../analytics/recommendations/recommendationTypes';
import { AIGatewayNotImplementedError, requestAIDeepDive } from '../ai/aiGateway';
import { buildAIRecommendationContext } from '../ai/aiRecommendationPrompt';

const periodOptions = ['오늘', '어제', '최근 7일', '최근 14일', '최근 30일', '이번 달', '지난달'];
const comparisonOptions = ['직전 동일기간', '전월', '전년 동기간'];

const TYPE_LABEL: Record<RecommendationType, string> = {
  urgent: '긴급 대응',
  increase_budget: '확대 후보',
  decrease_budget: '축소 검토',
  replace_creative: '소재 교체',
  review_campaign: '캠페인 점검',
  adjust_keyword: '키워드 정리',
  monitor: '모니터링',
};

const TYPE_TONE: Record<RecommendationType, BadgeTone> = {
  urgent: 'danger',
  increase_budget: 'success',
  decrease_budget: 'warning',
  replace_creative: 'warning',
  review_campaign: 'warning',
  adjust_keyword: 'warning',
  monitor: 'neutral',
};

function priorityTone(label: Recommendation['priorityLabel']): BadgeTone {
  if (label === '긴급') return 'danger';
  if (label === '높음') return 'warning';
  if (label === '보통') return 'accent';
  return 'neutral';
}

export function AIRecommendationsPage() {
  const dbRevision = useDbDataRevision();
  const [params, setParams] = useSearchParams();
  const [recomputeNonce, setRecomputeNonce] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'not_ready'>('idle');
  const [creativePatternSignal] = useState(() => { try { return JSON.parse(sessionStorage.getItem('howtom-hook-cta-signal-v1') || 'null') as null | {label:string;kind:string;count:number;avgScore?:number;validDbRate?:number;cpa?:number;confidence?:string}; } catch { return null; } });

  const [period, setPeriod] = useState(params.get('period') || '최근 30일');
  const [comparison, setComparison] = useState(params.get('compare') || '직전 동일기간');
  const [advertiser, setAdvertiser] = useState(params.get('advertiser') || '');
  const [media, setMedia] = useState(params.get('media') || '');
  const [typeFilter, setTypeFilter] = useState<RecommendationType | ''>((params.get('type') as RecommendationType) || '');
  const [priorityFilter, setPriorityFilter] = useState(params.get('priority') || '');

  const data = useMemo(() => loadPerformanceDataset(), [dbRevision]);

  const allRecommendations = useMemo(
    () => buildRecommendations({ period, comparison, data }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, comparison, data, recomputeNonce],
  );

  const recommendations = useMemo(() => allRecommendations.filter(rec =>
    (!advertiser || rec.advertiserName === advertiser) &&
    (!media || rec.mediaName === media) &&
    (!typeFilter || rec.type === typeFilter) &&
    (!priorityFilter || rec.priorityLabel === priorityFilter),
  ), [allRecommendations, advertiser, media, typeFilter, priorityFilter]);

  const summary = useMemo(() => summarizeRecommendations(allRecommendations), [allRecommendations]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  }

  function handleRecompute() {
    setRecomputeNonce(n => n + 1);
    setLastUpdated(new Date());
  }

  async function handleDeepDive() {
    if (!recommendations.length) return;
    setAiStatus('loading');
    try {
      const context = buildAIRecommendationContext(advertiser || '전체', period, recommendations.slice(0, 10));
      await requestAIDeepDive(context);
    } catch (error) {
      if (error instanceof AIGatewayNotImplementedError) {
        setAiStatus('not_ready');
        return;
      }
      setAiStatus('not_ready');
      return;
    }
    setAiStatus('idle');
  }

  return (
    <div>
      <PageHeader
        title="AI 추천"
        description="성과 데이터를 다시 분석하지 않고, 기존 분석 결과를 종합해서 오늘 무엇부터 확인해야 하는지 알려줍니다."
      />

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <select className="form-select" value={period} onChange={e => { setPeriod(e.target.value); updateParam('period', e.target.value); }}>
          {periodOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select className="form-select" value={comparison} onChange={e => { setComparison(e.target.value); updateParam('compare', e.target.value); }}>
          {comparisonOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select className="form-select" value={advertiser} onChange={e => { setAdvertiser(e.target.value); updateParam('advertiser', e.target.value); }}>
          <option value="">광고주 전체</option>
          {data.advertisers.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="form-select" value={media} onChange={e => { setMedia(e.target.value); updateParam('media', e.target.value); }}>
          <option value="">매체 전체</option>
          {data.medias.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="form-select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value as RecommendationType | ''); updateParam('type', e.target.value); }}>
          <option value="">추천 유형 전체</option>
          {Object.entries(TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select className="form-select" value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); updateParam('priority', e.target.value); }}>
          <option value="">우선순위 전체</option>
          {(['긴급', '높음', '보통', '낮음'] as const).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            최근 업데이트 {lastUpdated.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
          <button type="button" className="btn" onClick={handleRecompute}><RefreshCcw size={14} /> 추천 다시 계산</button>
          <button type="button" className="btn btn-primary" onClick={handleDeepDive} disabled={aiStatus === 'loading'}>
            <Sparkles size={14} /> AI 심층 분석
          </button>
        </div>
      </div>

      {aiStatus === 'not_ready' && (
        <div className="card" style={{ borderColor: 'var(--warning, #d97706)' }}>
          AI 심층 분석은 아직 실제 AI API와 연결되지 않았습니다. 지금 보이는 추천은 HOWTOM 자체 분석 엔진 결과이며(API 비용 0원), 생성형 AI 연동은 다음 단계에서 붙일 예정입니다.
        </div>
      )}

      {creativePatternSignal && (
        <div className="card" style={{ borderColor: '#cbd8ff', background: '#f8faff' }}>
          <strong>후킹·CTA 분석에서 전달된 패턴 · {creativePatternSignal.label}</strong>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>소재 {creativePatternSignal.count}개 · 평균 성과점수 {creativePatternSignal.avgScore?.toFixed?.(0) ?? '-'} · 신뢰도 {creativePatternSignal.confidence ?? '-'}. 기존 추천 엔진의 근거와 함께 참고하고, 실제 운영 변경 전 담당자가 검토하세요.</p>
        </div>
      )}

      <div className="summary-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, margin: '14px 0' }}>
        <SummaryCard label="긴급" value={`${summary.urgent}건`} />
        <SummaryCard label="개선 필요" value={`${summary.needsImprovement}건`} />
        <SummaryCard label="확대 후보" value={`${summary.expansionCandidate}건`} />
        <SummaryCard label="모니터링" value={`${summary.monitoring}건`} />
        <SummaryCard label="데이터 부족" value={`${summary.insufficientData}건`} />
      </div>

      <h2 style={{ fontSize: 15, margin: '18px 0 10px' }}>오늘 가장 먼저 확인하세요</h2>

      {recommendations.length === 0 ? (
        <EmptyState title="조건에 맞는 추천이 없습니다" description="필터를 조정하거나 기간을 넓혀 보세요." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {recommendations.map((rec, index) => (
            <RecommendationCard key={rec.recommendationId} rank={index + 1} recommendation={rec} period={period} comparison={comparison} />
          ))}
        </div>
      )}
    </div>
  );
}

function typeIcon(type: RecommendationType) {
  if (type === 'urgent') return <AlertTriangle size={16} />;
  if (type === 'increase_budget') return <TrendingUp size={16} />;
  if (type === 'replace_creative') return <Wrench size={16} />;
  return <Eye size={16} />;
}

function RecommendationCard({ rank, recommendation, period, comparison }: { rank: number; recommendation: Recommendation; period: string; comparison: string }) {
  const rec = recommendation;
  const detailHref = `/insights/ai-recommendations/${encodeURIComponent(rec.recommendationId)}?period=${encodeURIComponent(period)}&compare=${encodeURIComponent(comparison)}`;
  return (
    <div className="card recommendation-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{rank}</span>
          <div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <Badge tone={TYPE_TONE[rec.type]}>{typeIcon(rec.type)} {TYPE_LABEL[rec.type]}</Badge>
              <Badge tone={priorityTone(rec.priorityLabel)}>{rec.priorityLabel}</Badge>
            </div>
            <div style={{ fontWeight: 600 }}>
              {rec.advertiserName}{rec.mediaName ? ` · ${rec.mediaName}` : ''} · {rec.targetLabel}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{rec.confidence.label}</span>
      </div>

      {rec.metrics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '10px 0', fontSize: 13.5 }}>
          {rec.metrics.map(metric => (
            <span key={metric.label}><strong>{metric.label}</strong> {metric.detail}</span>
          ))}
        </div>
      )}

      <p style={{ margin: '8px 0' }}>{rec.summary}</p>

      {rec.evidence.length > 0 && (
        <ul style={{ margin: '4px 0 10px', paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
          {rec.evidence.slice(0, 3).map(item => <li key={item}>{item}</li>)}
        </ul>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link className="btn" to={detailHref}>근거 보기</Link>
        {rec.suggestedActions.map(action => (
          <Link key={action.label} className="btn" to={action.to}>{action.label}</Link>
        ))}
      </div>
    </div>
  );
}
