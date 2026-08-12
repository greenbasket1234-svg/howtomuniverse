import { useState } from 'react';
import { CalendarDays, MapPin, Plus, X, Save, CheckCircle2, CloudOff } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';

type SeasonItem={id:number,label:string,title:string,subtitle:string,status?:'진행중'|'예정',tone:string};

export function WeatherSeasonCalendarPage(){
 const [seasonItems,setSeasonItems]=useState<SeasonItem[]>([]);
 const [open,setOpen]=useState(false); const [toast,setToast]=useState('');
 const { filterValue } = useAdvertiserFilter();
 const advertiserName=filterValue.trim();
 const addSeason=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);setSeasonItems([...seasonItems,{id:Date.now(),label:String(f.get('label')||''),title:String(f.get('title')||''),subtitle:String(f.get('subtitle')||''),status:'예정',tone:String(f.get('tone')||'#2563eb')}]);setOpen(false);setToast('시즌 일정을 추가했습니다.');setTimeout(()=>setToast(''),2200)};
 return <>
  <PageHeader title="날씨 시즌 광고 캘린더" description={`${advertiserName ? `${advertiserName} · ` : ''}날씨·계절 데이터를 연결해 소재 추천과 시즌 캠페인 일정을 관리합니다.`} action={<button className="btn primary" onClick={()=>setOpen(true)}><Plus size={15}/> 시즌 일정 추가</button>}/>
  {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
  {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}
  <section className="card ops-card weather-week-panel">
    <div className="ops-card-head"><div><h3>이번 주 날씨 기반 광고 제안</h3><p><MapPin size={13}/> 실제 날씨 API 연결 후 지역별 예보와 추천이 표시됩니다.</p></div></div>
    <div className="empty-state" style={{padding:'42px 20px'}}><CloudOff size={32}/><b>연결된 날씨 데이터가 없습니다.</b><span>날씨 API 또는 지역 정보를 연결하면 이 영역에 일별 예보와 광고 제안이 표시됩니다.</span></div>
  </section>
  <div className="season-capture-grid">
    <section className="card ops-card"><h3>날씨별 소재 추천 룰</h3><div className="empty-state" style={{padding:'34px 20px'}}><CalendarDays size={28}/><b>등록된 날씨 추천 룰이 없습니다.</b><span>실제 날씨 데이터가 연결되면 업종·광고주 기준 추천 룰을 추가할 수 있습니다.</span></div></section>
    <section className="card ops-card"><h3>시즌 광고 캘린더</h3>{seasonItems.length===0?<div className="empty-state" style={{padding:'34px 20px'}}><CalendarDays size={28}/><b>등록된 시즌 일정이 없습니다.</b><span>상단의 ‘시즌 일정 추가’에서 첫 일정을 등록하세요.</span></div>:<div className="season-capture-list">{seasonItems.map(item=><div className="season-capture-row" key={item.id}><div className="season-label-box" style={{background:item.tone}}>{item.label}</div><div><b>{item.title}</b><small>{item.subtitle}</small></div>{item.status&&<button className={`status-pill ${item.status==='진행중'?'success':'warning'}`} onClick={()=>setSeasonItems(seasonItems.map(x=>x.id===item.id?{...x,status:x.status==='진행중'?'예정':'진행중'}:x))}>{item.status}</button>}</div>)}</div>}</section>
  </div>
  {open&&<div className="modal-backdrop" onClick={()=>setOpen(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>시즌 일정 추가</h3><button className="icon-btn" onClick={()=>setOpen(false)}><X size={18}/></button></div><form className="final-form" onSubmit={addSeason}><label>라벨<input name="label" placeholder="예: 8월" required/></label><label>일정명<input name="title" required/></label><label>설명<input name="subtitle" required/></label><label>색상<input name="tone" type="color" defaultValue="#2563eb"/></label><div className="action-row"><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>취소</button><button className="btn primary" type="submit"><Save size={15}/> 저장</button></div></form></div></div>}
 </>
}
