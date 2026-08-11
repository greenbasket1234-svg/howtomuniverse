import { loadAdvertiserFeatureAccess, loadFeatureFlags, loadMemberships, loadRoles } from './controlStore';
import type { FeaturePermission } from './controlTypes';

export const FEATURE_CATALOG: FeaturePermission[] = [
  {featureKey:'dashboard.view',label:'대시보드 열람',group:'홈',actions:['view'],advertiserVisible:true},
  {featureKey:'ads.view',label:'광고 데이터 열람',group:'운영센터',actions:['view'],advertiserVisible:true},
  {featureKey:'campaign.view',label:'캠페인 열람',group:'운영센터',actions:['view'],advertiserVisible:false},
  {featureKey:'campaign.edit',label:'캠페인 편집',group:'운영센터',actions:['edit'],advertiserVisible:false},
  {featureKey:'reports.view',label:'월간 보고서 열람',group:'보고서',actions:['view'],advertiserVisible:true},
  {featureKey:'reports.proposal',label:'다음달 제안서 열람',group:'보고서',actions:['view'],advertiserVisible:true},
  {featureKey:'reports.generate',label:'보고서 생성',group:'보고서',actions:['create'],advertiserVisible:false},
  {featureKey:'reports.approve',label:'보고서 승인',group:'보고서',actions:['approve'],advertiserVisible:true},
  {featureKey:'insights.view',label:'인사이트 열람',group:'인사이트',actions:['view'],advertiserVisible:true},
  {featureKey:'insights.ai.use',label:'AI 추천 사용',group:'인사이트',actions:['view','create'],advertiserVisible:true},
  {featureKey:'content.create',label:'콘텐츠 제작',group:'콘텐츠',actions:['create','edit'],advertiserVisible:false},
  {featureKey:'content.approve',label:'콘텐츠 승인',group:'콘텐츠',actions:['approve'],advertiserVisible:true},
  {featureKey:'content.blog',label:'블로그 작성',group:'콘텐츠',actions:['create','edit'],advertiserVisible:true},
  {featureKey:'assets.view',label:'공유 자료 열람',group:'자산관리',actions:['view'],advertiserVisible:true},
  {featureKey:'assets.upload',label:'자산 업로드',group:'자산관리',actions:['create'],advertiserVisible:false},
  {featureKey:'automation.view',label:'자동화 현황 열람',group:'AI 자동화',actions:['view'],advertiserVisible:false},
  {featureKey:'automation.manage',label:'자동화 관리',group:'AI 자동화',actions:['manage'],advertiserVisible:false},
  {featureKey:'advertisers.view',label:'광고주 열람',group:'광고주',actions:['view'],advertiserVisible:false},
  {featureKey:'advertisers.manage',label:'광고주 관리',group:'광고주',actions:['manage'],advertiserVisible:false},
  {featureKey:'settings.manage',label:'설정 관리',group:'설정',actions:['manage'],advertiserVisible:false},
  {featureKey:'admin.users.manage',label:'사용자 관리',group:'관리자',actions:['manage'],advertiserVisible:false},
  {featureKey:'admin.roles.manage',label:'권한 관리',group:'관리자',actions:['manage'],advertiserVisible:false},
  {featureKey:'admin.plans.manage',label:'구독 상품 관리',group:'관리자',actions:['manage'],advertiserVisible:false},
  {featureKey:'admin.system.manage',label:'시스템 관리',group:'관리자',actions:['manage'],advertiserVisible:false},
];

export type AccessDecision = {
  allowed: boolean;
  reasons: string[];
  matchedRoles: string[];
};

export function canAccess(input:{userId:string;featureKey:string;advertiserId?:string}):AccessDecision {
  const memberships=loadMemberships().filter(m=>m.userId===input.userId);
  if(!memberships.length)return {allowed:false,reasons:['조직 소속 정보가 없습니다.'],matchedRoles:[]};
  const roles=loadRoles();
  const roleRows=roles.filter(role=>memberships.some(m=>m.roleIds.includes(role.roleId)));
  const matchedRoles=roleRows.filter(r=>r.permissionKeys.includes(input.featureKey)).map(r=>r.name);
  if(!matchedRoles.length)return {allowed:false,reasons:['역할 권한에서 허용되지 않은 기능입니다.'],matchedRoles:[]};

  if(input.advertiserId){
    const advertiserId=input.advertiserId;
    const scoped=memberships.filter(m=>m.advertiserIds&&m.advertiserIds.length);
    if(scoped.length&&!scoped.some(m=>m.advertiserIds?.includes(advertiserId))){
      return {allowed:false,reasons:['담당 광고주 접근 범위에 포함되지 않습니다.'],matchedRoles};
    }
    const explicit=loadAdvertiserFeatureAccess().find(x=>x.advertiserId===advertiserId&&x.featureKey===input.featureKey);
    if(explicit?.enabled===false)return {allowed:false,reasons:['광고주 기능 권한에서 사용 중지된 기능입니다.'],matchedRoles};
  }

  const flag=loadFeatureFlags().find(f=>f.featureKey===input.featureKey||f.featureKey===featureFlagAlias(input.featureKey));
  if(flag){
    if(flag.state==='disabled')return {allowed:false,reasons:['기능 공개 설정에서 비활성화되어 있습니다.'],matchedRoles};
    if(flag.state==='internal'){
      // 내부 전용 공개 단계입니다. 광고주 역할만 가진 사용자는 아직 접근할 수 없습니다.
      const hasInternalRole=roleRows.some(r=>r.scope==='internal');
      if(!hasInternalRole)return {allowed:false,reasons:['현재 내부 전용으로 공개된 기능입니다.'],matchedRoles};
    }
    if(flag.state==='beta'){
      // 베타 공개 단계입니다. 허용 목록이 설정되어 있으면 그 목록에 포함된 사용자·광고주만
      // 통과시킵니다. 두 목록이 모두 비어 있으면(아직 베타 대상을 안 정한 경우) 막지 않습니다.
      const hasAllowList=(flag.allowedUserIds?.length??0)>0||(flag.allowedAdvertiserIds?.length??0)>0;
      if(hasAllowList){
        const userAllowed=flag.allowedUserIds?.includes(input.userId)??false;
        const advertiserAllowed=input.advertiserId?(flag.allowedAdvertiserIds?.includes(input.advertiserId)??false):false;
        if(!userAllowed&&!advertiserAllowed)return {allowed:false,reasons:['현재 베타 허용 대상에 포함되지 않았습니다.'],matchedRoles};
      }
    }
  }
  return {allowed:true,reasons:['역할·광고주 범위·기능 공개 설정을 통과했습니다.'],matchedRoles};
}

function featureFlagAlias(featureKey:string){
  if(featureKey==='insights.ai.use')return 'insights.ai';
  if(featureKey==='content.blog')return 'content.blog';
  return featureKey;
}

export function advertiserVisibleFeatures(){return FEATURE_CATALOG.filter(x=>x.advertiserVisible);}
