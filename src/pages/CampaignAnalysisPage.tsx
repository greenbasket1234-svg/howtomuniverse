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
  const visible=useMemo(()=>rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||r.advertiserId,filterValue)&&(channel==='all'||r.channel===channel)&&(`${r.campaignName} ${r.advertiserName||''}`).toLowerCase().includes(query.toLowerCase())).map(r=>{
    const totalConversions=r.dbCount+(r.purchases||0);
    return {...r, totalConversions, ctr:r.impressions?r.clicks/r.impressions*100:0, cpa:totalConversions?r.spend/totalConversions:0, roas:r.spend?(r.revenue||0)/r.spend*100:0};
  }),[rows,filterValue,channel,query]);
  const {sorted,toggleSort,arrow}=useSortableRows(visible,'spend',(r,k)=>k==='roas'?Number(r.roas||0):k==='ctr'?Number(r.ctr||0):k==='cpa'?Number(r.cpa||0):(r as any)[k]);
  const rowKey=(r:CampaignMetricRow)=>`${r.advertiserId}-${r.channel}-${r.campaignId}`;
  const selectedRow=selected?visible.find(r=>rowKey(r)===selected):undefined;
  // 아무 캠페인도 선택하지 않았을 때는 임의로 첫 번째 캠페인만 보여주지 않고, 지금 필터된
  // 범위(광고주 필터·매체 필터·검색어 적용 후) 전체를 합산해서 보여줍니다.
  const aggregate=useMemo(()=>visible.reduce((a,r)=>({spend:a.spend+r.spend,clicks:a.clicks+r.clicks,dbCount:a.dbCount+r.dbCount,revenue:a.revenue+(r.revenue||0)}),{spend:0,clicks:0,dbCount:0,revenue:0}),[visible]);
  const aggregateRoas=aggregate.spend?aggregate.revenue/aggregate.spend*100:0;
  const visibleKeySet=useMemo(()=>new Set(visible.map(rowKey)),[visible]);
  const series=useMemo(()=>{
    if(selectedRow) return daily.filter(r=>rowKey(r)===rowKey(selectedRow)).sort((a,b)=>a.date.localeCompare(b.date));
    // 전체 보기일 때는 지금 필터된 캠페인들의 일별 데이터를 날짜별로 합산합니다.
    const byDate=new Map<string,number>();
    for(const r of daily){ if(!visibleKeySet.has(rowKey(r)))continue; byDate.set(r.date,(byDate.get(r.date)||0)+r.spend); }
    return [...byDate.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,spend])=>({date,spend}));
  },[daily,selectedRow,visibleKeySet]);
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
    </tr></thead><tbody>{loading?<tr><td colSpan={11} className="empty-cell">불러오는 중...</td></tr>:sorted.length===0?<tr><td colSpan={11} className="empty-cell">선택 기간에 실제 캠페인 성과가 없습니다.</td></tr>:sorted.map(r=><tr key={rowKey(r)} className={selected===rowKey(r)?'selected-row':''} onClick={()=>setSelected(selected===rowKey(r)?'':rowKey(r))}><td><b>{r.campaignName}</b><small>{r.campaignId}</small></td><td><ChannelTag channel={r.channel}/></td><td>{r.advertiserName}</td><td className="metric-emphasis">{won(r.spend)}</td><td>{r.impressions.toLocaleString()}</td><td>{r.clicks.toLocaleString()}</td><td>{Number(r.ctr||0).toFixed(2)}%</td><td><b>{(r.totalConversions??r.dbCount).toLocaleString()}</b>{(r.dbCount>0||(r.purchases||0)>0)&&<small style={{display:'block',color:'var(--text-muted)'}}>{[r.dbCount>0&&`DB ${r.dbCount.toLocaleString()}`,(r.purchases||0)>0&&`구매 ${r.purchases!.toLocaleString()}`].filter(Boolean).join(' · ')}</small>}</td><td>{r.totalConversions?won(r.cpa||0):'-'}</td><td>{won(r.revenue)}</td><td className={Number(r.roas||0)>=200?'metric-positive':Number(r.roas||0)>0&&Number(r.roas||0)<100?'metric-negative':''}>{r.spend?`${Number(r.roas||0).toFixed(0)}%`:'-'}</td></tr>)}</tbody></table></div></article>
    <aside className="card campaign-live-detail">
      <div className="panel-title"><BarChart3 size={18}/><div>{selectedRow?<><h3>{selectedRow.advertiserName}</h3><p className="panel-subtitle">{selectedRow.campaignName}</p></>:<><h3>전체 캠페인 합계</h3><p className="panel-subtitle">{visible.length}개 캠페인 · 지금 필터된 범위 기준{selectedRow?'':' (광고주를 선택하면 개별로 볼 수 있습니다)'}</p></>}</div></div>
      <div className="detail-kpi-grid">
        <div><span>광고비</span><b>{won(selectedRow?selectedRow.spend:aggregate.spend)}</b></div>
        <div><span>클릭</span><b>{(selectedRow?selectedRow.clicks:aggregate.clicks).toLocaleString()}</b></div>
        <div><span>전환</span><b>{(selectedRow?selectedRow.dbCount:aggregate.dbCount).toLocaleString()}</b></div>
        <div><span>ROAS</span><b>{(selectedRow?Number(selectedRow.roas||0):aggregateRoas).toFixed(0)}%</b></div>
      </div>
      <h4>일별 광고비 추이</h4>
      <div className="daily-bar-chart">{series.map(r=><div key={r.date} title={`${r.date} ${won(r.spend)}`}><i style={{height:`${Math.max(2,r.spend/maxSpend*100)}%`}}/><small>{r.date.slice(5)}</small></div>)}</div>
    </aside></section>
    <div className="keyword-analysis-cards">
      <div className="card"><div className="card-title">고성과 캠페인</div>{highPerf.length?highPerf.map(r=><p key={rowKey(r)} className="analysis-item analysis-item-high" onClick={()=>setSelected(rowKey(r))} style={{cursor:'pointer'}}><span className="analysis-name-block"><small className="analysis-advertiser">{r.advertiserName}</small><b className="analysis-target analysis-target-high">{r.campaignName}</b></span><span className="analysis-metrics">{r.revenue>0?`ROAS ${Number(r.roas||0).toFixed(0)}%`:`CTR ${Number(r.ctr||0).toFixed(2)}%`} · 전환 {r.dbCount}건</span></p>):<p className="muted-text">선택 기간에 뚜렷한 고성과 캠페인이 없습니다.</p>}</div>
      <div className="card"><div className="card-title">저성과 캠페인</div>{lowPerf.length?lowPerf.map(r=><p key={rowKey(r)} className="analysis-item analysis-item-low" onClick={()=>setSelected(rowKey(r))} style={{cursor:'pointer'}}><span className="analysis-name-block"><small className="analysis-advertiser">{r.advertiserName}</small><b className="analysis-target analysis-target-low">{r.campaignName}</b></span><span className="analysis-metrics">광고비 {won(r.spend)} · 전환 {r.dbCount}건{r.revenue>0?` · ROAS ${Number(r.roas||0).toFixed(0)}%`:''}</span></p>):<p className="muted-text">선택 기간에 뚜렷한 저성과 캠페인이 없습니다.</p>}</div>
    </div>
    <div className="footnote">고성과·저성과는 선택하신 기간의 실제 매체 성과 기준입니다. 항목을 클릭하면 위 표에서 바로 확인할 수 있습니다.</div>
  </>;
}
