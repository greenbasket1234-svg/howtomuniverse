export type SubscriptionFeature = 'blog' | 'video-script' | 'document' | 'ad-creation' | 'ai-generation';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'paused' | 'cancelled';

export type FeatureEntitlements = {
  blogEnabled: boolean;
  blogPostsPerMonth?: number;
  videoScriptsPerMonth?: number;
  documentsPerMonth?: number;
  adCreationsPerMonth?: number;
  aiCreditsPerMonth?: number;
  blogIntegrations?: number;
};

export type AdvertiserSubscription = {
  subscriptionId: string;
  advertiserId: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  startedAt: string;
  renewsAt?: string;
  entitlements: FeatureEntitlements;
  note?: string;
};

export type UsageAction = 'create' | 'complete' | 'generate' | 'publish' | 'export';
export type UsageEvent = {
  usageId: string;
  advertiserId: string;
  subscriptionId?: string;
  feature: SubscriptionFeature;
  action: UsageAction;
  quantity: number;
  sourceId?: string;
  provider?: string;
  providerCost?: number;
  aiCost?: number;
  createdAt: string;
};

const SUB_KEY = 'howtom-advertiser-subscriptions-v1';
const USAGE_KEY = 'howtom-subscription-usage-v1';
const now = () => new Date().toISOString();
const id = (prefix:string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

function parse<T>(key:string, fallback:T):T {
  try { const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function emit(name:string, detail:unknown){window.dispatchEvent(new CustomEvent(name,{detail}));}

export const DEFAULT_CONTENT_PLAN: Omit<AdvertiserSubscription,'subscriptionId'|'advertiserId'|'startedAt'> = {
  planId:'internal-unconfigured',
  planName:'미설정',
  status:'active',
  entitlements:{
    blogEnabled:true,
    blogPostsPerMonth:undefined,
    videoScriptsPerMonth:undefined,
    documentsPerMonth:undefined,
    adCreationsPerMonth:undefined,
    aiCreditsPerMonth:undefined,
    blogIntegrations:undefined,
  },
  note:'구독 상품이 아직 지정되지 않았습니다.',
};

// 관리자가 "구독 상품 관리"에서 설계하는 SubscriptionPlanDefinition(PlanEntitlement[])을
// 실제 콘텐츠 사용량 제한 체계인 FeatureEntitlements로 변환합니다. 지금까지는 관리자가
// 상품을 아무리 설계해도 광고주별 실제 한도(AdvertiserSubscription.entitlements)에는
// 전혀 반영되지 않는, 서로 연결되지 않은 두 개의 구독 체계였습니다. 이 함수가 그 다리
// 역할을 합니다. PlanEntitlement에 대응 필드가 없는 항목(대시보드·보고서 열람 등)은
// canAccess()·AdvertiserFeatureAccess가 별도로 담당하므로 여기서는 건너뜁니다.
export function deriveEntitlementsFromPlan(plan: { entitlements: { featureKey: string; enabled: boolean; limit?: number }[] }): FeatureEntitlements {
  const find = (key: string) => plan.entitlements.find(e => e.featureKey === key);
  const blog = find('content.blog');
  const videoScript = find('content.video-script');
  const document = find('content.document');
  const adCreation = find('content.ad-creation');
  const aiContent = find('ai.content');
  const blogIntegration = find('content.blog-integration');
  return {
    blogEnabled: blog ? blog.enabled : DEFAULT_CONTENT_PLAN.entitlements.blogEnabled,
    blogPostsPerMonth: blog?.limit,
    videoScriptsPerMonth: videoScript?.limit,
    documentsPerMonth: document?.limit,
    adCreationsPerMonth: adCreation?.limit,
    aiCreditsPerMonth: aiContent?.limit,
    blogIntegrations: blogIntegration?.limit,
  };
}

// 광고주에게 관리자가 설계한 구독 상품을 실제로 적용합니다. planId·planName과 함께
// entitlements 전체를 그 상품 기준으로 교체합니다(부분 patch가 아니라 완전 교체 - 상품을
// 바꾸면 이전 상품의 한도가 남아있으면 안 되므로).
export function applyPlanToAdvertiser(advertiserId: string, plan: { planId: string; name: string; entitlements: { featureKey: string; enabled: boolean; limit?: number }[] }) {
  const current = ensureSubscription(advertiserId);
  const next: AdvertiserSubscription = { ...current, planId: plan.planId, planName: plan.name, entitlements: deriveEntitlementsFromPlan(plan) };
  saveSubscriptions(loadSubscriptions().map(x => x.advertiserId === advertiserId ? next : x));
  return next;
}

export function loadSubscriptions(){const rows=parse<AdvertiserSubscription[]>(SUB_KEY,[]);return Array.isArray(rows)?rows:[];}
export function saveSubscriptions(rows:AdvertiserSubscription[]){localStorage.setItem(SUB_KEY,JSON.stringify(rows));emit('howtom:subscriptions-changed',rows);}
export function getSubscription(advertiserId:string){return loadSubscriptions().find(x=>x.advertiserId===advertiserId);}
export function ensureSubscription(advertiserId:string){
  const existing=getSubscription(advertiserId); if(existing)return existing;
  const stamp=now(); const d=new Date(); d.setMonth(d.getMonth()+1);
  const row:AdvertiserSubscription={...DEFAULT_CONTENT_PLAN,subscriptionId:id('sub'),advertiserId,startedAt:stamp,renewsAt:d.toISOString(),entitlements:{...DEFAULT_CONTENT_PLAN.entitlements}};
  saveSubscriptions([row,...loadSubscriptions()]); return row;
}
export function patchSubscription(advertiserId:string, patch:Partial<AdvertiserSubscription>){
  const current=ensureSubscription(advertiserId); const next={...current,...patch,entitlements:{...current.entitlements,...(patch.entitlements||{})}};
  saveSubscriptions(loadSubscriptions().map(x=>x.advertiserId===advertiserId?next:x)); return next;
}

export function loadUsageEvents(){const rows=parse<UsageEvent[]>(USAGE_KEY,[]);return Array.isArray(rows)?rows:[];}
export function saveUsageEvents(rows:UsageEvent[]){localStorage.setItem(USAGE_KEY,JSON.stringify(rows));emit('howtom:usage-changed',rows);}
export function recordUsage(input:Omit<UsageEvent,'usageId'|'createdAt'>){const row:UsageEvent={...input,usageId:id('use'),createdAt:now()};saveUsageEvents([row,...loadUsageEvents()]);return row;}
export function recordUsageOnce(input:Omit<UsageEvent,'usageId'|'createdAt'>){
  if(input.sourceId){const exists=loadUsageEvents().some(x=>x.sourceId===input.sourceId&&x.feature===input.feature&&x.action===input.action);if(exists)return exists;}
  return recordUsage(input);
}
function monthKey(value:string){const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
export function getMonthlyUsage(advertiserId:string, feature:SubscriptionFeature, date=new Date()){
  const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  return loadUsageEvents().filter(x=>x.advertiserId===advertiserId&&x.feature===feature&&monthKey(x.createdAt)===key).reduce((n,x)=>n+(Number(x.quantity)||0),0);
}
export function getFeatureLimit(sub:AdvertiserSubscription, feature:SubscriptionFeature){
  const e=sub.entitlements;
  if(feature==='blog')return e.blogEnabled===false?0:e.blogPostsPerMonth;
  if(feature==='video-script')return e.videoScriptsPerMonth;
  if(feature==='document')return e.documentsPerMonth;
  if(feature==='ad-creation')return e.adCreationsPerMonth;
  if(feature==='ai-generation')return e.aiCreditsPerMonth;
  return undefined;
}
export function canUseFeature(advertiserId:string, feature:SubscriptionFeature){
  const subscription=ensureSubscription(advertiserId); const limit=getFeatureLimit(subscription,feature); const used=getMonthlyUsage(advertiserId,feature);
  const statusOk=['trial','active'].includes(subscription.status);
  const enabled=feature!=='blog'||subscription.entitlements.blogEnabled!==false;
  const allowed=statusOk&&enabled&&(limit===undefined||used<limit);
  return {allowed,subscription,limit,used,remaining:limit===undefined?undefined:Math.max(0,limit-used),reason:!statusOk?'구독 상태 확인 필요':!enabled?'기능 사용 안 함':limit!==undefined&&used>=limit?'이번 달 사용 한도 초과':''};
}
