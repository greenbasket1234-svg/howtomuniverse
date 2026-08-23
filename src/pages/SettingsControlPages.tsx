import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Bell, Bot, Building2, ChevronLeft, Database, FileSpreadsheet, FileText, HardDrive, KeyRound, MessageSquare, Monitor, Save, Settings2, ShieldCheck, Sparkles, UserRound, Users, WalletCards, Workflow,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { loadAssets } from '../utils/assetStore';
import { loadUsageEvents } from '../utils/subscriptionStore';
import { ControlEmpty, ControlKpi, ControlPanel, ControlStatus, BackendBadge, DemoBadge } from '../control/ControlUi';
import {
  loadControlUiSettings,
  loadControlUsers,
  loadMemberships,
  loadOrganization,
  loadRoles,
  loadSecurityPolicy,
  saveControlUiSettings,
  saveOrganization,
  saveSecurityPolicy,
  upsertControlUser,
  upsertMembership,
} from '../control/controlStore';

const SETTINGS_SECTIONS = [
  ['account','내 정보','프로필, 역할, 담당 광고주와 계정 상태를 확인합니다.',UserRound],
  ['company','회사 정보','회사 기본 정보와 보고서·포털 공통 표시 정보를 관리합니다.',Building2],
  ['team','팀원 관리','팀원 프로필, 역할과 담당 광고주 범위를 관리합니다.',Users],
  ['display','화면 설정','시작 화면, 화면 밀도와 날짜 표시 방식을 설정합니다.',Monitor],
  ['notifications','알림 설정','내부 알림 수신과 자동화 알림 기본 동작을 관리합니다.',Bell],
  ['integrations','매체 계정 연동','광고 매체와 Google Sheets 연결 화면으로 이동합니다.',Database],
  ['metrics','지표 설정','KPI·퍼널·수식과 표시 지표 운영 설정을 관리합니다.',Settings2],
  ['reports','보고서 설정','보고서·제안서의 회사 정보와 외부 연동 기준을 관리합니다.',Settings2],
  ['content','콘텐츠 설정','콘텐츠 제작 기본값과 검토 정책을 관리합니다.',Sparkles],
  ['ai','AI 설정','AI 사용 정책, 비용 한도와 Provider 연결 준비 상태를 관리합니다.',Bot],
  ['automation','자동화 설정','자동화 기본 시간대, 승인과 실패 처리 정책을 관리합니다.',Workflow],
  ['storage','저장 공간','브라우저 자산과 향후 클라우드 저장 공간 사용량을 확인합니다.',HardDrive],
  ['subscription','구독 결제','HOWTOM 사용 상품과 결제 연결 상태를 확인합니다.',WalletCards],
  ['security','보안','세션·민감정보·2FA·SSO 정책과 서버 전환 기준을 관리합니다.',ShieldCheck],
] as const;

type ControlSettingsKey = typeof SETTINGS_SECTIONS[number][0];
const defaultUi={startPage:'/home',displayDensity:'comfortable',dateFormat:'YYYY. M. D.',notifyInternal:true,notifyFailure:true,contentReviewRequired:true,aiMode:'manual',aiMonthlyBudget:30000,automationApproval:true,automationFailure:'notify'};
function useRevision(){const [v,setV]=useState(0);useEffect(()=>{const f=()=>setV(x=>x+1);window.addEventListener('howtom:control-changed',f);return()=>window.removeEventListener('howtom:control-changed',f)},[]);return v}
function bytes(v:number){if(v<1024)return `${v} B`;if(v<1024**2)return `${(v/1024).toFixed(1)} KB`;if(v<1024**3)return `${(v/1024**2).toFixed(1)} MB`;return `${(v/1024**3).toFixed(2)} GB`}

