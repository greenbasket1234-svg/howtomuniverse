import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, ChevronRight, CircleDollarSign, Eye, MousePointerClick, Sparkles, Target, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { derived, formatMetric, performanceDatasetFromMetricRows, metricValue, pctChange, sumRows, type PerformanceMetric, type PerformanceDataset } from '../analytics/integratedPerformance';
import type { Campaign } from '../types/operations';
import { MEDIA_COLORS, MEDIA_ORDER, buildFunnel, buildMediaComparison, comparisonRange, dailySeries, detectMediaAnomalies, inRange, normalizeCampaignMedia, rangeFor } from '../analytics/mediaAnalysis';
import { useMetricRows } from '../hooks/useMetrics';
import type { DailyMetricRow } from '../types/metrics';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useMetricsQuery } from '../context/MetricsQueryContext';

const metricNames:Record<PerformanceMetric,string>={spend:'광고비',impressions:'노출',clicks:'클릭',leads:'DB',revenue:'매출',ctr:'CTR',cpa:'CPA',roas:'ROAS',cpc:'CPC'};
const comparisonOptions=['직전 동일기간','전월','전년 동기간','비교 안 함'];
const trendMetrics:PerformanceMetric[]=['spend','clicks','leads','cpa','revenue','roas','ctr'];
const channelLabels=['전체 비교',...MEDIA_ORDER];

function poly(values:number[]){ const max=Math.max(...values,1),min=Math.min(...values,0),span=max-min||1; return values.map((value,index)=>`${8+index/Math.max(1,values.length-1)*92},${72-(value-min)/span*58}`).join(' '); }
function changeClass(metric:PerformanceMetric,change:number){ if(metric==='cpa') return change<0?'good':change>0?'bad':'neutral'; if(['leads','revenue','ctr','roas','clicks'].includes(metric)) return change>0?'good':change<0?'bad':'neutral'; return change>0?'good':change<0?'bad':'neutral'; }
function mediaStatus(score:number){ return score>=85?'우수':score>=70?'정상':score>=55?'주의':'개선 필요'; }
function statusTone(score:number){ return score>=85?'good':score>=70?'neutral':score>=55?'warning':'bad'; }
function mediaIcon(name:string){ return name==='메타'?'∞':name==='네이버'?'N':name==='구글 검색'?'G':name==='유튜브'?'▶':name==='당근'?'●':name==='카카오'?'●':'♪'; }

type MediaPerformancePageProps = { embedded?: boolean; defaultAdvertiser?: string };

