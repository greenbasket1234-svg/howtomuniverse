import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, CalendarClock, ChevronRight, CircleDollarSign, Database, Gauge, MousePointerClick, PauseCircle, PlayCircle, Search, Sparkles, Target, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatMetric, loadPerformanceDataset, metricValue, type PerformanceMetric } from '../analytics/integratedPerformance';
import { MEDIA_COLORS } from '../analytics/mediaAnalysis';
import {
  buildCampaignComparison,
  campaignChangeDrivers,
  campaignDailySeries,
  campaignFunnel,
  campaignPreviousDailySeries,
  campaignScheduleEvents,
  campaignStatusLabel,
  comparisonRange,
  detectCampaignAnomalies,
  loadCampaigns,
  rangeFor,
  type CampaignAnalysisStatus,
  type CampaignComparisonRow,
} from '../analytics/campaignAnalysis';
import { useDbDataRevision } from '../hooks/useDbDataRevision';
import { loadDbRows, summarizeDbRows } from '../utils/dbDataStore';

const periodOptions=['오늘','어제','최근 7일','최근 14일','최근 30일','이번 달','지난달'];
const comparisonOptions=['직전 동일기간','전월','전년 동기간','비교 안 함'];
const analysisStatusOptions=['전체','우수','정상','주의','개선 필요','KPI 미설정','성과 데이터 없음'] as const;
const trendMetrics:PerformanceMetric[]=['spend','clicks','leads','cpa','revenue','roas','ctr'];
const metricNames:Record<PerformanceMetric,string>={spend:'광고비',impressions:'노출',clicks:'클릭',leads:'DB/전환',revenue:'매출',ctr:'CTR',cpa:'CPA',roas:'ROAS'};

function campaignColor(row:CampaignComparisonRow){ return MEDIA_COLORS[row.mediaName]||'#4776ff'; }
function clamp(value:number,min=0,max=100){ return Math.max(min,Math.min(max,value)); }
function poly(values:number[]){const max=Math.max(...values,1),min=Math.min(...values,0),span=max-min||1;return values.map((value,index)=>`${8+index/Math.max(1,values.length-1)*92},${72-(value-min)/span*58}`).join(' ');}
function analysisTone(status:CampaignAnalysisStatus){return status==='우수'?'good':status==='정상'?'neutral':status==='주의'?'warning':status==='개선 필요'?'bad':'muted';}
function campaignStateTone(status:CampaignComparisonRow['campaign']['status']){return status==='on'?'good':status==='scheduled'?'info':status==='error'?'bad':status==='review'?'warning':'muted';}
function budgetTone(state:CampaignComparisonRow['budgetState']){return state==='과소진 위험'||state==='미소진 위험'?'bad':state==='빠른 소진'||state==='느린 소진'?'warning':state==='정상'?'good':'muted';}
function verdictTone(value:CampaignComparisonRow['budgetVerdict']){return value==='확대 검토'?'good':value==='축소 검토'?'bad':value==='구조 점검'?'warning':value==='유지'?'neutral':'muted';}
function changeTone(metric:PerformanceMetric,change:number){if(metric==='cpa')return change<0?'good':change>0?'bad':'neutral';if(['leads','revenue','roas','ctr','clicks'].includes(metric))return change>0?'good':change<0?'bad':'neutral';return 'neutral';}
function numberChange(value:number){return `${value>=0?'+':''}${value.toFixed(1)}%`;}
function valueForTrend(row:CampaignComparisonRow,metric:PerformanceMetric){return metricValue(row.current,metric);}
function statusIcon(status:CampaignComparisonRow['campaign']['status']){return status==='on'?<PlayCircle/>:status==='off'?<PauseCircle/>:<CalendarClock/>;}

