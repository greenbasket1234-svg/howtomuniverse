import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, ChevronDown, Save, Settings2, TrendingDown, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { loadPerformanceDataset } from '../analytics/integratedPerformance';
import { loadDbRows } from '../utils/dbDataStore';
import { useDbDataRevision } from '../hooks/useDbDataRevision';

type FunnelMode = 'lead' | 'commerce';
type FunnelStage = { label: string; value: number; color: string };
type PlatformRow = {
  platform: string;
  status: '연동 완료' | '연동 대기' | '미지원';
  spend: number;
  clicks: number;
  db: number;
  validDb: number;
  contracts: number;
  itemViews: number;
  carts: number;
  checkouts: number;
  purchases: number;
  revenue: number;
};

const fallbackRows: PlatformRow[] = [
  { platform:'메타',status:'연동 완료',spend:415683,clicks:2932,db:193,validDb:142,contracts:51,itemViews:4821,carts:388,checkouts:179,purchases:92,revenue:2807800 },
  { platform:'네이버',status:'연동 완료',spend:190406,clicks:168,db:81,validDb:64,contracts:17,itemViews:821,carts:73,checkouts:41,purchases:28,revenue:767800 },
  { platform:'구글 검색',status:'연동 완료',spend:131055,clicks:3336,db:49,validDb:37,contracts:11,itemViews:3930,carts:301,checkouts:146,purchases:77,revenue:2040000 },
  { platform:'직접입력',status:'연동 완료',spend:0,clicks:0,db:112,validDb:96,contracts:51,itemViews:0,carts:0,checkouts:0,purchases:0,revenue:2040000 },
];

const leadStages:FunnelStage[]=[
  {label:'클릭',value:6436,color:'#f59e0b'},
  {label:'전환 클릭',value:1228,color:'#f59e0b'},
  {label:'길찾기 클릭',value:884,color:'#f59e0b'},
  {label:'예약',value:342,color:'#f59e0b'},
  {label:'실제 방문',value:219,color:'#f59e0b'},
  {label:'리뷰 작성',value:88,color:'#f59e0b'},
];
const commerceStages:FunnelStage[]=[
  {label:'방문',value:9572,color:'#10b981'},
  {label:'장바구니',value:762,color:'#10b981'},
  {label:'구매',value:197,color:'#10b981'},
  {label:'재구매',value:68,color:'#10b981'},
];

function pct(a:number,b:number){return b?`${(a/b*100).toFixed(1)}%`:'0.0%'}
function money(n:number){return `₩${Math.round(n).toLocaleString()}`}

function dateMinus(value:string,days:number){const d=new Date(`${value}T00:00:00`);d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)}
function funnelRange(period:string,latest:string){if(!latest)return ['', ''] as const;if(period==='오늘')return [latest,latest] as const;if(period==='어제'){const d=dateMinus(latest,1);return [d,d] as const;}const n=Number(period.match(/\d+/)?.[0]||7);return [dateMinus(latest,n-1),latest] as const;}
const funnelColors=['#f59e0b','#10b981','#4776ff','#7c3aed','#ef4444','#0891b2'];

function FunnelCard({title,color,stages}:{title:string;color:string;stages:FunnelStage[]}){
  const max=Math.max(...stages.map(s=>s.value),1);
  const final=stages[stages.length-1];
  return <section className="card funnel-capture-card"><div className="funnel-brand-head"><b>{title}</b><span style={{background:color}}/></div><div className="funnel-bars">{stages.map((stage,index)=><div key={stage.label} className="funnel-bar-row"><div className="funnel-bar-label"><span>{stage.label}</span><b>{stage.value.toLocaleString()} {index===0?'':'('+pct(stage.value,stages[index-1].value)+')'}</b></div><div className="funnel-track"><i style={{width:`${Math.max(6,stage.value/max*100)}%`,background:stage.color}}/></div></div>)}</div><div className="funnel-final"><div><span>최종 전환율</span><b>{pct(final.value,stages[0].value)}</b></div><div><span>최종 전환</span><b>{final.value.toLocaleString()}</b></div></div></section>
}

