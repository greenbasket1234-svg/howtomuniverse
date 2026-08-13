import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, Pencil, Trash2, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { adControlRepository } from '../repositories';
import { PLATFORM_LABEL, type PlatformKey, type ScheduleSlot, type SlotStatus, type SlotType } from '../types/operations';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const statusLabel:Record<SlotStatus,string>={planned:'계획',confirmed:'확정',approval:'승인 대기',in_progress:'진행 중',completed:'완료',delayed:'지연',cancelled:'취소',conflict:'충돌'};
const typeLabel:Record<SlotType,string>={campaign:'캠페인',creative:'소재 제작',report:'보고서',promotion:'프로모션',event:'이벤트'};
const platformOptions:PlatformKey[]=['meta','naver','google','karrot','kakao','tiktok','youtube','instagram','blog'];
const pad=(n:number)=>String(n).padStart(2,'0');

type SlotDraft = Omit<ScheduleSlot,'id'> & { id?: string };
const createDraft=(date=new Date().toISOString().slice(0,10)):SlotDraft=>({
  advertiserId:'',
  title:'',
  type:'creative',
  platform:'meta',
  startAt:`${date}T10:00`,
  endAt:`${date}T12:00`,
  owner:'',
  status:'planned',
  note:'',
});

export function ScheduleSlotsPage(){
  const [advertisers]=useAdvertisers();
  const [slots,setSlots]=useState<ScheduleSlot[]>([]);
  const [advertiser,setAdvertiser]=useState('all');
  const [type,setType]=useState<'all'|SlotType>('all');
  const [editorOpen,setEditorOpen]=useState(false);
  const [draft,setDraft]=useState<SlotDraft>(createDraft());
  const [saving,setSaving]=useState(false);
  const [loadError,setLoadError]=useState('');
  const { filterValue } = useAdvertiserFilter();
  const today = new Date();
  const [year,setYear]=useState(today.getFullYear());
  const [month,setMonth]=useState(today.getMonth());
  const [view,setView]=useState<'month'|'week'|'day'>('month');
  const [selectedDate,setSelectedDate]=useState(()=>new Date().toISOString().slice(0,10)); // 주간·일간 뷰 기준일

  // 이전엔 이 페이지의 광고주 드롭다운이 상단 전역 검색과 완전히 분리되어 있었습니다.
  // 전역 필터에 매칭되는 광고주가 있으면 자동으로 그 광고주를 선택합니다.
  useEffect(()=>{
    if(!filterValue.trim())return;
    const match=advertisers.find(a=>matchesAdvertiserFilter(a.name,filterValue));
    if(match)setAdvertiser(match.id);
  },[filterValue,advertisers]);

  useEffect(()=>{
    let active=true;
    adControlRepository.getScheduleSlots()
      .then(rows=>{if(active)setSlots(rows)})
      .catch(()=>{if(active){setSlots([]);setLoadError('저장소에서 일정을 불러오지 못했습니다.')}});
    return()=>{active=false};
  },[]);

  const daysInMonth=new Date(year,month+1,0).getDate();
  const days=Array.from({length:daysInMonth},(_,i)=>i+1);
  const firstDow=new Date(year,month,1).getDay();
  const goPrevMonth=()=>{ const ny=month===0?year-1:year, nm=month===0?11:month-1; setYear(ny); setMonth(nm); setSelectedDate(`${ny}-${pad(nm+1)}-01`); };
  const goNextMonth=()=>{ const ny=month===11?year+1:year, nm=month===11?0:month+1; setYear(ny); setMonth(nm); setSelectedDate(`${ny}-${pad(nm+1)}-01`); };
  const goToday=()=>{ const t=new Date(); setYear(t.getFullYear()); setMonth(t.getMonth()); setSelectedDate(`${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`); };
  // 월간 → 주간/일간으로 전환할 때는 selectedDate(월간에서 마지막으로 고른 날짜)를 그대로
  // 기준일로 씁니다. 반대로 주간·일간에서 다른 날짜로 이동하면 그 날짜가 속한 달로 월간
  // 화면의 year/month도 함께 갱신되어야, 다시 월간으로 돌아왔을 때 같은 달이 보입니다.
  const switchView=(next:'month'|'week'|'day')=>{
    setView(next);
    const d=new Date(selectedDate+'T00:00:00');
    setYear(d.getFullYear()); setMonth(d.getMonth());
  };
  const selectDate=(ds:string)=>{
    setSelectedDate(ds);
    const d=new Date(ds+'T00:00:00');
    setYear(d.getFullYear()); setMonth(d.getMonth());
  };
  // 주간 뷰: selectedDate가 속한 주(일~토) 7일. 일간 뷰: selectedDate 하루만.
  const weekDates=useMemo(()=>{
    const base=new Date(selectedDate+'T00:00:00');
    const dow=base.getDay();
    const start=new Date(base); start.setDate(base.getDate()-dow);
    return Array.from({length:7},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; });
  },[selectedDate]);
  const filtered=useMemo(()=>slots.filter(s=>(advertiser==='all'||s.advertiserId===advertiser)&&(type==='all'||s.type===type)),[slots,advertiser,type]);
  const upcoming=useMemo(()=>[...filtered].sort((a,b)=>a.startAt.localeCompare(b.startAt)).slice(0,8),[filtered]);

  function openNew(date?:string){setDraft(createDraft(date));setEditorOpen(true)}
  function openEdit(slot:ScheduleSlot){setDraft({...slot});setEditorOpen(true)}
  function closeEditor(){if(!saving)setEditorOpen(false)}
  function updateDraft<K extends keyof SlotDraft>(key:K,value:SlotDraft[K]){setDraft(prev=>({...prev,[key]:value}))}

  async function saveSlot(){
    if(!draft.title.trim()){alert('일정명을 입력해주세요.');return}
    if(!draft.owner.trim()){alert('담당자를 입력해주세요.');return}
    if(draft.endAt<draft.startAt){alert('종료 일시는 시작 일시보다 빠를 수 없습니다.');return}
    const slot:ScheduleSlot={...draft,id:draft.id??`s${Date.now()}`,title:draft.title.trim(),owner:draft.owner.trim()};
    setSaving(true);
    try{
      await adControlRepository.saveScheduleSlot(slot);
      setSlots(prev=>[...prev.filter(v=>v.id!==slot.id),slot]);
      setEditorOpen(false);
    }catch{
      alert('일정 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }finally{setSaving(false)}
  }

  async function deleteSlot(){
    if(!draft.id)return;
    if(!window.confirm(`“${draft.title}” 일정을 삭제할까요?`))return;
    setSaving(true);
    try{
      await adControlRepository.deleteScheduleSlot(draft.id);
      setSlots(prev=>prev.filter(v=>v.id!==draft.id));
      setEditorOpen(false);
    }catch{
      alert('일정 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }finally{setSaving(false)}
  }

  return <div><PageHeader title="예약 일정 및 이벤트 프로모션" description="캠페인 실행, 소재 제작, 프로모션, 보고서 마감 일정을 한 달력에서 관리합니다." action={<button className="btn btn-primary" onClick={()=>openNew()}><Plus size={15}/>새 일정 추가</button>}/>
    {loadError&&<div className="inline-notice warning">{loadError}</div>}
    {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경) · 드롭다운에도 자동 반영됩니다</div>}
    <div className="card compact-card"><div className="filter-row"><select className="select-control" value={advertiser} onChange={e=>setAdvertiser(e.target.value)}><option value="all">전체 광고주</option>{advertisers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><select className="select-control" value={type} onChange={e=>setType(e.target.value as 'all'|SlotType)}><option value="all">전체 일정</option><option value="campaign">캠페인</option><option value="creative">소재 제작</option><option value="report">보고서</option><option value="promotion">프로모션</option><option value="event">이벤트</option></select><div className="slot-legend"><span className="slot-type campaign">캠페인</span><span className="slot-type creative">소재</span><span className="slot-type report">보고서</span><span className="slot-type promotion">프로모션</span><span className="slot-type event">이벤트</span></div></div></div>
    <div className="calendar-layout"><div className="card calendar-card">
      <div className="calendar-toolbar">
        <button className="icon-btn" aria-label="이전" onClick={()=>{ if(view==='month')goPrevMonth(); else{ const d=new Date(selectedDate+'T00:00:00'); d.setDate(d.getDate()-(view==='week'?7:1)); selectDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`); } }}><ChevronLeft size={16}/></button>
        <strong>{view==='month' ? `${year}년 ${month+1}월` : view==='week' ? `${weekDates[0]} ~ ${weekDates[6]}` : selectedDate}</strong>
        <button className="icon-btn" aria-label="다음" onClick={()=>{ if(view==='month')goNextMonth(); else{ const d=new Date(selectedDate+'T00:00:00'); d.setDate(d.getDate()+(view==='week'?7:1)); selectDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`); } }}><ChevronRight size={16}/></button>
        <button className="btn secondary sm" onClick={goToday}>오늘</button>
        <div className="view-tabs">
          <button className={view==='month'?'active':''} onClick={()=>switchView('month')}>월간</button>
          <button className={view==='week'?'active':''} onClick={()=>switchView('week')}>주간</button>
          <button className={view==='day'?'active':''} onClick={()=>switchView('day')}>일간</button>
        </div>
      </div>
      {view==='month' && <div className="month-grid">{['일','월','화','수','목','금','토'].map(w=><div className="month-dow" key={w}>{w}</div>)}{Array.from({length:firstDow}).map((_,i)=><div className="month-cell muted" key={`b${i}`}/>)}{days.map(d=>{const ds=`${year}-${pad(month+1)}-${pad(d)}`;const daySlots=filtered.filter(s=>s.startAt.slice(0,10)===ds);return <div className={`month-cell${ds===selectedDate?' selected-cell':''}`} key={d} onClick={()=>selectDate(ds)} onDoubleClick={()=>openNew(ds)}><div className="month-day-row"><span className="month-day">{d}</span><button className="day-add-btn" aria-label={`${d}일 일정 추가`} onClick={e=>{e.stopPropagation();openNew(ds)}}><Plus size={12}/></button></div>{daySlots.slice(0,3).map(s=><button key={s.id} className={`calendar-event ${s.type} ${s.status==='conflict'?'event-conflict':''}`} title={`${s.title} 수정`} onClick={e=>{e.stopPropagation();openEdit(s)}}>{s.status==='conflict'&&<AlertTriangle size={10}/>}<span>{s.title}</span><Pencil size={10}/></button>)}{daySlots.length>3&&<div className="more-events">+{daySlots.length-3}개</div>}</div>})}</div>}
      {view==='week' && <div className="month-grid">{weekDates.map(ds=>{const d=new Date(ds+'T00:00:00');return <div className="month-dow" key={ds}>{['일','월','화','수','목','금','토'][d.getDay()]} {d.getDate()}일</div>})}{weekDates.map(ds=>{const daySlots=filtered.filter(s=>s.startAt.slice(0,10)===ds);return <div className="month-cell" key={ds} style={{minHeight:180}} onDoubleClick={()=>openNew(ds)}><div className="month-day-row"><button className="day-add-btn" aria-label="일정 추가" onClick={e=>{e.stopPropagation();openNew(ds)}}><Plus size={12}/></button></div>{daySlots.map(s=><button key={s.id} className={`calendar-event ${s.type} ${s.status==='conflict'?'event-conflict':''}`} title={`${s.title} 수정`} onClick={e=>{e.stopPropagation();openEdit(s)}}>{s.status==='conflict'&&<AlertTriangle size={10}/>}<span>{s.title}</span><Pencil size={10}/></button>)}{daySlots.length===0&&<div className="empty-mini">일정 없음</div>}</div>})}</div>}
      {view==='day' && (()=>{const daySlots=filtered.filter(s=>s.startAt.slice(0,10)===selectedDate).sort((a,b)=>a.startAt.localeCompare(b.startAt));return <div className="slot-side" style={{padding:'12px 4px'}}>{daySlots.length===0&&<div className="empty-mini">이 날짜에 등록된 일정이 없습니다.</div>}{daySlots.map(s=><button className="slot-list-item slot-list-button" key={s.id} onClick={()=>openEdit(s)}><div className={`slot-icon ${s.type}`}>{s.startAt.slice(11,16)}</div><div className="slot-list-copy"><strong>{s.title}</strong><p>{typeLabel[s.type]} · {s.platform?PLATFORM_LABEL[s.platform]:'공통'} · {s.owner}</p><span className={`slot-status ${s.status}`}>{statusLabel[s.status]}</span></div><Pencil className="slot-edit-icon" size={14}/></button>)}<button className="btn secondary" style={{marginTop:10}} onClick={()=>openNew(selectedDate)}><Plus size={14}/> 이 날짜에 일정 추가</button></div>})()}
      <div className="calendar-help">날짜의 + 버튼을 누르면 새 일정을 추가하고, 등록된 일정을 누르면 수정·삭제할 수 있습니다.</div>
    </div>
      <div className="card slot-side"><div className="card-title">다가오는 일정</div>{upcoming.length===0&&<div className="empty-mini">조건에 맞는 일정이 없습니다.</div>}{upcoming.map(s=><button className="slot-list-item slot-list-button" key={s.id} onClick={()=>openEdit(s)}><div className={`slot-icon ${s.type}`}>{new Date(s.startAt).getDate()}</div><div className="slot-list-copy"><strong>{s.title}</strong><p>{typeLabel[s.type]} · {s.platform?PLATFORM_LABEL[s.platform]:'공통'} · {s.owner}</p><span className={`slot-status ${s.status}`}>{statusLabel[s.status]}</span></div><Pencil className="slot-edit-icon" size={14}/></button>)}</div></div>
    {editorOpen&&<div className="modal-backdrop" onClick={closeEditor}><div className="modal-card schedule-editor" onClick={e=>e.stopPropagation()}><div className="modal-title-row"><div><div className="modal-title">{draft.id?'일정 수정':'새 일정 추가'}</div><p>{draft.id?'등록된 일정의 내용과 상태를 변경할 수 있습니다.':'캘린더에 표시할 일정을 등록합니다.'}</p></div><button className="icon-btn" onClick={closeEditor} aria-label="닫기"><X size={17}/></button></div><div className="form-grid"><label className="form-span-2">일정명<input value={draft.title} onChange={e=>updateDraft('title',e.target.value)} placeholder="예: Meta 여름 프로모션 캠페인 ON"/></label><label>유형<select value={draft.type} onChange={e=>updateDraft('type',e.target.value as SlotType)}><option value="creative">소재 제작</option><option value="campaign">캠페인</option><option value="report">보고서</option><option value="promotion">프로모션</option><option value="event">이벤트</option></select></label><label>상태<select value={draft.status} onChange={e=>updateDraft('status',e.target.value as SlotStatus)}>{Object.entries(statusLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>광고주<select value={draft.advertiserId} onChange={e=>updateDraft('advertiserId',e.target.value)}>{advertisers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>매체<select value={draft.platform??''} onChange={e=>updateDraft('platform',(e.target.value||undefined) as PlatformKey|undefined)}><option value="">공통 / 매체 없음</option>{platformOptions.map(p=><option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}</select></label><label>시작<input type="datetime-local" value={draft.startAt} onChange={e=>updateDraft('startAt',e.target.value)}/></label><label>종료<input type="datetime-local" value={draft.endAt} onChange={e=>updateDraft('endAt',e.target.value)}/></label><label className="form-span-2">담당자<input value={draft.owner} onChange={e=>updateDraft('owner',e.target.value)} placeholder="담당자 또는 팀명"/></label><label className="form-span-2">메모<textarea rows={3} value={draft.note??''} onChange={e=>updateDraft('note',e.target.value)} placeholder="승인 일정, 준비물, 충돌 사유 등을 입력하세요."/></label></div><div className="modal-actions split-actions"><div>{draft.id&&<button className="btn btn-danger" onClick={deleteSlot} disabled={saving}><Trash2 size={14}/>삭제</button>}</div><div className="action-group"><button className="btn" onClick={closeEditor} disabled={saving}>취소</button><button className="btn btn-primary" onClick={saveSlot} disabled={saving}>{saving?'저장 중…':draft.id?'수정 저장':'일정 등록'}</button></div></div></div></div>}
  </div>
}
