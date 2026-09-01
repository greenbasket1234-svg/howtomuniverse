import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Eye, Sparkles, TrendingUp, Wrench } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { SummaryCard } from '../components/SummaryCard';
import { Badge, type BadgeTone } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useMetricRows } from '../hooks/useMetrics';
import type { CampaignMetricRow, CreativeMetricRow, KeywordMetricRow } from '../types/metrics';
import { buildLiveRecommendations, summarizeLiveRecommendations } from '../analytics/recommendations/liveRecommendationEngine';
import type { Recommendation, RecommendationType } from '../analytics/recommendations/recommendationTypes';
import { AIGatewayNotImplementedError, requestAIDeepDive } from '../ai/aiGateway';
import { buildAIRecommendationContext } from '../ai/aiRecommendationPrompt';
import type { AIAnalysisResult } from '../ai/aiRecommendationSchema';

const TYPE_LABEL:Record<RecommendationType,string>={urgent:'긴급 대응',increase_budget:'확대 후보',decrease_budget:'축소 검토',replace_creative:'소재 교체',review_campaign:'캠페인 점검',adjust_keyword:'키워드 정리',monitor:'모니터링'};
const TYPE_TONE:Record<RecommendationType,BadgeTone>={urgent:'danger',increase_budget:'success',decrease_budget:'warning',replace_creative:'warning',review_campaign:'warning',adjust_keyword:'warning',monitor:'neutral'};
function priorityTone(label:Recommendation['priorityLabel']):BadgeTone{return label==='긴급'?'danger':label==='높음'?'warning':label==='보통'?'accent':'neutral'}
function typeIcon(type:RecommendationType){if(type==='urgent')return <AlertTriangle size={16}/>;if(type==='increase_budget')return <TrendingUp size={16}/>;if(type==='replace_creative')return <Wrench size={16}/>;return <Eye size={16}/>}

