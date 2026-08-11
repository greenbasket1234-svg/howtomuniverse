import type { Campaign, FunnelMetricDefinition, FunnelMetricKey, FunnelRow, MetricView, ScheduleSlot, SeasonEvent } from '../types/operations';

export const ADVERTISERS = [
  { id: 'dabang-isa', name: '다방이사', preset: 'lead' },
  { id: 'wando-seafood', name: '완도전복몰', preset: 'commerce' },
  { id: 'welcome-bbq', name: '웰컴투바베큐', preset: 'mixed' },
];

// 매체 연동 전에는 실제로 진행 중인 캠페인이 없으므로 빈 배열로 시작합니다.
// 실제 광고 API(Meta/네이버/구글 등)가 연결되면 여기 대신 실제 캠페인 목록이 채워집니다.
export const MOCK_CAMPAIGNS: Campaign[] = [];

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

// 매체 연동 전에는 실제 성과 데이터가 없으므로 빈 배열로 시작합니다.
// 실제 광고 API가 연결되어 일일 데이터가 DB에 쌓이면 여기 대신 실제 값이 채워집니다.
export const MOCK_FUNNEL_ROWS: FunnelRow[] = [];

export const METRIC_VIEWS: MetricView[] = [
  {id:'lead',advertiserId:'dabang-isa',name:'상담 성과',isDefault:true,selectedMetrics:['spend','clicks','leads','validLeads','contracts','clickToLeadRate','validLeadRate','leadToContractRate','costPerLead','costPerValidLead','costPerContract']},
  {id:'commerce',advertiserId:'wando-seafood',name:'구매 성과',isDefault:true,selectedMetrics:['spend','clicks','signUps','addToCarts','checkoutStarts','purchases','purchaseValue','purchaseConversionRate','costPerPurchase','averageOrderValue','roas']},
  {id:'mixed',advertiserId:'welcome-bbq',name:'혼합 성과',isDefault:true,selectedMetrics:['spend','clicks','leads','validLeads','contracts','signUps','addToCarts','purchases','purchaseValue','costPerLead','costPerPurchase','roas']},
  {id:'all',advertiserId:'all',name:'전체 지표',selectedMetrics:FUNNEL_METRICS.map(m=>m.key)},
];

// 매체 연동 전에는 실제 캠페인/광고주가 없으므로 빈 배열로 시작합니다.
export const MOCK_SLOTS: ScheduleSlot[] = [];

export const MOCK_SEASON_EVENTS: SeasonEvent[] = [
  {id:'e1',date:'2026-07-07',title:'장마권 강수 확률 80%',type:'weather',region:'광주',severity:'warning',recommendation:'실내 바베큐·보관이사 소재 노출을 강화하세요.'},
  {id:'e2',date:'2026-07-15',title:'초복',type:'season',severity:'critical',recommendation:'전복·삼계탕 캠페인을 14일 전부터 시작하세요.'},
  {id:'e3',date:'2026-07-25',title:'중복',type:'season',severity:'warning',recommendation:'초복 고성과 소재를 재활용하고 예산 증액을 검토하세요.'},
  {id:'e4',date:'2026-07-12',title:'지역 여름 축제',type:'holiday',region:'광주',severity:'info',recommendation:'지역 타겟 캠페인과 방문 유도 소재를 준비하세요.'},
  {id:'e5',date:'2026-07-09',title:'전복 특가 랜딩 오픈',type:'brand',severity:'info',recommendation:'캠페인 시작 전 랜딩·결제 이벤트 수집을 점검하세요.'},
];
