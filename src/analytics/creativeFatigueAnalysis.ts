import type { CreativeAnalysisRow, CreativeLifecycle } from './creativeAnalysis';

export type CreativeFatigueSummary = {
  score?: number;
  level: '낮음'|'보통'|'높음'|'매우 높음'|'평가 보류';
  lifecycle: CreativeLifecycle;
  reasons: string[];
};

export function calculateCreativeFatigue(row:CreativeAnalysisRow):CreativeFatigueSummary{
  const score=row.fatigueScore;
  if(score===undefined) return {score,level:'평가 보류',lifecycle:row.lifecycle,reasons:['기간별 소재 성과 데이터가 부족합니다.']};
  const reasons:string[]=[];
  if(row.performance){
    const trend=row.performance.trend;
    if(trend.length>=4){
      const half=Math.floor(trend.length/2), early=trend.slice(0,half).reduce((a,b)=>a+b,0)/half, recent=trend.slice(-half).reduce((a,b)=>a+b,0)/half;
      if(early>recent*1.15) reasons.push('초기 구간 대비 최근 성과 추이 지수가 하락했습니다.');
    }
    if(row.performance.days>=21) reasons.push(`집행 기간이 ${row.performance.days}일로 장기화되었습니다.`);
    if((row.performance.frequency??0)>=3) reasons.push('노출 빈도가 높아 반복 노출 피로 가능성이 있습니다.');
  }
  if(row.fatigueLevel==='교체 권장') reasons.push('소재 관리에서 교체 권장 상태로 분류되어 있습니다.');
  if(row.fatigueLevel==='주의') reasons.push('소재 관리에서 피로도 주의 상태로 분류되어 있습니다.');
  const level=score>=82?'매우 높음':score>=60?'높음':score>=35?'보통':'낮음';
  return {score,level,lifecycle:row.lifecycle,reasons:reasons.length?reasons:['현재 연결 데이터에서 뚜렷한 피로 신호가 없습니다.']};
}

export function classifyCreativeLifecycle(row:CreativeAnalysisRow){ return calculateCreativeFatigue(row).lifecycle; }
