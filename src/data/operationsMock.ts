import type { Campaign, FunnelMetricDefinition, FunnelRow, MetricView, ScheduleSlot, SeasonEvent } from '../types/operations';

/** Zero State: 광고주/캠페인/일정/퍼널 샘플을 포함하지 않습니다. */
export const ADVERTISERS: { id:string; name:string; preset:string }[] = [];
export const EMPTY_DEV_CAMPAIGNS: Campaign[] = [];

// 지표 정의는 데이터가 아니라 시스템 스키마이므로 유지합니다.
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

export const MOCK_FUNNEL_ROWS: FunnelRow[] = [];
export const METRIC_VIEWS: MetricView[] = [];
export const MOCK_SLOTS: ScheduleSlot[] = [];
export const MOCK_SEASON_EVENTS: SeasonEvent[] = [];

