import { loadAdvertisers } from '../data/advertisers';
import type {
  AdvertiserFeatureAccess,
  AdvertiserWorkspace,
  ApprovalRequest,
  AuditEvent,
  ControlUser,
  ExternalContact,
  FeatureFlag,
  Membership,
  Notice,
  Organization,
  RoleDefinition,
  SecurityPolicy,
  SharedAssetRelation,
  SubscriptionPlanDefinition,
} from './controlTypes';

const KEYS = {
  organization: 'howtom-control-organization-v1',
  users: 'howtom-control-users-v1',
  memberships: 'howtom-control-memberships-v1',
  roles: 'howtom-control-roles-v1',
  workspaces: 'howtom-control-advertiser-workspaces-v1',
  contacts: 'howtom-control-advertiser-contacts-v1',
  featureAccess: 'howtom-control-advertiser-features-v1',
  sharedAssets: 'howtom-control-shared-assets-v1',
  approvals: 'howtom-control-approval-requests-v1',
  plans: 'howtom-control-plan-definitions-v1',
  flags: 'howtom-control-feature-flags-v1',
  notices: 'howtom-control-notices-v1',
  audit: 'howtom-control-audit-v1',
  security: 'howtom-control-security-policy-v1',
  menuVisibility: 'howtom-control-menu-visibility-v1',
  settings: 'howtom-control-ui-settings-v1',
} as const;

const now = () => new Date().toISOString();
const makeId = (prefix:string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

function parse<T>(key:string, fallback:T):T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}
function save<T>(key:string, value:T, eventName?:string) {
  localStorage.setItem(key, JSON.stringify(value));
  if (eventName) window.dispatchEvent(new CustomEvent(eventName, { detail: value }));
}

const DEFAULT_ORG: Organization = {
  organizationId: 'howtom',
  name: '하우투엠',
  legalName: '하우투엠',
  settings: {
    timezone: 'Asia/Seoul',
    currency: 'KRW',
    locale: 'ko-KR',
    defaultLanding: '/home',
    dateFormat: 'YYYY. M. D.',
    displayDensity: 'comfortable',
    sessionTimeoutMinutes: 30,
    advertiserDataPolicy: 'assigned-only',
  },
  createdAt: now(),
  updatedAt: now(),
};

const DEFAULT_USERS: ControlUser[] = [];

const ALL_INTERNAL_PERMISSIONS = [
  'dashboard.view','ads.view','campaign.view','campaign.edit','insights.view','insights.ai.use',
  'reports.view','reports.proposal','reports.generate','reports.approve','content.create','content.approve','content.blog','assets.view','assets.upload',
  'automation.view','automation.manage','advertisers.view','advertisers.manage','settings.manage','admin.users.manage',
  'admin.roles.manage','admin.plans.manage','admin.system.manage',
];
const MARKETER_PERMISSIONS = [
  'dashboard.view','ads.view','campaign.view','campaign.edit','insights.view','insights.ai.use','reports.view','reports.proposal','reports.generate',
  'content.create','content.blog','assets.view','assets.upload','automation.view','advertisers.view',
];
const DESIGNER_PERMISSIONS = ['dashboard.view','insights.view','content.create','assets.view','assets.upload','advertisers.view'];
const ADVERTISER_BASIC = ['dashboard.view','reports.view','assets.view'];
const ADVERTISER_PRO = [...ADVERTISER_BASIC,'insights.view','insights.ai.use','reports.approve','content.blog'];

const DEFAULT_ROLES: RoleDefinition[] = [
  { roleId:'role-admin', name:'관리자', description:'HOWTOM 전체 설정과 관리 기능을 사용할 수 있습니다.', scope:'internal', permissionKeys:ALL_INTERNAL_PERMISSIONS, system:true, createdAt:now(), updatedAt:now() },
  { roleId:'role-marketer', name:'마케터', description:'광고 운영·분석·보고서·콘텐츠 실무 권한입니다.', scope:'internal', permissionKeys:MARKETER_PERMISSIONS, system:true, createdAt:now(), updatedAt:now() },
  { roleId:'role-designer', name:'디자이너', description:'콘텐츠·자산·소재 인사이트 중심 권한입니다.', scope:'internal', permissionKeys:DESIGNER_PERMISSIONS, system:true, createdAt:now(), updatedAt:now() },
  { roleId:'role-advertiser-basic', name:'광고주 Basic', description:'광고주 포털 기본 열람 권한입니다.', scope:'advertiser', permissionKeys:ADVERTISER_BASIC, system:true, createdAt:now(), updatedAt:now() },
  { roleId:'role-advertiser-pro', name:'광고주 Pro', description:'광고주 포털 분석·승인 확장 권한입니다.', scope:'advertiser', permissionKeys:ADVERTISER_PRO, system:true, createdAt:now(), updatedAt:now() },
];

