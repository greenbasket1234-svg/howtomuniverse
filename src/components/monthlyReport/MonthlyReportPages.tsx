import type { CSSProperties } from 'react';
import { TrendComboChart } from '../charts/TrendComboChart';
import { buildDailyTrendData } from '../../utils/chartDataTransform';
import { getMonthDays, type ReportRow } from '../../features/reports/reportCore';
import { changeRate, changePoint, monthLabel, type MonthlyReportData, type MonthlyKpiTotals } from '../../utils/monthlyReportData';
import type { ReportBrandSettings } from '../../utils/reportBrandSettings';

const NAVY = '#111a2f';
const ACCENT = '#27b4f2';
const PAGE_STYLE: CSSProperties = {
  width: 1122,
  minHeight: 794,
  background: '#f3f6fb',
  padding: '86px 48px 42px',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: '#111827',
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12)',
};
const PANEL_STYLE: CSSProperties = { background: '#fff', border: '1px solid #dfe6ef', borderRadius: 10, boxShadow: '0 3px 10px rgba(15, 23, 42, 0.05)' };

function PageBand({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 58, padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: NAVY, color: '#fff', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 4, height: 24, borderRadius: 4, background: ACCENT }} />
        <strong style={{ fontSize: 20, letterSpacing: '-0.02em' }}>{title}</strong>
      </div>
      {subtitle && <span style={{ fontSize: 11.5, color: '#cbd5e1' }}>{subtitle}</span>}
    </div>
  );
}



function closingDateLabel(date = new Date()) {
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}

function money(v: number) { return `₩${Math.round(v).toLocaleString()}`; }
function pct(v: number) { return `${v.toFixed(1)}%`; }
function chunkList<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}
// 전월 대비 "얼마나 늘었는지·줄었는지"를 절대값(금액·건수)으로 보여줍니다. 퍼센트만으로는
// "12% 증가"가 실제로 얼마인지 감이 잘 안 오므로, 화면에 항상 절대 증감도 함께 표시합니다.
function fmtDiff(data: MonthlyReportData, current: number, previous: number, format: 'currency' | 'count'): string | null {
  if (data.currentOrigin === 'demo' || data.previousOrigin === 'demo' || data.periodMismatchWarning) return null;
  const diff = current - previous;
  if (!Number.isFinite(diff) || diff === 0) return null;
  const sign = diff > 0 ? '+' : '−';
  const abs = Math.abs(diff);
  return format === 'currency' ? `${sign}${money(abs)}` : `${sign}${Math.round(abs).toLocaleString()}건`;
}

function customMetricValueLabel(cm: MonthlyReportData['customMetrics'][number], value = cm.current) {
  return cm.unit === '%' ? `${value.toFixed(1)}%` : cm.unit === '원' ? money(value) : `${Math.round(value * 100) / 100}${cm.unit}`;
}

// 전월 데이터가 데모(실제 저장분 없음)이면, 증감 계산 자체를 하지 않고 "비교 불가"로 표시합니다.
// 실제 데이터와 데모 데이터를 섞어서 "전월 대비 20% 개선" 같은 거짓 결론을 보여주지 않기 위함입니다.
function safeChangeRate(data: MonthlyReportData, current: number, previous: number) {
  if (data.currentOrigin === 'demo' || data.previousOrigin === 'demo') return { value: null as number | null, label: '비교 불가' };
  if (data.periodMismatchWarning) return { value: null as number | null, label: '기간 불일치' };
  return changeRate(current, previous);
}
function safeChangePoint(data: MonthlyReportData, current: number, previous: number) {
  if (data.currentOrigin === 'demo' || data.previousOrigin === 'demo') return { value: null as number | null, label: '비교 불가' };
  if (data.periodMismatchWarning) return { value: null as number | null, label: '기간 불일치' };
  return changePoint(current, previous);
}

function fmtPercentRelativeDiff(data: MonthlyReportData, current: number, previous: number): string | null {
  if (data.currentOrigin === 'demo' || data.previousOrigin === 'demo' || data.periodMismatchWarning) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0 || current === previous) return null;
  const rate = ((current - previous) / Math.abs(previous)) * 100;
  return `전월 대비 ${rate > 0 ? '+' : '−'}${Math.abs(rate).toFixed(1)}%`;
}

function ChangeBadge({ change, goodWhenUp = true, neutral = false, diff }: { change: { value: number | null; label: string }; goodWhenUp?: boolean; neutral?: boolean; diff?: string | null }) {
  const v = change.value;
  // 색상은 "좋다·나쁘다" 판정이 아니라 증가·감소 자체를 그대로 보여줍니다: 증가는 파란색,
  // 감소는 빨간색입니다(예산이 늘어난 것을 무조건 초록으로, 준 것을 무조건 빨강으로 표시하면
  // "감액"처럼 의도된 감소까지 나쁜 것처럼 보이므로, 판정 색이 아니라 방향 색으로 통일합니다).
  let color = '#94a3b8';
  if (!neutral && v !== null && v !== 0) color = v > 0 ? '#2563eb' : '#dc2626';
  if (!neutral && v === null) color = '#2563eb';
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ color, fontSize: 12, fontWeight: 700 }}>{change.label}</span>
      {diff && <span style={{ color, fontSize: 10.5, fontWeight: 600 }}>{diff}</span>}
    </span>
  );
}

// 이 월간 보고서가 실제 저장된 데이터가 아니라 데모 원본으로 채워졌을 때 상단에 보여줄 경고입니다.
export function DemoDataBanner({ data }: { data: MonthlyReportData }) {
  const currentDemo = data.currentOrigin === 'demo';
  const previousDemo = data.previousOrigin === 'demo';
  if (!currentDemo && !previousDemo) return null;
  const message = currentDemo && previousDemo
    ? `${data.advertiserName}의 ${monthLabel(data.month)}·${monthLabel(data.compareMonth)} 모두 저장된 실제 데이터가 없어 데모 데이터로 채워졌습니다.`
    : currentDemo
    ? `${data.advertiserName}의 ${monthLabel(data.month)}에 저장된 실제 데이터가 없어 데모 데이터로 채워졌습니다.`
    : `${data.advertiserName}의 비교 대상인 ${monthLabel(data.compareMonth)}에 저장된 실제 데이터가 없습니다. 전월 데이터가 없어 이 보고서의 모든 전월 대비 증감 분석은 제외했습니다("비교 불가"로 표시됩니다).`;
  return (
    <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', color: '#92400e', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 16 }}>
      ⚠ {message} "보고서 조회"에서 데이터를 입력·저장한 뒤 다시 만들어 주세요.
    </div>
  );
}

// 지금 쓰고 있는 월간 저장분보다, 그 이후에 저장된 일별·주별 데이터가 더 있을 때 안내합니다.
// (예: 7월 월간 보고서를 저장한 뒤 일별 데이터를 계속 입력·저장한 경우) 그대로 두면 오래된 숫자로
// 보고서를 만들 수 있으므로, 다시 "데이터 불러오기"로 새로 만들 것을 권합니다.
export function NewerDataBanner({ data }: { data: MonthlyReportData }) {
  if (!data.usedInsteadOfMonthly) return null;
  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 16 }}>
      ℹ 저장된 월간 보고서({new Date(data.usedInsteadOfMonthly).toLocaleDateString('ko-KR')})보다 더 최근에 저장된 일별·주별 데이터가 있어, 이 보고서는 그 최신 데이터를 사용했습니다.
    </div>
  );
}

// 저장된 원본이 월 전체가 아니라 특정 기간(일별·주별)만 담은 경우, 이 숫자가 "그 달 전체"가
// 아니라 "일부 기간"만 반영한 부분 집계라는 점을 명확히 알립니다.
export function PartialDataBanner({ data }: { data: MonthlyReportData }) {
  if (!data.sourcePeriodType || data.sourcePeriodType === 'monthly') return null;
  return (
    <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#5b21b6', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 16 }}>
      ◐ 이 보고서는 {monthLabel(data.month)} 전체가 아니라 저장된 {data.sourcePeriodLabel ?? '일부 기간'} 데이터를 기준으로 집계됐습니다. 월 전체 실적과 다를 수 있습니다.
    </div>
  );
}

// 이번 달과 전월의 저장 기간 유형·날짜 수가 서로 다를 때 안내합니다(예: 이번 달은 7일치 주간
// 보고서, 전월은 한 달 전체 — 이 상태로는 전월 대비 증감이 왜곡될 수 있습니다).
export function PeriodMismatchBanner({ data }: { data: MonthlyReportData }) {
  if (!data.periodMismatchWarning) return null;
  return (
    <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 16 }}>
      ⚠ {data.periodMismatchWarning}
    </div>
  );
}

