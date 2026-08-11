import type { CreativeAnalysisRow } from '../../analytics/creativeAnalysis';
import { sampleConfidence, type SampleConfidence } from './sampleConfidence';
import { standardizeCta, standardizeHook } from './taxonomy';

export type HookCtaKind='hook'|'cta'|'pair';
export type HookCtaAggregate={
  key:string; kind:HookCtaKind; label:string; hook?:string; cta?:string; creativeIds:string[]; count:number; spend:number; impressions:number; clicks:number; db:number; validDb:number; contracts:number; revenue:number; ctr:number; cpa:number; validDbRate:number; contractRate:number; roas:number; avgScore?:number; advertiserCount:number;mediaCount:number;campaignCount:number;confidence:SampleConfidence;reliability:number;
};
const sum=(rows:CreativeAnalysisRow[],pick:(r:CreativeAnalysisRow)=>number)=>rows.reduce((a,r)=>a+(Number(pick(r))||0),0);
function aggregate(kind:HookCtaKind,label:string,rows:CreativeAnalysisRow[],hook?:string,cta?:string):HookCtaAggregate{
  const spend=sum(rows,r=>r.spend),impressions=sum(rows,r=>r.impressions),clicks=sum(rows,r=>r.clicks),db=sum(rows,r=>r.db),validDb=sum(rows,r=>r.validDb),contracts=sum(rows,r=>r.contracts),revenue=sum(rows,r=>r.revenue);
  const scored=rows.filter(r=>r.score!==undefined); const avgScore=scored.length?scored.reduce((a,r)=>a+r.score!,0)/scored.length:undefined;
  const advertiserCount=new Set(rows.map(r=>r.creative.brand)).size,mediaCount=new Set(rows.map(r=>r.creative.platform)).size,campaignCount=new Set(rows.map(r=>r.campaignName)).size;
  const confidence=sampleConfidence({creativeCount:rows.length,spend,clicks,db,advertiserCount,campaignCount});
  const reliability=Math.min(100,Math.round(confidence.score*.7+Math.min(30,(advertiserCount-1)*8+(mediaCount-1)*5+(campaignCount-1)*3)));
  return {key:`${kind}:${label}`,kind,label,hook,cta,creativeIds:rows.map(r=>r.creative.id),count:rows.length,spend,impressions,clicks,db,validDb,contracts,revenue,ctr:impressions?clicks/impressions*100:0,cpa:db?spend/db:0,validDbRate:db?validDb/db*100:0,contractRate:(validDb||db)?contracts/(validDb||db)*100:0,roas:spend?revenue/spend*100:0,avgScore,advertiserCount,mediaCount,campaignCount,confidence,reliability};
}
function groups(rows:CreativeAnalysisRow[],kind:'hook'|'cta'){
  const m=new Map<string,CreativeAnalysisRow[]>();
  rows.forEach(row=>{
    const keys=kind==='hook'?[...new Set(row.hookTypes.map(standardizeHook))]:[standardizeCta(row.cta)];
    keys.forEach(key=>m.set(key,[...(m.get(key)||[]),row]));
  });
  return [...m.entries()].map(([label,items])=>aggregate(kind,label,items,kind==='hook'?label:undefined,kind==='cta'?label:undefined));
}
export function analyzeHookCta(rows:CreativeAnalysisRow[]){
  const eligible=rows.filter(r=>r.hasPerformance||r.hasDb);
  const hooks=groups(eligible,'hook').sort(rank); const ctas=groups(eligible,'cta').sort(rank);
  const pairs=new Map<string,CreativeAnalysisRow[]>();
  eligible.forEach(row=>[...new Set(row.hookTypes.map(standardizeHook))].forEach(h=>{const c=standardizeCta(row.cta),key=`${h} × ${c}`;pairs.set(key,[...(pairs.get(key)||[]),row]);}));
  const matrix=[...pairs.entries()].map(([label,items])=>{const [hook,cta]=label.split(' × ');return aggregate('pair',label,items,hook,cta)}).sort(rank);
  return {eligible,hooks,ctas,matrix};
}
function rank(a:HookCtaAggregate,b:HookCtaAggregate){
  const ar=(a.avgScore??0)+(a.confidence.score*.25),br=(b.avgScore??0)+(b.confidence.score*.25); return br-ar||b.count-a.count;
}
