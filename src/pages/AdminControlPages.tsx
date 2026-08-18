import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Download, Plus, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { loadAdvertisers } from '../data/advertisers';
import { loadAssets } from '../utils/assetStore';
import { loadSubscriptions, loadUsageEvents } from '../utils/subscriptionStore';
import { getAllAutomationJobs, loadAutomationRuns } from '../automation/automationStore';
import { FEATURE_CATALOG } from '../control/permissionEngine';
import { BackendBadge, ControlEmpty, ControlKpi, ControlPanel, ControlStatus, DemoBadge } from '../control/ControlUi';
import { apiFetch } from '../hooks/useApi';
import {
  exportFrontendBackup,
  importFrontendBackup,
  loadAuditEvents,
  loadControlUiSettings,
  loadControlUsers,
  loadFeatureFlags,
  loadMemberships,
  loadMenuVisibility,
  loadNotices,
  loadOrganization,
  loadPlanDefinitions,
  loadRoles,
  patchFeatureFlag,
  saveControlUiSettings,
  saveControlUsers,
  saveFeatureFlags,
  saveMenuVisibility,
  savePlanDefinitions,
  saveRoles,
  upsertControlUser,
  upsertMembership,
  upsertNotice,
  upsertPlanDefinition,
  upsertRole,
} from '../control/controlStore';
import type { FeatureFlagState, RoleDefinition, SubscriptionPlanDefinition } from '../control/controlTypes';

const ADMIN_SECTIONS = [
  ['users','사용자 관리'],['advertisers','광고주 관리'],['roles','권한 묶음 관리'],['feature-permissions','기능별 이용 권한'],['plans','구독 상품 관리'],
  ['payments','결제 내역'],['ai-usage','AI 사용량'],['storage','저장 공간 사용량'],['executions','작업 실행 기록'],['security','접속·보안 기록'],
  ['notices','공지사항'],['menu','메뉴 관리'],['feature-flags','기능 공개 설정'],['backup','데이터 백업'],['system','시스템 설정'],
] as const;
type AdminSectionKey=typeof ADMIN_SECTIONS[number][0];
function useRevision(){const [v,setV]=useState(0);useEffect(()=>{const f=()=>setV(x=>x+1);['howtom:control-changed','howtom:audit-changed','howtom:subscriptions-changed','howtom:usage-changed','howtom-automation-updated'].forEach(n=>window.addEventListener(n,f as EventListener));return()=>['howtom:control-changed','howtom:audit-changed','howtom:subscriptions-changed','howtom:usage-changed','howtom-automation-updated'].forEach(n=>window.removeEventListener(n,f as EventListener))},[]);return v}
function bytes(v:number){if(v<1024)return `${v} B`;if(v<1024**2)return `${(v/1024).toFixed(1)} KB`;if(v<1024**3)return `${(v/1024**2).toFixed(1)} MB`;return `${(v/1024**3).toFixed(2)} GB`}
function money(v?:number){return v==null?'-':`${Math.round(v).toLocaleString()}원`}

