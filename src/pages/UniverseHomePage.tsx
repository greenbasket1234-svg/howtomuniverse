import { useEffect, useMemo, useState } from 'react';
import { Bot, CalendarDays, CheckCircle2, Database, FileText, Megaphone, MousePointerClick, Search, Sparkles, Target, TrendingUp, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { useAuth } from '../context/AuthContext';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { apiFetch } from '../hooks/useApi';
import { DateRangePicker, type DateRange } from '../components/DateRangePicker';

function toNumber(value: number | undefined) { return value ?? 0; }
function money(value: number) { return `₩${Math.round(value).toLocaleString()}`; }
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return toISO(d); };
const todayISO = () => toISO(new Date());

type PeriodPreset = 'today' | 'yesterday' | '7d' | '14d' | '30d' | '60d' | '90d' | 'last_month' | 'this_month' | 'custom';
const PERIOD_PRESETS: { key: Exclude<PeriodPreset, 'custom'>; label: string; days?: number }[] = [
  { key: 'today', label: '오늘', days: 1 },
  { key: 'yesterday', label: '어제', days: 1 },
  { key: '7d', label: '최근 7일', days: 7 },
  { key: '14d', label: '최근 14일', days: 14 },
  { key: '30d', label: '최근 30일', days: 30 },
  { key: '60d', label: '최근 60일', days: 60 },
  { key: '90d', label: '최근 90일', days: 90 },
  { key: 'last_month', label: '지난달' },
  { key: 'this_month', label: '이번달' },
];

type DailyMetricRow = { advertiserId: string; channel: string; date: string; impressions: number; clicks: number; spend: number; dbCount: number; revenue?: number; purchases?: number };

