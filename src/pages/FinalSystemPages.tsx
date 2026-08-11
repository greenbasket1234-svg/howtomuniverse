import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Plus, Search, Trash2, CheckCircle2, CalendarDays, Save, Play, Pause, RotateCcw, Bell, CloudSun, Wand2, ClipboardCheck, History, Users, SlidersHorizontal, FileDown, X, Edit3, Upload, AlertTriangle, Sparkles } from 'lucide-react';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { CHANNELS, Advertiser } from '../data/advertisers';
import { filterByAdvertiser } from '../utils/advertiserMatch';
import { useSearchParams } from 'react-router-dom';
import { clearCreativeBrief, loadCreativeBrief } from '../utils/creativeBriefStore';
import { loadAssets } from '../utils/assetStore';

type Row = Record<string, any> & { id:number };
const ADVERTISERS=['다방이사','다시마전복수산','서울우리아이치과','온동물병원','완도군수산'];
function useStoredRows(key:string, initial:Row[]){
  const [rows,setRows]=useState<Row[]>(()=>{try{const raw=localStorage.getItem(key); return raw?JSON.parse(raw):initial}catch{return initial}});
  useEffect(()=>{localStorage.setItem(key,JSON.stringify(rows))},[key,rows]);
  return [rows,setRows] as const;
}
function Toolbar({query,setQuery,children}:{query:string;setQuery:(v:string)=>void;children?:React.ReactNode}){return <div className="ops-toolbar"><div className="ops-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="광고주 또는 항목 검색"/></div>{children}</div>}
function Metric({label,value,sub}:{label:string;value:string;sub?:string}){return <div className="ops-stat"><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return <div className="modal-backdrop"><div className="modal-card final-modal"><div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>{children}</div></div>}
function Btn({children,onClick,kind='primary',disabled=false}:{children:React.ReactNode;onClick?:()=>void;kind?:'primary'|'secondary'|'danger';disabled?:boolean}){return <button disabled={disabled} onClick={onClick} className={'btn '+kind}>{children}</button>}

export function TodayOperationsPage(){
 const cards=[['오늘 실행 예정 광고','6건','09:00 Meta 캠페인 외 5건'],['승인 대기 자동화','3건','예산 증액 2건 · 소재 중지 1건'],['예약 부족 슬롯','4건','금요일 저녁 중심'],['데이터 수집 실패','1건','Google Ads 토큰 확인 필요'],['소재 피로도 위험','2건','교체 권장'],['오늘 마감 태스크','5건','담당자 확인 필요']];
 return <><PageHeader title="오늘의 운영 현황" description="오늘 처리해야 할 광고 운영 업무와 위험 신호를 한눈에 확인합니다."/><div className="ops-stat-grid">{cards.slice(0,4).map(x=><Metric key={x[0]} label={x[0]} value={x[1]} sub={x[2]}/>)}</div><div className="ops-two-col"><section className="card ops-card"><h3>우선 처리 업무</h3>{cards.map((x,i)=><div className="action-list-row" key={x[0]}><span className={'status-dot '+(i===3?'danger':i<2?'warning':'success')}/><div><b>{x[0]}</b><small>{x[2]}</small></div><strong>{x[1]}</strong><button className="btn secondary">열기</button></div>)}</section><section className="card ops-card"><h3>운영 타임라인</h3>{['07:00 전일 데이터 마감','08:00 AI 성과 분석 완료','09:00 일일 브리핑 발송','11:00 자동화 승인 검토','16:00 예약률 재점검','18:00 캠페인 종료 확인'].map((x,i)=><div className="timeline-row" key={x}><span>{String(i+7).padStart(2,'0')}:00</span><b>{x.replace(/^\d{2}:\d{2} /,'')}</b></div>)}</section></div></>
}

export function ReservationReportPage(){
 const rows=[['다방','주말 오후','120','94','78.3%','₩1,840,000','₩19,574'],['갈비연','저녁 단체석','80','68','85.0%','₩1,220,000','₩17,941'],['온동물병원','건강검진','60','39','65.0%','₩940,000','₩24,103']];
 return <><PageHeader title="예약 매출 보고서" description="예약 슬롯, 광고비, 예약 매출과 예약당 비용을 분석합니다."/><div className="ops-stat-grid"><Metric label="전체 슬롯" value="260개"/><Metric label="예약 완료" value="201개"/><Metric label="평균 예약률" value="77.3%"/><Metric label="예약 매출" value="₩18,420,000"/></div><section className="card ops-card"><table className="ops-table"><thead><tr>{['광고주','구분','전체 슬롯','예약','예약률','광고비','예약당 비용'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r[0]+r[1]}>{r.map((v,i)=><td key={i}><b>{i===0?v:''}</b>{i!==0&&v}</td>)}</tr>)}</tbody></table></section></>
}