export function CampaignAnalysisPage(){
  const dbRevision=useDbDataRevision();
  const data=useMemo(()=>loadPerformanceDataset(),[dbRevision]);
  const campaigns=useMemo(()=>loadCampaigns(),[]);
  const [params,setParams]=useSearchParams();
  const [period,setPeriod]=useState(params.get('period')||'최근 30일');
  const [comparison,setComparison]=useState(params.get('compare')||'직전 동일기간');
  const [advertiser,setAdvertiser]=useState(params.get('advertiser')||'');
  const [media,setMedia]=useState(params.get('channel')||'');
  const [campaignId,setCampaignId]=useState(params.get('campaign')||'');
  const [analysisStatus,setAnalysisStatus]=useState<(typeof analysisStatusOptions)[number]>((params.get('status') as typeof analysisStatusOptions[number])||'전체');
  const [trendMetric,setTrendMetric]=useState<PerformanceMetric>('spend');
  const [tableQuery,setTableQuery]=useState('');
  const [tableVerdict,setTableVerdict]=useState('');
  const [sortKey,setSortKey]=useState<'risk'|'health'|'spend'|'achievement'|'budget'>('risk');
  const [sortDir,setSortDir]=useState<'asc'|'desc'>('desc');

  const [start,end]=rangeFor(period,data.latestDate);
  const [prevStart,prevEnd]=comparisonRange(start,end,comparison);
  const allRows=useMemo(()=>buildCampaignComparison(data,start,end,prevStart,prevEnd,campaigns),[data,start,end,prevStart,prevEnd,campaigns]);
  const advertisers=useMemo(()=>Array.from(new Set<string>(allRows.map(row=>row.advertiserName))).sort((a,b)=>a.localeCompare(b,'ko')),[allRows]);
  const medias=useMemo(()=>Array.from(new Set<string>(allRows.filter(row=>!advertiser||row.advertiserName===advertiser).map(row=>row.mediaName))).sort((a,b)=>a.localeCompare(b,'ko')),[allRows,advertiser]);
  const filteredCampaignOptions=allRows.filter(row=>(!advertiser||row.advertiserName===advertiser)&&(!media||row.mediaName===media));
  const filteredRows=useMemo(()=>allRows.filter(row=>(!advertiser||row.advertiserName===advertiser)&&(!media||row.mediaName===media)&&(analysisStatus==='전체'||row.analysisStatus===analysisStatus)),[allRows,advertiser,media,analysisStatus]);
  const selected=campaignId?allRows.find(row=>row.campaign.id===campaignId)||null:null;
  const anomalies=detectCampaignAnomalies(selected?[selected]:filteredRows);
  const dataRows=filteredRows.filter(row=>row.attribution!=='none');
  const activeCount=filteredRows.filter(row=>row.campaign.status==='on').length;
  const totalSpend=dataRows.reduce((sum,row)=>sum+row.current.spend,0);
  const totalClicks=dataRows.reduce((sum,row)=>sum+row.current.clicks,0);
  const totalLeads=dataRows.reduce((sum,row)=>sum+row.current.leads,0);
  const totalRevenue=dataRows.reduce((sum,row)=>sum+row.current.revenue,0);
  const avgCpa=totalLeads?totalSpend/totalLeads:0;
  const avgRoas=totalSpend?totalRevenue/totalSpend*100:0;
  const configured=dataRows.filter(row=>row.kpiAchievement!==undefined);
  const achieved=configured.filter(row=>(row.kpiAchievement??0)>=100).length;

  const syncParams=(patch:Record<string,string>)=>{const next=new URLSearchParams(params);Object.entries(patch).forEach(([key,value])=>value?next.set(key,value):next.delete(key));setParams(next,{replace:true});};
  const chooseCampaign=(id:string)=>{setCampaignId(id);syncParams({campaign:id});};
  const chooseAdvertiser=(value:string)=>{setAdvertiser(value);setMedia('');setCampaignId('');syncParams({advertiser:value,channel:'',campaign:''});};
  const chooseMedia=(value:string)=>{setMedia(value);setCampaignId('');syncParams({channel:value,campaign:''});};

  const matrixRows=filteredRows.filter(row=>row.attribution!=='none'&&row.kpiAchievement!==undefined&&row.current.spend>0);
  const maxSpend=Math.max(...matrixRows.map(row=>row.current.spend),1);
  const ranking=[...dataRows].sort((a,b)=>(b.healthScore??0)-(a.healthScore??0)).slice(0,6);
  const priority=[...dataRows].filter(row=>(row.riskScore??0)>=30).sort((a,b)=>(b.riskScore??0)-(a.riskScore??0)).slice(0,5);
  const expand=[...dataRows].filter(row=>row.budgetVerdict==='확대 검토').sort((a,b)=>(b.kpiAchievement??0)-(a.kpiAchievement??0)).slice(0,4);
  const reduce=[...dataRows].filter(row=>row.budgetVerdict==='축소 검토'||row.budgetVerdict==='구조 점검').sort((a,b)=>(b.riskScore??0)-(a.riskScore??0)).slice(0,4);
  const trendRows=[...dataRows].sort((a,b)=>valueForTrend(b,trendMetric)-valueForTrend(a,trendMetric)).slice(0,5);
  const tableRows=[...filteredRows].filter(row=>(!tableQuery.trim()||row.campaign.name.includes(tableQuery.trim())||row.advertiserName.includes(tableQuery.trim()))&&(!tableVerdict||row.budgetVerdict===tableVerdict)).sort((a,b)=>{
    const value=(row:CampaignComparisonRow)=>sortKey==='risk'?(row.riskScore??-1):sortKey==='health'?(row.healthScore??-1):sortKey==='spend'?row.current.spend:sortKey==='achievement'?(row.kpiAchievement??-1):(row.monthProjectionRate??-1);
    const diff=value(a)-value(b);return sortDir==='asc'?diff:-diff;
  });

  return <div className="campaign-analysis-page">
    <header className="cap-head"><div><span>인사이트</span><h1>{selected?`캠페인 분석 · ${selected.campaign.name}`:'캠페인 분석'}</h1><p>캠페인별 성과 증감, KPI 효율, 예산 소진과 성과 변화 원인을 분석합니다.</p></div><div className="cap-data-badge">데이터 기준 <b>{data.latestDate||'-'}</b></div></header>

    <section className="cap-filter-card">
      <label>기간<select value={period} onChange={e=>{setPeriod(e.target.value);syncParams({period:e.target.value})}}>{periodOptions.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>비교기간<select value={comparison} onChange={e=>{setComparison(e.target.value);syncParams({compare:e.target.value})}}>{comparisonOptions.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>광고주<select value={advertiser} onChange={e=>chooseAdvertiser(e.target.value)}><option value="">전체 광고주</option>{advertisers.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>매체<select value={media} onChange={e=>chooseMedia(e.target.value)}><option value="">전체 매체</option>{medias.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>캠페인<select value={campaignId} onChange={e=>chooseCampaign(e.target.value)}><option value="">전체 캠페인</option>{filteredCampaignOptions.map(row=><option key={row.campaign.id} value={row.campaign.id}>{row.campaign.name}</option>)}</select></label>
      <label>분석 상태<select value={analysisStatus} onChange={e=>{const value=e.target.value as typeof analysisStatus;setAnalysisStatus(value);syncParams({status:value==='전체'?'':value})}}>{analysisStatusOptions.map(v=><option key={v}>{v}</option>)}</select></label>
      <button className="cap-reset" onClick={()=>{setPeriod('최근 30일');setComparison('직전 동일기간');setAdvertiser('');setMedia('');setCampaignId('');setAnalysisStatus('전체');setParams({}, {replace:true})}}>필터 초기화</button>
    </section>

    {selected?<SelectedCampaignDetail row={selected} trendMetric={trendMetric} setTrendMetric={setTrendMetric} anomalies={anomalies} start={start} end={end}/>:<>
      <section className="cap-kpi-grid">
        <Kpi icon={<BarChart3/>} label="전체 캠페인" value={`${filteredRows.length}개`} sub={`운영 중 ${activeCount}개`}/>
        <Kpi icon={<WalletCards/>} label="총 광고비" value={formatMetric('spend',totalSpend)} sub={`${dataRows.length}개 성과 연결 캠페인`}/>
        <Kpi icon={<MousePointerClick/>} label="클릭" value={formatMetric('clicks',totalClicks)} sub="성과 연결 캠페인 합계"/>
        <Kpi icon={<Target/>} label="대표 전환" value={formatMetric('leads',totalLeads)} sub="DB/전환 합계"/>
        <Kpi icon={<CircleDollarSign/>} label="총 매출" value={formatMetric('revenue',totalRevenue)} sub={totalRevenue?'매출 데이터 포함':'매출 데이터 없음'}/>
        <Kpi icon={<Gauge/>} label="평균 CPA" value={formatMetric('cpa',avgCpa)} sub="전환 데이터 기준"/>
        <Kpi icon={<TrendingUp/>} label="평균 ROAS" value={formatMetric('roas',avgRoas)} sub="매출 데이터 기준"/>
        <Kpi icon={<Sparkles/>} label="KPI 달성" value={`${achieved}개`} sub={configured.length?`${(achieved/configured.length*100).toFixed(1)}%`:'KPI 설정 필요'}/>
      </section>

      <section className="cap-summary"><Sparkles size={21}/><div><b>캠페인 성과 요약</b><p>{ranking[0]?`${ranking[0].campaign.name}의 종합 건강점수가 ${ranking[0].healthScore}점으로 가장 높습니다. ${priority[0]?`${priority[0].campaign.name}는 위험 ${priority[0].riskScore}점으로 우선 확인이 필요합니다.`:''}`:'캠페인 단위로 연결 가능한 성과 데이터가 부족합니다.'}</p></div><Link to="/campaigns">캠페인 관리 <ChevronRight size={14}/></Link></section>

      <section className="cap-main-grid">
        <article className="cap-panel"><div className="cap-panel-head"><div><h2>광고비 vs KPI 성과</h2><p>광고비와 KPI 달성률로 핵심·확대·관찰·개선 캠페인을 구분합니다.</p></div></div><div className="cap-matrix"><div className="cap-quadrant q1">확대 가능성</div><div className="cap-quadrant q2">핵심 캠페인</div><div className="cap-quadrant q3">관찰</div><div className="cap-quadrant q4">최우선 개선</div><i className="cap-axis-x"/><i className="cap-axis-y"/>{matrixRows.map(row=>{const x=8+row.current.spend/maxSpend*84;const y=90-clamp((row.kpiAchievement??0)/160*82,5,82);return <button key={row.campaign.id} className="cap-matrix-dot" style={{left:`${x}%`,top:`${y}%`,background:campaignColor(row)}} title={`${row.campaign.name} · 광고비 ${formatMetric('spend',row.current.spend)} · KPI ${(row.kpiAchievement??0).toFixed(0)}%`} onClick={()=>chooseCampaign(row.campaign.id)}><span>{row.campaign.name}</span></button>})}{!matrixRows.length&&<p className="cap-matrix-empty">KPI와 캠페인 성과가 함께 연결된 데이터가 없습니다.</p>}</div></article>
        <article className="cap-panel"><div className="cap-panel-head"><div><h2>캠페인 효율 순위</h2><p>KPI·성과 변화·예산 안정성을 종합한 건강점수입니다.</p></div></div><div className="cap-ranking">{ranking.map((row,index)=><button key={row.campaign.id} onClick={()=>chooseCampaign(row.campaign.id)}><span>{index+1}위</span><i style={{background:campaignColor(row)}}/><div><b>{row.campaign.name}</b><small>{row.advertiserName} · {row.mediaName}</small></div><em><u style={{width:`${Math.max(8,row.healthScore??0)}%`,background:campaignColor(row)}}/></em><strong>{row.healthScore}점</strong></button>)}{!ranking.length&&<p className="cap-empty">성과 연결 캠페인이 없습니다.</p>}</div></article>
      </section>

      <section className="cap-mid-grid">
        <article className="cap-panel"><div className="cap-panel-head"><div><h2>캠페인 성과 추이</h2><p>상위 캠페인의 선택 지표를 비교합니다.</p></div><div className="cap-metric-tabs">{trendMetrics.map(metric=><button key={metric} className={trendMetric===metric?'active':''} onClick={()=>setTrendMetric(metric)}>{metricNames[metric]}</button>)}</div></div><MultiCampaignTrend rows={trendRows} metric={trendMetric}/></article>
        <article className="cap-panel"><div className="cap-panel-head"><div><h2>예산 소진 현황</h2><p>현재 집행 속도와 월말 예상치를 비교합니다.</p></div><Link to="/brands-budget">브랜드 예산 <ChevronRight size={14}/></Link></div><div className="cap-budget-list">{dataRows.slice(0,6).map(row=><button key={row.campaign.id} onClick={()=>chooseCampaign(row.campaign.id)}><div><b>{row.campaign.name}</b><small>{row.campaign.budgetType==='daily'?`일예산 ₩${row.campaign.budget.toLocaleString()}`:`총예산 ₩${row.campaign.budget.toLocaleString()}`}</small></div><section><span>월 사용 {formatMetric('spend',row.monthSpend)}</span><em><u style={{width:`${Math.min(100,row.monthProjectionRate??0)}%`}}/></em></section><strong className={budgetTone(row.budgetState)}>{row.budgetState}</strong></button>)}</div></article>
      </section>

      <section className="cap-panel"><div className="cap-panel-head"><div><h2>캠페인 상세 성과</h2><p>검색·판정·정렬 필터로 점검 대상만 추려볼 수 있습니다.</p></div><div className="cap-table-tools"><div><Search size={14}/><input value={tableQuery} onChange={e=>setTableQuery(e.target.value)} placeholder="캠페인/광고주 검색"/></div><select value={tableVerdict} onChange={e=>setTableVerdict(e.target.value)}><option value="">판정 전체</option><option>확대 검토</option><option>유지</option><option>축소 검토</option><option>구조 점검</option><option>데이터 부족</option></select><select value={sortKey} onChange={e=>setSortKey(e.target.value as typeof sortKey)}><option value="risk">위험점수</option><option value="health">건강점수</option><option value="spend">광고비</option><option value="achievement">KPI 달성률</option><option value="budget">예산 예상률</option></select><button onClick={()=>setSortDir(v=>v==='asc'?'desc':'asc')}>{sortDir==='asc'?'오름차순':'내림차순'}</button><button onClick={()=>{setTableQuery('');setTableVerdict('');setSortKey('risk');setSortDir('desc')}}>표 필터 초기화</button></div></div><div className="table-scroll"><table className="cap-table"><thead><tr><th>캠페인</th><th>광고주</th><th>매체</th><th>운영상태</th><th>광고비</th><th>클릭</th><th>전환</th><th>CTR</th><th>CVR</th><th>CPA</th><th>매출</th><th>ROAS</th><th>KPI 달성</th><th>예산 소진</th><th>건강</th><th>위험</th><th>판정</th><th>상세</th></tr></thead><tbody>{tableRows.map(row=><tr key={row.campaign.id}><td><b>{row.campaign.name}</b><small>{row.attributionLabel}</small></td><td>{row.advertiserName}</td><td><span className="cap-media-mark" style={{background:campaignColor(row)}}/>{row.mediaName}</td><td><span className={`cap-status ${campaignStateTone(row.campaign.status)}`}>{campaignStatusLabel(row.campaign.status)}</span></td><td>{row.attribution==='none'?'-':formatMetric('spend',row.current.spend)}</td><td>{row.attribution==='none'?'-':formatMetric('clicks',row.current.clicks)}</td><td>{row.attribution==='none'?'-':formatMetric('leads',row.current.leads)}</td><td>{row.attribution==='none'?'-':formatMetric('ctr',row.current.ctr)}</td><td>{row.attribution==='none'?'-':`${row.current.cvr.toFixed(2)}%`}</td><td>{row.attribution==='none'?'-':formatMetric('cpa',row.current.cpa)}</td><td>{row.attribution==='none'?'-':formatMetric('revenue',row.current.revenue)}</td><td>{row.attribution==='none'?'-':formatMetric('roas',row.current.roas)}</td><td>{row.kpiAchievement===undefined?'-':`${row.kpiAchievement.toFixed(0)}%`}</td><td><span className={`cap-status ${budgetTone(row.budgetState)}`}>{row.budgetState}</span></td><td>{row.healthScore===undefined?'-':`${row.healthScore}점`}</td><td>{row.riskScore===undefined?'-':`${row.riskScore}점`}</td><td><span className={`cap-status ${verdictTone(row.budgetVerdict)}`}>{row.budgetVerdict}</span></td><td><button className="cap-link" onClick={()=>chooseCampaign(row.campaign.id)}>상세 분석</button></td></tr>)}</tbody></table></div></section>

      <section className="cap-bottom-grid"><ActionPanel title="관리 우선순위" rows={priority} type="priority" choose={chooseCampaign}/><ActionPanel title="확대 / 축소 후보" rows={[...expand,...reduce]} type="budget" choose={chooseCampaign}/><article className="cap-panel"><h2>이상 징후</h2><div className="cap-alert-list">{anomalies.length?anomalies.slice(0,5).map((item,index)=><div key={`${item.campaignId}-${index}`} className={item.tone}><AlertTriangle size={17}/><div><b>{item.campaignName} · {item.title}</b><small>{item.description}</small></div></div>):<div className="success"><Sparkles size={17}/><div><b>중대한 이상 징후 없음</b><small>현재 범위에서 즉시 대응할 캠페인 이상이 없습니다.</small></div></div>}</div></article></section>

      <section className="cap-panel cap-insights"><h2>주요 인사이트</h2><ul><li><b>성과</b>{ranking[0]?`${ranking[0].campaign.name}의 건강점수가 ${ranking[0].healthScore}점으로 가장 높습니다.`:'성과 연결 캠페인이 부족합니다.'}</li><li><b>관리</b>{priority[0]?`${priority[0].campaign.name}의 위험점수가 ${priority[0].riskScore}점으로 우선 점검이 필요합니다.`:'고위험 캠페인이 없습니다.'}</li><li><b>예산</b>{expand[0]?`${expand[0].campaign.name}는 KPI 효율이 좋아 추가 예산 검토 가치가 있습니다.`:reduce[0]?`${reduce[0].campaign.name}는 예산 축소 또는 구조 점검 후보입니다.`:'뚜렷한 재배분 후보가 없습니다.'}</li><li><b>주의</b>{anomalies[0]?`${anomalies[0].campaignName}에서 ${anomalies[0].title}이 감지됐습니다.`:'중요 이상 징후가 없습니다.'}</li></ul></section>
    </>}
  </div>;
}

function Kpi({icon,label,value,sub}:{icon:ReactNode;label:string;value:string;sub:string}){return <article className="cap-kpi"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{sub}</em></div></article>}

function MultiCampaignTrend({rows,metric}:{rows:CampaignComparisonRow[];metric:PerformanceMetric}){
  return <div className="cap-trend"><svg viewBox="0 0 100 82" preserveAspectRatio="none"><line x1="8" y1="72" x2="100" y2="72"/>{rows.map(row=>{const series=campaignDailySeries(row);return <polyline key={row.campaign.id} style={{stroke:campaignColor(row)}} points={poly(series.map(day=>metricValue(day,metric)))}/>})}</svg><div className="cap-trend-legend">{rows.map(row=><span key={row.campaign.id}><i style={{background:campaignColor(row)}}/>{row.campaign.name}</span>)}</div></div>;
}

function ActionPanel({title,rows,type,choose}:{title:string;rows:CampaignComparisonRow[];type:'priority'|'budget';choose:(id:string)=>void}){
  return <article className="cap-panel"><h2>{title}</h2><div className="cap-action-list">{rows.length?rows.slice(0,5).map((row,index)=><button key={row.campaign.id} onClick={()=>choose(row.campaign.id)}>{type==='priority'?<span className="rank">{index+1}</span>:row.budgetVerdict==='확대 검토'?<TrendingUp className="good"/>:<TrendingDown className="bad"/>}<div><b>{row.campaign.name}</b><small>{row.advertiserName} · {row.mediaName} · {type==='priority'?`위험 ${row.riskScore}점`:row.budgetVerdict}</small></div><ChevronRight size={16}/></button>):<p className="cap-empty">현재 표시할 후보가 없습니다.</p>}</div></article>;
}

function DatabaseIcon(){return <Database size={18}/>;}

function SelectedCampaignDetail({row,trendMetric,setTrendMetric,anomalies,start,end}:{row:CampaignComparisonRow;trendMetric:PerformanceMetric;setTrendMetric:(m:PerformanceMetric)=>void;anomalies:ReturnType<typeof detectCampaignAnomalies>;start:string;end:string}){
  const daily=campaignDailySeries(row),previousDaily=campaignPreviousDailySeries(row),drivers=campaignChangeDrivers(row),funnel=campaignFunnel(row),events=campaignScheduleEvents(row.campaign);
  const campaignDbRows=loadDbRows().filter(item=>item.advertiser===row.advertiserName&&item.media===row.mediaName&&(!start||item.date>=start)&&(!end||item.date<=end)&&((item.campaignId&&item.campaignId===row.campaign.id)||(item.campaignName&&item.campaignName===row.campaign.name)));
  const campaignDb=summarizeDbRows(campaignDbRows);
  const currentTrend=metricValue(row.current,trendMetric),previousTrend=metricValue(row.previous,trendMetric);
  return <>
    <section className="cap-selected-hero"><div><span className="cap-media-pill" style={{borderColor:campaignColor(row),color:campaignColor(row)}}>{row.mediaName}</span><h2>{row.campaign.name}</h2><p>{row.advertiserName} · {row.campaign.accountName}</p><small>{row.attributionLabel}</small></div><div><span className={`cap-status ${campaignStateTone(row.campaign.status)}`}>{campaignStatusLabel(row.campaign.status)}</span><Link className="cap-manage-link" to={`/campaigns?campaignId=${encodeURIComponent(row.campaign.id)}`}>캠페인 관리에서 수정 <ChevronRight size={15}/></Link></div></section>

    <section className="cap-db-strip"><div><DatabaseIcon/><span><b>Google Sheets 실제 DB</b><small>{campaignDbRows.length?`${campaignDbRows.length}개 집계 행 연결`:'캠페인 식별값 미연결'}</small></span></div>{campaignDbRows.length?<><span>DB <b>{campaignDb.db.toLocaleString()}</b></span><span>유효 DB <b>{campaignDb.validDb.toLocaleString()}</b></span><span>계약 <b>{campaignDb.contracts.toLocaleString()}</b></span><span>유효율 <b>{campaignDb.db?`${(campaignDb.validDb/campaignDb.db*100).toFixed(1)}%`:'-'}</b></span></>:<p>시트에 campaignId 또는 캠페인명을 넣으면 이 캠페인의 실제 DB·유효 DB·계약이 자동 연결됩니다.</p>}</section>

    <section className="cap-kpi-grid cap-selected-kpis">
      <Kpi icon={<WalletCards/>} label="광고비" value={row.attribution==='none'?'-':formatMetric('spend',row.current.spend)} sub={row.attribution==='none'?'성과 데이터 미연결':numberChange(row.spendChange)}/>
      <Kpi icon={<Target/>} label={row.primaryLabel} value={row.attribution==='none'?'-':formatMetric(row.primaryMetric,metricValue(row.current,row.primaryMetric))} sub={row.kpiAchievement===undefined?'KPI 목표 미설정':`목표 달성 ${row.kpiAchievement.toFixed(0)}%`}/>
      <Kpi icon={<MousePointerClick/>} label="클릭" value={row.attribution==='none'?'-':formatMetric('clicks',row.current.clicks)} sub={row.attribution==='none'?'-':numberChange(row.clickChange)}/>
      <Kpi icon={<Gauge/>} label="CVR" value={row.attribution==='none'?'-':`${row.current.cvr.toFixed(2)}%`} sub={row.attribution==='none'?'-':numberChange(row.cvrChange)}/>
      <Kpi icon={<CircleDollarSign/>} label="CPA" value={row.attribution==='none'?'-':formatMetric('cpa',row.current.cpa)} sub={row.attribution==='none'?'-':numberChange(row.cpaChange)}/>
      <Kpi icon={<TrendingUp/>} label="ROAS" value={row.attribution==='none'?'-':formatMetric('roas',row.current.roas)} sub={row.attribution==='none'?'-':numberChange(row.roasChange)}/>
      <Kpi icon={<Sparkles/>} label="건강점수" value={row.healthScore===undefined?'-':`${row.healthScore}점`} sub={row.analysisStatus}/>
      <Kpi icon={<AlertTriangle/>} label="위험점수" value={row.riskScore===undefined?'-':`${row.riskScore}점`} sub={row.budgetVerdict}/>
    </section>

    {row.attribution==='none'?<section className="cap-panel cap-empty-detail"><b>캠페인 단위 성과 데이터가 아직 연결되지 않았습니다.</b><p>같은 광고주·매체에 여러 캠페인이 존재하면 매체 합계 성과를 임의로 나누지 않습니다. 캠페인/API 성과 데이터가 들어오면 자동으로 세부 분석이 활성화됩니다.</p><Link to="/campaigns">캠페인 관리 확인 <ChevronRight size={14}/></Link></section>:<>
      <section className="cap-detail-grid"><article className="cap-panel"><div className="cap-panel-head"><div><h2>성과 추이</h2><p>현재 기간과 비교기간의 지표 변화를 봅니다.</p></div><div className="cap-metric-tabs">{trendMetrics.map(metric=><button key={metric} className={trendMetric===metric?'active':''} onClick={()=>setTrendMetric(metric)}>{metricNames[metric]}</button>)}</div></div><div className="cap-trend"><svg viewBox="0 0 100 82" preserveAspectRatio="none"><line x1="8" y1="72" x2="100" y2="72"/><polyline className="previous" points={poly(previousDaily.map(day=>metricValue(day,trendMetric)))}/><polyline style={{stroke:campaignColor(row)}} points={poly(daily.map(day=>metricValue(day,trendMetric)))}/></svg><div className="cap-trend-current"><span>현재 <b>{formatMetric(trendMetric,currentTrend)}</b></span><span>비교 <b>{formatMetric(trendMetric,previousTrend)}</b></span><strong className={changeTone(trendMetric,row.primaryMetric===trendMetric?row.primaryChange:0)}>{row.primaryMetric===trendMetric?numberChange(row.primaryChange):''}</strong></div></div></article><article className="cap-panel"><div className="cap-panel-head"><div><h2>KPI / 예산 진행</h2><p>현재 추세 기준으로 예산 소진과 KPI 효율을 함께 판단합니다.</p></div></div><div className="cap-progress-card"><div><span>예산 소진 상태</span><strong className={budgetTone(row.budgetState)}>{row.budgetState}</strong></div><section><span>현재 월 광고비</span><b>{formatMetric('spend',row.monthSpend)}</b></section><section><span>월말 예상 광고비</span><b>{row.monthProjection===undefined?'-':formatMetric('spend',row.monthProjection)}</b></section><section><span>계획 대비 예상</span><b>{row.monthProjectionRate===undefined?'-':`${row.monthProjectionRate.toFixed(0)}%`}</b></section><section><span>KPI 달성률</span><b>{row.kpiAchievement===undefined?'-':`${row.kpiAchievement.toFixed(0)}%`}</b></section><div className="cap-dual-progress"><label>예산 예상 <i><u style={{width:`${Math.min(100,row.monthProjectionRate??0)}%`}}/></i></label><label>KPI 달성 <i><u className="kpi" style={{width:`${Math.min(100,row.kpiAchievement??0)}%`}}/></i></label></div></div></article></section>

      <section className="cap-detail-grid"><article className="cap-panel"><div className="cap-panel-head"><div><h2>성과 변화 원인</h2><p>정확한 인과 추정이 아니라 관련 지표 변화의 우선순위를 규칙 기반으로 보여줍니다.</p></div></div><div className="cap-driver-summary"><b>{row.primaryLabel} {numberChange(row.primaryChange)}</b><span>{drivers[0]?`${drivers[0].label} 변화가 가장 크게 관찰됩니다.`:'큰 관련 지표 변화가 없습니다.'}</span></div><div className="cap-driver-list">{drivers.length?drivers.map(driver=><div key={driver.key}><span className={driver.tone}>{driver.change>=0?<ArrowUpRight/>:<ArrowDownRight/>}</span><div><b>{driver.label}</b><small>{driver.message}</small></div><strong className={driver.tone}>{numberChange(driver.change)}</strong></div>):<p className="cap-empty">비교 가능한 주요 변화가 없습니다.</p>}</div></article><article className="cap-panel"><h2>전환 퍼널</h2><div className="cap-funnel">{funnel.map((step,index)=><div key={step.label}><article><span>{step.label}</span><strong>{Math.round(step.value).toLocaleString()}</strong></article>{index<funnel.length-1&&<em>↓ <b>{funnel[index+1].rate?.toFixed(1)??'0.0'}%</b></em>}</div>)}</div></article></section>

      <section className="cap-detail-grid"><article className="cap-panel"><div className="cap-panel-head"><div><h2>운영 일정 타임라인</h2><p>캠페인 관리에 저장된 시작·종료·ON/OFF 규칙을 연결합니다.</p></div><Link to="/campaigns">일정 수정 <ChevronRight size={14}/></Link></div><div className="cap-timeline">{events.map((event,index)=><div key={`${event.label}-${index}`}><i className={event.type}/><section><b>{event.label}</b><span>{event.date||'반복 규칙'}</span><small>{event.detail}</small></section></div>)}</div></article><article className="cap-panel"><div className="cap-panel-head"><div><h2>하위 구성 성과</h2><p>소재·광고그룹·키워드 성과 데이터가 연결되면 이 영역에서 원인을 더 깊게 볼 수 있습니다.</p></div></div><div className="cap-empty-detail"><b>하위 구성 성과 데이터 미연결</b><p>현재 원본 데이터에는 캠페인 하위 소재/광고그룹/키워드 단위 성과가 없습니다. 임의 수치를 생성하지 않습니다.</p><div><Link to="/creatives/library">소재 관리</Link><Link to="/keywords">키워드 관리</Link></div></div></article></section>

      <section className="cap-bottom-grid"><article className="cap-panel"><h2>이상 징후</h2><div className="cap-alert-list">{anomalies.length?anomalies.map((item,index)=><div key={index} className={item.tone}><AlertTriangle size={17}/><div><b>{item.title}</b><small>{item.description}</small></div></div>):<div className="success"><Sparkles size={17}/><div><b>중대한 이상 징후 없음</b><small>현재 비교 범위에서 큰 이상이 없습니다.</small></div></div>}</div></article><article className="cap-panel"><h2>개선 우선순위</h2><div className="cap-recommendation"><strong className={verdictTone(row.budgetVerdict)}>{row.budgetVerdict}</strong><p>{row.budgetVerdict==='확대 검토'?'KPI 효율이 우수하고 현재 예산 상태가 과도하지 않아 추가 배분 검토 가치가 있습니다.':row.budgetVerdict==='축소 검토'?'광고비 대비 성과가 악화되어 예산 축소 또는 캠페인 구조 점검을 우선 권장합니다.':row.budgetVerdict==='구조 점검'?'예산 소진 속도와 성과의 균형을 확인하고 운영 일정·타겟·소재를 점검하세요.':'현재 예산을 유지하면서 지표 추이를 관찰하는 편이 적절합니다.'}</p><Link to={`/campaigns?campaignId=${encodeURIComponent(row.campaign.id)}`}>캠페인 관리에서 수정 <ChevronRight size={14}/></Link></div></article><article className="cap-panel cap-insights"><h2>주요 인사이트</h2><ul><li><b>성과</b>{`${row.primaryLabel}은 비교기간 대비 ${numberChange(row.primaryChange)} 변했습니다.`}</li><li><b>원인</b>{drivers[0]?`${drivers[0].label} ${numberChange(drivers[0].change)} 변화가 주요 관련 지표입니다.`:'뚜렷한 관련 지표 변화가 없습니다.'}</li><li><b>예산</b>{row.monthProjectionRate===undefined?'예산 예상치를 계산할 성과 데이터가 부족합니다.':`현재 추세 기준 계획 예산의 ${row.monthProjectionRate.toFixed(0)}% 수준이 예상됩니다.`}</li><li><b>추천</b>{row.budgetVerdict==='확대 검토'?'추가 예산 배분 검토':row.budgetVerdict==='축소 검토'?'예산 축소 및 구조 점검':row.budgetVerdict==='구조 점검'?'운영 설정 점검':'현재 운영 유지'}</li></ul></article></section>
    </>}
  </>;
}
