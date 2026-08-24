import { useEffect, useMemo, useRef, useState } from 'react';
import { Grid3X3, List, Search, X, Play } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { useMetricRows } from '../hooks/useMetrics';
import { useSortableRows } from '../hooks/useSortableRows';
import { ModalPortal } from '../components/ModalPortal';
import { ChannelTag } from '../components/ChannelTag';
import { apiFetch } from '../hooks/useApi';
import type { CreativeMetricRow, KeywordMetricRow } from '../types/metrics';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const won=(n:number)=>`₩${Math.round(n||0).toLocaleString()}`;
const channelLabel=(v:string)=>v==='meta'?'Meta':v==='naver'?'네이버':v;
const roasClass=(v:number)=>v>=200?'metric-positive':v>0&&v<100?'metric-negative':'';

// 슬라이드 소재는 정지된 대표 이미지 한 장 대신, 카드 안에서 실제로 카드들이 자동으로
// 넘어가는 미리보기를 보여줍니다. IntersectionObserver로 화면에 보이는 카드만 타이머를
// 돌려서, 소재가 많아도 화면 밖 카드까지 다 애니메이션이 도는 부담을 줄입니다.
function SlideThumb({images,name}:{images:string[];name:string}){
  const [idx,setIdx]=useState(0);
  const [visible,setVisible]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const el=ref.current; if(!el) return;
    const io=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{threshold:0.2});
    io.observe(el);
    return ()=>io.disconnect();
  },[]);
  useEffect(()=>{
    if(!visible||images.length<2) return;
    const t=setInterval(()=>setIdx(i=>(i+1)%images.length),1800);
    return ()=>clearInterval(t);
  },[visible,images.length]);
  return <div ref={ref} className="library-thumb-square library-thumb-slide">
    {images.map((url,i)=><img key={url} src={url} alt={`${name} ${i+1}`} style={{opacity:i===idx?1:0}}/>)}
    <div className="library-slide-dots">{images.map((_,i)=><span key={i} className={i===idx?'active':''}/>)}</div>
  </div>;
}

// 영상 소재도 정지된 썸네일+재생 아이콘 대신, 카드 안에서 바로 재생되는 미리보기로 보여줍니다.
// 실제 원본 영상 소스가 없는 경우(매체 권한 등으로)는 정지 썸네일로 자연스럽게 폴백합니다.
function VideoThumb({videoUrl,posterUrl,name}:{videoUrl:string;posterUrl?:string|null;name:string}){
  const [visible,setVisible]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  useEffect(()=>{
    const el=ref.current; if(!el) return;
    const io=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{threshold:0.2});
    io.observe(el);
    return ()=>io.disconnect();
  },[]);
  useEffect(()=>{
    const v=videoRef.current; if(!v) return;
    if(visible) v.play().catch(()=>{}); else v.pause();
  },[visible]);
  return <div ref={ref} className="library-thumb-square library-thumb-video">
    <video ref={videoRef} src={videoUrl} poster={posterUrl||undefined} muted loop playsInline preload="metadata" aria-label={name}/>
  </div>;
}

// 카드마다 API를 부르면 화면 밖 카드까지 다 요청이 나가 느려지므로, 같은 adId는 한 번만
// 불러오도록 모듈 스코프에 캐시합니다. 탭을 옮겨 다시 들어와도 재요청하지 않습니다.
const previewCache = new Map<string, string | null>();

// 슬라이드·영상 소재는 원본 파일(videoUrl)이나 수집된 캐러셀 이미지가 없을 때가 많아, 모달에서
// 쓰던 "실제 미리보기"(Meta 광고 미리보기 API, 재생·슬라이드 넘김이 되는 iframe)를 카드 썸네일
// 자리에 그대로 가져와 보여줍니다. 화면에 보이는 카드만 IntersectionObserver로 걸러서 호출합니다.
function ApiPreviewThumb({adId,posterUrl,name}:{adId:string;posterUrl?:string|null;name:string}){
  const [previewUrl,setPreviewUrl]=useState<string|null|undefined>(previewCache.get(adId));
  const [visible,setVisible]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const el=ref.current; if(!el) return;
    const io=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{threshold:0.2});
    io.observe(el);
    return ()=>io.disconnect();
  },[]);
  useEffect(()=>{
    if(!visible||previewCache.has(adId)) return;
    apiFetch<{previewUrl:string|null}>(`/creative-preview?adId=${encodeURIComponent(adId)}`)
      .then(r=>{previewCache.set(adId,r.previewUrl);setPreviewUrl(r.previewUrl)})
      .catch(()=>{previewCache.set(adId,null);setPreviewUrl(null)});
  },[visible,adId]);
  return <div ref={ref} className="library-thumb-square library-thumb-apipreview">
    {previewUrl
      ? <iframe title={name} src={previewUrl} loading="lazy"/>
      : previewUrl===null&&posterUrl
        ? <img src={posterUrl} alt={name}/>
        : previewUrl===null
          ? <span>소재</span>
          : <span className="library-thumb-loading">불러오는 중...</span>}
  </div>;
}

