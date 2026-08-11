import type { CreativeAnalysisRow, CreativeHookType } from './creativeAnalysis';

export type CreativePattern = {
  key: string;
  label: string;
  kind: '후킹'|'CTA'|'소재 유형'|'태그';
  count: number;
  avgCtr: number;
  avgCpa: number;
  avgValidDbRate: number;
  avgScore: number;
  confidence: '판단 보류'|'참고'|'보통'|'높음';
  direction: '우수'|'개선 필요'|'중립';
};

const avg=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
export function patternConfidence(count:number):CreativePattern['confidence']{ return count<=2?'판단 보류':count<=5?'참고':count<=10?'보통':'높음'; }

function build(kind:CreativePattern['kind'], groups:Map<string,CreativeAnalysisRow[]>, overallScore:number):CreativePattern[]{
  return [...groups.entries()].map(([label,rows])=>{
    const scored=rows.filter(r=>r.score!==undefined), score=avg(scored.map(r=>r.score!));
    const avgCpa=avg(rows.filter(r=>r.cpa>0).map(r=>r.cpa));
    const avgCtr=avg(rows.filter(r=>r.impressions>0).map(r=>r.ctr));
    const avgValidDbRate=avg(rows.filter(r=>r.db>0).map(r=>r.validDbRate));
    const direction:CreativePattern['direction']=score>=overallScore+7?'우수':score>0&&score<=overallScore-7?'개선 필요':'중립';
    return {key:`${kind}:${label}`,label,kind,count:rows.length,avgCtr,avgCpa,avgValidDbRate,avgScore:score,confidence:patternConfidence(rows.length),direction};
  }).sort((a,b)=>b.avgScore-a.avgScore||b.count-a.count);
}

export function analyzeCreativePatterns(rows:CreativeAnalysisRow[]){
  const eligible=rows.filter(row=>row.hasPerformance||row.hasDb);
  const overallScore=avg(eligible.filter(r=>r.score!==undefined).map(r=>r.score!));
  const hook=new Map<string,CreativeAnalysisRow[]>(), cta=new Map<string,CreativeAnalysisRow[]>(), type=new Map<string,CreativeAnalysisRow[]>(), tags=new Map<string,CreativeAnalysisRow[]>();
  const add=(map:Map<string,CreativeAnalysisRow[]>,key:string,row:CreativeAnalysisRow)=>map.set(key,[...(map.get(key)||[]),row]);
  eligible.forEach(row=>{
    row.hookTypes.forEach((value:CreativeHookType)=>add(hook,value,row));
    add(cta,row.cta,row); add(type,row.creative.type,row);
    [...row.creative.tags,...(row.creative.visualTags||[]),...(row.creative.videoStyleTags||[])].forEach(tag=>add(tags,tag,row));
  });
  const all=[...build('후킹',hook,overallScore),...build('CTA',cta,overallScore),...build('소재 유형',type,overallScore),...build('태그',tags,overallScore)];
  return {overallScore,patterns:all,winning:all.filter(p=>p.direction==='우수'&&p.confidence!=='판단 보류').slice(0,8),weak:all.filter(p=>p.direction==='개선 필요'&&p.confidence!=='판단 보류').slice(0,8)};
}
