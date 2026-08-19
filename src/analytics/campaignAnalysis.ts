import { ADVERTISERS } from '../data/operationsMock';
import type { Campaign } from '../types/operations';
import { derived, metricValue, pctChange, sumRows, type PerformanceDataset, type PerformanceMetric, type PerformancePoint } from './integratedPerformance';
import { loadAdvertiserKpiConfigs, type AdvertiserKpiConfig } from './advertiserAnalysis';
import { comparisonRange, dailySeries, inRange, normalizeCampaignMedia, rangeFor } from './mediaAnalysis';

export type CampaignAnalysisStatus = '우수'|'정상'|'주의'|'개선 필요'|'KPI 미설정'|'성과 데이터 없음';
export type CampaignBudgetState = '정상'|'빠른 소진'|'과소진 위험'|'느린 소진'|'미소진 위험'|'예산 없음'|'성과 데이터 없음';
export type CampaignBudgetVerdict = '확대 검토'|'유지'|'축소 검토'|'구조 점검'|'데이터 부족';
export type CampaignDataAttribution = 'campaign'|'single-media-campaign'|'none';

export type CampaignDerived = ReturnType<typeof derived> & {
  cpc:number;
  cpm:number;
  cvr:number;
  aov:number;
};

export type CampaignComparisonRow = {
  campaign:Campaign;
  advertiserName:string;
  mediaName:string;
  current:CampaignDerived;
  previous:CampaignDerived;
  currentRows:PerformancePoint[];
  previousRows:PerformancePoint[];
  attribution:CampaignDataAttribution;
  attributionLabel:string;
  goal?:AdvertiserKpiConfig;
  primaryMetric:PerformanceMetric;
  primaryLabel:string;
  primaryChange:number;
  spendChange:number;
  clickChange:number;
  leadChange:number;
  revenueChange:number;
  ctrChange:number;
  cpcChange:number;
  cpmChange:number;
  cvrChange:number;
  cpaChange:number;
  roasChange:number;
  aovChange:number;
  kpiAchievement?:number;
  healthScore?:number;
  riskScore?:number;
  analysisStatus:CampaignAnalysisStatus;
  plannedBudgetCurrent:number;
  spendVsPlannedRate?:number;
  monthSpend:number;
  monthExpectedSpend?:number;
  monthProjection?:number;
  monthProjectionRate?:number;
  budgetState:CampaignBudgetState;
  budgetVerdict:CampaignBudgetVerdict;
};

export type CampaignAnomaly={
  campaignId:string;
  campaignName:string;
  advertiserName:string;
  title:string;
  description:string;
  tone:'danger'|'warning'|'info'|'success';
  score:number;
};

export type CampaignChangeDriver={
  key:'cvr'|'cpc'|'ctr'|'cpm'|'aov'|'clicks'|'revenue'|'leads';
  label:string;
  change:number;
  tone:'good'|'bad'|'neutral';
  message:string;
};

const CAMPAIGN_STORAGE_KEY='howtom-campaign-management-v2';
const ADVERTISER_ALIASES:Record<string,string[]>={};

export function loadCampaigns():Campaign[]{
  try{
    const parsed=JSON.parse(localStorage.getItem(CAMPAIGN_STORAGE_KEY)||'null');
    if(Array.isArray(parsed)&&parsed.length) return parsed as Campaign[];
  }catch{/* ignore */}
  return [];
}

export function campaignAdvertiserNames(campaign:Campaign){
  const names=new Set<string>();
  try {
    const parsed=JSON.parse(localStorage.getItem('ad-control-center-advertisers-v1')||'[]');
    if(Array.isArray(parsed)){
      const item=parsed.find(entry=>String(entry?.id||'')===campaign.advertiserId);
      if(item?.name) names.add(String(item.name));
    }
  } catch {/* ignore */}
  const mock=ADVERTISERS.find(item=>item.id===campaign.advertiserId);
  if(mock?.name) names.add(mock.name);
  (ADVERTISER_ALIASES[campaign.advertiserId]||[]).forEach(name=>names.add(name));
  return [...names];
}

