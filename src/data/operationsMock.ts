import type { Campaign, FunnelMetricDefinition, FunnelMetricKey, FunnelRow, MetricView, ScheduleSlot, SeasonEvent } from '../types/operations';

export const ADVERTISERS = [
  { id: 'dabang-isa', name: '다방이사', preset: 'lead' },
  { id: 'wando-seafood', name: '완도전복몰', preset: 'commerce' },
  { id: 'welcome-bbq', name: '웰컴투바베큐', preset: 'mixed' },
];

export const MOCK_CAMPAIGNS: Campaign[] = [
  { id:'c1', advertiserId:'dabang-isa', platform:'meta', name:'7월 이사상담 리드 캠페인', accountName:'다방이사 Meta', budget:120000, budgetType:'daily', startAt:'2026-07-01T09:00', endAt:'2026-07-31T23:00', status:'on', lastSyncedAt:'2026-07-05 06:42', capability:{upload:true,toggle:true,schedule:true} },
  { id:'c2', advertiserId:'dabang-isa', platform:'naver', name:'사무실이사 검색광고', accountName:'다방이사 검색광고', budget:85000, budgetType:'daily', startAt:'2026-07-01T00:00', status:'scheduled', schedule:{onAt:'2026-07-06T08:00',offAt:'2026-07-31T22:00',repeat:'평일 08:00~22:00'}, lastSyncedAt:'2026-07-05 06:44', capability:{upload:true,toggle:true,schedule:true} },
  { id:'c3', advertiserId:'wando-seafood', platform:'google', name:'전복미역국 구매 전환', accountName:'완도전복 Google', budget:150000, budgetType:'daily', startAt:'2026-07-01T00:00', status:'on', lastSyncedAt:'2026-07-05 06:47', capability:{upload:true,toggle:true,schedule:true} },
  { id:'c4', advertiserId:'wando-seafood', platform:'youtube', name:'초복 전복 영상 캠페인', accountName:'완도전복 Google', budget:3000000, budgetType:'total', startAt:'2026-07-05T09:00', endAt:'2026-07-15T23:59', status:'review', lastSyncedAt:'2026-07-05 06:47', capability:{upload:false,toggle:true,schedule:true} },
  { id:'c5', advertiserId:'welcome-bbq', platform:'karrot', name:'수완지구 바베큐 지역광고', accountName:'웰컴투바베큐 당근', budget:50000, budgetType:'daily', startAt:'2026-07-01T09:00', status:'unsupported', capability:{upload:false,toggle:false,schedule:false} },
  { id:'c6', advertiserId:'wando-seafood', platform:'instagram', name:'전복미역국 릴스 캠페인', accountName:'완도전복 Meta', budget:70000, budgetType:'daily', startAt:'2026-07-03T09:00', status:'off', lastSyncedAt:'2026-07-05 06:42', capability:{upload:true,toggle:true,schedule:true} },
  { id:'c7', advertiserId:'welcome-bbq', platform:'blog', name:'광주 바베큐 체험단 콘텐츠', accountName:'네이버 블로그', budget:0, budgetType:'total', startAt:'2026-07-07T10:00', status:'scheduled', schedule:{onAt:'2026-07-07T10:00'}, capability:{upload:true,toggle:true,schedule:true} },
];