type Kind='이미지'|'영상'|'슬라이드'|'키워드';
type Item = {
  key:string; kind:Kind; advertiserId:string; advertiserName?:string; channel:string; adId?:string;
  name:string; campaignName?:string; impressions:number; clicks:number; spend:number; dbCount:number;
  revenue?:number; roas?:number; thumbnailUrl?:string|null; videoUrl?:string|null; carouselImages?:string[]|null;
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
  const [previewUrl,setPreviewUrl]=useState<string|null>(null);
  const [previewLoading,setPreviewLoading]=useState(false);
  useEffect(()=>{
    setPreviewUrl(null);
    // 원본 영상 파일(source)은 매체 권한에 따라 막힐 수 있어, Meta가 직접 제공하는 재생 가능한
    // 광고 미리보기(iframe)를 그 소재를 열 때만 불러옵니다.
    if((selected?.kind==='영상'||selected?.kind==='슬라이드')&&selected.channel==='meta'&&selected.adId){
      setPreviewLoading(true);
      apiFetch<{previewUrl:string|null}>(`/creative-preview?adId=${encodeURIComponent(selected.adId)}`)
        .then(r=>setPreviewUrl(r.previewUrl))
        .catch(()=>setPreviewUrl(null))
        .finally(()=>setPreviewLoading(false));
    }
  },[selected?.key]);

  const items:Item[]=useMemo(()=>[
    ...creativeRows.map((r):Item=>({
      key:`${r.channel}-${r.adId}`, kind:(r.mediaType==='video'?'영상':r.mediaType==='carousel'?'슬라이드':r.mediaType==='text'?'키워드':'이미지'), advertiserId:r.advertiserId, advertiserName:r.advertiserName, channel:r.channel, adId:r.adId,
      name:r.adName, campaignName:r.campaignName, impressions:r.impressions, clicks:r.clicks, spend:r.spend, dbCount:r.dbCount,
      revenue:r.revenue, roas:Number(r.roas||0), thumbnailUrl:r.thumbnailUrl, videoUrl:r.videoUrl, carouselImages:r.carouselImages,
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
      {(['전체','이미지','영상','슬라이드','키워드'] as const).map(k=><button key={k} className={kind===k?'active':''} onClick={()=>setKind(k)}>{k}{k!=='전체'&&` (${kindCount(k as Kind)})`}</button>)}
    </div>
    <div className="status-banner neutral" style={{marginBottom:12}}>{connected.length?`실제 성과 연동: ${connected.map(channelLabel).join(', ')}`:'연동된 소재 성과 매체가 없습니다.'}{unavailable.length?` · ${unavailable.map(c=>`${channelLabel(c.channel)} ${c.status==='connector_unimplemented'?'커넥터 미구현':c.status==='error'?'수집 오류':'미연동'}`).join(' / ')}`:''}</div>
    {error&&<div className="status-banner danger">{error}</div>}
    {isLoading?<div className="card empty-state">소재 데이터를 불러오는 중입니다.</div>:filtered.length===0?<div className="card empty-state"><div className="empty-state-title">선택 기간에 소재 데이터가 없습니다.</div><div>매체 연결 및 동기화 상태를 확인해주세요. 연결되지 않은 매체는 0으로 표시하지 않습니다.</div></div>:view==='grid'?<div className="library-grid-compact actual-creative-grid">{filtered.map((r,i)=><article key={r.key} className="library-card" style={{position:'relative'}} onClick={()=>setSelected(r)}>
      {r.kind==='영상'
        ? (r.videoUrl
            ? <VideoThumb videoUrl={r.videoUrl} posterUrl={r.thumbnailUrl} name={r.name}/>
            : r.channel==='meta'&&r.adId
              ? <ApiPreviewThumb adId={r.adId} posterUrl={r.thumbnailUrl} name={r.name}/>
              : <div className="library-thumb-square">{r.thumbnailUrl?<img src={r.thumbnailUrl} alt={r.name}/>:<span>소재</span>}<span style={{position:'absolute',bottom:6,right:6,background:'rgba(0,0,0,.6)',color:'#fff',borderRadius:999,padding:'3px 6px',display:'flex',alignItems:'center'}}><Play size={11} fill="#fff"/></span></div>)
        : r.kind==='슬라이드'
          ? (r.carouselImages&&r.carouselImages.length>1
              ? <SlideThumb images={r.carouselImages} name={r.name}/>
              : r.channel==='meta'&&r.adId
                ? <ApiPreviewThumb adId={r.adId} posterUrl={r.thumbnailUrl} name={r.name}/>
                : <div className="library-thumb-square">{r.thumbnailUrl?<img src={r.thumbnailUrl} alt={r.name}/>:<span>소재</span>}<span style={{position:'absolute',bottom:6,right:6,background:'rgba(0,0,0,.6)',color:'#fff',borderRadius:999,padding:'3px 8px',fontSize:11,fontWeight:700}}>슬라이드</span></div>)
          : <div className="library-thumb-square">
              {r.kind==='키워드'?<span style={{fontSize:20}}>🔑</span>:r.thumbnailUrl?<img src={r.thumbnailUrl} alt={r.name}/>:<span>소재</span>}
            </div>}
      {i<3&&<span className={`home-rank-badge r${i+1}`} style={{position:'absolute',top:6,left:6,zIndex:2}}>{i+1}</span>}
      <div className="library-body"><div className="library-meta"><span>● {r.advertiserName||r.advertiserId}</span><ChannelTag channel={r.channel}/></div><h3>{r.name}</h3><p>{r.campaignName||'캠페인 정보 없음'}</p><hr/><small>노출 {r.impressions.toLocaleString()} · 클릭 {r.clicks.toLocaleString()} · 전환 {r.dbCount.toLocaleString()}</small><small className="metric-emphasis">광고비 {won(r.spend)} · ROAS <span className={roasClass(Number(r.roas||0))}>{r.spend?`${Number(r.roas||0).toFixed(0)}%`:'-'}</span></small></div></article>)}</div>:<section className="card"><div className="table-scroll"><table className="data-table"><thead><tr>
      <th>소재</th><th>종류</th><th>매체</th><th>광고주</th><th>캠페인</th>
      <th className="num sortable-th" onClick={()=>toggleSort('spend')}>광고비{arrow('spend')}</th>
      <th className="num sortable-th" onClick={()=>toggleSort('impressions')}>노출{arrow('impressions')}</th>
      <th className="num sortable-th" onClick={()=>toggleSort('clicks')}>클릭{arrow('clicks')}</th>
      <th className="num sortable-th" onClick={()=>toggleSort('dbCount')}>전환{arrow('dbCount')}</th>
      <th className="num sortable-th" onClick={()=>toggleSort('roas')}>ROAS{arrow('roas')}</th>
    </tr></thead><tbody>{filtered.map(r=><tr key={r.key} onClick={()=>setSelected(r)} style={{cursor:'pointer'}}><td><b>{r.name}</b></td><td>{r.kind}</td><td><ChannelTag channel={r.channel}/></td><td>{r.advertiserName||r.advertiserId}</td><td>{r.campaignName||'-'}</td><td className="num metric-emphasis">{won(r.spend)}</td><td className="num">{r.impressions.toLocaleString()}</td><td className="num">{r.clicks.toLocaleString()}</td><td className="num"><b>{r.dbCount.toLocaleString()}</b></td><td className={`num ${roasClass(Number(r.roas||0))}`}>{r.spend?`${Number(r.roas||0).toFixed(0)}%`:'-'}</td></tr>)}</tbody></table></div></section>}
    {selected&&<ModalPortal onClose={()=>setSelected(null)} wide>
      <div className="modal-head"><div><h3>{selected.name}</h3><p style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>{selected.advertiserName||selected.advertiserId} · <ChannelTag channel={selected.channel}/> · {selected.campaignName||'-'}</p></div><button className="icon-btn" onClick={()=>setSelected(null)}><X size={18}/></button></div>
      {(selected.kind==='영상'||selected.kind==='슬라이드')&&previewLoading
        ? <div className="creative-detail-preview" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:280,background:'#f1f5f9',borderRadius:10,color:'#64748b'}}>미리보기 불러오는 중...</div>
        : previewUrl
          ? <iframe title="광고 미리보기" src={previewUrl} className="creative-detail-preview" style={{width:'100%',height:400,border:0,borderRadius:10,background:'#000'}}/>
          : selected.videoUrl
            ? <video className="creative-detail-preview" src={selected.videoUrl} poster={selected.thumbnailUrl||undefined} controls style={{width:'100%',maxHeight:400,background:'#000',borderRadius:10}}/>
            : selected.kind==='슬라이드'&&selected.carouselImages?.length
              ? <div style={{display:'flex',gap:8,overflowX:'auto',padding:'4px 2px'}}>
                  {selected.carouselImages.map((url,i)=><div key={i} style={{flex:'0 0 auto',width:200}}>
                    <img src={url} alt={`${selected.name} 슬라이드 ${i+1}`} style={{width:200,height:200,objectFit:'cover',borderRadius:10,background:'#f1f5f9'}}/>
                    <div style={{textAlign:'center',fontSize:12,color:'#64748b',marginTop:4}}>{i+1}/{selected.carouselImages!.length}</div>
                  </div>)}
                </div>
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