// 이 데이터가 실제 운영 데이터가 아니라 테스트용 샘플 데이터일 때, 화면과 PDF 모든 페이지에
// 명확히 표시합니다(실수로 광고주에게 샘플이 섞인 PDF를 전달하는 것을 막기 위함).
export function SampleDataBanner({ data }: { data: MonthlyReportData }) {
  if (!data.isSample) return null;
  return (
    <div style={{ background: '#111827', color: '#fbbf24', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 16, fontWeight: 700, textAlign: 'center' }}>
      🧪 테스트 샘플 데이터입니다 — 실제 운영 데이터가 아닙니다. 광고주에게 전달하지 마세요.
    </div>
  );
}

type KpiCard = { label: string; value: string; change: { value: number | null; label: string }; goodWhenUp?: boolean; diff?: string | null };

// 사용자 지정형은 정해진 지표 세트가 없으므로, 광고주가 실제로 보고서에서 선택한 지표
// (profileMetrics)만 순서대로 카드로 만듭니다. 선택 안 한 지표는 애초에 만들지 않습니다.
function buildCustomCards(data: MonthlyReportData): KpiCard[] {
  const { current, previous } = data;
  const builders: Partial<Record<string, () => KpiCard>> = {
    spend: () => ({ label: '광고비', value: money(current.spend), change: safeChangeRate(data, current.spend, previous.spend), diff: fmtDiff(data, current.spend, previous.spend, 'currency') }),
    impressions: () => ({ label: '노출수', value: current.impressions.toLocaleString(), change: safeChangeRate(data, current.impressions, previous.impressions), diff: fmtDiff(data, current.impressions, previous.impressions, 'count') }),
    reach: () => ({ label: '도달', value: current.reach.toLocaleString(), change: safeChangeRate(data, current.reach, previous.reach), diff: fmtDiff(data, current.reach, previous.reach, 'count') }),
    frequency: () => ({ label: '빈도', value: current.frequency.toFixed(1), change: safeChangeRate(data, current.frequency, previous.frequency) }),
    clicks: () => ({ label: '클릭수', value: current.clicks.toLocaleString(), change: safeChangeRate(data, current.clicks, previous.clicks), diff: fmtDiff(data, current.clicks, previous.clicks, 'count') }),
    ctr: () => ({ label: 'CTR', value: pct(current.ctr), change: safeChangePoint(data, current.ctr, previous.ctr), diff: fmtPercentRelativeDiff(data, current.ctr, previous.ctr) }),
    cpc: () => ({ label: 'CPC', value: money(current.cpc), change: safeChangeRate(data, current.cpc, previous.cpc), diff: fmtDiff(data, current.cpc, previous.cpc, 'currency'), goodWhenUp: false }),
    leads: () => ({ label: 'DB', value: `${current.leads.toLocaleString()}건`, change: safeChangeRate(data, current.leads, previous.leads), diff: fmtDiff(data, current.leads, previous.leads, 'count') }),
    purchases: () => ({ label: '구매 전환', value: `${current.purchases.toLocaleString()}건`, change: safeChangeRate(data, current.purchases, previous.purchases), diff: fmtDiff(data, current.purchases, previous.purchases, 'count') }),
    conversionRate: () => ({ label: 'CVR', value: pct(current.cvr), change: safeChangePoint(data, current.cvr, previous.cvr), diff: fmtPercentRelativeDiff(data, current.cvr, previous.cvr) }),
    cpa: () => ({ label: 'CPA', value: money(current.cpa), change: safeChangeRate(data, current.cpa, previous.cpa), diff: fmtDiff(data, current.cpa, previous.cpa, 'currency'), goodWhenUp: false }),
    revenue: () => ({ label: '매출', value: money(current.revenue), change: safeChangeRate(data, current.revenue, previous.revenue), diff: fmtDiff(data, current.revenue, previous.revenue, 'currency') }),
    roas: () => ({ label: 'ROAS', value: pct(current.roas), change: safeChangePoint(data, current.roas, previous.roas), diff: fmtPercentRelativeDiff(data, current.roas, previous.roas) }),
    payments: () => ({ label: '결제', value: money(current.payments), change: safeChangeRate(data, current.payments, previous.payments), diff: fmtDiff(data, current.payments, previous.payments, 'currency') }),
    refunds: () => ({ label: '환불', value: money(current.refunds), change: safeChangeRate(data, current.refunds, previous.refunds), diff: fmtDiff(data, current.refunds, previous.refunds, 'currency'), goodWhenUp: false }),
    netRevenue: () => ({ label: '순매출', value: money(current.netRevenue), change: safeChangeRate(data, current.netRevenue, previous.netRevenue), diff: fmtDiff(data, current.netRevenue, previous.netRevenue, 'currency') }),
  };
  const cards = data.profileMetrics.map(m => builders[m]?.()).filter((c): c is KpiCard => !!c);
  return cards.length > 0 ? cards : [builders.spend!()];
}

// 보고서 유형(DB전환/매출/클릭/노출)에 따라 의미 있는 KPI만 골라 돌려줍니다.
// 예를 들어 매출형 광고주에게는 DB·CVR·CPA를 보여주지 않습니다(항상 0이라 의미가 없음).
function getKpiCards(data: MonthlyReportData): KpiCard[] {
  const { reportType, current, previous } = data;
  const cardsByType: Record<string, KpiCard[]> = {
    lead: [
      { label: '광고비', value: money(current.spend), change: safeChangeRate(data, current.spend, previous.spend), diff: fmtDiff(data, current.spend, previous.spend, 'currency') },
      { label: '노출수', value: current.impressions.toLocaleString(), change: safeChangeRate(data, current.impressions, previous.impressions), diff: fmtDiff(data, current.impressions, previous.impressions, 'count') },
      { label: '클릭수', value: current.clicks.toLocaleString(), change: safeChangeRate(data, current.clicks, previous.clicks), diff: fmtDiff(data, current.clicks, previous.clicks, 'count') },
      { label: 'DB', value: `${current.leads.toLocaleString()}건`, change: safeChangeRate(data, current.leads, previous.leads), diff: fmtDiff(data, current.leads, previous.leads, 'count') },
      { label: 'CTR', value: pct(current.ctr), change: safeChangePoint(data, current.ctr, previous.ctr), diff: fmtPercentRelativeDiff(data, current.ctr, previous.ctr) },
      { label: 'CPC', value: money(current.cpc), change: safeChangeRate(data, current.cpc, previous.cpc), diff: fmtDiff(data, current.cpc, previous.cpc, 'currency'), goodWhenUp: false },
      { label: 'CVR', value: pct(current.cvr), change: safeChangePoint(data, current.cvr, previous.cvr), diff: fmtPercentRelativeDiff(data, current.cvr, previous.cvr) },
      { label: 'CPA', value: money(current.cpa), change: safeChangeRate(data, current.cpa, previous.cpa), diff: fmtDiff(data, current.cpa, previous.cpa, 'currency'), goodWhenUp: false },
    ],
    revenue: [
      { label: '광고비', value: money(current.spend), change: safeChangeRate(data, current.spend, previous.spend), diff: fmtDiff(data, current.spend, previous.spend, 'currency') },
      data.profileMetrics.includes('purchases') && { label: '구매 전환', value: `${current.purchases.toLocaleString()}건`, change: safeChangeRate(data, current.purchases, previous.purchases), diff: fmtDiff(data, current.purchases, previous.purchases, 'count') },
      data.profileMetrics.includes('payments') && { label: '결제', value: money(current.payments), change: safeChangeRate(data, current.payments, previous.payments), diff: fmtDiff(data, current.payments, previous.payments, 'currency') },
      data.profileMetrics.includes('refunds') && { label: '환불', value: money(current.refunds), change: safeChangeRate(data, current.refunds, previous.refunds), diff: fmtDiff(data, current.refunds, previous.refunds, 'currency'), goodWhenUp: false },
      data.profileMetrics.includes('payments') && data.profileMetrics.includes('refunds') && { label: '순매출', value: money(current.netRevenue), change: safeChangeRate(data, current.netRevenue, previous.netRevenue), diff: fmtDiff(data, current.netRevenue, previous.netRevenue, 'currency') },
      { label: '매출', value: money(current.revenue), change: safeChangeRate(data, current.revenue, previous.revenue), diff: fmtDiff(data, current.revenue, previous.revenue, 'currency') },
      { label: 'ROAS', value: pct(current.roas), change: safeChangePoint(data, current.roas, previous.roas), diff: fmtPercentRelativeDiff(data, current.roas, previous.roas) },
    ].filter(Boolean) as KpiCard[],
    click: [
      { label: '광고비', value: money(current.spend), change: safeChangeRate(data, current.spend, previous.spend), diff: fmtDiff(data, current.spend, previous.spend, 'currency') },
      { label: '노출수', value: current.impressions.toLocaleString(), change: safeChangeRate(data, current.impressions, previous.impressions), diff: fmtDiff(data, current.impressions, previous.impressions, 'count') },
      { label: '클릭수', value: current.clicks.toLocaleString(), change: safeChangeRate(data, current.clicks, previous.clicks), diff: fmtDiff(data, current.clicks, previous.clicks, 'count') },
      { label: 'CTR', value: pct(current.ctr), change: safeChangePoint(data, current.ctr, previous.ctr), diff: fmtPercentRelativeDiff(data, current.ctr, previous.ctr) },
      { label: 'CPC', value: money(current.cpc), change: safeChangeRate(data, current.cpc, previous.cpc), diff: fmtDiff(data, current.cpc, previous.cpc, 'currency'), goodWhenUp: false },
    ],
    reach: [
      { label: '광고비', value: money(current.spend), change: safeChangeRate(data, current.spend, previous.spend), diff: fmtDiff(data, current.spend, previous.spend, 'currency') },
      { label: '노출수', value: current.impressions.toLocaleString(), change: safeChangeRate(data, current.impressions, previous.impressions), diff: fmtDiff(data, current.impressions, previous.impressions, 'count') },
      { label: '도달', value: current.reach.toLocaleString(), change: safeChangeRate(data, current.reach, previous.reach), diff: fmtDiff(data, current.reach, previous.reach, 'count') },
      { label: '빈도', value: current.frequency.toFixed(1), change: safeChangeRate(data, current.frequency, previous.frequency) },
      { label: 'CPM', value: money(current.cpm), change: safeChangeRate(data, current.cpm, previous.cpm), diff: fmtDiff(data, current.cpm, previous.cpm, 'currency'), goodWhenUp: false },
    ],
    integrated: [
      { label: '광고비', value: money(current.spend), change: safeChangeRate(data, current.spend, previous.spend), diff: fmtDiff(data, current.spend, previous.spend, 'currency') },
      { label: 'DB', value: `${current.leads.toLocaleString()}건`, change: safeChangeRate(data, current.leads, previous.leads), diff: fmtDiff(data, current.leads, previous.leads, 'count') },
      { label: '매출', value: money(current.revenue), change: safeChangeRate(data, current.revenue, previous.revenue), diff: fmtDiff(data, current.revenue, previous.revenue, 'currency') },
      { label: 'ROAS', value: pct(current.roas), change: safeChangePoint(data, current.roas, previous.roas), diff: fmtPercentRelativeDiff(data, current.roas, previous.roas) },
      { label: '노출수', value: current.impressions.toLocaleString(), change: safeChangeRate(data, current.impressions, previous.impressions), diff: fmtDiff(data, current.impressions, previous.impressions, 'count') },
      { label: '클릭수', value: current.clicks.toLocaleString(), change: safeChangeRate(data, current.clicks, previous.clicks), diff: fmtDiff(data, current.clicks, previous.clicks, 'count') },
      { label: '도달', value: current.reach.toLocaleString(), change: safeChangeRate(data, current.reach, previous.reach), diff: fmtDiff(data, current.reach, previous.reach, 'count') },
      { label: '빈도', value: current.frequency.toFixed(1), change: safeChangeRate(data, current.frequency, previous.frequency) },
    ],
    custom: buildCustomCards(data),
  };
  return cardsByType[reportType] ?? cardsByType.lead;
}

