import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Power, CalendarClock, RefreshCw, Search, Plus, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { ChannelTag } from '../components/ChannelTag';
import { CampaignTypeTag } from '../components/ChannelTag';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useMetricsQuery } from '../context/MetricsQueryContext';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { PLATFORM_LABEL, type Campaign, type CampaignStatus, type PlatformKey } from '../types/operations';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { apiFetch } from '../hooks/useApi';
import { automationApi, ruleScheduleSummary, type AutomationRule } from '../automation/automationApi';
import { metricQuery } from '../hooks/useMetrics';
import type { CampaignMetricRow } from '../types/metrics';
import { splitHighLowPerformers } from '../utils/performanceScoring';

const statusLabel: Record<CampaignStatus,string> = {on:'운영 중',off:'중지',scheduled:'예약 대기',review:'심사 중',error:'오류',unsupported:'지원 불가'};
const statusTone: Record<CampaignStatus,'success'|'warning'|'danger'|'neutral'|'accent'> = {on:'success',off:'neutral',scheduled:'accent',review:'warning',error:'danger',unsupported:'neutral'};
const platforms = Object.entries(PLATFORM_LABEL) as [PlatformKey,string][];
export function CampaignManagementPage() {
  const [rows,setRows] = useState<Campaign[]>([]);
  const [campaignError,setCampaignError]=useState('');
  const [advertisers]=useAdvertisers();
  const reloadCampaigns=()=>{setCampaignError('');apiFetch<Campaign[]>('/campaigns').then(live=>setRows(live||[])).catch(error=>{setRows([]);setCampaignError(error instanceof Error?error.message:String(error))});};
  useEffect(()=>{reloadCampaigns();},[]);
  // 예약 작업(AI 자동화 → 예약 작업)에 저장된 캠페인 ON/OFF 규칙을 함께 불러옵니다 -
  // 예전엔 이 화면의 "일정 설정"이 로컬 상태에만 저장되고 서버에 전혀 반영되지 않았습니다.
  const [autoRules,setAutoRules]=useState<AutomationRule[]>([]);
  const reloadAutoRules=()=>{automationApi.rules.list('campaign').then(setAutoRules).catch(()=>setAutoRules([]));};
  useEffect(()=>{reloadAutoRules();},[]);
  const rulesFor=(row:Campaign)=>autoRules.filter(r=>r.config?.targetType==='campaign'&&String(r.config?.targetId)===String(row.id)&&r.config?.channel===row.platform);
  // 다른 인사이트 화면들과 같은 상단 기간 선택기(오늘/7일/30일 등)를 그대로 씁니다.
  const {range}=useMetricsQuery();
  const [perf,setPerf] = useState<CampaignMetricRow[]>([]);
  useEffect(()=>{
    apiFetch<{rows:CampaignMetricRow[]}>(`/metrics/campaigns?${metricQuery(range)}`).then(r=>setPerf(r.rows||[])).catch(()=>setPerf([]));
  },[range.from,range.to]);
  // 상단 전역 광고주 검색과 연결합니다 (화면마다 따로 있던 광고주 선택 드롭다운을 없애고 하나로 통일).
  const { filterValue } = useAdvertiserFilter();
  const matchedAdvertiser = advertisers.find(a => matchesAdvertiserFilter(a.name, filterValue));
  const [platform,setPlatform] = useState<'all'|PlatformKey>('all');
  const [query,setQuery] = useState('');
  const [showUpload,setShowUpload] = useState(false);
  const [showSchedule,setShowSchedule] = useState<string|null>(null);
  type SortKey='name'|'budget'|'status';
  const [sortKey,setSortKey] = useState<SortKey>('name');
  const [sortDir,setSortDir] = useState<'asc'|'desc'>('asc');

  const filtered = useMemo(()=>{
    const list = rows.filter(r => {
      const advertiserName = advertisers.find(a => a.id === r.advertiserId)?.name;
      return matchesAdvertiserFilter(advertiserName, filterValue) &&
        (platform==='all'||r.platform===platform) &&
        r.name.toLowerCase().includes(query.toLowerCase());
    });
    return [...list].sort((a,b) => {
      const valueOf = (r: Campaign) => sortKey==='name' ? r.name : sortKey==='budget' ? r.budget : r.status;
      const av = valueOf(a), bv = valueOf(b);
      const diff = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir==='asc' ? diff : -diff;
    });
  },[rows,advertisers,filterValue,platform,query,sortKey,sortDir]);
  const toggleSort = (key: SortKey) => { if (sortKey===key) setSortDir(sortDir==='asc'?'desc':'asc'); else { setSortKey(key); setSortDir('asc'); } };
  const sortArrow = (key: SortKey) => sortKey===key ? (sortDir==='asc'?' ▲':' ▼') : '';

  // 캠페인명 기준으로 선택한 기간의 실제 성과를 매칭합니다(관리용 캠페인 목록과 성과 API의 ID 체계가 달라 이름으로 연결).
  const perfByName = useMemo(()=>{
    const m = new Map<string, {spend:number;clicks:number;impressions:number;dbCount:number;purchases:number;revenue:number}>();
    for (const p of perf) {
      const cur = m.get(p.campaignName) || {spend:0,clicks:0,impressions:0,dbCount:0,purchases:0,revenue:0};
      cur.spend += p.spend; cur.clicks += p.clicks; cur.impressions += p.impressions; cur.dbCount += p.dbCount; cur.purchases += p.purchases||0; cur.revenue += p.revenue||0;
      m.set(p.campaignName, cur);
    }
    return m;
  },[perf]);
  const withPerf = useMemo(()=>filtered.map(r=>{
    const advertiserName = advertisers.find(a => a.id === r.advertiserId)?.name || '';
    const p = perfByName.get(r.name) || {spend:0,clicks:0,impressions:0,dbCount:0,purchases:0,revenue:0};
    const totalConversions = p.dbCount + p.purchases;
    return { id:r.id, name:r.name, advertiserName, spend:p.spend, clicks:p.clicks, impressions:p.impressions, dbCount:p.dbCount, purchases:p.purchases, revenue:p.revenue,
      ctr: p.impressions?p.clicks/p.impressions*100:0, roas: p.spend?p.revenue/p.spend*100:0, cvr: p.clicks?totalConversions/p.clicks*100:0 };
  }),[filtered,perfByName,advertisers]);
  // ROAS·전환수·CVR·클릭수를 종합해서 판단합니다(ROAS 하나만 보지 않습니다).
  const { high: highPerf, low: lowPerf } = useMemo(()=>splitHighLowPerformers(withPerf, 8), [withPerf]);

  const stats = {
    total: filtered.length,
    on: filtered.filter(r=>r.status==='on').length,
    scheduled: filtered.filter(r=>r.status==='scheduled').length,
    issue: filtered.filter(r=>['error','unsupported'].includes(r.status)).length,
  };

  function toggle(id:string) {
    const row=rows.find(r=>r.id===id); if(!row?.capability.toggle)return;
    const nextStatus=row.status==='on'?'off':'on';
    if(!confirm(`${row.name} 캠페인을 실제로 ${nextStatus==='off'?'중지':'재개'}할까요? 이 작업은 실제 광고 계정에 바로 반영됩니다.`))return;
    apiFetch('/campaigns',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,channel:row.platform,advertiserId:row.advertiserId,status:nextStatus})}).then(()=>reloadCampaigns()).catch(error=>setCampaignError(error instanceof Error?error.message:String(error)));
  }

  const scheduleTarget = rows.find(r=>r.id===showSchedule);

  return <div>
    <PageHeader title="캠페인 관리" description="매체별 캠페인을 한 곳에서 업로드하고, ON/OFF 및 날짜·시간 예약을 관리합니다."
      action={<div className="toolbar-actions"><button className="btn" onClick={()=>setShowUpload(true)}><FileSpreadsheet size={15}/>대량 업로드</button><button className="btn btn-primary" onClick={()=>setShowUpload(true)}><Plus size={15}/>캠페인 업로드</button></div>} />
    <MetricsDateBar/>

    {campaignError&&<div className="card" style={{color:'#b91c1c',borderColor:'#fecaca'}}>{campaignError}</div>}
    <div className="summary-grid summary-grid-compact">
      <div className="summary-card"><div className="summary-card-label">전체 캠페인</div><div className="summary-card-value">{stats.total}</div></div>
      <div className="summary-card"><div className="summary-card-label">운영 중</div><div className="summary-card-value text-success">{stats.on}</div></div>
      <div className="summary-card"><div className="summary-card-label">예약 대기</div><div className="summary-card-value text-accent">{stats.scheduled}</div></div>
      <div className="summary-card"><div className="summary-card-label">확인 필요</div><div className="summary-card-value text-danger">{stats.issue}</div></div>
    </div>

    <div className="card compact-card">
      <div className="filter-row">
        {matchedAdvertiser && <span className="footnote" style={{margin:0}}>상단 검색에서 변경 가능</span>}
        <select value={platform} onChange={e=>setPlatform(e.target.value as any)} className="select-control"><option value="all">전체 매체</option>{platforms.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
        <div className="campaign-search-box"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="캠페인명 검색"/></div>
        <button className="btn" onClick={reloadCampaigns}><RefreshCw size={14}/>동기화</button>
      </div>
    </div>

    <div className="card" style={{padding:0}}>
      <div className="table-scroll fixed-scroll-box"><table className="data-table campaign-table"><thead><tr><th>매체</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('name')}>캠페인{sortArrow('name')}</th><th>광고계정</th><th className="num" style={{cursor:'pointer'}} onClick={()=>toggleSort('budget')}>예산{sortArrow('budget')}</th><th>운영 기간</th><th>자동 일정</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('status')}>상태{sortArrow('status')}</th><th>최근 동기화</th><th>작업</th></tr></thead><tbody>
        {filtered.map(r=>{const myRules=rulesFor(r);return <tr key={r.id}><td><ChannelTag channel={r.platform}/></td><td><strong>{r.name}</strong>{r.campaignType&&<> <CampaignTypeTag type={r.campaignType}/></>}</td><td>{r.accountName}</td><td className="num metric-emphasis">{r.budgetType==='daily'?'일 ':'총 '}₩{r.budget.toLocaleString()}</td><td>{r.startAt.replace('T',' ')}<br/><span className="muted-text">{r.endAt?.replace('T',' ')||'종료일 없음'}</span></td>
        <td>{myRules.length===0?'-':<span title={myRules.map(x=>`${x.name}(${x.enabled?'ON':'중지'})`).join('\n')}>{ruleScheduleSummary(myRules[0])} · {myRules[0].config?.action==='on'?'켜기':'끄기'}{myRules.length>1?` 외 ${myRules.length-1}개 규칙`:''}</span>}</td>
        <td><Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge></td><td>{r.lastSyncedAt||'-'}</td><td><div className="row-actions"><button className="icon-btn" title="ON/OFF" disabled={!r.capability.toggle} onClick={()=>toggle(r.id)}><Power size={15}/></button><button className="icon-btn" title="ON/OFF 일정 설정" disabled={!r.capability.schedule} onClick={()=>setShowSchedule(r.id)}><CalendarClock size={15}/></button><button className="icon-btn" title="업로드" disabled={!r.capability.upload}><Upload size={15}/></button>{r.platform==='naver' && <Link className="icon-btn" title="네이버 검색광고 관리에서 함께 관리" to="/search-ads/naver"><ExternalLink size={15}/></Link>}{r.platform==='meta' && <Link className="icon-btn" title="메타 광고 관리에서 함께 관리" to="/meta-ads"><ExternalLink size={15}/></Link>}</div></td></tr>;})}
      </tbody></table></div>
    </div>

    <div className="card capability-card"><div className="card-title">매체별 연동 범위</div><div className="capability-grid">
      {platforms.map(([key,label])=>{const sample=rows.find(r=>r.platform===key); const c=sample?.capability ?? {upload:key!=='karrot',toggle:key!=='karrot',schedule:key!=='karrot'}; return <div className="capability-item" key={key}><strong>{label}</strong><span>{c.upload?'업로드 가능':'업로드 제한'}</span><span>{c.toggle?'ON/OFF 가능':'ON/OFF 제한'}</span><span>{c.schedule?'예약 가능':'예약 제한'}</span></div>})}
    </div><div className="footnote">Instagram은 Meta, YouTube는 Google Ads 계정 체계를 공유합니다. Karrot은 공식 권한 확보 전까지 보고서·수동 상태 관리 GATE로 동작합니다. 네이버 캠페인은 "네이버 검색광고 관리" 메뉴에서도 같은 ON/OFF·예산 데이터를 확인·수정할 수 있습니다(행의 바로가기 버튼).</div></div>

    <div className="keyword-analysis-cards">
      <div className="card"><div className="card-title">고성과 캠페인</div>{highPerf.length?highPerf.map(r=><p key={r.id} className="analysis-item analysis-item-high"><span className="analysis-name-block"><small className="analysis-advertiser">{r.advertiserName}</small><b className="analysis-target analysis-target-high">{r.name}</b></span><span className="analysis-metrics">ROAS {r.roas.toFixed(0)}% · CVR {r.cvr.toFixed(1)}% · DB {r.dbCount}건 · 구매 {r.purchases}건 · 클릭 {r.clicks.toLocaleString()}</span></p>):<p className="muted-text">선택 기간에 확실한 고성과 캠페인이 없습니다.</p>}</div>
      <div className="card"><div className="card-title">저성과 캠페인</div>{lowPerf.length?lowPerf.map(r=><p key={r.id} className="analysis-item analysis-item-low"><span className="analysis-name-block"><small className="analysis-advertiser">{r.advertiserName}</small><b className="analysis-target analysis-target-low">{r.name}</b></span><span className="analysis-metrics">광고비 ₩{Math.round(r.spend).toLocaleString()} · DB {r.dbCount}건 · 구매 {r.purchases}건 · CVR {r.cvr.toFixed(1)}% · ROAS {r.roas.toFixed(0)}%</span></p>):<p className="muted-text">선택 기간에 뚜렷한 저성과 캠페인이 없습니다.</p>}</div>
    </div>
    <div className="footnote">고성과·저성과는 선택하신 기간의 실제 매체 성과(캠페인명 기준 매칭)를 ROAS·전환수·CVR·클릭수 종합 기준으로 판단합니다. 성과 데이터가 없는 캠페인(연동 전·집행 전)은 집계에서 제외됩니다.</div>

    {showUpload && <div className="modal-backdrop" onClick={()=>setShowUpload(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-title">캠페인 업로드</div><p className="muted-text">개별 등록 또는 CSV/XLSX 대량 업로드를 선택하세요. 실제 API 키가 연결되면 사전 검증 후 매체로 전송됩니다.</p><div className="upload-drop"><Upload size={24}/><strong>파일을 놓거나 선택하세요</strong><span>CSV, XLSX · 최대 10MB</span></div><div className="modal-actions"><button className="btn" onClick={()=>setShowUpload(false)}>취소</button><button className="btn btn-primary" onClick={()=>setShowUpload(false)}>검증만 실행</button></div></div></div>}
    {scheduleTarget && (
      <TargetAutomationModal
        targetType="campaign"
        targetId={scheduleTarget.id}
        targetName={scheduleTarget.name}
        channel={scheduleTarget.platform}
        advertiserId={scheduleTarget.advertiserId}
        rules={rulesFor(scheduleTarget)}
        onClose={()=>setShowSchedule(null)}
        onChanged={reloadAutoRules}
      />
    )}
  </div>
}

/** 캠페인 하나에 대한 ON/OFF 예약 규칙을 관리합니다 - 예약 작업(AI 자동화) 화면과 완전히
 * 같은 서버 저장소(automation_rules)를 씁니다. 이 화면에서 만든 규칙은 예약 작업 화면에서도
 * 그대로 보이고, 예약 작업 화면에서 만든 규칙도 여기서 함께 관리할 수 있습니다. */
export function TargetAutomationModal({targetType,targetId,targetName,channel,advertiserId,rules,onClose,onChanged}:{targetType:'campaign'|'creative'|'keyword';targetId:string;targetName:string;channel:string;advertiserId:string;rules:AutomationRule[];onClose:()=>void;onChanged:()=>void}){
  const WEEKDAYS:[string,number][]=[['일',0],['월',1],['화',2],['수',3],['목',4],['금',5],['토',6]];
  const [action,setAction]=useState<'on'|'off'>('on');
  const [cadence,setCadence]=useState<'once'|'daily'|'weekly'|'monthly'>('daily');
  const [weekdays,setWeekdays]=useState<number[]>([1]);
  const [dayOfMonth,setDayOfMonth]=useState(1);
  const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const [onceDate,setOnceDate]=useState(todayStr());
  const [time,setTime]=useState('09:00');
  const [saving,setSaving]=useState(false);
  const label=targetType==='creative'?'소재':targetType==='keyword'?'키워드':'캠페인';
  const toggleWeekday=(v:number)=>setWeekdays(prev=>prev.includes(v)?prev.filter(x=>x!==v):[...prev,v].sort());
  const addRule=async()=>{
    if(cadence==='weekly'&&weekdays.length===0){alert('요일을 하나 이상 선택하세요.');return;}
    if(cadence==='once'&&!onceDate){alert('실행할 날짜를 선택하세요.');return;}
    setSaving(true);
    try{
      const config={targetType,targetId,targetName,channel,action,cadence,weekdays,dayOfMonth,date:onceDate,time};
      const name=`${targetName} ${action==='on'?'ON':'OFF'}`;
      await automationApi.rules.create({type:'campaign',advertiserId,name,config});
      onChanged();
    }catch(e){alert(e instanceof Error?e.message:'저장에 실패했습니다.');}
    finally{setSaving(false);}
  };
  const removeRule=async(id:string)=>{ if(!confirm('이 예약을 삭제할까요?'))return; await automationApi.rules.remove(id); onChanged(); };
  const toggleEnabled=async(rule:AutomationRule)=>{ await automationApi.rules.update(rule.id,{enabled:!rule.enabled}); onChanged(); };
  return <div className="modal-backdrop" onClick={onClose}><div className="modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
    <div className="modal-title">{targetName} ON/OFF 일정 설정</div>
    <p className="muted-text">정해진 요일·시각에 서버가 실제로 이 {label} 상태를 변경합니다. 여러 규칙을 함께 등록할 수 있습니다(예: 평일 09:00 켜기 + 평일 21:00 끄기).</p>
    {rules.length>0&&<div style={{marginBottom:14}}>
      <label style={{marginBottom:6,display:'block',fontWeight:700,fontSize:13}}>등록된 규칙 ({rules.length}개)</label>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {rules.map(r=><div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#f8fafc',borderRadius:6,padding:'8px 10px',fontSize:12.5}}>
          <span>{ruleScheduleSummary(r)} · <b>{r.config?.action==='on'?'켜기':'끄기'}</b> {!r.enabled&&<em style={{color:'#94a3b8'}}>(중지됨)</em>}</span>
          <div style={{display:'flex',gap:6}}>
            <button type="button" className="btn secondary sm" onClick={()=>toggleEnabled(r)}>{r.enabled?'중지':'재개'}</button>
            <button type="button" className="icon-btn danger" onClick={()=>removeRule(r.id)}>×</button>
          </div>
        </div>)}
      </div>
    </div>}
    <div className="final-form">
      <label style={{display:'block',marginBottom:8}}>동작<select className="form-select" style={{width:'100%',marginTop:4}} value={action} onChange={e=>setAction(e.target.value as any)}><option value="on">켜기(ON)</option><option value="off">끄기(OFF)</option></select></label>
      <label style={{display:'block',marginBottom:8}}>주기<select className="form-select" style={{width:'100%',marginTop:4}} value={cadence} onChange={e=>setCadence(e.target.value as any)}><option value="once">1회(특정 날짜)</option><option value="daily">매일</option><option value="weekly">매주(요일 지정)</option><option value="monthly">매월</option></select></label>
      {cadence==='once'&&<label style={{display:'block',marginBottom:8}}>실행 날짜<input type="date" className="form-select" style={{width:'100%',marginTop:4}} value={onceDate} onChange={e=>setOnceDate(e.target.value)}/></label>}
      {cadence==='weekly'&&<div style={{marginBottom:8}}><span style={{fontSize:13,fontWeight:700}}>요일(복수 선택 가능)</span><div style={{display:'flex',gap:6,marginTop:6}}>{WEEKDAYS.map(([label,v])=><button type="button" key={v} className={weekdays.includes(v)?'btn primary sm':'btn secondary sm'} onClick={()=>toggleWeekday(v)}>{label}</button>)}</div></div>}
      {cadence==='monthly'&&<label style={{display:'block',marginBottom:8}}>매월 실행일<input type="number" min={1} max={28} className="form-select" style={{width:'100%',marginTop:4}} value={dayOfMonth} onChange={e=>setDayOfMonth(Math.max(1,Math.min(28,Number(e.target.value)||1)))}/></label>}
      <label style={{display:'block',marginBottom:8}}>실행 시각<input type="time" className="form-select" style={{width:'100%',marginTop:4}} value={time} onChange={e=>setTime(e.target.value)}/></label>
      <button type="button" className="btn full" onClick={addRule} disabled={saving}>{saving?'저장 중...':'+ 규칙 추가'}</button>
    </div>
    <div className="modal-actions"><button className="btn" onClick={onClose}>닫기</button></div>
  </div></div>;
}