export function AdminControlDashboardPage(){
  useRevision();const users=loadControlUsers();const advertisers=loadAdvertisers().filter(a=>a.id!=='default');const subscriptions=loadSubscriptions();const usage=loadUsageEvents();const assets=loadAssets(true);const jobs=getAllAutomationJobs();const runs=loadAutomationRuns();const audits=loadAuditEvents();const failed=runs.filter(r=>r.status==='failed').length;
  return <div className="ctrl-page"><PageHeader title="관리자 대시보드" description="HOWTOM 서비스의 사용자·광고주·구독·AI·자동화·저장공간·보안 상태를 관리합니다."/><div className="ctrl-toolbar"><DemoBadge/><BackendBadge/><span className="ctrl-muted">현재 수치는 프론트 저장 데이터 기준이며 실제 회원·결제·서버 세션 통계가 아닙니다.</span></div><div className="ctrl-kpi-grid admin"><ControlKpi label="프론트 사용자" value={`${users.length}명`}/><ControlKpi label="광고주" value={`${advertisers.length}곳`}/><ControlKpi label="구독 설정" value={`${subscriptions.length}건`} sub="결제 미연동"/><ControlKpi label="AI/콘텐츠 사용 이벤트" value={`${usage.length}건`}/><ControlKpi label="자동화 작업" value={`${jobs.length}개`}/><ControlKpi label="자동화 실패 기록" value={`${failed}건`}/><ControlKpi label="자산" value={`${assets.length}개`}/><ControlKpi label="감사 이벤트" value={`${audits.length}건`}/></div><div className="ctrl-admin-grid">{ADMIN_SECTIONS.map(([key,label])=><Link key={key} className="card ctrl-admin-card" to={`/admin/${key}`}><strong>{label}</strong><span>{adminDescription(key)}</span><em>관리 →</em></Link>)}</div></div>
}
function adminDescription(key:AdminSectionKey){const map:Record<AdminSectionKey,string>={users:'사용자 프로필과 상태를 관리합니다.',advertisers:'서비스 이용 광고주 현황을 확인합니다.',roles:'역할별 권한 묶음을 편집합니다.','feature-permissions':'기능을 역할 기준으로 비교합니다.',plans:'상품과 entitlement 설계안을 관리합니다.',payments:'PG 연결 후 결제·환불을 조회합니다.','ai-usage':'광고주·기능별 사용량과 원가 기록을 확인합니다.',storage:'자산과 브라우저 저장량을 확인합니다.',executions:'전체 자동화 실행 기록을 조회합니다.',security:'접속·권한·공유 변경 감사 이벤트를 확인합니다.',notices:'내부/광고주 공지사항을 관리합니다.',menu:'메뉴 노출 정책을 관리합니다.','feature-flags':'Internal·Beta·Public 공개 단계를 관리합니다.',backup:'프론트 데이터를 백업·복원합니다.',system:'서비스 공통 운영값을 관리합니다.'};return map[key]}

export function AdminControlPage(){
  useRevision();const {sectionKey}=useParams<{sectionKey:AdminSectionKey}>();const meta=ADMIN_SECTIONS.find(x=>x[0]===sectionKey);if(!meta)return <Navigate to="/admin" replace/>;return <div className="ctrl-page"><div className="ctrl-back-row"><Link to="/admin">← 관리자 대시보드</Link></div><PageHeader title={meta[1]} description={adminDescription(meta[0])}/>{renderAdmin(meta[0])}</div>
}
function renderAdmin(key:AdminSectionKey){
  if(key==='users')return <UsersAdmin/>;if(key==='advertisers')return <AdvertisersAdmin/>;if(key==='roles')return <RolesAdmin/>;if(key==='feature-permissions')return <FeaturePermissionAdmin/>;if(key==='plans')return <PlansAdmin/>;if(key==='payments')return <PaymentsAdmin/>;if(key==='ai-usage')return <AiUsageAdmin/>;if(key==='storage')return <StorageAdmin/>;if(key==='executions')return <ExecutionsAdmin/>;if(key==='security')return <SecurityAdmin/>;if(key==='notices')return <NoticesAdmin/>;if(key==='menu')return <MenuAdmin/>;if(key==='feature-flags')return <FlagsAdmin/>;if(key==='backup')return <BackupAdmin/>;return <SystemAdmin/>;
}

