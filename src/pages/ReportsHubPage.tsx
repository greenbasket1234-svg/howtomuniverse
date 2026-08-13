import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, CalendarDays } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { BrandReportGrid, PeriodSelector } from '../components/BrandReportGrid';
import { DateRangePicker, DateRange } from '../components/DateRangePicker';
import { MetricPicker } from '../components/MetricPicker';
import { PeriodType, enumerateDates, type BrandReportConfig, type BrandDailyData } from '../types/brandReport';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { apiFetch } from '../hooks/useApi';

type DailyMetricRow = { advertiserId: string; channel: string; date: string; impressions: number; clicks: number; spend: number; dbCount: number; revenue?: number };
type CreativeMetricRow = { advertiserId: string; channel: string; adId: string; adName: string; campaignName?: string; impressions: number; clicks: number; spend: number; dbCount: number; revenue?: number };
const CHANNEL_LABELS: Record<string, string> = { meta: '메타', naver: '네이버', google: '구글', daangn: '당근', tiktok: '틱톡', kakao: '카카오' };
/** 다른 화면(통합 홈·전체 대시보드)과 동일한 방식으로, 실제 연동 데이터를 브랜드 보고서 형태로 변환합니다. */
function buildLiveBrandReports(advertisers: { id: string; name: string; monthlyBudget: number }[], rows: DailyMetricRow[]): { config: BrandReportConfig; data: BrandDailyData }[] {
  return advertisers.map(adv => {
    const advRows = rows.filter(r => r.advertiserId === adv.id);
    const channels = Array.from(new Set(advRows.map(r => r.channel)));
    const tracksRevenue = advRows.some(r => (r.revenue ?? 0) > 0);
    const data: BrandDailyData = {};
    for (const ch of channels) {
      data[ch] = {};
      for (const row of advRows.filter(r => r.channel === ch)) {
        data[ch][row.date] = { impressions: row.impressions, clicks: row.clicks, spend: row.spend, dbCount: row.dbCount, ...(tracksRevenue ? { revenue: row.revenue ?? 0 } : {}) };
      }
    }
    return { config: { brandId: adv.id, brandName: adv.name, hasRealData: true, lineItems: channels.map(ch => ({ key: ch, label: CHANNEL_LABELS[ch] ?? ch })), rowGroups: [], monthlyBudget: adv.monthlyBudget }, data };
  });
}

type ReportRange = 'yesterday' | 'today' | 'daily' | 'weekly' | 'monthly' | 'custom';
type ReportTab = 'period' | 'daily';