const DEFAULT_PLANS: SubscriptionPlanDefinition[] = [];

const DEFAULT_FLAGS: FeatureFlag[] = [
  ['insights.competitors','경쟁사 분석','internal'],['insights.trends','광고 트렌드','internal'],['insights.hook-cta','후킹·CTA 분석','internal'],
  ['insights.ai','AI 추천','internal'],['automation.report','보고서 자동 생성','internal'],['automation.ad-copy','광고 문구 자동 생성','internal'],
  ['content.blog','블로그 제작','public'],['advertiser.portal','광고주 포털','public'],['billing.pg','정기 결제','disabled'],['security.sso','SSO','disabled'],
].map(([featureKey,label,state]) => ({featureKey,label,state:state as FeatureFlag['state'],updatedAt:now()}));

const DEFAULT_SECURITY: SecurityPolicy = {
  sessionTimeoutMinutes: 30,
  requireApprovalForExternalShare: true,
  maskSensitiveInfo: true,
  allowLocalSecretStorage: false,
  twoFactorEnabled: false,
  ssoEnabled: false,
};

export function ensureControlSeed() {
  if (!localStorage.getItem(KEYS.organization)) save(KEYS.organization, DEFAULT_ORG);
  if (!localStorage.getItem(KEYS.users)) save(KEYS.users, DEFAULT_USERS);
  if (!localStorage.getItem(KEYS.roles)) save(KEYS.roles, DEFAULT_ROLES);
  if (!localStorage.getItem(KEYS.memberships)) save(KEYS.memberships, [] as Membership[]);
  if (!localStorage.getItem(KEYS.plans)) save(KEYS.plans, DEFAULT_PLANS);
  if (!localStorage.getItem(KEYS.flags)) save(KEYS.flags, DEFAULT_FLAGS);
  if (!localStorage.getItem(KEYS.security)) save(KEYS.security, DEFAULT_SECURITY);
  ensureAdvertiserWorkspaces();
}

export function loadOrganization(){ensureControlSeed();return parse<Organization>(KEYS.organization,DEFAULT_ORG);}
export function saveOrganization(value:Organization){save(KEYS.organization,{...value,updatedAt:now()},'howtom:control-changed');appendAudit({action:'organization.update',targetType:'organization',targetId:value.organizationId});}

export function loadControlUsers(){ensureControlSeed();return parse<ControlUser[]>(KEYS.users,DEFAULT_USERS);}
export function saveControlUsers(rows:ControlUser[]){save(KEYS.users,rows,'howtom:control-changed');}
export function upsertControlUser(input:Partial<ControlUser>&{name:string}){
  const rows=loadControlUsers(); const stamp=now(); const userId=input.userId||makeId('user');
  const row:ControlUser={userId,name:input.name,email:input.email,title:input.title,department:input.department,status:input.status||'active',avatarUrl:input.avatarUrl,lastLoginAt:input.lastLoginAt,isDemo:input.isDemo,createdAt:input.createdAt||stamp,updatedAt:stamp};
  saveControlUsers(rows.some(x=>x.userId===userId)?rows.map(x=>x.userId===userId?row:x):[row,...rows]);
  appendAudit({action:input.userId?'user.update':'user.create',targetType:'user',targetId:userId}); return row;
}

export function loadMemberships(){ensureControlSeed();return parse<Membership[]>(KEYS.memberships,[]);}
export function saveMemberships(rows:Membership[]){save(KEYS.memberships,rows,'howtom:control-changed');}
export function upsertMembership(input:Partial<Membership>&{userId:string}){
  const rows=loadMemberships();const stamp=now();const existing=rows.find(x=>x.userId===input.userId&&x.organizationId===(input.organizationId||'howtom'));
  const row:Membership={membershipId:existing?.membershipId||input.membershipId||makeId('membership'),organizationId:input.organizationId||'howtom',userId:input.userId,roleIds:input.roleIds||existing?.roleIds||[],advertiserIds:input.advertiserIds??existing?.advertiserIds,createdAt:existing?.createdAt||stamp,updatedAt:stamp};
  saveMemberships(existing?rows.map(x=>x.membershipId===existing.membershipId?row:x):[row,...rows]); return row;
}