export function CreativeRequestPage(){
 const initial=[{id:1,brand:'다방이사',title:'7월 수영장 릴스 3종',type:'세로 영상',owner:'김디자인',due:'2026-07-10',status:'제작중'},{id:2,brand:'완도군수산',title:'단체예약 배너',type:'정사각형',owner:'박디자인',due:'2026-07-12',status:'검수'}];
 const [rows,setRows]=useStoredRows('acc-creative-requests',initial); const [open,setOpen]=useState(false);
 const [searchParams]=useSearchParams(); const sourceCreativeId=searchParams.get('sourceCreative')||''; const sourceAssetId=searchParams.get('sourceAsset')||''; const sourceAsset=sourceAssetId?loadAssets(true).find(a=>a.assetId===sourceAssetId):undefined; const brief=loadCreativeBrief(sourceCreativeId||undefined);
 const { filterValue } = useAdvertiserFilter();
 const visible = filterByAdvertiser(rows, filterValue, r => r.brand);
 const sourceAdvertiser=brief?.advertiserName||sourceAsset?.advertiserName||''; const advertisers=sourceAdvertiser&&!ADVERTISERS.includes(sourceAdvertiser)?[sourceAdvertiser,...ADVERTISERS]:ADVERTISERS;
 const suggestedType=brief?.creativeType==='영상'||sourceAsset?.assetType==='video'?'세로 영상':brief?.creativeType==='이미지'||sourceAsset?.assetType==='image'?'정사각형 이미지':'가로 배너';
 const add=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);setRows([...rows,{id:Date.now(),brand:f.get('brand'),title:f.get('title'),type:f.get('type'),owner:f.get('owner'),due:f.get('due'),status:'대기',sourceCreativeId:sourceCreativeId||undefined,sourceAssetId:sourceAssetId||undefined,brief:brief||undefined}]);clearCreativeBrief();setOpen(false)};
 return <><PageHeader title="소재 제작 요청" description="광고 소재 제작부터 검수, 승인, 라이브러리 등록까지 관리합니다."/>{filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
 {sourceAsset&&!brief&&<section className="card ops-card" style={{marginBottom:14,borderColor:'#bfdbfe',background:'#f8fbff'}}><div className="ops-card-head"><div style={{display:'flex',gap:10,alignItems:'flex-start'}}><Sparkles size={20} color="#2563eb"/><div><h3 style={{margin:0}}>자산관리에서 전달된 제작 기준</h3><p style={{margin:'5px 0 0',color:'#64748b'}}>{sourceAsset.advertiserName||'공통 자산'} · {sourceAsset.name} · {sourceAsset.assetType==='video'?'영상':'이미지'} 자산</p></div></div><Btn onClick={()=>setOpen(true)}><Wand2 size={15}/> 이 자산으로 요청 등록</Btn></div></section>}
 {brief&&<section className="card ops-card" style={{marginBottom:14,borderColor:'#bfdbfe',background:'#f8fbff'}}><div className="ops-card-head"><div style={{display:'flex',gap:10,alignItems:'flex-start'}}><Sparkles size={20} color="#2563eb"/><div><h3 style={{margin:0}}>소재 분석에서 전달된 제작 브리프</h3><p style={{margin:'5px 0 0',color:'#64748b'}}>{brief.advertiserName} · 기준 소재 {brief.sourceCreativeId} · 목표 지표 {brief.objectiveMetric}</p></div></div><Btn onClick={()=>setOpen(true)}><Wand2 size={15}/> 이 브리프로 요청 등록</Btn></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:14}}><div><b style={{display:'block',marginBottom:6}}>유지할 요소</b><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{brief.winningElements.length?brief.winningElements.map(x=><span key={x} className="status-pill success">{x}</span>):<span className="muted">분석된 우수 요소 없음</span>}</div></div><div><b style={{display:'block',marginBottom:6}}>개선할 요소</b><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{brief.weakElements.length?brief.weakElements.map(x=><span key={x} className="status-pill warning">{x}</span>):<span className="muted">특정 개선 요소 없음</span>}</div></div></div></section>}
 <section className="card ops-card"><div className="ops-card-head"><h3>제작 요청</h3><Btn onClick={()=>setOpen(true)}><Plus size={15}/> 요청 등록</Btn></div><table className="ops-table"><thead><tr><th>광고주</th><th>요청명</th><th>유형</th><th>담당자</th><th>마감일</th><th>상태</th><th/></tr></thead><tbody>{visible.map(r=><tr key={r.id}><td>{r.brand}</td><td><b>{r.title}</b>{r.sourceCreativeId&&<small style={{display:'block',color:'#64748b'}}>분석 기반 · {r.sourceCreativeId}</small>}</td><td>{r.type}</td><td>{r.owner}</td><td>{r.due}</td><td><select value={r.status} onChange={e=>setRows(rows.map(x=>x.id===r.id?{...x,status:e.target.value}:x))}>{['대기','제작중','검수','승인','완료'].map(s=><option key={s}>{s}</option>)}</select></td><td><button className="icon-btn danger" onClick={()=>setRows(rows.filter(x=>x.id!==r.id))}><Trash2 size={15}/></button></td></tr>)}</tbody></table></section>{open&&<Modal title="새 소재 제작 요청" onClose={()=>setOpen(false)}><form onSubmit={add} className="final-form"><label>광고주<select name="brand" defaultValue={sourceAdvertiser||ADVERTISERS[0]}>{advertisers.map(a=><option key={a}>{a}</option>)}</select></label><label>요청명<input name="title" required defaultValue={brief?`${brief.sourceCreativeId} 기반 변형 소재 제작`:sourceAsset?`${sourceAsset.name} 기반 변형 소재 제작`:''}/></label><label>소재 유형<select name="type" defaultValue={suggestedType}><option>정사각형 이미지</option><option>세로 영상</option><option>가로 배너</option></select></label>{brief&&<div style={{padding:10,border:'1px solid #e2e8f0',borderRadius:10,background:'#f8fafc'}}><b>분석 제작 방향</b><p style={{margin:'6px 0',fontSize:13,color:'#475569'}}>후킹: {brief.recommendedHook||'기존 우수 요소 유지'} · CTA: {brief.recommendedCta||'테스트 필요'}</p>{brief.recommendedLength&&<p style={{margin:0,fontSize:13,color:'#475569'}}>{brief.recommendedLength}</p>}</div>}<label>담당자<input name="owner" required/></label><label>마감일<input name="due" type="date" required/></label><div className="action-row"><Btn kind="secondary" onClick={()=>setOpen(false)}>취소</Btn><button className="btn primary" type="submit">저장</button></div></form></Modal>}</>
}

type ReservationSlotRow={id:number;date:string;dayType:'평일'|'주말';reserved:number;total:number;adSpend:number;action:string};
const initialReservationSlots:ReservationSlotRow[]=[
 {id:1,date:'2026-07-07',dayType:'평일',reserved:9,total:30,adSpend:120000,action:'광고 증액'},
 {id:2,date:'2026-07-08',dayType:'평일',reserved:12,total:30,adSpend:135000,action:'광고 증액'},
 {id:3,date:'2026-07-09',dayType:'평일',reserved:18,total:30,adSpend:142000,action:'유지'},
 {id:4,date:'2026-07-10',dayType:'평일',reserved:23,total:30,adSpend:155000,action:'유지'},
 {id:5,date:'2026-07-11',dayType:'주말',reserved:28,total:30,adSpend:88000,action:'광고 감액'},
 {id:6,date:'2026-07-12',dayType:'주말',reserved:30,total:30,adSpend:42000,action:'광고 중지'},
 {id:7,date:'2026-07-13',dayType:'평일',reserved:14,total:30,adSpend:126000,action:'광고 증액'},
 {id:8,date:'2026-07-14',dayType:'평일',reserved:16,total:30,adSpend:132000,action:'유지'},
];

