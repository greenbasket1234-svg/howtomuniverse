import type { ExternalCreativeObservation, TrendCategory, TrendSignal } from './externalTypes';

const DAY=86_400_000;
const pct=(a:number,b:number)=>b?((a-b)/b)*100:undefined;
const counts=(values:string[])=>{const m=new Map<string,number>();values.filter(Boolean).forEach(v=>m.set(v,(m.get(v)||0)+1));return m;};
const valuesFor=(row:ExternalCreativeObservation,category:TrendCategory)=>{
  if(category==='hook')return row.hookTypes;
  if(category==='cta')return row.cta?[row.cta]:[];
  if(category==='format')return [row.creativeType];
  if(category==='message')return row.tags.filter(x=>/가격|혜택|후기|한정|문제|비교|정보|전문|무료|상담|이벤트/.test(x));
  return row.tags.filter(x=>!/가격|혜택|후기|한정|문제|비교|정보|전문|무료|상담|이벤트/.test(x));
};
const confidence=(sample:number,coverage:number)=>{
  const score=Math.min(100,Math.round(sample*2.5+coverage*7));
  return {score,label:(score>=70?'높음':score>=40?'보통':'낮음') as TrendSignal['confidenceLabel']};
};

export function buildTrendSignals(rows:ExternalCreativeObservation[],days=30,nowDate?:Date):TrendSignal[]{
  if(!rows.length)return[];
  const captured=rows.map(x=>+new Date(x.capturedAt)).filter(Number.isFinite).sort((a,b)=>a-b);
  const maxCaptured=captured[captured.length-1];
  const now=nowDate?+nowDate:(maxCaptured||Date.now());
  const currentStart=now-(days-1)*DAY, previousStart=currentStart-days*DAY;
  const current=rows.filter(x=>{const t=+new Date(x.capturedAt);return t>=currentStart&&t<=now+DAY;});
  const previous=rows.filter(x=>{const t=+new Date(x.capturedAt);return t>=previousStart&&t<currentStart;});
  const categories:TrendCategory[]=['hook','cta','format','message','visual'];
  const out:TrendSignal[]=[];
  categories.forEach(category=>{
    const cur=counts(current.flatMap(x=>valuesFor(x,category))), prev=counts(previous.flatMap(x=>valuesFor(x,category)));
    const keys=new Set([...cur.keys(),...prev.keys()]);
    keys.forEach(value=>{
      const currentCount=cur.get(value)||0,previousCount=prev.get(value)||0;
      const currentTotal=[...cur.values()].reduce((a,b)=>a+b,0),previousTotal=[...prev.values()].reduce((a,b)=>a+b,0);
      const sampleSize=current.filter(x=>valuesFor(x,category).includes(value)).length;
      const competitorCoverage=new Set(current.filter(x=>valuesFor(x,category).includes(value)).map(x=>x.competitorId)).size;
      const cf=confidence(sampleSize,competitorCoverage);
      const growthRate=pct(currentCount,previousCount);
      let status:TrendSignal['status']='insufficient';
      if(previous.length&&sampleSize>=3&&competitorCoverage>=2){
        if(previousCount===0&&currentCount>=3)status='emerging';
        else if((growthRate??0)>=20)status='rising';
        else if((growthRate??0)<=-20)status='declining';
        else status='stable';
      }
      out.push({trendId:`${category}:${value}`,category,value,currentCount,previousCount,currentShare:currentTotal?currentCount/currentTotal*100:0,previousShare:previousTotal?previousCount/previousTotal*100:0,growthRate,competitorCoverage,sampleSize,confidenceScore:cf.score,confidenceLabel:cf.label,status});
    });
  });
  return out.sort((a,b)=>{
    const rank=(x:TrendSignal)=>x.status==='emerging'?4:x.status==='rising'?3:x.status==='stable'?2:x.status==='declining'?1:0;
    return rank(b)-rank(a)||b.currentCount-a.currentCount;
  });
}
