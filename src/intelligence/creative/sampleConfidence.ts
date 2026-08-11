export type SampleConfidence = { score:number; level:'insufficient'|'low'|'medium'|'high'; label:'데이터 부족'|'낮음'|'보통'|'높음'; reasons:string[] };
export function sampleConfidence(input:{creativeCount:number;spend:number;clicks:number;db:number;advertiserCount:number;campaignCount:number}):SampleConfidence{
  const {creativeCount,spend,clicks,db,advertiserCount,campaignCount}=input;
  let score=0; const reasons:string[]=[];
  score+=Math.min(30,creativeCount*4); score+=Math.min(20,spend/50_000*4); score+=Math.min(18,clicks/100*6); score+=Math.min(18,db*2); score+=Math.min(7,advertiserCount*3.5); score+=Math.min(7,campaignCount*2.5);
  score=Math.round(Math.min(100,score));
  if(creativeCount<3){reasons.push('소재 3개 미만');return{score,level:'insufficient',label:'데이터 부족',reasons};}
  if(db===0&&clicks<50)reasons.push('전환/클릭 표본이 적음');
  if(advertiserCount<=1)reasons.push('단일 광고주 중심 표본');
  if(campaignCount<=1)reasons.push('단일 캠페인 중심 표본');
  const level=score>=72?'high':score>=46?'medium':score>=26?'low':'insufficient';
  const label=level==='high'?'높음':level==='medium'?'보통':level==='low'?'낮음':'데이터 부족';
  return {score,level,label,reasons};
}
