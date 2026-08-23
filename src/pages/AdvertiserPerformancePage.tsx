import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, ChevronRight, CircleDollarSign, Eye, Gauge, MousePointerClick, Sparkles, Target, TrendingDown, TrendingUp, Users, WalletCards } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Campaign } from '../types/operations';
import { derived, formatMetric, performanceDatasetFromMetricRows, metricValue, pctChange, sumRows, type PerformanceMetric, type PerformanceDataset } from '../analytics/integratedPerformance';
import { MEDIA_COLORS } from '../analytics/mediaAnalysis';
import { advertiserDailySeries, advertiserFunnel, advertiserMediaRows, buildAdvertiserComparison, comparisonRange, detectAdvertiserAnomalies, inRange, rangeFor, type AdvertiserComparisonRow, type AdvertiserStatus } from '../analytics/advertiserAnalysis';
import { useMetricRows } from '../hooks/useMetrics';
import type { DailyMetricRow } from '../types/metrics';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useMetricsQuery } from '../context/MetricsQueryContext';

const comparisonOptions=['직전 동일기간','전월','전년 동기간','비교 안 함'];
const statusOptions=['전체','우수','정상','주의','개선 필요','KPI 미설정'] as const;
const trendMetrics:PerformanceMetric[]=['spend','clicks','leads','cpa','revenue','roas','ctr'];
const metricNames:Record<PerformanceMetric,string>={spend:'광고비',impressions:'노출',clicks:'클릭',leads:'DB/전환',revenue:'매출',ctr:'CTR',cpa:'CPA',roas:'ROAS',cpc:'CPC'};

function hashColor(value:string){let h=0;for(let i=0;i<value.length;i++)h=(h*31+value.charCodeAt(i))>>>0;const colors=['#4776ff','#8b5cf6','#0ea5e9','#10b981','#f59e0b','#ef4444','#14b8a6','#6366f1'];return colors[h%colors.length];}
function poly(values:number[]){const max=Math.max(...values,1),min=Math.min(...values,0),span=max-min||1;return values.map((value,index)=>`${8+index/Math.max(1,values.length-1)*92},${72-(value-min)/span*58}`).join(' ');}
function tone(status:AdvertiserStatus){return status==='우수'?'good':status==='정상'?'neutral':status==='주의'?'warning':status==='개선 필요'?'bad':'muted';}
function changeTone(metric:PerformanceMetric,change:number){if(metric==='cpa') return change<0?'good':change>0?'bad':'neutral';if(['leads','revenue','roas','ctr','clicks'].includes(metric)) return change>0?'good':change<0?'bad':'neutral';return 'neutral';}
function kpiDisplay(row:AdvertiserComparisonRow){if(!row.goal)return '-';if(row.goal.goalType==='CPA')return formatMetric('cpa',row.goalTarget??0);if(row.goal.goalType==='CPC')return formatMetric('cpc',row.goalTarget??0);return formatMetric('roas',row.goalTarget??0);}
function actualKpiDisplay(row:AdvertiserComparisonRow){return formatMetric(row.primaryMetric,row.primaryValue);}
/** CPA/CPC처럼 가격 단위인 지표는 순수 %보다 "실제 얼마 (목표 얼마)"가 더 직관적이라, 비용형 지표는 이 형태로 보여줍니다. */
function achievementDisplay(row:AdvertiserComparisonRow){
  if(!row.goal||row.kpiAchievement===undefined)return '-';
  if(row.goal.goalType==='CPA'||row.goal.goalType==='CPC')return `${actualKpiDisplay(row)} (목표 ${kpiDisplay(row)})`;
  return `${row.kpiAchievement.toFixed(0)}%`;
}
function projectedLabel(row:AdvertiserComparisonRow){if(!row.goal?.monthlyTargetValue||row.monthKpiProjection===undefined)return '목표 데이터 없음';return `${Math.round(row.monthKpiProjection).toLocaleString()} / 목표 ${Math.round(row.goal.monthlyTargetValue).toLocaleString()}`;}