export function PlatformSettingsHubPage(){
  return <div className="ctrl-page"><PageHeader title="설정" description="내 계정과 회사 운영 기준, 콘텐츠·AI·자동화·구독·보안 설정을 관리합니다."/><div className="ctrl-settings-grid">{SETTINGS_SECTIONS.map(([key,title,desc,Icon])=><Link className="card ctrl-settings-card" key={key} to={`/settings/control/${key}`}><div className="ctrl-settings-icon"><Icon size={20}/></div><div><strong>{title}</strong><p>{desc}</p></div><span>열기 →</span></Link>)}</div><div className="ctrl-setting-note"><b>운영 기준 설정 보존</b><span>설정 홈(/settings)과 14개 설정 영역을 기준 화면으로 사용합니다. KPI·퍼널·수식·Google Sheets 같은 전문 운영 설정은 각 영역 안의 “세부 운영 설정”에서 연결됩니다.</span></div></div>
}

export function PlatformSettingsSectionPage(){
  useRevision();
  const {sectionKey}=useParams<{sectionKey:ControlSettingsKey}>();
  const meta=SETTINGS_SECTIONS.find(x=>x[0]===sectionKey);
  if(!meta)return <Navigate to="/settings" replace/>;
  const [,title,desc,Icon]=meta;
  return <div className="ctrl-page"><div className="ctrl-back-row"><Link to="/settings"><ChevronLeft size={15}/> 설정</Link></div><PageHeader title={title} description={desc}/><div className="ctrl-toolbar"><Icon size={18}/>{sectionKey==='account'&&<DemoBadge/>}{['subscription','security','integrations','ai'].includes(sectionKey||'')&&<BackendBadge/>}</div>{renderSection(sectionKey!)}</div>
}

function renderSection(key:ControlSettingsKey){
  if(key==='account')return <AccountSettings/>;
  if(key==='company')return <CompanySettings/>;
  if(key==='team')return <TeamSettings/>;
  if(key==='display')return <SimpleSettings kind="display"/>;
  if(key==='notifications')return <SimpleSettings kind="notifications"/>;
  if(key==='integrations')return <IntegrationSettings/>;
  if(key==='metrics')return <LegacyLinks kind="metrics"/>;
  if(key==='reports')return <LegacyLinks kind="reports"/>;
  if(key==='content')return <SimpleSettings kind="content"/>;
  if(key==='ai')return <SimpleSettings kind="ai"/>;
  if(key==='automation')return <SimpleSettings kind="automation"/>;
  if(key==='storage')return <StorageSettings/>;
  if(key==='subscription')return <SubscriptionSettings/>;
  return <SecuritySettings/>;
}

function AccountSettings(){
  const user=loadControlUsers()[0];const memberships=loadMemberships().filter(m=>m.userId===user?.userId);const roles=loadRoles();const [name,setName]=useState(user?.name||'');const [email,setEmail]=useState(user?.email||'');const [title,setTitle]=useState(user?.title||'');const roleNames=roles.filter(r=>memberships.some(m=>m.roleIds.includes(r.roleId))).map(r=>r.name);
  const save=()=>{if(!user)return;upsertControlUser({...user,name,email,title});};
  return <div className="ctrl-grid-2"><ControlPanel title="프로필" description="데모 모드에서는 브라우저 로컬 프로필만 변경합니다."><div className="ctrl-form-grid"><label>이름<input value={name} onChange={e=>setName(e.target.value)}/></label><label>이메일<input value={email} onChange={e=>setEmail(e.target.value)}/></label><label>직책<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>계정 상태<input value={user?.isDemo?'데모 사용자':'활성'} disabled/></label></div><button className="btn primary" onClick={save}><Save size={14}/> 저장</button></ControlPanel><ControlPanel title="내 권한" description="실제 로그인 계정과 권한은 서버 인증 구축 후 강제됩니다."><div className="ctrl-info-list"><div><span>역할</span><b>{roleNames.join(', ')||'미설정'}</b></div><div><span>담당 광고주</span><b>{memberships.some(m=>!m.advertiserIds?.length)?'전체':`${new Set(memberships.flatMap(m=>m.advertiserIds||[])).size}곳`}</b></div><div><span>최근 로그인</span><b>{user?.lastLoginAt?new Date(user.lastLoginAt).toLocaleString('ko-KR'):'데모 세션'}</b></div><div><span>비밀번호 변경</span><BackendBadge/></div></div></ControlPanel></div>
}