type Snapshot = {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

const zeroSnapshot=(label:string):Snapshot=>({label,spend:0,impressions:0,clicks:0,conversions:0,revenue:0});
const SNAPSHOTS: Record<ReportRange, Snapshot> = {
  yesterday:zeroSnapshot('어제'),today:zeroSnapshot('오늘'),daily:zeroSnapshot('일간'),weekly:zeroSnapshot('주간'),monthly:zeroSnapshot('월간'),custom:zeroSnapshot('직접 선택'),
};

function won(value: number) {
  return `₩${Math.round(value).toLocaleString()}`;
}

function percent(value: number) {
  return `${value.toFixed(value >= 100 ? 0 : 2)}%`;
}

function downloadCsv(snapshot: Snapshot) {
  const rows = [
    ['지표', '값'],
    ['기간', snapshot.label],
    ['광고비', snapshot.spend],
    ['노출', snapshot.impressions],
    ['클릭', snapshot.clicks],
    ['전환/예약', snapshot.conversions],
    ['전환매출', snapshot.revenue],
  ];
  const csv = rows.map((row) => row.join(',')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `HOWTOM_유니버스_보고서_${snapshot.label.replace(/[^0-9가-힣]+/g, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}


function formatDateKo(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return `${year}.${String(month).padStart(2,'0')}.${String(day).padStart(2,'0')}`;
}

function getWeekRange(anchor: string) {
  const date = new Date(`${anchor}T00:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { from: iso(start), to: iso(end) };
}

function ReportOverview() {
  const [tab, setTab] = useState<ReportTab>('period');
  const [range, setRange] = useState<ReportRange>('yesterday');
  const [customRange, setCustomRange] = useState<DateRange>(()=>{const d=new Date().toISOString().slice(0,10);return {from:d,to:d}});
  const [dailyDate, setDailyDate] = useState(()=>new Date().toISOString().slice(0,10));
  const [weeklyAnchor, setWeeklyAnchor] = useState(()=>new Date().toISOString().slice(0,10));
  const [monthlyValue, setMonthlyValue] = useState(()=>new Date().toISOString().slice(0,7));
  const weekRange = getWeekRange(weeklyAnchor);

  // 매체 계정 연동에서 동기화된 실제 데이터를 가져옵니다.
  const [advertisers] = useAdvertisers();
  const [metricRows, setMetricRows] = useState<DailyMetricRow[]>([]);
  const [creativeRows, setCreativeRows] = useState<CreativeMetricRow[]>([]);
  useEffect(() => {
    apiFetch<{ rows: DailyMetricRow[] }>('/daily-metrics').then(r => setMetricRows(r.rows || [])).catch(() => setMetricRows([]));
    apiFetch<{ rows: CreativeMetricRow[] }>('/creative-metrics').then(r => setCreativeRows(r.rows || [])).catch(() => setCreativeRows([]));
  }, []);

  // 현재 선택된 기간(어제/오늘/일간/주간/월간/직접선택)에 맞는 날짜 범위를 계산합니다.
  const todayIso = new Date().toISOString().slice(0, 10);
  const yesterdayIso = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
  const activeRangeIso = (() => {
    if (range === 'today') return { from: todayIso, to: todayIso };
    if (range === 'yesterday') return { from: yesterdayIso, to: yesterdayIso };
    if (range === 'daily') return { from: dailyDate, to: dailyDate };
    if (range === 'weekly') return weekRange;
    if (range === 'monthly') { const [y, m] = monthlyValue.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return { from: `${monthlyValue}-01`, to: `${monthlyValue}-${String(last).padStart(2,'0')}` }; }
    return customRange;
  })();
  const filteredRows = useMemo(
    () => metricRows.filter(r => r.date >= activeRangeIso.from && r.date <= activeRangeIso.to),
    [metricRows, activeRangeIso.from, activeRangeIso.to],
  );

  const dynamicLabel = range === 'custom'
    ? `${formatDateKo(customRange.from)} ~ ${formatDateKo(customRange.to)} · 직접 선택`
    : range === 'daily'
      ? `${formatDateKo(dailyDate)} · 일간`
      : range === 'weekly'
        ? `${formatDateKo(weekRange.from)} ~ ${formatDateKo(weekRange.to)} · 주간`
        : range === 'monthly'
          ? `${monthlyValue.replace('-', '년 ')}월 · 월간`
          : SNAPSHOTS[range].label;
  const snapshot: Snapshot = {
    label: dynamicLabel,
    spend: filteredRows.reduce((s, r) => s + r.spend, 0),
    impressions: filteredRows.reduce((s, r) => s + r.impressions, 0),
    clicks: filteredRows.reduce((s, r) => s + r.clicks, 0),
    conversions: filteredRows.reduce((s, r) => s + r.dbCount, 0),
    revenue: filteredRows.reduce((s, r) => s + (r.revenue || 0), 0),
  };

  const roas = snapshot.spend > 0 ? (snapshot.revenue / snapshot.spend) * 100 : 0;
  const dateLabel = snapshot.label;

  const advertiserName = (id: string) => advertisers.find(a => a.id === id)?.name ?? id;
  const CHANNEL_COLUMN: Record<string, 'meta'|'naver'|'google'|'other'> = { meta: 'meta', naver: 'naver', google: 'google' };
  // 브랜드(광고주) × 매체별 광고비 표
  const brandChannelData = useMemo(() => {
    const byAdvertiser = new Map<string, { brand: string; color: string; meta: number; naver: number; google: number; other: number }>();
    filteredRows.forEach(r => {
      const key = r.advertiserId;
      const row = byAdvertiser.get(key) ?? { brand: advertiserName(key), color: advertisers.find(a=>a.id===key)?.color ?? '#2563eb', meta: 0, naver: 0, google: 0, other: 0 };
      const col = CHANNEL_COLUMN[r.channel] ?? 'other';
      row[col] += r.spend;
      byAdvertiser.set(key, row);
    });
    return Array.from(byAdvertiser.values());
  }, [filteredRows, advertisers]);
  const totals = useMemo(() => {
    return brandChannelData.reduce(
      (acc, row) => ({
        meta: acc.meta + row.meta,
        naver: acc.naver + row.naver,
        google: acc.google + row.google,
        other: acc.other + row.other,
      }),
      { meta: 0, naver: 0, google: 0, other: 0 },
    );
  }, [brandChannelData]);

  // 브랜드별 요약 표(현재 기간 기준)
  const brandSummaryRows = useMemo(() => {
    const byAdvertiser = new Map<string, { advertiserId: string; brand: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number }>();
    filteredRows.forEach(r => {
      const row = byAdvertiser.get(r.advertiserId) ?? { advertiserId: r.advertiserId, brand: advertiserName(r.advertiserId), spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
      row.spend += r.spend; row.impressions += r.impressions; row.clicks += r.clicks; row.conversions += r.dbCount; row.revenue += r.revenue || 0;
      byAdvertiser.set(r.advertiserId, row);
    });
    return Array.from(byAdvertiser.values());
  }, [filteredRows, advertisers]);

  // 캠페인별 표는 매체 계정 연동 시 동기화된 소재(광고) 데이터를 캠페인명 기준으로 묶어서 보여줍니다.
  // (일 단위가 아니라, 가장 최근 동기화 시점 기준 누적치입니다.)
  const campaignRows = useMemo(() => {
    const byCampaign = new Map<string, { campaign: string; brand: string; media: string; spend: number; impressions: number; clicks: number; cpm: number; ctr: number; conversions: number; revenue: number }>();
    creativeRows.forEach(r => {
      const key = `${r.advertiserId}|${r.campaignName || '(캠페인명 없음)'}`;
      const row = byCampaign.get(key) ?? { campaign: r.campaignName || '(캠페인명 없음)', brand: advertiserName(r.advertiserId), media: CHANNEL_LABELS[r.channel] ?? r.channel, spend: 0, impressions: 0, clicks: 0, cpm: 0, ctr: 0, conversions: 0, revenue: 0 };
      row.spend += r.spend; row.impressions += r.impressions; row.clicks += r.clicks; row.conversions += r.dbCount; row.revenue += r.revenue || 0;
      byCampaign.set(key, row);
    });
    return Array.from(byCampaign.values()).map(r => ({ ...r, cpm: r.impressions ? r.spend / r.impressions * 1000 : 0, ctr: r.impressions ? r.clicks / r.impressions * 100 : 0 }));
  }, [creativeRows, advertisers]);

  const selectPeriodRange = (next: ReportRange) => {
    setRange(next);
  };

  return (
    <div className="report-capture-page">
      <PageHeader title="통합 보고서" description="일간·주간·월간 및 직접 선택한 기간의 광고비와 성과를 비교합니다." />

      <div className="report-tabs">
        <button className={tab === 'period' ? 'active' : ''} onClick={() => { setTab('period'); if (!['yesterday','today','daily','weekly','monthly','custom'].includes(range)) setRange('yesterday'); }}><CalendarDays size={15}/> 기간 보고서</button>
        <button className={tab === 'daily' ? 'active' : ''} onClick={() => { setTab('daily'); if (!['yesterday','today','daily'].includes(range)) setRange('yesterday'); }}><CalendarDays size={15}/> 일별 보고서</button>
      </div>

      <div className="report-control-row redesigned">
        {tab === 'period' ? (
          <div className="report-range-group wrap">
            <button className={range === 'yesterday' ? 'active' : ''} onClick={() => selectPeriodRange('yesterday')}>어제</button>
            <button className={range === 'today' ? 'active' : ''} onClick={() => selectPeriodRange('today')}>오늘</button>
            <button className={range === 'daily' ? 'active' : ''} onClick={() => selectPeriodRange('daily')}>일간</button>
            <button className={range === 'weekly' ? 'active' : ''} onClick={() => selectPeriodRange('weekly')}>주간</button>
            <button className={range === 'monthly' ? 'active' : ''} onClick={() => selectPeriodRange('monthly')}>월간</button>
            <button className={range === 'custom' ? 'active' : ''} onClick={() => selectPeriodRange('custom')}>직접선택</button>
          </div>
        ) : (
          <div className="report-range-group">
            <button className={range === 'yesterday' ? 'active' : ''} onClick={() => selectPeriodRange('yesterday')}>어제</button>
            <button className={range === 'today' ? 'active' : ''} onClick={() => selectPeriodRange('today')}>오늘</button>
            <button className={range === 'daily' ? 'active' : ''} onClick={() => selectPeriodRange('daily')}>일간</button>
          </div>
        )}

        <div className="report-date-display"><CalendarDays size={15}/><strong>{dateLabel}</strong></div>
        <button className="btn secondary report-export" onClick={() => downloadCsv(snapshot)}><Download size={15}/> 내보내기 CSV</button>
      </div>

      {tab === 'period' && range === 'daily' && (
        <div className="report-custom-calendar card report-calendar-single">
          <label>일간 기준 날짜<input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)}/></label>
        </div>
      )}

      {tab === 'daily' && range === 'daily' && (
        <div className="report-custom-calendar card report-calendar-single">
          <label>일별 보고서 날짜<input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)}/></label>
        </div>
      )}

      {tab === 'period' && range === 'weekly' && (
        <div className="report-custom-calendar card report-calendar-single">
          <label>주간 기준 날짜<input type="date" value={weeklyAnchor} onChange={(e) => setWeeklyAnchor(e.target.value)}/></label>
          <small>{formatDateKo(weekRange.from)}부터 {formatDateKo(weekRange.to)}까지 조회합니다.</small>
        </div>
      )}

      {tab === 'period' && range === 'monthly' && (
        <div className="report-custom-calendar card report-calendar-single">
          <label>조회 월<input type="month" value={monthlyValue} onChange={(e) => setMonthlyValue(e.target.value)}/></label>
        </div>
      )}

      {tab === 'period' && range === 'custom' && (
        <div className="report-custom-calendar card">
          <label>시작일<input type="date" value={customRange.from} onChange={(e) => setCustomRange({ ...customRange, from: e.target.value })}/></label>
          <span>~</span>
          <label>종료일<input type="date" value={customRange.to} min={customRange.from} onChange={(e) => setCustomRange({ ...customRange, to: e.target.value })}/></label>
        </div>
      )}

      <div className="report-kpi-grid">
        <div className="report-kpi-card"><span>광고비</span><strong>{won(snapshot.spend)}</strong><small>전기간 ▼4%</small></div>
        <div className="report-kpi-card"><span>노출</span><strong>{snapshot.impressions.toLocaleString()}</strong><small>전기간 ▲9%</small></div>
        <div className="report-kpi-card"><span>클릭</span><strong>{snapshot.clicks.toLocaleString()}</strong><small className="down">전기간 ▼8%</small></div>
        <div className="report-kpi-card"><span>전환/예약</span><strong>{snapshot.conversions.toLocaleString()}</strong><small className="down">전기간 ▼43%</small></div>
        <div className="report-kpi-card"><span>전환매출</span><strong>{won(snapshot.revenue)}</strong><small className="down">전기간 ▼56%</small></div>
        <div className="report-kpi-card"><span>ROAS</span><strong>{percent(roas)}</strong><small className="down">전기간 ▼54%</small></div>
      </div>
      <div className="report-compare-note">비교 기준: 전기간 대비</div>

      <section className="card report-section-card">
        <h3>채널별 광고비 (브랜드 × 매체)</h3>
        <div className="table-scroll">
          <table className="ops-table report-table">
            <thead><tr><th>브랜드</th><th>Meta</th><th>네이버</th><th>구글</th><th>기타/직접</th><th>합계</th></tr></thead>
            <tbody>
              {brandChannelData.map((row) => {
                const total = row.meta + row.naver + row.google + row.other;
                return <tr key={row.brand}><td><span className="report-brand-dot" style={{background:row.color}}/>{row.brand}</td><td>{row.meta ? won(row.meta) : '-'}</td><td>{row.naver ? won(row.naver) : '-'}</td><td>{row.google ? won(row.google) : '-'}</td><td>{row.other ? won(row.other) : '-'}</td><td><b>{won(total)}</b></td></tr>;
              })}
              <tr className="sum"><td><b>전체 합산</b></td><td><b>{won(totals.meta)}</b></td><td><b>{won(totals.naver)}</b></td><td><b>{won(totals.google)}</b></td><td><b>{won(totals.other)}</b></td><td><b>{won(totals.meta+totals.naver+totals.google+totals.other)}</b></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card report-section-card">
        <h3>브랜드별 보고서 ({dateLabel})</h3>
        <div className="table-scroll">
          <table className="ops-table report-table">
            <thead><tr><th>브랜드</th><th>광고비</th><th>노출</th><th>클릭</th><th>CTR</th><th>전환/예약</th><th>전환매출</th><th>ROAS</th></tr></thead>
            <tbody>
              {brandSummaryRows.map(row => {
                const ctr = row.impressions ? row.clicks / row.impressions * 100 : 0;
                const rowRoas = row.spend > 0 ? row.revenue / row.spend * 100 : 0;
                return <tr key={row.advertiserId}>
                  <td><Link className="brand-name-link" to={`/report-center/${row.advertiserId}`}>{row.brand}</Link></td>
                  <td>{won(row.spend)}</td><td>{row.impressions.toLocaleString()}</td><td>{row.clicks.toLocaleString()}</td>
                  <td>{percent(ctr)}</td><td>{row.conversions.toLocaleString()}</td>
                  <td>{row.revenue ? won(row.revenue) : '-'}</td><td>{row.revenue ? percent(rowRoas) : '-'}</td>
                </tr>;
              })}
              {!brandSummaryRows.length && <tr><td colSpan={8} style={{textAlign:'center',color:'var(--text-muted)',padding:'20px 0'}}>이 기간에 집계된 데이터가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card report-section-card">
        <h3>캠페인별 보고서 ({dateLabel})</h3>
        <div className="table-scroll">
          <table className="ops-table report-table campaign-report-table">
            <thead><tr><th>캠페인</th><th>매체</th><th>광고비</th><th>노출</th><th>클릭</th><th>CPM</th><th>CTR</th><th>전환/예약</th><th>전환매출</th><th>ROAS</th></tr></thead>
            <tbody>
              {campaignRows.map((row) => {
                const campaignRoas = row.spend > 0 ? (row.revenue / row.spend) * 100 : 0;
                return <tr key={row.campaign}><td><b>{row.campaign}</b><small>{row.brand}</small></td><td><span className="media-pill">{row.media}</span></td><td>{won(row.spend)}</td><td>{row.impressions.toLocaleString()}</td><td>{row.clicks.toLocaleString()}</td><td>{row.cpm ? won(row.cpm) : '-'}</td><td>{percent(row.ctr)}</td><td>{row.conversions}</td><td>{row.revenue ? won(row.revenue) : '-'}</td><td>{row.revenue ? percent(campaignRoas) : '-'}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="footnote">모든 매체는 매체의 원본 열을 성과 기준으로 정규화해 표시합니다.</div>
      </section>
      <section className="report-thank-you-page" aria-label="보고서 마지막 페이지"><strong>감사합니다.</strong></section>
    </div>
  );
}

export function ReportsHubPage() {
  const { brandId } = useParams();
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [range, setRange] = useState<DateRange>(()=>{const d=new Date().toISOString().slice(0,10);return {from:d,to:d}});
  const [advertisers] = useAdvertisers();
  const [metricRows, setMetricRows] = useState<DailyMetricRow[]>([]);
  useEffect(() => { apiFetch<{ rows: DailyMetricRow[] }>('/daily-metrics').then(r => setMetricRows(r.rows || [])).catch(() => setMetricRows([])); }, []);
  const liveReports = useMemo(() => buildLiveBrandReports(advertisers, metricRows), [advertisers, metricRows]);
  const report = liveReports.find((r) => r.config.brandId === brandId);
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());

  if (!brandId) return <ReportOverview />;

  if (!report) {
    return (
      <div>
        <Link to="/reports" className="breadcrumb-back">← 통합 보고서로</Link>
        <div className="card"><EmptyState title={`"${brandId}" 광고주를 찾을 수 없습니다.`} /></div>
      </div>
    );
  }

  if (selectedGroups.size === 0) {
    report.config.lineItems.forEach((_, i) => selectedGroups.add(i));
  }

  // 노출/클릭/광고비/DB(+매출 추적 시 매출·ROAS)를 지표별로 한 그룹씩 구성합니다 - 연동된 실제 채널 전체 기준.
  const tracksRevenue = Object.values(report.data).some(byDate => Object.values(byDate).some(f => f.revenue !== undefined));
  const channelKeys = report.config.lineItems.map(i => i.key);
  const metricDefs: { metric: 'impressions'|'clicks'|'ad_spend'|'db_count'|'revenue'|'roas'; label: string }[] = [
    { metric: 'impressions', label: '노출' }, { metric: 'clicks', label: '클릭' }, { metric: 'ad_spend', label: '광고비' }, { metric: 'db_count', label: 'DB/리드' },
    ...(tracksRevenue ? [{ metric: 'revenue' as const, label: '매출' }, { metric: 'roas' as const, label: 'ROAS' }] : []),
  ];
  const rowGroups = metricDefs.map(m => ({ metric: m.metric, label: m.label, totalLabel: '합계', items: channelKeys }));
  const filteredConfig = { ...report.config, rowGroups: rowGroups.filter((_, i) => selectedGroups.has(i)) };
  const dates = enumerateDates(range.from, range.to);
  const metricOptions = rowGroups.map((g, i) => ({ key: i, label: g.label }));

  return (
    <div>
      <Link to="/reports" className="breadcrumb-back">← 통합 보고서로</Link>
      <PageHeader title={`${report.config.brandName} 보고서`} description="브랜드 통합 보고서입니다. 매체 계정 연동으로 실제 수집된 데이터를 표시합니다." action={<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><DateRangePicker value={range} onChange={setRange}/><PeriodSelector value={period} onChange={setPeriod}/><MetricPicker options={metricOptions} selected={selectedGroups} onChange={setSelectedGroups}/></div>} />
      <div className="card"><div className="card-title">통합 보고서</div>{filteredConfig.rowGroups.length===0?<EmptyState title="표시할 지표를 선택해주세요." description="상단의 지표 선택에서 최소 1개 이상 켜주세요."/>:<BrandReportGrid config={filteredConfig} data={report.data} dates={dates} period={period}/>}</div>
    </div>
  );
}