export function loadRoles(){ensureControlSeed();return parse<RoleDefinition[]>(KEYS.roles,DEFAULT_ROLES);}
export function saveRoles(rows:RoleDefinition[]){save(KEYS.roles,rows,'howtom:control-changed');}
export function upsertRole(input:Partial<RoleDefinition>&{name:string}){
  const rows=loadRoles(); const stamp=now(); const roleId=input.roleId||makeId('role');
  const current=rows.find(x=>x.roleId===roleId);
  const row:RoleDefinition={roleId,name:input.name,description:input.description||'',scope:input.scope||current?.scope||'internal',permissionKeys:input.permissionKeys||current?.permissionKeys||[],system:input.system??current?.system,createdAt:current?.createdAt||stamp,updatedAt:stamp};
  saveRoles(current?rows.map(x=>x.roleId===roleId?row:x):[row,...rows]);appendAudit({action:current?'role.update':'role.create',targetType:'role',targetId:roleId});return row;
}

export function loadAdvertiserWorkspaces(){ensureControlSeed();return parse<AdvertiserWorkspace[]>(KEYS.workspaces,[]);}
export function ensureAdvertiserWorkspaces(){
  const advertisers=loadAdvertisers().filter(a=>a.id!=='default'); const rows=parse<AdvertiserWorkspace[]>(KEYS.workspaces,[]); const stamp=now(); let changed=false; const next=[...rows];
  advertisers.forEach(a=>{if(!next.some(w=>w.advertiserId===a.id)){next.push({workspaceId:`workspace-${a.id}`,advertiserId:a.id,status:'active',internalManagerIds:[],externalContactIds:[],portalEnabled:false,createdAt:stamp,updatedAt:stamp});changed=true;}});
  if(changed)save(KEYS.workspaces,next,'howtom:control-changed'); return next;
}
export function patchAdvertiserWorkspace(advertiserId:string,patch:Partial<AdvertiserWorkspace>){
  const rows=ensureAdvertiserWorkspaces();const current=rows.find(x=>x.advertiserId===advertiserId);if(!current)return null;const updated={...current,...patch,updatedAt:now()};save(KEYS.workspaces,rows.map(x=>x.advertiserId===advertiserId?updated:x),'howtom:control-changed');appendAudit({action:'advertiser.workspace.update',advertiserId,targetType:'advertiser',targetId:advertiserId});return updated;
}

export function loadExternalContacts(){ensureControlSeed();return parse<ExternalContact[]>(KEYS.contacts,[]);}
export function upsertExternalContact(input:Partial<ExternalContact>&{advertiserId:string;name:string}){
  const rows=loadExternalContacts();const stamp=now();const contactId=input.contactId||makeId('contact');const current=rows.find(x=>x.contactId===contactId);
  const row:ExternalContact={contactId,advertiserId:input.advertiserId,name:input.name,title:input.title,email:input.email,phone:input.phone,note:input.note,createdAt:current?.createdAt||stamp,updatedAt:stamp};
  save(KEYS.contacts,current?rows.map(x=>x.contactId===contactId?row:x):[row,...rows],'howtom:control-changed');
  const workspace=ensureAdvertiserWorkspaces().find(x=>x.advertiserId===input.advertiserId);if(workspace&&!workspace.externalContactIds.includes(contactId))patchAdvertiserWorkspace(input.advertiserId,{externalContactIds:[...workspace.externalContactIds,contactId]});
  appendAudit({action:current?'advertiser.contact.update':'advertiser.contact.create',advertiserId:input.advertiserId,targetType:'contact',targetId:contactId}); return row;
}
export function deleteExternalContact(contactId:string){const rows=loadExternalContacts();const target=rows.find(x=>x.contactId===contactId);save(KEYS.contacts,rows.filter(x=>x.contactId!==contactId),'howtom:control-changed');if(target){const w=ensureAdvertiserWorkspaces().find(x=>x.advertiserId===target.advertiserId);if(w)patchAdvertiserWorkspace(target.advertiserId,{externalContactIds:w.externalContactIds.filter(x=>x!==contactId)});}}

