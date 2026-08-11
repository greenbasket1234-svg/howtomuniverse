import type { Competitor, ExternalCreativeObservation } from './externalTypes';

const countBy=(values:string[])=>{
  const map=new Map<string,number>(); values.filter(Boolean).forEach(v=>map.set(v,(map.get(v)||0)+1));
  return [...map.entries()].sort((a,b)=>b[1]-a[1]);
};

export function summarizeCompetitor(competitor:Competitor, observations:ExternalCreativeObservation[]){
  const rows=observations.filter(x=>x.competitorId===competitor.competitorId);
  return {
    competitor,
    observationCount:rows.length,
    platforms:countBy(rows.map(x=>x.platform)),
    creativeTypes:countBy(rows.map(x=>x.creativeType)),
    hooks:countBy(rows.flatMap(x=>x.hookTypes)),
    ctas:countBy(rows.map(x=>x.cta||'').filter(Boolean)),
    latest:(()=>{const dates=rows.map(x=>x.capturedAt).sort();return dates[dates.length-1];})(),
  };
}

export function externalPatternSummary(observations:ExternalCreativeObservation[]){
  return {
    hooks:countBy(observations.flatMap(x=>x.hookTypes)),
    ctas:countBy(observations.map(x=>x.cta||'').filter(Boolean)),
    formats:countBy(observations.map(x=>x.creativeType)),
    platforms:countBy(observations.map(x=>x.platform)),
    tags:countBy(observations.flatMap(x=>x.tags)),
  };
}