export const FUNNEL_METRICS: FunnelMetricDefinition[] = [
  {key:'spend',label:'광고비',group:'cost',format:'currency'}, {key:'impressions',label:'노출',group:'traffic',format:'number'},
  {key:'reach',label:'도달',group:'traffic',format:'number'}, {key:'clicks',label:'클릭',group:'traffic',format:'number'},
  {key:'ctr',label:'CTR',group:'traffic',format:'percent'}, {key:'cpc',label:'CPC',group:'cost',format:'currency'}, {key:'cpm',label:'CPM',group:'cost',format:'currency'},
  {key:'leads',label:'DB',group:'lead',format:'number'}, {key:'validLeads',label:'유효 DB',group:'lead',format:'number'}, {key:'contracts',label:'계약',group:'lead',format:'number'},
  {key:'clickToLeadRate',label:'클릭→DB',group:'lead',format:'percent'}, {key:'validLeadRate',label:'유효 DB율',group:'lead',format:'percent'},
  {key:'leadToContractRate',label:'DB→계약',group:'lead',format:'percent'}, {key:'validLeadToContractRate',label:'유효 DB→계약',group:'lead',format:'percent'},
  {key:'costPerLead',label:'DB당 비용',group:'cost',format:'currency'}, {key:'costPerValidLead',label:'유효 DB당 비용',group:'cost',format:'currency'}, {key:'costPerContract',label:'계약당 비용',group:'cost',format:'currency'},
  {key:'signUps',label:'회원가입',group:'commerce',format:'number'}, {key:'itemViews',label:'상품 조회',group:'commerce',format:'number'}, {key:'addToCarts',label:'장바구니 담기',group:'commerce',format:'number'},
  {key:'checkoutStarts',label:'결제 시작',group:'commerce',format:'number'}, {key:'purchases',label:'구매 건수',group:'commerce',format:'number'}, {key:'purchaseValue',label:'구매 전환값',group:'revenue',format:'currency'},
  {key:'signUpRate',label:'회원가입 전환율',group:'commerce',format:'percent'}, {key:'addToCartRate',label:'장바구니 전환율',group:'commerce',format:'percent'}, {key:'checkoutRate',label:'결제 진입률',group:'commerce',format:'percent'},
  {key:'purchaseConversionRate',label:'구매 전환율',group:'commerce',format:'percent'}, {key:'costPerPurchase',label:'구매당 비용',group:'cost',format:'currency'}, {key:'averageOrderValue',label:'평균 구매금액',group:'revenue',format:'currency'}, {key:'roas',label:'ROAS',group:'revenue',format:'percent'},
];

function computed(base: {spend:number; impressions:number; reach:number; clicks:number; leads:number; validLeads:number; contracts:number; signUps:number; itemViews:number; addToCarts:number; checkoutStarts:number; purchases:number; purchaseValue:number}) {
  const p = (n:number,d:number)=>d ? n/d*100 : 0;
  return { ...base, ctr:p(base.clicks,base.impressions), cpc:base.spend/base.clicks, cpm:base.spend/base.impressions*1000,
    clickToLeadRate:p(base.leads,base.clicks), validLeadRate:p(base.validLeads,base.leads), leadToContractRate:p(base.contracts,base.leads), validLeadToContractRate:p(base.contracts,base.validLeads),
    costPerLead:base.spend/base.leads, costPerValidLead:base.spend/base.validLeads, costPerContract:base.spend/base.contracts,
    signUpRate:p(base.signUps,base.clicks), addToCartRate:p(base.addToCarts,base.clicks), checkoutRate:p(base.checkoutStarts,base.addToCarts), purchaseConversionRate:p(base.purchases,base.clicks),
    costPerPurchase:base.spend/base.purchases, averageOrderValue:base.purchaseValue/base.purchases, roas:p(base.purchaseValue,base.spend) };
}

export const MOCK_FUNNEL_ROWS: FunnelRow[] = [
  {platform:'meta',status:'connected',values:computed({spend:2900000,impressions:210000,reach:142000,clicks:4200,leads:320,validLeads:190,contracts:62,signUps:170,itemViews:3800,addToCarts:280,checkoutStarts:140,purchases:92,purchaseValue:8740000})},
  {platform:'naver',status:'connected',values:computed({spend:2100000,impressions:72000,reach:65000,clicks:2100,leads:280,validLeads:230,contracts:95,signUps:105,itemViews:1800,addToCarts:190,checkoutStarts:112,purchases:81,purchaseValue:9120000})},
  {platform:'google',status:'connected',values:computed({spend:1900000,impressions:95000,reach:70000,clicks:1850,leads:210,validLeads:170,contracts:68,signUps:83,itemViews:1540,addToCarts:154,checkoutStarts:91,purchases:65,purchaseValue:6680000})},
  {platform:'karrot',status:'pending',values:{spend:940000,impressions:58000,clicks:1400,leads:120,validLeads:84,contracts:21,clickToLeadRate:8.57,validLeadRate:70,leadToContractRate:17.5,costPerLead:7833}},
  {platform:'kakao',status:'connected',values:computed({spend:760000,impressions:63000,reach:42000,clicks:980,leads:88,validLeads:52,contracts:18,signUps:44,itemViews:760,addToCarts:71,checkoutStarts:39,purchases:22,purchaseValue:2240000})},
];