export function ConversionFunnelPage(){
  const [period,setPeriod]=useState('7일');
  const { filterValue, setFilter } = useAdvertiserFilter();
  // 로컬 셀렉트를 전역 필터와 동기화합니다. 이전에는 이 드롭다운에서 '월컴투바베큐'를
  // 선택해도 아래 퍼널 카드가 여전히 두 브랜드를 모두 보여주는 버그가 있었습니다.
  const advertiser = filterValue || '전체 광고주';
  const setAdvertiser = (v:string)=>setFilter(v==='전체 광고주'?'':v);
  const [mode,setMode]=useState<FunnelMode>('lead');
  const dbRevision=useDbDataRevision();
  const performance=useMemo(()=>loadPerformanceDataset(),[dbRevision]);
  const dbRows=useMemo(()=>loadDbRows(),[dbRevision]);
  const latestDates=[performance.latestDate,...dbRows.map(row=>row.date)].filter(Boolean).sort();
  const latest=latestDates[latestDates.length-1]??'';
  const [rangeStart,rangeEnd]=funnelRange(period,latest);
  const actualDb=dbRows.filter(row=>(!rangeStart||row.date>=rangeStart)&&(!rangeEnd||row.date<=rangeEnd)&&matchesAdvertiserFilter(row.advertiser,filterValue));
  const performanceRows=performance.media.filter(row=>(!rangeStart||row.date>=rangeStart)&&(!rangeEnd||row.date<=rangeEnd)&&matchesAdvertiserFilter(row.advertiser,filterValue));
  const hasActualDb=actualDb.length>0;
  const dynamicRows:PlatformRow[]=useMemo(()=>{
    if(!hasActualDb) return fallbackRows;
    const mediaNames=[...new Set(actualDb.map(row=>row.media))];
    return mediaNames.map(platform=>{
      const dbPart=actualDb.filter(row=>row.media===platform);
      const perfPart=performanceRows.filter(row=>row.media===platform);
      const db=dbPart.reduce((a,r)=>a+r.db,0),validDb=dbPart.reduce((a,r)=>a+r.validDb,0),contracts=dbPart.reduce((a,r)=>a+r.contracts,0);
      const spend=perfPart.reduce((a,r)=>a+r.spend,0)||dbPart.reduce((a,r)=>a+(r.spend??0),0);
      const clicks=perfPart.reduce((a,r)=>a+r.clicks,0),revenue=perfPart.reduce((a,r)=>a+r.revenue,0)||dbPart.reduce((a,r)=>a+(r.revenue??0),0);
      return {platform,status:'연동 완료' as const,spend,clicks,db,validDb,contracts,itemViews:0,carts:0,checkouts:0,purchases:0,revenue};
    });
  },[hasActualDb,actualDb,performanceRows]);
  const rows=dynamicRows;
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [saved,setSaved]=useState(false);
  const [selectedColumns,setSelectedColumns]=useState(['광고비','클릭','DB','유효 DB','계약','CPA','매출','ROAS']);
  type SortKey='platform'|'spend'|'clicks'|'db'|'contracts'|'revenue';
  const [sortKey,setSortKey]=useState<SortKey>('spend');
  const [sortDir,setSortDir]=useState<'desc'|'asc'>('desc');
  const sortedRows=useMemo(()=>[...rows].sort((a,b)=>{
    const valueOf=(r:PlatformRow)=>sortKey==='platform'?r.platform:r[sortKey];
    const av=valueOf(a), bv=valueOf(b);
    if(typeof av==='string'||typeof bv==='string') return sortDir==='asc'?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));
    return sortDir==='asc'?(av as number)-(bv as number):(bv as number)-(av as number);
  }),[rows,sortKey,sortDir]);
  const toggleSort=(key:SortKey)=>{if(sortKey===key)setSortDir(sortDir==='desc'?'asc':'desc');else{setSortKey(key);setSortDir('desc')}};
  const sortArrow=(key:SortKey)=>sortKey===key?(sortDir==='desc'?' ▼':' ▲'):'';
  const total=useMemo(()=>rows.reduce((acc,row)=>({spend:acc.spend+row.spend,clicks:acc.clicks+row.clicks,db:acc.db+row.db,validDb:acc.validDb+row.validDb,contracts:acc.contracts+row.contracts,itemViews:acc.itemViews+row.itemViews,carts:acc.carts+row.carts,checkouts:acc.checkouts+row.checkouts,purchases:acc.purchases+row.purchases,revenue:acc.revenue+row.revenue}),{spend:0,clicks:0,db:0,validDb:0,contracts:0,itemViews:0,carts:0,checkouts:0,purchases:0,revenue:0}),[]);
  const columns=['광고비','클릭','DB','유효 DB','계약','상품 조회','장바구니','결제 시작','구매','CPA','매출','ROAS'];
  const leadFunnels=hasActualDb ? [...new Set(actualDb.map(row=>row.advertiser))].map((name,index)=>{
    const color=funnelColors[index%funnelColors.length]; const dbPart=actualDb.filter(row=>row.advertiser===name); const perfPart=performanceRows.filter(row=>row.advertiser===name);
    const clicks=perfPart.reduce((a,r)=>a+r.clicks,0),db=dbPart.reduce((a,r)=>a+r.db,0),valid=dbPart.reduce((a,r)=>a+r.validDb,0),contracts=dbPart.reduce((a,r)=>a+r.contracts,0);
    return {name,color,stages:[{label:'클릭',value:clicks,color},{label:'DB',value:db,color},{label:'유효 DB',value:valid,color},{label:'계약',value:contracts,color}]};
  }) : [
    {name:'월컴투바베큐',color:'#f59e0b',stages:leadStages},
    {name:'노멜',color:'#10b981',stages:[{label:'방문',value:2930,color:'#10b981'},{label:'문의',value:211,color:'#10b981'},{label:'예약',value:96,color:'#10b981'},{label:'방문 완료',value:71,color:'#10b981'}]},
  ];
  const commerceFunnels=[
    {name:'월컴투바베큐',color:'#f59e0b',stages:[{label:'상품 조회',value:4821,color:'#f59e0b'},{label:'장바구니',value:388,color:'#f59e0b'},{label:'결제 시작',value:179,color:'#f59e0b'},{label:'구매',value:92,color:'#f59e0b'}]},
    {name:'노멜',color:'#10b981',stages:commerceStages},
  ];
  const visibleFunnels=(mode==='lead'?leadFunnels:commerceFunnels).filter(f=>matchesAdvertiserFilter(f.name,filterValue));
  return <>
    <PageHeader title="전환 퍼널 분석" description="온라인 결제형·오프라인 예약형·쇼핑몰형 퍼널을 정확한 이벤트 기준으로 분석합니다." action={<div className="action-row"><select className="select-control" value={advertiser} onChange={e=>setAdvertiser(e.target.value)}><option>전체 광고주</option>{[...new Set([...performance.advertisers,...dbRows.map(row=>row.advertiser)])].sort((a,b)=>a.localeCompare(b,'ko')).map(name=><option key={name}>{name}</option>)}</select><button className="btn secondary" onClick={()=>setSettingsOpen(true)}><Settings2 size={15}/> 퍼널 설정</button></div>}/>
    <div className="funnel-warning"><AlertTriangle size={25}/><div><b>전환 이벤트 연동 상태를 확인하세요</b><p>DB 연동 데이터가 있으면 클릭→DB→유효 DB→계약 퍼널은 Google Sheets의 실제 집계값을 우선 사용합니다. 커머스 퍼널은 기존 전환 이벤트 데이터를 사용합니다.</p></div></div>
    <div className="funnel-toolbar"><div className="section-tabs compact-tabs"><button className={mode==='lead'?'active':''} onClick={()=>setMode('lead')}>예약·상담 퍼널</button><button className={mode==='commerce'?'active':''} onClick={()=>setMode('commerce')}>커머스 퍼널</button></div><div className="kpi-range-group">{['오늘','어제','7일','14일','30일','60일','90일'].map(p=><button key={p} className={`kpi-range-button ${period===p?'active':''}`} onClick={()=>setPeriod(p)}>{p}</button>)}</div></div>
    <div className="funnel-capture-grid">{visibleFunnels.length===0?<p className="muted">해당 광고주의 퍼널 데이터가 없습니다.</p>:visibleFunnels.map(f=><FunnelCard key={f.name} title={f.name} color={f.color} stages={f.stages}/>)}</div>
    <div className="funnel-note"><span>💡</span><p>현재 선택: <b>{advertiser}</b> · <b>{period}</b>. 단계별 이벤트는 환경설정의 퍼널 이벤트 매핑에서 수정할 수 있습니다.</p></div>
    <section className="card ops-card funnel-analysis-table"><div className="ops-card-head"><div><h3>매체별 퍼널 비교</h3><p>광고비부터 최종 전환·매출까지 매체별 병목을 비교합니다. {advertiser === '전체 광고주' ? '(전체 광고주 합산 기준)' : `(${advertiser})`}</p></div><button className="btn secondary" onClick={()=>setSettingsOpen(true)}><ChevronDown size={15}/> 표시 지표 {selectedColumns.length}개</button></div><div className="table-scroll"><table className="ops-table"><thead><tr><th style={{cursor:'pointer'}} onClick={()=>toggleSort('platform')}>매체{sortArrow('platform')}</th><th>상태</th>{selectedColumns.map(c=>{const keyMap:Record<string,SortKey|undefined>={'광고비':'spend','클릭':'clicks','DB':'db','계약':'contracts','매출':'revenue'};const key=keyMap[c];return <th key={c} style={key?{cursor:'pointer'}:undefined} onClick={key?()=>toggleSort(key):undefined}>{c}{key?sortArrow(key):''}</th>;})}</tr></thead><tbody>{sortedRows.map(r=><tr key={r.platform}><td><b>{r.platform}</b></td><td><span className="status-pill success">{r.status}</span></td>{selectedColumns.map(c=><td key={c}>{c==='광고비'?money(r.spend):c==='클릭'?r.clicks.toLocaleString():c==='DB'?r.db:c==='유효 DB'?r.validDb:c==='계약'?r.contracts:c==='상품 조회'?r.itemViews.toLocaleString():c==='장바구니'?r.carts:c==='결제 시작'?r.checkouts:c==='구매'?r.purchases:c==='CPA'?(r.contracts?money(r.spend/r.contracts):'-'):c==='매출'?money(r.revenue):c==='ROAS'?(r.spend?`${Math.round(r.revenue/r.spend*100)}%`:'-'):'-'}</td>)}</tr>)}<tr className="total-row"><td><b>전체 합계</b></td><td>-</td>{selectedColumns.map(c=><td key={c}><b>{c==='광고비'?money(total.spend):c==='클릭'?total.clicks.toLocaleString():c==='DB'?total.db:c==='유효 DB'?total.validDb:c==='계약'?total.contracts:c==='상품 조회'?total.itemViews.toLocaleString():c==='장바구니'?total.carts:c==='결제 시작'?total.checkouts:c==='구매'?total.purchases:c==='CPA'?(total.contracts?money(total.spend/total.contracts):'-'):c==='매출'?money(total.revenue):c==='ROAS'?(total.spend?`${Math.round(total.revenue/total.spend*100)}%`:'-'):'-'}</b></td>)}</tr></tbody></table></div></section>
    {saved&&<div className="save-toast"><CheckCircle2 size={16}/>퍼널 표시 설정이 저장되었습니다.</div>}
    {settingsOpen&&<div className="modal-backdrop" onClick={()=>setSettingsOpen(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>퍼널 표시 설정</h3><p>비교표에서 확인할 지표를 선택하세요.</p></div><button className="icon-btn" onClick={()=>setSettingsOpen(false)}><X size={18}/></button></div><div className="check-grid">{columns.map(c=><label key={c}><input type="checkbox" checked={selectedColumns.includes(c)} onChange={()=>setSelectedColumns(selectedColumns.includes(c)?selectedColumns.filter(x=>x!==c):[...selectedColumns,c])}/>{c}</label>)}</div><div className="modal-actions"><button className="btn secondary" onClick={()=>setSettingsOpen(false)}>취소</button><button className="btn primary" onClick={()=>{setSaved(true);setSettingsOpen(false);setTimeout(()=>setSaved(false),2200)}}><Save size={15}/> 저장</button></div></div></div>}
  </>
}
