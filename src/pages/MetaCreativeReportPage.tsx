import { useMemo, useState } from 'react';
import { ExternalLink, Search, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { useMetricRows } from '../hooks/useMetrics';
import type { CreativeMetricRow } from '../types/metrics';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const won=(n:number)=>`₩${Math.round(n||0).toLocaleString()}`;
type SortKey='spend'|'impressions'|'clicks'|'ctr'|'cpc'|'cpm'|'dbCount'|'revenue'|'cpa'|'roas';

export function MetaCreativeReportPage(){
  const {rows,meta,loading,error}=useMetricRows<CreativeMetricRow>('/metrics/creatives');
  const [query,setQuery]=useState('');const [channel,setChannel]=useState('all');const [sortKey,setSortKey]=useState<SortKey>('spend');const [sortDir,setSortDir]=useState<'desc'|'asc'>('desc');const [detail,setDetail]=useState<CreativeMetricRow|null>(null);
  const {filterValue}=useAdvertiserFilter();
  const channels=useMemo(()=>['all',...new Set(rows.map(r=>r.channel))],[rows]);
  const filtered=useMemo(()=>[...rows].filter(r=>matchesAdvertiserFilter(r.advertiserName||r.advertiserId,filterValue)&&(channel==='all'||r.channel===channel)&&(`${r.adName} ${r.campaignName||''} ${r.advertiserName||''}`).toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>{const av=Number(a[sortKey]||0),bv=Number(b[sortKey]||0);return sortDir==='desc'?bv-av:av-bv}),[rows,filterValue,channel,query,sortKey,sortDir]);
  const toggleSort=(k:SortKey)=>{if(k===sortKey)setSortDir(v=>v==='desc'?'asc':'desc');else{setSortKey(k);setSortDir('desc')}};
  const arrow=(k:SortKey)=>sortKey===k?(sortDir==='desc'?' ▼':' ▲'):'';
  const connected=meta?.connections?.filter(c=>c.status==='connected')||[];const unimplemented=meta?.connections?.filter(c=>c.status==='connector_unimplemented')||[];
  return <>
    <PageHeader title="소재 성과" description="Meta·네이버 등 연결된 매체의 실제 소재 일별 성과를 선택 기간으로 집계합니다." action={<a className="btn secondary" href="https://adsmanager.facebook.com/adsmanager/manage/campaigns" target="_blank" rel="noreferrer">Meta 광고 관리자 <ExternalLink size={14}/></a>}/>
    <MetricsDateBar/>
    <section className="card media-report-card">
      <div className="media-report-toolbar"><div><b>실제 소재 {filtered.length}개</b><small className="footnote">{connected.length?`연동: ${[...new Set(connected.map(c=>c.channel))].join(', ')}`:'연동된 성과 매체 없음'}{unimplemented.length?` · 커넥터 미구현: ${[...new Set(unimplemented.map(c=>c.channel))].join(', ')}`:''}</small></div><div className="media-report-actions"><select value={channel} onChange={e=>setChannel(e.target.value)}>{channels.map(c=><option value={c} key={c}>{c==='all'?'전체 매체':c==='meta'?'Meta':c==='naver'?'네이버':c}</option>)}</select><div className="campaign-search-box"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="소재·캠페인 검색"/></div></div></div>
      {error&&<div className="status-banner danger">{error}</div>}
      <div className="table-scroll"><table className="media-report-table creative-report-table"><thead><tr><th>소재</th><th>매체</th><th>광고주</th><th onClick={()=>toggleSort('spend')}>광고비{arrow('spend')}</th><th onClick={()=>toggleSort('impressions')}>노출{arrow('impressions')}</th><th onClick={()=>toggleSort('clicks')}>클릭{arrow('clicks')}</th><th onClick={()=>toggleSort('ctr')}>CTR{arrow('ctr')}</th><th onClick={()=>toggleSort('cpc')}>CPC{arrow('cpc')}</th><th onClick={()=>toggleSort('cpm')}>CPM{arrow('cpm')}</th><th onClick={()=>toggleSort('dbCount')}>전환{arrow('dbCount')}</th><th>CVR</th><th onClick={()=>toggleSort('revenue')}>전환매출{arrow('revenue')}</th><th onClick={()=>toggleSort('cpa')}>CPA{arrow('cpa')}</th><th onClick={()=>toggleSort('roas')}>ROAS{arrow('roas')}</th></tr></thead><tbody>
        {loading?<tr><td colSpan={14} className="empty-cell">불러오는 중...</td></tr>:filtered.length===0?<tr><td colSpan={14} className="empty-cell">선택 기간에 소재 성과가 없습니다. 매체 연결·동기화 상태를 확인해주세요.</td></tr>:filtered.map(r=><tr key={`${r.advertiserId}-${r.channel}-${r.adId}`}><td><button className="creative-name-cell" onClick={()=>setDetail(r)}>{r.thumbnailUrl?<img className="creative-thumb" src={r.thumbnailUrl} alt=""/>:<span className="creative-thumb"/>}<span><b>{r.adName}</b><small>{r.campaignName||'-'}</small></span></button></td><td>{r.channel==='meta'?'Meta':r.channel==='naver'?'네이버':r.channel}</td><td>{r.advertiserName||r.advertiserId}</td><td>{won(r.spend)}</td><td>{r.impressions.toLocaleString()}</td><td>{r.clicks.toLocaleString()}</td><td>{Number(r.ctr||0).toFixed(2)}%</td><td>{won(r.cpc||0)}</td><td>{won(r.cpm||0)}</td><td>{r.dbCount.toLocaleString()}</td><td>{Number(r.cvr||0).toFixed(2)}%</td><td>{won(r.revenue)}</td><td>{r.dbCount?won(r.cpa||0):'-'}</td><td>{r.spend?`${Number(r.roas||0).toFixed(0)}%`:'-'}</td></tr>)}
      </tbody></table></div>
    </section>
    {detail&&<div className="modal-backdrop" onClick={()=>setDetail(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>{detail.adName}</h3><p>{detail.advertiserName} · {detail.campaignName}</p></div><button className="icon-btn" onClick={()=>setDetail(null)}><X size={18}/></button></div>{detail.thumbnailUrl&&<img className="creative-detail-preview" src={detail.thumbnailUrl} alt=""/>}<div className="detail-kpi-grid"><div><span>광고비</span><b>{won(detail.spend)}</b></div><div><span>노출</span><b>{detail.impressions.toLocaleString()}</b></div><div><span>클릭</span><b>{detail.clicks.toLocaleString()}</b></div><div><span>전환</span><b>{detail.dbCount.toLocaleString()}</b></div><div><span>매출</span><b>{won(detail.revenue)}</b></div><div><span>ROAS</span><b>{Number(detail.roas||0).toFixed(0)}%</b></div></div></div></div>}
  </>;
}
