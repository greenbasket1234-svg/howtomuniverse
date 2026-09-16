import type { CampaignMetricRow, CreativeMetricRow, KeywordMetricRow } from '../../types/metrics';
import type { Recommendation, RecommendationSummary, RecommendationType } from './recommendationTypes';

function confidence(sample:number):Recommendation['confidence']{
  if(sample>=30)return{level:'high',label:'신뢰도 높음',reason:'충분한 클릭/전환 표본',sampleNote:`표본 ${sample.toLocaleString()}`};
  if(sample>=10)return{level:'medium',label:'신뢰도 보통',reason:'일정 수준의 표본',sampleNote:`표본 ${sample.toLocaleString()}`};
  return{level:'low',label:'데이터 부족',reason:'표본 부족',sampleNote:`표본 ${sample.toLocaleString()}`};
}
function priority(score:number):Recommendation['priorityLabel']{return score>=85?'긴급':score>=65?'높음':score>=40?'보통':'낮음'}
function rec(base:Omit<Recommendation,'priorityLabel'|'confidence'|'insufficientData'|'signalIds'|'createdAt'>,sample:number):Recommendation{
  const c=confidence(sample);return{...base,priorityLabel:priority(base.priorityScore),confidence:c,insufficientData:c.level==='low',signalIds:[],createdAt:new Date().toISOString().slice(0,10)};
}
/** 예전엔 DB(리드) 전환만 봐서, 구매(이커머스) 전환 위주인 캠페인·소재·키워드가 전부
 * "전환 없음"으로 잘못 판정되던 문제가 있었습니다. 총 전환(DB+구매+미확인) 기준으로 봅니다. */
function totalConv(row:{dbCount:number;purchases?:number;unconfirmed?:number}){return row.dbCount+(row.purchases||0)+(row.unconfirmed||0);}
function metricEvidence(row:{spend:number;impressions:number;clicks:number;dbCount:number;purchases?:number;unconfirmed?:number;addToCart?:number;completeRegistration?:number;revenue:number;ctr?:number;cpa?:number;roas?:number}){
  const conv=totalConv(row);
  // 서버가 이 목록 API(캠페인/소재/키워드)에서는 cpa·cvr을 채워주지 않으므로, 있는
  // 값(광고비·클릭·전환)으로 여기서 직접 계산합니다(roas는 서버 값을 그대로 씁니다).
  const cpa=conv?row.spend/conv:0;
  const cvr=row.clicks?conv/row.clicks*100:0;
  const items=[
    {label:'광고비',detail:`₩${Math.round(row.spend).toLocaleString()}`},
    {label:'CTR',detail:`${(row.ctr||0).toFixed(2)}%`},
    {label:'DB 전환',detail:`${row.dbCount.toLocaleString()}건`},
    {label:'구매 전환',detail:`${(row.purchases||0).toLocaleString()}건`},
  ];
  // 미확인 전환(당일 등 세부 분류가 아직 안 된 전환)이 있으면 함께 보여줍니다 - 이게 0이
  // 아닌데 화면에 안 보이면 "전환이 있는데 0건으로 나온다"는 오해를 살 수 있습니다.
  if((row.unconfirmed||0)>0) items.push({label:'미확인 전환',detail:`${(row.unconfirmed||0).toLocaleString()}건`});
  if((row.addToCart||0)>0) items.push({label:'장바구니 담기',detail:`${(row.addToCart||0).toLocaleString()}건`});
  if((row.completeRegistration||0)>0) items.push({label:'회원가입',detail:`${(row.completeRegistration||0).toLocaleString()}건`});
  items.push(
    {label:'CVR',detail:row.clicks?`${cvr.toFixed(2)}%`:'-'},
    {label:'CPA',detail:conv?`₩${Math.round(cpa).toLocaleString()}`:'-'},
    {label:'ROAS',detail:row.revenue?`${(row.roas||0).toFixed(1)}%`:'-'},
  );
  return items;
}
function makeActualRecommendation(row:CampaignMetricRow|CreativeMetricRow|KeywordMetricRow,type:RecommendationType,score:number,title:string,summary:string,targetType:'campaign'|'creative'|'keyword',targetId:string,targetLabel:string,to:string):Recommendation{
  const conv=totalConv(row);
  return rec({recommendationId:`live:${targetType}:${row.advertiserId}:${row.channel}:${encodeURIComponent(targetId)}`,advertiserName:row.advertiserName||row.advertiserId,targetType,targetId,targetLabel,mediaName:row.channel,type,title,summary,priorityScore:score,metrics:metricEvidence(row),evidence:[`실제 ${targetType} 일별 성과 집계 기준`,`광고비 ${Math.round(row.spend).toLocaleString()}원 · 클릭 ${row.clicks.toLocaleString()} · 전환 ${conv.toLocaleString()}`],suggestedActions:[{label:'관련 성과 보기',to}]},Math.max(row.clicks,conv));
}

