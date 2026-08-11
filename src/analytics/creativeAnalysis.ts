import { CREATIVE_LIBRARY, type Creative } from '../data/creativeLibrary';
import { CREATIVE_PERFORMANCE_SAMPLE, type CreativePerformanceSampleRow } from '../data/creativePerformance';
import { loadDbRows, type DbDataRow } from '../utils/dbDataStore';

export type CreativeLifecycle = '신규'|'성장'|'안정'|'피로'|'교체 권장'|'데이터 부족';
export type CreativeAnalysisStatus = '매우 우수'|'우수'|'정상'|'주의'|'개선 필요'|'평가 보류';
export type CreativeHookType = '가격'|'할인'|'한정'|'희소성'|'질문'|'문제제기'|'후기'|'공감'|'정보'|'비교'|'결과'|'숫자'|'혜택'|'불안'|'미분류';

export type CreativeAnalysisRow = {
  creative: Creative;
  performance?: CreativePerformanceSampleRow;
  dbRows: DbDataRow[];
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  db: number;
  validDb: number;
  contracts: number;
  revenue: number;
  cvr: number;
  cpa: number;
  validDbRate: number;
  contractRate: number;
  roas: number;
  hookTypes: CreativeHookType[];
  cta: string;
  fatigueScore?: number;
  fatigueLevel: Creative['fatigue'];
  lifecycle: CreativeLifecycle;
  score?: number;
  analysisStatus: CreativeAnalysisStatus;
  kpiLabel: string;
  kpiAchievement?: number;
  peerKey: string;
  peerCount: number;
  peerCtr?: number;
  peerCpa?: number;
  peerValidRate?: number;
  hasPerformance: boolean;
  hasDb: boolean;
  dataNotes: string[];
};

const mediaAliases: Record<string,string> = {
  meta:'메타', facebook:'메타', instagram:'메타', '메타':'메타',
  naver:'네이버', '네이버':'네이버',
  google:'구글 검색', '구글':'구글 검색', '구글 검색':'구글 검색',
  youtube:'유튜브', '유튜브':'유튜브',
  danggeun:'당근', karrot:'당근', '당근':'당근',
  kakao:'카카오', '카카오':'카카오',
  tiktok:'틱톡', '틱톡':'틱톡',
};
export function normalizeCreativeMedia(value:string){ return mediaAliases[value.toLowerCase()] ?? mediaAliases[value] ?? value; }

function normalizeText(value:string){ return value.toLowerCase().replace(/\s+/g,''); }
function avg(values:number[]){ return values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0; }
function clamp(value:number,min=0,max=100){ return Math.max(min,Math.min(max,value)); }
function safeRate(a:number,b:number){ return b ? a/b*100 : 0; }
function percentile(value:number, values:number[], lowerIsBetter=false){
  const clean=values.filter(Number.isFinite);
  if(!clean.length || !Number.isFinite(value)) return undefined;
  if(clean.length===1) return 70;
  const better=clean.filter(v=>lowerIsBetter ? v>=value : v<=value).length;
  return clamp((better-1)/(clean.length-1)*100);
}

function inferHooks(creative: Creative): CreativeHookType[] {
  const text=`${creative.headline??''} ${creative.primaryText??''} ${creative.copy??''}`.trim();
  const out:CreativeHookType[]=[];
  const add=(value:CreativeHookType)=>{ if(!out.includes(value)) out.push(value); };
  if(/[0-9０-９]|\d+[만천백억%]/.test(text)) add('숫자');
  if(/[?？]|나요|세요\?|습니까/.test(text)) add('질문');
  if(/무료|증정|혜택|서비스|사은품/.test(text)) add('혜택');
  if(/할인|반값|특가|가격|만원|원부터|월\s*\d/.test(text)) add('가격');
  if(/할인|반값|특가/.test(text)) add('할인');
  if(/한정|마감|마지막|선착순|오늘만|기간/.test(text)) add('한정');
  if(/희소|마지막|선착순/.test(text)) add('희소성');
  if(/후기|리뷰|썰|추천받|직접 써|사용해/.test(text)) add('후기');
  if(/아직도|고민|불편|문제|왜|못|어렵/.test(text)) add('문제제기');
  if(/공감|직장|퇴근|우리|아이|반려|일상/.test(text)) add('공감');
  if(/비교|대비|보다|차이/.test(text)) add('비교');
  if(/성공|올랐|개선|결과|완료|달성/.test(text)) add('결과');
  if(/안내|소개|전문|정보|방법|과정|환경/.test(text)) add('정보');
  if(/불안|걱정|위험|놓치|손해/.test(text)) add('불안');
  return out.length ? out : ['미분류'];
}

function inferCta(creative: Creative){
  if(creative.cta?.trim()) return creative.cta.trim();
  const text=`${creative.headline??''} ${creative.primaryText??''} ${creative.copy??''}`;
  if(/무료\s*상담|상담\s*신청/.test(text)) return '상담 신청';
  if(/견적/.test(text)) return '견적 받기';
  if(/예약/.test(text)) return '예약하기';
  if(/구매|주문/.test(text)) return '구매하기';
  if(/다운로드|받기/.test(text)) return '다운로드';
  if(/더\s*알아보기|자세히/.test(text)) return '더 알아보기';
  return '미분류';
}