export function AdvertiserPerformancePage(){
  const {rows:metricRows}=useMetricRows<DailyMetricRow>('/metrics/daily');
  const data=useMemo(()=>performanceDatasetFromMetricRows(metricRows),[metricRows]);
  const {range}=useMetricsQuery();
  const [params,setParams]=useSearchParams();
  const [comparison,setComparison]=useState(params.get('compare')||'직전 동일기간');
  const [advertiser,setAdvertiser]=useState(params.get('advertiser')||'');
  const [status,setStatus]=useState<(typeof statusOptions)[number]>((params.get('status') as typeof statusOptions[number])||'전체');
  const [kpiFilter,setKpiFilter]=useState(params.get('kpi')||'전체');
  const [trendMetric,setTrendMetric]=useState<PerformanceMetric>('spend');
  const [tableQuery,setTableQuery]=useState('');
  const [sortKey,setSortKey]=useState<'achievement'|'health'|'risk'|'spend'|'leads'|'revenue'>('achievement');
  const [sortDir,setSortDir]=useState<'asc'|'desc'>('desc');
  const [tableStatus,setTableStatus]=useState('');

  const [start,end]=[range.from,range.to];const [prevStart,prevEnd]=comparisonRange(start,end,comparison);
  const allRows=useMemo(()=>buildAdvertiserComparison(data,start,end,prevStart,prevEnd),[data,start,end,prevStart,prevEnd]);
  const filteredRows=useMemo(()=>allRows.filter(row=>{
    if(status!=='전체'&&row.status!==status)return false;
    if(kpiFilter==='CPA'&&row.goal?.goalType!=='CPA')return false;
    if(kpiFilter==='ROAS'&&row.goal?.goalType!=='ROAS')return false;
    if(kpiFilter==='CPC'&&row.goal?.goalType!=='CPC')return false;
    if(kpiFilter==='미설정'&&row.goal)return false;
    return true;
  }),[allRows,status,kpiFilter]);
  const selected=advertiser?allRows.find(row=>row.name===advertiser)||null:null;
  const anomalies=detectAdvertiserAnomalies(selected?allRows.filter(row=>row.name===selected.name):filteredRows);
  const portfolio=derived(sumRows(data.totals.filter(row=>inRange(row.date,start,end))));
  const configured=filteredRows.filter(row=>row.kpiAchievement!==undefined);
  const achieved=configured.filter(row=>(row.kpiAchievement??0)>=100).length;
  const warningCount=filteredRows.filter(row=>row.status==='주의').length;
  const improveCount=filteredRows.filter(row=>row.status==='개선 필요').length;
  const avgAchievement=configured.length?configured.reduce((a,b)=>a+(b.kpiAchievement??0),0)/configured.length:0;
  const syncParams=(patch:Record<string,string>)=>{const next=new URLSearchParams(params);Object.entries(patch).forEach(([k,v])=>v?next.set(k,v):next.delete(k));setParams(next,{replace:true});};
  const chooseAdvertiser=(name:string)=>{setAdvertiser(name);syncParams({advertiser:name});};

  const ranking=[...filteredRows].filter(row=>row.kpiAchievement!==undefined).sort((a,b)=>(b.kpiAchievement??0)-(a.kpiAchievement??0)).slice(0,6);
  const priority=[...filteredRows].sort((a,b)=>b.riskScore-a.riskScore).filter(row=>row.riskScore>=30).slice(0,4);
  const expand=[...filteredRows].filter(row=>(row.kpiAchievement??0)>=110&&row.riskScore<35&&row.budgetState!=='초과 예상').sort((a,b)=>(b.kpiAchievement??0)-(a.kpiAchievement??0)).slice(0,4);
  const tableRows=[...filteredRows].filter(row=>(!tableQuery.trim()||row.name.includes(tableQuery.trim()))&&(!tableStatus||row.status===tableStatus)).sort((a,b)=>{
    const value=(row:AdvertiserComparisonRow)=>sortKey==='achievement'?(row.kpiAchievement??-1):sortKey==='health'?(row.healthScore??-1):sortKey==='risk'?row.riskScore:sortKey==='spend'?row.current.spend:sortKey==='leads'?row.current.leads:row.current.revenue;
    const diff=value(a)-value(b);return sortDir==='asc'?diff:-diff;
  });
  const best=ranking[0],worst=[...configured].sort((a,b)=>(a.kpiAchievement??0)-(b.kpiAchievement??0))[0];

  return <div className="advertiser-analysis-page">
    <header className="aap-head"><div><span>인사이트</span><h1>{selected?`광고주별 분석 ${selected.name}`:'광고주별 분석'}</h1><p>광고주별 KPI 목표, 예산 집행, 매체 기여도와 관리 우선순위를 한눈에 분석합니다.</p></div><div className="aap-data-badge">데이터 기준 <b>{data.latestDate||'-'}</b></div></header>

    <MetricsDateBar compact/>

    <section className="aap-filter-card">
      <label>비교기간<select value={comparison} onChange={e=>{setComparison(e.target.value);syncParams({compare:e.target.value})}}>{comparisonOptions.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>광고주<select value={advertiser} onChange={e=>chooseAdvertiser(e.target.value)}><option value="">전체 광고주</option>{data.advertisers.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>대표 KPI<select value={kpiFilter} onChange={e=>{setKpiFilter(e.target.value);syncParams({kpi:e.target.value==='전체'?'':e.target.value})}}><option>전체</option><option>CPA</option><option>ROAS</option><option>CPC</option><option value="미설정">KPI 미설정</option></select></label>
      <label>상태<select value={status} onChange={e=>{const value=e.target.value as typeof status;setStatus(value);syncParams({status:value==='전체'?'':value})}}>{statusOptions.map(v=><option key={v}>{v}</option>)}</select></label>
      <button className="aap-reset" onClick={()=>{setComparison('직전 동일기간');setAdvertiser('');setStatus('전체');setKpiFilter('전체');setParams({}, {replace:true})}}>필터 초기화</button>
    </section>

    {selected?<SelectedAdvertiserSummary row={selected} data={data} start={start} end={end} prevStart={prevStart} prevEnd={prevEnd} trendMetric={trendMetric} setTrendMetric={setTrendMetric}/>:<>
      <section className="aap-kpi-grid">
        <Kpi icon={<Users/>} label="운영 광고주" value={`${filteredRows.length}개`} sub={`${configured.length}개 KPI 설정`}/>
        <Kpi icon={<WalletCards/>} label="총 광고비" value={formatMetric('spend',portfolio.spend)} sub={`${start} ~ ${end}`}/>
        <Kpi icon={<Target/>} label="총 전환" value={formatMetric('leads',portfolio.leads)} sub="전체 광고주 합계"/>
        <Kpi icon={<CircleDollarSign/>} label="총 매출" value={formatMetric('revenue',portfolio.revenue)} sub={portfolio.revenue?'매출 데이터 포함':'매출 데이터 없음'}/>
        <Kpi icon={<Gauge/>} label="KPI 달성 광고주" value={`${achieved}개`} sub={configured.length?`${(achieved/configured.length*100).toFixed(1)}%`:'KPI 설정 필요'}/>
        <Kpi icon={<AlertTriangle/>} label="주의 광고주" value={`${warningCount}개`} sub="KPI 70~89%" tone="warning"/>
        <Kpi icon={<TrendingDown/>} label="개선 필요" value={`${improveCount}개`} sub="KPI 70% 미만" tone="bad"/>
        <Kpi icon={<BarChart3/>} label="평균 KPI 달성률" value={configured.length?`${avgAchievement.toFixed(1)}%`:'-'} sub={configured.length?'설정 광고주 평균':'KPI 설정 데이터 없음'}/>
      </section>

      <section className="aap-summary"><Sparkles size={22}/><div><b>광고주 성과 요약</b><p>{best?`현재 ${best.name}의 KPI 달성률이 ${best.kpiAchievement?.toFixed(0)}%로 가장 높습니다. ${worst&&worst.name!==best.name?`${worst.name}는 ${worst.kpiAchievement?.toFixed(0)}%로 우선 점검이 필요합니다.`:''}`:'KPI 목표가 설정된 광고주가 없습니다.'}</p></div><Link to="/kpi-goals">KPI 관리 <ChevronRight size={14}/></Link></section>

      <section className="aap-main-grid">
        <AdvertiserMatrix rows={filteredRows} choose={chooseAdvertiser}/>
        <article className="aap-panel"><div className="aap-panel-head"><div><h2>KPI 달성 순위</h2><p>광고주별 서로 다른 KPI를 목표 달성률로 정규화합니다.</p></div></div><div className="aap-ranking">{ranking.length?ranking.map((row,index)=><button key={row.name} onClick={()=>chooseAdvertiser(row.name)}><span>{index+1}위</span><i style={{background:hashColor(row.name)}}/><b>{row.name}</b><em><u style={{width:`${Math.min(100,row.kpiAchievement??0)}%`}}/></em><strong>{row.kpiAchievement?.toFixed(0)}%</strong></button>):<p className="aap-empty">KPI 설정 데이터가 없습니다.</p>}</div></article>
      </section>

      <section className="aap-mid-grid">
        <AdvertiserTrend rows={filteredRows} data={data} start={start} end={end} metric={trendMetric} onMetric={setTrendMetric}/>
        <article className="aap-panel"><div className="aap-panel-head"><div><h2>광고비 vs KPI 성과 비중</h2><p>광고비 비중과 KPI 달성 성과 비중을 비교합니다.</p></div></div><div className="aap-share-list">{filteredRows.filter(r=>r.kpiAchievement!==undefined).slice(0,8).map(row=><div key={row.name}><div><b><i style={{background:hashColor(row.name)}}/>{row.name}</b><span>광고비 {row.spendShare.toFixed(1)}% · KPI 성과 {row.contributionShare.toFixed(1)}%</span></div><section><i><u style={{width:`${Math.min(100,row.spendShare*2)}%`}}/></i><i><u style={{width:`${Math.min(100,row.contributionShare*2)}%`,background:hashColor(row.name)}}/></i></section></div>)}</div></article>
      </section>
    </>}

    {!selected&&<section className="aap-panel"><div className="aap-panel-head"><div><h2>광고주별 상세 성과</h2><p>상태·KPI·성과를 비교하고 필요한 광고주만 상세 분석합니다.</p></div><div className="aap-table-tools"><input value={tableQuery} onChange={e=>setTableQuery(e.target.value)} placeholder="광고주 검색"/><select value={tableStatus} onChange={e=>setTableStatus(e.target.value)}><option value="">상태 전체</option>{statusOptions.filter(v=>v!=='전체').map(v=><option key={v}>{v}</option>)}</select><select value={sortKey} onChange={e=>setSortKey(e.target.value as typeof sortKey)}><option value="achievement">KPI 달성률</option><option value="health">건강점수</option><option value="risk">위험점수</option><option value="spend">광고비</option><option value="leads">전환</option><option value="revenue">매출</option></select><button onClick={()=>setSortDir(v=>v==='asc'?'desc':'asc')}>{sortDir==='asc'?'오름차순':'내림차순'}</button><button onClick={()=>{setTableQuery('');setTableStatus('');setSortKey('achievement');setSortDir('desc')}}>표 필터 초기화</button></div></div><div className="table-scroll"><table className="aap-table"><thead><tr>
  <th>광고주</th><th>대표 KPI</th><th>목표</th><th>실제</th>
  <th className="sortable-th" onClick={()=>setSortKey('achievement')}>달성률{sortKey==='achievement'?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  <th className="sortable-th" onClick={()=>setSortKey('spend')}>광고비{sortKey==='spend'?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  <th className="sortable-th" onClick={()=>setSortKey('leads')}>전환{sortKey==='leads'?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  <th>CPA</th>
  <th className="sortable-th" onClick={()=>setSortKey('revenue')}>매출{sortKey==='revenue'?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  <th>ROAS</th><th>최고 매체</th>
  <th className="sortable-th" onClick={()=>setSortKey('health')}>건강점수{sortKey==='health'?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  <th className="sortable-th" onClick={()=>setSortKey('risk')}>위험점수{sortKey==='risk'?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  <th>상태</th><th>상세</th>
</tr></thead><tbody>{tableRows.map(row=><tr key={row.name}><td><span className="aap-advertiser-dot" style={{background:hashColor(row.name)}}/>{row.name}</td><td>{row.goal?row.primaryLabel:'미설정'}</td><td>{kpiDisplay(row)}</td><td>{actualKpiDisplay(row)}</td><td className={row.kpiAchievement!==undefined&&row.kpiAchievement>=100?'metric-positive':''}>{achievementDisplay(row)}</td><td className="metric-emphasis">{formatMetric('spend',row.current.spend)}</td><td><b>{formatMetric('leads',row.current.leads)}</b></td><td>{formatMetric('cpa',row.current.cpa)}</td><td>{formatMetric('revenue',row.current.revenue)}</td><td className={row.current.roas>=200?'metric-positive':row.current.roas>0&&row.current.roas<100?'metric-negative':''}>{formatMetric('roas',row.current.roas)}</td><td>{row.topMedia||'-'}</td><td>{row.healthScore===undefined?'평가 보류':`${row.healthScore}점`}</td><td><b className={row.riskScore>=70?'bad':row.riskScore>=50?'warning':'neutral'}>{row.riskScore}점</b></td><td><span className={`aap-status ${tone(row.status)}`}>{row.status}</span></td><td><button className="aap-link" onClick={()=>chooseAdvertiser(row.name)}>상세 분석</button></td></tr>)}</tbody></table></div></section>}

    {!selected&&<section className="aap-movers-grid"><article className="aap-panel"><h2>성과 개선 TOP 5</h2><div className="aap-mover-list">{[...filteredRows].map(row=>({row,score:row.primaryMetric==='cpa'?-row.primaryChange:row.primaryChange})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,5).map((item,index)=><button key={item.row.name} onClick={()=>chooseAdvertiser(item.row.name)}><span>{index+1}</span><div><b>{item.row.name}</b><small>{item.row.primaryLabel} {item.score.toFixed(1)}% 개선</small></div><strong className="good">▲ {item.score.toFixed(1)}%</strong></button>)}</div></article><article className="aap-panel"><h2>성과 악화 TOP 5</h2><div className="aap-mover-list">{[...filteredRows].map(row=>({row,score:row.primaryMetric==='cpa'?-row.primaryChange:row.primaryChange})).filter(item=>item.score<0).sort((a,b)=>a.score-b.score).slice(0,5).map((item,index)=><button key={item.row.name} onClick={()=>chooseAdvertiser(item.row.name)}><span>{index+1}</span><div><b>{item.row.name}</b><small>{item.row.primaryLabel} {Math.abs(item.score).toFixed(1)}% 악화</small></div><strong className="bad">▼ {Math.abs(item.score).toFixed(1)}%</strong></button>)}</div></article></section>}

    {!selected&&<section className="aap-bottom-grid">
      <article className="aap-panel"><h2>관리 우선순위</h2><div className="aap-action-list">{priority.length?priority.map((row,index)=><button key={row.name} onClick={()=>chooseAdvertiser(row.name)}><span className="rank">{index+1}</span><div><b>{row.name}</b><small>위험 {row.riskScore}점 · KPI {row.kpiAchievement===undefined?'미설정':`${row.kpiAchievement.toFixed(0)}%`} · {row.budgetState}</small></div><ChevronRight size={14}/></button>):<p className="aap-empty">현재 높은 위험 점수의 광고주가 없습니다.</p>}</div></article>
      <article className="aap-panel"><div className="aap-panel-head"><div><h2>확대 후보</h2><p>KPI 초과 달성과 예산 상태를 함께 판단합니다.</p></div><Link to="/brands-budget">브랜드 예산 <ChevronRight size={14}/></Link></div><div className="aap-action-list">{expand.length?expand.map(row=><button key={row.name} onClick={()=>chooseAdvertiser(row.name)}><TrendingUp className="good" size={17}/><div><b>{row.name}</b><small>KPI {row.kpiAchievement?.toFixed(0)}% · {row.topMedia?`최고 매체 ${row.topMedia}`:'매체 데이터 확인 필요'}</small></div><span className="good">검토</span></button>):<p className="aap-empty">현재 뚜렷한 확대 후보가 없습니다.</p>}</div></article>
      <article className="aap-panel"><h2>이상 징후</h2><div className="aap-alert-list">{anomalies.length?anomalies.slice(0,4).map((item,index)=><div key={`${item.advertiser}-${index}`} className={item.tone}><AlertTriangle size={16}/><div><b>{item.advertiser} · {item.title}</b><small>{item.description}</small></div></div>):<div className="success"><Sparkles size={16}/><div><b>중대한 이상 징후 없음</b><small>현재 범위에서 즉시 대응이 필요한 변화가 없습니다.</small></div></div>}</div></article>
    </section>}

    <section className="aap-panel aap-insights"><h2>주요 인사이트</h2><ul>{selected?<SelectedInsights row={selected}/>:<><li><b>성과</b>{best?`${best.name}의 KPI 달성률이 ${best.kpiAchievement?.toFixed(0)}%로 가장 높습니다.`:'KPI 설정 광고주가 없습니다.'}</li><li><b>관리</b>{priority[0]?`${priority[0].name}의 위험점수가 ${priority[0].riskScore}점으로 가장 높아 우선 확인이 필요합니다.`:'현재 즉시 관리가 필요한 고위험 광고주는 없습니다.'}</li><li><b>확대</b>{expand[0]?`${expand[0].name}은 KPI 달성률 ${expand[0].kpiAchievement?.toFixed(0)}%로 추가 예산 검토 가치가 있습니다.`:'명확한 확대 후보가 없습니다.'}</li><li><b>주의</b>{anomalies[0]?`${anomalies[0].advertiser}에서 ${anomalies[0].title}이 감지됐습니다.`:'중요 이상 징후가 없습니다.'}</li></>}</ul></section>
  </div>;
}

function Kpi({icon,label,value,sub,tone=''}:{icon:ReactNode;label:string;value:string;sub:string;tone?:string}){return <article className={`aap-kpi ${tone}`}><div><span>{label}</span>{icon}</div><strong>{value}</strong><small>{sub}</small></article>}

function AdvertiserMatrix({rows,choose}:{rows:AdvertiserComparisonRow[];choose:(name:string)=>void}){
  const points=rows.filter(row=>row.kpiAchievement!==undefined&&row.current.spend>0);
  const maxSpend=Math.max(...points.map(row=>row.current.spend),1);const maxAch=Math.max(150,...points.map(row=>row.kpiAchievement??0));
  return <article className="aap-panel aap-matrix"><div className="aap-panel-head"><div><h2>광고비 vs KPI 달성률</h2><p>오른쪽 아래일수록 광고비는 크지만 KPI 성과가 낮아 우선 점검 대상입니다.</p></div></div><div className="aap-matrix-wrap"><span className="zone z1">확대 가능성</span><span className="zone z2">핵심 성장</span><span className="zone z3">관찰</span><span className="zone z4">최우선 개선</span><i className="vline"/><i className="hline"/>{points.map(row=>{const x=8+row.current.spend/maxSpend*84;const y=88-(row.kpiAchievement??0)/maxAch*76;return <button key={row.name} className="matrix-dot" style={{left:`${x}%`,top:`${y}%`,background:hashColor(row.name)}} onClick={()=>choose(row.name)} title={`${row.name} · 광고비 ${formatMetric('spend',row.current.spend)} · KPI ${row.kpiAchievement?.toFixed(0)}%`}><span>{row.name}</span></button>})}</div><div className="aap-axis"><span>KPI 달성률 ↑</span><span>광고비 →</span></div></article>;
}

function AdvertiserTrend({rows,data,start,end,metric,onMetric}:{rows:AdvertiserComparisonRow[];data:PerformanceDataset;start:string;end:string;metric:PerformanceMetric;onMetric:(m:PerformanceMetric)=>void}){
  const top=[...rows].sort((a,b)=>(b.kpiAchievement??b.current.spend)-(a.kpiAchievement??a.current.spend)).slice(0,5);
  const dates=[...new Set(data.totals.filter(row=>inRange(row.date,start,end)).map(row=>row.date))].sort();
  return <article className="aap-panel"><div className="aap-panel-head"><div><h2>광고주별 성과 추이</h2><p>TOP 5 광고주 또는 KPI 설정 광고주의 흐름을 비교합니다.</p></div><div className="aap-tabs">{trendMetrics.map(m=><button key={m} className={metric===m?'active':''} onClick={()=>onMetric(m)}>{metricNames[m]}</button>)}</div></div><svg viewBox="0 0 100 82" preserveAspectRatio="none" className="aap-line-chart"><line x1="8" y1="72" x2="100" y2="72"/>{top.map(row=>{const series=dates.map(date=>derived(sumRows(data.totals.filter(item=>item.advertiser===row.name&&item.date===date))));return <polyline key={row.name} style={{stroke:hashColor(row.name)}} points={poly(series.map(day=>metricValue(day,metric)))}/>})}</svg><div className="aap-legend">{top.map(row=><span key={row.name}><i style={{background:hashColor(row.name)}}/>{row.name}</span>)}</div></article>;
}

function SelectedAdvertiserSummary({row,data,start,end,prevStart,prevEnd,trendMetric,setTrendMetric}:{row:AdvertiserComparisonRow;data:PerformanceDataset;start:string;end:string;prevStart:string;prevEnd:string;trendMetric:PerformanceMetric;setTrendMetric:(m:PerformanceMetric)=>void}){
  const currentRows=data.totals.filter(item=>item.advertiser===row.name&&inRange(item.date,start,end));const prevRows=data.totals.filter(item=>item.advertiser===row.name&&inRange(item.date,prevStart,prevEnd));
  const now=derived(sumRows(currentRows)),prev=derived(sumRows(prevRows));const daily=advertiserDailySeries(data,row.name,start,end),previousDaily=advertiserDailySeries(data,row.name,prevStart,prevEnd);const mediaRows=advertiserMediaRows(data,row.name,start,end);const funnel=advertiserFunnel(now,row.reportType);
  const campaigns:Campaign[]=[];
  const detailMetrics:PerformanceMetric[]=['spend',row.reportType==='revenue'?'revenue':row.reportType==='lead'?'leads':'clicks','cpa','roas'];
  return <>
    <section className="aap-detail-kpis">{detailMetrics.map(metric=>{const n=metricValue(now,metric),p=metricValue(prev,metric),change=pctChange(n,p);return <article key={metric}><span>{metricNames[metric]}</span><strong>{formatMetric(metric,n)}</strong><small className={changeTone(metric,change)}>{change>=0?<ArrowUpRight size={12}/>:<ArrowDownRight size={12}/>} {Math.abs(change).toFixed(1)}% <em>vs 비교기간</em></small></article>})}<article><span>KPI 달성률</span><strong>{row.kpiAchievement===undefined?'-':`${row.kpiAchievement.toFixed(0)}%`}</strong><small className={tone(row.status)}>{row.status}</small></article><article><span>건강 / 위험</span><strong>{row.healthScore===undefined?'평가 보류':`${row.healthScore}점`}</strong><small className={row.riskScore>=70?'bad':row.riskScore>=50?'warning':'neutral'}>위험 {row.riskScore}점</small></article></section>

    <section className="aap-main-grid"><article className="aap-panel"><div className="aap-panel-head"><div><h2>{row.name} 성과 추이</h2><p>{start} ~ {end}</p></div><div className="aap-tabs">{trendMetrics.map(m=><button key={m} className={trendMetric===m?'active':''} onClick={()=>setTrendMetric(m)}>{metricNames[m]}</button>)}</div></div><svg viewBox="0 0 100 82" preserveAspectRatio="none" className="aap-line-chart"><line x1="8" y1="72" x2="100" y2="72"/><polyline className="previous" points={poly(previousDaily.map(day=>metricValue(day,trendMetric)))}/><polyline className="current" style={{stroke:hashColor(row.name)}} points={poly(daily.map(day=>metricValue(day,trendMetric)))}/></svg><div className="aap-chart-summary"><span>현재 기간</span><span>비교 기간</span><b>{formatMetric(trendMetric,metricValue(now,trendMetric))}</b></div></article>
    <article className="aap-panel"><div className="aap-panel-head"><div><h2>KPI 목표 예산 진행</h2><p>현재 추세 기준 월말 예상이며 AI 예측이 아닙니다.</p></div><Link to="/kpi-goals">KPI 관리 <ChevronRight size={14}/></Link></div><div className="aap-progress-box"><div><span>대표 KPI</span><b>{row.goal?`${row.primaryLabel} 목표 ${kpiDisplay(row)}`:'미설정'}</b></div><div><span>현재 달성률</span><b>{achievementDisplay(row)}</b></div><div><span>현재 추세 월말 KPI</span><b>{projectedLabel(row)}</b></div><div><span>월 광고 예산</span><b>{row.monthlyBudget?formatMetric('spend',row.monthlyBudget):'미설정'}</b></div><div><span>현재 월 광고비</span><b>{formatMetric('spend',row.monthSpend)}</b></div><div><span>현재 추세 월말 광고비</span><b>{row.monthBudgetProjection===undefined?'-':formatMetric('spend',row.monthBudgetProjection)}</b></div><div className={`forecast ${row.budgetState==='초과 예상'?'bad':row.budgetState==='미소진 예상'?'warning':'good'}`}><span>예산 판정</span><b>{row.budgetState}</b></div></div></article></section>

    <section className="aap-mid-grid"><article className="aap-panel"><div className="aap-panel-head"><div><h2>매체별 성과</h2><p>광고주 내부에서 어떤 매체가 성과를 이끄는지 확인합니다.</p></div></div><div className="aap-media-list">{mediaRows.length?mediaRows.map(item=><div key={item.media}><i style={{background:MEDIA_COLORS[item.media]}}/><div><b>{item.media}</b><small>광고비 {item.spendShare.toFixed(1)}% · {row.reportType==='revenue'?`매출 ${item.revenueShare.toFixed(1)}%`:`DB ${item.leadShare.toFixed(1)}%`}</small></div><strong>{row.reportType==='revenue'?formatMetric('roas',item.summary.roas):row.reportType==='lead'?formatMetric('cpa',item.summary.cpa):formatMetric('clicks',item.summary.clicks)}</strong><Link to={`/insights/media?advertiser=${encodeURIComponent(row.name)}&channel=${encodeURIComponent(item.media)}&period=최근%2030일`}>매체 분석</Link></div>):<p className="aap-empty">매체별 데이터가 없습니다.</p>}</div></article><article className="aap-panel"><div className="aap-panel-head"><div><h2>전환 퍼널</h2><p>현재 확보된 공통 광고 데이터만 표시합니다.</p></div></div><div className="aap-funnel">{funnel.map((step,index)=><div key={step.label}><article><span>{step.label}</span><strong>{Math.round(step.value).toLocaleString()}</strong></article>{index<funnel.length-1&&<em>↓ <b>{funnel[index+1].rate?.toFixed(1)??'0.0'}%</b></em>}</div>)}</div></article></section>

    <section className="aap-panel"><div className="aap-panel-head"><div><h2>캠페인 현황</h2><p>현재 캠페인 관리 데이터와 연결합니다. 성과값이 없는 캠페인은 임의 숫자를 만들지 않습니다.</p></div><Link to="/campaigns">캠페인 관리 <ChevronRight size={14}/></Link></div>{campaigns.length?<div className="aap-campaign-list">{campaigns.map(c=><div key={c.id}><span className={`state ${c.status}`}>{c.status==='on'?'ON':c.status==='off'?'OFF':c.status==='scheduled'?'예약':'확인'}</span><div><b>{c.name}</b><small>{c.accountName} · {c.budgetType==='daily'?'일':'총'} ₩{c.budget.toLocaleString()}</small></div><Link to="/campaigns">관리</Link></div>)}</div>:<div className="aap-empty-detail"><b>연결된 캠페인 데이터 없음</b><p>현재 광고주명과 캠페인 관리 데이터가 연결되지 않았거나 캠페인 단위 성과 데이터가 없습니다.</p></div>}</section>
  </>;
}

function SelectedInsights({row}:{row:AdvertiserComparisonRow}){return <><li><b>KPI</b>{row.kpiAchievement===undefined?'대표 KPI가 설정되지 않아 달성률 평가는 보류합니다.':`${row.name}의 대표 KPI 달성률은 ${row.kpiAchievement.toFixed(0)}%입니다.`}</li><li><b>매체</b>{row.topMedia?`${row.topMedia}가 현재 대표 성과 기여가 가장 높은 매체입니다.`:'매체별 성과 데이터가 없습니다.'}</li><li><b>예산</b>{row.monthlyBudget?`현재 추세 기준 월말 광고비는 ${row.monthBudgetProjection===undefined?'-':formatMetric('spend',row.monthBudgetProjection)}이며 판정은 ${row.budgetState}입니다.`:'월 예산이 설정되지 않았습니다.'}</li><li><b>관리</b>{row.riskScore>=70?'즉시 점검이 권장됩니다.':row.riskScore>=50?'주의 관찰이 필요합니다.':'현재 위험도는 비교적 낮습니다.'}</li></>}
