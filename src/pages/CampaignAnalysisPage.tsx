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
  // 고성과: ROAS 200%↑ 또는(매출 미추적 시) 전환 확보 + CTR 1%↑. 저성과: 광고비는 썼는데 전환이 0건이거나 ROAS 100% 미만.
  const highPerf=useMemo(()=>visible.filter(r=>r.spend>0&&((Number(r.roas||0)>=200&&r.revenue>0)||(!r.revenue&&Number(r.ctr||0)>=1&&r.dbCount>0))).sort((a,b)=>r_score(b)-r_score(a)).slice(0,8),[visible]);
  const lowPerf=useMemo(()=>visible.filter(r=>r.spend>0&&(r.dbCount===0||(r.revenue>0&&Number(r.roas||0)<100))).sort((a,b)=>b.spend-a.spend).slice(0,8),[visible]);
  function r_score(r:CampaignMetricRow){return r.revenue>0?Number(r.roas||0):Number(r.ctr||0)*100;}
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
    <aside className="card campaign-live-detail">{current?<><div className="panel-title"><BarChart3 size={18}/><div><h3>{current.advertiserName} {current.campaignName}</h3><p><ChannelTag channel={current.channel}/></p></div></div><div className="detail-kpi-grid"><div><span>광고비</span><b>{won(current.spend)}</b></div><div><span>클릭</span><b>{current.clicks.toLocaleString()}</b></div><div><span>전환</span><b>{current.dbCount.toLocaleString()}</b></div><div><span>ROAS</span><b>{Number(current.roas||0).toFixed(0)}%</b></div></div><h4>일별 광고비 추이</h4><div className="daily-bar-chart">{series.map(r=><div key={r.date} title={`${r.date} ${won(r.spend)}`}><i style={{height:`${Math.max(2,r.spend/maxSpend*100)}%`}}/><small>{r.date.slice(5)}</small></div>)}</div></>:<div className="empty-cell">캠페인을 선택하세요.</div>}</aside></section>
    <div className="keyword-analysis-cards">
      <div className="card"><div className="card-title">고성과 캠페인</div>{highPerf.length?highPerf.map(r=><p key={`${r.advertiserId}-${r.channel}-${r.campaignId}`} className="analysis-item" onClick={()=>setSelected(r.campaignId)} style={{cursor:'pointer'}}><span className="badge badge-success">{r.advertiserName} {r.campaignName}</span> {r.revenue>0?`ROAS ${Number(r.roas||0).toFixed(0)}%`:`CTR ${Number(r.ctr||0).toFixed(2)}%`} · 전환 {r.dbCount}건</p>):<p className="muted-text">선택 기간에 뚜렷한 고성과 캠페인이 없습니다.</p>}</div>
      <div className="card"><div className="card-title">저성과 캠페인</div>{lowPerf.length?lowPerf.map(r=><p key={`${r.advertiserId}-${r.channel}-${r.campaignId}`} className="analysis-item" onClick={()=>setSelected(r.campaignId)} style={{cursor:'pointer'}}><span className="badge badge-danger">{r.advertiserName} {r.campaignName}</span> 광고비 {won(r.spend)} · 전환 {r.dbCount}건{r.revenue>0?` · ROAS ${Number(r.roas||0).toFixed(0)}%`:''}</p>):<p className="muted-text">선택 기간에 뚜렷한 저성과 캠페인이 없습니다.</p>}</div>
    </div>
    <div className="footnote">고성과·저성과는 선택하신 기간의 실제 매체 성과 기준입니다. 항목을 클릭하면 위 표에서 바로 확인할 수 있습니다.</div>
  </>;
}
