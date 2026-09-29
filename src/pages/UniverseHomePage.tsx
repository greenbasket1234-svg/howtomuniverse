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
import { CONTENT_STUDIO_URL } from '../data/universeMenu';
import { loadNotices } from '../control/controlStore';
import type { Notice } from '../control/controlTypes';

const CH_COLOR: Record<string,string> = { meta:'#4776ff', naver:'#03c75a', google:'#6b7280', daangn:'#ff6f0f', kakao:'#f5c400', tiktok:'#111827' };
const CH_LABEL: Record<string,string> = { meta:'Meta', naver:'네이버', google:'구글', daangn:'당근', kakao:'카카오', tiktok:'틱톡' };
const ChannelTag = ({ channel }: { channel: string }) => <span className="home-ch-tag" style={{ background: `${CH_COLOR[channel] || '#94a3b8'}18`, color: CH_COLOR[channel] || '#64748b' }}>{CH_LABEL[channel] || channel}</span>;

const NAVER_CAMPAIGN_TYPE: Record<string, string> = {
  WEB_SITE: '파워링크', SHOPPING: '쇼핑검색', POWER_CONTENTS: '파워컨텐츠',
  BRAND_SEARCH: '브랜드검색', PLACE: '플레이스',
};
// 유형별 색상 — 캠페인·키워드 관리 화면의 채널 태그 색상과 일치시킵니다.
const NAVER_TYPE_COLOR: Record<string, {bg:string;color:string;border:string}> = {
  WEB_SITE:      { bg:'#dcfce7', color:'#15803d', border:'#86efac' }, // 파워링크 — 진한 초록
  SHOPPING:      { bg:'#ffedd5', color:'#c2410c', border:'#fb923c' }, // 쇼핑검색 — 진한 주황
  POWER_CONTENTS:{ bg:'#dbeafe', color:'#1d4ed8', border:'#60a5fa' }, // 파워컨텐츠 — 진한 파랑
  BRAND_SEARCH:  { bg:'#f3e8ff', color:'#7e22ce', border:'#c084fc' }, // 브랜드검색 — 진한 보라
  PLACE:         { bg:'#e0f2fe', color:'#0369a1', border:'#38bdf8' }, // 플레이스 — 진한 하늘
};
function naverTypeLabel(campaignType?: string) {
  return campaignType ? (NAVER_CAMPAIGN_TYPE[campaignType] || campaignType) : null;
}
function naverTypeBadge(campaignType?: string): {label:string;style:React.CSSProperties}|null {
  if (!campaignType) return null;
  const label = NAVER_CAMPAIGN_TYPE[campaignType] || campaignType;
  const c = NAVER_TYPE_COLOR[campaignType] || { bg:'#f1f5f9', color:'#475569', border:'#e2e8f0' };
  return { label, style: { background:c.bg, color:c.color, border:`1px solid ${c.border}` } };
}
function money(value:number){return `₩${Math.round(value).toLocaleString()}`}
function pct(value:number){return `${value.toFixed(1)}%`}

