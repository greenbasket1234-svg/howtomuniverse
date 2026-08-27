import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useMetricRows } from '../hooks/useMetrics';
import { useSortableRows } from '../hooks/useSortableRows';
import type { DailyMetricRow } from '../types/metrics';
import { derived, formatMetric, performanceDatasetFromMetricRows, sumRows } from '../analytics/integratedPerformance';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { ChannelTag } from '../components/ChannelTag';

const mediaLabel=(c:string)=>c==='meta'?'Meta':c==='naver'?'네이버':c;
const roasClass=(v:number)=>v>=200?'metric-positive':v>0&&v<100?'metric-negative':'';
export function IntegratedPerformanceAnalysisPage(){
  const {rows,meta,loading,error}=useMetricRows<DailyMetricRow>('/metrics/daily');const {filterValue}=useAdvertiserFilter();
  const visible=useMemo(()=>rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||r.advertiserId,filterValue)),[rows,filterValue]);const data=useMemo(()=>performanceDatasetFromMetricRows(visible),[visible]);const total=derived(sumRows(data.totals));
  const mediaRaw=useMemo(()=>[...new Set(visible.map(r=>r.channel))].map(channel=>{const r=visible.filter(x=>x.channel===channel);const s=r.reduce((a,x)=>({spend:a.spend+x.spend,impressions:a.impressions+x.impressions,clicks:a.clicks+x.clicks,dbCount:a.dbCount+x.dbCount,purchases:a.purchases+x.purchases,revenue:a.revenue+x.revenue}),{spend:0,impressions:0,clicks:0,dbCount:0,purchases:0,revenue:0});return{channel,...s,ctr:s.impressions?s.clicks/s.impressions*100:0,cpa:(s.dbCount+s.purchases)?s.spend/(s.dbCount+s.purchases):0,roas:s.spend?s.revenue/s.spend*100:0}}),[visible]);
  const advertisersRaw=useMemo(()=>[...new Set(visible.map(r=>r.advertiserId))].map(id=>{const r=visible.filter(x=>x.advertiserId===id);const s=r.reduce((a,x)=>({spend:a.spend+x.spend,impressions:a.impressions+x.impressions,clicks:a.clicks+x.clicks,dbCount:a.dbCount+x.dbCount,purchases:a.purchases+(x.purchases||0),revenue:a.revenue+x.revenue}),{spend:0,impressions:0,clicks:0,dbCount:0,purchases:0,revenue:0});return{id,name:r[0]?.advertiserName||id,...s,cpa:(s.dbCount+s.purchases)?s.spend/(s.dbCount+s.purchases):0,roas:s.spend?s.revenue/s.spend*100:0}}),[visible]);
  const mediaSort=useSortableRows(mediaRaw,'spend',(r,k)=>(r as any)[k]);
  const advSort=useSortableRows(advertisersRaw,'spend',(r,k)=>(r as any)[k]);
  const media=mediaSort.sorted, advertisers=advSort.sorted;
  return <>
    <PageHeader title="통합 성과 분석" description="저장 보고서나 샘플 데이터가 아니라 중앙 Metrics API의 실제 매체 데이터만 사용합니다."/>
    <MetricsDateBar/>
    {error&&<div className="status-banner danger">{error}</div>}
    <section className="kpi-card-grid live-kpi-grid"><article><span>광고비</span><strong>{formatMetric('spend',total.spend)}</strong></article><article><span>노출</span><strong>{total.impressions.toLocaleString()}</strong></article><article><span>클릭</span><strong>{total.clicks.toLocaleString()}</strong></article><article><span>CTR</span><strong>{total.ctr.toFixed(2)}%</strong></article><article><span>전환(DB)</span><strong>{total.leads.toLocaleString()}</strong></article><article><span>CPA</span><strong>{formatMetric('cpa',total.cpa)}</strong></article><article><span>매출</span><strong>{formatMetric('revenue',total.revenue)}</strong></article><article><span>ROAS</span><strong className={roasClass(total.roas)}>{total.roas.toFixed(0)}%</strong></article></section>
    <section className="insight-live-grid"><article className="card"><h3>매체별 성과</h3><div className="table-scroll"><table className="ops-table"><thead><tr>
      <th className="sortable-th" onClick={()=>mediaSort.toggleSort('channel')}>매체{mediaSort.arrow('channel')}</th>
      <th className="sortable-th" onClick={()=>mediaSort.toggleSort('spend')}>광고비{mediaSort.arrow('spend')}</th>
      <th className="sortable-th" onClick={()=>mediaSort.toggleSort('impressions')}>노출{mediaSort.arrow('impressions')}</th>
      <th className="sortable-th" onClick={()=>mediaSort.toggleSort('clicks')}>클릭{mediaSort.arrow('clicks')}</th>
      <th className="sortable-th" onClick={()=>mediaSort.toggleSort('ctr')}>CTR{mediaSort.arrow('ctr')}</th>
      <th className="sortable-th" onClick={()=>mediaSort.toggleSort('dbCount')}>전환{mediaSort.arrow('dbCount')}</th>
      <th className="sortable-th" onClick={()=>mediaSort.toggleSort('cpa')}>CPA{mediaSort.arrow('cpa')}</th>
      <th className="sortable-th" onClick={()=>mediaSort.toggleSort('revenue')}>매출{mediaSort.arrow('revenue')}</th>
      <th className="sortable-th" onClick={()=>mediaSort.toggleSort('roas')}>ROAS{mediaSort.arrow('roas')}</th>
    </tr></thead><tbody>{loading?<tr><td colSpan={9} className="empty-cell">불러오는 중...</td></tr>:media.length?media.map(r=><tr key={r.channel}><td><ChannelTag channel={r.channel}/></td><td className="metric-emphasis">{formatMetric('spend',r.spend)}</td><td>{r.impressions.toLocaleString()}</td><td>{r.clicks.toLocaleString()}</td><td>{r.ctr.toFixed(2)}%</td><td><b>{r.dbCount.toLocaleString()}</b>{r.purchases>0&&<small style={{display:'block',color:'var(--text-muted)'}}>구매 {r.purchases.toLocaleString()}</small>}</td><td>{(r.dbCount+r.purchases)?formatMetric('cpa',r.cpa):'-'}</td><td>{formatMetric('revenue',r.revenue)}</td><td className={roasClass(r.roas)}>{r.spend?`${r.roas.toFixed(0)}%`:'-'}</td></tr>):<tr><td colSpan={9} className="empty-cell">선택 기간에 실제 매체 데이터가 없습니다.</td></tr>}</tbody></table></div></article>
    <article className="card"><h3>광고주별 성과</h3><div className="table-scroll"><table className="ops-table"><thead><tr>
      <th className="sortable-th" onClick={()=>advSort.toggleSort('name')}>광고주{advSort.arrow('name')}</th>
      <th className="sortable-th" onClick={()=>advSort.toggleSort('spend')}>광고비{advSort.arrow('spend')}</th>
      <th className="sortable-th" onClick={()=>advSort.toggleSort('clicks')}>클릭{advSort.arrow('clicks')}</th>
      <th className="sortable-th" onClick={()=>advSort.toggleSort('dbCount')}>전환{advSort.arrow('dbCount')}</th>
      <th className="sortable-th" onClick={()=>advSort.toggleSort('cpa')}>CPA{advSort.arrow('cpa')}</th>
      <th className="sortable-th" onClick={()=>advSort.toggleSort('revenue')}>매출{advSort.arrow('revenue')}</th>
      <th className="sortable-th" onClick={()=>advSort.toggleSort('roas')}>ROAS{advSort.arrow('roas')}</th>
    </tr></thead><tbody>{advertisers.length?advertisers.map(r=><tr key={r.id}><td><b>{r.name}</b></td><td className="metric-emphasis">{formatMetric('spend',r.spend)}</td><td>{r.clicks.toLocaleString()}</td><td><b>{r.dbCount.toLocaleString()}</b>{r.purchases>0&&<small style={{display:'block',color:'var(--text-muted)'}}>구매 {r.purchases.toLocaleString()}</small>}</td><td>{(r.dbCount+r.purchases)?formatMetric('cpa',r.cpa):'-'}</td><td>{formatMetric('revenue',r.revenue)}</td><td className={roasClass(r.roas)}>{r.spend?`${r.roas.toFixed(0)}%`:'-'}</td></tr>):<tr><td colSpan={7} className="empty-cell">광고주 데이터가 없습니다.</td></tr>}</tbody></table></div></article></section>
    <div className="footnote">데이터 기준: {meta?.from||'-'} ~ {meta?.to||'-'} · 마지막 응답 {meta?.generatedAt?new Date(meta.generatedAt).toLocaleString('ko-KR'):'-'}</div>
  </>;
}
