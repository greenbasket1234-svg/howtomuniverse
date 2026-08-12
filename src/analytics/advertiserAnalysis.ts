import { BRAND_REPORTS } from '../data/brandReports';
import { derived, metricValue, pctChange, sumRows, type PerformanceDataset, type PerformanceMetric, type PerformancePoint } from './integratedPerformance';
import { MEDIA_COLORS, MEDIA_ORDER, comparisonRange, dailySeries, inRange, rangeFor } from './mediaAnalysis';

export type AdvertiserGoalType = 'CPA'|'ROAS';
export type AdvertiserStatus = '우수'|'정상'|'주의'|'개선 필요'|'KPI 미설정';
export type AdvertiserKpiConfig = {
  id?:string;
  name:string;
  goalType:AdvertiserGoalType;
  goalTarget:number;
  monthlyTargetValue?:number;
  monthlyCurrentValue?:number;
};

export type AdvertiserComparisonRow = {
  name:string;
  reportType?:string;
  current:ReturnType<typeof derived>;
  previous:ReturnType<typeof derived>;
  primaryMetric:PerformanceMetric;
  primaryLabel:string;
  primaryValue:number;
  primaryChange:number;
  goal?:AdvertiserKpiConfig;
  goalTarget?:number;
  kpiAchievement?:number;
  healthScore?:number;
  riskScore:number;
  status:AdvertiserStatus;
  spendChange:number;
  leadChange:number;
  revenueChange:number;
  cpaChange:number;
  roasChange:number;
  spendShare:number;
  contributionShare:number;
  topMedia?:string;
  monthlyBudget?:number;
  monthSpend:number;
  monthBudgetProjection?:number;
  monthBudgetProjectionRate?:number;
  monthKpiCurrent?:number;
  monthKpiProjection?:number;
  monthKpiProjectionRate?:number;
  budgetState:'정상'|'초과 예상'|'미소진 예상'|'미설정';
};

export type AdvertiserAnomaly={advertiser:string;title:string;description:string;tone:'danger'|'warning'|'info'|'success';score:number};

const FALLBACK_KPI_CONFIGS:AdvertiserKpiConfig[]=[];

export function loadAdvertiserKpiConfigs():AdvertiserKpiConfig[]{
  try{
    const parsed=JSON.parse(localStorage.getItem('adcc-kpi-brands-v1')||'[]');
    if(Array.isArray(parsed)&&parsed.length){
      return parsed.filter(item=>item&&item.name&&item.goalType&&Number(item.goalTarget)>0).map(item=>({
        id:item.id?String(item.id):undefined,
        name:String(item.name),
        goalType:item.goalType as AdvertiserGoalType,
        goalTarget:Number(item.goalTarget),
        monthlyTargetValue:Number(item.monthlyTargetValue)||undefined,
        monthlyCurrentValue:Number(item.monthlyCurrentValue)||undefined,
      }));
    }
  }catch{/* ignore */}
  return FALLBACK_KPI_CONFIGS;
}

export function loadAdvertiserMeta(){
  const map=new Map<string,{id?:string;color?:string;monthlyBudget?:number}>();
  try{
    const parsed=JSON.parse(localStorage.getItem('ad-control-center-advertisers-v1')||'[]');
    if(Array.isArray(parsed)) parsed.forEach(item=>{
      if(item?.name) map.set(String(item.name),{id:item.id?String(item.id):undefined,color:item.color?String(item.color):undefined,monthlyBudget:Number(item.monthlyBudget)||undefined});
    });
  }catch{/* ignore */}
  BRAND_REPORTS.forEach(report=>{
    const prev=map.get(report.config.brandName)||{};
    map.set(report.config.brandName,{...prev,id:prev.id??report.config.brandId,monthlyBudget:prev.monthlyBudget??report.config.monthlyBudget});
  });
  return map;
}