export function canonicalAdvertiserName(campaign:Campaign,data:PerformanceDataset){
  const aliases=campaignAdvertiserNames(campaign);
  return aliases.find(name=>data.advertisers.includes(name)) ?? aliases[0] ?? campaign.advertiserId;
}

function campaignMedia(campaign:Campaign){ return normalizeCampaignMedia(campaign.platform); }
function campaignActiveOnDate(campaign:Campaign,date:string){
  const start=campaign.startAt.slice(0,10);
  const end=campaign.endAt?.slice(0,10);
  return date>=start && (!end||date<=end);
}
function activeDaysBetween(campaign:Campaign,start:string,end:string){
  if(!start||!end) return 0;
  const campaignStart=campaign.startAt.slice(0,10);
  const campaignEnd=campaign.endAt?.slice(0,10)||end;
  const from=new Date(`${start>campaignStart?start:campaignStart}T00:00:00`);
  const to=new Date(`${end<campaignEnd?end:campaignEnd}T00:00:00`);
  if(+to<+from) return 0;
  return Math.floor((+to-+from)/86400000)+1;
}
function daysBetween(start:string,end:string){
  if(!start||!end) return 0;
  return Math.max(0,Math.floor((+new Date(`${end}T00:00:00`)-+new Date(`${start}T00:00:00`))/86400000)+1);
}
function addDerived(summary:ReturnType<typeof derived>):CampaignDerived{
  return {
    ...summary,
    cpc:summary.clicks?summary.spend/summary.clicks:0,
    cpm:summary.impressions?summary.spend/summary.impressions*1000:0,
    cvr:summary.clicks?summary.leads/summary.clicks*100:0,
    aov:summary.leads?summary.revenue/summary.leads:0,
  };
}
function clamp(value:number,min=0,max=100){return Math.max(min,Math.min(max,value));}
function directionScore(metric:PerformanceMetric,change:number){
  if(metric==='cpa') return -change;
  if(['roas','revenue','leads','clicks','ctr'].includes(metric)) return change;
  return change;
}
function achievement(summary:CampaignDerived,goal?:AdvertiserKpiConfig){
  if(!goal) return undefined;
  if(goal.goalType==='CPA') return summary.cpa>0?goal.goalTarget/summary.cpa*100:0;
  return goal.goalTarget>0?summary.roas/goal.goalTarget*100:0;
}
function analysisStatus(value:number|undefined,hasData:boolean):CampaignAnalysisStatus{
  if(!hasData) return '성과 데이터 없음';
  if(value===undefined) return 'KPI 미설정';
  if(value>=110) return '우수';
  if(value>=90) return '정상';
  if(value>=70) return '주의';
  return '개선 필요';
}
function volatilityScore(rows:PerformancePoint[],metric:PerformanceMetric){
  const series=dailySeries(rows).map(day=>metricValue(day,metric)).filter(value=>Number.isFinite(value)&&value>=0);
  if(series.length<2) return 70;
  const mean=series.reduce((a,b)=>a+b,0)/series.length;
  if(!mean) return 60;
  const variance=series.reduce((sum,value)=>sum+Math.pow(value-mean,2),0)/series.length;
  const cv=Math.sqrt(variance)/mean;
  return clamp(100-cv*100);
}
function reportTypeFor(rows:PerformancePoint[]){return rows.find(row=>row.reportType)?.reportType;}
function primaryMetricFor(rows:PerformancePoint[],goal?:AdvertiserKpiConfig):PerformanceMetric{
  if(goal?.goalType==='CPA') return 'cpa';
  if(goal?.goalType==='ROAS') return 'roas';
  const type=reportTypeFor(rows);
  if(type==='revenue') return 'roas';
  if(type==='lead') return 'cpa';
  return 'clicks';
}
function primaryLabel(metric:PerformanceMetric,goal?:AdvertiserKpiConfig){
  if(goal?.goalType==='CPA') return 'CPA';
  if(goal?.goalType==='ROAS') return 'ROAS';
  if(metric==='clicks') return '클릭';
  if(metric==='leads') return 'DB/전환';
  return metric.toUpperCase();
}
function uniqueCampaignForMedia(campaign:Campaign,campaigns:Campaign[],data:PerformanceDataset){
  const advertiserName=canonicalAdvertiserName(campaign,data);
  const mediaName=campaignMedia(campaign);
  const peers=campaigns.filter(item=>canonicalAdvertiserName(item,data)===advertiserName&&campaignMedia(item)===mediaName&&item.platform!=='blog');
  return peers.length===1;
}
function performanceRowsForCampaign(campaign:Campaign,campaigns:Campaign[],data:PerformanceDataset,start:string,end:string){
  const advertiserName=canonicalAdvertiserName(campaign,data);
  const mediaName=campaignMedia(campaign);
  if(!uniqueCampaignForMedia(campaign,campaigns,data)) return {rows:[] as PerformancePoint[],attribution:'none' as CampaignDataAttribution,label:'캠페인 단위 성과 데이터 미연결'};
  const rows=data.media.filter(row=>row.advertiser===advertiserName&&row.media===mediaName&&inRange(row.date,start,end)&&campaignActiveOnDate(campaign,row.date));
  return {rows,attribution:rows.length?'single-media-campaign' as CampaignDataAttribution:'none' as CampaignDataAttribution,label:rows.length?'동일 광고주·매체의 단일 캠페인 성과 연결':'연결 가능한 성과 데이터 없음'};
}
function plannedBudget(campaign:Campaign,start:string,end:string){
  if(campaign.budget<=0) return 0;
  if(campaign.budgetType==='total') return campaign.budget;
  return campaign.budget*activeDaysBetween(campaign,start,end);
}
function budgetMetrics(campaign:Campaign,campaigns:Campaign[],data:PerformanceDataset,latestDate:string){
  if(!latestDate||campaign.budget<=0) return {monthSpend:0,budgetState:'예산 없음' as CampaignBudgetState};
  const monthStart=`${latestDate.slice(0,7)}-01`;
  const monthEnd=new Date(+latestDate.slice(0,4),+latestDate.slice(5,7),0);
  const fullMonthEnd=`${monthEnd.getFullYear()}-${String(monthEnd.getMonth()+1).padStart(2,'0')}-${String(monthEnd.getDate()).padStart(2,'0')}`;
  const perf=performanceRowsForCampaign(campaign,campaigns,data,monthStart,latestDate);
  if(!perf.rows.length) return {monthSpend:0,budgetState:'성과 데이터 없음' as CampaignBudgetState};
  const monthSpend=sumRows(perf.rows).spend;
  const elapsedActive=activeDaysBetween(campaign,monthStart,latestDate);
  const totalActive=campaign.budgetType==='total'?activeDaysBetween(campaign,campaign.startAt.slice(0,10),campaign.endAt?.slice(0,10)||fullMonthEnd):activeDaysBetween(campaign,monthStart,fullMonthEnd);
  const fullBudget=campaign.budgetType==='total'?campaign.budget:campaign.budget*totalActive;
  const expectedSpend=campaign.budgetType==='total'&&totalActive?campaign.budget*(elapsedActive/totalActive):campaign.budget*elapsedActive;
  const projection=elapsedActive&&totalActive?monthSpend/elapsedActive*totalActive:undefined;
  const projectionRate=fullBudget&&projection!==undefined?projection/fullBudget*100:undefined;
  const pacingRate=expectedSpend?monthSpend/expectedSpend*100:undefined;
  let budgetState:CampaignBudgetState='정상';
  if(pacingRate!==undefined){
    if(pacingRate>=125) budgetState='과소진 위험';
    else if(pacingRate>=110) budgetState='빠른 소진';
    else if(pacingRate<=70) budgetState='미소진 위험';
    else if(pacingRate<=90) budgetState='느린 소진';
  }
  return {monthSpend,monthExpectedSpend:expectedSpend,monthProjection:projection,monthProjectionRate:projectionRate,budgetState};
}
function verdict(row:Pick<CampaignComparisonRow,'attribution'|'kpiAchievement'|'primaryMetric'|'primaryChange'|'budgetState'|'spendChange'|'leadChange'|'cpaChange'|'roasChange'>):CampaignBudgetVerdict{
  if(row.attribution==='none') return '데이터 부족';
  const a=row.kpiAchievement;
  if(a!==undefined&&a>=115&&directionScore(row.primaryMetric,row.primaryChange)>0&&row.budgetState!=='과소진 위험') return '확대 검토';
  if((a!==undefined&&a<70)||(row.spendChange>15&&(row.leadChange<0||row.cpaChange>25||row.roasChange<-20))) return '축소 검토';
  if(row.budgetState==='과소진 위험'||row.budgetState==='미소진 위험'||row.budgetState==='빠른 소진') return '구조 점검';
  return '유지';
}