function UsersAdmin(){
  const users=loadControlUsers();const memberships=loadMemberships();const roles=loadRoles();const advertisers=loadAdvertisers().filter(a=>a.id!=='default');
  const [,force]=useState(0);const [name,setName]=useState('');const [newRoleId,setNewRoleId]=useState(roles[0]?.roleId||'');
  const [editingUserId,setEditingUserId]=useState<string|null>(null);
  const membershipOf=(userId:string)=>memberships.find(m=>m.userId===userId);
  const addUser=()=>{
    if(!name.trim())return;
    const row=upsertControlUser({name:name.trim(),status:'active'});
    if(newRoleId)upsertMembership({userId:row.userId,roleIds:[newRoleId]});
    setName('');force(x=>x+1);
  };
  const toggleStatus=(u:ReturnType<typeof loadControlUsers>[number])=>{
    saveControlUsers(loadControlUsers().map(x=>x.userId===u.userId?{...x,status:x.status==='disabled'?'active':'disabled',updatedAt:new Date().toISOString()}:x));
    force(x=>x+1);
  };
  const toggleRole=(userId:string,roleId:string)=>{
    const m=membershipOf(userId);const has=m?.roleIds.includes(roleId)??false;
    const nextRoleIds=has?(m?.roleIds||[]).filter(r=>r!==roleId):[...(m?.roleIds||[]),roleId];
    upsertMembership({userId,roleIds:nextRoleIds});force(x=>x+1);
  };
  const setScopeAll=(userId:string)=>{upsertMembership({userId,advertiserIds:undefined});force(x=>x+1)};
  const toggleAdvertiserScope=(userId:string,advertiserId:string)=>{
    const m=membershipOf(userId);const current=m?.advertiserIds||[];
    const next=current.includes(advertiserId)?current.filter(a=>a!==advertiserId):[...current,advertiserId];
    upsertMembership({userId,advertiserIds:next});force(x=>x+1);
  };
  return <ControlPanel title="사용자" description="정식 회원가입·초대·세션 종료는 백엔드 연결 후 활성화합니다. 역할·광고주 범위·계정 상태는 지금도 여기서 바로 관리할 수 있습니다." actions={<BackendBadge/>}>
    <div className="ctrl-inline-form">
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="로컬 사용자 프로필"/>
      <select value={newRoleId} onChange={e=>setNewRoleId(e.target.value)}>{roles.map(r=><option key={r.roleId} value={r.roleId}>{r.name}</option>)}</select>
      <button className="btn primary" onClick={addUser}><Plus size={14}/> 추가</button>
      <button className="btn secondary" disabled>이메일 초대 (미구현)</button>
    </div>
    <div className="ctrl-table-wrap"><table className="ctrl-table"><thead><tr><th>사용자</th><th>이메일</th><th>역할</th><th>광고주 범위</th><th>상태</th><th>계정 제어</th></tr></thead><tbody>
      {users.map(u=>{
        const ms=memberships.filter(m=>m.userId===u.userId);
        const isEditing=editingUserId===u.userId;
        return <>
          <tr key={u.userId}>
            <td><b>{u.name}</b>{u.isDemo&&<small className="ctrl-cell-sub">데모</small>}</td>
            <td>{u.email||'-'}</td>
            <td>{roles.filter(r=>ms.some(m=>m.roleIds.includes(r.roleId))).map(r=>r.name).join(', ')||'-'}</td>
            <td>{ms.some(m=>!m.advertiserIds?.length)?'전체':`${new Set(ms.flatMap(m=>m.advertiserIds||[])).size}곳`}</td>
            <td><ControlStatus tone={u.status==='active'?'success':'warning'}>{u.status==='active'?'활성':u.status==='invited'?'초대됨':'중지됨'}</ControlStatus></td>
            <td>
              <button className="btn secondary sm" onClick={()=>setEditingUserId(isEditing?null:u.userId)}>{isEditing?'닫기':'역할 범위 편집'}</button>
              {!u.isDemo&&<button className="btn secondary sm" onClick={()=>toggleStatus(u)}>{u.status==='disabled'?'재활성화':'사용 중지'}</button>}
            </td>
          </tr>
          {isEditing&&<tr className="ctrl-user-edit-row"><td colSpan={6}>
            <div className="ctrl-user-edit-panel">
              <div><b>역할 (클릭해서 배정/해제)</b><div className="ctrl-chip-row">{roles.map(r=>{const has=membershipOf(u.userId)?.roleIds.includes(r.roleId)??false;return <button key={r.roleId} type="button" className={`ctrl-chip${has?' active':''}`} onClick={()=>toggleRole(u.userId,r.roleId)}>{r.name}</button>})}</div></div>
              <div><b>담당 광고주 범위</b>
                <div className="ctrl-chip-row">
                  <button type="button" className={`ctrl-chip${!membershipOf(u.userId)?.advertiserIds?.length?' active':''}`} onClick={()=>setScopeAll(u.userId)}>전체 광고주</button>
                  {advertisers.map(a=>{const has=membershipOf(u.userId)?.advertiserIds?.includes(a.id)??false;return <button key={a.id} type="button" className={`ctrl-chip${has?' active':''}`} onClick={()=>toggleAdvertiserScope(u.userId,a.id)}>{a.name}</button>})}
                </div>
                <small className="ctrl-cell-sub">개별 광고주를 하나라도 선택하면 "전체 광고주"에서 그 목록으로 범위가 좁혀집니다.</small>
              </div>
            </div>
          </td></tr>}
        </>;
      })}
    </tbody></table></div>
  </ControlPanel>;
}
function AdvertisersAdmin(){const advertisers=loadAdvertisers().filter(a=>a.id!=='default');const subs=loadSubscriptions();const assets=loadAssets(true);return <ControlPanel title="광고주 서비스 이용 현황" description="실무 광고주 관리와 달리 구독·자산·계정 준비 상태 관점으로 확인합니다."><div className="ctrl-table-wrap"><table className="ctrl-table"><thead><tr><th>광고주</th><th>월 예산</th><th>연결 매체</th><th>구독 설정</th><th>자산</th><th></th></tr></thead><tbody>{advertisers.map(a=>{const sub=subs.find(s=>s.advertiserId===a.id);return <tr key={a.id}><td><b>{a.name}</b></td><td>{money(a.monthlyBudget)}</td><td>{a.links.filter(l=>l.status==='연결됨').length}개</td><td>{sub?.planName||'미설정'}</td><td>{assets.filter(x=>x.advertiserId===a.id).length}개</td><td><Link className="btn secondary" to={`/advertisers/dashboard?advertiser=${a.id}`}>Workspace</Link></td></tr>})}</tbody></table></div></ControlPanel>}
function RolesAdmin(){const roles=loadRoles();const [name,setName]=useState('');return <ControlPanel title="권한 묶음" description="Role은 Permission key 묶음이며 사용자별 광고주 접근 범위와 분리됩니다."><div className="ctrl-inline-form"><input value={name} onChange={e=>setName(e.target.value)} placeholder="새 역할명"/><button className="btn primary" onClick={()=>{if(!name.trim())return;upsertRole({name:name.trim(),description:'사용자 정의 역할',scope:'internal'});setName('')}}>역할 추가</button></div><div className="ctrl-role-grid">{roles.map(r=><article className="card ctrl-role-card" key={r.roleId}><div><strong>{r.name}</strong><ControlStatus tone={r.scope==='internal'?'info':'neutral'}>{r.scope}</ControlStatus></div><p>{r.description}</p><small>{r.permissionKeys.length}개 권한 {r.system?'· 기본 역할':''}</small></article>)}</div></ControlPanel>}
function FeaturePermissionAdmin(){const roles=loadRoles();const [,force]=useState(0);const locked=(role:RoleDefinition)=>role.roleId==='role-admin';const toggle=(role:RoleDefinition,featureKey:string)=>{if(locked(role))return;const has=role.permissionKeys.includes(featureKey);const nextKeys=has?role.permissionKeys.filter(k=>k!==featureKey):[...role.permissionKeys,featureKey];saveRoles(loadRoles().map(r=>r.roleId===role.roleId?{...r,permissionKeys:nextKeys,updatedAt:new Date().toISOString()}:r));force(x=>x+1)};return <ControlPanel title="기능별 이용 권한" description="셀을 클릭하면 해당 역할에 그 기능을 즉시 허용/차단합니다. '관리자' 역할만 실수로 스스로 잠기는 것을 막기 위해 여기서 수정할 수 없습니다."><div className="ctrl-table-wrap"><table className="ctrl-table wide"><thead><tr><th>기능</th>{roles.map(r=><th key={r.roleId}>{r.name}{locked(r)?' (수정 불가)':''}</th>)}</tr></thead><tbody>{FEATURE_CATALOG.map(f=><tr key={f.featureKey}><td><b>{f.label}</b><small className="ctrl-cell-sub">{f.featureKey}</small></td>{roles.map(r=>{const allowed=r.permissionKeys.includes(f.featureKey);return <td key={r.roleId}><button type="button" className="ctrl-permission-toggle" disabled={locked(r)} onClick={()=>toggle(r,f.featureKey)} title={locked(r)?'관리자 역할은 여기서 수정할 수 없습니다':'클릭해서 전환'}>{allowed?<ControlStatus tone="success">허용</ControlStatus>:<ControlStatus>차단</ControlStatus>}</button></td>})}</tr>)}</tbody></table></div></ControlPanel>}
function PlansAdmin(){const plans=loadPlanDefinitions();const [,force]=useState(0);const [name,setName]=useState('');const [price,setPrice]=useState(0);const setStatus=(planId:string,status:SubscriptionPlanDefinition['status'])=>{upsertPlanDefinition({planId,name:plans.find(p=>p.planId===planId)!.name,status});force(x=>x+1)};return <ControlPanel title="구독 상품 설계" description="현재 상품은 실제 청구가 아닌 프론트 상품/entitlement 설계안입니다." actions={<DemoBadge/>}><div className="ctrl-inline-form"><input value={name} onChange={e=>setName(e.target.value)} placeholder="상품명"/><input type="number" value={price} onChange={e=>setPrice(Number(e.target.value))} placeholder="월 요금"/><button className="btn primary" onClick={()=>{if(!name.trim())return;upsertPlanDefinition({name:name.trim(),monthlyPrice:price,status:'draft'});setName('');setPrice(0);force(x=>x+1)}}>상품 추가</button></div><div className="ctrl-plan-grid">{plans.map(p=><article className="card ctrl-plan-card" key={p.planId}><div><strong>{p.name}</strong><ControlStatus tone={p.status==='active'?'success':'warning'}>{p.status==='draft'?'설계안':p.status==='active'?'판매중':'보관'}</ControlStatus></div><b>{money(p.monthlyPrice)} / 월</b><p>{p.description||'설명 없음'}</p><small>{p.entitlements.length}개 entitlement · 결제 미연동</small><div className="ctrl-plan-actions">{p.status!=='active'&&<button className="btn secondary sm" onClick={()=>setStatus(p.planId,'active')}>판매중으로 전환</button>}{p.status==='active'&&<button className="btn secondary sm" onClick={()=>setStatus(p.planId,'draft')}>설계안으로 되돌리기</button>}{p.status!=='archived'&&<button className="btn secondary sm" onClick={()=>setStatus(p.planId,'archived')}>보관</button>}</div></article>)}</div></ControlPanel>}
function PaymentsAdmin(){return <ControlPanel title="결제 내역" description="실제 거래를 가장한 샘플 결제는 표시하지 않습니다."><ControlEmpty><BackendBadge/> PG·Webhook·환불 처리가 연결되면 광고주별 결제 성공·실패·환불·갱신 내역이 이곳에 표시됩니다.</ControlEmpty></ControlPanel>}
function AiUsageAdmin(){const usage=loadUsageEvents();const byFeature=useMemo(()=>{const m=new Map<string,number>();usage.forEach(u=>m.set(u.feature,(m.get(u.feature)||0)+u.quantity));return [...m.entries()]},[usage]);const cost=usage.reduce((s,u)=>s+(u.aiCost||u.providerCost||0),0);return <><div className="ctrl-kpi-grid"><ControlKpi label="사용 이벤트" value={`${usage.length}건`}/><ControlKpi label="기록된 원가" value={cost?money(cost):'실측 없음'} sub="Provider 비용이 기록된 이벤트만"/><ControlKpi label="연결 Provider" value="미연동"/><ControlKpi label="월 한도 강제" value="서버 연결 후"/></div><ControlPanel title="기능별 사용량"><div className="ctrl-list">{byFeature.map(([feature,q])=><div className="ctrl-list-row" key={feature}><b>{feature}</b><strong>{q.toLocaleString()}</strong></div>)}{!byFeature.length&&<ControlEmpty>AI/콘텐츠 사용 이벤트가 없습니다.</ControlEmpty>}</div></ControlPanel></>}
function StorageAdmin(){const assets=loadAssets(true);const fileBytes=assets.reduce((s,a)=>s+(a.fileSize||0),0);let localBytes=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k)localBytes+=(k.length+(localStorage.getItem(k)?.length||0))*2}return <div className="ctrl-kpi-grid"><ControlKpi label="자산" value={`${assets.length}개`}/><ControlKpi label="자산 메타 파일크기" value={bytes(fileBytes)}/><ControlKpi label="localStorage 추정" value={bytes(localBytes)}/><ControlKpi label="R2/클라우드" value="미연동"/></div>}
function ExecutionsAdmin(){const runs=loadAutomationRuns();const jobs=new Map(getAllAutomationJobs().map(j=>[j.jobId,j]));return <ControlPanel title="전체 작업 실행 기록" description="AI 자동화 → 실행 기록과 같은 AutomationRun 저장소를 관리자 관점에서 조회합니다."><div className="ctrl-table-wrap"><table className="ctrl-table"><thead><tr><th>시각</th><th>작업</th><th>광고주</th><th>상태</th><th>처리량</th></tr></thead><tbody>{runs.slice(0,100).map(r=>{const job=jobs.get(r.jobId);return <tr key={r.runId}><td>{new Date(r.startedAt||r.createdAt||Date.now()).toLocaleString('ko-KR')}</td><td><b>{r.jobName||job?.name||r.jobId}</b></td><td>{job?.advertiserName||job?.advertiserId||'-'}</td><td><ControlStatus tone={r.status==='success'?'success':r.status==='failed'?'danger':'warning'}>{r.status}</ControlStatus></td><td>{r.recordsProcessed??'-'}</td></tr>})}</tbody></table>{!runs.length&&<ControlEmpty>실행 기록이 없습니다.</ControlEmpty>}</div></ControlPanel>}
type AccessLogRow = { id: string; createdAt: string; action: string; email?: string; ip?: string; result?: string };
function SecurityAdmin(){
  const events=loadAuditEvents();
  const [accessLogs,setAccessLogs]=useState<AccessLogRow[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    apiFetch<AccessLogRow[]>('/logs').then(rows=>setAccessLogs(rows||[])).catch(()=>setAccessLogs([])).finally(()=>setLoading(false));
  },[]);
  const actionLabel=(a:string)=>a==='login_success'?'로그인 성공':a==='login_failed'?'로그인 실패':a;
  return <ControlPanel title="접속·보안 기록" description="실제 로그인 시도(성공/실패, IP)와 프론트 관리 변경 이벤트를 함께 보여줍니다." actions={<BackendBadge/>}>
    <h4 style={{margin:'4px 0 10px'}}>로그인 기록</h4>
    <div className="ctrl-table-wrap">
      <table className="ctrl-table">
        <thead><tr><th>시각</th><th>결과</th><th>계정</th><th>IP</th></tr></thead>
        <tbody>
          {accessLogs.filter(e=>e.action==='login_success'||e.action==='login_failed').slice(0,150).map(e=>
            <tr key={e.id}><td>{new Date(e.createdAt).toLocaleString('ko-KR')}</td><td><ControlStatus tone={e.action==='login_success'?'success':'danger'}>{actionLabel(e.action)}</ControlStatus></td><td>{e.email||'-'}</td><td>{e.ip||'-'}</td></tr>
          )}
          {!loading&&!accessLogs.length&&<tr><td colSpan={4}><ControlEmpty>아직 기록된 로그인이 없습니다.</ControlEmpty></td></tr>}
        </tbody>
      </table>
    </div>
    <h4 style={{margin:'20px 0 10px'}}>관리 변경 이벤트</h4>
    <div className="ctrl-table-wrap">
      <table className="ctrl-table">
        <thead><tr><th>시각</th><th>액션</th><th>광고주</th><th>대상</th><th>결과</th></tr></thead>
        <tbody>
          {events.slice(0,150).map(e=><tr key={e.auditId}><td>{new Date(e.createdAt).toLocaleString('ko-KR')}</td><td><b>{e.action}</b></td><td>{e.advertiserId||'-'}</td><td>{e.targetType||'-'} {e.targetId||''}</td><td><ControlStatus tone={e.result==='success'?'success':'danger'}>{e.result}</ControlStatus></td></tr>)}
          {!events.length&&<tr><td colSpan={5}><ControlEmpty>아직 기록된 활동이 없습니다.</ControlEmpty></td></tr>}
        </tbody>
      </table>
    </div>
  </ControlPanel>;
}
function NoticesAdmin(){const notices=loadNotices();const [title,setTitle]=useState('');const [body,setBody]=useState('');return <ControlPanel title="공지사항" description="프론트 단계에서는 공지 콘텐츠와 공개 대상을 저장합니다."><div className="ctrl-form-grid"><label>제목<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>내용<textarea rows={3} value={body} onChange={e=>setBody(e.target.value)}/></label></div><button className="btn primary" onClick={()=>{if(!title.trim())return;upsertNotice({title:title.trim(),body:body.trim(),audience:'internal',status:'published'});setTitle('');setBody('')}}>공지 등록</button><div className="ctrl-list">{notices.map(n=><div className="ctrl-list-row" key={n.noticeId}><div><b>{n.title}</b><small>{n.audience} · {new Date(n.createdAt).toLocaleDateString('ko-KR')}</small></div><ControlStatus tone={n.status==='published'?'success':'neutral'}>{n.status}</ControlStatus></div>)}{!notices.length&&<ControlEmpty>등록된 공지가 없습니다.</ControlEmpty>}</div></ControlPanel>}
function MenuAdmin(){const visibility=loadMenuVisibility();const menu=['홈','운영센터','인사이트','콘텐츠','AI 자동화','자산관리','광고주','관리자','설정'];const [state,setState]=useState<Record<string,boolean>>(()=>Object.fromEntries(menu.map(m=>[m,visibility[m]!==false])));return <ControlPanel title="메뉴 노출" description="저장하면 사이드바에 실제로 반영됩니다(라우트 자체는 지우지 않아 주소를 직접 입력하면 화면은 계속 열립니다). 진짜 접근 차단은 서버 전환 시 권한 엔진과 결합해서 처리합니다."><div className="ctrl-toggle-list">{menu.map(m=><label key={m}><input type="checkbox" checked={state[m]} onChange={e=>setState({...state,[m]:e.target.checked})}/><span><b>{m}</b><small>{m==='설정'?'메인 메뉴 마지막 유지':'메인 메뉴'}</small></span></label>)}</div><button className="btn primary" onClick={()=>saveMenuVisibility(state)}><Save size={14}/> 저장</button></ControlPanel>}
function FlagsAdmin(){const flags=loadFeatureFlags();return <ControlPanel title="기능 공개 설정" description="Internal → Beta → Public 단계를 관리하며 Disabled 기능은 노출/사용 대상에서 제외할 수 있습니다."><div className="ctrl-table-wrap"><table className="ctrl-table"><thead><tr><th>기능</th><th>featureKey</th><th>공개 단계</th></tr></thead><tbody>{flags.map(f=><tr key={f.featureKey}><td><b>{f.label}</b></td><td>{f.featureKey}</td><td><select value={f.state} onChange={e=>patchFeatureFlag(f.featureKey,{state:e.target.value as FeatureFlagState})}>{['disabled','internal','beta','public'].map(s=><option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table></div></ControlPanel>}
function BackupAdmin(){const inputRef=useRef<HTMLInputElement|null>(null);const download=()=>{const data=exportFrontendBackup();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`HOWTOM_Universe_Frontend_Backup_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url)};const restore=async(file?:File)=>{if(!file)return;const text=await file.text();const data=JSON.parse(text);if(!confirm('현재 브라우저 저장값을 백업 파일 값으로 덮어쓸 수 있습니다. 복원할까요?'))return;importFrontendBackup(data);location.reload()};return <ControlPanel title="프론트엔드 데이터 백업" description="localStorage 기반 Ver.1 백업입니다. 정식 SaaS에서는 DB Snapshot·Object Storage·Retention 정책으로 전환합니다."><div className="ctrl-backup-actions"><button className="btn primary" onClick={download}><Download size={15}/> 전체 JSON 백업</button><button className="btn secondary" onClick={()=>inputRef.current?.click()}><Upload size={15}/> 백업 복원</button><input ref={inputRef} type="file" accept="application/json" hidden onChange={e=>void restore(e.target.files?.[0])}/></div></ControlPanel>}
function SystemAdmin(){const org=loadOrganization();const saved=loadControlUiSettings();const [serviceName,setServiceName]=useState(String(saved.serviceName||'HOWTOM 유니버스'));const [maintenance,setMaintenance]=useState(Boolean(saved.maintenanceMode));return <div className="ctrl-grid-2"><ControlPanel title="서비스 기본값"><div className="ctrl-form-grid"><label>서비스명<input value={serviceName} onChange={e=>setServiceName(e.target.value)}/></label><label>기본 시간대<input value={org.settings.timezone} disabled/></label><label>기본 통화<input value={org.settings.currency} disabled/></label></div><div className="ctrl-toggle-list"><label><input type="checkbox" checked={maintenance} onChange={e=>setMaintenance(e.target.checked)}/><span><b>점검 모드 설계값</b><small>실제 접속 차단은 서버 연결 후 강제</small></span></label></div><button className="btn primary" onClick={()=>saveControlUiSettings({...saved,serviceName,maintenanceMode:maintenance})}><Save size={14}/> 저장</button></ControlPanel><ControlPanel title="백엔드 전환 기준" description="프론트 최종 Ver.1 이후 비용이 발생하는 기능은 유료 고객 확보와 함께 순차 활성화합니다."><div className="ctrl-info-list"><div><span>인증/세션</span><BackendBadge/></div><div><span>PostgreSQL</span><BackendBadge/></div><div><span>PG/Webhook</span><BackendBadge/></div><div><span>Secret Store</span><BackendBadge/></div><div><span>감사로그</span><BackendBadge/></div></div></ControlPanel></div>}