export function ReservationSlotsManagerPage(){
 const [rows,setRows]=useStoredRows('acc-reservation-slots-v2',initialReservationSlots);
 const [open,setOpen]=useState(false); const [csvOpen,setCsvOpen]=useState(false); const [toast,setToast]=useState('');
 const { filterValue } = useAdvertiserFilter();
 // 이 페이지의 예약 슬롯 데이터는 광고주별로 나뉘어 있지 않고 '월컴투바베큐' 단일 데모입니다.
 // 다른 광고주로 필터링된 상태에서는 관련 없는 데이터를 보여주지 않기 위해 빈 상태로 안내합니다.
 const advertiserName = '월컴투바베큐';
 const isFilteredOut = filterValue.trim() && !filterByAdvertiser([advertiserName], filterValue, n => n).length;
 const total=rows.reduce((a,r)=>a+Number(r.total),0), reserved=rows.reduce((a,r)=>a+Number(r.reserved),0), spend=rows.reduce((a,r)=>a+Number(r.adSpend),0);
 const weekday=rows.filter(r=>r.dayType==='평일'), weekend=rows.filter(r=>r.dayType==='주말');
 const rate=(arr:Row[])=>{const t=arr.reduce((a,r)=>a+Number(r.total),0);return t?Math.round(arr.reduce((a,r)=>a+Number(r.reserved),0)/t*100):0};
 const add=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const total=Number(f.get('total')),reserved=Number(f.get('reserved'));const next={id:Date.now(),date:String(f.get('date')),dayType:String(f.get('dayType')) as '평일'|'주말',reserved,total,adSpend:Number(f.get('adSpend')),action:String(f.get('action'))};setRows([...rows,next]);setOpen(false);setToast('예약 슬롯을 추가했습니다.');setTimeout(()=>setToast(''),2200)};
 const importCsv=(csv:string)=>{const lines=csv.trim().split(/\r?\n/).slice(1);const imported=lines.filter(Boolean).map((line,i)=>{const [date,dayType,reserved,total,adSpend,action]=line.split(',');return {id:Date.now()+i,date,dayType:(dayType==='주말'?'주말':'평일') as '평일'|'주말',reserved:Number(reserved),total:Number(total),adSpend:Number(adSpend),action:action||'유지'}});if(imported.length){setRows([...rows,...imported]);setCsvOpen(false);setToast(`${imported.length}개 슬롯을 업로드했습니다.`);setTimeout(()=>setToast(''),2200)}};
 if (isFilteredOut) {
   return <>
    <PageHeader title="예약 슬롯 관리" description={`${advertiserName} — 예약 가능한 슬롯 기반 광고 예산 조정`}/>
    {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
    <section className="card ops-card"><p className="muted">이 페이지 데이터는 현재 &apos;{advertiserName}&apos; 광고주 기준으로만 제공됩니다. 필터를 해제하거나 &apos;{advertiserName}&apos;(으)로 검색해주세요.</p></section>
   </>;
 }
 return <>
  <PageHeader title="예약 슬롯 관리" description={`${advertiserName} — 예약 가능한 슬롯 기반 광고 예산 조정`} action={<button className="btn secondary" onClick={()=>setCsvOpen(true)}><Upload size={15}/> CSV 업로드</button>}/>
  {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
  <section className="reservation-demo-alert"><AlertTriangle size={24}/><div><b>현재 예약 슬롯은 데모 데이터입니다</b><p>예약 플랫폼 공개 API가 제한되어 일자별 슬롯을 직접 입력하거나 CSV로 업로드해 시뮬레이션합니다. 광고비·예약당 광고비는 실광고 데이터 연동 시 자동 계산됩니다.</p><button onClick={()=>setOpen(true)}>수동 입력 폼 열기</button></div></section>
  {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}
  <div className="reservation-kpi-grid"><Metric label="주말 예약률" value={`${rate(weekend)}%`}/><Metric label="평일 예약률" value={`${rate(weekday)}%`}/><Metric label="예약당 광고비" value={reserved?`₩${Math.round(spend/reserved).toLocaleString()}`:'₩0'} sub="최근 14일"/><Metric label="14일 총 예약" value={`${reserved}건`} sub={`${reserved}/${total} 슬롯`}/></div>
  <section className="card ops-card reservation-table-card"><div className="ops-card-head"><div><h3>다가오는 14일 예약 슬롯</h3><p>잔여 슬롯과 예약률에 따라 광고 조치를 추천합니다.</p></div><button className="btn primary" onClick={()=>setOpen(true)}><Plus size={15}/> 슬롯 추가</button></div><div className="table-scroll"><table className="ops-table"><thead><tr><th>날짜</th><th>구분</th><th>예약 / 전체</th><th>예약률</th><th>잔여</th><th>광고비</th><th>광고 조치</th><th></th></tr></thead><tbody>{rows.map(r=>{const rr=Math.round(Number(r.reserved)/Number(r.total)*100);return <tr key={r.id}><td><b>{r.date}</b></td><td><span className={`status-pill ${r.dayType==='주말'?'warning':'success'}`}>{r.dayType}</span></td><td>{r.reserved} / {r.total}</td><td><div className="reservation-rate"><div><i style={{width:`${rr}%`}}/></div><b>{rr}%</b></div></td><td>{Number(r.total)-Number(r.reserved)}</td><td>₩{Number(r.adSpend).toLocaleString()}</td><td><select value={r.action} onChange={e=>setRows(rows.map(x=>x.id===r.id?{...x,action:e.target.value}:x))}><option>광고 증액</option><option>유지</option><option>광고 감액</option><option>광고 중지</option></select></td><td><button className="icon-btn danger" onClick={()=>setRows(rows.filter(x=>x.id!==r.id))}><Trash2 size={15}/></button></td></tr>})}</tbody></table></div></section>
  {open&&<Modal title="예약 슬롯 추가" onClose={()=>setOpen(false)}><form onSubmit={add} className="final-form"><label>날짜<input name="date" type="date" required/></label><label>구분<select name="dayType"><option>평일</option><option>주말</option></select></label><label>예약 수<input name="reserved" type="number" min="0" required/></label><label>전체 슬롯<input name="total" type="number" min="1" required/></label><label>광고비<input name="adSpend" type="number" min="0" required/></label><label>광고 조치<select name="action"><option>광고 증액</option><option>유지</option><option>광고 감액</option><option>광고 중지</option></select></label><div className="action-row"><Btn kind="secondary" onClick={()=>setOpen(false)}>취소</Btn><button className="btn primary" type="submit">저장</button></div></form></Modal>}
  {csvOpen&&<CsvSlotModal onClose={()=>setCsvOpen(false)} onImport={importCsv}/>}
 </>
}

function CsvSlotModal({onClose,onImport}:{onClose:()=>void;onImport:(csv:string)=>void}){
 const [csv,setCsv]=useState('date,dayType,reserved,total,adSpend,action\n2026-07-15,평일,10,30,120000,광고 증액');
 return <Modal title="예약 슬롯 CSV 업로드" onClose={onClose}><p className="modal-help">첫 행은 date, dayType, reserved, total, adSpend, action 순서로 입력합니다.</p><textarea className="csv-textarea" rows={8} value={csv} onChange={e=>setCsv(e.target.value)}/><div className="action-row"><Btn kind="secondary" onClick={onClose}>취소</Btn><Btn onClick={()=>onImport(csv)}><Upload size={15}/> 업로드</Btn></div></Modal>
}

export function ReservationAnalysisPage(){
 const data=[['월','42%','₩38,200'],['화','51%','₩31,840'],['수','58%','₩29,410'],['목','67%','₩25,220'],['금','82%','₩18,900'],['토','94%','₩14,200'],['일','88%','₩16,500']];
 return <><PageHeader title="예약률 분석" description="요일·시간대·상품별 예약률과 광고 효율을 비교합니다."/><div className="ops-stat-grid"><Metric label="평균 예약률" value="68.9%"/><Metric label="취소율" value="4.2%"/><Metric label="노쇼율" value="1.8%"/><Metric label="평균 예약당 비용" value="₩24,038"/></div><div className="ops-two-col"><section className="card ops-card"><h3>요일별 예약률</h3>{data.map(r=><div className="bar-row" key={r[0]}><b>{r[0]}</b><div className="mini-progress"><i style={{width:r[1]}}/></div><strong>{r[1]}</strong><span>{r[2]}</span></div>)}</section><section className="card ops-card"><h3>병목 구간</h3>{[['평일 오전','예약률 31%','광고 확장 필요'],['금요일 저녁','잔여 18석','긴급 프로모션 권장'],['토요일 오후','예약률 96%','광고 중지 권장']].map(x=><div className="action-list-row" key={x[0]}><div><b>{x[0]}</b><small>{x[1]}</small></div><span className="status-pill warning">{x[2]}</span></div>)}</section></div></>
}

type BudgetRecRow = {
  id: number; brand: string; platform: string;
  currentSpend: number; proposedSpend: number;
  efficiencyLabel: string; efficiencyCurrent: string; efficiencyBenchmark: string;
  reason: string; action: '증액' | '감액' | '유지';
  enabled: boolean; // 실행 ON/OFF
  schedule: '상시 적용' | string; // 예: '금요일 저녁 9시 OFF'
};
const WEEKDAY_NAMES = ['일','월','화','수','목','금','토'];
function BudgetScheduleEditor({ row, onSave, onClose }: { row: BudgetRecRow; onSave: (schedule: string) => void; onClose: () => void }) {
  const isAlways = row.schedule === '상시 적용';
  const [mode, setMode] = useState<'always' | 'custom'>(isAlways ? 'always' : 'custom');
  const [day, setDay] = useState(isAlways ? '금' : row.schedule.slice(0, 1));
  const [timeOfDay, setTimeOfDay] = useState(isAlways ? '저녁 9시' : row.schedule.replace(/^./, '').replace(/^\s*/, '').split(' ').slice(0, -1).join(' ') || '저녁 9시');
  const [toggle, setToggle] = useState<'OFF' | 'ON'>(isAlways ? 'OFF' : (row.schedule.endsWith('ON') ? 'ON' : 'OFF'));
  const save = () => onSave(mode === 'always' ? '상시 적용' : `${day}요일 ${timeOfDay} ${toggle}`);
  return <Modal title={`${row.brand} · ${row.platform} 실행 대상 설정`} onClose={onClose}>
    <div className="final-form">
      <label>적용 방식
        <select value={mode} onChange={e => setMode(e.target.value as 'always' | 'custom')}>
          <option value="always">상시 적용</option>
          <option value="custom">특정 요일·시간대 지정</option>
        </select>
      </label>
      {mode === 'custom' && <>
        <label>요일<select value={day} onChange={e => setDay(e.target.value)}>{WEEKDAY_NAMES.map(d => <option key={d}>{d}</option>)}</select></label>
        <label>시간대<select value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)}>{['새벽 6시','아침 9시','점심 12시','오후 3시','저녁 6시','저녁 9시','밤 11시'].map(t => <option key={t}>{t}</option>)}</select></label>
        <label>동작<select value={toggle} onChange={e => setToggle(e.target.value as 'OFF' | 'ON')}><option>OFF</option><option>ON</option></select></label>
      </>}
      <button className="btn primary" type="button" onClick={save}>저장</button>
    </div>
  </Modal>;
}
export function BudgetRecommendationsPage(){
 // 예약률·잔여 슬롯이 아니라, 광고주·매체별 실제 효율 지표(CPA·ROAS 등)를 기준으로 증액/감액을
 // 판단합니다. 대상 시간대는 광고주별로 실행 요일·시간을 직접 지정할 수 있습니다.
 const initial: BudgetRecRow[] = [
   { id: 1, brand: '다방이사', platform: 'Meta', currentSpend: 300000, proposedSpend: 372000, efficiencyLabel: 'CPA', efficiencyCurrent: '₩9,800', efficiencyBenchmark: '평균 ₩13,200 대비 26% 우수', reason: '최근 7일 CPA가 계정 평균보다 26% 낮아 효율이 높습니다. 예산을 늘려 성과 볼륨을 확보합니다.', action: '증액', enabled: true, schedule: '상시 적용' },
   { id: 2, brand: '완도군수산', platform: '카페24', currentSpend: 450000, proposedSpend: 342000, efficiencyLabel: 'ROAS', efficiencyCurrent: '312%', efficiencyBenchmark: '평균 480% 대비 35% 저조', reason: '최근 7일 ROAS가 계정 평균보다 35% 낮습니다. 예산을 줄이고 소재·타기팅 점검 후 재평가합니다.', action: '감액', enabled: true, schedule: '금요일 저녁 9시 OFF' },
   { id: 3, brand: '서울우리아이치과', platform: '네이버', currentSpend: 220000, proposedSpend: 220000, efficiencyLabel: 'CPC', efficiencyCurrent: '₩1,450', efficiencyBenchmark: '평균 ₩1,480 대비 안정', reason: '클릭 효율이 평균과 비슷한 수준으로 안정적입니다. 현재 예산을 유지하며 소재 교체 테스트를 병행합니다.', action: '유지', enabled: false, schedule: '상시 적용' },
 ];
 const [rows,setRows]=useStoredRows('acc-budget-recommendations-v2',initial) as unknown as [BudgetRecRow[], (rows: BudgetRecRow[]) => void];
 const [editingSchedule, setEditingSchedule] = useState<BudgetRecRow | null>(null);
 const { filterValue } = useAdvertiserFilter();
 const visible: BudgetRecRow[] = filterByAdvertiser(rows, filterValue, r => r.brand);
 const actionColor = (action: BudgetRecRow['action']) => action === '증액' ? '#15803d' : action === '감액' ? '#c2410c' : '#475569';
 const actionBg = (action: BudgetRecRow['action']) => action === '증액' ? '#dcfce7' : action === '감액' ? '#ffedd5' : '#e2e8f0';
 return <><PageHeader title="광고비 조정 제안" description="광고주·매체별 실제 효율(CPA·ROAS 등)을 분석해 예산 증액·감액을 제안합니다. 예약률이나 잔여 슬롯이 아니라 성과 데이터 기준입니다."/>{filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}<section className="card ops-card"><table className="ops-table"><thead><tr><th>광고주</th><th>매체</th><th>현재 광고비</th><th>제안 광고비</th><th>효율 지표</th><th>제안 근거</th><th>실행</th><th>대상</th></tr></thead><tbody>{visible.map(r=>
   <tr key={r.id}>
     <td><b>{r.brand}</b></td>
     <td>{r.platform}</td>
     <td>₩{r.currentSpend.toLocaleString()}</td>
     <td><b>₩{r.proposedSpend.toLocaleString()}</b>{r.currentSpend > 0 && r.action !== '유지' && <small style={{ display: 'block', color: actionColor(r.action) }}>{r.proposedSpend > r.currentSpend ? '+' : ''}{Math.round((r.proposedSpend / r.currentSpend - 1) * 100)}%</small>}</td>
     <td><span style={{ padding: '3px 8px', borderRadius: 999, background: actionBg(r.action), color: actionColor(r.action), fontWeight: 800, fontSize: 12 }}>{r.action}</span><small style={{ display: 'block', marginTop: 4 }}>{r.efficiencyLabel} {r.efficiencyCurrent}</small><small style={{ display: 'block', color: '#94a3b8' }}>{r.efficiencyBenchmark}</small></td>
     <td style={{ maxWidth: 260, whiteSpace: 'normal', fontSize: 12.5, color: '#475569' }}>{r.reason}</td>
     <td><button type="button" className={'toggle ' + (r.enabled ? 'on' : '')} title={r.enabled ? '실행 활성 — 이 제안이 적용됩니다' : '실행 비활성'} onClick={() => setRows(rows.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x))}><span/></button></td>
     <td><button type="button" className="btn secondary sm" onClick={() => setEditingSchedule(r)}>{r.schedule}</button></td>
   </tr>
 )}</tbody></table>{visible.length===0&&<p className="muted">해당 광고주의 제안이 없습니다.</p>}</section>
 {editingSchedule && <BudgetScheduleEditor row={editingSchedule} onClose={() => setEditingSchedule(null)} onSave={(schedule) => { setRows(rows.map(x => x.id === editingSchedule.id ? { ...x, schedule } : x)); setEditingSchedule(null); }}/>}
 </>
}