export function buildCampaignComparison(data:PerformanceDataset,currentStart:string,currentEnd:string,prevStart:string,prevEnd:string,campaigns=loadCampaigns()){
  const goals=loadAdvertiserKpiConfigs();
  return campaigns.filter(c=>c.platform!=='blog').map(campaign=>{
    const advertiserName=canonicalAdvertiserName(campaign,data);
    const mediaName=campaignMedia(campaign);
    const currentPerf=performanceRowsForCampaign(campaign,campaigns,data,currentStart,currentEnd);
    const previousPerf=performanceRowsForCampaign(campaign,campaigns,data,prevStart,prevEnd);
    const current=addDerived(derived(sumRows(currentPerf.rows)));
    const previous=addDerived(derived(sumRows(previousPerf.rows)));
    const goal=goals.find(item=>campaignAdvertiserNames(campaign).includes(item.name)||item.name===advertiserName);
    const primaryMetric=primaryMetricFor(currentPerf.rows.length?currentPerf.rows:previousPerf.rows,goal);
    const kpiAchievement=achievement(current,goal);
    const primaryChange=pctChange(metricValue(current,primaryMetric),metricValue(previous,primaryMetric));
    const spendChange=pctChange(current.spend,previous.spend),clickChange=pctChange(current.clicks,previous.clicks),leadChange=pctChange(current.leads,previous.leads),revenueChange=pctChange(current.revenue,previous.revenue);
    const ctrChange=pctChange(current.ctr,previous.ctr),cpcChange=pctChange(current.cpc,previous.cpc),cpmChange=pctChange(current.cpm,previous.cpm),cvrChange=pctChange(current.cvr,previous.cvr),cpaChange=pctChange(current.cpa,previous.cpa),roasChange=pctChange(current.roas,previous.roas),aovChange=pctChange(current.aov,previous.aov);
    const plannedBudgetCurrent=plannedBudget(campaign,currentStart,currentEnd);
    const spendVsPlannedRate=plannedBudgetCurrent&&currentPerf.rows.length?current.spend/plannedBudgetCurrent*100:undefined;
    const budget=budgetMetrics(campaign,campaigns,data,data.latestDate);
    let healthScore:number|undefined,riskScore:number|undefined;
    if(currentPerf.rows.length){
      const attainment=kpiAchievement===undefined?70:clamp(kpiAchievement,0,130);
      const efficiency=clamp(50+directionScore(primaryMetric,primaryChange),0,100);
      const outcome=clamp(50+(current.revenue>0?revenueChange:current.leads>0?leadChange:clickChange),0,100);
      const budgetStability=budget.monthProjectionRate===undefined?70:clamp(100-Math.abs(budget.monthProjectionRate-100)*1.2);
      const volatility=volatilityScore(currentPerf.rows,primaryMetric);
      healthScore=Math.round(clamp(attainment*.35+efficiency*.25+outcome*.15+budgetStability*.15+volatility*.10));
      let risk=0;
      if(kpiAchievement!==undefined) risk+=clamp(100-kpiAchievement)*.4;
      risk+=clamp(-directionScore(primaryMetric,primaryChange))*.25;
      if(cpaChange>20) risk+=Math.min(20,cpaChange*.3);
      if(roasChange<-20) risk+=Math.min(20,Math.abs(roasChange)*.3);
      if(budget.budgetState==='과소진 위험'||budget.budgetState==='미소진 위험') risk+=18;
      else if(budget.budgetState==='빠른 소진'||budget.budgetState==='느린 소진') risk+=8;
      riskScore=Math.round(clamp(risk));
    }
    const row:CampaignComparisonRow={
      campaign,advertiserName,mediaName,current,previous,currentRows:currentPerf.rows,previousRows:previousPerf.rows,
      attribution:currentPerf.attribution,attributionLabel:currentPerf.label,goal,primaryMetric,primaryLabel:primaryLabel(primaryMetric,goal),primaryChange,
      spendChange,clickChange,leadChange,revenueChange,ctrChange,cpcChange,cpmChange,cvrChange,cpaChange,roasChange,aovChange,
      kpiAchievement,healthScore,riskScore,analysisStatus:analysisStatus(kpiAchievement,currentPerf.rows.length>0),plannedBudgetCurrent,spendVsPlannedRate,
      monthSpend:budget.monthSpend,monthExpectedSpend:budget.monthExpectedSpend,monthProjection:budget.monthProjection,monthProjectionRate:budget.monthProjectionRate,budgetState:budget.budgetState,budgetVerdict:'데이터 부족',
    };
    row.budgetVerdict=verdict(row);
    return row;
  });
}