// 보고서 맨 마지막에 붙는 브랜드 클로징 페이지입니다. 표지와 마찬가지로 "하우투엠 HOWTOM"이
// 큰 글씨로 들어가서, 문서 어디를 펼쳐도 발신처가 분명하게 보이도록 합니다.
export function BrandClosingPage({ accent = '#2563eb' }: { accent?: string }) {
  return (
    <div className="monthly-report-page" style={{ ...PAGE_STYLE, background: NAVY, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 7, background: accent }} />
      <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '0.02em' }}>하우투엠</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent, letterSpacing: '0.12em', marginTop: 6 }}>HOWTOM</div>
      <div style={{ fontSize: 64, fontWeight: 900, color: '#ffffff', marginTop: 28, letterSpacing: '-0.02em' }}>감사합니다.</div>
      <div style={{ fontSize: 16, color: '#a9b8cf', marginTop: 16 }}>{closingDateLabel()}</div>
    </div>
  );
}

export function CoverPage({ data, brand }: { data: MonthlyReportData; brand: ReportBrandSettings }) {
  const accent = brand.brandColor || '#2563eb';
  const cards = getKpiCards(data).slice(0, 4);
  return (
    <div id="mr-cover" className="monthly-report-page" style={{ ...PAGE_STYLE, background: NAVY, color: '#fff', padding: '58px 64px' }}>
      <div style={{ position: 'absolute', width: 250, height: 250, borderRadius: '50%', background: 'rgba(255,255,255,0.035)', top: -120, left: -90 }} />
      <div style={{ position: 'absolute', width: 330, height: 330, borderRadius: '50%', background: 'rgba(39,180,242,0.045)', bottom: -210, right: -110 }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 7, background: accent }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        {brand.logoUrl && <img src={brand.logoUrl} alt="" style={{ height: 32, objectFit: 'contain' }} />}
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '0.02em', lineHeight: 1 }}>하우투엠 <span style={{ color: accent }}>HOWTOM</span></div>
          <div style={{ fontSize: 12, color: '#9fb0ca', letterSpacing: '0.08em', marginTop: 3 }}>MONTHLY MARKETING REPORT{brand.companyName ? ` · ${brand.companyName}` : ''}</div>
        </div>
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 8px', color: '#fff', letterSpacing: '-0.03em' }}>{data.advertiserName} {monthLabel(data.month)} 마케팅 보고서</h1>
      <p style={{ fontSize: 14, color: '#b7c4d8', margin: '0 0 8px' }}>보고 기간: {data.periodLabel} · 비교 기간: {monthLabel(data.compareMonth)}{brand.managerName ? ` · 담당자: ${brand.managerName}` : ''}</p>
      {brand.coverMessage && <p style={{ fontSize: 13, color: accent, fontWeight: 600, margin: '0 0 16px' }}>{brand.coverMessage}</p>}
      <DemoDataBanner data={data} />
      <NewerDataBanner data={data} />
      <PartialDataBanner data={data} />
      <PeriodMismatchBanner data={data} />
      <SampleDataBanner data={data} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 40 }}>
        {cards.map(card => (
          <div key={card.label} style={{ background: '#17223c', border: '1px solid #263451', borderTop: `3px solid ${accent}`, borderRadius: 10, padding: '18px 16px', boxShadow: '0 8px 18px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 12, color: '#9fb0ca', marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: '#fff' }}>{card.value}</div>
            <ChangeBadge change={card.change} goodWhenUp={card.goodWhenUp ?? true} diff={card.diff} />
          </div>
        ))}
      </div>
      <div data-monthly-cover-date style={{ position: 'absolute', bottom: 38, left: 64, fontSize: 11, color: '#7788a3' }}>HOWTOM 유니버스 · {closingDateLabel()} · 데이터 출처: {data.currentOrigin === 'saved-monthly' ? '저장된 월간 보고서' : data.currentOrigin === 'saved-other' ? '저장된 일별·주별 보고서' : '데모 데이터'}{data.sourceCreatedAt ? ` (${new Date(data.sourceCreatedAt).toLocaleDateString('ko-KR')} 저장분)` : ''}</div>
    </div>
  );
}

// 보고서 유형(DB전환/매출/클릭/노출)에 따라 이 페이지에서 보여줄 KPI 카드 구성이 다릅니다.
export function KPIDashboardPage({ data }: { data: MonthlyReportData }) {
  const cards = getKpiCards(data);
  const customMetricChunks = chunkList(data.customMetrics, 12);
  return (
    <>
      <div className="monthly-report-page" style={PAGE_STYLE}>
        <PageBand title={`${monthLabel(data.month)} 전체 핵심 KPI 대시보드`} subtitle={`${data.advertiserName} · 전월(${monthLabel(data.compareMonth)}) 대비`} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {cards.map(card => (
            <div key={card.label} style={{ ...PANEL_STYLE, padding: '16px 14px', borderLeft: `3px solid ${data.currentOrigin === 'demo' ? '#cbd5e1' : ACCENT}` }}>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 6 }}>{card.label}</div>
              {data.currentOrigin === 'demo' ? (
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: '#94a3b8' }}>실제 데이터 없음</div>
              ) : (
                <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>{card.value}</div>
              )}
              <ChangeBadge change={card.change} goodWhenUp={card.goodWhenUp ?? true} diff={card.diff} />
            </div>
          ))}
        </div>
        {data.customMetrics.length > 0 && (
          <div style={{ ...PANEL_STYLE, padding: '18px 20px', marginTop: 24 }}>
            <strong style={{ color: NAVY, fontSize: 14 }}>커스텀 지표 {data.customMetrics.length}개는 별도 페이지로 자동 분할됩니다.</strong>
            <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7, margin: '8px 0 0' }}>
              커스텀 지표가 많아도 PDF에서 카드가 잘리지 않도록 12개 단위로 다음 페이지에 나누어 배치합니다. 매체별 계산이 가능한 커스텀 지표는 다음달 제안서의 매체별 증액·감액 판단에도 함께 반영됩니다.
            </p>
          </div>
        )}
      </div>
      {customMetricChunks.map((chunk, pageIndex) => (
        <div className="monthly-report-page" style={PAGE_STYLE} key={`custom-metric-page-${pageIndex}`}>
          <PageBand
            title={`${monthLabel(data.month)} 커스텀 지표 대시보드${customMetricChunks.length > 1 ? ` (${pageIndex + 1}/${customMetricChunks.length})` : ''}`}
            subtitle="환경설정 등록 수식 기준 · 전월 대비"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {chunk.map(cm => {
              const change = cm.unit === '%' ? safeChangePoint(data, cm.current, cm.previous) : safeChangeRate(data, cm.current, cm.previous);
              const diff = cm.unit === '%' ? fmtPercentRelativeDiff(data, cm.current, cm.previous) : fmtDiff(data, cm.current, cm.previous, cm.unit === '원' ? 'currency' : 'count');
              return (
                <div key={cm.id} style={{ ...PANEL_STYLE, padding: '16px 14px', borderLeft: `3px solid ${ACCENT}` }}>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 6 }}>{cm.name}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>{customMetricValueLabel(cm)}</div>
                  <ChangeBadge change={change} goodWhenUp={cm.direction !== 'down'} neutral={cm.direction === 'neutral'} diff={diff} />
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: '18px 0 0' }}>커스텀 지표는 전체 합계 기준이며, 수식에 필요한 매체별 원본 지표가 있는 경우 다음달 제안서에서 매체별 판단 기준으로도 사용됩니다.</p>
        </div>
      ))}
    </>
  );
}