export function MediaPerformancePage({ embedded = false, defaultAdvertiser = '' }: MediaPerformancePageProps){
  const {rows:metricRows}=useMetricRows<DailyMetricRow>('/metrics/daily');
  const data=useMemo(()=>performanceDatasetFromMetricRows(metricRows),[metricRows]);
  const {range}=useMetricsQuery();
  const [params,setParams]=useSearchParams();
  const [comparison,setComparison]=useState(params.get('compare')||'직전 동일기간');
  const [advertiser,setAdvertiser]=useState(params.get('advertiser')||defaultAdvertiser||'');
  const [activeMedia,setActiveMedia]=useState(params.get('channel')||'전체 비교');
  const [account,setAccount]=useState(params.get('account')||'');
  const [representativeKpi,setRepresentativeKpi]=useState<PerformanceMetric>((params.get('kpi') as PerformanceMetric)||'leads');
  const [trendMetric,setTrendMetric]=useState<PerformanceMetric>('leads');
  const [rankMetric,setRankMetric]=useState<'health'|'achievement'|'leads'|'cpa'|'roas'|'revenue'>('health');
  const [tableQuery,setTableQuery]=useState('');
  const [sortKey,setSortKey]=useState<'health'|'spend'|'leads'|'cpa'|'roas'>('health');
  const [sortDir,setSortDir]=useState<'asc'|'desc'>('desc');
  const [verdictFilter,setVerdictFilter]=useState('');
  useEffect(()=>{ if(embedded && defaultAdvertiser) setAdvertiser(defaultAdvertiser); },[embedded,defaultAdvertiser]);

  const [start,end]=[range.from,range.to]; const [prevStart,prevEnd]=comparisonRange(start,end,comparison);
  const comparisonRows=useMemo(()=>buildMediaComparison(data,start,end,prevStart,prevEnd,advertiser,representativeKpi),[data,start,end,prevStart,prevEnd,advertiser,representativeKpi]);
  const selected=activeMedia==='전체 비교'?null:comparisonRows.find(row=>row.name===activeMedia)||null;
  const sourceRows=(selected?data.media.filter(row=>row.media===selected.name):data.totals).filter(row=>(!advertiser||row.advertiser===advertiser)&&inRange(row.date,start,end));
  const prevRows=(selected?data.media.filter(row=>row.media===selected.name):data.totals).filter(row=>(!advertiser||row.advertiser===advertiser)&&inRange(row.date,prevStart,prevEnd));
  const now=derived(sumRows(sourceRows)),prev=derived(sumRows(prevRows));
  const daily=dailySeries(sourceRows),previousDaily=dailySeries(prevRows);
  const anomalies=detectMediaAnomalies(comparisonRows);
  const selectedCampaigns:Campaign[]=[];
  const selectedReportType=sourceRows[0]?.reportType;
  const funnel=buildFunnel(now,selectedReportType);

  const filteredTableRows=[...comparisonRows].filter(row=>(!tableQuery.trim()||row.name.includes(tableQuery.trim()))&&(!verdictFilter||row.budgetVerdict===verdictFilter)).sort((a,b)=>{
    const value=(row:typeof comparisonRows[number])=>sortKey==='health'?row.healthScore:sortKey==='spend'?row.current.spend:sortKey==='leads'?row.current.leads:sortKey==='cpa'?row.current.cpa:row.current.roas;
    const diff=value(a)-value(b); return sortDir==='asc'?diff:-diff;
  });
  const ranking=[...comparisonRows].sort((a,b)=>{
    const value=(row:typeof comparisonRows[number])=>rankMetric==='health'?row.healthScore:rankMetric==='achievement'?(row.kpiAchievement??row.healthScore):rankMetric==='leads'?row.current.leads:rankMetric==='cpa'?-row.current.cpa:rankMetric==='roas'?row.current.roas:row.current.revenue;
    return value(b)-value(a);
  }).slice(0,5);
  const budgetCandidates=[...comparisonRows].sort((a,b)=>(b.performanceShare-b.spendShare)-(a.performanceShare-a.spendShare));
  const expand=budgetCandidates.filter(row=>['효율적 확대','성장 기회'].includes(row.budgetVerdict)).slice(0,3);
  const reduce=[...comparisonRows].filter(row=>['비효율 증가','축소 검토'].includes(row.budgetVerdict)).sort((a,b)=>a.healthScore-b.healthScore).slice(0,3);
  const top=comparisonRows.slice().sort((a,b)=>b.healthScore-a.healthScore)[0], low=comparisonRows.slice().sort((a,b)=>a.healthScore-b.healthScore)[0];
  const syncParams=(patch:Record<string,string>)=>{ if(embedded) return; const next=new URLSearchParams(params); Object.entries(patch).forEach(([key,value])=>value?next.set(key,value):next.delete(key)); setParams(next,{replace:true}); };
  const chooseMedia=(name:string)=>{setActiveMedia(name);setAccount('');syncParams({channel:name==='전체 비교'?'':name,account:''});};
  const kpis:PerformanceMetric[]=['spend','impressions','clicks','leads','revenue','ctr','cpa','roas'];

  return <div className={`media-analysis-page${embedded ? ' embedded' : ''}`}>
    {!embedded && <header className="map-head"><div><span>인사이트</span><h1>매체별 분석</h1><p>매체 성과를 비교하고 예산 효율·KPI 달성률·개선 포인트를 분석합니다.</p></div><div className="map-data-badge">데이터 기준 <b>{data.latestDate||'-'}</b></div></header>}
    {embedded && <div className="map-embedded-head"><div><h2>매체 성과</h2><p>{advertiser || '전체 광고주'}의 매체별 효율과 변화 추이를 같은 화면 폭에 맞춰 확인합니다.</p></div><div className="map-data-badge">데이터 기준 <b>{data.latestDate||'-'}</b></div></div>}

    <MetricsDateBar compact/>

    <section className={`map-filter-card${embedded ? ' embedded' : ''}`}>
      <label>비교기간<select value={comparison} onChange={e=>{setComparison(e.target.value);syncParams({compare:e.target.value})}}>{comparisonOptions.map(v=><option key={v}>{v}</option>)}</select></label>
      {!embedded && <label>광고주<select value={advertiser} onChange={e=>{setAdvertiser(e.target.value);setAccount('');syncParams({advertiser:e.target.value,account:''})}}><option value="">전체 광고주</option>{data.advertisers.map(v=><option key={v}>{v}</option>)}</select></label>}
      <label>대표 KPI<select value={representativeKpi} onChange={e=>{setRepresentativeKpi(e.target.value as PerformanceMetric);syncParams({kpi:e.target.value})}}><option value="leads">DB/전환</option><option value="cpa">CPA</option><option value="roas">ROAS</option><option value="revenue">매출</option><option value="clicks">클릭</option></select></label>
      <button className="map-reset" onClick={()=>{setComparison('직전 동일기간');setAdvertiser(embedded?defaultAdvertiser:'');setActiveMedia('전체 비교');setAccount('');setRepresentativeKpi('leads');if(!embedded)setParams({}, {replace:true})}}>필터 초기화</button>
    </section>

    <nav className="map-media-tabs" aria-label="매체 선택">{channelLabels.map(name=><button key={name} className={activeMedia===name?'active':''} onClick={()=>chooseMedia(name)} style={name==='전체 비교'?undefined:{'--media-color':MEDIA_COLORS[name]} as CSSProperties}><span>{name==='전체 비교'?'전체':mediaIcon(name)}</span>{name}</button>)}</nav>

    <section className="map-kpi-grid">{kpis.map(metric=>{const current=metricValue(now,metric),previous=metricValue(prev,metric),change=pctChange(current,previous),cls=changeClass(metric,change); const Icon=metric==='spend'?WalletCards:metric==='impressions'?Eye:metric==='clicks'?MousePointerClick:metric==='leads'?Target:metric==='revenue'?CircleDollarSign:BarChart3; return <article className="map-kpi" key={metric}><div><span>{metricNames[metric]}</span><Icon size={17}/></div><strong>{formatMetric(metric,current)}</strong><small className={cls}>{change>=0?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>} {Math.abs(change).toFixed(1)}% <em>vs 비교기간</em></small></article>})}</section>

    <section className="map-summary"><Sparkles size={22}/><div><b>{selected?`${selected.name} 성과 분석`:'매체 성과 요약'}</b><p>{selected?`${selected.name} 건강 점수는 ${selected.healthScore}점이며 현재 판정은 ${selected.budgetVerdict}입니다.`:top?`${top.name}가 현재 가장 높은 종합 효율을 보이고 있습니다. ${low&&low.name!==top.name?`${low.name}는 우선 점검이 필요합니다.`:''}`:'분석 가능한 데이터가 없습니다.'}</p></div><Link to="/insights/performance">통합 성과 분석 <ChevronRight size={15}/></Link></section>

    <section className="map-main-grid">
      <article className="map-panel map-trend"><div className="map-panel-head"><div><h2>{selected?`${selected.name} 성과 추이`:'매체별 성과 추이'}</h2><p>{start} ~ {end}</p></div><div className="map-tabs">{trendMetrics.map(metric=><button key={metric} className={trendMetric===metric?'active':''} onClick={()=>setTrendMetric(metric)}>{metricNames[metric]}</button>)}</div></div>{selected?<><svg viewBox="0 0 100 82" preserveAspectRatio="none" className="map-line-chart"><line x1="8" y1="72" x2="100" y2="72"/><polyline className="previous" points={poly(previousDaily.map(day=>metricValue(day,trendMetric)))}/><polyline className="current" style={{stroke:MEDIA_COLORS[selected.name]}} points={poly(daily.map(day=>metricValue(day,trendMetric)))}/></svg><div className="map-chart-legend"><span><i style={{borderColor:MEDIA_COLORS[selected.name]}}/>현재 기간</span><span><i className="dash"/>비교 기간</span><b>{formatMetric(trendMetric,metricValue(now,trendMetric))}</b></div></>:<MultiMediaTrend rows={comparisonRows} data={data} start={start} end={end} advertiser={advertiser} metric={trendMetric}/>}</article>
      <article className="map-panel"><div className="map-panel-head"><div><h2>종합 효율 순위</h2><p>실제 성과 변화와 KPI 효율을 종합합니다.</p></div><select className="map-small-select" value={rankMetric} onChange={e=>setRankMetric(e.target.value as typeof rankMetric)}><option value="health">종합 효율</option><option value="achievement">KPI 달성률</option><option value="leads">전환</option><option value="cpa">CPA</option><option value="roas">ROAS</option><option value="revenue">매출</option></select></div><div className="map-ranking">{ranking.map((row,index)=><button key={row.name} onClick={()=>chooseMedia(row.name)}><span>{index+1}위</span><i style={{color:MEDIA_COLORS[row.name]}}>{mediaIcon(row.name)}</i><b>{row.name}</b><em><u style={{width:`${Math.max(8,row.healthScore)}%`,background:MEDIA_COLORS[row.name]}}/></em><strong>{rankMetric==='health'?`${row.healthScore}점`:rankMetric==='achievement'?`${(row.kpiAchievement??0).toFixed(0)}%`:formatMetric(rankMetric==='leads'?'leads':rankMetric==='cpa'?'cpa':rankMetric==='roas'?'roas':'revenue',rankMetric==='leads'?row.current.leads:rankMetric==='cpa'?row.current.cpa:rankMetric==='roas'?row.current.roas:row.current.revenue)}</strong></button>)}</div></article>
    </section>

    {selected ? <SelectedMediaDetail media={selected.name} summary={now} reportType={selectedReportType} campaigns={selectedCampaigns} /> : <>
      <section className="map-mid-grid"><article className="map-panel"><div className="map-panel-head"><div><h2>광고비 vs 성과 기여도</h2><p>광고비 점유율과 대표 성과 점유율 비교</p></div></div><div className="map-share-list">{comparisonRows.map(row=><div key={row.name}><div className="map-share-label"><b><i style={{background:MEDIA_COLORS[row.name]}}/>{row.name}</b><span>광고비 {row.spendShare.toFixed(1)}% · 성과 {row.performanceShare.toFixed(1)}%</span></div><div className="map-dual-bar"><i><b style={{width:`${Math.min(100,row.spendShare*2)}%`}}/></i><i><b style={{width:`${Math.min(100,row.performanceShare*2)}%`,background:MEDIA_COLORS[row.name]}}/></i></div></div>)}</div></article>
      <article className="map-panel"><div className="map-panel-head"><div><h2>KPI 목표 달성률</h2><p>KPI 관리 설정이 있으면 실제 목표와 비교합니다.</p></div></div><div className="map-kpi-achievement">{comparisonRows.slice(0,6).map(row=><div key={row.name}><b><i style={{background:MEDIA_COLORS[row.name]}}/>{row.name}</b><span>{row.kpiAchievement===undefined?'목표 미설정':`${row.kpiAchievement.toFixed(0)}%`}</span><em><u style={{width:`${Math.min(100,row.kpiAchievement??row.healthScore)}%`,background:MEDIA_COLORS[row.name]}}/></em><strong className={statusTone(row.kpiAchievement??row.healthScore)}>{mediaStatus(row.kpiAchievement??row.healthScore)}</strong></div>)}</div></article></section>
    </>}

    <section className="map-panel"><div className="map-panel-head"><div><h2>매체별 상세 성과</h2><p>검색·정렬 후 상세 분석으로 드릴다운할 수 있습니다.</p></div><div className="map-table-tools"><input value={tableQuery} onChange={e=>setTableQuery(e.target.value)} placeholder="매체 검색"/><select value={verdictFilter} onChange={e=>setVerdictFilter(e.target.value)}><option value="">판정 전체</option><option>효율적 확대</option><option>성장 기회</option><option>안정</option><option>유지</option><option>비효율 증가</option><option>축소 검토</option></select><select value={sortKey} onChange={e=>setSortKey(e.target.value as typeof sortKey)}><option value="health">종합 점수</option><option value="spend">광고비</option><option value="leads">DB</option><option value="cpa">CPA</option><option value="roas">ROAS</option></select><button onClick={()=>setSortDir(v=>v==='asc'?'desc':'asc')}>{sortDir==='asc'?'오름차순':'내림차순'}</button><button onClick={()=>{setTableQuery('');setVerdictFilter('');setSortKey('health');setSortDir('desc')}}>표 필터 초기화</button></div></div><div className="table-scroll"><table className="map-table"><thead><tr>
  <th className="sortable-th" onClick={()=>setSortKey('spend')}>매체{sortKey==='spend'?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  <th className="sortable-th" onClick={()=>setSortKey('spend')}>광고비{sortKey==='spend'?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  <th>노출</th><th>클릭</th><th>CTR</th><th>CPC</th>
  <th className="sortable-th" onClick={()=>setSortKey('leads')}>DB{sortKey==='leads'?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  <th className="sortable-th" onClick={()=>setSortKey('cpa')}>CPA{sortKey==='cpa'?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  <th>매출</th>
  <th className="sortable-th" onClick={()=>setSortKey('roas')}>ROAS{sortKey==='roas'?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  <th>KPI 달성</th>
  <th className="sortable-th" onClick={()=>setSortKey('health')}>종합{sortKey==='health'?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  <th>판정</th><th>상세</th>
</tr></thead><tbody>{filteredTableRows.map(row=><tr key={row.name}><td><span className="map-media-mark" style={{background:MEDIA_COLORS[row.name]}}/>{row.name}</td><td className="metric-emphasis">{formatMetric('spend',row.current.spend)}</td><td>{formatMetric('impressions',row.current.impressions)}</td><td>{formatMetric('clicks',row.current.clicks)}</td><td>{formatMetric('ctr',row.current.ctr)}</td><td>{row.current.clicks?formatMetric('cpa',{...row.current,cpa:row.current.spend/row.current.clicks}.cpa):'-'}</td><td><b>{formatMetric('leads',row.current.leads)}</b></td><td>{formatMetric('cpa',row.current.cpa)}</td><td>{formatMetric('revenue',row.current.revenue)}</td><td className={row.current.roas>=200?'metric-positive':row.current.roas>0&&row.current.roas<100?'metric-negative':''}>{formatMetric('roas',row.current.roas)}</td><td>{row.kpiAchievement===undefined?'-':`${row.kpiAchievement.toFixed(0)}%`}</td><td><b>{row.healthScore}점</b></td><td><span className={`map-verdict ${row.budgetVerdict.includes('비효율')||row.budgetVerdict.includes('축소')?'bad':row.budgetVerdict.includes('확대')||row.budgetVerdict.includes('기회')?'good':'neutral'}`}>{row.budgetVerdict}</span></td><td><button className="map-link" onClick={()=>chooseMedia(row.name)}>상세 분석</button></td></tr>)}</tbody></table></div></section>

    <section className="map-bottom-grid"><article className="map-panel"><h2>이상 징후</h2><div className="map-alert-list">{anomalies.length?anomalies.slice(0,4).map((item,index)=><div key={`${item.media}-${index}`} className={item.tone}><AlertTriangle size={17}/><div><b>{item.media} · {item.title}</b><small>{item.description}</small></div></div>):<div className="success"><Sparkles size={17}/><div><b>중대한 이상 징후 없음</b><small>현재 범위에서 즉시 대응이 필요한 변화가 없습니다.</small></div></div>}</div></article><article className="map-panel"><div className="map-panel-head"><div><h2>예산 확대 / 축소 후보</h2><p>예산 비중과 성과 기여도를 함께 봅니다.</p></div><Link to="/brands-budget">브랜드 예산에서 검토 <ChevronRight size={14}/></Link></div><div className="map-budget-list">{expand.map(row=><div key={`e-${row.name}`}><TrendingUp className="good"/><div><b>{row.name} 확대 검토</b><small>광고비 {row.spendShare.toFixed(1)}% · 성과 기여 {row.performanceShare.toFixed(1)}%</small></div><span className="good">확대</span></div>)}{reduce.map(row=><div key={`r-${row.name}`}><TrendingDown className="bad"/><div><b>{row.name} 축소 검토</b><small>CPA {row.cpaChange>=0?'+':''}{row.cpaChange.toFixed(0)}% · DB {row.leadChange>=0?'+':''}{row.leadChange.toFixed(0)}%</small></div><span className="bad">축소</span></div>)}{!expand.length&&!reduce.length&&<p className="map-empty">현재 뚜렷한 확대·축소 후보가 없습니다.</p>}</div></article><article className="map-panel map-insights"><h2>주요 인사이트</h2><ul><li><b>성과</b>{top?`${top.name}의 종합 효율 점수가 ${top.healthScore}점으로 가장 높습니다.`:'데이터가 부족합니다.'}</li><li><b>기여도</b>{budgetCandidates[0]?`${budgetCandidates[0].name}는 광고비 비중 대비 성과 기여도가 높습니다.`:'비교 데이터가 부족합니다.'}</li><li><b>주의</b>{anomalies[0]?`${anomalies[0].media}에서 ${anomalies[0].title}이 감지됐습니다.`:'중요 이상 징후가 없습니다.'}</li><li><b>추천</b>{expand[0]?`${expand[0].name}의 예산 확대를 검토하세요.`:reduce[0]?`${reduce[0].name}의 예산·캠페인을 우선 점검하세요.`:'현재 배분을 유지하면서 추이를 관찰하세요.'}</li></ul></article></section>
  </div>;
}

function MultiMediaTrend({rows,data,start,end,advertiser,metric}:{rows:ReturnType<typeof buildMediaComparison>;data:PerformanceDataset;start:string;end:string;advertiser:string;metric:PerformanceMetric}){
  const maxDays=[...new Set(data.media.filter(row=>(!advertiser||row.advertiser===advertiser)&&inRange(row.date,start,end)).map(row=>row.date))].sort();
  return <><svg viewBox="0 0 100 82" preserveAspectRatio="none" className="map-line-chart"><line x1="8" y1="72" x2="100" y2="72"/>{rows.slice(0,7).map(row=>{const series=maxDays.map(date=>derived(sumRows(data.media.filter(item=>item.media===row.name&&(!advertiser||item.advertiser===advertiser)&&item.date===date))));return <polyline key={row.name} style={{stroke:MEDIA_COLORS[row.name]}} points={poly(series.map(day=>metricValue(day,metric)))}/>})}</svg><div className="map-multi-legend">{rows.map(row=><span key={row.name}><i style={{background:MEDIA_COLORS[row.name]}}/>{row.name}</span>)}</div></>;
}

function SelectedMediaDetail({media,summary,reportType,campaigns}:{media:string;summary:ReturnType<typeof derived>;reportType?:string;campaigns:Campaign[]}){
  const funnel=buildFunnel(summary,reportType);
  return <section className="map-selected-grid"><article className="map-panel"><div className="map-panel-head"><div><h2>{media} 전환 퍼널</h2><p>현재 확보 가능한 공통 광고 데이터 기준입니다.</p></div></div><div className="map-funnel">{funnel.map((step,index)=><div key={step.label}><article><span>{step.label}</span><strong>{Math.round(step.value).toLocaleString()}</strong></article>{index<funnel.length-1&&<em>↓ <b>{funnel[index+1].rate?.toFixed(1)??'0.0'}%</b></em>}</div>)}</div></article><article className="map-panel"><div className="map-panel-head"><div><h2>{media} 캠페인 현황</h2><p>캠페인 관리 데이터와 연결합니다.</p></div><Link to="/campaigns">캠페인 관리 <ChevronRight size={14}/></Link></div>{campaigns.length?<div className="map-campaign-list">{campaigns.map(c=><div key={c.id}><span className={`map-campaign-state ${c.status}`}>{c.status==='on'?'ON':c.status==='off'?'OFF':c.status==='scheduled'?'예약':'확인'}</span><div><b>{c.name}</b><small>{c.accountName} · {c.budgetType==='daily'?'일':'총'} ₩{c.budget.toLocaleString()}</small></div><Link to="/campaigns">관리</Link></div>)}</div>:<div className="map-empty-detail"><b>연결된 캠페인 성과 데이터 없음</b><p>현재 광고 데이터에는 캠페인 단위 성과값이 없어서 임의의 성과 수치를 만들지 않았습니다. 캠페인 관리/API 데이터가 연결되면 여기에 실제 CPA·ROAS·전환이 표시됩니다.</p></div>}</article></section>;
}
