import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useMetricRows } from '../hooks/useMetrics';
import type { DailyMetricRow } from '../types/metrics';
import { derived, formatMetric, performanceDatasetFromMetricRows, sumRows } from '../analytics/integratedPerformance';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const mediaLabel=(c:string)=>c==='meta'?'Meta':c==='naver'?'네이버':c;
export function IntegratedPerformanceAnalysisPage(){
  const {rows,meta,loading,error}=useMetricRows<DailyMetricRow>('/metrics/daily');const {filterValue}=useAdvertiserFilter();
  const visible=useMemo(()=>rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||r.advertiserId,filterValue)),[rows,filterValue]);const data=useMemo(()=>performanceDatasetFromMetricRows(visible),[visible]);const total=derived(sumRows(data.totals));
  const media=useMemo(()=>[...new Set(visible.map(r=>r.channel))].map(channel=>{const r=visible.filter(x=>x.channel===channel);const s=r.reduce((a,x)=>({spend:a.spend+x.spend,impressions:a.impressions+x.impressions,clicks:a.clicks+x.clicks,dbCount:a.dbCount+x.dbCount,purchases:a.purchases+x.purchases,revenue:a.revenue+x.revenue}),{spend:0,impressions:0,clicks:0,dbCount:0,purchases:0,revenue:0});return{channel,...s,ctr:s.impressions?s.clicks/s.impressions*100:0,cpa:s.dbCount?s.spend/s.dbCount:0,roas:s.spend?s.revenue/s.spend*100:0}}).sort((a,b)=>b.spend-a.spend),[visible]);
  const advertisers=useMemo(()=>[...new Set(visible.map(r=>r.advertiserId))].map(id=>{const r=visible.filter(x=>x.advertiserId===id);const s=r.reduce((a,x)=>({spend:a.spend+x.spend,impressions:a.impressions+x.impressions,clicks:a.clicks+x.clicks,dbCount:a.dbCount+x.dbCount,revenue:a.revenue+x.revenue}),{spend:0,impressions:0,clicks:0,dbCount:0,revenue:0});return{id,name:r[0]?.advertiserName||id,...s,cpa:s.dbCount?s.spend/s.dbCount:0,roas:s.spend?s.revenue/s.spend*100:0}}).sort((a,b)=>b.spend-a.spend),[visible]);
  return <>
    <PageHeader title="통합 성과 분석" description="저장 보고서나 샘플 데이터가 아니라 중앙 Metrics API의 실제 매체 데이터만 사용합니다."/>
    <MetricsDateBar/>
    {error&&<div className="status-banner danger">{error}</div>}
    <section className="kpi-card-grid live-kpi-grid"><article><span>광고비</span><strong>{formatMetric('spend',total.spend)}</strong></article><article><span>노출</span><strong>{total.impressions.toLocaleString()}</strong></article><article><span>클릭</span><strong>{total.clicks.toLocaleString()}</strong></article><article><span>CTR</span><strong>{total.ctr.toFixed(2)}%</strong></article><article><span>전환(DB)</span><strong>{total.leads.toLocaleString()}</strong></article><article><span>CPA</span><strong>{formatMetric('cpa',total.cpa)}</strong></article><article><span>매출</span><strong>{formatMetric('revenue',total.revenue)}</strong></article><article><span>ROAS</span><strong>{total.roas.toFixed(0)}%</strong></article></section>
    <section className="insight-live-grid"><article className="card"><h3>매체별 성과</h3><div className="table-scroll"><table className="ops-table"><thead><tr><th>매체</th><th>광고비</th><th>노출</th><th>클릭</th><th>CTR</th><th>전환</th><th>CPA</th><th>매출</th><th>ROAS</th></tr></thead><tbody>{loading?<tr><td colSpan={9} className="empty-cell">불러오는 중...</td></tr>:media.length?media.map(r=><tr key={r.channel}><td><b>{mediaLabel(r.channel)}</b></td><td>{formatMetric('spend',r.spend)}</td><td>{r.impressions.toLocaleString()}</td><td>{r.clicks.toLocaleString()}</td><td>{r.ctr.toFixed(2)}%</td><td>{r.dbCount.toLocaleString()}</td><td>{r.dbCount?formatMetric('cpa',r.cpa):'-'}</td><td>{formatMetric('revenue',r.revenue)}</td><td>{r.spend?`${r.roas.toFixed(0)}%`:'-'}</td></tr>):<tr><td colSpan={9} className="empty-cell">선택 기간에 실제 매체 데이터가 없습니다.</td></tr>}</tbody></table></div></article>
    <article className="card"><h3>광고주별 성과</h3><div className="table-scroll"><table className="ops-table"><thead><tr><th>광고주</th><th>광고비</th><th>클릭</th><th>전환</th><th>CPA</th><th>매출</th><th>ROAS</th></tr></thead><tbody>{advertisers.length?advertisers.map(r=><tr key={r.id}><td><b>{r.name}</b></td><td>{formatMetric('spend',r.spend)}</td><td>{r.clicks.toLocaleString()}</td><td>{r.dbCount.toLocaleString()}</td><td>{r.dbCount?formatMetric('cpa',r.cpa):'-'}</td><td>{formatMetric('revenue',r.revenue)}</td><td>{r.spend?`${r.roas.toFixed(0)}%`:'-'}</td></tr>):<tr><td colSpan={7} className="empty-cell">광고주 데이터가 없습니다.</td></tr>}</tbody></table></div></article></section>
    <div className="footnote">데이터 기준: {meta?.from||'-'} ~ {meta?.to||'-'} · 마지막 응답 {meta?.generatedAt?new Date(meta.generatedAt).toLocaleString('ko-KR'):'-'}</div>
  </>;
}
