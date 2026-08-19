import { useMemo, useState } from 'react';
import { Grid3X3, List, Search, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { useMetricRows } from '../hooks/useMetrics';
import { useSortableRows } from '../hooks/useSortableRows';
import type { CreativeMetricRow } from '../types/metrics';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const won=(n:number)=>`₩${Math.round(n||0).toLocaleString()}`;
const channelLabel=(v:string)=>v==='meta'?'Meta':v==='naver'?'네이버':v;
const roasClass=(v:number)=>v>=200?'metric-positive':v>0&&v<100?'metric-negative':'';

export function CreativeLibraryPage(){
  const {rows,meta,loading,error}=useMetricRows<CreativeMetricRow>('/metrics/creatives');
  const {filterValue}=useAdvertiserFilter();
  const [q,setQ]=useState('');
  const [channel,setChannel]=useState('all');
  const [view,setView]=useState<'grid'|'list'>('grid');
  const [selected,setSelected]=useState<CreativeMetricRow|null>(null);
  const channels=useMemo(()=>['all',...new Set(rows.map(r=>r.channel))],[rows]);
  const filteredRaw=useMemo(()=>rows.filter(r=>
    matchesAdvertiserFilter(r.advertiserName||r.advertiserId,filterValue)
    &&(channel==='all'||r.channel===channel)
    &&(`${r.adName} ${r.campaignName||''} ${r.title||''} ${r.body||''}`).toLowerCase().includes(q.trim().toLowerCase())
  ),[rows,filterValue,channel,q]);
  const {sorted:filtered,sortKey,toggleSort,arrow}=useSortableRows(filteredRaw,'spend',(r,k)=>k==='roas'?Number(r.roas||0):(r as any)[k]);
  const connections=meta?.connections||[];
  const connected=[...new Set(connections.filter(c=>c.status==='connected').map(c=>c.channel))];
  const unavailable=connections.filter(c=>c.status!=='connected');
  return <div>
    <PageHeader title="소재 라이브러리" description="연결된 매체에서 수집한 실제 광고 소재와 선택 기간의 성과를 함께 봅니다." action={<div className="library-actions"><div className="ops-search compact"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="소재·캠페인 검색"/></div><select value={channel} onChange={e=>setChannel(e.target.value)}>{channels.map(c=><option key={c} value={c}>{c==='all'?'전체 매체':channelLabel(c)}</option>)}</select><select value={sortKey} onChange={e=>toggleSort(e.target.value)} title="정렬 기준"><option value="spend">광고비순</option><option value="impressions">노출순</option><option value="clicks">클릭순</option><option value="dbCount">전환순</option><option value="roas">ROAS순</option></select><button className={view==='grid'?'icon-btn active':'icon-btn'} onClick={()=>setView('grid')} aria-label="카드 보기"><Grid3X3 size={17}/></button><button className={view==='list'?'icon-btn active':'icon-btn'} onClick={()=>setView('list')} aria-label="목록 보기"><List size={17}/></button></div>}/>
    <MetricsDateBar/>
    <div className="status-banner neutral" style={{marginBottom:12}}>{connected.length?`실제 성과 연동: ${connected.map(channelLabel).join(', ')}`:'연동된 소재 성과 매체가 없습니다.'}{unavailable.length?` · ${unavailable.map(c=>`${channelLabel(c.channel)} ${c.status==='connector_unimplemented'?'커넥터 미구현':c.status==='error'?'수집 오류':'미연동'}`).join(' / ')}`:''}</div>
    {error&&<div className="status-banner danger">{error}</div>}
    {loading?<div className="card empty-state">소재 데이터를 불러오는 중입니다.</div>:filtered.length===0?<div className="card empty-state"><div className="empty-state-title">선택 기간에 소재 데이터가 없습니다.</div><div>매체 연결 및 동기화 상태를 확인해주세요. 연결되지 않은 매체는 0으로 표시하지 않습니다.</div></div>:view==='grid'?<div className="library-grid-compact actual-creative-grid">{filtered.map((r,i)=><article key={`${r.advertiserId}-${r.channel}-${r.adId}`} className="library-card" onClick={()=>setSelected(r)}><div className="library-thumb-square">{r.thumbnailUrl?<img src={r.thumbnailUrl} alt={r.adName}/>:<span>소재</span>}{i<3&&<span className={`home-rank-badge r${i+1}`} style={{position:'absolute',top:6,left:6}}>{i+1}</span>}</div><div className="library-body"><div className="library-meta"><span>● {r.advertiserName||r.advertiserId}</span><b>{channelLabel(r.channel)}</b></div><h3>{r.adName}</h3><p>{r.campaignName||'캠페인 정보 없음'}</p><hr/><small>노출 {r.impressions.toLocaleString()} · 클릭 {r.clicks.toLocaleString()} · 전환 {r.dbCount.toLocaleString()}</small><small className="metric-emphasis">광고비 {won(r.spend)} · ROAS <span className={roasClass(Number(r.roas||0))}>{r.spend?`${Number(r.roas||0).toFixed(0)}%`:'-'}</span></small></div></article>)}</div>:<section className="card"><div className="table-scroll"><table className="data-table"><thead><tr>
      <th>소재</th><th>매체</th><th>광고주</th><th>캠페인</th>
      <th className="num sortable-th" onClick={()=>toggleSort('spend')}>광고비{arrow('spend')}</th>
      <th className="num sortable-th" onClick={()=>toggleSort('impressions')}>노출{arrow('impressions')}</th>
      <th className="num sortable-th" onClick={()=>toggleSort('clicks')}>클릭{arrow('clicks')}</th>
      <th className="num sortable-th" onClick={()=>toggleSort('dbCount')}>전환{arrow('dbCount')}</th>
      <th className="num sortable-th" onClick={()=>toggleSort('roas')}>ROAS{arrow('roas')}</th>
    </tr></thead><tbody>{filtered.map(r=><tr key={`${r.advertiserId}-${r.channel}-${r.adId}`} onClick={()=>setSelected(r)} style={{cursor:'pointer'}}><td><b>{r.adName}</b></td><td>{channelLabel(r.channel)}</td><td>{r.advertiserName||r.advertiserId}</td><td>{r.campaignName||'-'}</td><td className="num metric-emphasis">{won(r.spend)}</td><td className="num">{r.impressions.toLocaleString()}</td><td className="num">{r.clicks.toLocaleString()}</td><td className="num"><b>{r.dbCount.toLocaleString()}</b></td><td className={`num ${roasClass(Number(r.roas||0))}`}>{r.spend?`${Number(r.roas||0).toFixed(0)}%`:'-'}</td></tr>)}</tbody></table></div></section>}
    {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="modal-card wide" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>{selected.adName}</h3><p>{selected.advertiserName||selected.advertiserId} · {channelLabel(selected.channel)} · {selected.campaignName||'-'}</p></div><button className="icon-btn" onClick={()=>setSelected(null)}><X size={18}/></button></div>{selected.thumbnailUrl&&<img className="creative-detail-preview" src={selected.thumbnailUrl} alt={selected.adName}/>}<div className="detail-kpi-grid"><div><span>광고비</span><b>{won(selected.spend)}</b></div><div><span>노출</span><b>{selected.impressions.toLocaleString()}</b></div><div><span>클릭</span><b>{selected.clicks.toLocaleString()}</b></div><div><span>CTR</span><b>{Number(selected.ctr||0).toFixed(2)}%</b></div><div><span>전환</span><b>{selected.dbCount.toLocaleString()}</b></div><div><span>CPA</span><b>{selected.dbCount?won(selected.cpa||0):'-'}</b></div><div><span>매출</span><b>{won(selected.revenue)}</b></div><div><span>ROAS</span><b className={roasClass(Number(selected.roas||0))}>{selected.spend?`${Number(selected.roas||0).toFixed(0)}%`:'-'}</b></div></div></div></div>}
  </div>;
}
