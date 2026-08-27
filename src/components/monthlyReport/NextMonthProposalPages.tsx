import type { CSSProperties } from 'react';
import type { NextMonthProposalData, ProposalMediaRow } from '../../utils/nextMonthProposal';
import { getPlatformColor } from '../../utils/platformColors';

const NAVY = '#111a2f';
const BLUE = '#2563eb';
const CYAN = '#27b4f2';
const PAGE: CSSProperties = { width: 1122, minHeight: 794, background: '#eef3f8', padding: 34, boxSizing: 'border-box', color: '#111827', position: 'relative', overflow: 'hidden' };
const PANEL: CSSProperties = { background: '#fff', border: '1px solid #dce5ef', borderRadius: 14, boxShadow: '0 8px 24px rgba(15,23,42,.07)' };

function monthLabel(month: string) { const [y, m] = month.split('-'); return `${y}년 ${Number(m)}월`; }
function proposalClosingDateLabel(date = new Date()) { return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`; }
function money(v: number) { return `₩${Math.round(v).toLocaleString()}`; }
function pct(v: number) { return `${v.toFixed(1)}%`; }
function chunkList<T>(items: T[], size: number): T[][] { return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size)); }
function customValue(value: number, unit = '') { return unit === '%' ? `${value.toFixed(1)}%` : unit === '원' ? money(value) : `${Math.round(value * 100) / 100}${unit}`; }
function PageBand({ title, subtitle }: { title: string; subtitle: string }) {
  return <div style={{ background: NAVY, color: '#fff', margin: '-34px -34px 26px', padding: '20px 34px', borderBottom: `5px solid ${CYAN}` }}><strong style={{ fontSize: 22 }}>{title}</strong><div style={{ fontSize: 12, opacity: .72, marginTop: 5 }}>{subtitle}</div></div>;
}
// 이전 달(current) 대비 다음달 제안(target)이 절대적으로 얼마나 늘거나 주는지 계산합니다.
// 퍼센트만으로는 "그래서 얼마나?"가 바로 안 와닿으므로, 항상 절대 증감도 함께 보여줍니다.
function fmtProposalDiff(current: number, target: number, format: 'currency' | 'count'): string | null {
  const diff = target - current;
  if (!Number.isFinite(diff) || diff === 0) return null;
  const sign = diff > 0 ? '+' : '−';
  const abs = Math.abs(diff);
  return format === 'currency' ? `${sign}${money(abs)}` : `${sign}${Math.round(abs).toLocaleString()}건`;
}

function fmtProposalPercentDiff(current: number, target: number): string | null {
  if (!Number.isFinite(current) || !Number.isFinite(target) || current === target) return null;
  // CVR·CTR·ROAS는 이미 퍼센트 값이라, "그 값이 상대적으로 몇 % 늘었나"가 아니라
  // "퍼센트 포인트로 몇 만큼 늘었나"(예: 9.8% → 11.7%는 +1.9%p)로 보여줘야 화면에 표시된
  // 반올림 숫자로 직접 암산했을 때와 정확히 일치합니다.
  const diff = target - current;
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}%p · 이번 달 대비`;
}

function KpiCard({ label, current, target, good, neutral, diff }: { label: string; current: string; target: string; good?: boolean; neutral?: boolean; diff?: string | null }) {
  const diffColor = diff ? (diff.startsWith('+') ? '#2563eb' : '#dc2626') : undefined;
  return <div style={{ ...PANEL, padding: 18, borderTop: `4px solid ${neutral ? '#94a3b8' : good === false ? '#f97316' : BLUE}` }}><div style={{ fontSize: 12, color: '#64748b' }}>{label}{neutral && <span style={{ marginLeft: 6, color: '#94a3b8' }}>(참고 지표)</span>}</div><div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10, gap: 12 }}><div><small style={{ color: '#94a3b8' }}>이번 달</small><div style={{ fontSize: 16, color: '#475569', marginTop: 3 }}>{current}</div></div><div style={{ textAlign: 'right' }}><small style={{ color: '#94a3b8' }}>다음달 제안</small><div style={{ fontSize: 23, fontWeight: 800, color: neutral ? '#64748b' : NAVY, marginTop: 3 }}>{target}</div>{diff && <div style={{ fontSize: 11, fontWeight: 700, color: diffColor, marginTop: 2 }}>{diff}</div>}</div></div></div>;
}

