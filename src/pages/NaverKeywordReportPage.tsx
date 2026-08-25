import { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { Badge } from '../components/Badge';
import { CampaignTypeTag } from '../components/ChannelTag';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { useMetricRows } from '../hooks/useMetrics';
import { useSortableRows } from '../hooks/useSortableRows';
import type { KeywordMetricRow } from '../types/metrics';
import { splitHighLowPerformers } from '../utils/performanceScoring';

type Channel='naver'|'google'|'kakao'|'daangn';
const config:Record<Channel,{label:string;color:string;link:string}>={naver:{label:'네이버',color:'#03c75a',link:'https://manage.searchad.naver.com/'},google:{label:'구글',color:'#4285f4',link:'https://ads.google.com/'},kakao:{label:'카카오',color:'#f5c400',link:'https://moment.kakao.com/'},daangn:{label:'당근',color:'#ff6f0f',link:'https://business.daangn.com/'}};
function won(n:number){return `₩${Math.round(n).toLocaleString()}`}
function pct(n:number){return `${n.toFixed(2)}%`}
function stateLabel(s?:string){if(s==='connected')return '연동';if(s==='connector_unimplemented')return '커넥터 미구현';if(s==='error')return '동기화 오류';return '미연동'}

export function NaverKeywordReportPage(){
  const [channel,setChannel]=useState<Channel>('naver');
  const [query,setQuery]=useState('');
  const [campaign,setCampaign]=useState('전체');
  const {filterValue}=useAdvertiserFilter();
  const {rows,meta,loading,error}=useMetricRows<KeywordMetricRow>('/metrics/keywords',{channel});
  const visible=useMemo(()=>rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||'',filterValue)&&(!query||r.keyword.toLowerCase().includes(query.toLowerCase()))&&(campaign==='전체'||r.campaignName===campaign)).map(r=>({...r,cpm:r.impressions?r.spend/r.impressions*1000:0,cpc:r.clicks?r.spend/r.clicks:0,cpa:r.dbCount?r.spend/r.dbCount:0})),[rows,filterValue,query,campaign]);
  const campaigns=useMemo(()=>['전체',...new Set(rows.map(r=>r.campaignName).filter((c):c is string=>Boolean(c)))],[rows]);
  const {sorted:sortedVisible,toggleSort,arrow}=useSortableRows(visible,'spend',(r,k)=>(r as any)[k]);
  const totals=useMemo(()=>visible.reduce((a,r)=>({spend:a.spend+r.spend,impressions:a.impressions+r.impressions,clicks:a.clicks+r.clicks,conv:a.conv+r.dbCount,revenue:a.revenue+r.revenue}),{spend:0,impressions:0,clicks:0,conv:0,revenue:0}),[visible]);
  // 키워드 단위: ROAS·전환수·CVR·클릭수를 종합해서 고성과/저성과를 판단합니다(ROAS 하나만 보지 않습니다).
  const { high: highKeywords, low: lowKeywords } = useMemo(()=>splitHighLowPerformers(visible, 8), [visible]);
  // 캠페인 단위: 같은 캠페인의 키워드들을 합산한 뒤, 광고주명과 함께 종합 점수로 판단합니다.
  const byCampaign = useMemo(()=>{
    const m = new Map<string, {advertiserName:string;campaignName:string;spend:number;clicks:number;dbCount:number;revenue:number}>();
    for (const r of visible) {
      const key = `${r.advertiserName||''}__${r.campaignName||'(캠페인 없음)'}`;
      const cur = m.get(key) || {advertiserName:r.advertiserName||'', campaignName:r.campaignName||'(캠페인 없음)', spend:0, clicks:0, dbCount:0, revenue:0};
      cur.spend += r.spend; cur.clicks += r.clicks; cur.dbCount += r.dbCount; cur.revenue += r.revenue||0;
      m.set(key, cur);
    }
    return [...m.values()];
  }, [visible]);
  const { high: highCampaigns, low: lowCampaigns } = useMemo(()=>splitHighLowPerformers(byCampaign, 8), [byCampaign]);
  const current=config[channel];
  const conn=(meta?.connections||[]).filter(c=>c.channel===channel);
  const status=conn.some(c=>c.status==='connected')?'connected':conn.some(c=>c.status==='connector_unimplemented')?'connector_unimplemented':conn.some(c=>c.status==='error')?'error':'disconnected';
  return <>
    <PageHeader title="키워드 성과" description="선택 기간의 실제 keyword_daily_metrics를 기준으로 검색광고 키워드 성과를 확인합니다." action={<a className="btn secondary" href={current.link} target="_blank" rel="noreferrer">{current.label} 광고센터 <ExternalLink size={14}/></a>}/>
    <MetricsDateBar/>
    <div className="keyword-performance-channel-tabs" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>{(Object.keys(config) as Channel[]).map(ch=>{const c=config[ch];const connection=(meta?.connections||[]).filter(x=>x.channel===ch);const s=connection.some(x=>x.status==='connected')?'연동':connection.some(x=>x.status==='connector_unimplemented')?'커넥터 미구현':connection.some(x=>x.status==='error')?'오류':'미연동';return <button key={ch} type="button" onClick={()=>setChannel(ch)} style={{border:`1px solid ${channel===ch?c.color:'#d8dee9'}`,background:channel===ch?`${c.color}15`:'#fff',color:channel===ch?c.color:'#5d6879',borderRadius:8,padding:'9px 14px',fontWeight:800,cursor:'pointer'}}>{c.label} · {s}</button>})}</div>
    {status!=='connected'&&<div className="card" style={{marginBottom:12}}><b>{current.label}: {stateLabel(status)}</b><p className="muted">연결되지 않았거나 커넥터가 구현되지 않은 매체는 0 성과를 생성하지 않습니다.</p></div>}
    {error&&<div className="card" style={{color:'#b91c1c',borderColor:'#fecaca'}}>{error}</div>}
    <section className="card media-report-card" style={{borderTop:`3px solid ${current.color}`}}>
      <div className="media-report-toolbar"><div><b>{current.label} 키워드 {visible.length}개</b><span> · 광고비 {won(totals.spend)} · 클릭 {totals.clicks.toLocaleString()} · 전환 {totals.conv.toLocaleString()}</span></div><div className="media-report-actions"><select value={campaign} onChange={e=>setCampaign(e.target.value)}>{campaigns.map(c=><option key={c} value={c}>{c==='전체'?'전체 캠페인':c}</option>)}</select><div className="inline-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="키워드 검색"/></div></div></div>
      <div className="table-scroll"><table className="media-report-table"><thead><tr>
        <th className="sortable-th" onClick={()=>toggleSort('advertiserName')}>광고주{arrow('advertiserName')}</th>
        <th className="sortable-th" onClick={()=>toggleSort('campaignName')}>캠페인{arrow('campaignName')}</th>
        <th>유형</th>
        <th>광고그룹</th>
        <th className="sortable-th" onClick={()=>toggleSort('keyword')}>키워드{arrow('keyword')}</th>
        <th className="sortable-th" onClick={()=>toggleSort('spend')}>광고비{arrow('spend')}</th>
        <th className="sortable-th" onClick={()=>toggleSort('impressions')}>노출{arrow('impressions')}</th>
        <th className="sortable-th" onClick={()=>toggleSort('cpm')}>CPM{arrow('cpm')}</th>
        <th className="sortable-th" onClick={()=>toggleSort('clicks')}>클릭{arrow('clicks')}</th>
        <th className="sortable-th" onClick={()=>toggleSort('ctr')}>CTR{arrow('ctr')}</th>
        <th className="sortable-th" onClick={()=>toggleSort('cpc')}>CPC{arrow('cpc')}</th>
        <th className="sortable-th" onClick={()=>toggleSort('dbCount')}>전환{arrow('dbCount')}</th>
        <th className="sortable-th" onClick={()=>toggleSort('cvr')}>전환율{arrow('cvr')}</th>
        <th className="sortable-th" onClick={()=>toggleSort('cpa')}>CPA{arrow('cpa')}</th>
        <th className="sortable-th" onClick={()=>toggleSort('revenue')}>전환매출{arrow('revenue')}</th>
        <th className="sortable-th" onClick={()=>toggleSort('roas')}>ROAS{arrow('roas')}</th>
      </tr></thead><tbody>
        {sortedVisible.map((r,i)=><tr key={`${r.keywordId||r.keyword}-${i}`}><td>{r.advertiserName||r.advertiserId}</td><td>{r.campaignName||'-'}</td><td>{r.campaignType&&r.campaignType!=='-'?<CampaignTypeTag type={r.campaignType}/>:'-'}</td><td>{r.adgroupName||r.adgroupId||'-'}</td><td><b>{r.keyword}</b></td><td className="metric-emphasis">{won(r.spend)}</td><td>{r.impressions.toLocaleString()}</td><td>{r.impressions?won(r.cpm):'-'}</td><td>{r.clicks.toLocaleString()}</td><td>{pct(r.ctr||0)}</td><td>{r.clicks?won(r.cpc):'-'}</td><td><b>{r.dbCount.toLocaleString()}</b></td><td>{pct(r.cvr||0)}</td><td>{r.dbCount?won(r.cpa):'-'}</td><td>{r.revenue?won(r.revenue):'-'}</td><td className={r.revenue&&(r.roas||0)>=200?'metric-positive':r.revenue&&(r.roas||0)<100?'metric-negative':''}>{r.revenue?pct(r.roas||0):'-'}</td></tr>)}
        {!loading&&sortedVisible.length===0&&<tr><td colSpan={16} style={{textAlign:'center',padding:30,color:'var(--text-muted)'}}>선택한 기간에 실제 키워드 데이터가 없습니다.</td></tr>}
      </tbody></table></div>
      <div className="footnote">모든 수치는 같은 from/to 기간으로 서버에서 집계됩니다. 미연동 매체는 빈 데이터와 상태로 구분됩니다.</div>
    </section>
    <div className="keyword-analysis-cards">
      <div className="card"><div className="card-title">고성과 캠페인</div>{highCampaigns.length?highCampaigns.map((c,i)=><p key={i} className="analysis-item"><span className="badge badge-success">{c.advertiserName} {c.campaignName}</span> {c.revenue>0?`ROAS ${(c.revenue/c.spend*100).toFixed(0)}%`:''} · CVR {c.clicks?(c.dbCount/c.clicks*100).toFixed(1):'0.0'}% · 전환 {c.dbCount}건 · 클릭 {c.clicks.toLocaleString()}</p>):<p className="muted-text">선택 기간에 뚜렷한 고성과 캠페인이 없습니다.</p>}</div>
      <div className="card"><div className="card-title">저성과 캠페인</div>{lowCampaigns.length?lowCampaigns.map((c,i)=><p key={i} className="analysis-item"><span className="badge badge-danger">{c.advertiserName} {c.campaignName}</span> 광고비 {won(c.spend)} · 전환 {c.dbCount}건 · CVR {c.clicks?(c.dbCount/c.clicks*100).toFixed(1):'0.0'}%{c.revenue>0?` · ROAS ${(c.revenue/c.spend*100).toFixed(0)}%`:''}</p>):<p className="muted-text">선택 기간에 뚜렷한 저성과 캠페인이 없습니다.</p>}</div>
      <div className="card"><div className="card-title">고성과 키워드</div>{highKeywords.length?highKeywords.map((r,i)=><p key={i} className="analysis-item"><span className="badge badge-success">{r.advertiserName} {r.keyword}</span> {r.revenue>0?`ROAS ${(r.revenue/r.spend*100).toFixed(0)}%`:''} · CVR {r.clicks?(r.dbCount/r.clicks*100).toFixed(1):'0.0'}% · 전환 {r.dbCount}건 · 클릭 {r.clicks.toLocaleString()}</p>):<p className="muted-text">선택 기간에 뚜렷한 고성과 키워드가 없습니다.</p>}</div>
      <div className="card"><div className="card-title">저성과 키워드</div>{lowKeywords.length?lowKeywords.map((r,i)=><p key={i} className="analysis-item"><span className="badge badge-danger">{r.advertiserName} {r.keyword}</span> 광고비 {won(r.spend)} · 전환 {r.dbCount}건 · CVR {r.clicks?(r.dbCount/r.clicks*100).toFixed(1):'0.0'}%{r.revenue>0?` · ROAS ${(r.revenue/r.spend*100).toFixed(0)}%`:''}</p>):<p className="muted-text">선택 기간에 뚜렷한 저성과 키워드가 없습니다.</p>}</div>
    </div>
    <div className="footnote">고성과·저성과는 ROAS·전환수·CVR·클릭수를 종합한 점수로 판단합니다(ROAS만 단독으로 보지 않습니다). 매출을 추적하지 않는 경우 CVR·전환수·클릭수만으로 판단합니다.</div>
  </>;
}
