import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, Plus, X, Save, CheckCircle2, CloudOff, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { weatherApi, type WeatherInfo, type WeatherRule, type SeasonEventRow } from '../utils/weatherApi';

const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '수원', '성남', '고양'];
const CONDITION_LABEL: Record<string, string> = { rain: '비', snow: '눈', hot: '더위', cold: '추위', clear: '맑음', clouds: '흐림' };

export function WeatherSeasonCalendarPage(){
  const [seasonItems,setSeasonItems]=useState<SeasonEventRow[]>([]);
  const [open,setOpen]=useState(false); const [toast,setToast]=useState('');
  const { filterValue } = useAdvertiserFilter();
  const advertiserName=filterValue.trim();

  const [region,setRegion]=useState('서울');
  const [weatherConfigured,setWeatherConfigured]=useState<boolean|null>(null);
  const [weather,setWeather]=useState<WeatherInfo|null>(null);
  const [matched,setMatched]=useState<WeatherRule[]>([]);
  const [weatherError,setWeatherError]=useState('');
  const [weatherLoading,setWeatherLoading]=useState(false);

  const [rules,setRules]=useState<WeatherRule[]>([]);
  const [ruleOpen,setRuleOpen]=useState(false);

  const reload=async()=>{
    try{ setSeasonItems(await weatherApi.seasonEvents.list()); }catch{ /* 목록 비어있는 정도는 무시 */ }
    try{ setRules(await weatherApi.rules.list()); }catch{ /* ignore */ }
  };
  useEffect(()=>{ void reload(); },[]);

  const loadWeather=async(r:string)=>{
    setWeatherLoading(true); setWeatherError('');
    try{
      const status=await weatherApi.status();
      setWeatherConfigured(status.configured);
      if(!status.configured)return;
      const data=await weatherApi.suggestions(r);
      setWeather(data.weather); setMatched(data.matched);
    }catch(e){ setWeatherError(e instanceof Error?e.message:'날씨 정보를 가져오지 못했습니다.'); }
    finally{ setWeatherLoading(false); }
  };
  useEffect(()=>{ void loadWeather(region); },[region]);

  const addSeason=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();const f=new FormData(e.currentTarget);
    await weatherApi.seasonEvents.create({date:new Date().toISOString().slice(0,10),label:String(f.get('label')||''),title:String(f.get('title')||''),subtitle:String(f.get('subtitle')||''),tone:String(f.get('tone')||'#2563eb')});
    setOpen(false);setToast('시즌 일정을 추가했습니다.');setTimeout(()=>setToast(''),2200); void reload();
  };
  const toggleSeasonStatus=async(item:SeasonEventRow)=>{ await weatherApi.seasonEvents.toggleStatus(item.id, item.status==='진행중'?'예정':'진행중'); void reload(); };
  const removeSeason=async(id:string)=>{ await weatherApi.seasonEvents.remove(id); void reload(); };

  const addRule=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();const f=new FormData(e.currentTarget);
    await weatherApi.rules.create({condition:String(f.get('condition')||'rain'),recommendedMessage:String(f.get('message')||''),industry:String(f.get('industry')||'')||undefined,tempMin:f.get('tempMin')?Number(f.get('tempMin')):undefined,tempMax:f.get('tempMax')?Number(f.get('tempMax')):undefined});
    setRuleOpen(false); void reload(); void loadWeather(region);
  };
  const removeRule=async(id:string)=>{ await weatherApi.rules.remove(id); void reload(); void loadWeather(region); };

  return <>
   <PageHeader title="날씨 시즌 광고 캘린더" description={`${advertiserName ? `${advertiserName} · ` : ''}날씨·계절 데이터를 연결해 소재 추천과 시즌 캠페인 일정을 관리합니다.`} action={<button className="btn primary" onClick={()=>setOpen(true)}><Plus size={15}/> 시즌 일정 추가</button>}/>
   {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
   {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}
   <section className="card ops-card weather-week-panel">
     <div className="ops-card-head"><div><h3>이번 주 날씨 기반 광고 제안</h3><p><MapPin size={13}/> {weatherConfigured===false?'실제 날씨 API 연결 후 지역별 예보와 추천이 표시됩니다.':'선택한 지역의 현재 날씨 기준 추천입니다.'}</p></div>
       {weatherConfigured&&<select value={region} onChange={e=>setRegion(e.target.value)} style={{marginLeft:'auto'}}>{REGIONS.map(r=><option key={r} value={r}>{r}</option>)}</select>}
     </div>
     {weatherConfigured===false&&<div className="empty-state" style={{padding:'42px 20px'}}><CloudOff size={32}/><b>연결된 날씨 데이터가 없습니다.</b><span>날씨 API 또는 지역 정보를 연결하면 이 영역에 일별 예보와 광고 제안이 표시됩니다.</span></div>}
     {weatherConfigured&&weatherLoading&&<div className="empty-state" style={{padding:'42px 20px'}}><span>불러오는 중...</span></div>}
     {weatherConfigured&&!weatherLoading&&weatherError&&<div className="empty-state" style={{padding:'42px 20px'}}><CloudOff size={32}/><b>날씨 정보를 가져오지 못했습니다.</b><span>{weatherError}</span></div>}
     {weatherConfigured&&!weatherLoading&&!weatherError&&weather&&<div style={{padding:'20px'}}>
       <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16}}>
         {weather.icon&&<img src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`} alt="" width={56} height={56}/>}
         <div><b style={{fontSize:22}}>{weather.tempC!=null?`${Math.round(weather.tempC)}°C`:'-'}</b><div className="footnote">{weather.description} · {region} · 습도 {weather.humidity}%</div></div>
       </div>
       {matched.length===0?<p className="footnote">지금 날씨({CONDITION_LABEL[weather.condition]||weather.condition})에 맞는 등록된 추천 룰이 없습니다.</p>:
         <div className="season-capture-list">{matched.map(m=><div className="season-capture-row" key={m.id}><div className="season-label-box" style={{background:'#2563eb'}}>{CONDITION_LABEL[m.condition]||m.condition}</div><div><b>{m.recommended_message}</b>{m.recommended_tags.length>0&&<small>{m.recommended_tags.join(', ')}</small>}</div></div>)}</div>}
     </div>}
   </section>
   <div className="season-capture-grid">
     <section className="card ops-card"><h3>날씨별 소재 추천 룰</h3>
       <div style={{padding:'0 20px 12px'}}><button className="btn secondary sm" onClick={()=>setRuleOpen(true)}><Plus size={13}/> 룰 추가</button></div>
       {rules.length===0?<div className="empty-state" style={{padding:'34px 20px'}}><CalendarDays size={28}/><b>등록된 날씨 추천 룰이 없습니다.</b><span>업종·광고주 기준 추천 룰을 추가할 수 있습니다.</span></div>:
         <div className="season-capture-list">{rules.map(r=><div className="season-capture-row" key={r.id}><div className="season-label-box" style={{background:r.enabled?'#2563eb':'#94a3b8'}}>{CONDITION_LABEL[r.condition]||r.condition}</div><div><b>{r.recommended_message}</b><small>{r.industry||'전체 업종'}{r.temp_min!=null?` · ${r.temp_min}도 이상`:''}{r.temp_max!=null?` · ${r.temp_max}도 이하`:''}</small></div><button className="icon-btn danger" onClick={()=>void removeRule(r.id)}><Trash2 size={14}/></button></div>)}</div>}
     </section>
     <section className="card ops-card"><h3>시즌 광고 캘린더</h3>{seasonItems.length===0?<div className="empty-state" style={{padding:'34px 20px'}}><CalendarDays size={28}/><b>등록된 시즌 일정이 없습니다.</b><span>상단의 '시즌 일정 추가'에서 첫 일정을 등록하세요.</span></div>:<div className="season-capture-list">{seasonItems.map(item=><div className="season-capture-row" key={item.id}><div className="season-label-box" style={{background:item.tone}}>{item.label}</div><div><b>{item.title}</b><small>{item.subtitle}</small></div><button className={`status-pill ${item.status==='진행중'?'success':'warning'}`} onClick={()=>void toggleSeasonStatus(item)}>{item.status}</button><button className="icon-btn danger" onClick={()=>void removeSeason(item.id)}><Trash2 size={14}/></button></div>)}</div>}</section>
   </div>
   {open&&<div className="modal-backdrop" onClick={()=>setOpen(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>시즌 일정 추가</h3><button className="icon-btn" onClick={()=>setOpen(false)}><X size={18}/></button></div><form className="final-form" onSubmit={e=>void addSeason(e)}><label>라벨<input name="label" placeholder="예: 8월" required/></label><label>일정명<input name="title" required/></label><label>설명<input name="subtitle" required/></label><label>색상<input name="tone" type="color" defaultValue="#2563eb"/></label><div className="action-row"><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>취소</button><button className="btn primary" type="submit"><Save size={15}/> 저장</button></div></form></div></div>}
   {ruleOpen&&<div className="modal-backdrop" onClick={()=>setRuleOpen(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>날씨별 소재 추천 룰 추가</h3><button className="icon-btn" onClick={()=>setRuleOpen(false)}><X size={18}/></button></div><form className="final-form" onSubmit={e=>void addRule(e)}>
     <label>날씨 조건<select name="condition" defaultValue="rain"><option value="rain">비</option><option value="snow">눈</option><option value="hot">더위</option><option value="cold">추위</option><option value="clear">맑음</option><option value="clouds">흐림</option></select></label>
     <label>업종(비워두면 전체 적용)<input name="industry" placeholder="예: 렌트카"/></label>
     <label>추천 메시지<input name="message" placeholder="예: 비 오는 날엔 실내 서비스 강조 소재 추천" required/></label>
     <label>최저 기온(더위 조건일 때만, 섭씨)<input name="tempMin" type="number" placeholder="예: 28"/></label>
     <label>최고 기온(추위 조건일 때만, 섭씨)<input name="tempMax" type="number" placeholder="예: 5"/></label>
     <div className="action-row"><button type="button" className="btn secondary" onClick={()=>setRuleOpen(false)}>취소</button><button className="btn primary" type="submit"><Save size={15}/> 저장</button></div>
   </form></div></div>}
  </>
}