export function SeasonPlannerPage(){
 const initial=[{id:1,brand:'다방이사',season:'여름 휴가',start:'2026-07-10',end:'2026-08-20',budget:5000000,status:'기획중'},{id:2,brand:'완도군수산',season:'복날',start:'2026-07-15',end:'2026-07-25',budget:2500000,status:'진행중'}]; const [rows,setRows]=useStoredRows('acc-season-plans',initial); const [open,setOpen]=useState(false);
 const { filterValue } = useAdvertiserFilter();
 const visible = filterByAdvertiser(rows, filterValue, r => r.brand);
 const add=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);setRows([...rows,{id:Date.now(),brand:f.get('brand'),season:f.get('season'),start:f.get('start'),end:f.get('end'),budget:Number(f.get('budget')),status:'기획중'}]);setOpen(false)};
 return <><PageHeader title="시즌 캠페인 플래너" description="계절과 이벤트에 맞춰 캠페인, 예산, 소재와 KPI를 계획합니다."/>{filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}<section className="card ops-card"><div className="ops-card-head"><h3>시즌 캠페인</h3><Btn onClick={()=>setOpen(true)}><Plus size={15}/> 계획 추가</Btn></div>{visible.map(r=><div className="schedule-row" key={r.id}><div className="schedule-icon"><CloudSun size={19}/></div><div className="schedule-main"><b>{r.season}</b><span>{r.brand}</span></div><div><small>기간</small><b>{r.start} ~ {r.end}</b></div><div><small>예산</small><b>₩{r.budget.toLocaleString()}</b></div><select value={r.status} onChange={e=>setRows(rows.map(x=>x.id===r.id?{...x,status:e.target.value}:x))}>{['기획중','승인대기','진행중','완료'].map(s=><option key={s}>{s}</option>)}</select></div>)}</section>{open&&<Modal title="시즌 캠페인 계획" onClose={()=>setOpen(false)}><form onSubmit={add} className="final-form"><label>광고주<select name="brand">{ADVERTISERS.map(a=><option key={a}>{a}</option>)}</select></label><label>시즌<select name="season">{['봄맞이','장마','여름 휴가','복날','추석','연말'].map(s=><option key={s}>{s}</option>)}</select></label><label>시작일<input name="start" type="date" required/></label><label>종료일<input name="end" type="date" required/></label><label>예산<input name="budget" type="number" required/></label><button className="btn primary" type="submit">저장</button></form></Modal>}</>
}