export function ProposalCoverPage({ data }: { data: NextMonthProposalData }) {
  return <div className="monthly-report-page" style={{ ...PAGE, background: NAVY, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}><span style={{ fontSize: 20, fontWeight: 900 }}>하우투엠</span><span style={{ fontSize: 13, fontWeight: 800, color: CYAN, letterSpacing: '0.1em' }}>HOWTOM</span></div>
      <div style={{ color: CYAN, fontWeight: 800, letterSpacing: 1.5 }}>NEXT MONTH MEDIA OPERATION PROPOSAL</div><h1 style={{ fontSize: 42, lineHeight: 1.25, margin: '32px 0 12px' }}>{data.advertiserName}<br />다음달 제안서</h1><p style={{ color: '#b8c7db', fontSize: 18 }}>{monthLabel(data.sourceMonth)} 월간 성과를 기준으로 설계한 {monthLabel(data.targetMonth)} 운영안</p></div>
    {(() => {
      const cards = data.reportType === 'revenue'
        ? [['제안 광고비', money(data.target.spend)], ['기대 구매 전환', `${data.target.purchases.toLocaleString()}건`], ['기대 전체 주문 매출', money(data.target.revenue)]]
        : data.reportType === 'click'
        ? [['제안 광고비', money(data.target.spend)], ['기대 클릭', `${data.target.clicks.toLocaleString()}회`], ['기대 CPC', money(data.target.cpc)]]
        : data.reportType === 'reach'
        ? [['제안 광고비', money(data.target.spend)], ['기대 노출·도달', `${data.target.impressions.toLocaleString()} / ${data.target.reach.toLocaleString()}`], ['기대 CPM', money(data.target.cpm)]]
        : data.reportType === 'custom' && data.customMetrics?.length
        ? [['제안 광고비', money(data.target.spend)], ...[...data.customMetrics].sort((a, b) => (a.direction === 'neutral' ? 1 : 0) - (b.direction === 'neutral' ? 1 : 0)).slice(0, 2).map(m => [`기대 ${m.name}`, `${m.target.toLocaleString()}${m.unit}`])]
        : data.reportType === 'integrated' || data.reportType === 'custom'
        ? [['제안 광고비', money(data.target.spend)], ['기대 DB', `${data.target.leads.toLocaleString()}건`], ['기대 전체 주문 매출', money(data.target.revenue)]]
        : [['제안 광고비', money(data.target.spend)], ['기대 DB', `${data.target.leads.toLocaleString()}건`], ['기대 CPA', money(data.target.cpa)]];
      return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>{cards.map(([label, value]) => <div key={label} style={{ background: 'rgba(255,255,255,.08)', padding: 18, borderRadius: 12 }}><small>{label}</small><strong style={{ display: 'block', marginTop: 8, fontSize: 23 }}>{value}</strong></div>)}</div>;
    })()}
    {data.isSample && <div style={{ position: 'absolute', right: 34, top: 34, color: '#fbbf24', fontWeight: 800 }}>TEST SAMPLE</div>}
  </div>;
}

export function ProposalKpiPage({ data }: { data: NextMonthProposalData }) {
  const cards =
    data.reportType === 'revenue'
      ? [
          <KpiCard key="spend" label="광고비" current={money(data.current.spend)} target={money(data.target.spend)} diff={fmtProposalDiff(data.current.spend, data.target.spend, 'currency')} />,
          <KpiCard key="purchases" label="구매 전환" current={data.current.purchases.toLocaleString()} target={data.target.purchases.toLocaleString()} diff={fmtProposalDiff(data.current.purchases, data.target.purchases, 'count')} />,
          <KpiCard key="revenue" label="매출" current={money(data.current.revenue)} target={money(data.target.revenue)} diff={fmtProposalDiff(data.current.revenue, data.target.revenue, 'currency')} />,
          <KpiCard key="netRevenue" label="순매출" current={money(data.current.netRevenue)} target={money(data.target.netRevenue)} diff={fmtProposalDiff(data.current.netRevenue, data.target.netRevenue, 'currency')} />,
          <KpiCard key="roas" label="ROAS" current={pct(data.current.roas)} target={pct(data.target.roas)} good={data.target.roas >= data.current.roas} diff={fmtProposalPercentDiff(data.current.roas, data.target.roas)} />,
        ]
      : data.reportType === 'click'
      ? [
          <KpiCard key="spend" label="광고비" current={money(data.current.spend)} target={money(data.target.spend)} diff={fmtProposalDiff(data.current.spend, data.target.spend, 'currency')} />,
          <KpiCard key="clicks" label="클릭수" current={data.current.clicks.toLocaleString()} target={data.target.clicks.toLocaleString()} diff={fmtProposalDiff(data.current.clicks, data.target.clicks, 'count')} />,
          <KpiCard key="ctr" label="CTR" current={pct(data.current.ctr)} target={pct(data.target.ctr)} good={data.target.ctr >= data.current.ctr} diff={fmtProposalPercentDiff(data.current.ctr, data.target.ctr)} />,
          <KpiCard key="cpc" label="CPC" current={money(data.current.cpc)} target={money(data.target.cpc)} good={data.target.cpc <= data.current.cpc} diff={fmtProposalDiff(data.current.cpc, data.target.cpc, 'currency')} />,
        ]
      : data.reportType === 'reach'
      ? [
          <KpiCard key="spend" label="광고비" current={money(data.current.spend)} target={money(data.target.spend)} diff={fmtProposalDiff(data.current.spend, data.target.spend, 'currency')} />,
          <KpiCard key="impressions" label="노출수" current={data.current.impressions.toLocaleString()} target={data.target.impressions.toLocaleString()} diff={fmtProposalDiff(data.current.impressions, data.target.impressions, 'count')} />,
          <KpiCard key="reach" label="도달" current={data.current.reach.toLocaleString()} target={data.target.reach.toLocaleString()} diff={fmtProposalDiff(data.current.reach, data.target.reach, 'count')} />,
          <KpiCard key="cpm" label="CPM" current={money(data.current.cpm)} target={money(data.target.cpm)} good={data.target.cpm <= data.current.cpm} diff={fmtProposalDiff(data.current.cpm, data.target.cpm, 'currency')} />,
        ]
      : data.reportType === 'custom' && data.customMetrics?.length
      ? [
          <KpiCard key="spend" label={data.newPlatformSuggestion ? '광고비 (신규 매체 포함)' : '광고비'} current={money(data.current.spend)} target={money(data.target.spend)} diff={fmtProposalDiff(data.current.spend, data.target.spend, 'currency')} />,
          ...data.customMetrics.map(m => (
            <KpiCard key={m.id} label={data.newPlatformSuggestion ? `${m.name} (기존 매체 기준)` : m.name} current={`${m.current.toLocaleString()}${m.unit}`} target={`${m.target.toLocaleString()}${m.unit}`} good={m.direction === 'down' ? m.target <= m.current : m.target >= m.current} neutral={m.direction === 'neutral'} diff={m.unit === '%' ? fmtProposalPercentDiff(m.current, m.target) : null} />
          )),
        ]
      : data.reportType === 'integrated' || data.reportType === 'custom'
      ? [
          <KpiCard key="spend" label="광고비" current={money(data.current.spend)} target={money(data.target.spend)} diff={fmtProposalDiff(data.current.spend, data.target.spend, 'currency')} />,
          <KpiCard key="impressions" label="노출수" current={data.current.impressions.toLocaleString()} target={data.target.impressions.toLocaleString()} diff={fmtProposalDiff(data.current.impressions, data.target.impressions, 'count')} />,
          <KpiCard key="clicks" label="클릭수" current={data.current.clicks.toLocaleString()} target={data.target.clicks.toLocaleString()} diff={fmtProposalDiff(data.current.clicks, data.target.clicks, 'count')} />,
          <KpiCard key="leads" label="DB" current={data.current.leads.toLocaleString()} target={data.target.leads.toLocaleString()} diff={fmtProposalDiff(data.current.leads, data.target.leads, 'count')} />,
          <KpiCard key="cpa" label="CPA" current={money(data.current.cpa)} target={money(data.target.cpa)} good={data.target.cpa <= data.current.cpa} diff={fmtProposalDiff(data.current.cpa, data.target.cpa, 'currency')} />,
          <KpiCard key="revenue" label="매출" current={money(data.current.revenue)} target={money(data.target.revenue)} diff={fmtProposalDiff(data.current.revenue, data.target.revenue, 'currency')} />,
          <KpiCard key="roas" label="ROAS" current={pct(data.current.roas)} target={pct(data.target.roas)} good={data.target.roas >= data.current.roas} diff={fmtProposalPercentDiff(data.current.roas, data.target.roas)} />,
        ]
      : [
          <KpiCard key="spend" label="광고비" current={money(data.current.spend)} target={money(data.target.spend)} diff={fmtProposalDiff(data.current.spend, data.target.spend, 'currency')} />,
          <KpiCard key="leads" label="DB" current={data.current.leads.toLocaleString()} target={data.target.leads.toLocaleString()} diff={fmtProposalDiff(data.current.leads, data.target.leads, 'count')} />,
          <KpiCard key="cvr" label="CVR" current={pct(data.current.cvr)} target={pct(data.target.cvr)} good={data.target.cvr >= data.current.cvr} diff={fmtProposalPercentDiff(data.current.cvr, data.target.cvr)} />,
          <KpiCard key="cpa" label="CPA" current={money(data.current.cpa)} target={money(data.target.cpa)} good={data.target.cpa <= data.current.cpa} diff={fmtProposalDiff(data.current.cpa, data.target.cpa, 'currency')} />,
        ];
  const cardChunks = chunkList(cards, 8);
  return <>
    {cardChunks.map((chunk, index) => {
      const isLast = index === cardChunks.length - 1;
      return <div className="monthly-report-page" style={PAGE} key={`proposal-kpi-${index}`}><PageBand title={`${monthLabel(data.targetMonth)} KPI 제안${cardChunks.length > 1 ? ` (${index + 1}/${cardChunks.length})` : ''}`} subtitle={`${monthLabel(data.sourceMonth)} 실제 성과 기반 기대 목표`} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {chunk}
        </div>
        {isLast && <div style={{ ...PANEL, marginTop: 22, padding: 20 }}><strong style={{ color: NAVY }}>제안 기준</strong><p style={{ color: '#64748b', lineHeight: 1.7, marginBottom: 0 }}>매체별 이번 달 효율과 성과 발생 여부를 비교해 우수 매체는 단계적 증액, 저효율 매체는 감액 또는 중지, 안정 매체는 유지로 분류했습니다. 사용자 지정형은 계산 가능한 커스텀 지표를 매체별 판단 기준으로 우선 사용합니다.</p></div>}
      </div>;
    })}
  </>;
}

export function ProposalMediaPages({ data }: { data: NextMonthProposalData }) {
  const chunks = Array.from({ length: Math.max(1, Math.ceil(data.mediaRows.length / 8)) }, (_, i) => data.mediaRows.slice(i * 8, i * 8 + 8));
  const hasCustomBasis = data.reportType === 'custom' && data.mediaRows.some(row => row.customBasis);
  const metricColumns: { label: string; render: (row: ProposalMediaRow) => string }[] =
    data.reportType === 'revenue'
      ? [
          { label: '기대 클릭', render: row => row.expectedClicks.toLocaleString() },
          { label: '기대 구매 전환', render: row => row.expectedPurchases.toLocaleString() },
          { label: '기대 광고 귀속 매출', render: row => money(row.expectedRevenue) },
          { label: '기대 ROAS', render: row => pct(row.expectedRoas) },
        ]
      : data.reportType === 'click'
      ? [
          { label: '기대 노출', render: row => row.expectedImpressions.toLocaleString() },
          { label: '기대 클릭', render: row => row.expectedClicks.toLocaleString() },
          { label: '기대 CPC', render: row => money(row.proposedSpend > 0 && row.expectedClicks > 0 ? row.proposedSpend / row.expectedClicks : 0) },
        ]
      : data.reportType === 'reach'
      ? [
          { label: '기대 노출', render: row => row.expectedImpressions.toLocaleString() },
          { label: '기대 도달', render: row => Math.round(row.expectedImpressions * (row.reach > 0 && row.impressions > 0 ? row.reach / row.impressions : 0.72)).toLocaleString() },
          { label: '기대 CPM', render: row => money(row.expectedImpressions > 0 ? (row.proposedSpend / row.expectedImpressions) * 1000 : 0) },
        ]
      : hasCustomBasis
      ? [
          { label: '판단 지표', render: row => row.customBasis ? `${row.customBasis.name} ${customValue(row.customBasis.value, row.customBasis.unit)}` : '－' },
          { label: '기대 지표', render: row => row.customBasis ? customValue(row.customBasis.target, row.customBasis.unit) : '－' },
          { label: '기대 클릭', render: row => row.expectedClicks.toLocaleString() },
          { label: '기대 CPA', render: row => money(row.expectedLeads > 0 ? row.proposedSpend / row.expectedLeads : 0) },
        ]
      : [
          { label: '기대 클릭', render: row => row.expectedClicks.toLocaleString() },
          { label: '기대 DB', render: row => row.expectedLeads.toLocaleString() },
          { label: '기대 CVR', render: row => pct(row.expectedClicks > 0 ? (row.expectedLeads / row.expectedClicks) * 100 : 0) },
          { label: '기대 CPA', render: row => money(row.expectedLeads > 0 ? row.proposedSpend / row.expectedLeads : 0) },
        ];
  const headers = ['매체', '운영', '현재 광고비', '제안 광고비', ...metricColumns.map(c => c.label)];
  const customMetricChunks = data.reportType === 'custom' && (data.customMetrics ?? []).length > 0 ? chunkList(data.customMetrics ?? [], 12) : [];
  return <>
    {chunks.map((rows, page) => <div key={page} className="monthly-report-page" style={PAGE}><PageBand title={`${monthLabel(data.targetMonth)} 매체별 운영 제안${chunks.length > 1 ? ` (${page + 1}/${chunks.length})` : ''}`} subtitle={hasCustomBasis ? '커스텀 지표 기준 예산 조정 방향과 기대 성과' : '예산 조정 방향과 기대 성과'} />
      <table style={{ ...PANEL, width: '100%', borderCollapse: 'separate', borderSpacing: 0, overflow: 'hidden', fontSize: 12 }}><thead><tr style={{ background: '#eaf2fb', color: NAVY }}>{headers.map((label, index) => <th key={label} style={{ padding: '9px 10px', textAlign: index === 0 ? 'left' : 'right' }}>{label}</th>)}</tr></thead><tbody>{rows.map(row => {
        const changeAmount = row.proposedSpend - row.spend;
        return <tr key={row.platform}><td style={{ padding: '9px 10px', textAlign: 'left' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: getPlatformColor(row.platform) }} /><b>{row.platform}</b></span><small style={{ display: 'block', color: '#64748b', marginTop: 3, marginLeft: 14 }}>{row.reason}</small></td><td style={{ padding: '9px 10px', textAlign: 'right' }}><span style={{ padding: '4px 8px', borderRadius: 999, background: row.action === '증액' ? '#dcfce7' : row.action === '감액' ? '#ffedd5' : row.action === '광고 중지' ? '#fee2e2' : '#e2e8f0', color: row.action === '증액' ? '#15803d' : row.action === '감액' ? '#c2410c' : row.action === '광고 중지' ? '#b91c1c' : '#475569', fontWeight: 800 }}>{row.action}{row.budgetChangePercent ? ` ${row.budgetChangePercent > 0 ? '+' : ''}${row.budgetChangePercent}%` : ''}</span></td><td style={{ padding: '9px 10px', textAlign: 'right' }}>{money(row.spend)}</td><td style={{ padding: '9px 10px', textAlign: 'right' }}><b>{money(row.proposedSpend)}</b>{changeAmount !== 0 && <small style={{ display: 'block', color: changeAmount > 0 ? '#15803d' : '#c2410c' }}>{changeAmount > 0 ? '+' : ''}{money(changeAmount)}</small>}</td>{metricColumns.map(col => <td key={col.label} style={{ padding: '9px 10px', textAlign: 'right' }}>{col.render(row)}</td>)}</tr>;
      })}</tbody></table>
    </div>)}
    {customMetricChunks.map((metrics, page) => <div key={`proposal-custom-${page}`} className="monthly-report-page" style={PAGE}><PageBand title={`${monthLabel(data.targetMonth)} 커스텀 지표 기대값${customMetricChunks.length > 1 ? ` (${page + 1}/${customMetricChunks.length})` : ''}`} subtitle="광고주 전체 기준 · 12개 단위 자동 분할" />
      <div style={{ ...PANEL, padding: 16 }}>
        <strong style={{ color: NAVY, fontSize: 13 }}>사용자 지정 커스텀 지표 — 다음달 기대값</strong>
        <p style={{ fontSize: 11.5, color: '#94a3b8', margin: '4px 0 12px' }}>전체 KPI 목표는 광고주 합계 기준입니다. 매체별 원본 지표로 계산 가능한 수식은 앞의 매체별 운영 제안 표에서 판단 지표로 사용됩니다.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {metrics.map(m => { const percentDiff = m.unit === '%' ? fmtProposalPercentDiff(m.current, m.target) : null; return <div key={m.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}><small style={{ color: '#64748b' }}>{m.name}</small><div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{customValue(m.current, m.unit)} → {customValue(m.target, m.unit)}</div>{percentDiff && <small style={{ display: 'block', marginTop: 3, color: percentDiff.startsWith('+') ? '#2563eb' : '#dc2626', fontWeight: 700 }}>{percentDiff}</small>}</div>; })}
        </div>
      </div>
    </div>)}
  </>;
}

function Bars({ rows }: { rows: { label: string; current: number; target: number }[] }) {
  const max = Math.max(...rows.flatMap(row => [row.current, row.target]), 1);
  return <div style={{ ...PANEL, padding: 22 }}>{rows.map(row => <div key={row.label} style={{ marginBottom: 19 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}><b>{row.label}</b><span>현재 {Math.round(row.current).toLocaleString()} · 제안 {Math.round(row.target).toLocaleString()}</span></div><div style={{ height: 11, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}><div style={{ height: '100%', width: `${row.current / max * 100}%`, background: '#94a3b8' }} /></div><div style={{ height: 11, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden', marginTop: 4 }}><div style={{ height: '100%', width: `${row.target / max * 100}%`, background: BLUE }} /></div></div>)}</div>;
}

function BudgetDonut({ rows }: { rows: { label: string; target: number }[] }) {
  const total = rows.reduce((s, r) => s + r.target, 0);
  const r = 58, circumference = 2 * Math.PI * r;
  let cursor = 0;
  return <div style={{ ...PANEL, padding: 22 }}>
    <strong style={{ color: NAVY, fontSize: 14 }}>매체별 예산 배분 비율</strong>
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 14 }}>
      <svg viewBox="0 0 140 140" width={150} height={150}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="20" />
        {rows.filter(row => row.target > 0).map(row => {
          const share = total > 0 ? row.target / total : 0;
          const el = <circle key={row.label} cx="70" cy="70" r={r} fill="none" stroke={getPlatformColor(row.label)} strokeWidth="20" strokeDasharray={`${share * circumference} ${circumference}`} strokeDashoffset={-cursor * circumference} transform="rotate(-90 70 70)" />;
          cursor += share;
          return el;
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {rows.filter(row => row.target > 0).map(row => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 999, background: getPlatformColor(row.label) }} />{row.label}</span>
            <b>{total > 0 ? ((row.target / total) * 100).toFixed(0) : 0}%</b>
          </div>
        ))}
      </div>
    </div>
  </div>;
}

export function ProposalChartsPage({ data }: { data: NextMonthProposalData }) {
  const budgetRows = data.mediaRows.map(row => ({ label: row.platform, current: row.spend, target: row.proposedSpend })).slice(0, 10);
  // 신규 매체 시범 예산도 표지 총예산에 포함되므로, 예산 배분 차트에도 함께 넣어야
  // 표지·차트·매체별 표의 합계가 서로 일치합니다.
  if (data.newPlatformSuggestion) {
    budgetRows.push({ label: data.newPlatformSuggestion.platform, current: 0, target: data.newPlatformSuggestion.proposedBudget });
  }
  return <div className="monthly-report-page" style={PAGE}><PageBand title={`${monthLabel(data.targetMonth)} 예산 배분 차트`} subtitle="회색은 이번 달, 파란색은 다음달 제안(신규 매체 시범 예산 포함)" />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <BudgetDonut rows={budgetRows} />
      <Bars rows={budgetRows} />
    </div>
  </div>;
}

export function ProposalStrengthWeaknessPage({ data }: { data: NextMonthProposalData }) {
  const strengths = data.mediaRows.filter(row => row.action === '증액').sort((a, b) => b.budgetChangePercent - a.budgetChangePercent).slice(0, 5);
  const weaknesses = data.mediaRows.filter(row => row.action === '감액' || row.action === '광고 중지').slice(0, 5);
  const spendShare = (row: ProposalMediaRow) => {
    const total = data.mediaRows.reduce((s, r) => s + r.spend, 0);
    return total > 0 ? (row.spend / total) * 100 : 0;
  };
  return <div className="monthly-report-page" style={PAGE}><PageBand title={`${monthLabel(data.sourceMonth)} 실적 기준 강점과 보완할 점`} subtitle="다음달 예산 배분 판단의 근거" />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ ...PANEL, padding: 20, borderTop: `4px solid #16a34a` }}>
        <strong style={{ color: '#15803d', fontSize: 14 }}>👍 강점 — 효율이 좋아 예산을 늘릴 매체</strong>
        {strengths.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 10 }}>이번 달 실적 중 뚜렷하게 증액을 제안할 매체가 없습니다.</p>}
        {strengths.map(row => <div key={row.platform} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}><b>{row.platform}</b><span style={{ marginLeft: 8, fontSize: 11.5, color: '#16a34a', fontWeight: 700 }}>예산 비중 {spendShare(row).toFixed(0)}%</span><p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#475569', lineHeight: 1.6 }}>{row.reason}</p></div>)}
      </div>
      <div style={{ ...PANEL, padding: 20, borderTop: `4px solid #dc2626` }}>
        <strong style={{ color: '#b91c1c', fontSize: 14 }}>⚠ 보완할 점 — 개선이 필요한 매체</strong>
        {weaknesses.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 10 }}>이번 달 실적 중 뚜렷하게 감액·중지가 필요한 매체가 없습니다.</p>}
        {weaknesses.map(row => <div key={row.platform} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}><b>{row.platform}</b><span style={{ marginLeft: 8, fontSize: 11.5, color: row.action === '광고 중지' ? '#b91c1c' : '#c2410c', fontWeight: 700 }}>{row.action}</span><p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#475569', lineHeight: 1.6 }}>{row.reason}</p></div>)}
      </div>
    </div>
    <div style={{ ...PANEL, padding: 18, marginTop: 16 }}>
      <strong style={{ color: NAVY }}>종합 평가</strong>
      <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.7, fontSize: 13.5 }}>
        {strengths.length > 0 && weaknesses.length > 0
          ? `${strengths.map(r => r.platform).join(', ')} 매체는 효율이 높아 예산 확대를, ${weaknesses.map(r => r.platform).join(', ')} 매체는 효율 개선 또는 예산 축소를 검토할 시점입니다. 전체적으로 매체 간 효율 편차가 있으니 다음달은 우선순위 재배분이 필요합니다.`
          : strengths.length > 0
          ? `${strengths.map(r => r.platform).join(', ')} 매체를 중심으로 안정적인 성과를 보이고 있어, 이 흐름을 유지하며 신규 매체·소재 테스트로 확장을 검토할 수 있습니다.`
          : weaknesses.length > 0
          ? `${weaknesses.map(r => r.platform).join(', ')} 매체의 효율 저하가 눈에 띕니다. 소재·타기팅 점검을 우선하고, 개선이 없으면 예산 비중을 조정하는 것을 권장합니다.`
          : '이번 달 매체 간 실적 편차가 크지 않아, 현재 예산 배분을 유지하며 다음달 추이를 지켜보는 것을 권장합니다.'}
      </p>
    </div>
  </div>;
}