export function loadAdvertiserFeatureAccess(){ensureControlSeed();return parse<AdvertiserFeatureAccess[]>(KEYS.featureAccess,[]);}
export function saveAdvertiserFeatureAccess(rows:AdvertiserFeatureAccess[]){save(KEYS.featureAccess,rows,'howtom:control-changed');}
export function setAdvertiserFeatureAccess(advertiserId:string,featureKey:string,enabled:boolean,limit?:number){
  const rows=loadAdvertiserFeatureAccess();const current=rows.find(x=>x.advertiserId===advertiserId&&x.featureKey===featureKey);const row:AdvertiserFeatureAccess={advertiserId,featureKey,enabled,limit,updatedAt:now()};
  saveAdvertiserFeatureAccess(current?rows.map(x=>x===current?row:x):[row,...rows]);appendAudit({action:'advertiser.feature.update',advertiserId,targetType:'feature',targetId:featureKey,metadata:{enabled,limit}});return row;
}

export function loadSharedAssets(){ensureControlSeed();return parse<SharedAssetRelation[]>(KEYS.sharedAssets,[]);}
export function shareAsset(advertiserId:string,assetId:string,label?:string){const rows=loadSharedAssets();const current=rows.find(x=>x.advertiserId===advertiserId&&x.assetId===assetId);const stamp=now();const row:SharedAssetRelation={shareId:current?.shareId||makeId('share'),advertiserId,assetId,label,audience:'advertiser',status:'shared',createdAt:current?.createdAt||stamp,updatedAt:stamp};save(KEYS.sharedAssets,current?rows.map(x=>x.shareId===current.shareId?row:x):[row,...rows],'howtom:control-changed');appendAudit({action:'asset.share',advertiserId,targetType:'asset',targetId:assetId});return row;}
export function unshareAsset(shareId:string){const rows=loadSharedAssets();const target=rows.find(x=>x.shareId===shareId);save(KEYS.sharedAssets,rows.filter(x=>x.shareId!==shareId),'howtom:control-changed');if(target)appendAudit({action:'asset.unshare',advertiserId:target.advertiserId,targetType:'asset',targetId:target.assetId});}

export function loadApprovalRequests(){ensureControlSeed();return parse<ApprovalRequest[]>(KEYS.approvals,[]);}
export function saveApprovalRequests(rows:ApprovalRequest[]){save(KEYS.approvals,rows,'howtom:control-changed');}
export function createApprovalRequest(input:Omit<ApprovalRequest,'approvalId'|'createdAt'|'updatedAt'>){const stamp=now();const row:ApprovalRequest={...input,approvalId:makeId('approval'),createdAt:stamp,updatedAt:stamp};saveApprovalRequests([row,...loadApprovalRequests()]);appendAudit({action:'approval.create',advertiserId:input.advertiserId,targetType:input.targetType,targetId:row.approvalId});return row;}
export function patchApprovalRequest(approvalId:string,patch:Partial<ApprovalRequest>){const rows=loadApprovalRequests();const current=rows.find(x=>x.approvalId===approvalId);if(!current)return null;const row={...current,...patch,updatedAt:now()};saveApprovalRequests(rows.map(x=>x.approvalId===approvalId?row:x));appendAudit({action:'approval.update',advertiserId:current.advertiserId,targetType:'approval',targetId:approvalId,metadata:{status:row.status}});return row;}

export function loadPlanDefinitions(){ensureControlSeed();return parse<SubscriptionPlanDefinition[]>(KEYS.plans,DEFAULT_PLANS);}
export function savePlanDefinitions(rows:SubscriptionPlanDefinition[]){save(KEYS.plans,rows,'howtom:control-changed');}
export function upsertPlanDefinition(input:Partial<SubscriptionPlanDefinition>&{name:string}){const rows=loadPlanDefinitions();const stamp=now();const planId=input.planId||makeId('plan');const current=rows.find(x=>x.planId===planId);const row:SubscriptionPlanDefinition={planId,name:input.name,description:input.description??current?.description,monthlyPrice:input.monthlyPrice??current?.monthlyPrice,vatIncluded:input.vatIncluded??current?.vatIncluded,status:input.status||current?.status||'draft',entitlements:input.entitlements||current?.entitlements||[],createdAt:current?.createdAt||stamp,updatedAt:stamp};savePlanDefinitions(current?rows.map(x=>x.planId===planId?row:x):[row,...rows]);appendAudit({action:current?'plan.update':'plan.create',targetType:'plan',targetId:planId});return row;}

