import { useMemo, useState } from 'react';
import { AlertTriangle, Settings2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { useMetricRows } from '../hooks/useMetrics';
import { useSortableRows } from '../hooks/useSortableRows';
import type { DailyMetricRow } from '../types/metrics';

// 이 화면의 광고 성과 Source of Truth는 /api/metrics/funnel 하나입니다.
// CRM 유효DB·계약 등 매체 API가 제공하지 않는 단계는 가짜 숫자로 채우지 않습니다.
type FunnelMode = 'lead' | 'commerce';
type FunnelStage = { label: string; value: number; color: string };
type PlatformRow = DailyMetricRow & { advertiserName?: string };

function pct(a:number,b:number){return b?`${(a/b*100).toFixed(1)}%`:'0.0%'}
function money(n:number){return `₩${Math.round(n).toLocaleString()}`}
const funnelColors=['#f59e0b','#10b981','#4776ff','#7c3aed','#ef4444','#0891b2'];

function FunnelCard({title,color,stages}:{title:string;color:string;stages:FunnelStage[]}){
  const max=Math.max(...stages.map(s=>s.value),1);
  const final=stages[stages.length-1];
  return <section className="card funnel-capture-card">
    <div className="funnel-brand-head"><b>{title}</b><span style={{background:color}}/></div>
    <div className="funnel-bars">{stages.map((stage,index)=><div key={stage.label} className="funnel-bar-row">
      <div className="funnel-bar-label"><span>{stage.label}</span><b>{stage.value.toLocaleString()} {index===0?'':`(${pct(stage.value,stages[index-1].value)})`}</b></div>
      <div className="funnel-track"><i style={{width:`${Math.max(6,stage.value/max*100)}%`,background:stage.color}}/></div>
    </div>)}</div>
    <div className="funnel-final"><div><span>최종 전환율</span><b>{pct(final.value,stages[0].value)}</b></div><div><span>최종 전환</span><b>{final.value.toLocaleString()}</b></div></div>
  </section>;
}

function statusLabel(status?:string){
  if(status==='connected')return '연동 완료';
  if(status==='connector_unimplemented')return '커넥터 미구현';
  if(status==='error')return '동기화 오류';
  return '미연동';
}

export function ConversionFunnelPage(){
  const {filterValue}=useAdvertiserFilter();
  const [mode,setMode]=useState<FunnelMode>('lead');
  const {rows,meta,loading,error}=useMetricRows<PlatformRow>('/metrics/funnel');

  const visibleRows=useMemo(()=>rows.filter(row=>matchesAdvertiserFilter(row.advertiserName||'',filterValue)),[rows,filterValue]);
  const total=useMemo(()=>visibleRows.reduce((a,r)=>({
    impressions:a.impressions+(r.impressions||0),clicks:a.clicks+(r.clicks||0),spend:a.spend+(r.spend||0),
    dbCount:a.dbCount+(r.dbCount||0),purchases:a.purchases+(r.purchases||0),revenue:a.revenue+(r.revenue||0)
  }),{impressions:0,clicks:0,spend:0,dbCount:0,purchases:0,revenue:0}),[visibleRows]);

  const connectionByChannel=useMemo(()=>new Map((meta?.connections||[]).map(c=>[c.channel,c])),[meta]);
  const visibleWithMetrics=useMemo(()=>visibleRows.map(row=>({...row,cpa:(row.dbCount+row.purchases)?row.spend/(row.dbCount+row.purchases):0,roas:row.spend?row.revenue/row.spend*100:0})),[visibleRows]);
  const {sorted:sortedRows,toggleSort,arrow}=useSortableRows(visibleWithMetrics,'spend',(r,k)=>(r as any)[k]);
  const advertiserGroups=useMemo(()=>{
    const map=new Map<string,{clicks:number;dbCount:number;purchases:number;color:string}>();
    visibleRows.forEach((row,index)=>{
      const name=row.advertiserName||'광고주'; const cur=map.get(name)||{clicks:0,dbCount:0,purchases:0,color:funnelColors[index%funnelColors.length]};
      cur.clicks+=row.clicks||0;cur.dbCount+=row.dbCount||0;cur.purchases+=row.purchases||0;map.set(name,cur);
    });
    return [...map.entries()].map(([name,v])=>({name,...v}));
  },[visibleRows]);

  const funnels=advertiserGroups.map((item,index)=>{
    const color=item.color||funnelColors[index%funnelColors.length];
    const stages:FunnelStage[]=mode==='commerce'
      ? [{label:'클릭',value:item.clicks,color},{label:'구매',value:item.purchases,color:'#7c3aed'}]
      : [{label:'클릭',value:item.clicks,color},{label:'DB/전환',value:item.dbCount,color:'#10b981'}];
    return {name:item.name,color,stages};
  });

  return <>
    <PageHeader title="전환 퍼널 분석" description="매체 API에서 수집한 동일 기간의 실제 클릭·전환·구매 데이터를 기준으로 퍼널을 분석합니다." action={<button className="btn secondary" disabled><Settings2 size={15}/> 퍼널 설정</button>}/>
    <MetricsDateBar/>

    <div className="funnel-warning"><AlertTriangle size={25}/><div><b>매체 API가 제공하는 이벤트만 표시합니다.</b><p>유효 DB·계약처럼 별도 CRM 연동이 필요한 값은 임의로 0을 채워 정상 연동처럼 보이지 않습니다. 연결되지 않은 매체는 미연동/커넥터 미구현으로 표시됩니다.</p></div></div>

    <div className="section-tabs compact-tabs" style={{marginBottom:14}}><button className={mode==='lead'?'active':''} onClick={()=>setMode('lead')}>예약 상담 퍼널</button><button className={mode==='commerce'?'active':''} onClick={()=>setMode('commerce')}>커머스 퍼널</button></div>

    {error&&<div className="card" style={{borderColor:'#fecaca',color:'#b91c1c'}}>{error}</div>}
    {loading&&<div className="card">실제 매체 데이터를 불러오는 중입니다.</div>}

    <div className="summary-grid" style={{marginBottom:16}}>
      <div className="summary-card"><div className="summary-card-label">광고비</div><div className="summary-card-value">{money(total.spend)}</div></div>
      <div className="summary-card"><div className="summary-card-label">클릭</div><div className="summary-card-value">{total.clicks.toLocaleString()}</div></div>
      <div className="summary-card"><div className="summary-card-label">DB/전환</div><div className="summary-card-value">{total.dbCount.toLocaleString()}</div></div>
      <div className="summary-card"><div className="summary-card-label">구매</div><div className="summary-card-value">{total.purchases.toLocaleString()}</div></div>
      <div className="summary-card"><div className="summary-card-label">매출</div><div className="summary-card-value">{money(total.revenue)}</div></div>
    </div>

    <section className="card" style={{padding:0,marginBottom:16}}>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th className="sortable-th" onClick={()=>toggleSort('channel')}>매체{arrow('channel')}</th>
        <th>연동 상태</th>
        <th className="num sortable-th" onClick={()=>toggleSort('spend')}>광고비{arrow('spend')}</th>
        <th className="num sortable-th" onClick={()=>toggleSort('impressions')}>노출{arrow('impressions')}</th>
        <th className="num sortable-th" onClick={()=>toggleSort('clicks')}>클릭{arrow('clicks')}</th>
        <th className="num sortable-th" onClick={()=>toggleSort('dbCount')}>DB/전환{arrow('dbCount')}</th>
        <th className="num sortable-th" onClick={()=>toggleSort('purchases')}>구매{arrow('purchases')}</th>
        <th className="num sortable-th" onClick={()=>toggleSort('revenue')}>매출{arrow('revenue')}</th>
        <th className="num sortable-th" onClick={()=>toggleSort('cpa')}>CPA{arrow('cpa')}</th>
        <th className="num sortable-th" onClick={()=>toggleSort('roas')}>ROAS{arrow('roas')}</th>
      </tr></thead><tbody>
        {sortedRows.map((row,i)=>{const connection=connectionByChannel.get(row.channel);return <tr key={`${row.channel}-${i}`}><td><b>{row.channel}</b></td><td>{statusLabel(connection?.status)}</td><td className="num metric-emphasis">{money(row.spend)}</td><td className="num">{row.impressions.toLocaleString()}</td><td className="num">{row.clicks.toLocaleString()}</td><td className="num"><b>{row.dbCount.toLocaleString()}</b></td><td className="num">{row.purchases.toLocaleString()}</td><td className="num">{money(row.revenue)}</td><td className="num">{(row.dbCount+row.purchases)?money(row.cpa):'-'}</td><td className={`num ${row.roas>=200?'metric-positive':row.roas>0&&row.roas<100?'metric-negative':''}`}>{row.revenue?`${row.roas.toFixed(1)}%`:'-'}</td></tr>})}
        {!loading&&visibleRows.length===0&&<tr><td colSpan={10} style={{textAlign:'center',padding:30,color:'var(--text-muted)'}}>선택한 기간에 수집된 실제 퍼널 데이터가 없습니다.</td></tr>}
      </tbody></table></div>
    </section>

    <div className="funnel-grid">{funnels.map(f=><FunnelCard key={f.name} title={f.name} color={f.color} stages={f.stages}/>)}</div>
  </>;
}
