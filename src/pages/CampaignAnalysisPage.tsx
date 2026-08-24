import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useMetricsQuery } from '../context/MetricsQueryContext';
import { apiFetch } from '../hooks/useApi';
import { metricQuery } from '../hooks/useMetrics';
import type { CampaignDailyMetricRow, CampaignMetricRow, MetricsMeta } from '../types/metrics';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { useSortableRows } from '../hooks/useSortableRows';

import { ChannelTag } from '../components/ChannelTag';

const won=(n:number)=>`₩${Math.round(n||0).toLocaleString()}`;
export function CampaignAnalysisPage(){
  const {range}=useMetricsQuery();const {filterValue}=useAdvertiserFilter();const [rows,setRows]=useState<CampaignMetricRow[]>([]);const [daily,setDaily]=useState<CampaignDailyMetricRow[]>([]);const [meta,setMeta]=useState<MetricsMeta|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [query,setQuery]=useState('');const [channel,setChannel]=useState('all');const [selected,setSelected]=useState('');
  useEffect(()=>{let alive=true;setLoading(true);setError('');apiFetch<{rows:CampaignMetricRow[];dailyRows:CampaignDailyMetricRow[];meta:MetricsMeta}>(`/metrics/campaigns?${metricQuery(range)}`).then(r=>{if(!alive)return;setRows(r.rows||[]);setDaily(r.dailyRows||[]);setMeta(r.meta);}).catch(e=>alive&&setError(e instanceof Error?e.message:String(e))).finally(()=>alive&&setLoading(false));return()=>{alive=false}},[range.from,range.to]);
  const channels=useMemo(()=>['all',...new Set(rows.map(r=>r.channel))],[rows]);
  const visible=useMemo(()=>rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||r.advertiserId,filterValue)&&(channel==='all'||r.channel===channel)&&(`${r.campaignName} ${r.advertiserName||''}`).toLowerCase().includes(query.toLowerCase())),[rows,filterValue,channel,query]);
  const {sorted,toggleSort,arrow}=useSortableRows(visible,'spend',(r,k)=>k==='roas'?Number(r.roas||0):k==='ctr'?Number(r.ctr||0):k==='cpa'?Number(r.cpa||0):(r as any)[k]);
  const current=visible.find(r=>r.campaignId===selected)||visible[0];
  const series=useMemo(()=>current?daily.filter(r=>r.campaignId===current.campaignId&&r.advertiserId===current.advertiserId&&r.channel===current.channel).sort((a,b)=>a.date.localeCompare(b.date)):[],[daily,current]);
  const maxSpend=Math.max(1,...series.map(r=>r.spend));
  const connected=meta?.connections?.filter(c=>c.status==='connected')||[];
  return <>
    <PageHeader title="캠페인 분석" description="계정 성과를 캠페인 성과로 추정하지 않고, 매체 API의 실제 campaign_id 일별 Stats만 사용합니다."/>
    <MetricsDateBar/>
    <section className="card metrics-toolbar"><div><b>캠페인 {visible.length}개</b><small>{connected.length?`마지막 동기화 ${(()=>{const x=connected.map(c=>c.lastSyncedAt).filter(Boolean).sort();return x.length?x[x.length-1]:'-'})()}`:'연결된 매체 없음'}</small></div><div className="media-report-actions"><select value={channel} onChange={e=>setChannel(e.target.value)}>{channels.map(c=><option key={c} value={c}>{c==='all'?'전체 매체':c==='meta'?'Meta':c==='naver'?'네이버':c}</option>)}</select><div className="campaign-search-box"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="캠페인 검색"/></div></div></section>
    {error&&<div className="status-banner danger">{error}</div>}
    <section className="campaign-live-grid"><article className="card"><div className="table-scroll"><table className="ops-table"><thead><tr>
      <th className="sortable-th" onClick={()=>toggleSort('campaignName')}>캠페인{arrow('campaignName')}</th>
      <th>매체</th>
      <th className="sortable-th" onClick={()=>toggleSort('advertiserName')}>광고주{arrow('advertiserName')}</th>
      <th className="sortable-th" onClick={()=>toggleSort('spend')}>광고비{arrow('spend')}</th>
      <th className="sortable-th" onClick={()=>toggleSort('impressions')}>노출{arrow('impressions')}</th>
      <th className="sortable-th" onClick={()=>toggleSort('clicks')}>클릭{arrow('clicks')}</th>
      <th className="sortable-th" onClick={()=>toggleSort('ctr')}>CTR{arrow('ctr')}</th>
      <th className="sortable-th" onClick={()=>toggleSort('dbCount')}>전환{arrow('dbCount')}</th>
      <th className="sortable-th" onClick={()=>toggleSort('cpa')}>CPA{arrow('cpa')}</th>
      <th className="sortable-th" onClick={()=>toggleSort('revenue')}>매출{arrow('revenue')}</th>
      <th className="sortable-th" onClick={()=>toggleSort('roas')}>ROAS{arrow('roas')}</th>
    </tr></thead><tbody>{loading?<tr><td colSpan={11} className="empty-cell">불러오는 중...</td></tr>:sorted.length===0?<tr><td colSpan={11} className="empty-cell">선택 기간에 실제 캠페인 성과가 없습니다.</td></tr>:sorted.map(r=><tr key={`${r.advertiserId}-${r.channel}-${r.campaignId}`} className={current?.campaignId===r.campaignId?'selected-row':''} onClick={()=>setSelected(r.campaignId)}><td><b>{r.campaignName}</b><small>{r.campaignId}</small></td><td><ChannelTag channel={r.channel}/></td><td>{r.advertiserName}</td><td className="metric-emphasis">{won(r.spend)}</td><td>{r.impressions.toLocaleString()}</td><td>{r.clicks.toLocaleString()}</td><td>{Number(r.ctr||0).toFixed(2)}%</td><td><b>{r.dbCount.toLocaleString()}</b></td><td>{r.dbCount?won(r.cpa||0):'-'}</td><td>{won(r.revenue)}</td><td className={Number(r.roas||0)>=200?'metric-positive':Number(r.roas||0)>0&&Number(r.roas||0)<100?'metric-negative':''}>{r.spend?`${Number(r.roas||0).toFixed(0)}%`:'-'}</td></tr>)}</tbody></table></div></article>
    <aside className="card campaign-live-detail">{current?<><div className="panel-title"><BarChart3 size={18}/><div><h3>{current.campaignName}</h3><p>{current.advertiserName} · {current.channel}</p></div></div><div className="detail-kpi-grid"><div><span>광고비</span><b>{won(current.spend)}</b></div><div><span>클릭</span><b>{current.clicks.toLocaleString()}</b></div><div><span>전환</span><b>{current.dbCount.toLocaleString()}</b></div><div><span>ROAS</span><b>{Number(current.roas||0).toFixed(0)}%</b></div></div><h4>일별 광고비 추이</h4><div className="daily-bar-chart">{series.map(r=><div key={r.date} title={`${r.date} ${won(r.spend)}`}><i style={{height:`${Math.max(2,r.spend/maxSpend*100)}%`}}/><small>{r.date.slice(5)}</small></div>)}</div></>:<div className="empty-cell">캠페인을 선택하세요.</div>}</aside></section>
  </>;
}
