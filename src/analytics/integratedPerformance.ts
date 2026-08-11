import { getMonthDays, loadAllGeneratedReports, type GeneratedReport, type MetricKey, type ReportRow, type ReportType } from '../features/reports/reportCore';
import { BRAND_REPORTS } from '../data/brandReports';
import { loadDbRows } from '../utils/dbDataStore';

export type PerformanceMetric = 'spend'|'impressions'|'clicks'|'leads'|'revenue'|'ctr'|'cpa'|'roas';
export type PerformancePoint = { date:string; advertiser:string; reportType:ReportType; media:string; spend:number; impressions:number; clicks:number; leads:number; revenue:number; validLeads?:number; contracts?:number; platformLeads?:number; dbSource?:'google-sheets' };
export type PerformanceDataset = { totals: PerformancePoint[]; media: PerformancePoint[]; advertisers:string[]; medias:string[]; latestDate:string };

const rawMetrics: MetricKey[] = ['spend','impressions','clicks','leads','revenue'];
const reportTypeRank: Record<ReportType,number> = { lead:0,revenue:0,click:0,integrated:1,reach:2,custom:3 };
const mediaMap: Record<string,string> = {
  facebook:'메타', meta:'메타', instagram:'메타', '메타':'메타',
  naver:'네이버', gfa:'네이버', 'GFA':'네이버', '네이버':'네이버',
  google:'구글 검색', google_sa:'구글 검색', '구글':'구글 검색', '구글 SA':'구글 검색',
  youtube:'유튜브', YouTube:'유튜브', '유튜브':'유튜브',
  danggeun:'당근', karrot:'당근', '당근':'당근',
  kakao:'카카오', kakao_keyword:'카카오', kakao_moment:'카카오', kakao_plus_friend:'카카오', kakao_channel_add:'카카오', '카카오':'카카오',
  tiktok:'틱톡', '틱톡':'틱톡',
};
export function normalizeMedia(value:string){ return mediaMap[value] ?? value; }

function valueAt(rows:ReportRow[], metric:MetricKey, index:number, platform?:string){
  const candidates = rows.filter(r => r.metric===metric && (platform ? r.platform===platform : !r.platform));
  const preferred = candidates.find(r=>r.emphasis) ?? candidates[0];
  return Number(preferred?.values?.[index] ?? 0) || 0;
}

function preferredReports(reports:GeneratedReport[]){
  const map = new Map<string,GeneratedReport>();
  reports.forEach(r=>{
    if(!r.rows?.length) return;
    const key=`${r.advertiserName}|${r.month}`;
    const prev=map.get(key);
    if(!prev){ map.set(key,r); return; }
    const src=(r.isSample||r.source==='sample')?1:0, prevSrc=(prev.isSample||prev.source==='sample')?1:0;
    const score=src*10+reportTypeRank[r.reportType], prevScore=prevSrc*10+reportTypeRank[prev.reportType];
    if(score<prevScore || (score===prevScore && r.createdAt>prev.createdAt)) map.set(key,r);
  });
  return [...map.values()];
}

function fromGenerated():PerformanceDataset|null{
  const reports=preferredReports(loadAllGeneratedReports());
  if(!reports.length) return null;
  const totals:PerformancePoint[]=[]; const media:PerformancePoint[]=[];
  reports.forEach(report=>{
    const rows=report.rows ?? []; const days=getMonthDays(report.month); const visible=report.visibleDayIndexes ?? days.map((_,i)=>i);
    const platforms=[...new Set(rows.map(r=>r.platform).filter((v):v is string=>Boolean(v)))];
    visible.forEach(i=>{
      const date=`${report.month}-${String(i+1).padStart(2,'0')}`;
      totals.push({date,advertiser:report.advertiserName,reportType:report.reportType,media:'전체',spend:valueAt(rows,'spend',i),impressions:valueAt(rows,'impressions',i),clicks:valueAt(rows,'clicks',i),leads:valueAt(rows,'leads',i),revenue:valueAt(rows,'revenue',i)});
      platforms.forEach(platform=> media.push({date,advertiser:report.advertiserName,reportType:report.reportType,media:normalizeMedia(platform),spend:valueAt(rows,'spend',i,platform),impressions:valueAt(rows,'impressions',i,platform),clicks:valueAt(rows,'clicks',i,platform),leads:valueAt(rows,'leads',i,platform),revenue:valueAt(rows,'revenue',i,platform)}));
    });
  });
  const dates=totals.map(r=>r.date).sort();
  return {totals,media,advertisers:[...new Set(totals.map(r=>r.advertiser))].sort((a,b)=>a.localeCompare(b,'ko')),medias:[...new Set(media.map(r=>r.media))].sort((a,b)=>a.localeCompare(b,'ko')),latestDate:dates[dates.length-1]??''};
}

