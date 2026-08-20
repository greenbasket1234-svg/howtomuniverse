import { useMemo, useState } from 'react';
import { Grid3X3, List, Search, X, Play } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { useMetricRows } from '../hooks/useMetrics';
import { useSortableRows } from '../hooks/useSortableRows';
import { ModalPortal } from '../components/ModalPortal';
import type { CreativeMetricRow, KeywordMetricRow } from '../types/metrics';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const won=(n:number)=>`₩${Math.round(n||0).toLocaleString()}`;
const channelLabel=(v:string)=>v==='meta'?'Meta':v==='naver'?'네이버':v;
const roasClass=(v:number)=>v>=200?'metric-positive':v>0&&v<100?'metric-negative':'';

type Kind='이미지'|'영상'|'키워드';
type Item = {
  key:string; kind:Kind; advertiserId:string; advertiserName?:string; channel:string;
  name:string; campaignName?:string; impressions:number; clicks:number; spend:number; dbCount:number;
  revenue?:number; roas?:number; thumbnailUrl?:string|null; videoUrl?:string|null;
  title?:string; body?:string; description?:string; cta?:string;
};

export function CreativeLibraryPage(){
  const {rows:creativeRows,meta,loading,error}=useMetricRows<CreativeMetricRow>('/metrics/creatives');
  const {rows:keywordRows,loading:kwLoading}=useMetricRows<KeywordMetricRow>('/metrics/keywords');
  const {filterValue}=useAdvertiserFilter();
  const [q,setQ]=useState('');
  const [channel,setChannel]=useState('all');
  const [kind,setKind]=useState<'전체'|Kind>('전체');
  const [advertiser,setAdvertiser]=useState('전체');
  const [view,setView]=useState<'grid'|'list'>('grid');
  const [selected,setSelected]=useState<Item|null>(null);

  const items:Item[]=useMemo(()=>[
    ...creativeRows.map((r):Item=>({
      key:`${r.channel}-${r.adId}`, kind:(r.mediaType==='video'?'영상':r.mediaType==='text'?'키워드':'이미지'), advertiserId:r.advertiserId, advertiserName:r.advertiserName, channel:r.channel,
      name:r.adName, campaignName:r.campaignName, impressions:r.impressions, clicks:r.clicks, spend:r.spend, dbCount:r.dbCount,
      revenue:r.revenue, roas:Number(r.roas||0), thumbnailUrl:r.thumbnailUrl, videoUrl:r.videoUrl,
      title:r.title, body:r.body, description:r.description, cta:r.cta,
    })),
    ...keywordRows.map((r):Item=>({
      key:`${r.channel}-kw-${r.keywordId||r.keyword}`, kind:'키워드', advertiserId:r.advertiserId, advertiserName:r.advertiserName, channel:r.channel,
      name:r.keyword, campaignName:r.campaignName, impressions:r.impressions, clicks:r.clicks, spend:r.spend, dbCount:r.dbCount,
      revenue:r.revenue, roas:Number(r.roas||0),
    })),
  ],[creativeRows,keywordRows]);

  const channels=useMemo(()=>['all',...new Set(items.map(r=>r.channel))],[items]);
  const advertisers=useMemo(()=>['전체',...new Set(items.map(r=>r.advertiserName||r.advertiserId).filter(Boolean))],[items]);
  const filteredRaw=useMemo(()=>items.filter(r=>
    matchesAdvertiserFilter(r.advertiserName||r.advertiserId,filterValue)
    &&(channel==='all'||r.channel===channel)
    &&(kind==='전체'||r.kind===kind)
    &&(advertiser==='전체'||(r.advertiserName||r.advertiserId)===advertiser)
    &&(`${r.name} ${r.campaignName||''} ${r.title||''} ${r.body||''}`).toLowerCase().includes(q.trim().toLowerCase())
  ),[items,filterValue,channel,kind,advertiser,q]);
  const {sorted:filtered,sortKey,toggleSort,arrow}=useSortableRows(filteredRaw,'spend',(r,k)=>k==='roas'?Number(r.roas||0):(r as any)[k]);
  const connections=meta?.connections||[];
  const connected=[...new Set(connections.filter(c=>c.status==='connected').map(c=>c.channel))];
  const unavailable=connections.filter(c=>c.status!=='connected');
  const isLoading=loading||kwLoading;
  const kindCount=(k:Kind)=>items.filter(r=>r.kind===k).length;

  return <div>
    <PageHeader title="소재 라이브러리" description="연결된 매체에서 수집한 실제 광고 소재·키워드와 선택 기간의 성과를 함께 봅니다." action={<div className="library-actions"><div className="ops-search compact"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="소재·캠페인·문구 검색"/></div><select value={channel} onChange={e=>setChannel(e.target.value)}>{channels.map(c=><option key={c} value={c}>{c==='all'?'전체 매체':channelLabel(c)}</option>)}</select><select value={advertiser} onChange={e=>setAdvertiser(e.target.value)}>{advertisers.map(a=><option key={a} value={a}>{a==='전체'?'전체 광고주':a}</option>)}</select><select value={sortKey} onChange={e=>toggleSort(e.target.value)} title="정렬 기준"><option value="spend">광고비순</option><option value="impressions">노출순</option><option value="clicks">클릭순</option><option value="dbCount">전환순</option><option value="roas">ROAS순</option></select><button className={view==='grid'?'icon-btn active':'icon-btn'} onClick={()=>setView('grid')} aria-label="카드 보기"><Grid3X3 size={17}/></button><button className={view==='list'?'icon-btn active':'icon-btn'} onClick={()=>setView('list')} aria-label="목록 보기"><List size={17}/></button></div>}/>
    <MetricsDateBar/>
    <div className="media-type-toggle" style={{marginBottom:12}}>
      {(['전체','이미지','영상','키워드'] as const).map(k=><button key={k} className={kind===k?'active':''} onClick={()=>setKind(k)}>{k}{k!=='전체'&&` (${kindCount(k as Kind)})`}</button>)}
    </div>
    <div className="status-banner neutral" style={{marginBottom:12}}>{connected.length?`실제 성과 연동: ${connected.map(channelLabel).join(', ')}`:'연동된 소재 성과 매체가 없습니다.'}{unavailable.length?` · ${unavailable.map(c=>`${channelLabel(c.channel)} ${c.status==='connector_unimplemented'?'커넥터 미구현':c.status==='error'?'수집 오류':'미연동'}`).join(' / ')}`:''}</div>
    {error&&<div className="status-banner danger">{error}</div>}
    {isLoading?<div className="card empty-state">소재 데이터를 불러오는 중입니다.</div>:filtered.length===0?<div className="card empty-state"><div className="empty-state-title">선택 기간에 소재 데이터가 없습니다.</div><div>매체 연결 및 동기화 상태를 확인해주세요. 연결되지 않은 매체는 0으로 표시하지 않습니다.</div></div>:view==='grid'?<div className="library-grid-compact actual-creative-grid">{filtered.map((r,i)=><article key={r.key} className="library-card" onClick={()=>setSelected(r)}><div className="library-thumb-square">
      {r.kind==='키워드'?<span style={{fontSize:20}}>🔑</span>:r.thumbnailUrl?<img src={r.thumbnailUrl} alt={r.name}/>:<span>소재</span>}
      {r.kind==='영상'&&<span style={{position:'absolute',bottom:6,right:6,background:'rgba(0,0,0,.6)',color:'#fff',borderRadius:999,padding:'3px 6px',display:'flex',alignItems:'center'}}><Play size={11} fill="#fff"/></span>}
      {i<3&&<span className={`home-rank-badge r${i+1}`} style={{position:'absolute',top:6,left:6}}>{i+1}</span>}
    </div><div className="library-body"><div className="library-meta"><span>● {r.advertiserName||r.advertiserId}</span><b>{channelLabel(r.channel)}</b></div><h3>{r.name}</h3><p>{r.campaignName||'캠페인 정보 없음'}</p><hr/><small>노출 {r.impressions.toLocaleString()} · 클릭 {r.clicks.toLocaleString()} · 전환 {r.dbCount.toLocaleString()}</small><small className="metric-emphasis">광고비 {won(r.spend)} · ROAS <span className={roasClass(Number(r.roas||0))}>{r.spend?`${Number(r.roas||0).toFixed(0)}%`:'-'}</span></small></div></article>)}</div>:<section className="card"><div className="table-scroll"><table className="data-table"><thead><tr>
      <th>소재</th><th>종류</th><th>매체</th><th>광고주</th><th>캠페인</th>
      <th className="num sortable-th" onClick={()=>toggleSort('spend')}>광고비{arrow('spend')}</th>
      <th className="num sortable-th" onClick={()=>toggleSort('impressions')}>노출{arrow('impressions')}</th>
      <th className="num sortable-th" onClick={()=>toggleSort('clicks')}>클릭{arrow('clicks')}</th>
      <th className="num sortable-th" onClick={()=>toggleSort('dbCount')}>전환{arrow('dbCount')}</th>
      <th className="num sortable-th" onClick={()=>toggleSort('roas')}>ROAS{arrow('roas')}</th>
    </tr></thead><tbody>{filtered.map(r=><tr key={r.key} onClick={()=>setSelected(r)} style={{cursor:'pointer'}}><td><b>{r.name}</b></td><td>{r.kind}</td><td>{channelLabel(r.channel)}</td><td>{r.advertiserName||r.advertiserId}</td><td>{r.campaignName||'-'}</td><td className="num metric-emphasis">{won(r.spend)}</td><td className="num">{r.impressions.toLocaleString()}</td><td className="num">{r.clicks.toLocaleString()}</td><td className="num"><b>{r.dbCount.toLocaleString()}</b></td><td className={`num ${roasClass(Number(r.roas||0))}`}>{r.spend?`${Number(r.roas||0).toFixed(0)}%`:'-'}</td></tr>)}</tbody></table></div></section>}
    {selected&&<ModalPortal onClose={()=>setSelected(null)} wide>
      <div className="modal-head"><div><h3>{selected.name}</h3><p>{selected.advertiserName||selected.advertiserId} · {channelLabel(selected.channel)} · {selected.campaignName||'-'}</p></div><button className="icon-btn" onClick={()=>setSelected(null)}><X size={18}/></button></div>
      {selected.videoUrl
        ? <video className="creative-detail-preview" src={selected.videoUrl} poster={selected.thumbnailUrl||undefined} controls style={{width:'100%',maxHeight:400,background:'#000',borderRadius:10}}/>
        : selected.thumbnailUrl&&<img className="creative-detail-preview" src={selected.thumbnailUrl} alt={selected.name}/>}
      {selected.kind!=='키워드'&&(selected.title||selected.body||selected.description||selected.cta)&&(
        <div style={{margin:'14px 0',padding:12,background:'#f8fafc',borderRadius:10}}>
          {selected.title&&<div style={{marginBottom:6}}><small className="muted">제목</small><div style={{fontWeight:700}}>{selected.title}</div></div>}
          {selected.body&&<div style={{marginBottom:6}}><small className="muted">광고 문구(설명란)</small><div style={{whiteSpace:'pre-wrap'}}>{selected.body}</div></div>}
          {selected.description&&<div style={{marginBottom:6}}><small className="muted">보조 설명</small><div style={{whiteSpace:'pre-wrap'}}>{selected.description}</div></div>}
          {selected.cta&&<div><small className="muted">CTA 버튼</small> <b>{selected.cta}</b></div>}
        </div>
      )}
      <div className="detail-kpi-grid"><div><span>광고비</span><b>{won(selected.spend)}</b></div><div><span>노출</span><b>{selected.impressions.toLocaleString()}</b></div><div><span>클릭</span><b>{selected.clicks.toLocaleString()}</b></div><div><span>전환</span><b>{selected.dbCount.toLocaleString()}</b></div><div><span>매출</span><b>{won(selected.revenue||0)}</b></div><div><span>ROAS</span><b className={roasClass(Number(selected.roas||0))}>{selected.spend?`${Number(selected.roas||0).toFixed(0)}%`:'-'}</b></div></div>
    </ModalPortal>}
  </div>;
}
