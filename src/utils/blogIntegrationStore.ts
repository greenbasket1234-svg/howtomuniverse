export type BlogIntegrationMode = 'api' | 'sso' | 'external-link' | 'manual';
export type BlogConnectionStatus = 'not_connected' | 'connected' | 'error';
export type BlogIntegration = {
  integrationId: string;
  advertiserId: string;
  provider: string;
  displayName: string;
  connectionStatus: BlogConnectionStatus;
  mode: BlogIntegrationMode;
  externalSiteUrl?: string;
  apiBaseUrl?: string;
  accountLabel?: string;
  lastSyncAt?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type PublishStatus = 'draft'|'sent'|'pending'|'published'|'failed';
export type ExternalPublishRecord = {
  publishId: string;
  projectId: string;
  advertiserId: string;
  integrationId?: string;
  externalId?: string;
  status: PublishStatus;
  publishedUrl?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
};

const KEY='howtom-blog-integrations-v1';
const PUB_KEY='howtom-blog-publish-records-v1';
const now=()=>new Date().toISOString();
const id=(p:string)=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
function parse<T>(key:string,fallback:T):T{try{const x=localStorage.getItem(key);return x?JSON.parse(x) as T:fallback}catch{return fallback}}
export function loadBlogIntegrations(){const rows=parse<BlogIntegration[]>(KEY,[]);return Array.isArray(rows)?rows:[];}
export function saveBlogIntegrations(rows:BlogIntegration[]){localStorage.setItem(KEY,JSON.stringify(rows));window.dispatchEvent(new CustomEvent('howtom:blog-integrations-changed',{detail:rows}));}
export function upsertBlogIntegration(input:Omit<BlogIntegration,'integrationId'|'createdAt'|'updatedAt'> & {integrationId?:string}){
  const rows=loadBlogIntegrations(),current=input.integrationId?rows.find(x=>x.integrationId===input.integrationId):undefined,stamp=now();
  const row:BlogIntegration={...input,integrationId:current?.integrationId||id('blog-int'),createdAt:current?.createdAt||stamp,updatedAt:stamp};
  saveBlogIntegrations(current?rows.map(x=>x.integrationId===row.integrationId?row:x):[row,...rows]);return row;
}
export function getAdvertiserBlogIntegration(advertiserId:string){return loadBlogIntegrations().find(x=>x.advertiserId===advertiserId);}
export function deleteBlogIntegration(integrationId:string){saveBlogIntegrations(loadBlogIntegrations().filter(x=>x.integrationId!==integrationId));}

export function loadPublishRecords(){const rows=parse<ExternalPublishRecord[]>(PUB_KEY,[]);return Array.isArray(rows)?rows:[];}
export function savePublishRecords(rows:ExternalPublishRecord[]){localStorage.setItem(PUB_KEY,JSON.stringify(rows));window.dispatchEvent(new CustomEvent('howtom:blog-publish-changed',{detail:rows}));}
export function upsertPublishRecord(input:Omit<ExternalPublishRecord,'publishId'|'createdAt'|'updatedAt'> & {publishId?:string}){
  const rows=loadPublishRecords(),current=input.publishId?rows.find(x=>x.publishId===input.publishId):undefined,stamp=now();
  const row:ExternalPublishRecord={...input,publishId:current?.publishId||id('publish'),createdAt:current?.createdAt||stamp,updatedAt:stamp};
  savePublishRecords(current?rows.map(x=>x.publishId===row.publishId?row:x):[row,...rows]);return row;
}

/**
 * 실제 외부 업체 API는 업체 명세/인증 방식이 확정된 뒤 서버에서 구현합니다.
 * 이 어댑터는 프론트 단계에서 API·SSO·외부링크·수동 내보내기 모드를 동일 UI로 다루기 위한 계약입니다.
 */
export interface BlogProviderAdapter {
  testConnection(integration:BlogIntegration):Promise<{ok:boolean;message:string}>;
  createDraft(projectId:string,integration:BlogIntegration):Promise<{externalId?:string;message:string}>;
  getStatus(externalId:string,integration:BlogIntegration):Promise<{status:PublishStatus;url?:string}>;
}

export const frontendBlogProviderAdapter:BlogProviderAdapter={
  async testConnection(integration){
    if(integration.mode==='manual')return {ok:true,message:'수동 내보내기 모드가 준비되었습니다.'};
    if(integration.mode==='external-link'&&integration.externalSiteUrl)return {ok:true,message:'외부 사이트 주소가 등록되었습니다.'};
    if(integration.mode==='sso'&&integration.externalSiteUrl)return {ok:true,message:'SSO/외부 이동 대상 주소가 등록되었습니다. 실제 인증은 서버 단계에서 연결합니다.'};
    if(integration.mode==='api'&&integration.apiBaseUrl)return {ok:true,message:'API 기본 주소가 등록되었습니다. Secret/API 호출은 서버 단계에서 연결합니다.'};
    return {ok:false,message:'선택한 연동 방식에 필요한 주소를 입력하세요.'};
  },
  async createDraft(_projectId,integration){
    if(integration.mode==='manual')return {message:'HTML/텍스트 내보내기를 사용하세요.'};
    if(integration.mode==='external-link'||integration.mode==='sso')return {message:'외부 업체 사이트에서 계속 작성할 수 있습니다.'};
    return {message:'API 초안 생성은 업체 명세와 서버 인증 연결 후 활성화됩니다.'};
  },
  async getStatus(){return {status:'pending'};},
};
