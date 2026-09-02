import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Eye, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { loadAdvertisers } from '../data/advertisers';
import { loadAssets } from '../utils/assetStore';
import { subscriptionApi, type AdvertiserSubscriptionRow } from '../utils/subscriptionApi';
import { advertiserVisibleFeatures, FEATURE_CATALOG } from '../control/permissionEngine';
import {
  createApprovalRequest,
  deleteExternalContact,
  ensureAdvertiserWorkspaces,
  loadAdvertiserFeatureAccess,
  loadApprovalRequests,
  loadAuditEvents,
  loadControlUsers,
  loadExternalContacts,
  loadMemberships,
  loadSharedAssets,
  patchAdvertiserWorkspace,
  patchApprovalRequest,
  setAdvertiserFeatureAccess,
  shareAsset,
  unshareAsset,
  upsertExternalContact,
  upsertMembership,
} from '../control/controlStore';
import { BackendBadge, ControlEmpty, ControlKpi, ControlPanel, ControlStatus, DemoBadge } from '../control/ControlUi';

function useControlRevision(){
  const [v,setV]=useState(0);
  useEffect(()=>{const fn=()=>setV(x=>x+1);window.addEventListener('howtom:control-changed',fn);window.addEventListener('howtom:subscriptions-changed',fn as EventListener);window.addEventListener('howtom:assets-changed',fn as EventListener);return()=>{window.removeEventListener('howtom:control-changed',fn);window.removeEventListener('howtom:subscriptions-changed',fn as EventListener);window.removeEventListener('howtom:assets-changed',fn as EventListener)}},[]);
  return v;
}
function advertisers(){return loadAdvertisers().filter(a=>a.id!=='default')}
function AdvertiserSelect({value,onChange}:{value:string;onChange:(v:string)=>void}){const rows=advertisers();return <select className="ctrl-select" value={value} onChange={e=>onChange(e.target.value)}>{rows.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select>}
function money(v?:number){return v==null?'-':`${Math.round(v).toLocaleString()}원`}
function date(v?:string){return v?new Date(v).toLocaleDateString('ko-KR'):'-'}

export function AdvertiserWorkspaceDashboardPage(){
  useControlRevision();
  const rows=advertisers();
  const [searchParams]=useSearchParams();
  const requestedId=searchParams.get('advertiser');
  const [advertiserId,setAdvertiserId]=useState(()=>(requestedId&&rows.some(a=>a.id===requestedId))?requestedId:(rows[0]?.id||''));
  useEffect(()=>{
    // 다른 광고주의 Workspace 링크로 다시 들어온 경우(예: 관리자 목록에서 광고주를 바꿔가며 클릭)
    // 이전에 선택했던 값 대신 URL이 가리키는 광고주를 반영합니다.
    if(requestedId&&rows.some(a=>a.id===requestedId)&&requestedId!==advertiserId)setAdvertiserId(requestedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[requestedId]);
  const advertiser=rows.find(a=>a.id===advertiserId);
  const workspace=ensureAdvertiserWorkspaces().find(w=>w.advertiserId===advertiserId);
  const contacts=loadExternalContacts().filter(c=>c.advertiserId===advertiserId);
  const shared=loadSharedAssets().filter(s=>s.advertiserId===advertiserId&&s.status==='shared');
  const approvals=loadApprovalRequests().filter(a=>a.advertiserId===advertiserId&&a.status==='pending');
  const [subscription,setSubscription]=useState<AdvertiserSubscriptionRow|null>(null);
  useEffect(()=>{ if(!advertiserId){setSubscription(null);return;} subscriptionApi.getSubscription(advertiserId).then(setSubscription).catch(()=>setSubscription(null)); },[advertiserId]);
  const features=loadAdvertiserFeatureAccess().filter(f=>f.advertiserId===advertiserId&&f.enabled);
  const connected=advertiser?.links.filter(l=>l.status==='연결됨').length||0;
  return <div className="ctrl-page"><PageHeader title="광고주 대시보드" description="광고주 단위의 구독·권한·담당자·공유·승인 상태를 한 화면에서 확인합니다."/>
    <div className="ctrl-toolbar"><AdvertiserSelect value={advertiserId} onChange={setAdvertiserId}/><DemoBadge/><span className="ctrl-muted">외부 로그인은 아직 연결하지 않고 내부 운영 상태만 표시합니다.</span></div>
    <div className="ctrl-kpi-grid"><ControlKpi label="월 광고 예산" value={money(advertiser?.monthlyBudget)}/><ControlKpi label="연결 매체" value={`${connected}개`} sub="현재 저장된 연결 상태 기준"/><ControlKpi label="승인 대기" value={`${approvals.length}건`}/><ControlKpi label="공유 자료" value={`${shared.length}건`}/><ControlKpi label="허용 기능" value={`${features.length}개`}/></div>
    <div className="ctrl-grid-2">
      <ControlPanel title="운영 상태" description="광고주 Workspace의 프론트 설정 상태입니다."><div className="ctrl-info-list"><div><span>광고주</span><b>{advertiser?.name||'-'}</b></div><div><span>상태</span><ControlStatus tone={workspace?.status==='active'?'success':'warning'}>{workspace?.status==='active'?'운영 중':workspace?.status==='paused'?'일시중지':'보관'}</ControlStatus></div><div><span>포털</span><ControlStatus tone={workspace?.portalEnabled?'info':'neutral'}>{workspace?.portalEnabled?'미리보기 사용':'비활성'}</ControlStatus></div><div><span>외부 담당자</span><b>{contacts.length}명</b></div></div></ControlPanel>
      <ControlPanel title="계약·구독" description="결제와 분리된 프론트 구독 설정입니다." actions={<Link className="btn secondary" to="/advertisers/subscription">구독 설정</Link>}><div className="ctrl-info-list"><div><span>상품</span><b>{subscription?.plan_name||'미설정'}</b></div><div><span>상태</span><ControlStatus tone={subscription? 'info':'neutral'}>{subscription?.status||'결제 미연동'}</ControlStatus></div><div><span>시작일</span><b>{date(subscription?.started_at)}</b></div><div><span>갱신 예정</span><b>{date(subscription?.renews_at||undefined)}</b></div></div></ControlPanel>
    </div>
    <div className="ctrl-grid-3">
      <Link className="card ctrl-link-card" to="/advertisers/contacts"><Users size={20}/><strong>담당자 관리</strong><span>내부 담당자와 광고주 연락 담당자를 관리합니다.</span></Link>
      <Link className="card ctrl-link-card" to="/advertisers/permissions"><Check size={20}/><strong>기능 권한</strong><span>광고주별 포털 기능 노출 범위를 설정합니다.</span></Link>
      <Link className="card ctrl-link-card" to="/advertisers/portal-preview"><Eye size={20}/><strong>광고주 화면 미리보기</strong><span>현재 권한으로 광고주가 보게 될 화면을 미리 확인합니다.</span></Link>
    </div>
  </div>
}

export function AdvertiserContactsPage(){
  useControlRevision();const rows=advertisers();const [advertiserId,setAdvertiserId]=useState(rows[0]?.id||'');const [name,setName]=useState('');const [title,setTitle]=useState('');const users=loadControlUsers();const memberships=loadMemberships();const workspace=ensureAdvertiserWorkspaces().find(w=>w.advertiserId===advertiserId);const contacts=loadExternalContacts().filter(c=>c.advertiserId===advertiserId);const managers=users.filter(u=>workspace?.internalManagerIds.includes(u.userId));
  const toggleManager=(userId:string)=>{if(!workspace)return;const set=new Set(workspace.internalManagerIds);set.has(userId)?set.delete(userId):set.add(userId);patchAdvertiserWorkspace(advertiserId,{internalManagerIds:[...set]});const m=memberships.find(x=>x.userId===userId);if(m){const a=new Set(m.advertiserIds||[]);a.add(advertiserId);upsertMembership({...m,advertiserIds:[...a]});}};
  return <div className="ctrl-page"><PageHeader title="담당자" description="HOWTOM 내부 담당자와 광고주 회사 담당자를 분리해 관리합니다."/><div className="ctrl-toolbar"><AdvertiserSelect value={advertiserId} onChange={setAdvertiserId}/><BackendBadge/><span className="ctrl-muted">현재 담당자 정보는 로컬 Workspace 설정이며 실제 회원 계정과는 아직 분리되어 있습니다.</span></div><div className="ctrl-grid-2">
    <ControlPanel title="HOWTOM 내부 담당자" description="팀원 계정 연결 전에는 프론트 프로필 기준으로 담당 범위를 관리합니다."><div className="ctrl-check-list">{users.map(u=><label key={u.userId}><input type="checkbox" checked={workspace?.internalManagerIds.includes(u.userId)||false} onChange={()=>toggleManager(u.userId)}/><span><b>{u.name}</b><small>{u.title||'직책 미설정'} {u.isDemo?'· 데모 사용자':''}</small></span></label>)}</div>{!users.length&&<ControlEmpty>등록된 팀원이 없습니다.</ControlEmpty>}</ControlPanel>
    <ControlPanel title="광고주 회사 담당자" description="외부 담당자는 아직 로그인 계정이 아닌 연락처 정보입니다."><form className="ctrl-inline-form" onSubmit={e=>{e.preventDefault();if(!name.trim())return;upsertExternalContact({advertiserId,name:name.trim(),title:title.trim()});setName('');setTitle('')}}><input value={name} onChange={e=>setName(e.target.value)} placeholder="이름"/><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="직책"/><button className="btn primary" type="submit"><Plus size={14}/> 추가</button></form><div className="ctrl-list">{contacts.map(c=><div className="ctrl-list-row" key={c.contactId}><div><b>{c.name}</b><small>{c.title||'직책 미설정'} {c.email?`· ${c.email}`:''}</small></div><button className="icon-btn danger" onClick={()=>deleteExternalContact(c.contactId)}><Trash2 size={15}/></button></div>)}{!contacts.length&&<ControlEmpty>등록된 광고주 담당자가 없습니다.</ControlEmpty>}</div></ControlPanel>
  </div></div>
}

export function AdvertiserPermissionsPage(){
  useControlRevision();const rows=advertisers();const [advertiserId,setAdvertiserId]=useState(rows[0]?.id||'');const all=loadAdvertiserFeatureAccess();const existing=new Map(all.filter(x=>x.advertiserId===advertiserId).map(x=>[x.featureKey,x]));const features=advertiserVisibleFeatures();
  const enabled=(key:string)=>existing.get(key)?.enabled ?? ['dashboard.view','reports.view','assets.view'].includes(key);
  return <div className="ctrl-page"><PageHeader title="기능 권한" description="광고주별로 외부 포털에서 열람·승인할 수 있는 기능을 설정합니다."/><div className="ctrl-toolbar"><AdvertiserSelect value={advertiserId} onChange={setAdvertiserId}/><DemoBadge/><span className="ctrl-muted">서버 권한 강제 전 단계의 프론트 권한 설계입니다.</span></div><ControlPanel title="광고주 기능 권한" description="상품명 대신 featureKey를 사용해 구독 상품이 바뀌어도 기능 코드를 유지합니다."><div className="ctrl-permission-grid">{features.map(f=><label key={f.featureKey} className="ctrl-permission-row"><input type="checkbox" checked={enabled(f.featureKey)} onChange={e=>setAdvertiserFeatureAccess(advertiserId,f.featureKey,e.target.checked)}/><div><b>{f.label}</b><small>{f.group} · {f.featureKey}</small></div><ControlStatus tone={enabled(f.featureKey)?'success':'neutral'}>{enabled(f.featureKey)?'허용':'차단'}</ControlStatus></label>)}</div></ControlPanel></div>
}

export function AdvertiserApprovalsPage(){
  useControlRevision();const rows=advertisers();const [advertiserId,setAdvertiserId]=useState(rows[0]?.id||'');const [title,setTitle]=useState('');const approvals=loadApprovalRequests().filter(x=>x.advertiserId===advertiserId);
  return <div className="ctrl-page"><PageHeader title="승인 요청" description="보고서·제안서·콘텐츠 등 사람의 확인이 필요한 항목을 광고주 단위로 관리합니다."/><div className="ctrl-toolbar"><AdvertiserSelect value={advertiserId} onChange={setAdvertiserId}/><DemoBadge/><span className="ctrl-muted">실제 광고주 계정 승인 대신 내부 검증용 승인 상태를 저장합니다.</span></div><ControlPanel title="승인 요청" actions={<form className="ctrl-inline-form" onSubmit={e=>{e.preventDefault();if(!title.trim())return;createApprovalRequest({advertiserId,targetType:'monthly-report',title:title.trim(),status:'pending',requestedBy:'demo-admin'});setTitle('')}}><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="검토 요청 제목"/><button className="btn primary" type="submit"><Plus size={14}/> 등록</button></form>} description="승인 또는 수정 요청 처리 이력은 활동 기록에 남습니다."><div className="ctrl-list">{approvals.map(a=><div className="ctrl-list-row ctrl-approval-row" key={a.approvalId}><div><b>{a.title}</b><small>{a.targetType} · {date(a.createdAt)}</small></div><ControlStatus tone={a.status==='pending'?'warning':a.status==='approved'?'success':'danger'}>{a.status==='pending'?'확인 대기':a.status==='approved'?'승인':'수정 요청'}</ControlStatus><div className="ctrl-row-actions">{a.status==='pending'&&<><button className="btn secondary" onClick={()=>patchApprovalRequest(a.approvalId,{status:'revision_requested'})}>수정 요청</button><button className="btn primary" onClick={()=>patchApprovalRequest(a.approvalId,{status:'approved'})}>승인</button></>}</div></div>)}{!approvals.length&&<ControlEmpty>승인 요청이 없습니다.</ControlEmpty>}</div></ControlPanel></div>
}

export function AdvertiserSharedMaterialsPage(){
  useControlRevision();const rows=advertisers();const [advertiserId,setAdvertiserId]=useState(rows[0]?.id||'');const assets=useMemo(()=>loadAssets().filter(a=>!a.advertiserId||a.advertiserId===advertiserId),[advertiserId]);const shared=loadSharedAssets().filter(s=>s.advertiserId===advertiserId&&s.status==='shared');const assetById=new Map(loadAssets(true).map(a=>[a.assetId,a]));
  return <div className="ctrl-page"><PageHeader title="공유 자료" description="Asset Engine의 동일 파일을 복제하지 않고 광고주 공유 관계만 관리합니다."/><div className="ctrl-toolbar"><AdvertiserSelect value={advertiserId} onChange={setAdvertiserId}/><BackendBadge/><span className="ctrl-muted">실제 외부 URL·만료 링크는 인증 서버 연결 후 제공합니다.</span></div><div className="ctrl-grid-2"><ControlPanel title="현재 공유 자료" description="광고주 포털 미리보기에도 동일 목록이 노출됩니다."><div className="ctrl-list">{shared.map(s=>{const a=assetById.get(s.assetId);return <div className="ctrl-list-row" key={s.shareId}><div><b>{a?.name||s.label||s.assetId}</b><small>{a?.assetType||'asset'} · {date(s.createdAt)}</small></div><button className="icon-btn danger" onClick={()=>unshareAsset(s.shareId)}><X size={15}/></button></div>})}{!shared.length&&<ControlEmpty>공유 중인 자료가 없습니다.</ControlEmpty>}</div></ControlPanel><ControlPanel title="자산에서 공유 추가" description="실제 파일은 자산관리에서 한 번만 저장됩니다."><div className="ctrl-list ctrl-scroll-list">{assets.slice(0,80).map(a=><div className="ctrl-list-row" key={a.assetId}><div><b>{a.name}</b><small>{a.assetType} · {a.advertiserName||'공통'}</small></div><button className="btn secondary" disabled={shared.some(s=>s.assetId===a.assetId)} onClick={()=>shareAsset(advertiserId,a.assetId,a.name)}>{shared.some(s=>s.assetId===a.assetId)?'공유 중':'공유'}</button></div>)}{!assets.length&&<ControlEmpty>공유 가능한 자산이 없습니다.</ControlEmpty>}</div></ControlPanel></div></div>
}

export function AdvertiserActivityPage(){
  useControlRevision();const rows=advertisers();const [advertiserId,setAdvertiserId]=useState(rows[0]?.id||'');const events=loadAuditEvents().filter(e=>e.advertiserId===advertiserId);
  return <div className="ctrl-page"><PageHeader title="활동 기록" description="광고주와 관련된 권한·담당자·공유·승인 변경을 한 타임라인에서 확인합니다."/><div className="ctrl-toolbar"><AdvertiserSelect value={advertiserId} onChange={setAdvertiserId}/><span className="ctrl-muted">현재는 프론트 감사 이벤트입니다. 정식 보안 감사로그는 서버 append-only 저장이 필요합니다.</span></div><ControlPanel title="광고주 활동 타임라인"><div className="ctrl-timeline">{events.map(e=><div key={e.auditId}><time>{new Date(e.createdAt).toLocaleString('ko-KR')}</time><div><b>{e.action}</b><small>{e.targetType||'system'} {e.targetId?`· ${e.targetId}`:''}</small></div><ControlStatus tone={e.result==='success'?'success':'danger'}>{e.result}</ControlStatus></div>)}{!events.length&&<ControlEmpty>아직 기록된 활동이 없습니다.</ControlEmpty>}</div></ControlPanel></div>
}

export function AdvertiserPortalPreviewPage(){
  useControlRevision();const rows=advertisers();const [advertiserId,setAdvertiserId]=useState(rows[0]?.id||'');const advertiser=rows.find(a=>a.id===advertiserId);const workspace=ensureAdvertiserWorkspaces().find(w=>w.advertiserId===advertiserId);const features=loadAdvertiserFeatureAccess().filter(f=>f.advertiserId===advertiserId&&f.enabled);const explicit=new Map(features.map(f=>[f.featureKey,f.enabled]));const fallback=(key:string)=>explicit.has(key)?!!explicit.get(key):['dashboard.view','reports.view','assets.view'].includes(key);const shared=loadSharedAssets().filter(s=>s.advertiserId===advertiserId&&s.status==='shared').length;const approvals=loadApprovalRequests().filter(a=>a.advertiserId===advertiserId&&a.status==='pending').length;
  const [subscription,setSubscription]=useState<AdvertiserSubscriptionRow|null>(null);
  useEffect(()=>{ if(!advertiserId){setSubscription(null);return;} subscriptionApi.getSubscription(advertiserId).then(setSubscription).catch(()=>setSubscription(null)); },[advertiserId]);
  const menu=[['성과 홈','dashboard.view'],['광고 데이터','ads.view'],['인사이트','insights.view'],['AI 추천','insights.ai.use'],['월간 보고서','reports.view'],['다음달 제안서','reports.proposal'],['공유 자료','assets.view'],['승인 요청','reports.approve']].filter(([,key])=>fallback(key));
  return <div className="ctrl-page"><PageHeader title="광고주 접속 화면" description="실제 외부 로그인 전 광고주별 권한과 구독에 따른 포털 화면을 미리 확인합니다."/><div className="ctrl-toolbar"><AdvertiserSelect value={advertiserId} onChange={v=>{setAdvertiserId(v);const w=ensureAdvertiserWorkspaces().find(x=>x.advertiserId===v);if(w&&!w.portalEnabled)patchAdvertiserWorkspace(v,{portalEnabled:true})}}/><DemoBadge/><BackendBadge/><span className="ctrl-muted">이 화면은 미리보기이며 실제 광고주 인증 세션이 아닙니다.</span></div><div className="ctrl-portal-preview card"><aside><div className="ctrl-portal-brand">HOWTOM <span>Universe</span></div><strong>{advertiser?.name}</strong><small>{subscription?.plan_name||'구독 미설정'}</small><nav>{menu.map(([label,key])=><button key={key}>{label}</button>)}</nav></aside><main><header><div><small>광고주 포털 미리보기</small><h2>{advertiser?.name}</h2></div><ControlStatus tone="info">Preview Mode</ControlStatus></header><div className="ctrl-kpi-grid small"><ControlKpi label="허용 메뉴" value={`${menu.length}개`}/><ControlKpi label="공유 자료" value={`${shared}건`}/><ControlKpi label="승인 대기" value={`${approvals}건`}/><ControlKpi label="연결 매체" value={`${advertiser?.links.filter(l=>l.status==='연결됨').length||0}개`}/></div><div className="ctrl-portal-message"><h3>실제 광고 성과 데이터는 기존 HOWTOM 분석 화면을 사용합니다.</h3><p>포털 Ver.1은 권한·구독·공유·승인 동선을 검증하는 프론트엔드 미리보기입니다. 실제 외부 계정 로그인과 데이터 격리는 백엔드 구축 단계에서 서버 권한으로 강제합니다.</p></div></main></div></div>
}
