import { useMemo, useState } from 'react';
import { Bot, CheckCircle2, ChevronRight, Database, FileText, Megaphone, MousePointerClick, Search, Sparkles, Target, TrendingUp, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BRAND_REPORTS } from '../data/brandReports';
import { computeMetric, sumFields } from '../types/brandReport';
import type { RawFields } from '../types/brandReport';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { loadDbRows } from '../utils/dbDataStore';
import { useDbDataRevision } from '../hooks/useDbDataRevision';

function toNumber(value: number | undefined) { return value ?? 0; }
function money(value: number) { return `₩${Math.round(value).toLocaleString()}`; }
function polylinePoints(values: number[]) {
  const max = Math.max(...values, 1);
  const denom = Math.max(values.length - 1, 1);
  return values.map((value, index) => `${(index / denom) * 100},${76 - (value / max) * 64}`).join(' ');
}

function isDbReport(report: (typeof BRAND_REPORTS)[number]) {
  return report.config.rowGroups.some(group => group.metric === 'db_count' && /DB/i.test(`${group.label} ${group.totalLabel ?? ''}`));
}

type DailySummaryRow = Required<Omit<RawFields, 'dbCount'>> & { dbCount: number; conversions: number };
type SummaryMetricKey = 'spend' | 'clicks' | 'dbCount' | 'conversions' | 'revenue' | 'roas';
const METRIC_LABELS: Record<SummaryMetricKey, string> = { spend: '광고비', clicks: '클릭', dbCount: 'DB', conversions: '전환', revenue: '매출', roas: 'ROAS' };
type RangeKey = '7일' | '30일' | '이번달' | '지난달';

// 통합 홈은 광고 데이터와 같은 원본(BRAND_REPORTS)을 사용합니다. DB는 DB형 광고주의 DB만,
// 전환은 친구추가 등 dbCount 필드로 들어오는 전체 액션을 합산해 둘을 구분합니다.
function buildDailySeries(reports: typeof BRAND_REPORTS): Record<string, DailySummaryRow> {
  const byDate: Record<string, DailySummaryRow> = {};
  for (const report of reports) {
    const countsAsDb = isDbReport(report);
    for (const platformData of Object.values(report.data)) {
      for (const [date, fields] of Object.entries(platformData)) {
        if (!byDate[date]) byDate[date] = { impressions: 0, clicks: 0, spend: 0, dbCount: 0, conversions: 0, revenue: 0 };
        byDate[date].impressions += fields.impressions ?? 0;
        byDate[date].clicks += fields.clicks ?? 0;
        byDate[date].spend += fields.spend ?? 0;
        byDate[date].conversions += fields.dbCount ?? 0;
        if (countsAsDb) byDate[date].dbCount += fields.dbCount ?? 0;
        byDate[date].revenue += fields.revenue ?? 0;
      }
    }
  }
  return byDate;
}

function rangeToDates(allDates: string[], range: RangeKey): string[] {
  const sorted = [...allDates].sort();
  if (sorted.length === 0) return [];
  const lastDate = new Date(sorted[sorted.length - 1] + 'T00:00:00');
  if (range === '7일') return sorted.slice(-7);
  if (range === '30일') return sorted.slice(-30);
  if (range === '이번달') {
    const ym = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;
    return sorted.filter(d => d.startsWith(ym));
  }
  const prevMonthDate = new Date(lastDate.getFullYear(), lastDate.getMonth() - 1, 1);
  const ym = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  return sorted.filter(d => d.startsWith(ym));
}

function relativeChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function UniverseHomePage() {
  const { filterValue, setFilter } = useAdvertiserFilter();
  const advertiserNames = useMemo(() => BRAND_REPORTS.map(report => report.config.brandName), []);
  const selectedAdvertiser = advertiserNames.includes(filterValue) ? filterValue : '';
  const visibleReports = useMemo(
    () => selectedAdvertiser ? BRAND_REPORTS.filter(report => report.config.brandName === selectedAdvertiser) : BRAND_REPORTS,
    [selectedAdvertiser],
  );
  const dbRevision = useDbDataRevision();
  const sheetDbRows = useMemo(() => loadDbRows(), [dbRevision]);
  const visibleDbRows = useMemo(() => selectedAdvertiser ? sheetDbRows.filter(row => row.advertiser === selectedAdvertiser) : sheetDbRows, [sheetDbRows, selectedAdvertiser]);

  const overview = useMemo(() => {
    const totals = visibleReports.map(report => sumFields(Object.values(report.data).flatMap(dates => Object.values(dates))));
    const total = sumFields(totals);
    const reportDbCount = visibleReports.filter(isDbReport).reduce((sum, report) => {
      const row = sumFields(Object.values(report.data).flatMap(dates => Object.values(dates)));
      return sum + toNumber(row.dbCount);
    }, 0);
    const sheetDbCount = visibleDbRows.reduce((sum, row) => sum + row.db, 0);
    return {
      spend: toNumber(total.spend),
      clicks: toNumber(total.clicks),
      dbCount: visibleDbRows.length ? sheetDbCount : reportDbCount,
      conversions: toNumber(total.dbCount),
      revenue: toNumber(total.revenue),
      roas: computeMetric('roas', total) ?? 0,
    };
  }, [visibleReports, visibleDbRows]);

  const [summaryMetric, setSummaryMetric] = useState<SummaryMetricKey>('spend');
  const [summaryRange, setSummaryRange] = useState<RangeKey>('30일');
  const dailySeries = useMemo(() => {
    const base = buildDailySeries(visibleReports);
    if (!visibleDbRows.length) return base;
    const byDate = new Map<string, number>();
    visibleDbRows.forEach(row => byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.db));
    byDate.forEach((db, date) => {
      if (!base[date]) base[date] = { impressions: 0, clicks: 0, spend: 0, dbCount: 0, conversions: 0, revenue: 0 };
      base[date].dbCount = db;
    });
    return base;
  }, [visibleReports, visibleDbRows]);
  const allDates = useMemo(() => Object.keys(dailySeries), [dailySeries]);
  const currentDates = useMemo(() => rangeToDates(allDates, summaryRange), [allDates, summaryRange]);
  const previousDates = useMemo(() => {
    const sorted = [...allDates].sort();
    const startIdx = sorted.indexOf(currentDates[0] ?? '');
    if (startIdx <= 0) return [];
    return sorted.slice(Math.max(0, startIdx - currentDates.length), startIdx);
  }, [allDates, currentDates]);
  const metricValueOf = (date: string): number => {
    const row = dailySeries[date];
    if (!row) return 0;
    if (summaryMetric === 'roas') return row.spend > 0 ? (row.revenue / row.spend) * 100 : 0;
    return row[summaryMetric] ?? 0;
  };
  const chartValues = currentDates.length ? currentDates.map(metricValueOf) : [0];
  const previousValues = previousDates.length ? previousDates.map(metricValueOf) : chartValues.map(() => 0);
  const summaryTotal = chartValues.reduce((sum, value) => sum + value, 0);
  const previousTotal = previousValues.reduce((sum, value) => sum + value, 0);
  const summaryAverage = chartValues.length ? summaryTotal / chartValues.length : 0;
  const summaryMax = Math.max(...chartValues, 0);
  const summaryChange = relativeChange(summaryMetric === 'roas' ? summaryAverage : summaryTotal, summaryMetric === 'roas' ? (previousValues.length ? previousTotal / previousValues.length : 0) : previousTotal);
  const formatMetric = (value: number) => summaryMetric === 'spend' || summaryMetric === 'revenue'
    ? money(value)
    : summaryMetric === 'roas'
      ? `${value.toFixed(0)}%`
      : Math.round(value).toLocaleString();
  const summaryDisplay = summaryMetric === 'roas' ? summaryAverage : summaryTotal;

  return (
    <div className="universe-home-page universe-home-dashboard home-dashboard-v14">
      <header className="home-dashboard-header home-dashboard-header-v14">
        <div>
          <h1>안녕하세요, 시윤님! <span aria-hidden="true">👋</span></h1>
          <p>모든 캠페인이 순항 중입니다. 오늘도 좋은 성과를 만들어가요.</p>
        </div>
        <label className="home-advertiser-select">
          <span>광고주 선택</span>
          <select value={selectedAdvertiser} onChange={event => setFilter(event.target.value)}>
            <option value="">전체 광고주</option>
            {advertiserNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </header>

      <section className="home-dashboard-kpis home-dashboard-kpis-v14" aria-label="통합 현황">
        <Link to="/dashboard" className="home-dashboard-kpi home-kpi-featured"><span className="home-kpi-label"><WalletCards size={15} aria-hidden="true"/><span>광고비</span></span><strong>{money(overview.spend)}</strong><em className="positive">▲ 18.2% <small>전일 대비</small></em></Link>
        <Link to="/reports" className="home-dashboard-kpi"><span className="home-kpi-label"><MousePointerClick size={15} aria-hidden="true"/><span>클릭</span></span><strong>{overview.clicks.toLocaleString()}</strong><em className="positive">▲ 16.7% <small>전일 대비</small></em></Link>
        <Link to="/db-management" className="home-dashboard-kpi"><span className="home-kpi-label"><Database size={15} aria-hidden="true"/><span>DB</span></span><strong>{overview.dbCount.toLocaleString()}</strong><em className="positive">▲ 12.5% <small>전일 대비</small></em></Link>
        <Link to="/conversion-funnel" className="home-dashboard-kpi"><span className="home-kpi-label"><Target size={15} aria-hidden="true"/><span>전환</span></span><strong>{overview.conversions.toLocaleString()}</strong><em className="positive">▲ 14.8% <small>전일 대비</small></em></Link>
        <Link to="/report-center" className="home-dashboard-kpi"><span className="home-kpi-label"><TrendingUp size={15} aria-hidden="true"/><span>ROAS</span></span><strong>{overview.roas.toFixed(0)}%</strong><em className="positive">▲ 21.7% <small>전일 대비</small></em></Link>
        <Link to="/approval-queue" className="home-dashboard-kpi approval"><span className="home-kpi-label"><CheckCircle2 size={15} aria-hidden="true"/><span>승인 대기</span></span><strong>23<small>건</small></strong><em className="negative">▲ 15.0% <small>전일 대비</small></em></Link>
      </section>

      <section className="home-dashboard-main-row home-dashboard-main-row-v14">
        <article className="home-dashboard-card performance-card">
          <div className="home-card-head home-card-head-compact"><div><h2>광고 성과 요약 <small>({summaryRange === '30일' ? '최근 30일' : summaryRange === '7일' ? '최근 7일' : summaryRange === '이번달' ? '이번 달' : '지난달'})</small></h2></div>
            <select className="home-period-select" value={summaryRange} onChange={event => setSummaryRange(event.target.value as RangeKey)}><option value="7일">최근 7일</option><option value="30일">최근 30일</option><option value="이번달">이번 달</option><option value="지난달">지난달</option></select>
          </div>
          <div className="home-performance-tabs" role="tablist">
            {(['spend', 'clicks', 'dbCount', 'conversions', 'revenue', 'roas'] as SummaryMetricKey[]).map(key => <button key={key} type="button" className={summaryMetric === key ? 'active' : ''} onClick={() => setSummaryMetric(key)}>{METRIC_LABELS[key]}</button>)}
          </div>
          <div className="home-chart-legend"><span><i className="current"/>이번 기간</span><span><i className="previous"/>이전 기간</span></div>
          <div className="home-line-chart home-line-chart-v14" role="img" aria-label={`${METRIC_LABELS[summaryMetric]} 성과 차트`}>
            <svg viewBox="0 0 100 80" preserveAspectRatio="none"><g className="grid-lines"><line x1="0" y1="16" x2="100" y2="16"/><line x1="0" y1="36" x2="100" y2="36"/><line x1="0" y1="56" x2="100" y2="56"/><line x1="0" y1="76" x2="100" y2="76"/></g><polyline className="previous-line" points={polylinePoints(previousValues)}/><polyline className="current-line" points={polylinePoints(chartValues)}/></svg>
            <div className="home-chart-labels"><span>1</span><span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span></div>
          </div>
          <div className="home-performance-stats"><div><span>총 {METRIC_LABELS[summaryMetric]}</span><b>{formatMetric(summaryDisplay)}</b></div><div><span>평균</span><b>{formatMetric(summaryAverage)}</b></div><div><span>최고</span><b>{formatMetric(summaryMax)}</b></div><div><span>이전 기간 대비</span><b className={summaryChange !== null && summaryChange < 0 ? 'down' : 'up'}>{summaryChange === null ? '-' : `${summaryChange >= 0 ? '▲' : '▼'} ${Math.abs(summaryChange).toFixed(1)}%`}</b></div></div>
        </article>

        <article className="home-dashboard-card notice-card"><div className="home-card-head home-card-head-compact"><div><h2>최근 알림</h2></div><Link to="/automation/alerts">전체 보기 <ChevronRight size={14}/></Link></div><div className="home-dashboard-notices home-notices-v14"><Link to="/brands-budget"><i className="danger"/><div><strong>예산 초과</strong><small>운명백과 / 메타 캠페인의 월 예산을 초과했습니다.</small></div><time>10분 전</time></Link><Link to="/dashboard"><i className="warning"/><div><strong>CPA 상승</strong><small>검색 캠페인 CPA가 20% 이상 상승했습니다.</small></div><time>1시간 전</time></Link><Link to="/conversion-funnel"><i className="success"/><div><strong>전환 증가</strong><small>완도군수산 / 네이버 전환이 전일 대비 증가했습니다.</small></div><time>3시간 전</time></Link><Link to="/monthly-reports"><i className="info"/><div><strong>보고서 생성 완료</strong><small>주간 성과 보고서가 생성되었습니다.</small></div><time>5시간 전</time></Link></div></article>

        <article className="home-dashboard-card insight-card"><div className="home-card-head home-card-head-compact"><div><h2>AI 추천 인사이트</h2></div><Link to="/insights/ai-recommendations">더 보기 <ChevronRight size={14}/></Link></div><div className="home-ai-stack"><div className="home-ai-card purple"><Sparkles size={18}/><div><strong>예산 재분배 제안</strong><p>ROAS가 높은 캠페인에 예산을 15% 추가 배분하면 전환이 증가할 가능성이 있습니다.</p></div><Link to="/brands-budget">자세히 보기</Link></div><div className="home-ai-card green"><Search size={18}/><div><strong>소재 교체 제안</strong><p>CTR이 낮은 소재를 점검해 교체하는 것을 권장합니다.</p></div><Link to="/creatives/library">자세히 보기</Link></div><div className="home-ai-card orange"><Megaphone size={18}/><div><strong>키워드 확장 제안</strong><p>전환 가능성이 높은 신규 키워드 후보를 발견했습니다.</p></div><Link to="/keywords">자세히 보기</Link></div></div></article>
      </section>

      <nav className="home-quick-menu home-quick-menu-v14" aria-label="빠른 메뉴"><strong>빠른 메뉴</strong><Link to="/reports"><FileText size={17}/> 광고 데이터</Link><Link to="/db-management"><Database size={17}/> DB 데이터</Link><Link to="/kpi-goals"><CheckCircle2 size={17}/> KPI 관리</Link><Link to="/campaigns"><Megaphone size={17}/> 캠페인 관리</Link><Link to="/creatives/library"><Sparkles size={17}/> 소재 관리</Link><Link to="/keywords"><Search size={17}/> 키워드 관리</Link><Link to="/monthly-reports"><FileText size={17}/> 월간 보고서</Link><Link to="/next-month-proposal"><FileText size={17}/> 다음달 제안서</Link><Link to="/automation/overview"><Bot size={17}/> AI 자동화</Link></nav>

      <section className="home-bottom-grid home-bottom-grid-v14">
        <article className="home-dashboard-card compact-table-card"><div className="home-card-head home-card-head-compact"><div><h2>주요 키워드 성과 (TOP 5)</h2></div><Link to="/keyword-performance">전체 보기 <ChevronRight size={14}/></Link></div><table className="home-summary-table" data-no-universal-filter="true"><thead><tr><th>순위</th><th>키워드</th><th>클릭</th><th>DB</th><th>전환율</th><th>광고비</th></tr></thead><tbody>{[['브랜드 키워드','12,456','312','2.51%','₩1,250,000'],['핵심 키워드','8,732','201','2.30%','₩850,000'],['제품 키워드','7,654','156','2.04%','₩720,000'],['경쟁사 키워드','5,321','98','1.84%','₩510,000'],['롱테일 키워드','4,987','87','1.74%','₩472,000']].map((row,index) => <tr key={row[0]}><td>{index + 1}</td><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td>{row[4]}</td></tr>)}</tbody></table></article>
        <article className="home-dashboard-card compact-table-card"><div className="home-card-head home-card-head-compact"><div><h2>광고주별 성과</h2></div><Link to="/dashboard">전체 보기 <ChevronRight size={14}/></Link></div><table className="home-summary-table" data-no-universal-filter="true"><thead><tr><th>광고주</th><th>광고비</th><th>전환</th><th>ROAS</th></tr></thead><tbody>{visibleReports.slice(0,5).map(report => { const total=sumFields(Object.values(report.data).flatMap(dates => Object.values(dates))); return <tr key={report.config.brandId}><td>{report.config.brandName}</td><td>{money(toNumber(total.spend))}</td><td>{toNumber(total.dbCount).toLocaleString()}</td><td>{(computeMetric('roas',total)??0).toFixed(0)}%</td></tr>; })}</tbody></table></article>
        <article className="home-dashboard-card approval-status-card"><div className="home-card-head home-card-head-compact"><div><h2>승인 대기 현황</h2></div><Link to="/approval-queue">전체 보기 <ChevronRight size={14}/></Link></div><div className="approval-donut"><strong>23<small>건</small></strong></div><ul><li><i className="tone1"/>광고 소재 <b>12건</b></li><li><i className="tone2"/>캠페인 <b>6건</b></li><li><i className="tone3"/>키워드 <b>3건</b></li><li><i className="tone4"/>기타 <b>2건</b></li></ul></article>
        <article className="home-dashboard-card system-card"><div className="home-card-head home-card-head-compact"><div><h2>시스템 안내</h2></div><Link to="/admin">전체 보기 <ChevronRight size={14}/></Link></div><div className="system-list"><Link to="/admin"><span>[업데이트] 월간 보고서 기능이 개선되었습니다.</span><time>08.08</time></Link><Link to="/admin"><span>[안내] 시스템 점검 안내</span><time>08.07</time></Link><Link to="/kpi-goals"><span>[팁] KPI 설정으로 더 정확한 분석을!</span><time>08.06</time></Link><Link to="/insights/ai-recommendations"><span>[안내] 새로운 AI 기능이 추가되었습니다.</span><time>08.05</time></Link></div></article>
      </section>
    </div>
  );
}
