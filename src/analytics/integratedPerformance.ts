import type { DailyMetricRow } from '../types/metrics';

export type ReportType = 'lead'|'revenue'|'click'|'integrated'|'reach'|'custom';
export type PerformanceMetric = 'spend'|'impressions'|'clicks'|'leads'|'revenue'|'ctr'|'cpa'|'roas'|'cpc';
export type PerformancePoint = {
  date:string; advertiser:string; advertiserId?:string; reportType:ReportType; media:string;
  spend:number; impressions:number; clicks:number; leads:number; revenue:number; purchases?:number;
  // 상세 리포트가 아직 없는 시점(주로 당일)이라 구매/장바구니/DB 등으로 확정 분류하지 못한
  // 전환입니다. 예전에는 이 몫이 리드(leads)에 그대로 섞여 들어갔습니다.
  unconfirmed?:number;
  campaignId?:string; campaignName?:string; adId?:string; adName?:string; keywordId?:string; keyword?:string;
  validLeads?:number; contracts?:number; platformLeads?:number;
};
export type PerformanceDataset = { totals:PerformancePoint[]; media:PerformancePoint[]; advertisers:string[]; medias:string[]; latestDate:string };

const mediaMap:Record<string,string>={facebook:'메타',meta:'메타',instagram:'메타','메타':'메타',naver:'네이버',gfa:'네이버','네이버':'네이버',google:'구글 검색',google_sa:'구글 검색','구글':'구글 검색','구글 SA':'구글 검색',youtube:'유튜브','유튜브':'유튜브',danggeun:'당근',karrot:'당근','당근':'당근',kakao:'카카오',kakao_keyword:'카카오',kakao_moment:'카카오','카카오':'카카오',tiktok:'틱톡','틱톡':'틱톡'};
export function normalizeMedia(value:string){return mediaMap[value]??mediaMap[value?.toLowerCase?.()]??value;}
export const EMPTY_PERFORMANCE_DATASET:PerformanceDataset={totals:[],media:[],advertisers:[],medias:[],latestDate:''};

function typeByAdvertiser(rows:DailyMetricRow[]){
  const map=new Map<string,ReportType>();
  for(const row of rows){const key=row.advertiserId;const prev=map.get(key);if(Number(row.revenue)>0)map.set(key,'revenue');else if(Number(row.dbCount)>0&&prev!=='revenue')map.set(key,'lead');else if(!prev)map.set(key,'click');}
  return map;
}

export function performanceDatasetFromMetricRows(rows:DailyMetricRow[]):PerformanceDataset{
  if(!rows.length)return EMPTY_PERFORMANCE_DATASET;
  const types=typeByAdvertiser(rows);const media:PerformancePoint[]=[];const totalMap=new Map<string,PerformancePoint>();
  for(const row of rows){
    const advertiser=row.advertiserName||row.advertiserId;const reportType=types.get(row.advertiserId)||'click';
    const point:PerformancePoint={date:row.date,advertiser,advertiserId:row.advertiserId,reportType,media:normalizeMedia(row.channel),spend:Number(row.spend)||0,impressions:Number(row.impressions)||0,clicks:Number(row.clicks)||0,leads:Number(row.dbCount)||0,revenue:Number(row.revenue)||0,purchases:Number(row.purchases)||0,unconfirmed:Number(row.unconfirmed)||0};
    media.push(point);
    const key=`${row.date}|${row.advertiserId}`;const cur=totalMap.get(key)??{date:row.date,advertiser,advertiserId:row.advertiserId,reportType,media:'전체',spend:0,impressions:0,clicks:0,leads:0,revenue:0,purchases:0,unconfirmed:0};
    cur.spend+=point.spend;cur.impressions+=point.impressions;cur.clicks+=point.clicks;cur.leads+=point.leads;cur.revenue+=point.revenue;cur.purchases=(cur.purchases??0)+(point.purchases??0);cur.unconfirmed=(cur.unconfirmed??0)+(point.unconfirmed??0);totalMap.set(key,cur);
  }
  const totals=[...totalMap.values()].sort((a,b)=>a.date.localeCompare(b.date));const dates=totals.map(r=>r.date).sort();
  return{totals,media,advertisers:[...new Set(totals.map(r=>r.advertiser))].sort((a,b)=>a.localeCompare(b,'ko')),medias:[...new Set(media.map(r=>r.media))].sort((a,b)=>a.localeCompare(b,'ko')),latestDate:dates.length?dates[dates.length-1]:''};
}

/** @deprecated 실제 성과 화면에서는 useMetricRows + performanceDatasetFromMetricRows를 사용하세요. */
export function sumRows(rows:PerformancePoint[]){return rows.reduce((a,r)=>({spend:a.spend+r.spend,impressions:a.impressions+r.impressions,clicks:a.clicks+r.clicks,leads:a.leads+r.leads,purchases:a.purchases+(r.purchases??0),unconfirmed:a.unconfirmed+(r.unconfirmed??0),revenue:a.revenue+r.revenue,validLeads:a.validLeads+(r.validLeads??0),contracts:a.contracts+(r.contracts??0),platformLeads:a.platformLeads+(r.platformLeads??r.leads)}),{spend:0,impressions:0,clicks:0,leads:0,purchases:0,unconfirmed:0,revenue:0,validLeads:0,contracts:0,platformLeads:0});}
// '전환'은 리드(leads)만 세면 안 됩니다 - 판매(구매) 목적 광고주는 리드가 0이어도 구매(purchases)로
// 실제 전환이 있을 수 있어, CPA는 반드시 리드+구매+미확인 합계 기준으로 계산합니다.
export function derived(t:ReturnType<typeof sumRows>){const totalConversions=t.leads+(t.purchases??0)+(t.unconfirmed??0);return{...t,ctr:t.impressions?t.clicks/t.impressions*100:0,cpa:totalConversions?t.spend/totalConversions:0,roas:t.spend?t.revenue/t.spend*100:0,cpc:t.clicks?t.spend/t.clicks:0};}
export function pctChange(now:number,prev:number){return prev?(now-prev)/Math.abs(prev)*100:now?100:0;}
export function metricValue(t:ReturnType<typeof derived>,metric:PerformanceMetric){return Number(t[metric]??0);}
export function formatMetric(metric:PerformanceMetric,value:number){if(metric==='spend'||metric==='revenue'||metric==='cpa'||metric==='cpc')return value?`₩${Math.round(value).toLocaleString()}`:'-';if(metric==='ctr'||metric==='roas')return `${value.toFixed(value>=100?0:2)}%`;return Math.round(value).toLocaleString();}