function reportTypeFor(rows:PerformancePoint[]){ return rows.find(row=>row.reportType)?.reportType; }
function primaryMetricFor(reportType?:string,goal?:AdvertiserKpiConfig):PerformanceMetric{
  if(goal?.goalType==='CPA') return 'cpa';
  if(goal?.goalType==='ROAS') return 'roas';
  if(reportType==='revenue') return 'roas';
  if(reportType==='lead') return 'cpa';
  return 'clicks';
}
function primaryLabel(metric:PerformanceMetric,goal?:AdvertiserKpiConfig){
  if(goal?.goalType==='CPA') return 'CPA';
  if(goal?.goalType==='ROAS') return 'ROAS';
  if(metric==='clicks') return '클릭';
  if(metric==='leads') return 'DB';
  return metric.toUpperCase();
}
function goalAchievement(summary:ReturnType<typeof derived>,goal?:AdvertiserKpiConfig){
  if(!goal) return undefined;
  if(goal.goalType==='CPA') return summary.cpa>0?goal.goalTarget/summary.cpa*100:0;
  return goal.goalTarget>0?summary.roas/goal.goalTarget*100:0;
}
function statusFromAchievement(value?:number):AdvertiserStatus{
  if(value===undefined) return 'KPI 미설정';
  if(value>=110) return '우수';
  if(value>=90) return '정상';
  if(value>=70) return '주의';
  return '개선 필요';
}
function directionScore(metric:PerformanceMetric,change:number){
  if(metric==='cpa') return -change;
  if(['roas','revenue','leads','clicks','ctr'].includes(metric)) return change;
  return change;
}
function clamp(value:number,min=0,max=100){return Math.max(min,Math.min(max,value));}
function variationScore(rows:PerformancePoint[],metric:PerformanceMetric){
  const series=dailySeries(rows).map(item=>metricValue(item,metric)).filter(value=>Number.isFinite(value)&&value>=0);
  if(series.length<2) return 70;
  const mean=series.reduce((a,b)=>a+b,0)/series.length;
  if(!mean) return 60;
  const variance=series.reduce((a,b)=>a+Math.pow(b-mean,2),0)/series.length;
  const cv=Math.sqrt(variance)/mean;
  return clamp(100-cv*100);
}
function monthRange(latestDate:string){
  if(!latestDate) return ['', '', 0, 0] as const;
  const d=new Date(`${latestDate}T00:00:00`);
  const totalDays=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  return [`${latestDate.slice(0,7)}-01`,latestDate,d.getDate(),totalDays] as const;
}
function budgetState(rate?:number,hasBudget=false):AdvertiserComparisonRow['budgetState']{
  if(!hasBudget) return '미설정';
  if(rate===undefined) return '정상';
  if(rate>110) return '초과 예상';
  if(rate<85) return '미소진 예상';
  return '정상';
}
function topMediaFor(data:PerformanceDataset,name:string,start:string,end:string,reportType?:string){
  const rows=data.media.filter(row=>row.advertiser===name&&inRange(row.date,start,end));
  const metric:PerformanceMetric=reportType==='revenue'?'revenue':reportType==='lead'?'leads':'clicks';
  return MEDIA_ORDER.map(media=>({media,summary:derived(sumRows(rows.filter(row=>row.media===media)))}))
    .filter(item=>metricValue(item.summary,metric)>0)
    .sort((a,b)=>metricValue(b.summary,metric)-metricValue(a.summary,metric))[0]?.media;
}