export function UniverseHomePage(){
  const {filterValue,setFilter}=useAdvertiserFilter();
  const {user,isAdmin}=useAuth();
  // 공지사항: 비어드민은 광고주별 성과 대신 공지사항을 표시합니다.
  // 광고주 계정 → audience 'advertiser'|'all', 내부 직원/어드민 → 'internal'|'all'
  const notices = useMemo((): Notice[] => {
    try {
      const all = loadNotices().filter(n => n.status === 'published');
      if (isAdmin) return all.filter(n => n.audience === 'internal' || n.audience === 'all').slice(0, 5);
      if (user?.isAdvertiserAccount) return all.filter(n => n.audience === 'advertiser' || n.audience === 'all').slice(0, 5);
      return all.filter(n => n.audience === 'all').slice(0, 5);
    } catch { return []; }
  }, [isAdmin, user?.isAdvertiserAccount]);
  const [advertisers]=useAdvertisers();
  const daily=useMetricRows<DailyMetricRow>('/metrics/daily');
  const keyword=useMetricRows<KeywordMetricRow>('/metrics/keywords');
  const creative=useMetricRows<CreativeMetricRow>('/metrics/creatives');
  const greetingName=isAdmin?'관리자':(user?.nickname?.trim()||user?.name?.trim()||user?.advertiser_name?.trim()||'사용자');
  const advertiserNames=advertisers.map(a=>a.name);const selectedAdvertiser=advertiserNames.includes(filterValue)?filterValue:'';
  const visibleDaily=useMemo(()=>daily.rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||'',filterValue)),[daily.rows,filterValue]);

  // 매체별 성과 집계 (홈 화면용)
  const byChannel = useMemo(()=>{
    const map = new Map<string, {channel:string;spend:number;impressions:number;clicks:number;dbCount:number;unconfirmed:number;purchases:number;addToCart:number;completeRegistration:number;revenue:number}>();
    for(const r of visibleDaily){
      const ch = r.channel || 'unknown';
      const cur = map.get(ch) || {channel:ch,spend:0,impressions:0,clicks:0,dbCount:0,unconfirmed:0,purchases:0,addToCart:0,completeRegistration:0,revenue:0};
      cur.spend += r.spend||0; cur.impressions += r.impressions||0; cur.clicks += r.clicks||0;
      cur.dbCount += r.dbCount||0; cur.unconfirmed += r.unconfirmed||0;
      cur.purchases += r.purchases||0; cur.addToCart += r.addToCart||0;
      cur.completeRegistration += r.completeRegistration||0;
      cur.revenue += r.revenue||0;
      map.set(ch, cur);
    }
    return [...map.values()].sort((a,b)=>b.spend-a.spend);
  }, [visibleDaily]);
  // 단순 광고비 순이 아니라, 실제 "성과가 좋은" 순으로 정렬합니다.
  // 클릭이 거의 없는 항목이 우연히 높은 효율로 1위를 차지하지 않도록, 최소 활동량 기준을 둡니다.
  const visibleKeywords=useMemo(()=>[...keyword.rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||'',filterValue))].sort((a,b)=>{
    // 예전엔 DB(리드) 전환만 봐서, 구매(이커머스) 전환 위주인 키워드가 전부 0으로 밀려나던 문제가 있었습니다.
    const totalConv=(r:typeof a)=>r.dbCount+(r.purchases||0)+(r.unconfirmed||0);
    const scoreOf=(r:typeof a)=>r.clicks>=3?(r.clicks?totalConv(r)/r.clicks:0):-1;
    const sa=scoreOf(a), sb=scoreOf(b);
    if(sa!==sb) return sb-sa;
    return b.spend-a.spend;
  }),[keyword.rows,filterValue]);
  const visibleCreatives=useMemo(()=>[...creative.rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||'',filterValue))].sort((a,b)=>{
    const scoreOf=(r:typeof a)=>r.impressions>=50?(r.ctr??(r.impressions?r.clicks/r.impressions*100:0)):-1;
    const sa=scoreOf(a), sb=scoreOf(b);
    if(sa!==sb) return sb-sa;
    return b.spend-a.spend;
  }),[creative.rows,filterValue]);

  // 주요 소재 성과·소재 효율 공통: 검색광고(네이버·구글) 제외, 디스플레이·소셜만
  const DISPLAY_CHANNELS_SET = new Set(['meta', 'kakao', 'tiktok', 'daangn']);
  const visibleDisplayCreatives = useMemo(()=>
    visibleCreatives.filter(r => DISPLAY_CHANNELS_SET.has(r.channel))
  , [visibleCreatives]);

  // ── 소재 효율 종합 점수 계산 ──────────────────────────────────────────────
  // 광고비 최소 1,000원 + 클릭 5회 이상인 소재만 평가합니다.
  const creativeEfficiency = useMemo(() => {
    // 검색광고(네이버·구글)는 키워드 기반 텍스트 광고라 소재 미리보기·CTR 비교가 의미 없습니다.
    // 메타·카카오·틱톡·당근 등 디스플레이·소셜 채널만 평가합니다.
    const eligible = visibleDisplayCreatives.filter(r => r.spend >= 1000 && r.clicks >= 5);
    if (!eligible.length) return { top: [] as typeof scored, worst: [] as typeof scored };
    const totalConv = (r: CreativeMetricRow) => r.dbCount + (r.purchases || 0) + (r.unconfirmed || 0);
    const getCtr = (r: CreativeMetricRow) => r.impressions > 0 ? r.clicks / r.impressions * 100 : 0;
    const getCpc = (r: CreativeMetricRow) => r.clicks > 0 ? r.spend / r.clicks : 0;
    const getCvr = (r: CreativeMetricRow) => r.clicks > 0 ? totalConv(r) / r.clicks * 100 : 0;
    const avgCtr = eligible.reduce((s, r) => s + getCtr(r), 0) / eligible.length || 1;
    const avgCpc = eligible.reduce((s, r) => s + getCpc(r), 0) / eligible.length || 1;
    const avgCvr = eligible.reduce((s, r) => s + getCvr(r), 0) / eligible.length || 0.01;
    const scored = eligible.map(r => {
      const ctr = getCtr(r); const cpc = getCpc(r); const cvr = getCvr(r);
      const score = (ctr / avgCtr) * 0.4 + (cpc > 0 ? avgCpc / cpc : 0) * 0.35 + (avgCvr > 0 ? cvr / avgCvr : 0) * 0.25;
      return { row: r, score, ctr, cpc, cvr, conv: totalConv(r) };
    }).sort((a, b) => b.score - a.score);
    return { top: scored.slice(0, 5), worst: [...scored].reverse().slice(0, 5) };
  }, [visibleDisplayCreatives]);
  const overview=useMemo(()=>visibleDaily.reduce((a,r)=>({spend:a.spend+r.spend,clicks:a.clicks+r.clicks,dbCount:a.dbCount+r.dbCount,purchases:a.purchases+(r.purchases||0),addToCart:a.addToCart+(r.addToCart||0),completeRegistration:a.completeRegistration+(r.completeRegistration||0),initiateCheckout:a.initiateCheckout+(r.initiateCheckout||0),unconfirmed:a.unconfirmed+(r.unconfirmed||0),revenue:a.revenue+r.revenue}),{spend:0,clicks:0,dbCount:0,purchases:0,addToCart:0,completeRegistration:0,initiateCheckout:0,unconfirmed:0,revenue:0}),[visibleDaily]);
  const byAdvertiser=useMemo(()=>{const m=new Map<string,{name:string;spend:number;clicks:number;db:number;purchases:number;unconfirmed:number;revenue:number}>();visibleDaily.forEach(r=>{const name=r.advertiserName||r.advertiserId;const v=m.get(name)||{name,spend:0,clicks:0,db:0,purchases:0,unconfirmed:0,revenue:0};v.spend+=r.spend;v.clicks+=r.clicks;v.db+=r.dbCount;v.purchases+=r.purchases||0;v.unconfirmed+=r.unconfirmed||0;v.revenue+=r.revenue;m.set(name,v)});return [...m.values()].sort((a,b)=>{
    // 매출을 추적하는 광고주는 ROAS로, 아니면 총 전환(DB+구매+미확인) 수로 성과를 비교합니다.
    // 예전엔 DB(리드) 전환만 봐서, 구매(이커머스) 전환 위주인 광고주가 항상 0으로 잡히는 문제가 있었습니다.
    const totalConv=(r:typeof a)=>r.db+r.purchases+r.unconfirmed;
    const scoreOf=(r:typeof a)=>r.revenue>0&&r.spend>0?r.revenue/r.spend*100:totalConv(r)>0?totalConv(r)*10:-1;
    const sa=scoreOf(a), sb=scoreOf(b);
    if(sa!==sb) return sb-sa;
    return b.spend-a.spend;
  })},[visibleDaily]);
  const roas=overview.spend?overview.revenue/overview.spend*100:0;const hasPerformance=visibleDaily.length>0;const periodLabel=`${daily.range.from} ~ ${daily.range.to}`;
  // '광고 성과 요약'의 각 전환 지표에 마우스를 올리면 광고주별로 몇 개씩 나왔는지 보여주기
  // 위한 집계입니다. visibleDaily(일자별·광고주별 원본 행)를 광고주 단위로 한 번만 묶어서
  // 6개 전환 지표 전부를 계산해두고, 지표별 툴팁 문자열은 그때그때 만듭니다.
  const byAdvertiserConversions=useMemo(()=>{
    const m=new Map<string,{name:string;dbCount:number;purchases:number;addToCart:number;completeRegistration:number;initiateCheckout:number;unconfirmed:number}>();
    visibleDaily.forEach(r=>{
      const name=r.advertiserName||r.advertiserId;
      const v=m.get(name)||{name,dbCount:0,purchases:0,addToCart:0,completeRegistration:0,initiateCheckout:0,unconfirmed:0};
      v.dbCount+=r.dbCount; v.purchases+=(r.purchases||0); v.addToCart+=(r.addToCart||0);
      v.completeRegistration+=(r.completeRegistration||0); v.initiateCheckout+=(r.initiateCheckout||0); v.unconfirmed+=(r.unconfirmed||0);
      m.set(name,v);
    });
    return [...m.values()];
  },[visibleDaily]);
  function conversionTooltip(field:'dbCount'|'purchases'|'addToCart'|'completeRegistration'|'initiateCheckout'|'unconfirmed',label:string){
    const rows=byAdvertiserConversions.filter(x=>x[field]>0).sort((a,b)=>b[field]-a[field]);
    if(!rows.length) return `${label} 데이터가 없습니다.`;
    return rows.map(x=>`${x.name}: ${x[field].toLocaleString()}개`).join('\n');
  }
  const errors=[daily.error,keyword.error,creative.error].filter(Boolean);
  return <div className="universe-home-page universe-home-dashboard home-dashboard-v14">
    <header className="home-dashboard-header home-dashboard-header-v14"><div><h1>안녕하세요, {greetingName}님! <span aria-hidden="true">👋</span></h1><p>{advertisers.length?'실제 연결된 매체 API 데이터와 업무 상태가 이곳에 표시됩니다.':'샘플 데이터 없이 시작합니다. 첫 광고주를 등록해 HOWTOM 유니버스를 설정하세요.'}</p></div>
      {!isAdmin && user?.isAdvertiserAccount
        ? <div className="home-advertiser-locked"><b className="home-advertiser-locked-name">{advertiserNames[0] || selectedAdvertiser || '내 광고주'}</b></div>
        : <label className="home-advertiser-select"><span>광고주 선택</span><select value={selectedAdvertiser} onChange={e=>setFilter(e.target.value)} disabled={!advertisers.length}><option value="">전체 광고주</option>{advertiserNames.map(name=><option key={name}>{name}</option>)}</select></label>}
    </header>
    <MetricsDateBar/>
    {errors.length>0&&<div className="card" style={{color:'#b91c1c',borderColor:'#fecaca'}}>{errors[0]}</div>}
    <section className="home-dashboard-kpis home-dashboard-kpis-v14" aria-label="통합 현황">
      <Link to="/dashboard" className="home-dashboard-kpi home-kpi-featured"><span className="home-kpi-label"><WalletCards size={15}/><span>광고비</span></span><strong>{money(overview.spend)}</strong><em><small>{hasPerformance?periodLabel:'데이터 없음'}</small></em></Link>
      <Link to="/reports" className="home-dashboard-kpi"><span className="home-kpi-label"><MousePointerClick size={15}/><span>클릭</span></span><strong>{overview.clicks.toLocaleString()}</strong><em><small>{hasPerformance?periodLabel:'데이터 없음'}</small></em></Link>
      <Link to="/db-management" className="home-dashboard-kpi"><span className="home-kpi-label"><Database size={15}/><span>DB 전환</span></span><strong>{overview.dbCount.toLocaleString()}</strong><em><small>{hasPerformance?periodLabel:'데이터 없음'}</small></em></Link>
      <Link to="/db-management" className="home-dashboard-kpi" title="네이버 상세 리포트가 아직 없는 시점(주로 오늘)이라 확정 분류하지 못한 전환입니다. 다음날 자동 갱신됩니다."><span className="home-kpi-label"><Database size={15}/><span>미확인 전환 ⓘ</span></span><strong>{overview.unconfirmed.toLocaleString()}</strong><em><small>{hasPerformance?periodLabel:'데이터 없음'}</small></em></Link>
      <Link to="/conversion-funnel" className="home-dashboard-kpi"><span className="home-kpi-label"><Target size={15}/><span>구매 전환</span></span><strong>{overview.purchases.toLocaleString()}</strong><em><small>{hasPerformance?periodLabel:'데이터 없음'}</small></em></Link>
      <Link to="/conversion-funnel" className="home-dashboard-kpi"><span className="home-kpi-label"><Target size={15}/><span>CPA</span></span><strong>{(overview.dbCount+overview.purchases)?money(overview.spend/(overview.dbCount+overview.purchases)):'-'}</strong><em><small>{hasPerformance?periodLabel:'데이터 없음'}</small></em></Link>
      <Link to="/report-center" className="home-dashboard-kpi"><span className="home-kpi-label"><TrendingUp size={15}/><span>ROAS</span></span><strong>{pct(roas)}</strong><em><small>{hasPerformance?periodLabel:'데이터 없음'}</small></em></Link>
    </section>
    {!advertisers.length&&<section className="home-dashboard-card" style={{padding:32,textAlign:'center'}}><Sparkles size={34} style={{margin:'0 auto 10px'}}/><h2>HOWTOM 유니버스를 처음 시작합니다.</h2><p style={{color:'#64748b'}}>샘플 데이터가 없는 Zero State입니다.</p><Link className="btn primary" to="/advertisers">첫 광고주 등록</Link></section>}
    <section className="home-dashboard-main-row home-dashboard-main-row-v14"><article className="home-dashboard-card performance-card"><div className="home-card-head home-card-head-compact"><div><h2>광고 성과 요약</h2></div></div>{hasPerformance?<div className="home-summary-numbers" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,padding:'4px 4px 16px'}}><div><small>광고비</small><div style={{fontSize:20,fontWeight:700}}>{money(overview.spend)}</div></div><div><small>전환매출</small><div style={{fontSize:20,fontWeight:700}}>{money(overview.revenue)}</div></div><div><small>클릭</small><div style={{fontSize:20,fontWeight:700}}>{overview.clicks.toLocaleString()}</div></div><div title={conversionTooltip('dbCount','DB 전환')}><small>DB 전환</small><div style={{fontSize:20,fontWeight:700}}>{overview.dbCount.toLocaleString()}</div></div><div title={conversionTooltip('purchases','구매 전환')}><small>구매 전환</small><div style={{fontSize:20,fontWeight:700}}>{overview.purchases.toLocaleString()}</div></div><div title={conversionTooltip('addToCart','장바구니 담기')}><small>장바구니 담기</small><div style={{fontSize:20,fontWeight:700}}>{overview.addToCart.toLocaleString()}</div></div><div title={conversionTooltip('initiateCheckout','결제시작')}><small>결제시작</small><div style={{fontSize:20,fontWeight:700}}>{overview.initiateCheckout.toLocaleString()}</div></div><div title={conversionTooltip('completeRegistration','회원가입')}><small>회원가입</small><div style={{fontSize:20,fontWeight:700}}>{overview.completeRegistration.toLocaleString()}</div></div><div title={`네이버 상세 리포트가 아직 없는 시점(주로 오늘)이라 구매/장바구니/DB 등으로 확정 분류하지 못한 전환입니다. 다음날 자동으로 정확한 값으로 갱신됩니다.\n\n${conversionTooltip('unconfirmed','미확인 전환')}`}><small>미확인 전환 ⓘ</small><div style={{fontSize:20,fontWeight:700,color:overview.unconfirmed>0?'#b45309':undefined}}>{overview.unconfirmed.toLocaleString()}</div></div></div>:<div className="home-empty-data"><TrendingUp size={28}/><b>광고 성과 데이터가 없습니다.</b><span>매체 계정을 연결하고 동기화하면 실제 데이터가 표시됩니다.</span></div>}</article><article className="home-dashboard-card notice-card"><div className="home-card-head home-card-head-compact"><div><h2>최근 동기화</h2></div></div>{(() => { const connected = daily.meta?.connections.filter(c=>c.status==='connected') || []; if (!connected.length) return <div className="home-empty-data"><CheckCircle2 size={26}/><b>연결된 매체가 없습니다.</b><span>매체 계정 연동에서 연결하세요.</span></div>; return <div className="home-sync-list">{connected.slice(0,6).map((c,i)=><div className="home-sync-row" key={i}><span className={`home-sync-chip ${c.channel}`}>{c.channel==='meta'?'Meta':c.channel==='naver'?'네이버':c.channel}</span><span className="home-sync-time">{c.lastSyncedAt?new Date(c.lastSyncedAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'동기화 대기'}</span></div>)}</div>; })()}</article><article className="home-dashboard-card insight-card"><div className="home-card-head home-card-head-compact"><div><h2>AI 추천 인사이트</h2></div></div><div className="home-empty-data"><Bot size={26}/><b>{hasPerformance?'실제 성과를 분석할 수 있습니다.':'분석할 데이터가 없습니다.'}</b><span><Link to="/insights/ai-recommendations">AI 추천 보기</Link></span></div></article></section>
    {/* 매체별 성과 — 홈 요약 아래 */}
    {byChannel.length > 0 && <section className="card home-channel-perf-card">
      <div className="home-card-head home-card-head-compact" style={{marginBottom:10}}>
        <div><h2>매체별 성과</h2><small>선택 기간 채널별 합계</small></div>
        <Link to="/insights/performance" className="home-card-more">자세히 보기</Link>
      </div>
      <div style={{overflowX:'auto'}}>
        <table className="home-channel-table">
          <thead><tr>
            <th>매체</th><th>광고비</th><th>노출</th><th>클릭</th><th>CTR</th>
            <th>DB 전환</th><th>미확인</th><th>구매 전환</th><th>CPA</th><th>매출</th><th>ROAS</th>
          </tr></thead>
          <tbody>{byChannel.map(r=>{
            const totalConv = r.dbCount + r.purchases;
            const ctr = r.impressions > 0 ? (r.clicks/r.impressions*100).toFixed(2)+'%' : '-';
            const cpa = totalConv > 0 ? money(r.spend/totalConv) : '-';
            const roas = r.spend > 0 && r.revenue > 0 ? (r.revenue/r.spend*100).toFixed(0)+'%' : '-';
            const roasNum = r.spend > 0 && r.revenue > 0 ? r.revenue/r.spend*100 : 0;
            return <tr key={r.channel}>
              <td><ChannelTag channel={r.channel}/></td>
              <td className="num">{money(r.spend)}</td>
              <td className="num">{r.impressions.toLocaleString()}</td>
              <td className="num">{r.clicks.toLocaleString()}</td>
              <td className="num">{ctr}</td>
              <td className="num">{r.dbCount||'-'}</td>
              <td className="num" style={{color:r.unconfirmed?'#b45309':undefined}}>{r.unconfirmed||'-'}</td>
              <td className="num">{r.purchases||'-'}</td>
              <td className="num">{cpa}</td>
              <td className="num">{r.revenue>0?money(r.revenue):'-'}</td>
              <td className={`num ${roasNum>=100?'positive':roasNum>0?'warn':''}`}>{roas}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>}

    <nav className="home-quick-menu home-quick-menu-v14" aria-label="빠른 메뉴"><Link to="/dashboard"><TrendingUp size={17}/> 전체 대시보드</Link><Link to="/reports"><FileText size={17}/> 광고 데이터</Link><Link to="/kpi-goals"><CheckCircle2 size={17}/> KPI 관리</Link><Link to="/campaigns"><Megaphone size={17}/> 캠페인 관리</Link><Link to="/creatives/performance"><Sparkles size={17}/> 소재 성과</Link><Link to="/keywords"><Search size={17}/> 키워드 관리</Link><a href={CONTENT_STUDIO_URL.replace(/\/$/,'')+'/production/blog'} target="_blank" rel="noreferrer"><FileText size={17}/> 블로그 제작 ↗</a><Link to="/automation/overview"><Bot size={17}/> AI 자동화</Link></nav>
    <section className="home-bottom-grid home-bottom-grid-v14">
      <article className="home-dashboard-card compact-table-card"><div className="home-card-head home-card-head-compact"><div><h2>주요 키워드 성과</h2><small>전환율 높은 순</small></div></div><div className="home-mini-list">{visibleKeywords.slice(0,5).map((r,i)=>{const badge=r.channel==='naver'?naverTypeBadge(r.campaignType):null;return <div className="home-mini-row" key={`${r.channel}-${r.keywordId||r.keyword}`}><span className={`home-rank-badge r${i+1}`}>{i+1}</span><div className="home-mini-left"><b>{r.keyword}</b><small><ChannelTag channel={r.channel}/>{badge&&<span className="home-naver-type" style={badge.style}>{badge.label}</span>}{r.advertiserName}</small></div><div className="home-mini-right"><b className="home-mini-spend">{money(r.spend)}</b><small className="home-mini-sub">전환 <em>{r.dbCount+(r.purchases||0)+(r.unconfirmed||0)}</em></small></div></div>;})}</div>{!keyword.loading&&!visibleKeywords.length&&<div className="home-empty-data small"><Search size={23}/><b>키워드 데이터가 없습니다.</b></div>}</article>
      <article className="home-dashboard-card compact-table-card"><div className="home-card-head home-card-head-compact"><div><h2>주요 소재 성과</h2><small>CTR 높은 순 · 디스플레이</small></div></div><div className="home-scroll-list">{visibleDisplayCreatives.slice(0,5).map((r,i)=><div className="home-scroll-row" key={`${r.channel}-${r.adId}`}><span className={`home-rank-badge r${i+1}`}>{i+1}</span><ChannelTag channel={r.channel}/><span className="home-scroll-name">{r.adName}<span className="home-scroll-adv">{r.advertiserName}</span></span><span className="home-scroll-ctr">CTR {(r.ctr||0).toFixed(2)}%</span><span className="home-scroll-spend">{money(r.spend)}</span></div>)}</div>{!creative.loading&&!visibleDisplayCreatives.length&&<div className="home-empty-data small"><Sparkles size={23}/><b>소재 데이터가 없습니다.</b></div>}</article>

      <article className="home-dashboard-card compact-table-card"><div className="home-card-head home-card-head-compact"><div><h2>소재 효율 Top 5</h2><small>CTR·CPC·CVR 종합 점수 상위</small></div><Link to="/insights/creatives" className="home-card-more">전체 보기</Link></div>
        {creativeEfficiency.top.length ? <div className="home-scroll-list">{creativeEfficiency.top.map((item,i)=>(
          <div className="home-scroll-row" key={`${item.row.channel}-${item.row.adId}`}>
            <span className={`home-rank-badge r${i+1}`}>{i+1}</span>
            {item.row.thumbnailUrl
              ? <img className="home-scroll-thumb" src={item.row.thumbnailUrl} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
              : <span className="home-scroll-thumb-empty">📷</span>}
            <span className="home-scroll-name">{item.row.adName}<span className="home-scroll-adv">{item.row.advertiserName}</span></span>
            <div className="home-scroll-kpi">
              <span>CTR<em>{item.ctr.toFixed(1)}%</em></span>
              <span>CPC<em>{money(item.cpc)}</em></span>
              <span>CVR<em>{item.cvr.toFixed(1)}%</em></span>
            </div>
          </div>
        ))}</div>
        : <div className="home-empty-data small"><Sparkles size={23}/><b>평가 가능한 소재가 없습니다.</b><span>광고비 1,000원·클릭 5회 이상 소재부터 표시됩니다.</span></div>}
      </article>
      <article className="home-dashboard-card system-card"><div className="home-card-head home-card-head-compact"><div><h2>소재 효율 Worst 5</h2><small>CTR·CPC·CVR 종합 점수 하위</small></div><Link to="/insights/creatives" className="home-card-more">전체 보기</Link></div>
        {creativeEfficiency.worst.length ? <div className="home-scroll-list">{creativeEfficiency.worst.map((item,i)=>(
          <div className="home-scroll-row" key={`${item.row.channel}-${item.row.adId}`}>
            <span className="home-rank-badge" style={{background:'#fef2f2',color:'#dc2626'}}>{i+1}</span>
            {item.row.thumbnailUrl
              ? <img className="home-scroll-thumb" src={item.row.thumbnailUrl} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
              : <span className="home-scroll-thumb-empty">📷</span>}
            <span className="home-scroll-name">{item.row.adName}<span className="home-scroll-adv">{item.row.advertiserName}</span></span>
            <div className="home-scroll-kpi">
              <span>CTR<em className="bad">{item.ctr.toFixed(1)}%</em></span>
              <span>CPC<em className="bad">{money(item.cpc)}</em></span>
              <span>CVR<em>{item.cvr.toFixed(1)}%</em></span>
            </div>
          </div>
        ))}</div>
        : <div className="home-empty-data small"><Sparkles size={23}/><b>평가 가능한 소재가 없습니다.</b></div>}
      </article>

      {/* 5번째: 어드민은 광고주별 성과, 비어드민은 공지사항 */}
      {isAdmin && <article className="home-dashboard-card compact-table-card"><div className="home-card-head home-card-head-compact"><div><h2>광고주별 성과</h2><small>ROAS/전환 높은 순</small></div></div><div className="home-mini-list">{byAdvertiser.slice(0,5).map((r,i)=>{const totalConv=r.db+r.purchases+r.unconfirmed;const roas=r.revenue&&r.spend?r.revenue/r.spend*100:0;const cpa=totalConv?r.spend/totalConv:0;const cvr=r.clicks?totalConv/r.clicks*100:0;return <div className="home-mini-row" key={r.name}><span className={`home-rank-badge r${i+1}`}>{i+1}</span><div className="home-mini-body"><div className="home-mini-top"><b className="home-mini-name">{r.name}</b><b className="home-mini-spend">{money(r.spend)}</b></div><div className="home-mini-sub-row"><small className="home-mini-sub">전환 <em>{totalConv}</em> · ROAS <em className={roas>=100?'positive':''}>{r.revenue&&r.spend?roas.toFixed(0)+'%':'-'}</em> · CPA <em>{totalConv?money(cpa):'-'}</em> · CVR <em>{r.clicks?cvr.toFixed(1)+'%':'-'}</em></small></div></div></div>})}</div>{!daily.loading&&!byAdvertiser.length&&<div className="home-empty-data small"><TrendingUp size={23}/><b>광고 성과 데이터가 없습니다.</b></div>}</article>}
      {!isAdmin && <article className="home-dashboard-card compact-table-card">
        <div className="home-card-head home-card-head-compact">
          <div><h2>공지사항</h2><small>최근 발행된 공지</small></div>
        </div>
        {notices.length ? (
          <div className="home-mini-list">
            {notices.map((n, i) => (
              <div className="home-mini-row" key={n.noticeId} style={{alignItems:'flex-start',gap:8}}>
                <span className={`home-rank-badge r${i+1}`} style={{marginTop:2}}>{i+1}</span>
                <div className="home-mini-left" style={{flex:1,minWidth:0}}>
                  <b style={{fontSize:12,display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.title}</b>
                  <small style={{color:'#94a3b8',fontSize:10}}>{new Date(n.createdAt).toLocaleDateString('ko-KR')}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="home-empty-data small">
            <FileText size={23}/><b>등록된 공지사항이 없습니다.</b>
          </div>
        )}
      </article>}
    </section>
  </div>;
}