export function detectCampaignAnomalies(rows:CampaignComparisonRow[]):CampaignAnomaly[]{
  const out:CampaignAnomaly[]=[];
  rows.forEach(row=>{
    if(row.attribution==='none') return;
    const base={campaignId:row.campaign.id,campaignName:row.campaign.name,advertiserName:row.advertiserName};
    if(row.kpiAchievement!==undefined&&row.kpiAchievement<70) out.push({...base,title:'KPI 목표 이탈',description:`대표 KPI 달성률이 ${row.kpiAchievement.toFixed(0)}%입니다.`,tone:'danger',score:88});
    if(row.current.cpa>0&&row.cpaChange>20) out.push({...base,title:'CPA 급등',description:`CPA가 비교기간보다 ${row.cpaChange.toFixed(0)}% 상승했습니다.`,tone:'danger',score:82});
    if(row.current.roas>0&&row.roasChange<-20) out.push({...base,title:'ROAS 급락',description:`ROAS가 비교기간보다 ${Math.abs(row.roasChange).toFixed(0)}% 하락했습니다.`,tone:'danger',score:80});
    if(row.current.ctr>0&&row.ctrChange<-20) out.push({...base,title:'CTR 급락',description:`CTR이 ${Math.abs(row.ctrChange).toFixed(0)}% 하락했습니다.`,tone:'warning',score:66});
    if(row.current.cvr>0&&row.cvrChange<-20) out.push({...base,title:'CVR 급락',description:`클릭 후 전환율이 ${Math.abs(row.cvrChange).toFixed(0)}% 하락했습니다.`,tone:'warning',score:72});
    if(row.cpcChange>25) out.push({...base,title:'CPC 급등',description:`CPC가 ${row.cpcChange.toFixed(0)}% 상승했습니다.`,tone:'warning',score:62});
    if(row.budgetState==='과소진 위험') out.push({...base,title:'예산 과소진 위험',description:`현재 집행 속도 기준 예정 예산보다 빠르게 소진되고 있습니다.`,tone:'warning',score:72});
    if(row.budgetState==='미소진 위험') out.push({...base,title:'예산 미소진 위험',description:`현재 집행 속도가 계획보다 크게 느립니다.`,tone:'info',score:54});
    if(row.spendChange>20&&directionScore(row.primaryMetric,row.primaryChange)<0) out.push({...base,title:'광고비 대비 성과 악화',description:`광고비는 ${row.spendChange.toFixed(0)}% 증가했지만 대표 KPI 효율은 악화됐습니다.`,tone:'danger',score:84});
  });
  return out.sort((a,b)=>b.score-a.score).slice(0,12);
}

