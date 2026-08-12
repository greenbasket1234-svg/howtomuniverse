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
  createDraft(projectId:string,integration:BlogIntegration,payload:BlogDraftPayload,credentials?:BlogApiCredentials):Promise<{externalId?:string;url?:string;message:string}>;
  getStatus(externalId:string,integration:BlogIntegration):Promise<{status:PublishStatus;url?:string}>;
}

// 발행에 필요한 실제 글 내용입니다(제목·HTML 본문). 저장소가 아니라 발행 호출 시점에만 넘깁니다.
export type BlogDraftPayload = { title:string; contentHtml:string; status?:'draft'|'publish' };

// WordPress 등 API 모드에 필요한 인증 정보입니다. 절대 localStorage/상태 저장소에 담지 않고,
// "외부 업체로 보내기"를 누른 그 순간에만 입력받아 fetch 호출 한 번에 쓰고 버립니다.
export type BlogApiCredentials = { username:string; appPassword:string };

export const frontendBlogProviderAdapter:BlogProviderAdapter={
  async testConnection(integration){
    if(integration.mode==='manual')return {ok:true,message:'수동 내보내기 모드가 준비되었습니다.'};
    if(integration.mode==='external-link'&&integration.externalSiteUrl)return {ok:true,message:'외부 사이트 주소가 등록되었습니다.'};
    if(integration.mode==='sso'&&integration.externalSiteUrl)return {ok:true,message:'SSO/외부 이동 대상 주소가 등록되었습니다. 실제 인증은 서버 단계에서 연결합니다.'};
    if(integration.mode==='api'&&integration.apiBaseUrl)return {ok:true,message:'API 기본 주소가 등록되었습니다. "외부 업체로 보내기"를 누르면 그 자리에서 계정 정보를 입력해 바로 전송합니다.'};
    return {ok:false,message:'선택한 연동 방식에 필요한 주소를 입력하세요.'};
  },
  async createDraft(_projectId,integration,payload,credentials){
    if(integration.mode==='manual')return {message:'HTML/텍스트 내보내기를 사용하세요.'};
    if(integration.mode==='external-link'||integration.mode==='sso')return {message:'외부 업체 사이트에서 계속 작성할 수 있습니다.'};
    if(integration.mode==='api')return wordpressCreateDraft(integration,payload,credentials);
    return {message:'선택한 연동 방식을 확인해 주세요.'};
  },
  async getStatus(){return {status:'pending'};},
};

// WordPress REST API(/wp-json/wp/v2/posts)로 실제 글을 전송합니다. WordPress 사이트가
// Application Password 인증을 켜두고 브라우저 CORS를 허용해야 성공합니다(사이트 관리자
// 설정 필요 — 워드프레스 5.6+ 기본 내장 기능). 다른 업체(티스토리·네이버 블로그 등)는
// 브라우저 직접 호출을 막아두는 경우가 많아, 그런 업체는 API 모드 대신 SSO/외부 이동
// 모드를 쓰는 걸 권장합니다.
async function wordpressCreateDraft(integration:BlogIntegration,payload:BlogDraftPayload,credentials?:BlogApiCredentials):Promise<{externalId?:string;url?:string;message:string}>{
  if(!integration.apiBaseUrl)return {message:'API 기본 URL이 설정되어 있지 않습니다. 연동 설정에서 먼저 입력하세요.'};
  if(!credentials?.username||!credentials?.appPassword)return {message:'사용자명과 Application Password를 입력해야 전송할 수 있습니다.'};
  const endpoint=`${integration.apiBaseUrl.replace(/\/+$/,'')}/wp-json/wp/v2/posts`;
  try{
    const res=await fetch(endpoint,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        // Application Password는 WordPress가 공식 지원하는 Basic 인증 방식입니다.
        // 이 헤더는 이 fetch 요청 한 번에만 쓰이고, 함수가 끝나면 메모리에서도 사라집니다.
        Authorization:`Basic ${btoa(`${credentials.username}:${credentials.appPassword}`)}`,
      },
      body:JSON.stringify({title:payload.title,content:payload.contentHtml,status:payload.status||'draft'}),
    });
    if(!res.ok){
      const detail=await res.json().catch(()=>null);
      return {message:`전송 실패 (${res.status}) ${detail?.message||'API 응답을 확인하세요. 사이트의 CORS·Application Password 설정이 필요할 수 있습니다.'}`};
    }
    const data=await res.json();
    return {externalId:String(data.id),url:data.link,message:payload.status==='publish'?'워드프레스에 발행되었습니다.':'워드프레스에 초안으로 저장되었습니다.'};
  }catch{
    return {message:'네트워크 오류로 전송하지 못했습니다. 사이트 URL과 CORS 허용 여부를 확인하세요.'};
  }
}