export function AIRecommendationsPage(){
  const [params,setParams]=useSearchParams();
  const [aiStatus,setAiStatus]=useState<'idle'|'loading'|'not_ready'|'error'>('idle');
  const [aiResult,setAiResult]=useState<AIAnalysisResult|null>(null);
  const [aiError,setAiError]=useState('');
  const [advertiser,setAdvertiser]=useState(params.get('advertiser')||'');
  const [media,setMedia]=useState(params.get('media')||'');
  const [typeFilter,setTypeFilter]=useState<RecommendationType|''>((params.get('type') as RecommendationType)||'');
  const [priorityFilter,setPriorityFilter]=useState(params.get('priority')||'');
  const campaign=useMetricRows<CampaignMetricRow>('/metrics/campaigns');
  const creative=useMetricRows<CreativeMetricRow>('/metrics/creatives');
  const keyword=useMetricRows<KeywordMetricRow>('/metrics/keywords');
  const allRecommendations=useMemo(()=>buildLiveRecommendations(campaign.rows,creative.rows,keyword.rows),[campaign.rows,creative.rows,keyword.rows]);
  const recommendations=useMemo(()=>allRecommendations.filter(rec=>(!advertiser||rec.advertiserName===advertiser)&&(!media||rec.mediaName===media)&&(!typeFilter||rec.type===typeFilter)&&(!priorityFilter||rec.priorityLabel===priorityFilter)),[allRecommendations,advertiser,media,typeFilter,priorityFilter]);
  const summary=useMemo(()=>summarizeLiveRecommendations(allRecommendations),[allRecommendations]);
  const advertisers=[...new Set(allRecommendations.map(r=>r.advertiserName))].sort((a,b)=>a.localeCompare(b,'ko'));
  const medias=[...new Set(allRecommendations.map(r=>r.mediaName).filter(Boolean) as string[])].sort();
  const error=campaign.error||creative.error||keyword.error;
  const loading=campaign.loading||creative.loading||keyword.loading;
  function updateParam(key:string,value:string){const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);setParams(next,{replace:true})}
  async function handleDeepDive(){if(!recommendations.length)return;setAiStatus('loading');setAiError('');try{const context=buildAIRecommendationContext(advertiser||'전체','현재 선택 기간',recommendations.slice(0,10));const result=await requestAIDeepDive(context);setAiResult(result);setAiStatus('idle')}catch(error){if(error instanceof AIGatewayNotImplementedError){setAiStatus('not_ready');return}setAiStatus('error');setAiError(error instanceof Error?error.message:'AI 분석 요청에 실패했습니다.')}}
  return <div>
    <PageHeader title="AI 추천" description="캠페인·소재·키워드의 실제 Metrics API 성과만 사용해 운영 점검 후보를 만듭니다."/>
    <MetricsDateBar/>
    <div className="card" style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
      <select className="form-select" value={advertiser} onChange={e=>{setAdvertiser(e.target.value);updateParam('advertiser',e.target.value)}}><option value="">광고주 전체</option>{advertisers.map(name=><option key={name}>{name}</option>)}</select>
      <select className="form-select" value={media} onChange={e=>{setMedia(e.target.value);updateParam('media',e.target.value)}}><option value="">매체 전체</option>{medias.map(name=><option key={name}>{name}</option>)}</select>
      <select className="form-select" value={typeFilter} onChange={e=>{setTypeFilter(e.target.value as RecommendationType|'');updateParam('type',e.target.value)}}><option value="">추천 유형 전체</option>{Object.entries(TYPE_LABEL).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
      <select className="form-select" value={priorityFilter} onChange={e=>{setPriorityFilter(e.target.value);updateParam('priority',e.target.value)}}><option value="">우선순위 전체</option>{['긴급','높음','보통','낮음'].map(v=><option key={v}>{v}</option>)}</select>
      <button type="button" className="btn btn-primary" onClick={handleDeepDive} disabled={aiStatus==='loading'} style={{marginLeft:'auto'}}><Sparkles size={14}/> {aiStatus==='loading'?'분석 중...':'AI 심층 분석'}</button>
    </div>
    {error&&<div className="card" style={{borderColor:'#fecaca',color:'#b91c1c'}}>{error}</div>}
    {aiStatus==='not_ready'&&<div className="card" style={{borderColor:'var(--warning,#d97706)'}}>AI 심층 분석 외부 API가 아직 연결되지 않았습니다(서버에 ANTHROPIC_API_KEY 설정 필요). 아래 추천 자체는 Mock이 아니라 실제 HOWTOM Metrics 데이터 기반 규칙 분석입니다.</div>}
    {aiStatus==='error'&&<div className="card" style={{borderColor:'#fecaca',color:'#b91c1c'}}>AI 분석 요청에 실패했습니다: {aiError}</div>}
    {aiResult&&<div className="card" style={{borderColor:'#c7d7fe',background:'linear-gradient(120deg,#f7f9ff,#fff)'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><Sparkles size={16}/><b>AI 심층 분석 결과</b><button type="button" className="btn" style={{marginLeft:'auto'}} onClick={()=>setAiResult(null)}>닫기</button></div>
      <p style={{margin:'0 0 12px'}}>{aiResult.executiveSummary}</p>
      {aiResult.findings.length>0&&<div style={{marginBottom:12}}><b style={{fontSize:13}}>주요 발견</b>{aiResult.findings.map((f,i)=><div key={i} style={{marginTop:6,paddingLeft:10,borderLeft:'2px solid #c7d7fe'}}><div style={{display:'flex',gap:6,alignItems:'center'}}><strong style={{fontSize:13.5}}>{f.title}</strong><Badge tone={f.confidence==='high'?'success':f.confidence==='medium'?'accent':'neutral'}>{f.confidence==='high'?'신뢰도 높음':f.confidence==='medium'?'신뢰도 보통':'추정'}</Badge></div><p style={{margin:'3px 0 0',fontSize:13,color:'var(--text-secondary)'}}>{f.description}</p></div>)}</div>}
      {aiResult.actions.length>0&&<div style={{marginBottom:12}}><b style={{fontSize:13}}>권장 액션(검토안)</b><ol style={{margin:'6px 0 0',paddingLeft:18}}>{aiResult.actions.sort((a,b)=>a.priority-b.priority).map((a,i)=><li key={i} style={{fontSize:13,marginBottom:4}}><b>{a.action}</b> — {a.reason}</li>)}</ol></div>}
      {aiResult.cautions.length>0&&<div><b style={{fontSize:13}}>주의할 사항</b><ul style={{margin:'6px 0 0',paddingLeft:18}}>{aiResult.cautions.map((c,i)=><li key={i} style={{fontSize:12.5,color:'var(--text-secondary)'}}>{c}</li>)}</ul></div>}
      <p style={{fontSize:11.5,color:'var(--text-secondary)',marginTop:12,marginBottom:0}}>AI가 HOWTOM 추천 엔진의 계산 결과를 요약·해석한 것으로, 숫자 자체를 새로 만들지 않습니다. 실제 집행 전 담당자 검토가 필요합니다.</p>
    </div>}
    <div className="summary-card-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,margin:'14px 0'}}><SummaryCard label="긴급" value={`${summary.urgent}건`}/><SummaryCard label="개선 필요" value={`${summary.needsImprovement}건`}/><SummaryCard label="확대 후보" value={`${summary.expansionCandidate}건`}/><SummaryCard label="모니터링" value={`${summary.monitoring}건`}/><SummaryCard label="데이터 부족" value={`${summary.insufficientData}건`}/></div>
    <h2 style={{fontSize:15,margin:'18px 0 10px'}}>실제 성과 기반 점검 후보</h2>
    {loading?<div className="card">실제 Metrics 데이터를 분석하는 중입니다.</div>:recommendations.length===0?<EmptyState title="현재 조건에서 추천할 항목이 없습니다" description="선택 기간의 실제 데이터가 없거나 현재 규칙에서 이상 신호가 발견되지 않았습니다."/>:<div style={{display:'flex',flexDirection:'column',gap:12}}>{recommendations.map((rec,index)=><RecommendationCard key={rec.recommendationId} rank={index+1} recommendation={rec}/>)}</div>}
  </div>;
}
function RecommendationCard({rank,recommendation}:{rank:number;recommendation:Recommendation}){const rec=recommendation;const detailHref=`/insights/ai-recommendations/${encodeURIComponent(rec.recommendationId)}`;return <div className="card recommendation-card"><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}><div style={{display:'flex',gap:10,alignItems:'flex-start'}}><span style={{fontWeight:700,color:'var(--text-secondary)'}}>{rank}</span><div><div style={{display:'flex',gap:6,alignItems:'center',marginBottom:4}}><Badge tone={TYPE_TONE[rec.type]}>{typeIcon(rec.type)} {TYPE_LABEL[rec.type]}</Badge><Badge tone={priorityTone(rec.priorityLabel)}>{rec.priorityLabel}</Badge></div><div style={{fontWeight:600}}>{rec.advertiserName}{rec.mediaName?` · ${rec.mediaName}`:''} · {rec.targetLabel}</div></div></div><span style={{fontSize:12.5,color:'var(--text-secondary)'}}>{rec.confidence.label}</span></div><div style={{display:'flex',flexWrap:'wrap',gap:16,margin:'10px 0',fontSize:13.5}}>{rec.metrics.map(m=><span key={m.label}><strong>{m.label}</strong> {m.detail}</span>)}</div><p style={{margin:'8px 0'}}>{rec.summary}</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn" to={detailHref}>근거 보기</Link>{rec.suggestedActions.map(a=><Link key={a.label} className="btn" to={a.to}>{a.label}</Link>)}</div></div>}