export function campaignChangeDrivers(row:CampaignComparisonRow):CampaignChangeDriver[]{
  if(row.attribution==='none') return [];
  const drivers:CampaignChangeDriver[]=[];
  const push=(key:CampaignChangeDriver['key'],label:string,change:number,badWhen:'up'|'down',message:string)=>{
    if(Math.abs(change)<5) return;
    const bad=badWhen==='up'?change>0:change<0;
    drivers.push({key,label,change,tone:bad?'bad':'good',message});
  };
  if(row.primaryMetric==='cpa'||row.current.cpa>0){
    push('cvr','CVR',row.cvrChange,'down','클릭 이후 전환 효율 변화');
    push('cpc','CPC',row.cpcChange,'up','클릭 단가 변화');
    push('ctr','CTR',row.ctrChange,'down','광고 반응률 변화');
    push('cpm','CPM',row.cpmChange,'up','노출 단가 변화');
  }
  if(row.primaryMetric==='roas'||row.current.revenue>0){
    push('aov','전환당 매출',row.aovChange,'down','전환 가치 변화');
    push('cvr','CVR',row.cvrChange,'down','클릭 이후 전환 효율 변화');
    push('cpc','CPC',row.cpcChange,'up','유입 비용 변화');
    push('revenue','매출',row.revenueChange,'down','매출 변화');
  }
  if(row.primaryMetric==='clicks'){
    push('ctr','CTR',row.ctrChange,'down','노출 대비 클릭 반응 변화');
    push('cpc','CPC',row.cpcChange,'up','클릭 단가 변화');
    push('clicks','클릭',row.clickChange,'down','유입량 변화');
  }
  const unique=new Map<CampaignChangeDriver['key'],CampaignChangeDriver>();
  drivers.forEach(item=>{const old=unique.get(item.key);if(!old||Math.abs(item.change)>Math.abs(old.change))unique.set(item.key,item);});
  return [...unique.values()].sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,5);
}

