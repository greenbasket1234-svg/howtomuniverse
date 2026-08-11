import { useMemo, useState } from 'react';
import { CloudRain, Sun, CalendarDays, Sparkles, MapPin, Plus, Cloud, Umbrella, X, Save, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

type WeatherDay={day:string,date:string,icon:'sun'|'cloud'|'rain'|'partly';temp:number,copy:string};
type SeasonItem={id:number,label:string,title:string,subtitle:string,status?:'진행중'|'예정',tone:string};

const initialWeather:WeatherDay[]=[
 {day:'토',date:'7/11',icon:'sun',temp:31,copy:'수영장 가족 광고 증액'},
 {day:'일',date:'7/12',icon:'partly',temp:29,copy:'가족 광고 유지'},
 {day:'월',date:'7/13',icon:'rain',temp:24,copy:'텐트 바베큐 소재로 전환'},
 {day:'화',date:'7/14',icon:'rain',temp:23,copy:'텐트·기즈모 소재'},
 {day:'수',date:'7/15',icon:'cloud',temp:26,copy:'평일 방문 광고'},
 {day:'목',date:'7/16',icon:'sun',temp:30,copy:'주말 사전 예약 유도'},
 {day:'금',date:'7/17',icon:'sun',temp:32,copy:'주말 수영장 광고 강화'},
];

const initialSeasonItems:SeasonItem[]=[
 {id:1,label:'6월',title:'수영장 오픈',subtitle:'가족 수영장 바베큐',status:'진행중',tone:'#0ea5e9'},
 {id:2,label:'7월',title:'여름방학',subtitle:'가족·키즈룸 집중',status:'예정',tone:'#22c55e'},
 {id:3,label:'장마철',title:'비 와도 OK',subtitle:'텐트존·실내 강조',status:'진행중',tone:'#6366f1'},
 {id:4,label:'가을',title:'캠핑 감성',subtitle:'단풍·감성 바베큐',status:'예정',tone:'#f59e0b'},
 {id:5,label:'겨울',title:'난방·회식',subtitle:'실내·난방·회식·모임',status:'예정',tone:'#ef4444'},
];

function WeatherIcon({type}:{type:WeatherDay['icon']}){if(type==='sun')return <Sun size={34}/>;if(type==='rain')return <CloudRain size={34}/>;if(type==='partly')return <CloudSunIcon/>;return <Cloud size={34}/>}
function CloudSunIcon(){return <div className="weather-combo"><Sun size={24}/><Cloud size={22}/></div>}

export function WeatherSeasonCalendarPage(){
 const [weather,setWeather]=useState(initialWeather); const [seasonItems,setSeasonItems]=useState(initialSeasonItems);
 const [open,setOpen]=useState(false); const [toast,setToast]=useState('');
 const { filterValue } = useAdvertiserFilter();
 // 이 페이지의 날씨·시즌 데이터는 광고주별로 나뉘어 있지 않고 '월컴투바베큐' 단일 데모입니다.
 const advertiserName='월컴투바베큐';
 const isFilteredOut = filterValue.trim() && !matchesAdvertiserFilter(advertiserName, filterValue);
 const recommendations=useMemo(()=>[
  {label:'비 예보',icon:<CloudRain size={17}/>,text:'“비 와도 가능한 텐트 바베큐” 소재 추천'},
  {label:'폭염',icon:<Sun size={17}/>,text:'“수영장 있는 바베큐장” 소재 추천 + 예산 증액'},
  {label:'주말 맑음',icon:<Sun size={17}/>,text:'가족 야외 바베큐 광고 예산 증액'},
  {label:'장마철',icon:<Umbrella size={17}/>,text:'실내·텐트·키즈룸 소재 추천'},
 ],[]);
 const addSeason=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);setSeasonItems([...seasonItems,{id:Date.now(),label:String(f.get('label')),title:String(f.get('title')),subtitle:String(f.get('subtitle')),status:'예정',tone:String(f.get('tone')||'#2563eb')}]);setOpen(false);setToast('시즌 일정을 추가했습니다.');setTimeout(()=>setToast(''),2200)};
 if(isFilteredOut){
   return <>
    <PageHeader title="날씨 시즌 광고 캘린더" description={`${advertiserName} — 날씨·계절 기반 소재 추천과 시즌 캠페인 일정`}/>
    <div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>
    <section className="card ops-card"><p className="muted">이 페이지 데이터는 현재 &apos;{advertiserName}&apos; 광고주 기준으로만 제공됩니다. 필터를 해제하거나 &apos;{advertiserName}&apos;(으)로 검색해주세요.</p></section>
   </>;
 }
 return <>
  <PageHeader title="날씨 시즌 광고 캘린더" description={`${advertiserName} — 날씨·계절 기반 소재 추천과 시즌 캠페인 일정`} action={<button className="btn primary" onClick={()=>setOpen(true)}><Plus size={15}/> 시즌 일정 추가</button>}/>
  {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
  {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}
  <section className="card ops-card weather-week-panel"><div className="ops-card-head"><div><h3>이번 주 날씨 기반 광고 제안</h3><p><MapPin size={13}/> 광주 기준 · 예보는 데모 데이터</p></div></div><div className="weather-week-grid">{weather.map((w,i)=><button key={w.date} className="weather-day-card" onClick={()=>{const copy=prompt('광고 제안 문구를 수정하세요.',w.copy);if(copy)setWeather(weather.map((x,idx)=>idx===i?{...x,copy}:x))}}><span>{w.day}</span><WeatherIcon type={w.icon}/><strong>{w.temp}°</strong><small>{w.copy}</small></button>)}</div></section>
  <div className="season-capture-grid"><section className="card ops-card"><h3>날씨별 소재 추천 룰</h3><div className="weather-rule-list">{recommendations.map((r,i)=><div className="weather-rule-row" key={r.label}><div>{r.icon}<b>{r.label}</b></div><span>{r.text}</span><button className="btn secondary mini" onClick={()=>{setToast(`${r.label} 추천 룰을 승인 대기에 추가했습니다.`);setTimeout(()=>setToast(''),2200)}}>적용</button></div>)}</div></section><section className="card ops-card"><h3>시즌 광고 캘린더</h3><div className="season-capture-list">{seasonItems.map(item=><div className="season-capture-row" key={item.id}><div className="season-label-box" style={{background:item.tone}}>{item.label}</div><div><b>{item.title}</b><small>{item.subtitle}</small></div>{item.status&&<button className={`status-pill ${item.status==='진행중'?'success':'warning'}`} onClick={()=>setSeasonItems(seasonItems.map(x=>x.id===item.id?{...x,status:x.status==='진행중'?'예정':'진행중'}:x))}>{item.status}</button>}</div>)}</div></section></div>
  {open&&<div className="modal-backdrop" onClick={()=>setOpen(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>시즌 일정 추가</h3><button className="icon-btn" onClick={()=>setOpen(false)}><X size={18}/></button></div><form className="final-form" onSubmit={addSeason}><label>라벨<input name="label" placeholder="예: 8월" required/></label><label>일정명<input name="title" required/></label><label>설명<input name="subtitle" required/></label><label>색상<input name="tone" type="color" defaultValue="#2563eb"/></label><div className="action-row"><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>취소</button><button className="btn primary" type="submit"><Save size={15}/> 저장</button></div></form></div></div>}
 </>
}
