import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useMetricRows } from '../hooks/useMetrics';
import type { CreativeMetricRow, DailyMetricRow } from '../types/metrics';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

function won(n:number){return `₩${Math.round(n).toLocaleString()}`}
function pct(n:number){return `${n.toFixed(1)}%`}
function downloadCsv(rows:string[][]){const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`HOWTOM_통합보고서_${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

type Group={name:string;spend:number;impressions:number;clicks:number;dbCount:number;purchases:number;revenue:number};
function groupRows(rows:DailyMetricRow[],key:(r:DailyMetricRow)=>string):Group[]{const map=new Map<string,Group>();for(const r of rows){const k=key(r);const v=map.get(k)||{name:k,spend:0,impressions:0,clicks:0,dbCount:0,purchases:0,revenue:0};v.spend+=r.spend;v.impressions+=r.impressions;v.clicks+=r.clicks;v.dbCount+=r.dbCount;v.purchases+=r.purchases;v.revenue+=r.revenue;map.set(k,v)}return [...map.values()].sort((a,b)=>b.spend-a.spend)}

export function ReportsHubPage(){
  const {filterValue}=useAdvertiserFilter();
  const daily=useMetricRows<DailyMetricRow>('/metrics/daily');
  const creative=useMetricRows<CreativeMetricRow>('/metrics/creatives');
  const visible=useMemo(()=>daily.rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||'',filterValue)),[daily.rows,filterValue]);
  const creatives=useMemo(()=>creative.rows.filter(r=>matchesAdvertiserFilter(r.advertiserName||'',filterValue)),[creative.rows,filterValue]);
  const total=useMemo(()=>visible.reduce((a,r)=>({spend:a.spend+r.spend,impressions:a.impressions+r.impressions,clicks:a.clicks+r.clicks,dbCount:a.dbCount+r.dbCount,purchases:a.purchases+r.purchases,revenue:a.revenue+r.revenue}),{spend:0,impressions:0,clicks:0,dbCount:0,purchases:0,revenue:0}),[visible]);
  const byAdvertiser=useMemo(()=>groupRows(visible,r=>r.advertiserName||r.advertiserId),[visible]);
  const byMedia=useMemo(()=>groupRows(visible,r=>r.channel),[visible]);
  const exportRows=[['광고주','매체','날짜','광고비','노출','클릭','전환','구매','전환매출','CTR','CPC','CPA','ROAS'],...visible.map(r=>[r.advertiserName||r.advertiserId,r.channel,r.date,String(r.spend),String(r.impressions),String(r.clicks),String(r.dbCount),String(r.purchases),String(r.revenue),String(r.ctr||0),String(r.cpc||0),String(r.cpa||0),String(r.roas||0)])];
  return <div>
    <PageHeader title="통합 보고서" description="대시보드·인사이트와 동일한 중앙 Metrics API와 동일한 기간으로 생성되는 보고서입니다." action={<button className="btn secondary" disabled={!visible.length} onClick={()=>downloadCsv(exportRows)}><Download size={15}/> CSV 저장</button>}/>
    <MetricsDateBar/>
    {(daily.error||creative.error)&&<div className="card" style={{color:'#b91c1c',borderColor:'#fecaca'}}>{daily.error||creative.error}</div>}
    <div className="summary-grid" style={{marginBottom:16}}>
      <div className="summary-card"><div className="summary-card-label">광고비</div><div className="summary-card-value">{won(total.spend)}</div></div>
      <div className="summary-card"><div className="summary-card-label">노출</div><div className="summary-card-value">{total.impressions.toLocaleString()}</div></div>
      <div className="summary-card"><div className="summary-card-label">클릭</div><div className="summary-card-value">{total.clicks.toLocaleString()}</div></div>
      <div className="summary-card"><div className="summary-card-label">전환</div><div className="summary-card-value">{total.dbCount.toLocaleString()}</div></div>
      <div className="summary-card"><div className="summary-card-label">전환매출</div><div className="summary-card-value">{won(total.revenue)}</div></div>
      <div className="summary-card"><div className="summary-card-label">ROAS</div><div className="summary-card-value">{pct(total.spend?total.revenue/total.spend*100:0)}</div></div>
    </div>
    <div className="dashboard-grid-two">
      <section className="card"><div className="card-title">광고주별 성과</div><div className="table-scroll"><table className="data-table"><thead><tr><th>광고주</th><th className="num">광고비</th><th className="num">클릭</th><th className="num">전환</th><th className="num">CPA</th><th className="num">매출</th><th className="num">ROAS</th></tr></thead><tbody>{byAdvertiser.map(r=><tr key={r.name}><td><b>{r.name}</b></td><td className="num">{won(r.spend)}</td><td className="num">{r.clicks.toLocaleString()}</td><td className="num">{(r.dbCount+r.purchases).toLocaleString()}</td><td className="num">{(r.dbCount+r.purchases)?won(r.spend/(r.dbCount+r.purchases)):'-'}</td><td className="num">{won(r.revenue)}</td><td className="num">{r.revenue?pct(r.spend?r.revenue/r.spend*100:0):'-'}</td></tr>)}</tbody></table></div></section>
      <section className="card"><div className="card-title">매체별 성과</div><div className="table-scroll"><table className="data-table"><thead><tr><th>매체</th><th className="num">광고비</th><th className="num">노출</th><th className="num">클릭</th><th className="num">CTR</th><th className="num">전환</th><th className="num">ROAS</th></tr></thead><tbody>{byMedia.map(r=><tr key={r.name}><td><b>{r.name}</b></td><td className="num">{won(r.spend)}</td><td className="num">{r.impressions.toLocaleString()}</td><td className="num">{r.clicks.toLocaleString()}</td><td className="num">{pct(r.impressions?r.clicks/r.impressions*100:0)}</td><td className="num">{r.dbCount.toLocaleString()}</td><td className="num">{r.revenue?pct(r.spend?r.revenue/r.spend*100:0):'-'}</td></tr>)}</tbody></table></div></section>
    </div>
    <section className="card" style={{marginTop:16}}><div className="card-title">상위 소재 성과</div><div className="table-scroll"><table className="data-table"><thead><tr><th>광고주</th><th>매체</th><th>소재</th><th className="num">광고비</th><th className="num">노출</th><th className="num">클릭</th><th className="num">CTR</th><th className="num">전환</th><th className="num">CPA</th><th className="num">ROAS</th></tr></thead><tbody>{creatives.slice(0,50).map(r=><tr key={`${r.advertiserId}-${r.channel}-${r.adId}`}><td>{r.advertiserName}</td><td>{r.channel}</td><td><b>{r.adName}</b></td><td className="num">{won(r.spend)}</td><td className="num">{r.impressions.toLocaleString()}</td><td className="num">{r.clicks.toLocaleString()}</td><td className="num">{pct(r.ctr||0)}</td><td className="num">{(r.dbCount+(r.purchases||0)).toLocaleString()}</td><td className="num">{(r.dbCount+(r.purchases||0))?won(r.spend/(r.dbCount+(r.purchases||0))):'-'}</td><td className="num">{r.revenue?pct(r.roas||0):'-'}</td></tr>)}{!creative.loading&&!creatives.length&&<tr><td colSpan={10} style={{textAlign:'center',padding:30,color:'var(--text-muted)'}}>선택한 기간에 실제 소재 데이터가 없습니다.</td></tr>}</tbody></table></div></section>
    <p className="footnote">같은 광고주·같은 기간을 선택하면 통합 홈·대시보드·인사이트·보고서가 모두 같은 중앙 Metrics 저장소를 조회합니다.</p>
  </div>;
}