export const METRIC_VIEWS: MetricView[] = [
  {id:'lead',advertiserId:'dabang-isa',name:'상담 성과',isDefault:true,selectedMetrics:['spend','clicks','leads','validLeads','contracts','clickToLeadRate','validLeadRate','leadToContractRate','costPerLead','costPerValidLead','costPerContract']},
  {id:'commerce',advertiserId:'wando-seafood',name:'구매 성과',isDefault:true,selectedMetrics:['spend','clicks','signUps','addToCarts','checkoutStarts','purchases','purchaseValue','purchaseConversionRate','costPerPurchase','averageOrderValue','roas']},
  {id:'mixed',advertiserId:'welcome-bbq',name:'혼합 성과',isDefault:true,selectedMetrics:['spend','clicks','leads','validLeads','contracts','signUps','addToCarts','purchases','purchaseValue','costPerLead','costPerPurchase','roas']},
  {id:'all',advertiserId:'all',name:'전체 지표',selectedMetrics:FUNNEL_METRICS.map(m=>m.key)},
];

export const MOCK_SLOTS: ScheduleSlot[] = [
  {id:'s1',advertiserId:'wando-seafood',title:'초복 전복 소재 최종 검수',type:'creative',platform:'meta',startAt:'2026-07-07T10:00',endAt:'2026-07-07T12:00',owner:'이과장',status:'approval'},
  {id:'s2',advertiserId:'wando-seafood',title:'초복 캠페인 ON',type:'campaign',platform:'meta',startAt:'2026-07-08T09:00',endAt:'2026-07-15T23:00',owner:'큐PD',status:'confirmed'},
  {id:'s3',advertiserId:'dabang-isa',title:'주간 성과 보고',type:'report',startAt:'2026-07-10T08:00',endAt:'2026-07-10T09:00',owner:'큐PD',status:'planned'},
  {id:'s4',advertiserId:'welcome-bbq',title:'비오는 날 소재 교체',type:'promotion',platform:'instagram',startAt:'2026-07-11T15:00',endAt:'2026-07-11T17:00',owner:'디자인팀',status:'conflict',note:'광고주 승인 일정과 충돌'},
  {id:'s5',advertiserId:'dabang-isa',title:'네이버 캠페인 평일 ON',type:'campaign',platform:'naver',startAt:'2026-07-06T08:00',endAt:'2026-07-31T22:00',owner:'자동화',status:'in_progress'},
];

export const MOCK_SEASON_EVENTS: SeasonEvent[] = [
  {id:'e1',date:'2026-07-07',title:'장마권 강수 확률 80%',type:'weather',region:'광주',severity:'warning',recommendation:'실내 바베큐·보관이사 소재 노출을 강화하세요.'},
  {id:'e2',date:'2026-07-15',title:'초복',type:'season',severity:'critical',recommendation:'전복·삼계탕 캠페인을 14일 전부터 시작하세요.'},
  {id:'e3',date:'2026-07-25',title:'중복',type:'season',severity:'warning',recommendation:'초복 고성과 소재를 재활용하고 예산 증액을 검토하세요.'},
  {id:'e4',date:'2026-07-12',title:'지역 여름 축제',type:'holiday',region:'광주',severity:'info',recommendation:'지역 타겟 캠페인과 방문 유도 소재를 준비하세요.'},
  {id:'e5',date:'2026-07-09',title:'전복 특가 랜딩 오픈',type:'brand',severity:'info',recommendation:'캠페인 시작 전 랜딩·결제 이벤트 수집을 점검하세요.'},
];