export function buildAdvertiserComparison(data:PerformanceDataset,currentStart:string,currentEnd:string,prevStart:string,prevEnd:string){
  const goals=loadAdvertiserKpiConfigs();
  const meta=loadAdvertiserMeta();
  const currentPortfolio=derived(sumRows(data.totals.filter(row=>inRange(row.date,currentStart,currentEnd))));
  const [monthStart,monthEnd,elapsedDays,totalDays]=monthRange(data.latestDate);

  const firstPass=data.advertisers.map(name=>{
    const currentRows=data.totals.filter(row=>row.advertiser===name&&inRange(row.date,currentStart,currentEnd));
    const previousRows=data.totals.filter(row=>row.advertiser===name&&inRange(row.date,prevStart,prevEnd));
    const current=derived(sumRows(currentRows)),previous=derived(sumRows(previousRows));
    const reportType=reportTypeFor(currentRows.length?currentRows:data.totals.filter(row=>row.advertiser===name));
    const goal=goals.find(item=>item.name===name);
    const metric=primaryMetricFor(reportType,goal);
    const achievement=goalAchievement(current,goal);
    const spendChange=pctChange(current.spend,previous.spend);
    const leadChange=pctChange(current.leads,previous.leads);
    const revenueChange=pctChange(current.revenue,previous.revenue);
    const cpaChange=pctChange(current.cpa,previous.cpa);
    const roasChange=pctChange(current.roas,previous.roas);
    const primaryChange=pctChange(metricValue(current,metric),metricValue(previous,metric));
    const info=meta.get(name)||{};
    const monthlyBudget=info.monthlyBudget;
    const monthRows=data.totals.filter(row=>row.advertiser===name&&inRange(row.date,monthStart,monthEnd));
    const monthSummary=derived(sumRows(monthRows));
    const monthSpend=monthSummary.spend;
    const monthBudgetProjection=elapsedDays?monthSpend/elapsedDays*totalDays:undefined;
    const monthBudgetProjectionRate=monthlyBudget&&monthBudgetProjection!==undefined?monthBudgetProjection/monthlyBudget*100:undefined;
    const monthKpiCurrent=goal?.goalType==='CPA'?monthSummary.leads:goal?.goalType==='ROAS'?monthSummary.revenue:undefined;
    const monthKpiProjection=monthKpiCurrent!==undefined&&elapsedDays?monthKpiCurrent/elapsedDays*totalDays:undefined;
    const monthKpiProjectionRate=goal?.monthlyTargetValue&&monthKpiProjection!==undefined?monthKpiProjection/goal.monthlyTargetValue*100:undefined;
    const budgetStability=monthBudgetProjectionRate===undefined?70:clamp(100-Math.abs(monthBudgetProjectionRate-100)*1.4);
    const efficiencyChange=directionScore(metric,primaryChange);
    const outcomeChange=reportType==='revenue'?revenueChange:reportType==='lead'?leadChange:pctChange(current.clicks,previous.clicks);
    const volatility=variationScore(currentRows,metric);
    const healthScore=achievement===undefined?undefined:Math.round(clamp(clamp(achievement,0,130)*.45+clamp(50+efficiencyChange,0,100)*.20+clamp(50+outcomeChange,0,100)*.15+budgetStability*.10+volatility*.10));
    let risk=0;
    if(achievement!==undefined) risk+=clamp(100-achievement)*.45;
    risk+=clamp(-directionScore(metric,primaryChange))*0.25;
    if(monthBudgetProjectionRate!==undefined) risk+=clamp(Math.abs(monthBudgetProjectionRate-100)-10)*0.35;
    if(cpaChange>20) risk+=Math.min(18,cpaChange*.25);
    if(roasChange<-20) risk+=Math.min(18,Math.abs(roasChange)*.25);
    const riskScore=Math.round(clamp(risk));
    return {
      name,reportType,current,previous,primaryMetric:metric,primaryLabel:primaryLabel(metric,goal),primaryValue:metricValue(current,metric),primaryChange,
      goal,goalTarget:goal?.goalTarget,kpiAchievement:achievement,healthScore,riskScore,status:statusFromAchievement(achievement),spendChange,leadChange,revenueChange,cpaChange,roasChange,
      spendShare:currentPortfolio.spend?current.spend/currentPortfolio.spend*100:0,contributionShare:0,topMedia:topMediaFor(data,name,currentStart,currentEnd,reportType),monthlyBudget,monthSpend,
      monthBudgetProjection,monthBudgetProjectionRate,monthKpiCurrent,monthKpiProjection,monthKpiProjectionRate,budgetState:budgetState(monthBudgetProjectionRate,Boolean(monthlyBudget)),
    } satisfies AdvertiserComparisonRow;
  }).filter(row=>row.current.spend||row.current.clicks||row.current.leads||row.current.revenue);

  const configuredTotal=firstPass.reduce((acc,row)=>acc+(row.kpiAchievement??0),0);
  return firstPass.map(row=>({...row,contributionShare:configuredTotal&&row.kpiAchievement!==undefined?row.kpiAchievement/configuredTotal*100:0}));
}