function CompanySettings(){
  const org=loadOrganization();const [form,setForm]=useState(org);const set=(k:keyof typeof form,v:any)=>setForm(prev=>({...prev,[k]:v}));return <ControlPanel title="회사 기본 정보" description="보고서·제안서·광고주 포털에서 공통으로 사용할 Source of Truth입니다."><div className="ctrl-form-grid"><label>회사명<input value={form.name} onChange={e=>set('name',e.target.value)}/></label><label>법인/사업자명<input value={form.legalName||''} onChange={e=>set('legalName',e.target.value)}/></label><label>사업자번호<input value={form.businessNumber||''} onChange={e=>set('businessNumber',e.target.value)}/></label><label>대표 전화<input value={form.phone||''} onChange={e=>set('phone',e.target.value)}/></label><label>홈페이지<input value={form.website||''} onChange={e=>set('website',e.target.value)}/></label><label>주소<input value={form.address||''} onChange={e=>set('address',e.target.value)}/></label></div><button className="btn primary" onClick={()=>saveOrganization(form)}><Save size={14}/> 회사 정보 저장</button></ControlPanel>
}

function TeamSettings(){
  const users=loadControlUsers();const memberships=loadMemberships();const roles=loadRoles().filter(r=>r.scope==='internal');const [name,setName]=useState('');const [roleId,setRoleId]=useState(roles[0]?.roleId||'');
  const add=()=>{if(!name.trim())return;const u=upsertControlUser({name:name.trim(),title:'팀원',status:'active'});upsertMembership({userId:u.userId,roleIds:roleId?[roleId]:[]});setName('')};
  return <><ControlPanel title="팀원 관리" description="실제 이메일 초대·가입·퇴사자 세션 차단은 서버 회원 시스템 이후 연결합니다." actions={<BackendBadge/>}><div className="ctrl-inline-form"><input value={name} onChange={e=>setName(e.target.value)} placeholder="프론트 프로필 이름"/><select value={roleId} onChange={e=>setRoleId(e.target.value)}>{roles.map(r=><option value={r.roleId} key={r.roleId}>{r.name}</option>)}</select><button className="btn primary" onClick={add}>로컬 프로필 추가</button><button className="btn secondary" disabled>이메일 초대 (미구현)</button></div><div className="ctrl-table-wrap"><table className="ctrl-table"><thead><tr><th>팀원</th><th>직책</th><th>역할</th><th>광고주 범위</th><th>상태</th></tr></thead><tbody>{users.map(u=>{const ms=memberships.filter(m=>m.userId===u.userId);return <tr key={u.userId}><td><b>{u.name}</b>{u.isDemo&&<small className="ctrl-cell-sub">데모 사용자</small>}</td><td>{u.title||'-'}</td><td>{roles.filter(r=>ms.some(m=>m.roleIds.includes(r.roleId))).map(r=>r.name).join(', ')||'-'}</td><td>{ms.some(m=>!m.advertiserIds?.length)?'전체':`${new Set(ms.flatMap(m=>m.advertiserIds||[])).size}곳`}</td><td><ControlStatus tone={u.status==='active'?'success':'warning'}>{u.status}</ControlStatus></td></tr>})}</tbody></table></div></ControlPanel></>
}