export function PromotionSchedulePage(){
 const initial=[{id:1,brand:'갈비연',name:'복날 전복 특가',start:'2026-07-15',end:'2026-07-25',discount:'20%',goal:'예약 250건',status:'예정'}]; const [rows,setRows]=useStoredRows('acc-promotions',initial); const [open,setOpen]=useState(false);
 const { filterValue } = useAdvertiserFilter();
 const visible = filterByAdvertiser(rows, filterValue, r => r.brand);
 return <><PageHeader title="프로모션 일정" description="프로모션 기간, 목표, 할인과 연결 캠페인을 관리합니다."/>{filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}<section className="card ops-card"><div className="ops-card-head"><h3>프로모션</h3><Btn onClick={()=>setOpen(true)}><Plus size={15}/> 프로모션 추가</Btn></div><table className="ops-table"><thead><tr><th>광고주</th><th>프로모션</th><th>기간</th><th>혜택</th><th>목표</th><th>상태</th></tr></thead><tbody>{visible.map(r=><tr key={r.id}><td>{r.brand}</td><td><b>{r.name}</b></td><td>{r.start} ~ {r.end}</td><td>{r.discount}</td><td>{r.goal}</td><td><select value={r.status} onChange={e=>setRows(rows.map(x=>x.id===r.id?{...x,status:e.target.value}:x))}>{['예정','진행중','종료'].map(s=><option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table></section>{open&&<Modal title="프로모션 등록" onClose={()=>setOpen(false)}><form className="final-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setRows([...rows,{id:Date.now(),brand:f.get('brand'),name:f.get('name'),start:f.get('start'),end:f.get('end'),discount:f.get('discount'),goal:f.get('goal'),status:'예정'}]);setOpen(false)}}><label>광고주<select name="brand">{ADVERTISERS.map(a=><option key={a}>{a}</option>)}</select></label><label>프로모션명<input name="name" required/></label><label>시작일<input name="start" type="date" required/></label><label>종료일<input name="end" type="date" required/></label><label>혜택<input name="discount" placeholder="예: 20%"/></label><label>목표<input name="goal" placeholder="예: 예약 250건"/></label><button className="btn primary" type="submit">저장</button></form></Modal>}</>
}

export function CustomerAnalyticsPage(){
 const segments=[['신규 고객','1,284명','₩32,400'],['재구매 고객','428명','₩8,900'],['재예약 고객','214명','₩11,200'],['고가치 고객','96명','₩5,480']];
 return <><PageHeader title="고객 데이터 분석" description="신규·재구매·재예약 고객과 고객 획득 비용, 생애가치를 분석합니다."/><div className="ops-stat-grid"><Metric label="신규 고객" value="1,284명"/><Metric label="재구매율" value="24.8%"/><Metric label="평균 CAC" value="₩26,930"/><Metric label="예상 LTV" value="₩184,200"/></div><div className="ops-two-col"><section className="card ops-card"><h3>고객 세그먼트</h3>{segments.map(x=><div className="action-list-row" key={x[0]}><div><b>{x[0]}</b><small>평균 획득 비용 {x[2]}</small></div><strong>{x[1]}</strong><button className="btn secondary">캠페인 생성</button></div>)}</section><section className="card ops-card"><h3>유입 매체별 고객</h3>{[['Meta','42%'],['네이버','31%'],['Google','18%'],['기타','9%']].map(x=><div className="bar-row" key={x[0]}><b>{x[0]}</b><div className="mini-progress"><i style={{width:x[1]}}/></div><strong>{x[1]}</strong></div>)}</section></div></>
}

export function ApprovalQueuePage(){
 const initial=[{id:1,type:'예산 증액',brand:'다방',target:'Meta 여름 캠페인',before:'₩300,000',after:'₩360,000',requester:'자동화 규칙',status:'대기'},{id:2,type:'소재 중지',brand:'갈비연',target:'복날 배너 A',before:'ON',after:'OFF',requester:'피로도 감지',status:'대기'}]; const [rows,setRows]=useStoredRows('acc-approvals',initial);
 const { filterValue } = useAdvertiserFilter();
 const visible = filterByAdvertiser(rows, filterValue, r => r.brand);
 return <><PageHeader title="승인 대기함" description="자동화와 광고 운영 변경 요청을 검토하고 승인 또는 반려합니다."/>{filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}<section className="card ops-card">{visible.map(r=><div className="approval-card" key={r.id}><div><span className="status-pill warning">{r.type}</span><h3>{r.target}</h3><p>{r.brand} · 요청 출처 {r.requester}</p></div><div className="approval-diff"><span>{r.before}</span><b>→</b><strong>{r.after}</strong></div><div className="action-row">{r.status==='대기'?<><Btn kind="secondary" onClick={()=>setRows(rows.map(x=>x.id===r.id?{...x,status:'반려'}:x))}>반려</Btn><Btn onClick={()=>setRows(rows.map(x=>x.id===r.id?{...x,status:'승인 완료'}:x))}>승인</Btn></>:<span className="status-pill success">{r.status}</span>}</div></div>)}{visible.length===0&&<p className="muted">해당 광고주의 승인 요청이 없습니다.</p>}</section></>
}

export function OperationsHistoryPage(){
 const rows=[['07-06 10:20','예산 변경','다방','Meta 캠페인','₩300,000 → ₩360,000','관리자'],['07-06 09:00','광고 ON','갈비연','복날 캠페인','예약 실행','시스템'],['07-06 08:02','보고서 발송','전체','일일 브리핑','텔레그램','시스템'],['07-05 17:40','소재 중지','다방','수영장 릴스 03','피로도 위험','김마케터']];
 const { filterValue } = useAdvertiserFilter();
 const visible = filterByAdvertiser(rows, filterValue, r => r[2]);
 return <><PageHeader title="운영 이력" description="예산, 광고 상태, 소재, 보고서, 연동 변경 이력을 추적합니다."/>{filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}<section className="card ops-card"><table className="ops-table"><thead><tr><th>시각</th><th>유형</th><th>광고주</th><th>대상</th><th>내용</th><th>실행자</th></tr></thead><tbody>{visible.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{j===1?<span className="status-pill success">{v}</span>:v}</td>)}</tr>)}</tbody></table>{visible.length===0&&<p className="muted">해당 광고주의 이력이 없습니다.</p>}</section></>
}

export function AdvertiserManagementPage(){
 const [advertisers,setAdvertisers]=useAdvertisers();
 const { filterValue } = useAdvertiserFilter();
 const [query,setQuery]=useState('');
 const [editing,setEditing]=useState<Advertiser|null>(null);
 const [toast,setToast]=useState('');
 const filtered=advertisers.filter(r=>matchesAdvertiserFilter(r.name,filterValue)&&r.name.includes(query.trim()));
 const createBlank=():Advertiser=>({id:'',name:'',monthlyBudget:0,color:'#2563eb',initial:'',links:CHANNELS.map(channel=>({channel,status:'미연동',keyRegistered:false}))});
 const saveAdvertiser=(e:React.FormEvent<HTMLFormElement>)=>{
   e.preventDefault();
   if(!editing)return;
   const f=new FormData(e.currentTarget);
   const name=String(f.get('name')||'').trim();
   if(!name)return;
   const next:Advertiser={
     ...editing,
     id:editing.id||`${name.toLowerCase().replace(/[^a-z0-9가-힣]+/g,'-')}-${Date.now()}`,
     name,
     initial:name.slice(0,1),
     monthlyBudget:Number(f.get('monthlyBudget')||0),
     color:String(f.get('color')||'#2563eb'),
   };
   setAdvertisers(current=>current.some(item=>item.id===next.id)?current.map(item=>item.id===next.id?next:item):[...current,next]);
   setEditing(null);
   setToast(`${name} 광고주 정보가 저장되었습니다.`);
   setTimeout(()=>setToast(''),2200);
 };
 return <>
   <PageHeader title="광고주 관리" description="광고주를 등록하면 광고계정 연동과 브랜드 예산 화면에 자동 반영됩니다." action={<Btn onClick={()=>setEditing(createBlank())}><Plus size={15}/> 광고주 등록</Btn>}/>
   <Toolbar query={query} setQuery={setQuery}><span className="status-pill success">등록 광고주 {advertisers.length}개</span></Toolbar>
   {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}
   <section className="card ops-card">
     <div className="table-scroll"><table className="ops-table"><thead><tr><th>광고주</th><th>월 예산</th><th>연동 채널</th><th>브랜드 색상</th><th>관리</th></tr></thead><tbody>
       {filtered.map(r=><tr key={r.id}>
         <td><div className="advertiser-name-cell"><span style={{background:r.color}}>{r.initial}</span><b>{r.name}</b></div></td>
         <td>{`₩${r.monthlyBudget.toLocaleString()}`}</td>
         <td>{r.links.filter(link=>link.status==='연결됨').length}개 / {CHANNELS.length}개</td>
         <td><span className="advertiser-color-preview" style={{background:r.color}}/></td>
         <td><div className="action-row compact"><button className="btn secondary" onClick={()=>setEditing(r)}><Edit3 size={14}/> 수정</button><button className="icon-btn danger" onClick={()=>{if(confirm(`${r.name} 광고주를 삭제할까요?`))setAdvertisers(current=>current.filter(x=>x.id!==r.id))}}><Trash2 size={15}/></button></div></td>
       </tr>)}
       {!filtered.length&&<tr><td colSpan={5}><div className="empty-panel">검색 결과가 없습니다.</div></td></tr>}
     </tbody></table></div>
   </section>
   {editing&&<Modal title={editing.id?'광고주 수정':'광고주 등록'} onClose={()=>setEditing(null)}><form className="final-form" onSubmit={saveAdvertiser}>
     <label>광고주명<input name="name" defaultValue={editing.name} required placeholder="예: 다방"/></label>
     <label>월 예산<input name="monthlyBudget" type="number" min="0" step="10000" defaultValue={editing.monthlyBudget} required/></label>
     <label>브랜드 색상<input name="color" type="color" defaultValue={editing.color}/></label>
     <div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setEditing(null)}>취소</button><button className="btn primary" type="submit"><Save size={15}/> 저장</button></div>
   </form></Modal>}
 </>
}

export function KpiConversionSettingsPage(){
 const [saved,setSaved]=useState(false); const [funnel,setFunnel]=useState('예약형');
 return <><PageHeader title="KPI 및 전환 설정" description="광고주별 핵심 KPI와 표준 전환 이벤트를 설정합니다."/><div className="ops-two-col"><section className="card ops-card"><h3>기본 KPI</h3><label className="field-label">광고주<select>{ADVERTISERS.map(a=><option key={a}>{a}</option>)}</select></label><label className="field-label">퍼널 유형<select value={funnel} onChange={e=>setFunnel(e.target.value)}><option>상담형</option><option>커머스형</option><option>예약형</option><option>혼합형</option></select></label><div className="form-grid"><label className="field-label">월 목표 전환<input type="number" defaultValue="120"/></label><label className="field-label">목표 CPA<input type="number" defaultValue="18000"/></label><label className="field-label">목표 ROAS<input type="number" defaultValue="400"/></label><label className="field-label">유효 DB 기준<input defaultValue="연락 가능 + 중복 아님"/></label></div></section><section className="card ops-card"><h3>전환 이벤트 매핑</h3>{(funnel==='예약형'?['페이지 조회','날짜 선택','예약 완료','방문','재예약']:funnel==='커머스형'?['상품 조회','장바구니','결제 시작','구매','재구매']:['DB','유효 DB','상담','예약','계약']).map((x,i)=><div className="mapping-row" key={x}><b>{x}</b><select defaultValue={['page_view','select_date','reservation','visit','repeat'][i]||'lead'}><option>page_view</option><option>lead</option><option>reservation</option><option>purchase</option><option>contract</option><option>custom_event</option></select></div>)}<Btn onClick={()=>setSaved(true)}><Save size={15}/> 저장</Btn>{saved&&<div className="save-toast"><CheckCircle2 size={16}/> KPI 및 전환 설정을 저장했습니다.</div>}</section></div></>
}

export function DataCollectionStatusPage(){
 const [toast,setToast]=useState('');
 const { filterValue } = useAdvertiserFilter();
 const allRows=[
  {brand:'RS컴퍼니',channel:'Meta',status:'성공',last:'2026-07-12 07:02',rows:'1,284행',issue:'없음'},
  {brand:'다시마전복수산',channel:'네이버',status:'성공',last:'2026-07-12 07:04',rows:'842행',issue:'없음'},
  {brand:'서울우리아이치과',channel:'Google Ads',status:'주의',last:'2026-07-11 23:55',rows:'318행',issue:'토큰 만료 예정'},
  {brand:'온동물병원',channel:'카카오',status:'실패',last:'2026-07-11 07:00',rows:'0행',issue:'API 권한 확인 필요'},
  {brand:'완도군수산',channel:'당근마켓',status:'성공',last:'2026-07-12 07:08',rows:'226행',issue:'없음'},
  {brand:'운명백과',channel:'틱톡',status:'대기',last:'연동 전',rows:'0행',issue:'계정 연결 필요'},
 ];
 const rows = filterByAdvertiser(allRows, filterValue, r => r.brand);
 const total=rows.length, success=rows.filter(r=>r.status==='성공').length, failed=rows.filter(r=>r.status==='실패').length;
 const totalCollectedRows = rows.reduce((sum,r)=>sum+Number(String(r.rows).replace(/[^\d]/g,'')||0),0);
 return <>
  <PageHeader title="데이터 수집 현황" description="매체별 수집 성공 여부, 마지막 업데이트, 누락 데이터를 확인하고 재수집합니다." action={<button className="btn primary" onClick={()=>{setToast('전체 데이터 재수집을 요청했습니다.');setTimeout(()=>setToast(''),2200)}}><RotateCcw size={15}/> 전체 재수집</button>}/>
  {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}
  {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
  <div className="ops-stat-grid"><Metric label="연동 매체" value={`${total}개`}/><Metric label="수집 성공" value={`${success}개`}/><Metric label="수집 실패" value={`${failed}개`}/><Metric label="오늘 수집 행" value={`${totalCollectedRows.toLocaleString()}행`}/></div>
  <section className="card ops-card"><div className="ops-card-head"><div><h3>광고주별 데이터 수집 상태</h3><p>Google Sheets, 광고 API, 업로드 데이터의 수집 상태를 한곳에서 점검합니다.</p></div></div><div className="table-scroll"><table className="ops-table"><thead><tr><th>광고주</th><th>매체</th><th>상태</th><th>마지막 수집</th><th>수집량</th><th>점검 내용</th><th></th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.brand+r.channel}><td><b>{r.brand}</b></td><td>{r.channel}</td><td><span className={`status-pill ${r.status==='성공'?'success':r.status==='실패'?'danger':'warning'}`}>{r.status}</span></td><td>{r.last}</td><td>{r.rows}</td><td>{r.issue}</td><td><button className="btn secondary mini" onClick={()=>{setToast(`${r.brand} ${r.channel} 재수집을 요청했습니다.`);setTimeout(()=>setToast(''),2200)}}>재수집</button></td></tr>)}</tbody></table></div></section>
  <section className="card ops-card"><h3>권장 점검 순서</h3><div className="action-list-row"><span className="status-dot danger"/><div><b>수집 실패 매체 우선 확인</b><small>API 토큰, 권한, 웹훅 URL, 시트 접근 권한을 확인합니다.</small></div></div><div className="action-list-row"><span className="status-dot warning"/><div><b>수집 지연 매체 확인</b><small>전일 데이터가 오늘 보고서에 반영되지 않았는지 확인합니다.</small></div></div><div className="action-list-row"><span className="status-dot success"/><div><b>정상 수집 데이터 검증</b><small>광고비, DB, 매출 합계가 보고서와 일치하는지 확인합니다.</small></div></div></section>
 </>
}

