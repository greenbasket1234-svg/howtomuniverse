import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Folder, PencilLine, Plus, Search, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const won=(n:number)=>`₩${Math.round(n).toLocaleString()}`;
const SPEND:Record<string,number>={dabang:1716335,alrim:12480000,ales:3420000};

export function BrandsBudgetPage(){
 const [advertisers,setAdvertisers]=useAdvertisers(); const { filterValue } = useAdvertiserFilter(); const [query,setQuery]=useState(''); const [editing,setEditing]=useState<string|null>(null); const [budget,setBudget]=useState(''); const [toast,setToast]=useState('');
 const rows=useMemo(()=>advertisers.filter(a=>matchesAdvertiserFilter(a.name,filterValue)&&a.name.includes(query.trim())).map((a,i)=>{
   const spend=SPEND[a.id]??Math.round(a.monthlyBudget*(.08+i*.04));
   const BUSINESS_TYPES=['오프라인 예약 방문형','쇼핑몰 구매전환형','브랜딩 회원가입형'] as const;
   const KPI_LABELS=['예약당 ₩18,000 (CPA)','ROAS 400% (광고 수익률)','잠재고객 DB당 ₩12,000 (CPL)'] as const;
   const groupIndex=i%3;
   const businessType=BUSINESS_TYPES[groupIndex];
   const kpiLabel=KPI_LABELS[groupIndex];
   return {...a,spend,rate:a.monthlyBudget?spend/a.monthlyBudget*100:0,projection:Math.round(spend*3.1),businessType,kpiLabel};
 }),[advertisers,query,filterValue]);

 type GroupBy='none'|'advertiser'|'type'|'kpi';
 const [groupBy,setGroupBy]=useState<GroupBy>('none');
 type SortKey='name'|'budget'|'spend'|'rate';
 const [sortKey,setSortKey]=useState<SortKey>('name');
 const [sortDir,setSortDir]=useState<'asc'|'desc'>('asc');
 const sortRows=(list:typeof rows)=>[...list].sort((a,b)=>{
   const valueOf=(r:typeof a)=>sortKey==='name'?r.name:sortKey==='budget'?r.monthlyBudget:sortKey==='spend'?r.spend:r.rate;
   const av=valueOf(a), bv=valueOf(b);
   if(typeof av==='string'||typeof bv==='string') return sortDir==='asc'?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));
   return sortDir==='asc'?(av as number)-(bv as number):(bv as number)-(av as number);
 });
 const groups=useMemo(()=>{
   if(groupBy==='none'||groupBy==='advertiser') return [{label:'',items:sortRows(rows)}];
   const map=new Map<string,typeof rows>();
   rows.forEach(r=>{
     const key=groupBy==='type'?r.businessType:r.kpiLabel;
     if(!map.has(key)) map.set(key,[]);
     map.get(key)!.push(r);
   });
   return Array.from(map.entries()).map(([label,items])=>({label,items:sortRows(items)}));
 },[rows,groupBy,sortKey,sortDir]);

 const [openFolders,setOpenFolders]=useState<Set<string>>(new Set());
 const toggleFolder=(label:string)=>setOpenFolders(prev=>{const next=new Set(prev);if(next.has(label))next.delete(label);else next.add(label);return next;});
 const current=advertisers.find(a=>a.id===editing);
 const save=()=>{if(!current)return;setAdvertisers(prev=>prev.map(a=>a.id===current.id?{...a,monthlyBudget:Number(budget)||a.monthlyBudget}:a));setEditing(null);setToast('월 예산을 저장했습니다.');setTimeout(()=>setToast(''),2200)};

 return <><PageHeader title="브랜드 예산" description="사업 유형별 목표 KPI와 월 예산, 소진률을 관리합니다." action={<button className="btn primary" onClick={()=>alert('광고계정 연동에서 광고주를 먼저 등록하세요.')}><Plus size={15}/> 브랜드 추가</button>}/>
 <div className="brand-budget-toolbar"><div className="account-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="브랜드 이름 검색"/></div><span>등록 브랜드 {rows.length}개</span>
   <div style={{display:'flex',gap:6,marginLeft:'auto'}}>
     {([['none','전체'],['type','유형별'],['kpi','KPI별']] as const).map(([key,label])=>(
       <button key={key} className={`btn sm ${groupBy===key?'primary':'secondary'}`} onClick={()=>setGroupBy(key)}>{label}</button>
     ))}
   </div>
   <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12.5,color:'#64748b'}}>정렬
     <select value={sortKey} onChange={e=>setSortKey(e.target.value as SortKey)}><option value="name">브랜드명</option><option value="budget">월 예산</option><option value="spend">소진액</option><option value="rate">소진율</option></select>
   </label>
   <button type="button" className="btn secondary sm" onClick={()=>setSortDir(sortDir==='asc'?'desc':'asc')}>{sortDir==='asc'?'오름차순':'내림차순'}</button>
 </div>
 {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}
 {groups.map(group=>{
   const folderMode=groupBy==='type'||groupBy==='kpi';
   const isOpen=!folderMode||openFolders.has(group.label);
   return <div key={group.label||'all'} className={folderMode?'brand-budget-folder card':''} style={{marginBottom:folderMode?14:0}}>
     {folderMode && <button type="button" className="brand-budget-folder-head" onClick={()=>toggleFolder(group.label)}>
       <span><Folder size={18}/><strong>{group.label}</strong><em>{group.items.length}개 브랜드</em></span>
       {isOpen?<ChevronDown size={18}/>:<ChevronRight size={18}/>} 
     </button>}
     {isOpen && <div className={folderMode?'brand-budget-folder-body':''}><div className="brand-budget-grid">{group.items.map((r,i)=><section className="card brand-budget-card" key={r.id}><div className="brand-budget-head"><div><span className="brand-dot" style={{background:r.color}}/><h3>{r.name}</h3><p>{r.businessType}</p></div><button className="btn secondary mini" onClick={()=>{setEditing(r.id);setBudget(String(r.monthlyBudget))}}><PencilLine size={14}/> 예산 수정</button></div><div className="brand-budget-metrics"><div><span>월 예산</span><b>{won(r.monthlyBudget)}</b></div><div><span>소진액</span><b>{won(r.spend)}</b></div><div><span>소진율</span><b>{r.rate.toFixed(1)}%</b></div><div><span>월말 예상</span><b>{won(r.projection)}</b></div></div><div className="budget-progress"><i style={{width:`${Math.min(100,r.rate)}%`}}/></div><div className="brand-budget-footer"><span>목표 KPI</span><b>{r.kpiLabel}</b><span className={`status-pill ${r.rate>90?'warning':'success'}`}>{r.rate>90?'주의':'정상'}</span></div></section>)}</div></div>}
   </div>
 })}
 {current&&<div className="modal-backdrop" onClick={()=>setEditing(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>{current.name} 월 예산 수정</h3><p>변경한 예산은 대시보드와 예산 소진률에 즉시 반영됩니다.</p></div><button className="icon-btn" onClick={()=>setEditing(null)}><X size={18}/></button></div><label className="field-label">월 예산 (원)<input type="number" value={budget} onChange={e=>setBudget(e.target.value)}/></label><div className="modal-actions"><button className="btn secondary" onClick={()=>setEditing(null)}>취소</button><button className="btn primary" onClick={save}>저장</button></div></div></div>}</>
}