function SimpleSettings({kind}:{kind:'display'|'notifications'|'content'|'ai'|'automation'}){
  const saved={...defaultUi,...loadControlUiSettings()} as typeof defaultUi;const [state,setState]=useState(saved);const patch=(key:keyof typeof state,value:any)=>setState(prev=>({...prev,[key]:value}));const save=()=>saveControlUiSettings(state as unknown as Record<string,unknown>);
  if(kind==='display')return <ControlPanel title="화면 설정" description="HOWTOM UI 개인 환경 설정은 브라우저에 저장됩니다."><div className="ctrl-form-grid"><label>시작 화면<select value={state.startPage} onChange={e=>patch('startPage',e.target.value)}><option value="/home">통합 홈</option><option value="/dashboard">전체 대시보드</option><option value="/insights">인사이트</option></select></label><label>화면 밀도<select value={state.displayDensity} onChange={e=>patch('displayDensity',e.target.value)}><option value="comfortable">기본</option><option value="compact">컴팩트</option></select></label><label>날짜 표시<input value={state.dateFormat} onChange={e=>patch('dateFormat',e.target.value)}/></label></div><button className="btn primary" onClick={save}><Save size={14}/> 저장</button></ControlPanel>;
  if(kind==='notifications')return <ControlPanel title="알림 기본 설정" description="알림 규칙 자체는 AI 자동화 → 알림 자동화에서 관리합니다."><div className="ctrl-toggle-list"><label><input type="checkbox" checked={state.notifyInternal} onChange={e=>patch('notifyInternal',e.target.checked)}/><span><b>HOWTOM 내부 알림</b><small>프론트에서 실제 사용할 수 있는 기본 알림 채널</small></span></label><label><input type="checkbox" checked={state.notifyFailure} onChange={e=>patch('notifyFailure',e.target.checked)}/><span><b>자동화 실패 알림</b><small>실패/데이터 수집 오류를 내부 알림으로 받습니다.</small></span></label></div><div className="ctrl-action-line"><button className="btn primary" onClick={save}><Save size={14}/> 저장</button><Link className="btn secondary" to="/automation/notifications">알림 자동화 열기</Link></div></ControlPanel>;
  if(kind==='content')return <ControlPanel title="콘텐츠 제작 기본값" description="광고·블로그·문서 제작의 공통 검토 정책입니다."><div className="ctrl-toggle-list"><label><input type="checkbox" checked={state.contentReviewRequired} onChange={e=>patch('contentReviewRequired',e.target.checked)}/><span><b>완료 전 담당자 검토 필수</b><small>AI/자동화 결과를 바로 발행하지 않고 Human-in-the-loop를 유지합니다.</small></span></label></div><button className="btn primary" onClick={save}><Save size={14}/> 저장</button></ControlPanel>;
  if(kind==='ai')return <><div className="ctrl-grid-2"><ControlPanel title="AI 사용 정책" description="초기 Pre-Revenue에서는 수동 호출을 기본으로 유지합니다."><div className="ctrl-form-grid"><label>기본 실행<select value={state.aiMode} onChange={e=>patch('aiMode',e.target.value)}><option value="manual">수동 심층 분석</option><option value="hybrid">규칙 + 선택적 AI</option></select></label><label>월 예산 한도<input type="number" value={state.aiMonthlyBudget} onChange={e=>patch('aiMonthlyBudget',Number(e.target.value))}/></label></div><button className="btn primary" onClick={save}><Save size={14}/> 정책 저장</button></ControlPanel><ControlPanel title="Provider 연결" description="API Key와 Secret은 브라우저 localStorage에 저장하지 않습니다."><div className="ctrl-info-list"><div><span>OpenAI API</span><BackendBadge/></div><div><span>Claude API</span><BackendBadge/></div><div><span>비밀키 저장</span><b>서버 Secret Store만 허용</b></div></div></ControlPanel></div></>;
  return <ControlPanel title="자동화 기본 정책" description="예약·보고서·콘텐츠 자동화의 공통 안전 기준입니다."><div className="ctrl-toggle-list"><label><input type="checkbox" checked={state.automationApproval} onChange={e=>patch('automationApproval',e.target.checked)}/><span><b>외부 반영 전 승인 단계</b><small>보고서·콘텐츠·광고 변경은 담당자 확인 후 진행합니다.</small></span></label></div><div className="ctrl-form-grid"><label>실패 처리<select value={state.automationFailure} onChange={e=>patch('automationFailure',e.target.value)}><option value="notify">실패 기록 + 내부 알림</option><option value="pause">실패 기록 + 작업 일시중지</option></select></label></div><div className="ctrl-action-line"><button className="btn primary" onClick={save}><Save size={14}/> 저장</button><Link className="btn secondary" to="/automation/overview">자동화 현황 열기</Link></div></ControlPanel>
}