export function UniverseHomePage() {
  const { filterValue, setFilter } = useAdvertiserFilter();
  const { user, isAdmin } = useAuth();
  const [advertisers] = useAdvertisers();
  const greetingName = isAdmin ? '관리자' : (user?.nickname?.trim() || user?.name?.trim() || user?.advertiser_name?.trim() || '사용자');
  const advertiserNames = advertisers.map(a => a.name);
  const selectedAdvertiser = advertiserNames.includes(filterValue) ? filterValue : '';

  // 기간 선택: 오늘/어제/최근 N일 프리셋 또는 달력으로 직접 선택한 기간.
  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [range, setRange] = useState<DateRange>({ from: addDays(todayISO(), -29), to: todayISO() });
  const applyPreset = (p: typeof PERIOD_PRESETS[number]) => {
    setPreset(p.key);
    const end = todayISO();
    if (p.key === 'today') setRange({ from: end, to: end });
    else if (p.key === 'yesterday') { const y = addDays(end, -1); setRange({ from: y, to: y }); }
    else if (p.key === 'this_month') setRange({ from: `${end.slice(0, 7)}-01`, to: end });
    else if (p.key === 'last_month') {
      const d = new Date(`${end}T00:00:00`);
      const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const last = new Date(d.getFullYear(), d.getMonth(), 0);
      setRange({ from: toISO(first), to: toISO(last) });
    } else setRange({ from: addDays(end, -((p.days ?? 1) - 1)), to: end });
  };

  // 매체 계정 연동(설정 > 매체 계정 연동)에서 연결·동기화된 실제 데이터를 읽어옵니다.
  const [metricRows, setMetricRows] = useState<DailyMetricRow[]>([]);
  useEffect(() => {
    apiFetch<{ rows: DailyMetricRow[] }>('/daily-metrics').then(r => setMetricRows(r.rows || [])).catch(() => setMetricRows([]));
  }, []);
  const selectedId = selectedAdvertiser ? advertisers.find(a => a.name === selectedAdvertiser)?.id : undefined;
  const visibleRows = useMemo(
    () => metricRows.filter(r => (!selectedId || r.advertiserId === selectedId) && r.date >= range.from && r.date <= range.to),
    [metricRows, selectedId, range],
  );
  const overview = {
    spend: toNumber(visibleRows.reduce((sum, r) => sum + r.spend, 0)),
    clicks: toNumber(visibleRows.reduce((sum, r) => sum + r.clicks, 0)),
    dbCount: toNumber(visibleRows.reduce((sum, r) => sum + r.dbCount, 0)),
    conversions: toNumber(visibleRows.reduce((sum, r) => sum + r.dbCount, 0)),
    revenue: toNumber(visibleRows.reduce((sum, r) => sum + (r.revenue || 0), 0)),
  };
  const roas = overview.spend > 0 ? (overview.revenue / overview.spend) * 100 : 0;
  const hasPerformance = visibleRows.length > 0;
  const periodLabel = range.from === range.to ? range.from : `${range.from} ~ ${range.to}`;

  return (
    <div className="universe-home-page universe-home-dashboard home-dashboard-v14">
      <header className="home-dashboard-header home-dashboard-header-v14">
        <div>
          <h1>안녕하세요, {greetingName}님! <span aria-hidden="true">👋</span></h1>
          <p>{advertisers.length ? '실제 연결된 데이터와 업무 상태가 이곳에 표시됩니다.' : '샘플 데이터 없이 시작합니다. 첫 광고주를 등록해 HOWTOM 유니버스를 설정하세요.'}</p>
        </div>
        <label className="home-advertiser-select">
          <span>광고주 선택</span>
          <select value={selectedAdvertiser} onChange={event => setFilter(event.target.value)} disabled={!advertisers.length}>
            <option value="">전체 광고주</option>
            {advertiserNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </header>

      <div className="home-period-bar" style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',margin:'2px 0 14px'}}>
        <div className="preset-group">{PERIOD_PRESETS.map(p=><button key={p.key} className={preset===p.key?'active':''} onClick={()=>applyPreset(p)}>{p.label}</button>)}</div>
        <div className="toolbar-range"><CalendarDays size={15}/><DateRangePicker value={range} onChange={r=>{setRange(r);setPreset('custom')}}/></div>
        <span className="muted" style={{fontSize:13}}>기준 기간: <b>{periodLabel}</b>{hasPerformance?'':' (해당 기간 데이터 없음)'}</span>
      </div>

      <section className="home-dashboard-kpis home-dashboard-kpis-v14" aria-label="통합 현황">
        <Link to="/dashboard" className="home-dashboard-kpi home-kpi-featured"><span className="home-kpi-label"><WalletCards size={15}/><span>광고비</span></span><strong>{money(overview.spend)}</strong><em><small>{hasPerformance ? periodLabel : '데이터 없음'}</small></em></Link>
        <Link to="/reports" className="home-dashboard-kpi"><span className="home-kpi-label"><MousePointerClick size={15}/><span>클릭</span></span><strong>{overview.clicks.toLocaleString()}</strong><em><small>{hasPerformance ? periodLabel : '데이터 없음'}</small></em></Link>
        <Link to="/db-management" className="home-dashboard-kpi"><span className="home-kpi-label"><Database size={15}/><span>DB</span></span><strong>{overview.dbCount.toLocaleString()}</strong><em><small>{hasPerformance ? periodLabel : '데이터 없음'}</small></em></Link>
        <Link to="/conversion-funnel" className="home-dashboard-kpi"><span className="home-kpi-label"><Target size={15}/><span>전환</span></span><strong>{overview.conversions.toLocaleString()}</strong><em><small>{hasPerformance ? periodLabel : '데이터 없음'}</small></em></Link>
        <Link to="/report-center" className="home-dashboard-kpi"><span className="home-kpi-label"><TrendingUp size={15}/><span>ROAS</span></span><strong>{roas.toFixed(0)}%</strong><em><small>{hasPerformance ? periodLabel : '데이터 없음'}</small></em></Link>
        <Link to="/approval-queue" className="home-dashboard-kpi approval"><span className="home-kpi-label"><CheckCircle2 size={15}/><span>승인 대기</span></span><strong>0<small>건</small></strong><em><small>요청 없음</small></em></Link>
      </section>

      {!advertisers.length ? <section className="home-dashboard-card" style={{padding:32,textAlign:'center'}}><Sparkles size={34} style={{margin:'0 auto 10px'}}/><h2>HOWTOM 유니버스를 처음 시작합니다.</h2><p style={{color:'#64748b'}}>현재 광고주·광고성과·소재·키워드·보고서 샘플 데이터는 모두 제거된 Zero State입니다.</p><Link className="btn primary" to="/advertisers">첫 광고주 등록</Link></section> : null}

      <section className="home-dashboard-main-row home-dashboard-main-row-v14">
        <article className="home-dashboard-card performance-card"><div className="home-card-head home-card-head-compact"><div><h2>광고 성과 요약</h2></div></div>{hasPerformance ? <div className="home-summary-numbers" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,padding:'4px 4px 16px'}}><div><small style={{color:'#64748b'}}>광고비</small><div style={{fontSize:20,fontWeight:700}}>{money(overview.spend)}</div></div><div><small style={{color:'#64748b'}}>매출(구매전환값)</small><div style={{fontSize:20,fontWeight:700}}>{money(overview.revenue)}</div></div><div><small style={{color:'#64748b'}}>클릭수</small><div style={{fontSize:20,fontWeight:700}}>{overview.clicks.toLocaleString()}</div></div><div><small style={{color:'#64748b'}}>DB/리드</small><div style={{fontSize:20,fontWeight:700}}>{overview.dbCount.toLocaleString()}</div></div></div> : <div className="home-empty-data"><TrendingUp size={28}/><b>광고 성과 데이터가 없습니다.</b><span>설정 &gt; 매체 계정 연동에서 광고 계정을 연결하면 이 영역에 실제 데이터가 표시됩니다.</span></div>}</article>
        <article className="home-dashboard-card notice-card"><div className="home-card-head home-card-head-compact"><div><h2>최근 알림</h2></div></div><div className="home-empty-data"><CheckCircle2 size={26}/><b>알림이 없습니다.</b><span>실제 자동화·예산·데이터 수집 이벤트가 발생하면 표시됩니다.</span></div></article>
        <article className="home-dashboard-card insight-card"><div className="home-card-head home-card-head-compact"><div><h2>AI 추천 인사이트</h2></div></div><div className="home-empty-data"><Bot size={26}/><b>분석할 데이터가 없습니다.</b><span>실제 성과 데이터가 쌓이면 추천 인사이트를 생성할 수 있습니다.</span></div></article>
      </section>

      <nav className="home-quick-menu home-quick-menu-v14" aria-label="빠른 메뉴"><Link to="/dashboard"><TrendingUp size={17}/> 전체 대시보드</Link><Link to="/reports"><FileText size={17}/> 광고 데이터</Link><Link to="/kpi-goals"><CheckCircle2 size={17}/> KPI 관리</Link><Link to="/campaigns"><Megaphone size={17}/> 캠페인 관리</Link><Link to="/creatives/library"><Sparkles size={17}/> 소재 관리</Link><Link to="/keywords"><Search size={17}/> 키워드 관리</Link><Link to="/content/blog"><FileText size={17}/> 블로그 제작</Link><Link to="/automation/overview"><Bot size={17}/> AI 자동화</Link></nav>

      <section className="home-bottom-grid home-bottom-grid-v14">
        <article className="home-dashboard-card compact-table-card"><div className="home-card-head home-card-head-compact"><div><h2>주요 키워드 성과</h2></div></div><div className="home-empty-data small"><Search size={23}/><b>키워드 데이터가 없습니다.</b></div></article>
        <article className="home-dashboard-card compact-table-card"><div className="home-card-head home-card-head-compact"><div><h2>주요 소재 성과</h2></div></div><div className="home-empty-data small"><Sparkles size={23}/><b>소재 데이터가 없습니다.</b></div></article>
        <article className="home-dashboard-card compact-table-card"><div className="home-card-head home-card-head-compact"><div><h2>광고주별 성과</h2></div></div><div className="home-empty-data small"><TrendingUp size={23}/><b>광고 성과 데이터가 없습니다.</b></div></article>
        <article className="home-dashboard-card approval-status-card"><div className="home-card-head home-card-head-compact"><div><h2>승인 대기 현황</h2></div></div><div className="home-empty-data small"><CheckCircle2 size={23}/><b>승인 대기 0건</b></div></article>
        <article className="home-dashboard-card system-card"><div className="home-card-head home-card-head-compact"><div><h2>시스템 안내</h2></div></div><div className="home-empty-data small"><FileText size={23}/><b>등록된 공지사항이 없습니다.</b></div></article>
      </section>
    </div>
  );
}