export function ProposalMediaRolesPage({ data }: { data: NextMonthProposalData }) {
  const rows = data.mediaRows.filter(row => row.spend > 0);
  if (rows.length === 0) return null;
  // 매체별로 눈에 띄는 강점 하나씩을 자동으로 골라 배지를 붙입니다(참고 보고서의
  // "매체별 주요 강점 및 역할" 스타일). 같은 배지가 중복되지 않도록 이미 배정된 역할은
  // 다음 매체에서 제외합니다.
  const cpaOf = (r: ProposalMediaRow) => r.leads > 0 ? r.spend / r.leads : Infinity;
  const ctrOf = (r: ProposalMediaRow) => r.impressions > 0 ? r.clicks / r.impressions : 0;
  const cpmOf = (r: ProposalMediaRow) => r.impressions > 0 ? (r.spend / r.impressions) * 1000 : Infinity;
  const roleCandidates: { key: string; label: string; color: string; pick: (list: ProposalMediaRow[]) => ProposalMediaRow | undefined }[] = [
    { key: 'efficiency', label: '최고 효율', color: '#15803d', pick: list => [...list].sort((a, b) => cpaOf(a) - cpaOf(b))[0] },
    { key: 'volume', label: '볼륨 채널', color: '#2563eb', pick: list => [...list].sort((a, b) => b.spend - a.spend)[0] },
    { key: 'intent', label: '의도 기반', color: '#c2410c', pick: list => [...list].sort((a, b) => ctrOf(b) - ctrOf(a))[0] },
    { key: 'lowcost', label: '저비용', color: '#a16207', pick: list => [...list].sort((a, b) => cpmOf(a) - cpmOf(b))[0] },
  ];
  const assigned = new Map<string, { label: string; color: string }>();
  let remaining = [...rows];
  roleCandidates.forEach(role => {
    const picked = role.pick(remaining);
    if (picked && !assigned.has(picked.platform)) {
      assigned.set(picked.platform, { label: role.label, color: role.color });
      remaining = remaining.filter(r => r.platform !== picked.platform);
    }
  });
  remaining.forEach(row => assigned.set(row.platform, { label: '보조 채널', color: '#64748b' }));
  return <div className="monthly-report-page" style={PAGE}><PageBand title={`${monthLabel(data.sourceMonth)} 매체별 주요 강점 및 역할`} subtitle="다음달 예산 배분 우선순위를 정하는 기준" />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
      {rows.map(row => { const role = assigned.get(row.platform)!; return (
        <div key={row.platform} style={{ ...PANEL, padding: 18, textAlign: 'center' }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: getPlatformColor(row.platform), margin: '0 auto 10px' }} />
          <b style={{ fontSize: 15 }}>{row.platform}</b>
          <div style={{ marginTop: 8 }}><span style={{ padding: '3px 10px', borderRadius: 999, background: `${role.color}18`, color: role.color, fontWeight: 800, fontSize: 11.5 }}>{role.label}</span></div>
        </div>
      ); })}
    </div>
  </div>;
}

