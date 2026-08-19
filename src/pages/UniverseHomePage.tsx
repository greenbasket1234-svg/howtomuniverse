import { useMemo } from 'react';
import { Bot, CheckCircle2, Database, FileText, Megaphone, MousePointerClick, Search, Sparkles, Target, TrendingUp, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { useAuth } from '../context/AuthContext';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { useMetricRows } from '../hooks/useMetrics';
import type { CreativeMetricRow, DailyMetricRow, KeywordMetricRow } from '../types/metrics';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

function money(value:number){return `₩${Math.round(value).toLocaleString()}`}
function pct(value:number){return `${value.toFixed(1)}%`}

export function UniverseHomePage(){
  const {filterValue,setFilter}=useAdvertiserFilter();
  const {user,isAdmin}=useAuth();
  const [advertisers]=useAdvertisers();
  const daily=useMetricRows<DailyMetricRow>('/metrics/daily');
  const keyword=useMetricRows<KeywordMetricRow>('/metrics/keywords');
  const creative=useMetricRows<CreativeMetricRow>('/metrics/creatives');
  const greetingName=isAdmin?'관리자':(user?.nickname?.trim()||user?.name?.trim()||user?.advertiser_name?.trim()||'사용자');
  const advertiserNames=advertisers.map(a=>a.name);const selectedAdvertiser=advertiserNames.includes(filterValue)?filterValue:'';
  const visibleDaily=useMemo(()=>daily.rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||'',filterValue)),[daily.rows,filterValue]);
  const visibleKeywords=useMemo(()=>keyword.rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||'',filterValue)).sort((a,b)=>b.spend-a.spend),[keyword.rows,filterValue]);
  const visibleCreatives=useMemo(()=>creative.rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||'',filterValue)).sort((a,b)=>b.spend-a.spend),[creative.rows,filterValue]);
  const overview=useMemo(()=>visibleDaily.reduce((a,r)=>({spend:a.spend+r.spend,clicks:a.clicks+r.clicks,dbCount:a.dbCount+r.dbCount,revenue:a.revenue+r.revenue}),{spend:0,clicks:0,dbCount:0,revenue:0}),[visibleDaily]);
  const byAdvertiser=useMemo(()=>{const m=new Map<string,{name:string;spend:number;clicks:number;db:number;revenue:number}>();visibleDaily.forEach(r=>{const name=r.advertiserName||r.advertiserId;const v=m.get(name)||{name,spend:0,clicks:0,db:0,revenue:0};v.spend+=r.spend;v.clicks+=r.clicks;v.db+=r.dbCount;v.revenue+=r.revenue;m.set(name,v)});return [...m.values()].sort((a,b)=>b.spend-a.spend)},[visibleDaily]);
  const roas=overview.spend?overview.revenue/overview.spend*100:0;const hasPerformance=visibleDaily.length>0;const periodLabel=`${daily.range.from} ~ ${daily.range.to}`;
  const errors=[daily.error,keyword.error,creative.error].filter(Boolean);
  return <div className="universe-home-page universe-home-dashboard home-dashboard-v14">
    <header className="home-dashboard-header home-dashboard-header-v14"><div><h1>안녕하세요, {greetingName}님! <span aria-hidden="true">👋</span></h1><p>{advertisers.length?'실제 연결된 매체 API 데이터와 업무 상태가 이곳에 표시됩니다.':'샘플 데이터 없이 시작합니다. 첫 광고주를 등록해 HOWTOM 유니버스를 설정하세요.'}</p></div><label className="home-advertiser-select"><span>광고주 선택</span><select value={selectedAdvertiser} onChange={e=>setFilter(e.target.value)} disabled={!advertisers.length}><option value="">전체 광고주</option>{advertiserNames.map(name=><option key={name}>{name}</option>)}</select></label></header>
    <MetricsDateBar/>
    {errors.length>0&&<div className="card" style={{color:'#b91c1c',borderColor:'#fecaca'}}>{errors[0]}</div>}
    <section className="home-dashboard-kpis home-dashboard-kpis-v14" aria-label="통합 현황">
      <Link to="/dashboard" className="home-dashboard-kpi home-kpi-featured"><span className="home-kpi-label"><WalletCards size={15}/><span>광고비</span></span><strong>{money(overview.spend)}</strong><em><small>{hasPerformance?periodLabel:'데이터 없음'}</small></em></Link>
      <Link to="/reports" className="home-dashboard-kpi"><span className="home-kpi-label"><MousePointerClick size={15}/><span>클릭</span></span><strong>{overview.clicks.toLocaleString()}</strong><em><small>{hasPerformance?periodLabel:'데이터 없음'}</small></em></Link>
      <Link to="/db-management" className="home-dashboard-kpi"><span className="home-kpi-label"><Database size={15}/><span>DB/전환</span></span><strong>{overview.dbCount.toLocaleString()}</strong><em><small>{hasPerformance?periodLabel:'데이터 없음'}</small></em></Link>
      <Link to="/conversion-funnel" className="home-dashboard-kpi"><span className="home-kpi-label"><Target size={15}/><span>CPA</span></span><strong>{overview.dbCount?money(overview.spend/overview.dbCount):'-'}</strong><em><small>{hasPerformance?periodLabel:'데이터 없음'}</small></em></Link>
      <Link to="/report-center" className="home-dashboard-kpi"><span className="home-kpi-label"><TrendingUp size={15}/><span>ROAS</span></span><strong>{pct(roas)}</strong><em><small>{hasPerformance?periodLabel:'데이터 없음'}</small></em></Link>
      <Link to="/approval-queue" className="home-dashboard-kpi approval"><span className="home-kpi-label"><CheckCircle2 size={15}/><span>승인 대기</span></span><strong>0<small>건</small></strong><em><small>요청 없음</small></em></Link>
    </section>
    {!advertisers.length&&<section className="home-dashboard-card" style={{padding:32,textAlign:'center'}}><Sparkles size={34} style={{margin:'0 auto 10px'}}/><h2>HOWTOM 유니버스를 처음 시작합니다.</h2><p style={{color:'#64748b'}}>샘플 데이터가 없는 Zero State입니다.</p><Link className="btn primary" to="/advertisers">첫 광고주 등록</Link></section>}
    <section className="home-dashboard-main-row home-dashboard-main-row-v14"><article className="home-dashboard-card performance-card"><div className="home-card-head home-card-head-compact"><div><h2>광고 성과 요약</h2></div></div>{hasPerformance?<div className="home-summary-numbers" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,padding:'4px 4px 16px'}}><div><small>광고비</small><div style={{fontSize:20,fontWeight:700}}>{money(overview.spend)}</div></div><div><small>전환매출</small><div style={{fontSize:20,fontWeight:700}}>{money(overview.revenue)}</div></div><div><small>클릭</small><div style={{fontSize:20,fontWeight:700}}>{overview.clicks.toLocaleString()}</div></div><div><small>DB/전환</small><div style={{fontSize:20,fontWeight:700}}>{overview.dbCount.toLocaleString()}</div></div></div>:<div className="home-empty-data"><TrendingUp size={28}/><b>광고 성과 데이터가 없습니다.</b><span>매체 계정을 연결하고 동기화하면 실제 데이터가 표시됩니다.</span></div>}</article><article className="home-dashboard-card notice-card"><div className="home-card-head home-card-head-compact"><div><h2>최근 동기화</h2></div></div><div className="home-empty-data"><CheckCircle2 size={26}/><b>{daily.meta?.connections.some(c=>c.status==='connected')?'연결된 매체가 있습니다.':'연결된 매체가 없습니다.'}</b><span>{daily.meta?.connections.filter(c=>c.status==='connected').map(c=>`${c.channel} ${c.lastSyncedAt?new Date(c.lastSyncedAt).toLocaleString('ko-KR'):'동기화 대기'}`).join(' · ')||'매체 계정 연동에서 연결하세요.'}</span></div></article><article className="home-dashboard-card insight-card"><div className="home-card-head home-card-head-compact"><div><h2>AI 추천 인사이트</h2></div></div><div className="home-empty-data"><Bot size={26}/><b>{hasPerformance?'실제 성과를 분석할 수 있습니다.':'분석할 데이터가 없습니다.'}</b><span><Link to="/insights/ai-recommendations">AI 추천 보기</Link></span></div></article></section>
    <nav className="home-quick-menu home-quick-menu-v14" aria-label="빠른 메뉴"><Link to="/dashboard"><TrendingUp size={17}/> 전체 대시보드</Link><Link to="/reports"><FileText size={17}/> 광고 데이터</Link><Link to="/kpi-goals"><CheckCircle2 size={17}/> KPI 관리</Link><Link to="/campaigns"><Megaphone size={17}/> 캠페인 관리</Link><Link to="/creatives/performance"><Sparkles size={17}/> 소재 성과</Link><Link to="/keywords"><Search size={17}/> 키워드 관리</Link><Link to="/content/blog"><FileText size={17}/> 블로그 제작</Link><Link to="/automation/overview"><Bot size={17}/> AI 자동화</Link></nav>
    <section className="home-bottom-grid home-bottom-grid-v14">
      <article className="home-dashboard-card compact-table-card"><div className="home-card-head home-card-head-compact"><div><h2>주요 키워드 성과</h2></div></div>{visibleKeywords.slice(0,5).map(r=><div key={`${r.channel}-${r.keywordId||r.keyword}`} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #eef2f7'}}><span><b>{r.keyword}</b><small style={{display:'block',color:'#64748b'}}>{r.advertiserName} · {r.channel}</small></span><span style={{textAlign:'right'}}>{money(r.spend)}<small style={{display:'block'}}>전환 {r.dbCount}</small></span></div>)}{!keyword.loading&&!visibleKeywords.length&&<div className="home-empty-data small"><Search size={23}/><b>키워드 데이터가 없습니다.</b></div>}</article>
      <article className="home-dashboard-card compact-table-card"><div className="home-card-head home-card-head-compact"><div><h2>주요 소재 성과</h2></div></div>{visibleCreatives.slice(0,5).map(r=><div key={`${r.channel}-${r.adId}`} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #eef2f7'}}><span><b>{r.adName}</b><small style={{display:'block',color:'#64748b'}}>{r.advertiserName} · {r.channel}</small></span><span style={{textAlign:'right'}}>{money(r.spend)}<small style={{display:'block'}}>CTR {(r.ctr||0).toFixed(2)}%</small></span></div>)}{!creative.loading&&!visibleCreatives.length&&<div className="home-empty-data small"><Sparkles size={23}/><b>소재 데이터가 없습니다.</b></div>}</article>
      <article className="home-dashboard-card compact-table-card"><div className="home-card-head home-card-head-compact"><div><h2>광고주별 성과</h2></div></div>{byAdvertiser.slice(0,5).map(r=><div key={r.name} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #eef2f7'}}><span><b>{r.name}</b><small style={{display:'block',color:'#64748b'}}>전환 {r.db}</small></span><span style={{textAlign:'right'}}>{money(r.spend)}<small style={{display:'block'}}>ROAS {r.revenue&&r.spend?(r.revenue/r.spend*100).toFixed(0)+'%':'-'}</small></span></div>)}{!daily.loading&&!byAdvertiser.length&&<div className="home-empty-data small"><TrendingUp size={23}/><b>광고 성과 데이터가 없습니다.</b></div>}</article>
      <article className="home-dashboard-card approval-status-card"><div className="home-card-head home-card-head-compact"><div><h2>승인 대기 현황</h2></div></div><div className="home-empty-data small"><CheckCircle2 size={23}/><b>승인 대기 0건</b></div></article>
      <article className="home-dashboard-card system-card"><div className="home-card-head home-card-head-compact"><div><h2>시스템 안내</h2></div></div><div className="home-empty-data small"><FileText size={23}/><b>등록된 공지사항이 없습니다.</b></div></article>
    </section>
  </div>;
}