type MediaCol = { label: string; align?: 'left'; render: (m: MonthlyReportData['mediaTable'][number]) => string; highlight?: (m: MonthlyReportData['mediaTable'][number]) => boolean };

// 사용자 지정형(custom)은 정해진 지표 세트가 없으므로, 각 지표를 매체 성과표·비교차트·전월비교
// 어디서든 똑같이 다룰 수 있도록 라벨·단위·매체표 필드를 한 곳에 정의해 재사용합니다.
const CUSTOM_METRIC_DEFS: Partial<Record<string, { label: string; field: keyof MonthlyReportData['mediaTable'][number]; totalField: keyof MonthlyKpiTotals; format: 'money' | 'pct' | 'number' }>> = {
  spend: { label: '광고비', field: 'spend', totalField: 'spend', format: 'money' },
  impressions: { label: '노출수', field: 'impressions', totalField: 'impressions', format: 'number' },
  reach: { label: '도달', field: 'reach', totalField: 'reach', format: 'number' },
  frequency: { label: '빈도', field: 'frequency', totalField: 'frequency', format: 'number' },
  clicks: { label: '클릭수', field: 'clicks', totalField: 'clicks', format: 'number' },
  ctr: { label: 'CTR', field: 'ctr', totalField: 'ctr', format: 'pct' },
  cpc: { label: 'CPC', field: 'cpc', totalField: 'cpc', format: 'money' },
  leads: { label: 'DB', field: 'leads', totalField: 'leads', format: 'number' },
  purchases: { label: '구매 전환', field: 'purchases', totalField: 'purchases', format: 'number' },
  conversionRate: { label: 'CVR', field: 'cvr', totalField: 'cvr', format: 'pct' },
  cpa: { label: 'CPA', field: 'cpa', totalField: 'cpa', format: 'money' },
  revenue: { label: '매출', field: 'revenue', totalField: 'revenue', format: 'money' },
  roas: { label: 'ROAS', field: 'roas', totalField: 'roas', format: 'pct' },
  payments: { label: '결제', field: 'payments', totalField: 'payments', format: 'money' },
  refunds: { label: '환불', field: 'refunds', totalField: 'refunds', format: 'money' },
  netRevenue: { label: '순매출', field: 'netRevenue', totalField: 'netRevenue', format: 'money' },
};
function formatByType(v: number, fmt: 'money' | 'pct' | 'number') {
  return fmt === 'money' ? money(v) : fmt === 'pct' ? pct(v) : v.toLocaleString();
}
// profileMetrics 순서대로, 정의가 있는 지표만 골라 매체 성과표 컬럼 목록을 만듭니다.
function buildCustomMediaCols(profileMetrics: MonthlyReportData['profileMetrics']): MediaCol[] {
  return profileMetrics
    .map(m => CUSTOM_METRIC_DEFS[m])
    .filter((d): d is NonNullable<typeof d> => !!d)
    .map(d => ({ label: d.label, render: (row: MonthlyReportData['mediaTable'][number]) => formatByType(row[d.field] as number, d.format) }));
}