export function buildLiveRecommendations(campaigns:CampaignMetricRow[],creatives:CreativeMetricRow[],keywords:KeywordMetricRow[]):Recommendation[]{
  const out:Recommendation[]=[];
  for(const row of campaigns){
    const conv=totalConv(row);
    if(row.spend>0&&row.clicks>=10&&conv===0)out.push(makeActualRecommendation(row,'review_campaign',78,'전환 없는 캠페인 점검','광고비와 클릭이 발생했지만 선택 기간 전환이 없습니다. 랜딩·타깃·전환 추적을 점검하세요.','campaign',row.campaignId,row.campaignName,'/insights/campaigns'));
    else if(row.revenue>0&&(row.roas||0)<100&&row.spend>=100000)out.push(makeActualRecommendation(row,'decrease_budget',72,'낮은 ROAS 캠페인 점검','선택 기간 ROAS가 100% 미만입니다. 수익성과 전환 품질을 확인한 뒤 예산 조정을 검토하세요.','campaign',row.campaignId,row.campaignName,'/insights/campaigns'));
    else if((row.roas||0)>=300&&conv>=3)out.push(makeActualRecommendation(row,'increase_budget',58,'확대 후보 캠페인','실제 전환과 ROAS가 양호합니다. 예산 확대 전 최근 추세와 재고·운영 여력을 함께 확인하세요.','campaign',row.campaignId,row.campaignName,'/insights/campaigns'));
  }
  for(const row of creatives){
    const conv=totalConv(row);
    if(row.impressions>=1000&&(row.ctr||0)<0.5)out.push(makeActualRecommendation(row,'replace_creative',70,'낮은 CTR 소재 교체 검토','충분한 노출 대비 클릭률이 낮습니다. 후킹·첫 화면·카피 변형 테스트를 검토하세요.','creative',row.adId,row.adName,'/insights/creatives'));
    else if(row.spend>0&&row.clicks>=10&&conv===0)out.push(makeActualRecommendation(row,'replace_creative',68,'전환 없는 소재 점검','클릭은 발생하지만 전환이 없습니다. 소재 메시지와 랜딩페이지 일치 여부를 확인하세요.','creative',row.adId,row.adName,'/insights/creatives'));
  }
  for(const row of keywords){
    const conv=totalConv(row);
    if(row.spend>0&&row.clicks>=10&&conv===0)out.push(makeActualRecommendation(row,'adjust_keyword',72,'비용 낭비 키워드 점검','실제 클릭과 광고비가 발생했지만 전환이 없습니다. 검색어 의도와 제외키워드를 확인하세요.','keyword',row.keywordId||row.keyword,row.keyword,'/keywords'));
  }
  return out.sort((a,b)=>b.priorityScore-a.priorityScore).slice(0,100);
}
export function summarizeLiveRecommendations(rows:Recommendation[]):RecommendationSummary{return{urgent:rows.filter(r=>r.priorityLabel==='긴급').length,needsImprovement:rows.filter(r=>['review_campaign','decrease_budget','replace_creative','adjust_keyword'].includes(r.type)).length,expansionCandidate:rows.filter(r=>r.type==='increase_budget').length,monitoring:rows.filter(r=>r.type==='monitor').length,insufficientData:rows.filter(r=>r.insufficientData).length}}
