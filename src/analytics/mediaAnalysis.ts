import { derived, metricValue, normalizeMedia, pctChange, sumRows, type PerformanceDataset, type PerformanceMetric, type PerformancePoint } from './integratedPerformance';

export const MEDIA_ORDER = ['메타','네이버','구글 검색','유튜브','당근','카카오','틱톡'] as const;
export type MediaName = (typeof MEDIA_ORDER)[number];
export const MEDIA_COLORS: Record<string,string> = {
  '메타':'#4776ff','네이버':'#03c75a','구글 검색':'#6b7280','유튜브':'#ef4444','당근':'#ff6f0f','카카오':'#f5c400','틱톡':'#111827',
};

export type MediaSummary = ReturnType<typeof derived>;
export type MediaComparisonRow = {
  name: string;
  current: MediaSummary;
  previous: MediaSummary;
  primaryMetric: PerformanceMetric;
  primaryChange: number;
  spendChange: number;
  leadChange: number;
  cpaChange: number;
  roasChange: number;
  ctrChange: number;
  spendShare: number;
  performanceShare: number;
  kpiTarget?: number;
  kpiAchievement?: number;
  healthScore: number;
  budgetVerdict: '효율적 확대'|'성장 기회'|'안정'|'유지'|'비효율 증가'|'축소 검토';
};

export type MediaAnomaly = { media:string; title:string; description:string; tone:'danger'|'warning'|'info'|'success'; score:number };