function goalFor(brand:string){
  try{
    const parsed=JSON.parse(localStorage.getItem('adcc-kpi-brands-v1')||'[]');
    if(!Array.isArray(parsed)) return undefined;
    return parsed.find(item=>String(item?.name??'')===brand);
  }catch{return undefined;}
}

function matchPerformance(creative:Creative){
  const byId=CREATIVE_PERFORMANCE_SAMPLE.find(item=>item.creativeId===creative.id);
  if(byId) return byId;
  const media=normalizeCreativeMedia(creative.platform);
  const norm=normalizeText(creative.name);
  return CREATIVE_PERFORMANCE_SAMPLE.find(item=>normalizeText(item.name)===norm && item.advertiser===creative.brand && normalizeCreativeMedia(item.media)===media);
}

function matchDbRows(creative:Creative, all:DbDataRow[]){
  const media=normalizeCreativeMedia(creative.platform);
  return all.filter(row=>row.advertiser===creative.brand && normalizeCreativeMedia(row.media)===media && (
    (row.creativeId && row.creativeId===creative.id) ||
    (row.creativeName && normalizeText(row.creativeName)===normalizeText(creative.name))
  ));
}

function fatigueFrom(performance:CreativePerformanceSampleRow|undefined, creative:Creative){
  if(!performance){
    if(creative.fatigue==='교체 권장') return {score:85,lifecycle:'교체 권장' as CreativeLifecycle};
    if(creative.fatigue==='주의') return {score:62,lifecycle:'피로' as CreativeLifecycle};
    if(creative.fatigue==='정상') return {score:22,lifecycle:'안정' as CreativeLifecycle};
    return {score:undefined,lifecycle:'데이터 부족' as CreativeLifecycle};
  }
  const trend=performance.trend.filter(Number.isFinite);
  const half=Math.max(1,Math.floor(trend.length/2));
  const early=avg(trend.slice(0,half)), recent=avg(trend.slice(-half));
  const decay=early ? (early-recent)/early*100 : 0;
  let score=clamp(Math.max(0,decay)*1.2 + Math.max(0,performance.days-14)*1.4 + Math.max(0,(performance.frequency??1)-2.5)*18);
  if(creative.fatigue==='교체 권장') score=Math.max(score,82);
  else if(creative.fatigue==='주의') score=Math.max(score,55);
  else if(creative.fatigue==='정상') score=Math.min(score,45);
  let lifecycle:CreativeLifecycle='안정';
  if(score>=80) lifecycle='교체 권장';
  else if(score>=58) lifecycle='피로';
  else if(performance.days<=7) lifecycle='신규';
  else if(recent>early*1.1) lifecycle='성장';
  return {score:Math.round(score),lifecycle};
}