function IntegrationSettings(){return <div className="ctrl-grid-2"><ControlPanel title="광고 매체 계정" description="실제 OAuth·토큰 보관은 서버 연결 이후 활성화합니다."><div className="ctrl-info-list"><div><span>현재 방식</span><b>프론트 Connector / Mock Gate</b></div><div><span>Secret 보관</span><b>브라우저 저장 금지</b></div></div><Link className="btn primary" to="/ad-accounts/connections">매체 계정 연동 열기</Link></ControlPanel><ControlPanel title="DB Google Sheets" description="Pre-Revenue 단계의 핵심 데이터 연결 방식입니다."><div className="ctrl-info-list"><div><span>연동 방식</span><b>Google Sheet / Apps Script</b></div><div><span>유료 서버</span><b>필요 시점까지 미사용 가능</b></div></div><Link className="btn primary" to="/settings/advanced/db-integrations">DB 연동 설정 열기</Link></ControlPanel>
  <div style={{gridColumn:'1 / -1'}}><ControlPanel title="HOWTOM 작업 연동" description="사내에서 쓰는 협업 도구에 유니버스 데이터·알림을 연결합니다. 매체 API·서버 연동 이후 순서대로 진행할 예정입니다.">
    <div className="ctrl-work-integration-list">
      <div className="ctrl-work-integration-row"><MessageSquare size={18}/><div><b>네이버웍스 연동</b><span>예산·이상 징후 알림을 사내 메신저로 발송합니다.</span></div><ControlStatus>연동 예정</ControlStatus></div>
      <div className="ctrl-work-integration-row"><FileText size={18}/><div><b>노션 연동</b><span>완성된 월간 보고서·제안서를 노션 워크스페이스로 내보냅니다.</span></div><ControlStatus>연동 예정</ControlStatus></div>
      <div className="ctrl-work-integration-row"><FileSpreadsheet size={18}/><div><b>구글 시트 연동</b><span>광고주별 실적·업무 데이터를 구글 시트와 동기화합니다.</span></div><ControlStatus>연동 예정</ControlStatus></div>
    </div>
  </ControlPanel></div>
</div>}
function LegacyLinks({kind}:{kind:'metrics'|'reports'}){return kind==='metrics'?<div className="ctrl-grid-3"><Link className="card ctrl-link-card" to="/settings/advanced/metrics"><Settings2 size={20}/><strong>세부 운영 지표 표시</strong><span>대시보드 기본 표시 지표를 관리합니다.</span></Link><Link className="card ctrl-link-card" to="/settings/advanced/funnel-events"><Workflow size={20}/><strong>세부 운영 퍼널 이벤트</strong><span>매체 이벤트를 표준 전환 단계로 연결합니다.</span></Link><Link className="card ctrl-link-card" to="/settings/advanced/formulas-thresholds"><Settings2 size={20}/><strong>세부 운영 수식 임계값</strong><span>CTR·CPA·ROAS·경고 기준을 관리합니다.</span></Link></div>:<div className="ctrl-grid-2"><Link className="card ctrl-link-card" to="/settings/advanced/report-integrations"><Settings2 size={20}/><strong>세부 운영 보고서 연동</strong><span>PDF·Sheets 등 보고서 저장·전송 기준을 관리합니다.</span></Link><Link className="card ctrl-link-card" to="/settings/advanced/proposal-settings"><Settings2 size={20}/><strong>세부 운영 제안 계산 기준</strong><span>다음달 제안서의 예산 산정 기준을 관리합니다.</span></Link></div>}