export function ProposalNewPlatformPage({ data }: { data: NextMonthProposalData }) {
  const suggestion = data.newPlatformSuggestion;
  if (!suggestion) return null;
  const section = (title: string, items: string[]) => (
    <div style={{ marginBottom: 16 }}>
      <b style={{ color: NAVY, fontSize: 13 }}>{title}</b>
      <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#475569', fontSize: 12.5, lineHeight: 1.8 }}>
        {items.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    </div>
  );
  return <div className="monthly-report-page" style={PAGE}>
    <PageBand title={`${suggestion.platform} 신규 도입 제안`} subtitle={`${monthLabel(data.targetMonth)} 시범 운영 가이드`} />
    <div style={{ ...PANEL, padding: 18, marginBottom: 16, borderLeft: `5px solid ${BLUE}` }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: getPlatformColor(suggestion.platform) }} /><b style={{ fontSize: 14 }}>{suggestion.platform}</b></span>
      <p style={{ margin: 0, color: '#475569', lineHeight: 1.7, fontSize: 13 }}>{suggestion.reason}</p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <div style={{ ...PANEL, padding: 20 }}>
        {section('1. 타겟팅 전략', suggestion.guide.targeting)}
        {section('2. 메시지 및 소재 전략', suggestion.guide.message)}
        {section('3. 캠페인 및 입찰 설정', suggestion.guide.campaign)}
      </div>
      <div>
        <div style={{ ...PANEL, padding: 20, marginBottom: 16 }}>
          <b style={{ color: NAVY, fontSize: 13 }}>4. 예상 성과 (시범 예산 기준)</b>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            {(() => {
              const cells = data.reportType === 'revenue'
                ? [['시범 예산', money(suggestion.proposedBudget)], ['예상 노출·클릭', `${suggestion.expectedImpressions.toLocaleString()} / ${suggestion.expectedClicks.toLocaleString()}`], ['예상 구매 전환', suggestion.expectedPurchases > 0 ? `${suggestion.expectedPurchases.toLocaleString()}건` : '학습 후 산출'], ['기대 광고 귀속 매출', money(suggestion.expectedRevenue)]]
                : data.reportType === 'click'
                ? [['시범 예산', money(suggestion.proposedBudget)], ['예상 노출', suggestion.expectedImpressions.toLocaleString()], ['예상 클릭', suggestion.expectedClicks.toLocaleString()], ['목표 CPC', money(suggestion.expectedClicks > 0 ? suggestion.proposedBudget / suggestion.expectedClicks : 0)]]
                : data.reportType === 'reach'
                ? [['시범 예산', money(suggestion.proposedBudget)], ['예상 노출', suggestion.expectedImpressions.toLocaleString()], ['예상 도달', suggestion.expectedReach.toLocaleString()], ['목표 CPM', money(suggestion.expectedCpm)]]
                : data.reportType === 'integrated'
                ? [['시범 예산', money(suggestion.proposedBudget)], ['예상 노출·클릭', `${suggestion.expectedImpressions.toLocaleString()} / ${suggestion.expectedClicks.toLocaleString()}`], ['예상 DB', `${suggestion.expectedLeads.toLocaleString()}건`], ['기대 광고 귀속 매출', money(suggestion.expectedRevenue)]]
                : data.reportType === 'custom'
                // 사용자 지정 커스텀 지표는 신규 매체에 과거 실적이 없어 직접 예측할 수 없습니다.
                // 임의의 DB·CPA 숫자를 핵심 KPI처럼 보여주는 대신, 초기에는 표준 유입 지표로
                // 판단하고 커스텀 지표는 데이터가 쌓인 뒤 산출한다고 정직하게 안내합니다.
                ? [['시범 예산', money(suggestion.proposedBudget)], ['예상 노출·클릭', `${suggestion.expectedImpressions.toLocaleString()} / ${suggestion.expectedClicks.toLocaleString()}`], ['핵심 커스텀 KPI', '초기 2주 데이터 수집 후 산출'], ['1차 판단 기준', '노출 · 클릭 · CTR · CPC']]
                : [['시범 예산', money(suggestion.proposedBudget)], ['예상 노출·클릭', `${suggestion.expectedImpressions.toLocaleString()} / ${suggestion.expectedClicks.toLocaleString()}`], ['예상 DB', `${suggestion.expectedLeads.toLocaleString()}건`], ['목표 CPA', money(suggestion.expectedCpa)]];
              return cells.map(([label, value]) => <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}><small style={{ color: '#64748b' }}>{label}</small><div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{value}</div></div>);
            })()}
          </div>
          <p style={{ margin: '12px 0 0', color: '#94a3b8', fontSize: 11.5, lineHeight: 1.6 }}>{suggestion.guide.expectedNote}</p>
        </div>
        <div style={{ ...PANEL, padding: 20, background: NAVY, color: '#fff' }}>
          <b style={{ fontSize: 13 }}>성공을 위한 핵심 포인트</b>
          <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#cbd5e1', fontSize: 12.5, lineHeight: 1.8 }}>
            {suggestion.guide.tips.map((tip, index) => <li key={index}>{tip}</li>)}
          </ul>
        </div>
      </div>
    </div>
  </div>;
}

