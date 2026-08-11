import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useDbDataRevision } from '../hooks/useDbDataRevision';
import { loadPerformanceDataset } from '../analytics/integratedPerformance';
import { buildRecommendations } from '../analytics/recommendations/recommendationEngine';
import { getOutcome, setFeedback } from '../analytics/recommendations/recommendationOutcome';
import type { RecommendationFeedback } from '../analytics/recommendations/recommendationTypes';

const FEEDBACK_OPTIONS: { key: RecommendationFeedback; label: string }[] = [
  { key: 'helpful', label: '도움됨' },
  { key: 'applied', label: '적용함' },
  { key: 'later', label: '보류' },
  { key: 'not_relevant', label: '적합하지 않음' },
];

export function AIRecommendationDetailPage() {
  const { recommendationId } = useParams();
  const [params] = useSearchParams();
  const dbRevision = useDbDataRevision();
  const [outcomeVersion, setOutcomeVersion] = useState(0);

  const period = params.get('period') || '최근 30일';
  const comparison = params.get('compare') || '직전 동일기간';

  const data = useMemo(() => loadPerformanceDataset(), [dbRevision]);
  const recommendations = useMemo(() => buildRecommendations({ period, comparison, data }), [period, comparison, data]);
  const recommendation = recommendations.find(rec => rec.recommendationId === recommendationId);
  const outcome = recommendationId ? getOutcome(recommendationId) : undefined;
  void outcomeVersion;

  if (!recommendation) {
    return (
      <div>
        <PageHeader title="추천 상세" action={<Link className="btn" to="/insights/ai-recommendations"><ChevronLeft size={14} /> 목록으로</Link>} />
        <EmptyState title="추천을 찾을 수 없습니다" description="기간·비교 조건이 바뀌면 추천 목록도 달라질 수 있습니다. 목록에서 다시 들어와 주세요." />
      </div>
    );
  }

  const rec = recommendation;

  function handleFeedback(feedback: RecommendationFeedback) {
    if (!recommendationId) return;
    setFeedback(recommendationId, feedback);
    setOutcomeVersion(v => v + 1);
  }

  return (
    <div>
      <PageHeader
        title="추천 상세"
        description={`${rec.advertiserName}${rec.mediaName ? ` · ${rec.mediaName}` : ''} · ${rec.targetLabel}`}
        action={<Link className="btn" to="/insights/ai-recommendations"><ChevronLeft size={14} /> 목록으로</Link>}
      />

      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <Badge tone={rec.priorityLabel === '긴급' ? 'danger' : rec.priorityLabel === '높음' ? 'warning' : 'neutral'}>{rec.priorityLabel}</Badge>
          <Badge tone="neutral">{rec.confidence.label}</Badge>
          {rec.insufficientData && <Badge tone="warning">추천 보류</Badge>}
        </div>
        <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>{rec.title}</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{rec.summary}</p>
      </div>

      <Section title="1. 현재 상황">
        <p>{rec.summary}</p>
      </Section>

      <Section title="2. 변화 데이터">
        {rec.metrics.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rec.metrics.map(metric => (
              <div key={metric.label} style={{ display: 'flex', gap: 10 }}>
                <strong style={{ minWidth: 90 }}>{metric.label}</strong>
                <span>{metric.detail}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>이 추천은 개별 지표 비교보다 아래 근거 목록을 기준으로 판단했습니다.</p>
        )}
      </Section>

      <Section title="3. 추천 이유 (근거)">
        {rec.evidence.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {rec.evidence.map(item => <li key={item}>{item}</li>)}
          </ul>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>근거로 삼을 만한 이상 신호가 발견되지 않았습니다.</p>
        )}
      </Section>

      <Section title="4. 관련 분석">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {rec.suggestedActions.map(action => (
            <Link key={action.label} className="btn" to={action.to}>{action.label}</Link>
          ))}
        </div>
      </Section>

      <Section title="5. 예상 영향">
        {rec.estimatedImpact ? (
          <p>{rec.estimatedImpact}</p>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>계산 근거가 충분하지 않아 예상 영향을 추정하지 않았습니다. 임의로 금액이나 건수를 만들어내지 않기 위한 것입니다.</p>
        )}
      </Section>

      <Section title="6. 권장 행동">
        <p>{rec.summary}</p>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 6 }}>
          이 화면에서 바로 캠페인을 끄거나 예산을 변경하지 않습니다. 실제 변경은 운영센터에서 담당자가 직접 검토 후 진행해 주세요.
        </p>
      </Section>

      <Section title="7. 기록">
        {outcome ? (
          <p style={{ margin: 0 }}>
            상태: <strong>{outcome.status}</strong>
            {outcome.feedback && <> · 피드백: <strong>{FEEDBACK_OPTIONS.find(f => f.key === outcome.feedback)?.label ?? outcome.feedback}</strong></>}
            <br />
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>최근 업데이트 {new Date(outcome.updatedAt).toLocaleString('ko-KR')}</span>
          </p>
        ) : (
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 10px' }}>아직 기록된 피드백이 없습니다.</p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {FEEDBACK_OPTIONS.map(option => (
            <button key={option.key} type="button" className="btn" onClick={() => handleFeedback(option.key)}>{option.label}</button>
          ))}
        </div>
      </Section>

      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
        성과 데이터를 기반으로 생성된 참고용 제안입니다. 실제 광고 운영 변경 전 담당자의 검토가 필요합니다.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 10px', color: 'var(--text-secondary)' }}>{title}</h3>
      {children}
    </div>
  );
}