export function loadFeatureFlags(){ensureControlSeed();return parse<FeatureFlag[]>(KEYS.flags,DEFAULT_FLAGS);}
export function saveFeatureFlags(rows:FeatureFlag[]){save(KEYS.flags,rows,'howtom:control-changed');}
export function patchFeatureFlag(featureKey:string,patch:Partial<FeatureFlag>){const rows=loadFeatureFlags();const current=rows.find(x=>x.featureKey===featureKey);if(!current)return null;const row={...current,...patch,updatedAt:now()};saveFeatureFlags(rows.map(x=>x.featureKey===featureKey?row:x));appendAudit({action:'feature-flag.update',targetType:'feature-flag',targetId:featureKey,metadata:{state:row.state}});return row;}

export function loadNotices(){ensureControlSeed();return parse<Notice[]>(KEYS.notices,[]);}
export function upsertNotice(input:Partial<Notice>&{title:string;body:string}){const rows=loadNotices();const stamp=now();const noticeId=input.noticeId||makeId('notice');const current=rows.find(x=>x.noticeId===noticeId);const row:Notice={noticeId,title:input.title,body:input.body,audience:input.audience||'internal',status:input.status||'draft',createdAt:current?.createdAt||stamp,updatedAt:stamp};save(KEYS.notices,current?rows.map(x=>x.noticeId===noticeId?row:x):[row,...rows],'howtom:control-changed');appendAudit({action:current?'notice.update':'notice.create',targetType:'notice',targetId:noticeId});return row;}

export function loadAuditEvents(){ensureControlSeed();return parse<AuditEvent[]>(KEYS.audit,[]);}
export function appendAudit(input:Omit<AuditEvent,'auditId'|'createdAt'|'result'> & {result?:AuditEvent['result']}){const row:AuditEvent={...input,auditId:makeId('audit'),result:input.result||'success',actorId:input.actorId||'system',organizationId:input.organizationId||'howtom',createdAt:now()};const rows=parse<AuditEvent[]>(KEYS.audit,[]);save(KEYS.audit,[row,...rows].slice(0,2000),'howtom:audit-changed');return row;}

export function loadSecurityPolicy(){ensureControlSeed();return parse<SecurityPolicy>(KEYS.security,DEFAULT_SECURITY);}
export function saveSecurityPolicy(policy:SecurityPolicy){save(KEYS.security,policy,'howtom:control-changed');appendAudit({action:'security.policy.update',targetType:'security-policy'});}

export function loadMenuVisibility(){return parse<Record<string,boolean>>(KEYS.menuVisibility,{});}
export function saveMenuVisibility(value:Record<string,boolean>){save(KEYS.menuVisibility,value,'howtom:control-changed');appendAudit({action:'menu.visibility.update',targetType:'menu'});}

export function loadControlUiSettings(){return parse<Record<string,unknown>>(KEYS.settings,{});}
export function saveControlUiSettings(value:Record<string,unknown>){save(KEYS.settings,value,'howtom:control-changed');}

export function exportFrontendBackup(){
  const snapshot:Record<string,string>={};
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key)snapshot[key]=localStorage.getItem(key)||'';}
  return {version:'1.0.0',createdAt:now(),storage:'browser-localStorage',snapshot};
}

export function importFrontendBackup(data:{snapshot?:Record<string,string>}){
  if(!data||typeof data!=='object'||!data.snapshot||typeof data.snapshot!=='object')throw new Error('올바른 HOWTOM 프론트엔드 백업 파일이 아닙니다.');
  // 백업 시점의 localStorage 전체 상태로 되돌리는 것이 목적이므로, 스냅샷에 없는 키는
  // 지워야 합니다. 그냥 덮어쓰기만 하면 백업 이후 새로 생긴 데이터가 복원 후에도 그대로
  // 남아 "복원"이 아니라 "병합"이 되어버립니다. 로그인 세션(인증 토큰)만은 복원 때문에
  // 로그아웃되지 않도록 예외로 남겨둡니다.
  const KEEP_ON_RESTORE = new Set(['acc_token']);
  const keysToRemove:string[]=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key&&!(key in data.snapshot)&&!KEEP_ON_RESTORE.has(key))keysToRemove.push(key);
  }
  keysToRemove.forEach(key=>localStorage.removeItem(key));
  Object.entries(data.snapshot).forEach(([key,value])=>{ if(!KEEP_ON_RESTORE.has(key))localStorage.setItem(key,String(value)); });
  appendAudit({action:'backup.restore',targetType:'frontend-storage'});window.dispatchEvent(new CustomEvent('howtom:control-changed'));
}

export { KEYS as CONTROL_STORAGE_KEYS };