function StorageSettings(){const assets=loadAssets(true);const fileBytes=assets.reduce((s,a)=>s+(a.fileSize||0),0);let localBytes=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k)localBytes+=(k.length+(localStorage.getItem(k)?.length||0))*2}return <><div className="ctrl-kpi-grid"><ControlKpi label="자산 인덱스" value={`${assets.length}개`}/><ControlKpi label="자산 메타 파일크기" value={bytes(fileBytes)} sub="파일크기 메타가 있는 항목만"/><ControlKpi label="localStorage 추정" value={bytes(localBytes)} sub="브라우저 문자열 기준"/><ControlKpi label="클라우드 저장" value="미연동" sub="R2/서버 연결 후 실측"/></div><ControlPanel title="저장 구조" description="실제 파일은 Asset Engine, Blob은 IndexedDB/향후 Object Storage로 분리합니다."><div className="ctrl-info-list"><div><span>브라우저 메타데이터</span><b>localStorage</b></div><div><span>로컬 Blob</span><b>IndexedDB</b></div><div><span>클라우드 Blob</span><BackendBadge/></div><div><span>광고주별 사용량 과금</span><BackendBadge/></div></div></ControlPanel></>}

function SubscriptionSettings(){const usage=loadUsageEvents();return <div className="ctrl-grid-2"><ControlPanel title="HOWTOM 내부 사용 상태" description="현재 프론트엔드 Ver.1은 결제 없는 사내 검증 모드입니다."><div className="ctrl-info-list"><div><span>플랫폼 상태</span><ControlStatus tone="info">Pre-Revenue / Internal</ControlStatus></div><div><span>결제 수단</span><b>미연동</b></div><div><span>이번 달 기록된 AI/콘텐츠 사용 이벤트</span><b>{usage.length}건</b></div><div><span>다음 결제</span><b>-</b></div></div></ControlPanel><ControlPanel title="결제 기능" description="실제 정기 결제는 구독 판매가 시작될 때 PG와 서버 Webhook을 연결합니다."><div className="ctrl-disabled-actions"><button className="btn secondary" disabled>상품 변경 (미구현)</button><button className="btn secondary" disabled>결제수단 등록 (미구현)</button></div><p className="ctrl-muted">현재 광고주 계약·구독 설정은 기능 한도 테스트용이며 실제 청구 내역이 아닙니다.</p></ControlPanel></div>}

function SecuritySettings(){const original=loadSecurityPolicy();const [p,setP]=useState(original);return <div className="ctrl-grid-2"><ControlPanel title="프론트 보안 정책" description="서버 인증 전에도 비밀정보를 브라우저에 저장하지 않는 원칙을 유지합니다."><div className="ctrl-form-grid"><label>자동 로그아웃 기준(분)<input type="number" value={p.sessionTimeoutMinutes} onChange={e=>setP({...p,sessionTimeoutMinutes:Number(e.target.value)})}/></label><label>광고주 공유 승인<select value={p.requireApprovalForExternalShare?'yes':'no'} onChange={e=>setP({...p,requireApprovalForExternalShare:e.target.value==='yes'})}><option value="yes">승인 필요</option><option value="no">승인 생략</option></select></label></div><div className="ctrl-toggle-list"><label><input type="checkbox" checked={p.maskSensitiveInfo} onChange={e=>setP({...p,maskSensitiveInfo:e.target.checked})}/><span><b>민감정보 마스킹</b><small>계정·연락처 화면에서 최소 정보만 표시합니다.</small></span></label></div><button className="btn primary" onClick={()=>saveSecurityPolicy(p)}><Save size={14}/> 정책 저장</button></ControlPanel><ControlPanel title="서버 보안 기능" description="실제 로그인·세션·2FA·SSO는 백엔드 회원 시스템 구축 단계에서 연결합니다."><div className="ctrl-info-list"><div><span>2단계 인증</span><BackendBadge/></div><div><span>네이버웍스 SSO</span><BackendBadge/></div><div><span>API Key / Secret</span><b>서버 Secret Store</b></div><div><span>감사로그</span><b>프론트 이벤트 → 서버 append-only 전환 예정</b></div></div></ControlPanel></div>}
