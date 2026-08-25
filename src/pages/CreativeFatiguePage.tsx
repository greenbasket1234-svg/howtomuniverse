import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { useMetricsQuery } from '../context/MetricsQueryContext';
import { apiFetch } from '../hooks/useApi';
import { metricQuery } from '../hooks/useMetrics';
import type { CreativeDailyMetricRow, CreativeMetricRow, MetricsMeta } from '../types/metrics';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { ModalPortal } from '../components/ModalPortal';
import { ChannelTag } from '../components/ChannelTag';

type Response={rows:CreativeMetricRow[];dailyRows:CreativeDailyMetricRow[];meta:MetricsMeta};
type FatigueRow=CreativeMetricRow&{score:number;cpm3Change:number|null;cpm7Change:number|null;ctr7Change:number|null;cpc7Change:number|null;activeDays:number};
const pct=(a:number,b:number)=>b>0?(a-b)/b*100:null;
const won=(n:number)=>`₩${Math.round(n||0).toLocaleString()}`;
const kindOf=(r:CreativeMetricRow)=>r.mediaType==='video'?'영상':r.mediaType==='carousel'?'슬라이드':r.mediaType==='text'?'키워드':'이미지';
const roasClass=(v:number)=>v>=200?'metric-positive':v>0&&v<100?'metric-negative':'';
function aggregate(rows:CreativeDailyMetricRow[]){const x=rows.reduce((a,r)=>({impressions:a.impressions+r.impressions,clicks:a.clicks+r.clicks,spend:a.spend+r.spend}),{impressions:0,clicks:0,spend:0});return{...x,cpm:x.impressions?x.spend/x.impressions*1000:0,ctr:x.impressions?x.clicks/x.impressions*100:0,cpc:x.clicks?x.spend/x.clicks:0}}
function lastDates(rows:CreativeDailyMetricRow[],n:number,offset=0){const dates=[...new Set(rows.map(r=>r.date))].sort().reverse().slice(offset,offset+n);const s=new Set(dates);return rows.filter(r=>s.has(r.date))}
function fatigue(base:CreativeMetricRow, daily:CreativeDailyMetricRow[]):FatigueRow{const recent3=aggregate(lastDates(daily,3)),prev3=aggregate(lastDates(daily,3,3)),recent7=aggregate(lastDates(daily,7)),prev7=aggregate(lastDates(daily,7,7));const cpm3=pct(recent3.cpm,prev3.cpm),cpm7=pct(recent7.cpm,prev7.cpm),ctr=pct(recent7.ctr,prev7.ctr),cpc=pct(recent7.cpc,prev7.cpc);let score=0;if((cpm3||0)>=50)score+=25;else if((cpm3||0)>=25)score+=12;if((cpm7||0)>=30)score+=25;else if((cpm7||0)>=15)score+=12;if((ctr||0)<=-20)score+=25;else if((ctr||0)<=-10)score+=12;if((cpc||0)>=30)score+=20;else if((cpc||0)>=15)score+=10;const activeDays=new Set(daily.filter(r=>r.impressions>0||r.spend>0).map(r=>r.date)).size;if(activeDays>=21)score+=5;return{...base,score:Math.min(100,score),cpm3Change:cpm3,cpm7Change:cpm7,ctr7Change:ctr,cpc7Change:cpc,activeDays}}
const fmt=(n:number|null,reverse=false)=>n==null?'-':`${n>0?'+':''}${n.toFixed(1)}%${reverse&&n<0?' ↓':''}`;

