import { Bot, CheckCircle2, Database, FileText, Megaphone, MousePointerClick, Search, Sparkles, Target, TrendingUp, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BRAND_REPORTS } from '../data/brandReports';
import { computeMetric, sumFields } from '../types/brandReport';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { useAuth } from '../context/AuthContext';
import { useAdvertisers } from '../hooks/useAdvertisers';

function toNumber(value: number | undefined) { return value ?? 0; }
function money(value: number) { return `₩${Math.round(value).toLocaleString()}`; }

export function UniverseHomePage() {
  const { filterValue, setFilter } = useAdvertiserFilter();
  const { user, isAdmin } = useAuth();
  const [advertisers] = useAdvertisers();
  const greetingName = isAdmin ? '관리자' : (user?.nickname?.trim() || user?.name?.trim() || user?.advertiser_name?.trim() || '사용자');
  const advertiserNames = advertisers.map(a => a.name);
  const selectedAdvertiser = advertiserNames.includes(filterValue) ? filterValue : '';
  const visibleReports = selectedAdvertiser ? BRAND_REPORTS.filter(report => report.config.brandName === selectedAdvertiser) : BRAND_REPORTS;
  const totals = visibleReports.map(report => sumFields(Object.values(report.data).flatMap(dates => Object.values(dates))));
  const total = sumFields(totals);
  const overview = {
    spend: toNumber(total.spend),
    clicks: toNumber(total.clicks),
    dbCount: toNumber(total.dbCount),
    conversions: toNumber(total.dbCount),
    revenue: toNumber(total.revenue),
    roas: computeMetric('roas', total) ?? 0,
  };
  const hasPerformance = visibleReports.length > 0;

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

      <section className="home-dashboard-kpis home-dashboard-kpis-v14" aria-label="통합 현황">
        <Link to="/dashboard" className="home-dashboard-kpi home-kpi-featured"><span className="home-kpi-label"><WalletCards size={15}/><span>광고비</span></span><strong>{money(overview.spend)}</strong><em><small>{hasPerformance ? '연결 데이터 기준' : '데이터 없음'}</small></em></Link>
        <Link to="/reports" className="home-dashboard-kpi"><span className="home-kpi-label"><MousePointerClick size={15}/><span>클릭</span></span><strong>{overview.clicks.toLocaleString()}</strong><em><small>{hasPerformance ? '연결 데이터 기준' : '데이터 없음'}</small></em></Link>
        <Link to="/db-management" className="home-dashboard-kpi"><span className="home-kpi-label"><Database size={15}/><span>DB</span></span><strong>{overview.dbCount.toLocaleString()}</strong><em><small>{hasPerformance ? '연결 데이터 기준' : '데이터 없음'}</small></em></Link>
        <Link to="/conversion-funnel" className="home-dashboard-kpi"><span className="home-kpi-label"><Target size={15}/><span>전환</span></span><strong>{overview.conversions.toLocaleString()}</strong><em><small>{hasPerformance ? '연결 데이터 기준' : '데이터 없음'}</small></em></Link>
        <Link to="/report-center" className="home-dashboard-kpi"><span className="home-kpi-label"><TrendingUp size={15}/><span>ROAS</span></span><strong>{overview.roas.toFixed(0)}%</strong><em><small>{hasPerformance ? '연결 데이터 기준' : '데이터 없음'}</small></em></Link>
        <Link to="/approval-queue" className="home-dashboard-kpi approval"><span className="home-kpi-label"><CheckCircle2 size={15}/><span>승인 대기</span></span><strong>0<small>건</small></strong><em><small>요청 없음</small></em></Link>
      </section>

      {!advertisers.length ? <section className="home-dashboard-card" style={{padding:32,textAlign:'center'}}><Sparkles size={34} style={{margin:'0 auto 10px'}}/><h2>HOWTOM 유니버스를 처음 시작합니다.</h2><p style={{color:'#64748b'}}>현재 광고주·광고성과·소재·키워드·보고서 샘플 데이터는 모두 제거된 Zero State입니다.</p><Link className="btn primary" to="/advertisers">첫 광고주 등록</Link></section> : null}

      <section className="home-dashboard-main-row home-dashboard-main-row-v14">
        <article className="home-dashboard-card performance-card"><div className="home-card-head home-card-head-compact"><div><h2>광고 성과 요약</h2></div></div><div className="home-empty-data"><TrendingUp size={28}/><b>{hasPerformance ? '연결된 광고 데이터를 집계합니다.' : '광고 성과 데이터가 없습니다.'}</b><span>{hasPerformance ? '실제 수집 데이터가 이 영역에 표시됩니다.' : '광고 API 또는 데이터 수집을 연결하면 성과 그래프가 표시됩니다.'}</span></div></article>
        <article className="home-dashboard-card notice-card"><div className="home-card-head home-card-head-compact"><div><h2>최근 알림</h2></div></div><div className="home-empty-data"><CheckCircle2 size={26}/><b>알림이 없습니다.</b><span>실제 자동화·예산·데이터 수집 이벤트가 발생하면 표시됩니다.</span></div></article>
        <article className="home-dashboard-card insight-card"><div className="home-card-head home-card-head-compact"><div><h2>AI 추천 인사이트</h2></div></div><div className="home-empty-data"><Bot size={26}/><b>분석할 데이터가 없습니다.</b><span>실제 성과 데이터가 쌓이면 추천 인사이트를 생성할 수 있습니다.</span></div></article>
      </section>

      <nav className="home-quick-menu home-quick-menu-v14" aria-label="빠른 메뉴"><strong>빠른 메뉴</strong><Link to="/reports"><FileText size={17}/> 광고 데이터</Link><Link to="/kpi-goals"><CheckCircle2 size={17}/> KPI 관리</Link><Link to="/campaigns"><Megaphone size={17}/> 캠페인 관리</Link><Link to="/creatives/library"><Sparkles size={17}/> 소재 관리</Link><Link to="/keywords"><Search size={17}/> 키워드 관리</Link><Link to="/content/blog"><FileText size={17}/> 블로그 제작</Link><Link to="/automation/overview"><Bot size={17}/> AI 자동화</Link></nav>

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
