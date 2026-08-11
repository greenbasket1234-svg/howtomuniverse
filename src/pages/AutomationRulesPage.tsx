import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Plus, Play, Pencil, Copy, Trash2, X, Save, Sparkles } from 'lucide-react';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

type Rule = {
  id:number; folder:string; name:string; badge:'광고 OFF'|'알림'|'테스크'; scope:string; period:string; cadence:string;
  condition:string; action:string; mode:'관찰'|'자동'; enabled:boolean; runs:number; matches:number;
};

const defaults:Rule[]=[
{id:1,folder:'손실 방어',name:'무전환 과다지출 중지',badge:'광고 OFF',scope:'전체 브랜드',period:'최근 3일',cadence:'10분마다',condition:'광고비 ≥ 30,000 AND 전환/예약 = 0',action:'최소 노출 3,000',mode:'관찰',enabled:true,runs:8,matches:2},
{id:2,folder:'손실 방어',name:'CPA 목표 초과 중지',badge:'광고 OFF',scope:'전체 브랜드',period:'최근 7일',cadence:'10분마다',condition:'전환/예약 ≥ 1 AND CPA(원) > 30,000',action:'최소 노출 3,000',mode:'관찰',enabled:true,runs:8,matches:0},
{id:3,folder:'성과 모니터링',name:'ROAS 목표 미달 알림',badge:'알림',scope:'다시마전복수산',period:'최근 7일',cadence:'10분마다',condition:'광고비 ≥ 50,000 AND ROAS(%) < 200',action:'최소 노출 5,000',mode:'관찰',enabled:true,runs:8,matches:0},
{id:4,folder:'성과 모니터링',name:'CPM 급등 알림',badge:'알림',scope:'전체 브랜드',period:'최근 3일',cadence:'10분마다',condition:'CPM(₩) > 15,000',action:'최소 노출 10,000',mode:'관찰',enabled:true,runs:8,matches:0},
{id:5,folder:'소재 피로도',name:'피로도 85점 이상 OFF + 재세팅 태스크',badge:'테스크',scope:'전체 브랜드',period:'최근 30일',cadence:'10분마다',condition:'소재 피로도(점) ≥ 85',action:'최소 노출 5,000',mode:'관찰',enabled:true,runs:8,matches:0},
];