export function CreativeFatiguePage(){
  const {range}=useMetricsQuery();const {filterValue}=useAdvertiserFilter();const [data,setData]=useState<Response|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [q,setQ]=useState('');const [kind,setKind]=useState<'전체'|'이미지'|'영상'|'키워드'>('전체');const [detail,setDetail]=useState<FatigueRow|null>(null);
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
  useEffect(()=>{let alive=true;setLoading(true);setError('');apiFetch<Response>(`/metrics/creatives?${metricQuery(range)}`).then(r=>alive&&setData(r)).catch(e=>{if(alive){setData(null);setError(e instanceof Error?e.message:String(e))}}).finally(()=>alive&&setLoading(false));return()=>{alive=false}},[range.from,range.to]);
  const allRows=useMemo(()=>{if(!data)return[];return data.rows.map(base=>fatigue(base,data.dailyRows.filter(d=>d.advertiserId===base.advertiserId&&d.channel===base.channel&&d.adId===base.adId)))},[data]);
  const rows=useMemo(()=>allRows.filter(r=>matchesAdvertiserFilter(r.advertiserName||r.advertiserId,filterValue)&&(kind==='전체'||kindOf(r)===kind)&&`${r.adName} ${r.campaignName||''}`.toLowerCase().includes(q.trim().toLowerCase())).sort((a,b)=>b.score-a.score),[allRows,filterValue,kind,q]);
  const connected=data?.meta.connections.filter(c=>c.status==='connected')||[];
  const kindCount=(k:'이미지'|'영상'|'키워드')=>allRows.filter(r=>kindOf(r)===k).length;
  return <div><PageHeader title="소재 피로도 관리" description="동일 creative_daily_metrics에서 최근 3일·7일 구간의 CPM·CTR·CPC 변화를 계산합니다." action={<div className="ops-search compact"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="소재·캠페인 검색"/></div>}/><MetricsDateBar/>
    <div className="media-type-toggle" style={{marginBottom:12}}>
      {(['전체','이미지','영상','키워드'] as const).map(k=><button key={k} className={kind===k?'active':''} onClick={()=>setKind(k)}>{k}{k!=='전체'&&` (${kindCount(k)})`}</button>)}
    </div>
    {error&&<div className="status-banner danger">{error}</div>}<div className="status-banner neutral" style={{marginBottom:12}}>{connected.length?'실제 소재 일별 성과 기준입니다.':'연동된 소재 성과 매체가 없습니다.'} 빈도·도달 데이터는 현재 저장하지 않아 피로도 점수에 포함하지 않습니다.</div><div className="fatigue-stat-grid"><div><span>🔴 위험 (85+)</span><strong>{rows.filter(r=>r.score>=85).length}건</strong></div><div><span>🟡 주의 (70+)</span><strong>{rows.filter(r=>r.score>=70&&r.score<85).length}건</strong></div><div><span>🟢 정상</span><strong>{rows.filter(r=>r.score<70).length}건</strong></div></div><section className="card ops-card"><div className="table-scroll"><table className="ops-table fatigue-table"><thead><tr><th>소재</th><th>유형</th><th>매체</th><th>피로도</th><th>3일 CPM 변화</th><th>7일 CPM 변화</th><th>7일 CTR 변화</th><th>7일 CPC 변화</th><th>활성일</th><th>기간 광고비</th></tr></thead><tbody>{loading?<tr><td colSpan={10} className="empty-cell">불러오는 중...</td></tr>:rows.length===0?<tr><td colSpan={10} className="empty-cell">분석할 실제 소재 일별 데이터가 없습니다.</td></tr>:rows.map(r=><tr key={`${r.advertiserId}-${r.channel}-${r.adId}`}><td><button className="creative-name-cell" onClick={()=>setDetail(r)} style={{border:0,background:'transparent',cursor:'pointer',textAlign:'left'}}>{r.thumbnailUrl?<img className="creative-thumb" src={r.thumbnailUrl} alt=""/>:<span className="creative-thumb"/>}<span><b>{r.adName}</b><small>{r.campaignName||'-'}</small></span></button></td><td>{kindOf(r)}</td><td><ChannelTag channel={r.channel}/></td><td><b>{r.score}</b>점</td><td>{fmt(r.cpm3Change)}</td><td>{fmt(r.cpm7Change)}</td><td>{fmt(r.ctr7Change,true)}</td><td>{fmt(r.cpc7Change)}</td><td>{r.activeDays}일</td><td>₩{Math.round(r.spend).toLocaleString()}</td></tr>)}</tbody></table></div><div className="footnote">점수는 선택 기간 안에서 소재별 일별 데이터가 충분한 경우에만 변화율을 계산합니다. 데이터가 없는 지표를 0으로 가장하지 않습니다.</div></section>
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
      <div className="detail-kpi-grid"><div><span>피로도</span><b>{detail.score}점</b></div><div><span>기간 광고비</span><b>{won(detail.spend)}</b></div><div><span>3일 CPM 변화</span><b>{fmt(detail.cpm3Change)}</b></div><div><span>7일 CPM 변화</span><b>{fmt(detail.cpm7Change)}</b></div><div><span>7일 CTR 변화</span><b>{fmt(detail.ctr7Change,true)}</b></div><div><span>활성일</span><b>{detail.activeDays}일</b></div></div>
    </ModalPortal>}
  </div>;
}
