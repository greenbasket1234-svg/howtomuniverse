import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useMetricRows } from '../hooks/useMetrics';
import type { CreativeMetricRow } from '../types/metrics';

const won=(n:number)=>`₩${Math.round(n||0).toLocaleString()}`;
const channelLabel=(v:string)=>v==='meta'?'Meta':v==='naver'?'네이버':v;

export function CreativeDetailPage(){
  const {creativeId=''}=useParams();
  const {rows,loading,error}=useMetricRows<CreativeMetricRow>('/metrics/creatives');
  const creative=rows.find(r=>String(r.adId)===creativeId);
  if(loading)return <div><Link to="/creatives/library" className="breadcrumb-back">← 소재 라이브러리</Link><div className="card empty-state">소재를 불러오는 중입니다.</div></div>;
  if(error)return <div><Link to="/creatives/library" className="breadcrumb-back">← 소재 라이브러리</Link><div className="status-banner danger">{error}</div></div>;
  if(!creative)return <div><Link to="/creatives/library" className="breadcrumb-back">← 소재 라이브러리</Link><div className="card empty-state"><div className="empty-state-title">선택 기간에 해당 소재 성과가 없습니다.</div><div>기간을 변경하거나 소재 라이브러리에서 다시 선택해주세요.</div></div></div>;
  return <div className="creative-fullscreen-page">
    <Link to="/creatives/library" className="breadcrumb-back">← 소재 라이브러리</Link>
    <PageHeader title={creative.adName} description={`${creative.advertiserName||creative.advertiserId} · ${channelLabel(creative.channel)} · ${creative.campaignName||'-'}`}/>
    <MetricsDateBar/>
    <div className="creative-fullscreen-hero"><section className="card creative-fullscreen-media-card"><div className="creative-fullscreen-section-title">실제 매체 소재</div><div className="creative-fullscreen-media-stage image">{creative.thumbnailUrl?<img src={creative.thumbnailUrl} alt={creative.adName}/>:<span className="creative-fullscreen-media-symbol">소재 미리보기 없음</span>}</div>{(creative.title||creative.body||creative.description)&&<div className="creative-fullscreen-copy"><span>매체 문구</span>{creative.title&&<p><b>{creative.title}</b></p>}{creative.body&&<p>{creative.body}</p>}{creative.description&&<p>{creative.description}</p>}</div>}</section><section className="card creative-fullscreen-info-card"><div className="card-title">선택 기간 실제 성과</div><div className="detail-kpi-grid"><div><span>광고비</span><b>{won(creative.spend)}</b></div><div><span>노출</span><b>{creative.impressions.toLocaleString()}</b></div><div><span>클릭</span><b>{creative.clicks.toLocaleString()}</b></div><div><span>CTR</span><b>{Number(creative.ctr||0).toFixed(2)}%</b></div><div><span>CPC</span><b>{won(creative.cpc||0)}</b></div><div><span>CPM</span><b>{won(creative.cpm||0)}</b></div><div><span>전환</span><b>{creative.dbCount.toLocaleString()}</b></div><div><span>CPA</span><b>{creative.dbCount?won(creative.cpa||0):'-'}</b></div><div><span>전환매출</span><b>{won(creative.revenue)}</b></div><div><span>ROAS</span><b>{creative.spend?`${Number(creative.roas||0).toFixed(0)}%`:'-'}</b></div></div><dl className="kv-grid creative-fullscreen-kv"><dt>광고 ID</dt><dd>{creative.adId}</dd><dt>캠페인 ID</dt><dd>{creative.campaignId||'-'}</dd><dt>CTA</dt><dd>{creative.cta||'-'}</dd></dl></section></div>
  </div>;
}