export function AutomationRulesPage(){
 const [rules,setRules]=useState<Rule[]>(()=>JSON.parse(localStorage.getItem('acc_rules')||'null')||defaults);
 const [tab,setTab]=useState<'rules'|'logs'|'approval'>('rules');
 const [query,setQuery]=useState('');
 const { filterValue } = useAdvertiserFilter();
 const [editing,setEditing]=useState<Rule|null>(null);
 const [showForm,setShowForm]=useState(false);
 const persist=(next:Rule[])=>{setRules(next);localStorage.setItem('acc_rules',JSON.stringify(next));};
 const grouped=useMemo(()=>{const list=rules.filter(r=>r.name.includes(query)&&(r.scope==='전체 브랜드'||matchesAdvertiserFilter(r.scope,filterValue)));return [...new Set(list.map(r=>r.folder))].map(folder=>({folder,items:list.filter(r=>r.folder===folder)}));},[rules,query,filterValue]);
 const runNow=()=>alert(`규칙 ${rules.filter(r=>r.enabled).length}개 평가를 실행했습니다.\n실제 광고 변경은 API 연동 후 적용됩니다.`);
 const save=(rule:Rule)=>{const next=rules.some(r=>r.id===rule.id)?rules.map(r=>r.id===rule.id?rule:r):[rule,...rules];persist(next);setEditing(null);setShowForm(false)};
 return <div><PageHeader title="자동화 룰" description="조건(ROAS·CPA·CPM·광고비·전환)을 정의하면 최근 성과로 평가해 자동 OFF하거나 알림을 보냅니다." action={<div className="action-row"><button className="btn primary" onClick={()=>{setEditing(null);setShowForm(true)}}><Plus size={15}/> 새 규칙</button><button className="btn secondary" onClick={runNow}><Play size={15}/> 지금 실행</button></div>}/>
 <div className="automation-notice"><b>자동 실행 규칙 0개</b><span>최근 N일 Meta 광고 성과 + 소재 피로도로 평가 · 규칙별 실행 주기 적용 · 승인 필요 규칙은 승인 대기로 이동합니다.</span></div>
 <div className="rule-presets">{['오늘 광고비 100만원 + 매출 0원 → OFF','ROAS 300%↑ → 예산 20% 증액','CPM 15,000원↑ → 알림','피로도 85점↑ → OFF + 태스크'].map(x=><button key={x} onClick={()=>alert(`${x}\n프리셋이 새 규칙 폼에 적용되었습니다.`)}><Sparkles size={13}/>{x}</button>)}</div>
 <div className="rule-tabs"><button className={tab==='rules'?'active':''} onClick={()=>setTab('rules')}>규칙 ({rules.length})</button><button className={tab==='logs'?'active':''} onClick={()=>setTab('logs')}>실행 로그 (50)</button><button className={tab==='approval'?'active':''} onClick={()=>setTab('approval')}>승인 대기 (0)</button></div>
 {tab==='rules'&&<><div className="rule-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="규칙 이름으로 검색"/></div>{grouped.map(g=><section key={g.folder} className="rule-folder"><h4>📁 {g.folder}</h4>{g.items.map(r=><article className="rule-card" key={r.id}><div className="rule-main"><div className="rule-title"><span className={`rule-badge ${r.badge==='알림'?'alert':r.badge==='테스크'?'task':''}`}>{r.badge}</span><b>{r.name}</b><small>· {r.scope} · {r.period} · {r.cadence}</small></div><p>{r.condition} · {r.action}</p><small>최근 실행 07-06 12:47 · 매칭 {r.matches} · 적용 {r.runs}회</small></div><div className="rule-actions"><button className="mode-btn">{r.mode}</button><button className={r.enabled?'on-chip':'off-chip'} onClick={()=>persist(rules.map(x=>x.id===r.id?{...x,enabled:!x.enabled}:x))}>{r.enabled?'ON':'OFF'}</button><button className="icon-btn" onClick={()=>{setEditing(r);setShowForm(true)}}><Pencil size={15}/></button><button className="icon-btn" onClick={()=>persist([{...r,id:Date.now(),name:r.name+' 복사본'},...rules])}><Copy size={15}/></button><button className="icon-btn danger" onClick={()=>confirm('규칙을 삭제할까요?')&&persist(rules.filter(x=>x.id!==r.id))}><Trash2 size={15}/></button></div></article>)}</section>)}</>}
 {tab==='logs'&&<div className="card ops-card"><h3>최근 실행 로그</h3>{rules.slice(0,5).map(r=><div className="log-line" key={r.id}><b>{r.name}</b><span>07-06 12:47 평가 완료 · 매칭 {r.matches}건 · 모드 {r.mode}</span></div>)}</div>}
 {tab==='approval'&&<div className="card ops-card empty-panel">승인 대기 중인 자동화 조치가 없습니다.</div>}
 {showForm&&<RuleModal initial={editing} onClose={()=>setShowForm(false)} onSave={save}/>}</div>
}
function RuleModal({initial,onClose,onSave}:{initial:Rule|null;onClose:()=>void;onSave:(r:Rule)=>void}){
 const [name,setName]=useState(initial?.name||''); const [folder,setFolder]=useState(initial?.folder||'기타'); const [scope,setScope]=useState(initial?.scope||'전체 브랜드'); const [condition,setCondition]=useState(initial?.condition||'ROAS(%) < 200'); const [action,setAction]=useState(initial?.action||'알림'); const [mode,setMode]=useState<Rule['mode']>(initial?.mode||'관찰');
 return <div className="modal-backdrop"><div className="modal-card wide"><div className="modal-head"><div><h3>{initial?'규칙 수정':'새 규칙'}</h3><p>조건, 평가 기간, 실행 주기와 조치를 설정합니다.</p></div><button className="icon-btn" onClick={onClose}><X/></button></div><div className="form-grid"><label className="field-label">규칙 이름<input value={name} onChange={e=>setName(e.target.value)}/></label><label className="field-label">폴더<select value={folder} onChange={e=>setFolder(e.target.value)}><option>손실 방어</option><option>성과 모니터링</option><option>소재 피로도</option><option>기타</option></select></label><label className="field-label">적용 브랜드<select value={scope} onChange={e=>setScope(e.target.value)}><option>전체 브랜드</option><option>월컴투바베큐</option><option>노멜</option></select></label><label className="field-label">실행 모드<select value={mode} onChange={e=>setMode(e.target.value as Rule['mode'])}><option>관찰</option><option>자동</option></select></label></div><label className="field-label">조건<input value={condition} onChange={e=>setCondition(e.target.value)}/></label><label className="field-label">조치<input value={action} onChange={e=>setAction(e.target.value)}/></label><div className="modal-actions"><button className="btn secondary" onClick={onClose}>취소</button><button className="btn primary" onClick={()=>name&&onSave({id:initial?.id||Date.now(),folder,name,badge:action.includes('OFF')?'광고 OFF':action.includes('태스크')?'테스크':'알림',scope,period:'최근 7일',cadence:'10분마다',condition,action,mode,enabled:true,runs:0,matches:0})}><Save size={15}/> 저장</button></div></div></div>
}