function fromBrandReports():PerformanceDataset{
  const totals:PerformancePoint[]=[]; const media:PerformancePoint[]=[];
  BRAND_REPORTS.forEach(report=>{
    const type:ReportType=report.config.rowGroups.some(g=>g.metric==='db_count')?'lead':report.config.rowGroups.some(g=>g.metric==='revenue')?'revenue':'click';
    const dates=[...new Set(Object.values(report.data).flatMap(v=>Object.keys(v)))].sort();
    dates.forEach(date=>{
      const t={spend:0,impressions:0,clicks:0,leads:0,revenue:0};
      Object.entries(report.data).forEach(([platform,byDate])=>{
        const f=byDate[date]??{}; const row={date,advertiser:report.config.brandName,reportType:type,media:normalizeMedia(platform),spend:Number(f.spend)||0,impressions:Number(f.impressions)||0,clicks:Number(f.clicks)||0,leads:Number(f.dbCount)||0,revenue:Number(f.revenue)||0};
        media.push(row); t.spend+=row.spend;t.impressions+=row.impressions;t.clicks+=row.clicks;t.leads+=row.leads;t.revenue+=row.revenue;
      });
      totals.push({date,advertiser:report.config.brandName,reportType:type,media:'전체',...t});
    });
  });
  const dates=totals.map(r=>r.date).sort(); return {totals,media,advertisers:[...new Set(totals.map(r=>r.advertiser))],medias:[...new Set(media.map(r=>r.media))],latestDate:dates[dates.length-1]??''};
}

function applyGoogleSheetDb(dataset:PerformanceDataset):PerformanceDataset {
  const dbRows=loadDbRows();
  if(!dbRows.length) return dataset;
  const grouped=new Map<string,{db:number;validDb:number;contracts:number;spend:number;revenue:number}>();
  dbRows.forEach(row=>{
    const media=normalizeMedia(row.media); const key=`${row.date}|${row.advertiser}|${media}`;
    const current=grouped.get(key)??{db:0,validDb:0,contracts:0,spend:0,revenue:0};
    current.db+=Number(row.db)||0; current.validDb+=Number(row.validDb)||0; current.contracts+=Number(row.contracts)||0; current.spend+=Number(row.spend)||0; current.revenue+=Number(row.revenue)||0; grouped.set(key,current);
  });
  const seen=new Set<string>();
  const media=dataset.media.map(row=>{
    const key=`${row.date}|${row.advertiser}|${normalizeMedia(row.media)}`; const db=grouped.get(key);
    if(!db) return row; seen.add(key);
    return {...row,media:normalizeMedia(row.media),reportType:'lead' as ReportType,platformLeads:row.leads,leads:db.db,validLeads:db.validDb,contracts:db.contracts,spend:row.spend||db.spend,revenue:row.revenue||db.revenue,dbSource:'google-sheets' as const};
  });
  grouped.forEach((db,key)=>{
    if(seen.has(key)) return;
    const [date,advertiser,mediaName]=key.split('|');
    media.push({date,advertiser,reportType:'lead',media:mediaName,spend:db.spend,impressions:0,clicks:0,leads:db.db,revenue:db.revenue,validLeads:db.validDb,contracts:db.contracts,platformLeads:0,dbSource:'google-sheets'});
  });
  const totalsMap=new Map<string,PerformancePoint>();
  media.forEach(row=>{
    const key=`${row.date}|${row.advertiser}`; const current=totalsMap.get(key)??{date:row.date,advertiser:row.advertiser,reportType:row.reportType,media:'전체',spend:0,impressions:0,clicks:0,leads:0,revenue:0,validLeads:0,contracts:0,platformLeads:0};
    current.spend+=row.spend;current.impressions+=row.impressions;current.clicks+=row.clicks;current.leads+=row.leads;current.revenue+=row.revenue;current.validLeads=(current.validLeads??0)+(row.validLeads??0);current.contracts=(current.contracts??0)+(row.contracts??0);current.platformLeads=(current.platformLeads??0)+(row.platformLeads??row.leads);
    if(row.dbSource==='google-sheets'){current.reportType='lead';current.dbSource='google-sheets';}
    totalsMap.set(key,current);
  });
  const totals=[...totalsMap.values()]; const dates=totals.map(row=>row.date).sort();
  return {totals,media,advertisers:[...new Set(totals.map(row=>row.advertiser))].sort((a,b)=>a.localeCompare(b,'ko')),medias:[...new Set(media.map(row=>row.media))].sort((a,b)=>a.localeCompare(b,'ko')),latestDate:dates[dates.length-1]??dataset.latestDate};
}

export function loadPerformanceDataset(){ return applyGoogleSheetDb(fromGenerated() ?? fromBrandReports()); }
export function sumRows(rows:PerformancePoint[]){ return rows.reduce((a,r)=>({spend:a.spend+r.spend,impressions:a.impressions+r.impressions,clicks:a.clicks+r.clicks,leads:a.leads+r.leads,revenue:a.revenue+r.revenue,validLeads:a.validLeads+(r.validLeads??0),contracts:a.contracts+(r.contracts??0),platformLeads:a.platformLeads+(r.platformLeads??r.leads)}),{spend:0,impressions:0,clicks:0,leads:0,revenue:0,validLeads:0,contracts:0,platformLeads:0}); }
export function derived(t:ReturnType<typeof sumRows>){ return {...t,ctr:t.impressions?t.clicks/t.impressions*100:0,cpa:t.leads?t.spend/t.leads:0,roas:t.spend?t.revenue/t.spend*100:0}; }
export function pctChange(now:number,prev:number){ return prev ? (now-prev)/Math.abs(prev)*100 : now ? 100 : 0; }
export function metricValue(t:ReturnType<typeof derived>,metric:PerformanceMetric){ return Number(t[metric]??0); }
export function formatMetric(metric:PerformanceMetric,value:number){ if(metric==='spend'||metric==='revenue'||metric==='cpa') return value?`₩${Math.round(value).toLocaleString()}`:'-'; if(metric==='ctr'||metric==='roas') return `${value.toFixed(value>=100?0:2)}%`; return Math.round(value).toLocaleString(); }