export function campaignDailySeries(row:CampaignComparisonRow){
  return dailySeries(row.currentRows).map(day=>addDerived(day));
}

export function campaignPreviousDailySeries(row:CampaignComparisonRow){
  return dailySeries(row.previousRows).map(day=>addDerived(day));
}

export function campaignFunnel(row:CampaignComparisonRow){
  const summary=row.current;
  if(row.attribution==='none') return [] as Array<{label:string;value:number;rate?:number}>;
  if(summary.leads>0) return [
    {label:'노출',value:summary.impressions},
    {label:'클릭',value:summary.clicks,rate:summary.ctr},
    {label:row.goal?.goalType==='ROAS'?'구매/전환':'DB/전환',value:summary.leads,rate:summary.cvr},
  ];
  return [
    {label:'노출',value:summary.impressions},
    {label:'클릭',value:summary.clicks,rate:summary.ctr},
  ];
}

export function campaignScheduleEvents(campaign:Campaign){
  const events:Array<{date?:string;label:string;detail:string;type:'start'|'end'|'on'|'off'|'rule'}>=[];
  events.push({date:campaign.startAt.slice(0,16).replace('T',' '),label:'캠페인 시작',detail:campaign.name,type:'start'});
  if(campaign.schedule?.onAt) events.push({date:campaign.schedule.onAt.slice(0,16).replace('T',' '),label:'예약 ON',detail:'예약된 ON 일정',type:'on'});
  if(campaign.schedule?.offAt) events.push({date:campaign.schedule.offAt.slice(0,16).replace('T',' '),label:'예약 OFF',detail:'예약된 OFF 일정',type:'off'});
  (campaign.schedule?.rules?.length?campaign.schedule.rules:campaign.schedule?.repeat?[campaign.schedule.repeat]:[]).forEach(rule=>events.push({label:'자동 일정 규칙',detail:rule,type:'rule'}));
  if(campaign.endAt) events.push({date:campaign.endAt.slice(0,16).replace('T',' '),label:'캠페인 종료',detail:'설정된 종료 일정',type:'end'});
  return events;
}

export function campaignStatusLabel(status:Campaign['status']){
  return status==='on'?'운영 중':status==='off'?'중지':status==='scheduled'?'예약 대기':status==='review'?'심사 중':status==='error'?'오류':'지원 불가';
}

export { rangeFor, comparisonRange, inRange };