export function MediaPerformancePage({ data }: { data: MonthlyReportData }) {
  const cpaValues = data.mediaTable.map(m => m.cpa).filter(v => v > 0);
  const bestCpa = cpaValues.length ? Math.min(...cpaValues) : null;
  const worstCpa = cpaValues.length ? Math.max(...cpaValues) : null;
  const cpaColor = (v: number) => v > 0 && v === bestCpa ? '#16a34a' : v > 0 && v === worstCpa ? '#dc2626' : '#111827';

  const nameCol: MediaCol = { label: '매체', align: 'left', render: m => m.platform };
  const colsByType: Record<string, MediaCol[]> = {
    lead: [
      { label: '노출수', render: m => m.impressions.toLocaleString() },
      { label: '클릭수', render: m => m.clicks.toLocaleString() },
      { label: 'CTR', render: m => pct(m.ctr) },
      { label: 'CPC', render: m => money(m.cpc) },
      { label: '광고비', render: m => money(m.spend) },
      { label: 'DB', render: m => m.leads.toLocaleString() },
      { label: 'CVR', render: m => pct(m.cvr) },
      { label: 'CPA', render: m => m.cpa > 0 ? money(m.cpa) : '－' },
    ],
    revenue: [
      { label: '광고비', render: m => money(m.spend) },
      ...(data.profileMetrics.includes('purchases') ? [{ label: '구매 전환', render: (m: MonthlyReportData['mediaTable'][number]) => m.purchases.toLocaleString() }] : []),
      ...(data.profileMetrics.includes('payments') ? [{ label: '결제', render: (m: MonthlyReportData['mediaTable'][number]) => money(m.payments) }] : []),
      ...(data.profileMetrics.includes('refunds') ? [{ label: '환불', render: (m: MonthlyReportData['mediaTable'][number]) => money(m.refunds) }] : []),
      ...(data.profileMetrics.includes('payments') && data.profileMetrics.includes('refunds') ? [{ label: '순매출', render: (m: MonthlyReportData['mediaTable'][number]) => money(m.netRevenue) }] : []),
      { label: '매출', render: m => money(m.revenue) },
      { label: 'ROAS', render: m => pct(m.roas) },
    ],
    click: [
      { label: '노출수', render: m => m.impressions.toLocaleString() },
      { label: '클릭수', render: m => m.clicks.toLocaleString() },
      { label: 'CTR', render: m => pct(m.ctr) },
      { label: 'CPC', render: m => money(m.cpc) },
      { label: '광고비', render: m => money(m.spend) },
    ],
    reach: [
      { label: '광고비', render: m => money(m.spend) },
      { label: '노출수', render: m => m.impressions.toLocaleString() },
      { label: '도달', render: m => m.reach.toLocaleString() },
      { label: '빈도', render: m => m.frequency.toFixed(1) },
      { label: 'CPM', render: m => money(m.cpm) },
    ],
  };
  const baseDataCols = (data.reportType === 'custom' || data.reportType === 'integrated') ? buildCustomMediaCols(data.profileMetrics) : (colsByType[data.reportType] ?? colsByType.lead);
  const columnGroups: { name: string; cols: MediaCol[] }[] = data.reportType === 'integrated'
    ? [
        { name: '유입·광고비', cols: buildCustomMediaCols(['spend', 'impressions', 'reach', 'frequency', 'clicks', 'ctr', 'cpc'] as MonthlyReportData['profileMetrics']) },
        { name: '전환 성과', cols: buildCustomMediaCols(['leads', 'purchases', 'conversionRate', 'cpa'] as MonthlyReportData['profileMetrics']) },
        { name: '매출 성과', cols: buildCustomMediaCols(['revenue', 'payments', 'refunds', 'netRevenue', 'roas'] as MonthlyReportData['profileMetrics']) },
      ].filter(group => group.cols.length > 0)
    : baseDataCols.length > 7
      ? Array.from({ length: Math.ceil(baseDataCols.length / 7) }, (_, index) => ({ name: `지표 ${index + 1}`, cols: baseDataCols.slice(index * 7, index * 7 + 7) }))
      : [{ name: '', cols: baseDataCols }];

  const rowChunks: typeof data.mediaTable[] = [];
  for (let i = 0; i < data.mediaTable.length; i += 8) rowChunks.push(data.mediaTable.slice(i, i + 8));
  if (rowChunks.length === 0) rowChunks.push([]);
  const totalPages = columnGroups.length * rowChunks.length;

  return (
    <>
      {columnGroups.flatMap((group, gi) => rowChunks.map((chunk, ci) => {
        const pageNo = gi * rowChunks.length + ci + 1;
        const cols = [nameCol, ...group.cols];
        return (
          <div className="monthly-report-page" style={PAGE_STYLE} key={`${gi}-${ci}`}>
            <PageBand
              title={`${monthLabel(data.month)} 매체별 성과 요약${group.name ? ` · ${group.name}` : ''}${totalPages > 1 ? ` (${pageNo}/${totalPages})` : ''}`}
              subtitle={`${data.advertiserName} · 모든 진행 매체 비교`}
            />
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5, ...PANEL_STYLE, overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#eaf2fb', textAlign: 'right' }}>
                  {cols.map(c => <th key={c.label} style={{ textAlign: c.align ?? 'right', padding: '9px 10px', color: NAVY }}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {chunk.map(m => (
                  <tr key={m.platform} style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                    {cols.map(c => (
                      <td key={c.label} style={{ textAlign: c.align ?? 'right', padding: '9px 10px', fontWeight: c.label === 'CPA' ? 700 : undefined, color: c.label === 'CPA' ? cpaColor(m.cpa) : undefined, ...(c.align === 'left' ? { fontWeight: 600 } : {}) }}>{c.render(m)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }))}
    </>
  );
}

export function ChartsPage({ data }: { data: MonthlyReportData }) {
  const allDays = getMonthDays(data.month);
  // 아직 안 지난 미래 날짜는 값이 없어 항상 0으로 찍히므로, 실제로 지난 날짜까지만 차트에 넣습니다.
  const indexes = data.validDayIndexes?.length ? data.validDayIndexes : allDays.map((_, i) => i).slice(0, data.validDayCount);
  const dates = indexes.map(i => `${allDays[i]?.day}일`);
  const isRevenue = data.reportType === 'revenue';
  const isClick = data.reportType === 'click';
  const isReach = data.reportType === 'reach';
  const isIntegrated = data.reportType === 'integrated';
  const isCustom = (data.reportType === 'custom' || isIntegrated);
  // 광고비·매출은 수십만~수백만 원, DB·클릭은 수십~수백 건 단위라 같은 축을 쓰면 작은 지표가 안 보입니다.
  // 규모가 작은 지표는 오른쪽 보조축(yAxisIndex:1)으로 분리합니다.
  const series = isIntegrated ? [
    { metric: 'spend', name: '광고비', color: '#2563eb', type: 'bar' as const, format: 'currency' as const, yAxisIndex: 0 as const },
    { metric: 'revenue', name: '매출', color: '#f59e0b', type: 'line' as const, format: 'currency' as const, yAxisIndex: 0 as const },
    { metric: 'leads', name: 'DB', color: '#16a34a', type: 'line' as const, format: 'number' as const, yAxisIndex: 1 as const },
  ] : isCustom ? (() => {
    const metrics = data.profileMetrics.filter(m => CUSTOM_METRIC_DEFS[m]);
    if (metrics.length === 0) return [];
    const primary = metrics[0];
    const primaryDef = CUSTOM_METRIC_DEFS[primary]!;
    const toFormat = (f: 'money' | 'pct' | 'number') => f === 'money' ? 'currency' as const : f === 'pct' ? 'percent' as const : 'number' as const;
    const result: { metric: string; name: string; color: string; type: 'bar' | 'line'; format: 'currency' | 'percent' | 'number'; yAxisIndex: 0 | 1 }[] = [{ metric: primary, name: primaryDef.label, color: '#2563eb', type: 'bar', format: toFormat(primaryDef.format), yAxisIndex: 0 }];
    // 보조축(오른쪽)에는 첫 지표와 단위가 같은 것들만 함께 두고, 단위가 다르면 딱 1개까지만
    // 추가해서 서로 다른 단위(숫자/원/%)가 뒤섞이지 않게 합니다.
    const rest = metrics.slice(1);
    const sameUnit = rest.filter(m => CUSTOM_METRIC_DEFS[m]!.format === primaryDef.format);
    const otherUnit = rest.find(m => CUSTOM_METRIC_DEFS[m]!.format !== primaryDef.format);
    const secondaryKeys = [...sameUnit, ...(otherUnit ? [otherUnit] : [])].slice(0, 2);
    const colors = ['#16a34a', '#f59e0b'];
    secondaryKeys.forEach((m, i) => {
      const def = CUSTOM_METRIC_DEFS[m]!;
      result.push({ metric: m, name: def.label, color: colors[i % colors.length], type: 'line' as const, format: toFormat(def.format), yAxisIndex: 1 as const });
    });
    return result;
  })() : isRevenue ? [
    { metric: 'spend', name: '광고비', color: '#2563eb', type: 'bar' as const, format: 'currency' as const },
    { metric: 'revenue', name: '매출', color: '#f59e0b', type: 'line' as const, format: 'currency' as const },
    { metric: 'roas', name: 'ROAS', color: '#16a34a', type: 'line' as const, format: 'percent' as const, yAxisIndex: 1 as const },
  ] : isClick ? [
    { metric: 'spend', name: '광고비', color: '#2563eb', type: 'bar' as const, format: 'currency' as const },
    { metric: 'clicks', name: '클릭수', color: '#db2777', type: 'line' as const, format: 'number' as const, yAxisIndex: 1 as const },
  ] : isReach ? [
    { metric: 'spend', name: '광고비', color: '#2563eb', type: 'bar' as const, format: 'currency' as const },
    { metric: 'impressions', name: '노출수', color: '#f59e0b', type: 'line' as const, format: 'number' as const, yAxisIndex: 1 as const },
  ] : [
    { metric: 'spend', name: '광고비', color: '#2563eb', type: 'bar' as const, format: 'currency' as const },
    { metric: 'leads', name: 'DB', color: '#16a34a', type: 'line' as const, format: 'number' as const, yAxisIndex: 1 as const },
  ];
  return (
    <div className="monthly-report-page" style={PAGE_STYLE}>
      <PageBand title={`${monthLabel(data.month)} 일자별 성과 시각화`} subtitle={`${data.advertiserName} · 광고비 대비 핵심 성과 추이`} />
      <TrendComboChart
        title={isIntegrated
          ? '광고비 · 매출 · DB 추이'
          : isCustom
          ? (series.length ? `${series.map(item => item.name).join(' · ')} 추이` : '선택 지표 추이')
          : isRevenue ? '광고비 · 매출 · ROAS 추이'
          : isClick ? '광고비 · 클릭수 추이'
          : isReach ? '광고비 · 노출수 추이'
          : '광고비 · DB 추이'}
        dates={dates}
        height={300}
        series={buildDailyTrendData(data.rows as ReportRow[], indexes, series)}
      />
    </div>
  );
}

export function MonthlyComparisonPage({ data, insights }: { data: MonthlyReportData; insights: string[] }) {
  const { current, previous, reportType } = data;
  const rowsByType: Record<string, { label: string; current: string; previous: string; change: { value: number | null; label: string }; goodWhenUp?: boolean; diff?: string | null }[]> = {
    lead: [
      { label: '광고비', current: money(current.spend), previous: money(previous.spend), change: safeChangeRate(data, current.spend, previous.spend), diff: fmtDiff(data, current.spend, previous.spend, 'currency') },
      { label: '클릭수', current: current.clicks.toLocaleString(), previous: previous.clicks.toLocaleString(), change: safeChangeRate(data, current.clicks, previous.clicks), diff: fmtDiff(data, current.clicks, previous.clicks, 'count') },
      { label: 'DB', current: `${current.leads.toLocaleString()}건`, previous: `${previous.leads.toLocaleString()}건`, change: safeChangeRate(data, current.leads, previous.leads), diff: fmtDiff(data, current.leads, previous.leads, 'count') },
      { label: 'CPA', current: money(current.cpa), previous: money(previous.cpa), change: safeChangeRate(data, current.cpa, previous.cpa), diff: fmtDiff(data, current.cpa, previous.cpa, 'currency'), goodWhenUp: false },
    ],
    revenue: [
      { label: '광고비', current: money(current.spend), previous: money(previous.spend), change: safeChangeRate(data, current.spend, previous.spend), diff: fmtDiff(data, current.spend, previous.spend, 'currency') },
      ...(data.profileMetrics.includes('purchases') ? [{ label: '구매 전환', current: `${current.purchases.toLocaleString()}건`, previous: `${previous.purchases.toLocaleString()}건`, change: safeChangeRate(data, current.purchases, previous.purchases), diff: fmtDiff(data, current.purchases, previous.purchases, 'count') }] : []),
      ...(data.profileMetrics.includes('payments') ? [{ label: '결제', current: money(current.payments), previous: money(previous.payments), change: safeChangeRate(data, current.payments, previous.payments), diff: fmtDiff(data, current.payments, previous.payments, 'currency') }] : []),
      ...(data.profileMetrics.includes('refunds') ? [{ label: '환불', current: money(current.refunds), previous: money(previous.refunds), change: safeChangeRate(data, current.refunds, previous.refunds), diff: fmtDiff(data, current.refunds, previous.refunds, 'currency'), goodWhenUp: false }] : []),
      ...(data.profileMetrics.includes('payments') && data.profileMetrics.includes('refunds') ? [{ label: '순매출', current: money(current.netRevenue), previous: money(previous.netRevenue), change: safeChangeRate(data, current.netRevenue, previous.netRevenue), diff: fmtDiff(data, current.netRevenue, previous.netRevenue, 'currency') }] : []),
      { label: '매출', current: money(current.revenue), previous: money(previous.revenue), change: safeChangeRate(data, current.revenue, previous.revenue), diff: fmtDiff(data, current.revenue, previous.revenue, 'currency') },
      { label: 'ROAS', current: pct(current.roas), previous: pct(previous.roas), change: safeChangePoint(data, current.roas, previous.roas), diff: fmtPercentRelativeDiff(data, current.roas, previous.roas) },
    ],
    click: [
      { label: '광고비', current: money(current.spend), previous: money(previous.spend), change: safeChangeRate(data, current.spend, previous.spend), diff: fmtDiff(data, current.spend, previous.spend, 'currency') },
      { label: '클릭수', current: current.clicks.toLocaleString(), previous: previous.clicks.toLocaleString(), change: safeChangeRate(data, current.clicks, previous.clicks), diff: fmtDiff(data, current.clicks, previous.clicks, 'count') },
      { label: 'CPC', current: money(current.cpc), previous: money(previous.cpc), change: safeChangeRate(data, current.cpc, previous.cpc), diff: fmtDiff(data, current.cpc, previous.cpc, 'currency'), goodWhenUp: false },
    ],
    reach: [
      { label: '광고비', current: money(current.spend), previous: money(previous.spend), change: safeChangeRate(data, current.spend, previous.spend), diff: fmtDiff(data, current.spend, previous.spend, 'currency') },
      { label: '노출수', current: current.impressions.toLocaleString(), previous: previous.impressions.toLocaleString(), change: safeChangeRate(data, current.impressions, previous.impressions), diff: fmtDiff(data, current.impressions, previous.impressions, 'count') },
      { label: '도달', current: current.reach.toLocaleString(), previous: previous.reach.toLocaleString(), change: safeChangeRate(data, current.reach, previous.reach), diff: fmtDiff(data, current.reach, previous.reach, 'count') },
      { label: 'CPM', current: money(current.cpm), previous: money(previous.cpm), change: safeChangeRate(data, current.cpm, previous.cpm), diff: fmtDiff(data, current.cpm, previous.cpm, 'currency'), goodWhenUp: false },
    ],
  };
  const customRows = data.profileMetrics.map(m => {
    const def = CUSTOM_METRIC_DEFS[m];
    if (!def) return null;
    const curV = current[def.totalField] as number; const prevV = previous[def.totalField] as number;
    const diffFormat = def.format === 'money' ? 'currency' as const : def.format === 'number' ? 'count' as const : null;
    return { label: def.label, current: formatByType(curV, def.format), previous: formatByType(prevV, def.format), change: def.format === 'pct' ? safeChangePoint(data, curV, prevV) : safeChangeRate(data, curV, prevV), goodWhenUp: def.field !== 'cpc' && def.field !== 'cpa' && def.field !== 'refunds', diff: def.format === 'pct' ? fmtPercentRelativeDiff(data, curV, prevV) : diffFormat ? fmtDiff(data, curV, prevV, diffFormat) : null };
  }).filter((r): r is NonNullable<typeof r> => !!r);
  const customMetricRows = data.customMetrics.map(cm => ({
    label: `${cm.name} (커스텀)`,
    current: customMetricValueLabel(cm, cm.current),
    previous: customMetricValueLabel(cm, cm.previous),
    change: cm.unit === '%' ? safeChangePoint(data, cm.current, cm.previous) : safeChangeRate(data, cm.current, cm.previous),
    goodWhenUp: cm.direction !== 'down',
    diff: cm.unit === '%' ? fmtPercentRelativeDiff(data, cm.current, cm.previous) : fmtDiff(data, cm.current, cm.previous, cm.unit === '원' ? 'currency' : 'count'),
  }));
  const rows = [...((reportType === 'custom' || reportType === 'integrated') ? customRows : (rowsByType[reportType] ?? rowsByType.lead)), ...customMetricRows];
  const rowChunks = chunkList(rows, data.customMetrics.length > 6 ? 10 : 14);
  return (
    <>
      {rowChunks.map((chunk, pageIndex) => {
        const isLast = pageIndex === rowChunks.length - 1;
        return (
          <div className="monthly-report-page" style={PAGE_STYLE} key={`monthly-comparison-${pageIndex}`}>
            <PageBand title={`${monthLabel(data.compareMonth)} vs ${monthLabel(data.month)} 전체 성과 비교${rowChunks.length > 1 ? ` (${pageIndex + 1}/${rowChunks.length})` : ''}`} subtitle={data.advertiserName} />
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, marginBottom: isLast ? 24 : 0, ...PANEL_STYLE, overflow: 'hidden' }}>
              <thead><tr style={{ background: '#f8fafc', textAlign: 'right' }}><th style={{ textAlign: 'left', padding: '8px 10px' }}>지표</th><th style={{ padding: '8px 10px' }}>이번 달</th><th style={{ padding: '8px 10px' }}>전월</th><th style={{ padding: '8px 10px' }}>증감</th></tr></thead>
              <tbody>
                {chunk.map(r => (
                  <tr key={r.label} style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                    <td style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>{r.label}</td>
                    <td style={{ padding: '8px 10px' }}>{r.current}</td>
                    <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{r.previous}</td>
                    <td style={{ padding: '8px 10px' }}><ChangeBadge change={r.change} goodWhenUp={r.goodWhenUp ?? true} diff={r.diff} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isLast && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>퍼포먼스 마케터 Insight</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {insights.map((line, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #dfe6ef', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, lineHeight: 1.6 }}>{line}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

// 2페이지: 이번 달 하이라이트 + 매체별 역할 요약입니다. 표·차트가 아니라 문장으로 핵심을 짚습니다.
export function HighlightPage({ data }: { data: MonthlyReportData }) {
  const isRevenue = data.reportType === 'revenue';
  const isClick = data.reportType === 'click';
  const isReach = data.reportType === 'reach';
  const isCustom = (data.reportType === 'custom' || data.reportType === 'integrated');
  const RAW_KEYS = new Set(['spend', 'impressions', 'reach', 'clicks', 'leads', 'purchases', 'revenue', 'payments', 'refunds']);
  const efficiencyPriority = ['roas', 'cpa', 'cpc', 'conversionRate', 'ctr'] as const;
  const volumePriority = ['revenue', 'purchases', 'leads', 'clicks', 'reach', 'impressions', 'payments'] as const;
  const customEfficiencyKey = efficiencyPriority.find(key => data.profileMetrics.includes(key) && data.mediaTable.some(row => (row[CUSTOM_METRIC_DEFS[key]!.field] as number) > 0));
  const customVolumeKey = volumePriority.find(key => data.profileMetrics.includes(key)) ?? data.profileMetrics.find(m => RAW_KEYS.has(m) && m !== 'spend') ?? data.profileMetrics.find(m => RAW_KEYS.has(m));
  const bestBy = isCustom
    ? (customEfficiencyKey ? [...data.mediaTable].filter(m => (m[CUSTOM_METRIC_DEFS[customEfficiencyKey]!.field] as number) > 0).sort((a, b) => {
        const lowerIsBetter = customEfficiencyKey === 'cpa' || customEfficiencyKey === 'cpc';
        const av = a[CUSTOM_METRIC_DEFS[customEfficiencyKey]!.field] as number; const bv = b[CUSTOM_METRIC_DEFS[customEfficiencyKey]!.field] as number;
        return lowerIsBetter ? av - bv : bv - av;
      })[0] : undefined)
    : isRevenue
    ? [...data.mediaTable].filter(m => m.roas > 0).sort((a, b) => b.roas - a.roas)[0]
    : isClick
    ? [...data.mediaTable].filter(m => m.cpc > 0).sort((a, b) => a.cpc - b.cpc)[0]
    : [...data.mediaTable].filter(m => m.cpa > 0).sort((a, b) => a.cpa - b.cpa)[0];
  const topSpend = [...data.mediaTable].sort((a, b) => b.spend - a.spend)[0];
  const spendChange = safeChangeRate(data, data.current.spend, data.previous.spend);
  const secondaryChange = isCustom
    ? (customVolumeKey ? safeChangeRate(data, data.current[CUSTOM_METRIC_DEFS[customVolumeKey]!.totalField] as number, data.previous[CUSTOM_METRIC_DEFS[customVolumeKey]!.totalField] as number) : spendChange)
    : isRevenue ? safeChangeRate(data, data.current.revenue, data.previous.revenue)
    : isReach ? safeChangeRate(data, data.current.impressions, data.previous.impressions)
    : safeChangeRate(data, isClick ? data.current.clicks : data.current.leads, isClick ? data.previous.clicks : data.previous.leads);
  const secondaryLabel = isCustom ? (customVolumeKey ? CUSTOM_METRIC_DEFS[customVolumeKey]!.label : '광고비') : isRevenue ? '매출' : isReach ? '노출수' : isClick ? '클릭수' : '전환(DB)';
  const secondaryValue = isCustom
    ? (customVolumeKey ? formatByType(data.current[CUSTOM_METRIC_DEFS[customVolumeKey]!.totalField] as number, CUSTOM_METRIC_DEFS[customVolumeKey]!.format) : money(data.current.spend))
    : isRevenue ? money(data.current.revenue) : isReach ? data.current.impressions.toLocaleString() : isClick ? data.current.clicks.toLocaleString() : `${data.current.leads.toLocaleString()}건`;

  const roleOf = (m: MonthlyReportData['mediaTable'][number]) => {
    const spendShare = data.current.spend > 0 ? (m.spend / data.current.spend) * 100 : 0;
    if (topSpend && m.platform === topSpend.platform) return `최대 예산 채널 (전체의 ${spendShare.toFixed(0)}%)`;
    if (isCustom) return bestBy && m.platform === bestBy.platform ? `최고 효율 채널 (${customEfficiencyKey ? CUSTOM_METRIC_DEFS[customEfficiencyKey]!.label : ''} 기준)` : '보조 채널';
    if (bestBy && m.platform === bestBy.platform) return isRevenue ? '최고 효율 채널 (ROAS 최고)' : isClick ? '최고 효율 채널 (CPC 최저)' : '최고 효율 채널 (CPA 최저)';
    if (!isReach && m.ctr > 0 && m.ctr >= data.current.ctr) return '클릭 반응이 좋은 채널';
    return '보조 채널';
  };

  return (
    <div className="monthly-report-page" style={PAGE_STYLE}>
      <PageBand title={`${monthLabel(data.month)} 마케팅 성과 하이라이트`} subtitle={`${data.advertiserName} · 핵심 성과와 매체별 역할`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
        <div style={{ background: '#fff', border: '1px solid #dfe6ef', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
          이번 달 총 광고비는 {money(data.current.spend)}이며, 전월 대비 {spendChange.label}입니다.
        </div>
        <div style={{ background: '#fff', border: '1px solid #dfe6ef', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
          {secondaryLabel}은 {secondaryValue}로, 전월 대비 {secondaryChange.label}입니다.
        </div>
        {bestBy && (
          <div style={{ background: '#fff', border: '1px solid #dfe6ef', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
            {isCustom && customEfficiencyKey
              ? `${bestBy.platform}가 ${CUSTOM_METRIC_DEFS[customEfficiencyKey]!.label} ${formatByType(bestBy[CUSTOM_METRIC_DEFS[customEfficiencyKey]!.field] as number, CUSTOM_METRIC_DEFS[customEfficiencyKey]!.format)}로 전체 매체 중 가장 효율이 좋았습니다.`
              : isRevenue
              ? `${bestBy.platform}가 ROAS ${pct(bestBy.roas)}로 전체 매체 중 가장 효율이 좋았습니다.`
              : isClick
              ? `${bestBy.platform}가 CPC ${money(bestBy.cpc)}로 전체 매체 중 가장 효율이 좋았습니다.`
              : `${bestBy.platform}가 CPA ${money(bestBy.cpa)}로 전체 매체 중 가장 효율이 좋았습니다.`}
          </div>
        )}
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>매체별 역할</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 26 }}>
        {data.mediaTable.map(m => {
          const share = data.current.spend > 0 ? (m.spend / data.current.spend) * 100 : 0;
          return (
            <div key={m.platform} style={{ background: '#fff', border: '1px solid #dfe6ef', borderRadius: 10, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.04)'  }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{m.platform}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>예산 비중 {share.toFixed(0)}%</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{roleOf(m)}</div>
            </div>
          );
        })}
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>다음 달 확장 방향 제안</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {buildNextMonthSuggestions(data, { isRevenue, isClick, isReach, isCustom, customEfficiencyKey, bestBy, topSpend }).map((line, i) => (
          <div key={i} style={{ background: '#eef8ff', border: '1px solid #bfe5fb', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, lineHeight: 1.6 }}>{line}</div>
        ))}
      </div>
    </div>
  );
}

// 다음 달 예산·운영 방향에 대한 규칙 기반 제안입니다. 최고 효율 채널 확대, 저효율 채널 점검,
// 예산 쏠림 완화 등 실무에서 바로 참고할 수 있는 문장을 만듭니다.
function buildNextMonthSuggestions(
  data: MonthlyReportData,
  ctx: { isRevenue: boolean; isClick: boolean; isReach: boolean; isCustom?: boolean; customEfficiencyKey?: string; bestBy?: MonthlyReportData['mediaTable'][number]; topSpend?: MonthlyReportData['mediaTable'][number] },
): string[] {
  const { mediaTable } = data;
  const suggestions: string[] = [];
  if (ctx.bestBy) {
    suggestions.push(`${ctx.bestBy.platform}은 이번 달 가장 효율이 좋았던 채널입니다. 예산 확대 시 우선순위로 검토해 볼 수 있습니다.`);
  }
  if (ctx.isCustom) {
    if (ctx.customEfficiencyKey) {
      const def = CUSTOM_METRIC_DEFS[ctx.customEfficiencyKey]!;
      const lowerIsBetter = ctx.customEfficiencyKey === 'cpa' || ctx.customEfficiencyKey === 'cpc';
      const worstBy = [...mediaTable].filter(m => (m[def.field] as number) > 0).sort((a, b) => {
        const av = a[def.field] as number; const bv = b[def.field] as number;
        return lowerIsBetter ? bv - av : av - bv;
      })[0];
      if (worstBy && worstBy.platform !== ctx.bestBy?.platform) {
        suggestions.push(`${worstBy.platform}은 ${def.label} 기준으로 상대적으로 효율이 낮았습니다. 소재·타겟팅을 재점검하거나 예산 비중을 줄이는 것을 검토해 볼 수 있습니다.`);
      }
    }
  } else if (!ctx.isReach) {
    const worstBy = ctx.isRevenue
      ? [...mediaTable].filter(m => m.roas > 0).sort((a, b) => a.roas - b.roas)[0]
      : ctx.isClick
      ? [...mediaTable].filter(m => m.cpc > 0).sort((a, b) => b.cpc - a.cpc)[0]
      : [...mediaTable].filter(m => m.cpa > 0).sort((a, b) => b.cpa - a.cpa)[0];
    if (worstBy && worstBy.platform !== ctx.bestBy?.platform) {
      suggestions.push(`${worstBy.platform}은 상대적으로 효율이 낮았습니다. 소재·타겟팅을 재점검하거나 예산 비중을 줄이는 것을 검토해 볼 수 있습니다.`);
    }
  }
  if (ctx.topSpend && data.current.spend > 0) {
    const share = (ctx.topSpend.spend / data.current.spend) * 100;
    if (share >= 60 && mediaTable.length > 1) {
      suggestions.push(`${ctx.topSpend.platform}에 예산의 ${share.toFixed(0)}%가 쏠려 있습니다. 채널 다각화를 검토하면 리스크를 분산할 수 있습니다.`);
    }
  }
  if (suggestions.length === 0) {
    suggestions.push('현재 매체별 예산 배분은 특별한 쏠림 없이 안정적으로 운영되고 있습니다.');
  }
  return suggestions;
}

// 매체별 비교 막대 차트입니다. TrendComboChart를 날짜가 아닌 '매체명'을 X축 카테고리로 재사용합니다.
export function MediaComparisonPage({ data }: { data: MonthlyReportData }) {
  const platforms = data.mediaTable.map(m => m.platform);
  const isRevenue = data.reportType === 'revenue';
  const isClick = data.reportType === 'click';
  const isReach = data.reportType === 'reach';
  const isCustom = (data.reportType === 'custom' || data.reportType === 'integrated');
  const CHART_COLORS = ['#2563eb', '#f59e0b', '#16a34a', '#db2777', '#8b5cf6', '#0891b2'];
  const RAW_KEYS = new Set(['spend', 'impressions', 'reach', 'clicks', 'leads', 'purchases', 'revenue', 'payments', 'refunds']);

  if (data.reportType === 'integrated') {
    const settlementSeries = [
      { key: 'payments', name: '결제', values: data.mediaTable.map(m => m.payments), color: '#16a34a' },
      { key: 'refunds', name: '환불', values: data.mediaTable.map(m => m.refunds), color: '#db2777' },
      { key: 'netRevenue', name: '순매출', values: data.mediaTable.map(m => m.netRevenue), color: '#8b5cf6' },
    ].filter(item => data.profileMetrics.includes(item.key as MonthlyReportData['profileMetrics'][number]) && item.values.some(value => value !== 0));
    const pages = [
      {
        title: '매체별 광고비 비교',
        desc: '광고비',
        series: [{ name: '광고비', data: data.mediaTable.map(m => m.spend), color: '#2563eb', type: 'bar' as const, format: 'currency' as const }],
      },
      {
        title: '매체별 노출·도달 비교',
        desc: '노출수·도달',
        series: [
          { name: '노출수', data: data.mediaTable.map(m => m.impressions), color: '#2563eb', type: 'bar' as const, format: 'number' as const },
          { name: '도달', data: data.mediaTable.map(m => m.reach), color: '#0891b2', type: 'bar' as const, format: 'number' as const },
        ],
      },
      {
        title: '매체별 클릭·DB 비교',
        desc: '클릭수·DB',
        series: [
          { name: '클릭수', data: data.mediaTable.map(m => m.clicks), color: '#f59e0b', type: 'bar' as const, format: 'number' as const },
          { name: 'DB', data: data.mediaTable.map(m => m.leads), color: '#16a34a', type: 'bar' as const, format: 'number' as const },
        ],
      },
      {
        title: '매체별 CTR·CVR 비교',
        desc: 'CTR·CVR',
        series: [
          { name: 'CTR', data: data.mediaTable.map(m => m.ctr), color: '#2563eb', type: 'bar' as const, format: 'percent' as const },
          { name: 'CVR', data: data.mediaTable.map(m => m.cvr), color: '#16a34a', type: 'bar' as const, format: 'percent' as const },
        ],
      },
      {
        title: '매체별 매출·ROAS 비교',
        desc: '매출·ROAS',
        series: [
          { name: '매출', data: data.mediaTable.map(m => m.revenue), color: '#f59e0b', type: 'bar' as const, format: 'currency' as const },
          { name: 'ROAS', data: data.mediaTable.map(m => m.roas), color: '#16a34a', type: 'line' as const, format: 'percent' as const, yAxisIndex: 1 as const },
        ],
      },
      {
        title: '매체별 결제·환불·순매출 비교',
        desc: '결제·환불·순매출',
        series: settlementSeries.map(item => ({ name: item.name, data: item.values, color: item.color, type: 'bar' as const, format: 'currency' as const })),
      },
      {
        title: '매체별 비용 효율 비교',
        desc: 'CPC·CPA',
        series: [
          { name: 'CPC', data: data.mediaTable.map(m => m.cpc), color: '#8b5cf6', type: 'bar' as const, format: 'currency' as const },
          { name: 'CPA', data: data.mediaTable.map(m => m.cpa), color: '#dc2626', type: 'bar' as const, format: 'currency' as const },
        ],
      },
    ].filter(page => page.series.length > 0 && page.series.some(series => series.data.some(value => value !== 0)));

    return (
      <>
        {pages.map((page, index) => (
          <div className="monthly-report-page" style={PAGE_STYLE} key={page.title}>
            <PageBand title={page.title} subtitle={`${data.advertiserName} · ${monthLabel(data.month)} · ${page.desc} (${index + 1}/${pages.length})`} />
            <TrendComboChart title={page.title} dates={platforms} height={300} series={page.series} />
          </div>
        ))}
      </>
    );
  }

  const customVolumeMetrics = data.profileMetrics.filter(m => RAW_KEYS.has(m));
  const customEfficiencyMetrics = data.profileMetrics.filter(m => !RAW_KEYS.has(m));

  const volumeChart = isCustom ? {
    title: '매체별 물량 비교', desc: customVolumeMetrics.map(m => CUSTOM_METRIC_DEFS[m]?.label).filter(Boolean).join('·') || '광고비',
    series: (customVolumeMetrics.length ? customVolumeMetrics : ['spend']).map((m, i) => {
      const def = CUSTOM_METRIC_DEFS[m]!;
      return { name: def.label, data: data.mediaTable.map(row => row[def.field] as number), color: CHART_COLORS[i % CHART_COLORS.length], type: 'bar' as const, format: def.format === 'money' ? 'currency' as const : def.format === 'pct' ? 'percent' as const : 'number' as const };
    }),
  } : isRevenue ? {
    title: '매체별 광고비 · 매출', desc: '광고비·매출 비교',
    series: [
      { name: '광고비', data: data.mediaTable.map(m => m.spend), color: '#2563eb', type: 'bar' as const, format: 'currency' as const },
      { name: '매출', data: data.mediaTable.map(m => m.revenue), color: '#f59e0b', type: 'bar' as const, format: 'currency' as const },
    ],
  } : isClick ? {
    title: '매체별 광고비 · 클릭수', desc: '광고비·클릭수 비교',
    series: [
      { name: '광고비', data: data.mediaTable.map(m => m.spend), color: '#2563eb', type: 'bar' as const, format: 'currency' as const },
      { name: '클릭수', data: data.mediaTable.map(m => m.clicks), color: '#db2777', type: 'line' as const, format: 'number' as const, yAxisIndex: 1 as const },
    ],
  } : isReach ? {
    title: '매체별 노출수 · 도달', desc: '노출수·도달 비교',
    series: [
      { name: '노출수', data: data.mediaTable.map(m => m.impressions), color: '#2563eb', type: 'bar' as const, format: 'number' as const },
      { name: '도달', data: data.mediaTable.map(m => m.reach), color: '#f59e0b', type: 'bar' as const, format: 'number' as const },
    ],
  } : {
    title: '매체별 광고비 · DB', desc: '광고비·DB 비교',
    series: [
      { name: '광고비', data: data.mediaTable.map(m => m.spend), color: '#2563eb', type: 'bar' as const, format: 'currency' as const },
      { name: 'DB', data: data.mediaTable.map(m => m.leads), color: '#16a34a', type: 'line' as const, format: 'number' as const, yAxisIndex: 1 as const },
    ],
  };

  // 효율 지표(ROAS/CPC/CPA 등)는 값의 단위가 광고비·물량과 전혀 달라서, 같은 보조축에 함께
  // 넣으면 축이 뒤섞입니다. 그래서 물량 비교 차트와 효율 비교 차트를 아예 분리했습니다.
  const efficiencyChart = isCustom ? (customEfficiencyMetrics.length ? {
    title: '매체별 효율 비교', desc: customEfficiencyMetrics.map(m => CUSTOM_METRIC_DEFS[m]?.label).filter(Boolean).join('·'),
    series: customEfficiencyMetrics.map((m, i) => {
      const def = CUSTOM_METRIC_DEFS[m]!;
      return { name: def.label, data: data.mediaTable.map(row => row[def.field] as number), color: CHART_COLORS[(i + 2) % CHART_COLORS.length], type: 'bar' as const, format: def.format === 'money' ? 'currency' as const : def.format === 'pct' ? 'percent' as const : 'number' as const };
    }),
  } : null) : isRevenue ? {
    title: '매체별 ROAS', desc: 'ROAS(매출÷광고비) 비교',
    series: [{ name: 'ROAS', data: data.mediaTable.map(m => m.roas), color: '#16a34a', type: 'bar' as const, format: 'percent' as const }],
  } : isClick ? {
    title: '매체별 CTR · CPC', desc: 'CTR·CPC 비교',
    series: [
      { name: 'CTR', data: data.mediaTable.map(m => m.ctr), color: '#8b5cf6', type: 'bar' as const, format: 'percent' as const },
      { name: 'CPC', data: data.mediaTable.map(m => m.cpc), color: '#dc2626', type: 'line' as const, format: 'currency' as const, yAxisIndex: 1 as const },
    ],
  } : isReach ? {
    title: '매체별 CPM', desc: 'CPM(광고비÷노출×1000) 비교 — 낮을수록 효율적',
    series: [{ name: 'CPM', data: data.mediaTable.map(m => m.cpm), color: '#dc2626', type: 'bar' as const, format: 'currency' as const }],
  } : {
    title: '매체별 CPA', desc: 'CPA(광고비÷DB) 비교 — 낮을수록 효율적',
    series: [{ name: 'CPA', data: data.mediaTable.map(m => m.cpa), color: '#dc2626', type: 'bar' as const, format: 'currency' as const }],
  };

  return (
    <>
      <div className="monthly-report-page" style={PAGE_STYLE}>
        <PageBand title="매체별 광고비 및 핵심 성과 비교" subtitle={`${data.advertiserName} · ${monthLabel(data.month)} · ${volumeChart.desc}`} />
        <TrendComboChart title={volumeChart.title} dates={platforms} height={300} series={volumeChart.series} />
      </div>
      {efficiencyChart && (
        <div className="monthly-report-page" style={PAGE_STYLE}>
          <PageBand title="매체별 핵심 효율 지표 비교" subtitle={`${data.advertiserName} · ${monthLabel(data.month)} · ${efficiencyChart.desc}`} />
          <TrendComboChart title={efficiencyChart.title} dates={platforms} height={300} series={efficiencyChart.series} />
        </div>
      )}
    </>
  );
}