export function iso(date:Date){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function addDays(value:string, days:number){ const d=new Date(`${value}T00:00:00`); d.setDate(d.getDate()+days); return iso(d); }
export function rangeFor(period:string, latest:string){
  if(!latest) return ['', ''] as const;
  const d=new Date(`${latest}T00:00:00`);
  if(period==='오늘') return [latest,latest] as const;
  if(period==='어제'){ const x=addDays(latest,-1); return [x,x] as const; }
  if(period.startsWith('최근 ')){ const n=Number(period.match(/\d+/)?.[0]||30); return [addDays(latest,-n+1),latest] as const; }
  if(period==='이번 달') return [`${latest.slice(0,7)}-01`,latest] as const;
  const prevStart=new Date(d.getFullYear(),d.getMonth()-1,1), prevEnd=new Date(d.getFullYear(),d.getMonth(),0);
  return [iso(prevStart),iso(prevEnd)] as const;
}
export function comparisonRange(start:string,end:string,mode:string){
  if(!start||!end||mode==='비교 안 함') return ['', ''] as const;
  const days=Math.max(1,Math.round((+new Date(end)-+new Date(start))/86400000)+1);
  if(mode==='직전 동일기간') return [addDays(start,-days),addDays(start,-1)] as const;
  const shift=(value:string,months=0,years=0)=>{ const d=new Date(`${value}T00:00:00`); d.setFullYear(d.getFullYear()-years); d.setMonth(d.getMonth()-months); return iso(d); };
  if(mode==='전월') return [shift(start,1),shift(end,1)] as const;
  return [shift(start,0,1),shift(end,0,1)] as const;
}
export function inRange(date:string,start:string,end:string){ return (!start||date>=start)&&(!end||date<=end); }
export function primaryMetric(reportType?:string):PerformanceMetric{ return reportType==='revenue'?'roas':reportType==='lead'?'cpa':'clicks'; }
export function metricDirection(metric:PerformanceMetric, change:number){
  if(metric==='cpa') return -change;
  if(['leads','revenue','ctr','roas','clicks'].includes(metric)) return change;
  return change;
}
export function dailySeries(rows:PerformancePoint[]){
  return [...new Set(rows.map(row=>row.date))].sort().map(date=>({date,...derived(sumRows(rows.filter(row=>row.date===date)))}));
}

export function loadKpiTargets(){
  try {
    const parsed=JSON.parse(localStorage.getItem('adcc-kpi-brands-v1')||'[]');
    if(!Array.isArray(parsed)) return [] as Array<{name:string;goalType:'CPA'|'ROAS';goalTarget:number}>;
    return parsed.filter(item=>item&&item.name&&item.goalType&&Number(item.goalTarget)>0).map(item=>({name:String(item.name),goalType:item.goalType as 'CPA'|'ROAS',goalTarget:Number(item.goalTarget)}));
  } catch { return [] as Array<{name:string;goalType:'CPA'|'ROAS';goalTarget:number}>; }
}

function targetForMedia(advertiser:string, mediaSummary:MediaSummary, targets:ReturnType<typeof loadKpiTargets>){
  const target=targets.find(item=>item.name===advertiser);
  if(!target) return { metric: mediaSummary.revenue>0?'roas' as PerformanceMetric:'cpa' as PerformanceMetric, target:undefined, achievement:undefined };
  if(target.goalType==='CPA') return {metric:'cpa' as PerformanceMetric,target:target.goalTarget,achievement:mediaSummary.cpa>0?target.goalTarget/mediaSummary.cpa*100:0};
  return {metric:'roas' as PerformanceMetric,target:target.goalTarget,achievement:target.goalTarget>0?mediaSummary.roas/target.goalTarget*100:0};
}

export function budgetVerdict(row:Pick<MediaComparisonRow,'spendChange'|'leadChange'|'cpaChange'|'roasChange'|'performanceShare'|'spendShare'>):MediaComparisonRow['budgetVerdict']{
  if(row.spendChange>8 && row.leadChange>row.spendChange+5 && row.cpaChange<=0) return '효율적 확대';
  if(row.performanceShare>row.spendShare*1.2 && row.spendShare<22) return '성장 기회';
  if(row.spendChange>12 && (row.leadChange<0 || row.cpaChange>20 || row.roasChange<-15)) return '비효율 증가';
  if(row.spendChange<-8 && row.leadChange<-15) return '축소 검토';
  if(Math.abs(row.spendChange)<=10 && Math.abs(row.leadChange)<=12) return '안정';
  return '유지';
}

export function buildMediaComparison(data:PerformanceDataset,currentStart:string,currentEnd:string,prevStart:string,prevEnd:string,advertiser='',overrideMetric?:PerformanceMetric){
  const currentAll=data.media.filter(row=>(!advertiser||row.advertiser===advertiser)&&inRange(row.date,currentStart,currentEnd));
  const currentTotal=derived(sumRows(currentAll));
  const targets=loadKpiTargets();
  return MEDIA_ORDER.map(name=>{
    const currentRows=currentAll.filter(row=>normalizeMedia(row.media)===name);
    const previousRows=data.media.filter(row=>(!advertiser||row.advertiser===advertiser)&&normalizeMedia(row.media)===name&&inRange(row.date,prevStart,prevEnd));
    const current=derived(sumRows(currentRows)), previous=derived(sumRows(previousRows));
    const type=currentRows[0]?.reportType;
    const selectedTarget=advertiser?targetForMedia(advertiser,current,targets):{metric:primaryMetric(type),target:undefined,achievement:undefined};
    const primary=overrideMetric ?? selectedTarget.metric;
    const spendShare=currentTotal.spend?current.spend/currentTotal.spend*100:0;
    const perfBase=currentTotal.leads||currentTotal.revenue||currentTotal.clicks;
    const perfValue=currentTotal.leads?current.leads:currentTotal.revenue?current.revenue:current.clicks;
    const performanceShare=perfBase?perfValue/perfBase*100:0;
    const raw={
      name,current,previous,primaryMetric:primary,primaryChange:pctChange(metricValue(current,primary),metricValue(previous,primary)),
      spendChange:pctChange(current.spend,previous.spend),leadChange:pctChange(current.leads,previous.leads),cpaChange:pctChange(current.cpa,previous.cpa),
      roasChange:pctChange(current.roas,previous.roas),ctrChange:pctChange(current.ctr,previous.ctr),spendShare,performanceShare,
      kpiTarget:selectedTarget.target,kpiAchievement:selectedTarget.achievement,healthScore:0,budgetVerdict:'유지' as MediaComparisonRow['budgetVerdict'],
    };
    const efficiency = current.cpa>0 && previous.cpa>0 ? Math.max(-40,Math.min(40,-raw.cpaChange)) : current.roas&&previous.roas?Math.max(-40,Math.min(40,raw.roasChange)):Math.max(-40,Math.min(40,raw.primaryChange));
    const conversion=Math.max(-30,Math.min(30,raw.leadChange));
    const attainment=selectedTarget.achievement===undefined?70:Math.max(0,Math.min(130,selectedTarget.achievement));
    const shareBoost=Math.max(-20,Math.min(20,(performanceShare-spendShare)*2));
    raw.healthScore=Math.round(Math.max(0,Math.min(100,attainment*.4+(50+efficiency)*.25+(50+conversion)*.15+(60+shareBoost)*.2)));
    raw.budgetVerdict=budgetVerdict(raw);
    return raw;
  }).filter(row=>row.current.spend||row.current.clicks||row.current.leads||row.current.revenue);
}

export function detectMediaAnomalies(rows:MediaComparisonRow[]):MediaAnomaly[]{
  const out:MediaAnomaly[]=[];
  rows.forEach(row=>{
    if(row.spendChange>30&&row.leadChange<5) out.push({media:row.name,title:'예산 급증',description:`광고비 +${row.spendChange.toFixed(0)}%인데 DB 변화는 ${row.leadChange.toFixed(0)}%입니다.`,tone:'warning',score:70});
    if(row.current.cpa>0&&row.cpaChange>20) out.push({media:row.name,title:'CPA 급등',description:`CPA가 비교기간보다 ${row.cpaChange.toFixed(0)}% 상승했습니다.`,tone:'danger',score:Math.min(100,60+row.cpaChange/2)});
    if(row.current.roas>0&&row.roasChange<-20) out.push({media:row.name,title:'ROAS 하락',description:`ROAS가 ${Math.abs(row.roasChange).toFixed(0)}% 하락했습니다.`,tone:'danger',score:Math.min(100,60+Math.abs(row.roasChange)/2)});
    if(row.current.ctr>0&&row.ctrChange<-20) out.push({media:row.name,title:'CTR 하락',description:`CTR이 ${Math.abs(row.ctrChange).toFixed(0)}% 하락했습니다.`,tone:'warning',score:55});
  });
  return out.sort((a,b)=>b.score-a.score).slice(0,8);
}

export function buildFunnel(summary:MediaSummary, reportType?:string){
  const ctr=summary.impressions?summary.clicks/summary.impressions*100:0;
  if(reportType==='lead'||summary.leads>0) return [
    {label:'노출',value:summary.impressions,rate:undefined},
    {label:'클릭',value:summary.clicks,rate:ctr},
    {label:'DB',value:summary.leads,rate:summary.clicks?summary.leads/summary.clicks*100:0},
  ];
  return [
    {label:'노출',value:summary.impressions,rate:undefined},
    {label:'클릭',value:summary.clicks,rate:ctr},
    {label:'전환',value:summary.leads,rate:summary.clicks?summary.leads/summary.clicks*100:0},
  ];
}

export function normalizeCampaignMedia(platform:string){
  if(platform==='instagram'||platform==='meta') return '메타';
  if(platform==='naver') return '네이버';
  if(platform==='google') return '구글 검색';
  if(platform==='youtube') return '유튜브';
  if(platform==='karrot') return '당근';
  if(platform==='kakao') return '카카오';
  if(platform==='tiktok') return '틱톡';
  return normalizeMedia(platform);
}
