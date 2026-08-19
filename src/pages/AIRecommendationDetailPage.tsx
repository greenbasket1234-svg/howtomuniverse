import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useMetricRows } from '../hooks/useMetrics';
import type { CampaignMetricRow, CreativeMetricRow, KeywordMetricRow } from '../types/metrics';
import { buildLiveRecommendations } from '../analytics/recommendations/liveRecommendationEngine';
import { getOutcome,setFeedback } from '../analytics/recommendations/recommendationOutcome';
import type { RecommendationFeedback } from '../analytics/recommendations/recommendationTypes';
const FEEDBACK_OPTIONS:{key:RecommendationFeedback;label:string}[]=[{key:'helpful',label:'도움됨'},{key:'applied',label:'적용함'},{key:'later',label:'보류'},{key:'not_relevant',label:'적합하지 않음'}];
export function AIRecommendationDetailPage(){
  const {recommendationId}=useParams();const [outcomeVersion,setOutcomeVersion]=useState(0);
  const campaign=useMetricRows<CampaignMetricRow>('/metrics/campaigns');const creative=useMetricRows<CreativeMetricRow>('/metrics/creatives');const keyword=useMetricRows<KeywordMetricRow>('/metrics/keywords');
  const recommendations=useMemo(()=>buildLiveRecommendations(campaign.rows,creative.rows,keyword.rows),[campaign.rows,creative.rows,keyword.rows]);
  const recommendation=recommendations.find(r=>r.recommendationId===recommendationId);const outcome=recommendationId?getOutcome(recommendationId):undefined;void outcomeVersion;
  if(!recommendation)return <div><PageHeader title="추천 상세" action={<Link className="btn" to="/insights/ai-recommendations"><ChevronLeft size={14}/> 목록으로</Link>}/><MetricsDateBar/><EmptyState title="추천을 찾을 수 없습니다" description="선택 기간이 바뀌었거나 해당 실제 성과 신호가 더 이상 존재하지 않을 수 있습니다."/></div>;
  const rec=recommendation;function handleFeedback(feedback:RecommendationFeedback){if(!recommendationId)return;setFeedback(recommendationId,feedback);setOutcomeVersion(v=>v+1)}
  return <div><PageHeader title="추천 상세" description={`${rec.advertiserName}${rec.mediaName?` · ${rec.mediaName}`:''} · ${rec.targetLabel}`} action={<Link className="btn" to="/insights/ai-recommendations"><ChevronLeft size={14}/> 목록으로</Link>}/><MetricsDateBar/>
    <div className="card"><div style={{display:'flex',gap:8,marginBottom:10}}><Badge tone={rec.priorityLabel==='긴급'?'danger':rec.priorityLabel==='높음'?'warning':'neutral'}>{rec.priorityLabel}</Badge><Badge tone="neutral">{rec.confidence.label}</Badge>{rec.insufficientData&&<Badge tone="warning">표본 부족</Badge>}</div><h2 style={{fontSize:17,margin:'0 0 6px'}}>{rec.title}</h2><p style={{margin:0,color:'var(--text-secondary)'}}>{rec.summary}</p></div>
    <Section title="1. 실제 지표">{rec.metrics.map(m=><div key={m.label} style={{display:'flex',gap:10,marginBottom:6}}><strong style={{minWidth:90}}>{m.label}</strong><span>{m.detail}</span></div>)}</Section>
    <Section title="2. 추천 근거"><ul style={{margin:0,paddingLeft:18}}>{rec.evidence.map(item=><li key={item}>{item}</li>)}</ul></Section>
    <Section title="3. 관련 분석"><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{rec.suggestedActions.map(a=><Link key={a.label} className="btn" to={a.to}>{a.label}</Link>)}</div></Section>
    <Section title="4. 기록">{outcome?<p>상태: <strong>{outcome.status}</strong>{outcome.feedback&&<> · 피드백: <strong>{FEEDBACK_OPTIONS.find(f=>f.key===outcome.feedback)?.label??outcome.feedback}</strong></>}</p>:<p style={{color:'var(--text-secondary)'}}>아직 기록된 피드백이 없습니다.</p>}<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{FEEDBACK_OPTIONS.map(o=><button key={o.key} type="button" className="btn" onClick={()=>handleFeedback(o.key)}>{o.label}</button>)}</div></Section>
    <p style={{fontSize:12,color:'var(--text-secondary)'}}>이 추천은 선택 기간의 실제 Metrics API 데이터로 계산된 참고용 제안이며 실제 광고 변경 전 담당자 검토가 필요합니다.</p>
  </div>;
}
function Section({title,children}:{title:string;children:React.ReactNode}){return <div className="card" style={{marginTop:12}}><h3 style={{fontSize:14,margin:'0 0 10px',color:'var(--text-secondary)'}}>{title}</h3>{children}</div>}