export function AdvertiserShareLinksPage(){
 const [links,setLinks]=useStoredRows('acc-share-links-v1',[
  {id:1,brand:'RS컴퍼니',title:'7월 장기리스 보고서',url:'https://HOWTOM_Universe.example/share/rs-july',expires:'2026-07-31',permission:'조회 전용',status:'활성'},
  {id:2,brand:'온동물병원',title:'스케일링 캠페인 일일보고',url:'https://HOWTOM_Universe.example/share/on-daily',expires:'2026-07-20',permission:'PDF 다운로드 허용',status:'활성'},
 ]);
 const { filterValue } = useAdvertiserFilter();
 const visibleLinks = filterByAdvertiser(links, filterValue, l => l.brand);
 const [open,setOpen]=useState(false); const [toast,setToast]=useState('');
 const copy=async(url:string)=>{try{await navigator.clipboard.writeText(url);setToast('공유 링크를 복사했습니다.')}catch{setToast('복사 권한이 없어 URL을 직접 선택해 복사해주세요.')}setTimeout(()=>setToast(''),2200)};
 const add=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const brand=String(f.get('brand'));const title=String(f.get('title'));setLinks([{id:Date.now(),brand,title,url:`https://HOWTOM_Universe.example/share/${Date.now()}`,expires:String(f.get('expires')),permission:String(f.get('permission')),status:'활성'},...links]);setOpen(false);setToast('광고주 공유 링크를 생성했습니다.');setTimeout(()=>setToast(''),2200)};
 return <>
  <PageHeader title="광고주 공유 링크" description="광고주에게 보고서를 안전하게 공유할 링크를 만들고 만료일과 권한을 관리합니다." action={<button className="btn primary" onClick={()=>setOpen(true)}><Plus size={15}/> 새 공유 링크</button>}/>
  {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}
  {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
  <div className="ops-stat-grid"><Metric label="활성 링크" value={`${visibleLinks.filter(l=>l.status==='활성').length}개`}/><Metric label="전체 링크" value={`${visibleLinks.length}개`}/><Metric label="7일 내 만료" value={`${visibleLinks.filter(l=>{const d=(new Date(String(l.expires)).getTime()-Date.now())/86400000;return d>=0&&d<=7}).length}개`}/><Metric label="다운로드 허용" value={`${visibleLinks.filter(l=>String(l.permission).includes('다운로드')).length}개`}/></div>
  <section className="card ops-card"><div className="ops-card-head"><div><h3>공유 링크 목록</h3><p>광고주별 공개 범위, 만료일, 다운로드 허용 여부를 관리합니다.</p></div></div><div className="table-scroll"><table className="ops-table"><thead><tr><th>광고주</th><th>공유 보고서</th><th>권한</th><th>만료일</th><th>상태</th><th>링크</th><th></th></tr></thead><tbody>{visibleLinks.map(l=><tr key={l.id}><td><b>{l.brand}</b></td><td>{l.title}</td><td>{l.permission}</td><td>{l.expires}</td><td><span className="status-pill success">{l.status}</span></td><td><code>{l.url}</code></td><td><button className="btn secondary mini" onClick={()=>copy(String(l.url))}>복사</button><button className="icon-btn danger" onClick={()=>setLinks(links.filter(x=>x.id!==l.id))}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div></section>
  {open&&<Modal title="새 광고주 공유 링크" onClose={()=>setOpen(false)}><form onSubmit={add} className="final-form"><label>광고주<select name="brand">{ADVERTISERS.map(a=><option key={a}>{a}</option>)}</select></label><label>공유 보고서명<input name="title" required placeholder="예: 7월 2주차 성과 보고서"/></label><label>권한<select name="permission"><option>조회 전용</option><option>PDF 다운로드 허용</option><option>CSV 다운로드 허용</option><option>전체 다운로드 허용</option></select></label><label>만료일<input name="expires" type="date" required/></label><div className="action-row"><Btn kind="secondary" onClick={()=>setOpen(false)}>취소</Btn><button className="btn primary" type="submit">생성</button></div></form></Modal>}
 </>
}
