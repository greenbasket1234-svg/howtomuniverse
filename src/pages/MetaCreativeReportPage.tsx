import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { useMetricsQuery } from '../context/MetricsQueryContext';
import { useMetricRows } from '../hooks/useMetrics';
import type { CreativeMetricRow } from '../types/metrics';
import { ModalPortal } from '../components/ModalPortal';
import { ChannelTag } from '../components/ChannelTag';
import { apiFetch } from '../hooks/useApi';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const won=(n:number)=>`₩${Math.round(n||0).toLocaleString()}`;
type SortKey='spend'|'impressions'|'clicks'|'ctr'|'cpc'|'cpm'|'dbCount'|'revenue'|'cpa'|'roas';
const kindOf=(r:CreativeMetricRow)=>r.mediaType==='video'?'영상':r.mediaType==='carousel'?'슬라이드':r.mediaType==='text'?'키워드':'이미지';
const roasClass=(v:number)=>v>=200?'metric-positive':v>0&&v<100?'metric-negative':'';

export function MetaCreativeReportPage(){
  const {rows,meta,loading,error}=useMetricRows<CreativeMetricRow>('/metrics/creatives');
  const [query,setQuery]=useState('');const [channel,setChannel]=useState('all');const [kind,setKind]=useState<'전체'|'이미지'|'영상'|'키워드'>('전체');const [sortKey,setSortKey]=useState<SortKey>('spend');const [sortDir,setSortDir]=useState<'desc'|'asc'>('desc');const [detail,setDetail]=useState<CreativeMetricRow|null>(null);
  const [previewUrl,setPreviewUrl]=useState<string|null>(null);
  const [previewLoading,setPreviewLoading]=useState(false);
  useEffect(()=>{
    setPreviewUrl(null);
    if(detail&&(kindOf(detail)==='영상'||kindOf(detail)==='슬라이드')&&detail.channel==='meta'&&detail.adId){
      setPreviewLoading(true);
      apiFetch<{previewUrl:string|null}>(`/creative-preview?adId=${encodeURIComponent(detail.adId)}`)
        .then(r=>setPreviewUrl(r.previewUrl)).catch(()=>setPreviewUrl(null)).finally(()=>setPreviewLoading(false));
    }
  },[detail?.adId]);
  const {filterValue}=useAdvertiserFilter();
  const {range}=useMetricsQuery();
  const rangeDays=useMemo(()=>{const from=new Date(range.from),to=new Date(range.to);return Math.round((to.getTime()-from.getTime())/86400000)+1;},[range.from,range.to]);
  const channels=useMemo(()=>['all',...new Set(rows.map(r=>r.channel))],[rows]);
  const filtered=useMemo(()=>[...rows].filter(r=>matchesAdvertiserFilter(r.advertiserName||r.advertiserId,filterValue)&&(channel==='all'||r.channel===channel)&&(kind==='전체'||kindOf(r)===kind)&&(`${r.adName} ${r.campaignName||''} ${r.advertiserName||''}`).toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>{const av=sortKey==='dbCount'?a.dbCount+(a.purchases||0):Number(a[sortKey]||0),bv=sortKey==='dbCount'?b.dbCount+(b.purchases||0):Number(b[sortKey]||0);return sortDir==='desc'?bv-av:av-bv}),[rows,filterValue,channel,kind,query,sortKey,sortDir]);
  const toggleSort=(k:SortKey)=>{if(k===sortKey)setSortDir(v=>v==='desc'?'asc':'desc');else{setSortKey(k);setSortDir('desc')}};
  const arrow=(k:SortKey)=>sortKey===k?(sortDir==='desc'?' ▼':' ▲'):'';
  const connected=meta?.connections?.filter(c=>c.status==='connected')||[];const unimplemented=meta?.connections?.filter(c=>c.status==='connector_unimplemented')||[];
  const kindCount=(k:'이미지'|'영상'|'키워드')=>rows.filter(r=>kindOf(r)===k).length;
  return <>
    <PageHeader title="소재 성과" description="Meta·네이버 등 연결된 매체의 실제 소재 일별 성과를 선택 기간으로 집계합니다." action={<a className="btn secondary" href="https://adsmanager.facebook.com/adsmanager/manage/campaigns" target="_blank" rel="noreferrer">Meta 광고 관리자 <ExternalLink size={14}/></a>}/>
    <MetricsDateBar/>
    {rangeDays>90&&<div className="card" style={{color:'#a35b00',background:'#fff7e6',borderColor:'#ffe4b3',marginBottom:12,padding:'10px 14px',fontSize:13}}>선택하신 기간이 90일을 넘어서, 소재(광고) 단위 데이터는 <b>최근 90일까지만</b> 집계됩니다(소재 수가 많으면 수집 시간이 오래 걸려 성능상 제한). 캠페인 분석·통합 홈의 합계와 다를 수 있어요.</div>}
    <div className="media-type-toggle" style={{marginBottom:12}}>
      {(['전체','이미지','영상','키워드'] as const).map(k=><button key={k} className={kind===k?'active':''} onClick={()=>setKind(k)}>{k}{k!=='전체'&&` (${kindCount(k)})`}</button>)}
    </div>
    <section className="card media-report-card">
      <div className="media-report-toolbar"><div><b>실제 소재 {filtered.length}개</b><small className="footnote">{connected.length?`연동: ${[...new Set(connected.map(c=>c.channel))].join(', ')}`:'연동된 성과 매체 없음'}{unimplemented.length?` · 커넥터 미구현: ${[...new Set(unimplemented.map(c=>c.channel))].join(', ')}`:''}</small></div><div className="media-report-actions"><select value={channel} onChange={e=>setChannel(e.target.value)}>{channels.map(c=><option value={c} key={c}>{c==='all'?'전체 매체':c==='meta'?'Meta':c==='naver'?'네이버':c}</option>)}</select><div className="campaign-search-box"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="소재·캠페인 검색"/></div></div></div>
      {error&&<div className="status-banner danger">{error}</div>}
      <div className="table-scroll"><table className="media-report-table creative-report-table"><thead><tr><th>소재</th><th>유형</th><th>매체</th><th>광고주</th><th onClick={()=>toggleSort('spend')}>광고비{arrow('spend')}</th><th onClick={()=>toggleSort('impressions')}>노출{arrow('impressions')}</th><th onClick={()=>toggleSort('clicks')}>클릭{arrow('clicks')}</th><th onClick={()=>toggleSort('ctr')}>CTR{arrow('ctr')}</th><th onClick={()=>toggleSort('cpc')}>CPC{arrow('cpc')}</th><th onClick={()=>toggleSort('cpm')}>CPM{arrow('cpm')}</th><th onClick={()=>toggleSort('dbCount')}>전환{arrow('dbCount')}</th><th>CVR</th><th onClick={()=>toggleSort('revenue')}>전환매출{arrow('revenue')}</th><th onClick={()=>toggleSort('cpa')}>CPA{arrow('cpa')}</th><th onClick={()=>toggleSort('roas')}>ROAS{arrow('roas')}</th></tr></thead><tbody>
        {loading?<tr><td colSpan={15} className="empty-cell">불러오는 중...</td></tr>:filtered.length===0?<tr><td colSpan={15} className="empty-cell">선택 기간에 소재 성과가 없습니다. 매체 연결·동기화 상태를 확인해주세요.</td></tr>:filtered.map(r=><tr key={`${r.advertiserId}-${r.channel}-${r.adId}`}><td><button className="creative-name-cell" onClick={()=>setDetail(r)}>{r.thumbnailUrl?<img className="creative-thumb" src={r.thumbnailUrl} alt=""/>:<span className="creative-thumb"/>}<span><b>{r.adName}</b><small>{r.campaignName||'-'}</small></span></button></td><td>{kindOf(r)}</td><td><ChannelTag channel={r.channel}/></td><td>{r.advertiserName||r.advertiserId}</td><td className="metric-emphasis">{won(r.spend)}</td><td>{r.impressions.toLocaleString()}</td><td>{r.clicks.toLocaleString()}</td><td>{Number(r.ctr||0).toFixed(2)}%</td><td>{won(r.cpc||0)}</td><td>{won(r.cpm||0)}</td><td><b>{(r.dbCount+(r.purchases||0)).toLocaleString()}</b>{(r.dbCount>0||(r.purchases||0)>0)&&<small style={{display:'block',color:'var(--text-muted)'}}>{[r.dbCount>0&&`DB ${r.dbCount.toLocaleString()}`,(r.purchases||0)>0&&`구매 ${r.purchases.toLocaleString()}`].filter(Boolean).join(' · ')}</small>}</td><td>{Number(r.cvr||0).toFixed(2)}%</td><td>{won(r.revenue)}</td><td>{(r.dbCount+(r.purchases||0))?won(r.cpa||0):'-'}</td><td className={roasClass(Number(r.roas||0))}>{r.spend?`${Number(r.roas||0).toFixed(0)}%`:'-'}</td></tr>)}
      </tbody></table></div>
    </section>
    {detail&&<ModalPortal onClose={()=>setDetail(null)} wide>
      <div className="modal-head"><div><h3>{detail.adName}</h3><p style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>{detail.advertiserName} · <ChannelTag channel={detail.channel}/> · {detail.campaignName||'-'}</p></div><button className="icon-btn" onClick={()=>setDetail(null)}><X size={18}/></button></div>
      {(kindOf(detail)==='영상'||kindOf(detail)==='슬라이드')&&previewLoading
        ? <div className="creative-detail-preview" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:280,background:'#f1f5f9',borderRadius:10,color:'#64748b'}}>미리보기 불러오는 중...</div>
        : previewUrl
          ? <iframe title="광고 미리보기" src={previewUrl} className="creative-detail-preview" style={{width:'100%',height:400,border:0,borderRadius:10,background:'#000'}}/>
          : detail.videoUrl
            ? <video className="creative-detail-preview" src={detail.videoUrl} poster={detail.thumbnailUrl||undefined} controls style={{width:'100%',maxHeight:400,background:'#000',borderRadius:10}}/>
            : detail.mediaType==='carousel'&&detail.carouselImages?.length
              ? <div style={{display:'flex',gap:8,overflowX:'auto',padding:'4px 2px'}}>
                  {detail.carouselImages.map((url,i)=><div key={i} style={{flex:'0 0 auto',width:200}}>
                    <img src={url} alt={`${detail.adName} 슬라이드 ${i+1}`} style={{width:200,height:200,objectFit:'cover',borderRadius:10,background:'#f1f5f9'}}/>
                    <div style={{textAlign:'center',fontSize:12,color:'#64748b',marginTop:4}}>{i+1}/{detail.carouselImages!.length}</div>
                  </div>)}
                </div>
              : detail.thumbnailUrl&&<img className="creative-detail-preview" src={detail.thumbnailUrl} alt=""/>}
      {kindOf(detail)!=='키워드'&&(detail.title||detail.body||detail.description||detail.cta)&&(
        <div style={{margin:'14px 0',padding:12,background:'#f8fafc',borderRadius:10}}>
          {detail.title&&<div style={{marginBottom:6}}><small className="muted">제목</small><div style={{fontWeight:700}}>{detail.title}</div></div>}
          {detail.body&&<div style={{marginBottom:6}}><small className="muted">광고 문구(설명란)</small><div style={{whiteSpace:'pre-wrap'}}>{detail.body}</div></div>}
          {detail.description&&<div style={{marginBottom:6}}><small className="muted">보조 설명</small><div style={{whiteSpace:'pre-wrap'}}>{detail.description}</div></div>}
          {detail.cta&&<div><small className="muted">CTA 버튼</small> <b>{detail.cta}</b></div>}
        </div>
      )}
      <div className="detail-kpi-grid"><div><span>광고비</span><b>{won(detail.spend)}</b></div><div><span>노출</span><b>{detail.impressions.toLocaleString()}</b></div><div><span>클릭</span><b>{detail.clicks.toLocaleString()}</b></div><div><span>전환</span><b>{(detail.dbCount+(detail.purchases||0)).toLocaleString()}</b></div><div><span>매출</span><b>{won(detail.revenue)}</b></div><div><span>ROAS</span><b className={roasClass(Number(detail.roas||0))}>{Number(detail.roas||0).toFixed(0)}%</b></div></div>
    </ModalPortal>}
  </>;
}