export function detectAdvertiserAnomalies(rows:AdvertiserComparisonRow[]):AdvertiserAnomaly[]{
  const out:AdvertiserAnomaly[]=[];
  rows.forEach(row=>{
    if(row.kpiAchievement!==undefined&&row.kpiAchievement<70) out.push({advertiser:row.name,title:'KPI 목표 미달',description:`대표 KPI 달성률이 ${row.kpiAchievement.toFixed(0)}%입니다.`,tone:'danger',score:Math.min(100,80+(70-row.kpiAchievement)/2)});
    if(row.current.cpa>0&&row.cpaChange>20) out.push({advertiser:row.name,title:'CPA 악화',description:`CPA가 비교기간보다 ${row.cpaChange.toFixed(0)}% 상승했습니다.`,tone:'danger',score:70});
    if(row.current.roas>0&&row.roasChange<-20) out.push({advertiser:row.name,title:'ROAS 하락',description:`ROAS가 비교기간보다 ${Math.abs(row.roasChange).toFixed(0)}% 하락했습니다.`,tone:'danger',score:68});
    if(row.spendChange>20&&directionScore(row.primaryMetric,row.primaryChange)<0) out.push({advertiser:row.name,title:'광고비 대비 성과 악화',description:`광고비는 ${row.spendChange.toFixed(0)}% 증가했지만 대표 KPI 효율이 악화됐습니다.`,tone:'warning',score:72});
    if(row.budgetState==='초과 예상') out.push({advertiser:row.name,title:'예산 초과 예상',description:`현재 추세 기준 월 예산의 ${(row.monthBudgetProjectionRate??0).toFixed(0)}% 집행이 예상됩니다.`,tone:'warning',score:65});
    if(row.budgetState==='미소진 예상') out.push({advertiser:row.name,title:'예산 미소진 예상',description:`현재 추세 기준 월 예산의 ${(row.monthBudgetProjectionRate??0).toFixed(0)}% 집행이 예상됩니다.`,tone:'info',score:52});
  });
  return out.sort((a,b)=>b.score-a.score).slice(0,10);
}

export function advertiserDailySeries(data:PerformanceDataset,name:string,start:string,end:string){
  return dailySeries(data.totals.filter(row=>row.advertiser===name&&inRange(row.date,start,end)));
}

export function advertiserMediaRows(data:PerformanceDataset,name:string,start:string,end:string){
  const rows=data.media.filter(row=>row.advertiser===name&&inRange(row.date,start,end));
  const total=derived(sumRows(rows));
  return MEDIA_ORDER.map(media=>{
    const summary=derived(sumRows(rows.filter(row=>row.media===media)));
    return {media,summary,spendShare:total.spend?summary.spend/total.spend*100:0,leadShare:total.leads?summary.leads/total.leads*100:0,revenueShare:total.revenue?summary.revenue/total.revenue*100:0,color:MEDIA_COLORS[media]};
  }).filter(row=>row.summary.spend||row.summary.clicks||row.summary.leads||row.summary.revenue);
}

export function advertiserFunnel(summary:ReturnType<typeof derived>,reportType?:string){
  const ctr=summary.impressions?summary.clicks/summary.impressions*100:0;
  if(reportType==='lead'||summary.leads>0) return [
    {label:'노출',value:summary.impressions,rate:undefined},
    {label:'클릭',value:summary.clicks,rate:ctr},
    {label:'DB',value:summary.leads,rate:summary.clicks?summary.leads/summary.clicks*100:0},
  ];
  if(reportType==='revenue') return [
    {label:'노출',value:summary.impressions,rate:undefined},
    {label:'클릭',value:summary.clicks,rate:ctr},
    {label:'구매/전환',value:summary.leads,rate:summary.clicks?summary.leads/summary.clicks*100:0},
  ];
  return [
    {label:'노출',value:summary.impressions,rate:undefined},
    {label:'클릭',value:summary.clicks,rate:ctr},
  ];
}

export { rangeFor, comparisonRange, inRange };