// 다음달 제안서의 마지막 장입니다. 월간 리포트의 BrandClosingPage(자동 생성 문구 포함)와
// 달리, 광고주에게 전달하는 제안서 마지막 페이지는 "감사합니다." 한 문장만 담습니다.
export function ProposalClosingPage() {
  return (
    <div className="monthly-report-page" style={{ ...PAGE, background: NAVY, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <><div style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-0.02em' }}>감사합니다.</div><div style={{ fontSize: 16, color: '#a9b8cf', marginTop: 18 }}>{proposalClosingDateLabel()}</div></>
    </div>
  );
}

export function ProposalInsightPage({ data, proposals }: { data: NextMonthProposalData; proposals: string[] }) {
  return <div className="monthly-report-page" style={PAGE}><PageBand title={`${monthLabel(data.targetMonth)} 실행 우선순위와 인사이트`} subtitle="주간 점검을 전제로 한 퍼포먼스 마케터 운영 제안" />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{proposals.map((text, index) => <div key={index} style={{ ...PANEL, padding: 20, borderLeft: `5px solid ${index < 2 ? BLUE : CYAN}` }}><div style={{ fontSize: 12, color: '#64748b', fontWeight: 800 }}>제안 {index + 1}</div><p style={{ margin: '9px 0 0', lineHeight: 1.7, fontSize: 15 }}>{text}</p></div>)}</div>
    <div style={{ ...PANEL, padding: 20, marginTop: 18, background: NAVY, color: '#fff' }}><strong>운영 원칙</strong><p style={{ margin: '8px 0 0', color: '#cbd5e1', lineHeight: 1.7 }}>월초 7일은 제안 예산의 80% 수준으로 시작하고, KPI 편차가 ±15% 이상 발생하면 매체별 예산을 재배분합니다. 광고 중지 대상은 신규 소재·타기팅 대안을 준비한 뒤 소액 테스트로 재개합니다.</p></div>
  </div>;
}

export function ProposalPerformanceChartPage({ data }: { data: NextMonthProposalData }) {
  const metricDefs =
    data.reportType === 'revenue'
      ? [
          { label: '광고비', current: data.current.spend, target: data.target.spend },
          { label: '구매 전환', current: data.current.purchases, target: data.target.purchases },
          { label: '매출', current: data.current.revenue, target: data.target.revenue },
          { label: '순매출', current: data.current.netRevenue, target: data.target.netRevenue },
          { label: 'ROAS', current: data.current.roas, target: data.target.roas },
        ]
      : data.reportType === 'click'
      ? [
          { label: '광고비', current: data.current.spend, target: data.target.spend },
          { label: '노출수', current: data.current.impressions, target: data.target.impressions },
          { label: '클릭수', current: data.current.clicks, target: data.target.clicks },
          { label: 'CTR', current: data.current.ctr, target: data.target.ctr },
        ]
      : data.reportType === 'reach'
      ? [
          { label: '광고비', current: data.current.spend, target: data.target.spend },
          { label: '노출수', current: data.current.impressions, target: data.target.impressions },
          { label: '도달', current: data.current.reach, target: data.target.reach },
          { label: '빈도', current: data.current.frequency, target: data.target.frequency },
        ]
      : data.reportType === 'custom' && (data.customMetrics ?? []).length
      ? (data.customMetrics ?? []).map(m => ({ label: m.name, current: m.current, target: m.target, direction: m.direction }))
      : data.reportType === 'integrated' || data.reportType === 'custom'
      ? [
          { label: '노출수', current: data.current.impressions, target: data.target.impressions },
          { label: '클릭수', current: data.current.clicks, target: data.target.clicks },
          { label: 'DB', current: data.current.leads, target: data.target.leads },
          { label: '매출', current: data.current.revenue, target: data.target.revenue },
          { label: 'ROAS', current: data.current.roas, target: data.target.roas },
        ]
      : [
          { label: '광고비', current: data.current.spend, target: data.target.spend },
          { label: '클릭수', current: data.current.clicks, target: data.target.clicks },
          { label: 'DB', current: data.current.leads, target: data.target.leads },
          { label: 'CVR', current: data.current.cvr, target: data.target.cvr },
        ];
  const LOWER_IS_BETTER = new Set(['CPC', 'CPM', 'CPA']);
  const metrics = metricDefs.map(item => ({ ...item, index: item.current > 0 ? item.target / item.current * 100 : item.target > 0 ? 130 : 100, lowerIsBetter: 'direction' in item ? item.direction === 'down' : LOWER_IS_BETTER.has(item.label), isNeutral: 'direction' in item && item.direction === 'neutral' }));
  const CHUNK_SIZE = 5;
  const chunks = metrics.length > CHUNK_SIZE
    ? Array.from({ length: Math.ceil(metrics.length / CHUNK_SIZE) }, (_, i) => metrics.slice(i * CHUNK_SIZE, i * CHUNK_SIZE + CHUNK_SIZE))
    : [metrics];
  return <>{chunks.map((pageMetrics, pageIndex) => (
    <div className="monthly-report-page" style={PAGE} key={pageIndex}><PageBand title={`${monthLabel(data.targetMonth)} 기대 성과 비교 차트${chunks.length > 1 ? ` (${pageIndex + 1}/${chunks.length})` : ''}`} subtitle="이번 달 실적을 100으로 본 다음달 기대 지수" />
      <div style={{ ...PANEL, padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px', gap: 12, alignItems: 'center', marginBottom: 12, color: '#64748b', fontSize: 11 }}><b>지표</b><span>성과 지수</span><b style={{ textAlign: 'right' }}>다음달</b></div>
        {pageMetrics.map(item => <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px', gap: 12, alignItems: 'center', marginBottom: 19 }}><b>{item.label}<small style={{ display: 'block', color: '#94a3b8', fontWeight: 400 }}>{item.isNeutral ? '참고 지표 (방향성 없음)' : item.lowerIsBetter ? '낮을수록 우수' : '높을수록 우수'}</small></b><div><div style={{ height: 12, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, 100 / 1.6)}%`, height: '100%', background: '#94a3b8' }} /></div><div style={{ height: 12, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden', marginTop: 5 }}><div style={{ width: `${Math.min(100, item.index / 1.6)}%`, height: '100%', background: item.isNeutral ? '#94a3b8' : BLUE }} /></div></div><strong style={{ textAlign: 'right', color: item.isNeutral ? '#64748b' : (item.lowerIsBetter ? item.index <= 100 : item.index >= 100) ? '#15803d' : '#c2410c' }}>{item.index.toFixed(1)}</strong></div>)}
        <div style={{ display: 'flex', gap: 18, color: '#64748b', fontSize: 11, marginTop: 8 }}><span><i style={{ display: 'inline-block', width: 12, height: 7, background: '#94a3b8', marginRight: 5 }} />이번 달 100</span><span><i style={{ display: 'inline-block', width: 12, height: 7, background: BLUE, marginRight: 5 }} />다음달 기대 지수</span></div>
      </div>
      {pageIndex === chunks.length - 1 && <div style={{ ...PANEL, padding: 18, marginTop: 18 }}><strong style={{ color: NAVY }}>해석 기준</strong><p style={{ margin: '7px 0 0', color: '#64748b', lineHeight: 1.65 }}>100보다 높은 지표는 이번 달 대비 성장을, 100보다 낮은 지표는 보수적 목표 또는 비용 효율 중심의 운영을 의미합니다. 실제 집행 후 주간 단위로 기대 지수와 실적 편차를 점검합니다.</p></div>}
    </div>
  ))}</>;
}