export function loadCreativeAnalysisRows(dbRowsOverride?:DbDataRow[]):CreativeAnalysisRow[]{
  const dbAll=dbRowsOverride ?? loadDbRows();
  const base=CREATIVE_LIBRARY.map(creative=>{
    const performance=matchPerformance(creative);
    const dbRows=matchDbRows(creative,dbAll);
    const db=dbRows.reduce((a,row)=>a+(Number(row.db)||0),0);
    const validDb=dbRows.reduce((a,row)=>a+(Number(row.validDb)||0),0);
    const contracts=dbRows.reduce((a,row)=>a+(Number(row.contracts)||0),0);
    const dbSpend=dbRows.reduce((a,row)=>a+(Number(row.spend)||0),0);
    const revenue=dbRows.reduce((a,row)=>a+(Number(row.revenue)||0),0);
    const spend=performance?.spend || dbSpend || creative.spend || 0;
    const impressions=performance?.impressions||0, clicks=performance?.clicks||0;
    const ctr=safeRate(clicks,impressions), cpc=clicks?spend/clicks:0, cpm=impressions?spend/impressions*1000:0;
    const cvr=safeRate(db,clicks), cpa=db?spend/db:0, validDbRate=safeRate(validDb,db), contractRate=safeRate(contracts,validDb||db), roas=spend?revenue/spend*100:0;
    const fatigue=fatigueFrom(performance,creative);
    const goal=goalFor(creative.brand);
    const kpiLabel=goal?.goalType==='CPA'?'CPA':goal?.goalType==='ROAS'?'ROAS':creative.objective==='DB 수집'?'실제 DB':creative.objective==='판매'?'전환 성과':'클릭 반응';
    let kpiAchievement: number|undefined;
    if(goal?.goalType==='CPA' && Number(goal.goalTarget)>0 && cpa>0) kpiAchievement=Number(goal.goalTarget)/cpa*100;
    if(goal?.goalType==='ROAS' && Number(goal.goalTarget)>0 && roas>0) kpiAchievement=roas/Number(goal.goalTarget)*100;
    const notes:string[]=[];
    if(!performance) notes.push('소재 단위 광고 성과 미연결');
    if(!dbRows.length) notes.push('소재 단위 Google Sheets DB 미연결');
    const campaignName=creative.campaignName || performance?.campaign || '-';
    return {
      creative,performance,dbRows,campaignName,spend,impressions,clicks,ctr,cpc,cpm,db,validDb,contracts,revenue,cvr,cpa,validDbRate,contractRate,roas,
      hookTypes:inferHooks(creative),cta:inferCta(creative),fatigueScore:fatigue.score,fatigueLevel:creative.fatigue,lifecycle:fatigue.lifecycle,
      score:undefined,analysisStatus:'평가 보류' as CreativeAnalysisStatus,kpiLabel,kpiAchievement,
      peerKey:`${creative.brand}|${normalizeCreativeMedia(creative.platform)}|${creative.type}|${creative.objective}`,
      peerCount:0,hasPerformance:Boolean(performance),hasDb:Boolean(dbRows.length),dataNotes:notes,
    } as CreativeAnalysisRow;
  });

  const groups=new Map<string,CreativeAnalysisRow[]>();
  base.forEach(row=>groups.set(row.peerKey,[...(groups.get(row.peerKey)||[]),row]));
  base.forEach(row=>{
    const peers=groups.get(row.peerKey)||[];
    row.peerCount=peers.length;
    const perfPeers=peers.filter(item=>item.hasPerformance||item.hasDb);
    row.peerCtr=avg(perfPeers.filter(item=>item.impressions>0).map(item=>item.ctr))||undefined;
    row.peerCpa=avg(perfPeers.filter(item=>item.cpa>0).map(item=>item.cpa))||undefined;
    row.peerValidRate=avg(perfPeers.filter(item=>item.db>0).map(item=>item.validDbRate))||undefined;

    const weighted:{value:number;weight:number}[]=[];
    if(row.kpiAchievement!==undefined) weighted.push({value:clamp(row.kpiAchievement/1.1),weight:40});
    else if(row.cpa>0){const p=percentile(row.cpa,perfPeers.filter(p=>p.cpa>0).map(p=>p.cpa),true);if(p!==undefined)weighted.push({value:p,weight:40});}
    else if(row.db>0){const p=percentile(row.db,perfPeers.filter(p=>p.db>0).map(p=>p.db));if(p!==undefined)weighted.push({value:p,weight:40});}
    if(row.db>0){const p=percentile(row.validDbRate,perfPeers.filter(p=>p.db>0).map(p=>p.validDbRate));if(p!==undefined)weighted.push({value:p,weight:25});}
    if(row.impressions>0){const p=percentile(row.ctr,perfPeers.filter(p=>p.impressions>0).map(p=>p.ctr));if(p!==undefined)weighted.push({value:p,weight:15});}
    if(row.performance?.trend?.length){
      const mean=avg(row.performance.trend); const deviation=mean?avg(row.performance.trend.map(v=>Math.abs(v-mean)))/mean*100:0;
      weighted.push({value:clamp(100-deviation*2),weight:10});
    }
    if(row.fatigueScore!==undefined) weighted.push({value:100-row.fatigueScore,weight:10});
    const totalWeight=weighted.reduce((a,b)=>a+b.weight,0);
    if(totalWeight>0){
      row.score=Math.round(weighted.reduce((a,b)=>a+b.value*b.weight,0)/totalWeight);
      row.analysisStatus=row.score>=90?'매우 우수':row.score>=80?'우수':row.score>=65?'정상':row.score>=50?'주의':'개선 필요';
    }
  });
  return base;
}

export function creativePrimaryValue(row:CreativeAnalysisRow){
  if(row.kpiLabel==='CPA') return row.cpa;
  if(row.kpiLabel==='ROAS') return row.roas;
  if(row.kpiLabel==='실제 DB') return row.db;
  return row.clicks;
}

export function creativeInsight(row:CreativeAnalysisRow){
  if(!row.hasPerformance&&!row.hasDb) return '소재 단위 성과가 연결되면 성과 원인과 제작 제안을 활성화할 수 있습니다.';
  if(row.hasDb && row.validDbRate && row.peerValidRate){
    const diff=row.validDbRate-row.peerValidRate;
    if(diff>=8) return `실제 DB 품질이 동일 조건 평균보다 ${diff.toFixed(1)}%p 높습니다.`;
    if(diff<=-8) return `DB 발생량과 별개로 유효 DB율이 동일 조건 평균보다 ${Math.abs(diff).toFixed(1)}%p 낮아 품질 점검이 필요합니다.`;
  }
  if(row.peerCtr && row.ctr>row.peerCtr*1.2 && row.cvr===0) return '클릭 반응은 평균보다 높지만 소재 단위 실제 전환 데이터가 없어 전환 효율 평가는 보류됩니다.';
  if((row.fatigueScore??0)>=60) return '초기 대비 최근 추이가 약해지고 있어 소재 피로 가능성이 있습니다.';
  return '현재 연결된 지표 범위에서는 큰 이상 없이 운영되고 있습니다.';
}
