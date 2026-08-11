import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, CalendarDays } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { BrandReportGrid, PeriodSelector } from '../components/BrandReportGrid';
import { DateRangePicker, DateRange } from '../components/DateRangePicker';
import { MetricPicker } from '../components/MetricPicker';
import { BRAND_REPORTS } from '../data/brandReports';
import { PeriodType, enumerateDates } from '../types/brandReport';

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

const SNAPSHOTS: Record<ReportRange, Snapshot> = {
  yesterday: { label: '7/5 (일) · 어제', spend: 90215, impressions: 19754, clicks: 886, conversions: 8, revenue: 360000 },
  today: { label: '7/6 (월) · 오늘', spend: 78160, impressions: 16820, clicks: 754, conversions: 7, revenue: 331000 },
  daily: { label: '7/5 (일) · 일간', spend: 90215, impressions: 19754, clicks: 886, conversions: 8, revenue: 360000 },
  weekly: { label: '6/29 ~ 7/5 · 주간', spend: 620107, impressions: 133338, clicks: 6436, conversions: 51, revenue: 2807800 },
  monthly: { label: '7월 · 월간', spend: 737144, impressions: 159420, clicks: 7132, conversions: 58, revenue: 3209400 },
  custom: { label: '직접 선택', spend: 737144, impressions: 159420, clicks: 7132, conversions: 58, revenue: 3209400 },
};

const brandChannelData = [
  { brand: '월컴투바베큐', color: '#f59e0b', meta: 58208, naver: 9430, google: 20744, other: 0 },
  { brand: '노멜', color: '#10b981', meta: 0, naver: 1833, google: 0, other: 0 },
];

const campaignRows = [
  { campaign: '20260609_드론택', brand: '월컴투바베큐', media: 'Meta', spend: 58208, impressions: 12507, clicks: 408, cpm: 4654, ctr: 3.26, conversions: 0, revenue: 0 },
  { campaign: '20260619.1_무더운 여름은 월컴투바베큐에서!', brand: '월컴투바베큐', media: 'Google Ads', spend: 20744, impressions: 5934, clicks: 458, cpm: 3496, ctr: 7.72, conversions: 0, revenue: 0 },
  { campaign: '#월컴투바베큐', brand: '월컴투바베큐', media: '네이버 검색', spend: 9430, impressions: 330, clicks: 17, cpm: 28576, ctr: 5.15, conversions: 0, revenue: 0 },
  { campaign: '00_노멜_자사몰_자사명', brand: '노멜', media: '네이버 검색', spend: 1300, impressions: 252, clicks: 2, cpm: 5159, ctr: 0.79, conversions: 0, revenue: 0 },
  { campaign: '노멜_자사몰_M', brand: '노멜', media: '네이버 검색', spend: 533, impressions: 594, clicks: 1, cpm: 897, ctr: 0.17, conversions: 0, revenue: 0 },
  { campaign: '직접입력_WTB어드민(자동)', brand: '월컴투바베큐', media: '기타', spend: 0, impressions: 0, clicks: 0, cpm: 0, ctr: 0, conversions: 8, revenue: 360000 },
];

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
  const [customRange, setCustomRange] = useState<DateRange>({ from: '2026-07-01', to: '2026-07-06' });
  const [dailyDate, setDailyDate] = useState('2026-07-05');
  const [weeklyAnchor, setWeeklyAnchor] = useState('2026-07-05');
  const [monthlyValue, setMonthlyValue] = useState('2026-07');
  const weekRange = getWeekRange(weeklyAnchor);
  const snapshotBase = SNAPSHOTS[range];
  const dynamicLabel = range === 'custom'
    ? `${formatDateKo(customRange.from)} ~ ${formatDateKo(customRange.to)} · 직접 선택`
    : range === 'daily'
      ? `${formatDateKo(dailyDate)} · 일간`
      : range === 'weekly'
        ? `${formatDateKo(weekRange.from)} ~ ${formatDateKo(weekRange.to)} · 주간`
        : range === 'monthly'
          ? `${monthlyValue.replace('-', '년 ')}월 · 월간`
          : snapshotBase.label;
  const snapshot = { ...snapshotBase, label: dynamicLabel };

  const roas = snapshot.spend > 0 ? (snapshot.revenue / snapshot.spend) * 100 : 0;
  const dateLabel = snapshot.label;

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
  }, []);

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
              <tr><td><span className="report-brand-dot orange"/>월컴투바베큐<small>오프라인 예약/방문형</small></td><td>{won(88382)}</td><td>18,771</td><td>883</td><td>4.70%</td><td>8</td><td>{won(360000)}</td><td>407%</td></tr>
              <tr><td><span className="report-brand-dot green"/>노멜<small>쇼핑몰 구매전환형</small></td><td>{won(1833)}</td><td>983</td><td>3</td><td>0.31%</td><td>0</td><td>-</td><td>-</td></tr>
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
  const [range, setRange] = useState<DateRange>({ from: '2026-07-01', to: '2026-07-12' });
  const report = BRAND_REPORTS.find((r) => r.config.brandId === brandId);
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
    report.config.rowGroups.forEach((_, i) => selectedGroups.add(i));
  }

  const filteredConfig = { ...report.config, rowGroups: report.config.rowGroups.filter((_, i) => selectedGroups.has(i)) };
  const dates = enumerateDates(range.from, range.to);
  const metricOptions = report.config.rowGroups.map((g, i) => ({ key: i, label: g.label }));

  return (
    <div>
      <Link to="/reports" className="breadcrumb-back">← 통합 보고서로</Link>
      <PageHeader title={`${report.config.brandName} 보고서`} description="브랜드 통합 보고서입니다. 채널·지표 구성은 광고주 설정을 따릅니다." action={<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><DateRangePicker value={range} onChange={setRange}/><PeriodSelector value={period} onChange={setPeriod}/><MetricPicker options={metricOptions} selected={selectedGroups} onChange={setSelectedGroups}/></div>} />
      {!report.config.hasRealData && <div className="footnote" style={{marginBottom:12}}><Badge tone="neutral">예시 구성</Badge> 이 광고주는 실제 보고서 캡처가 아직 없어 예시 데이터로 채웠습니다.</div>}
      <div className="card"><div className="card-title">통합 보고서</div>{filteredConfig.rowGroups.length===0?<EmptyState title="표시할 지표를 선택해주세요." description="상단의 지표 선택에서 최소 1개 이상 켜주세요."/>:<BrandReportGrid config={filteredConfig} data={report.data} dates={dates} period={period}/>}</div>
    </div>
  );
}
