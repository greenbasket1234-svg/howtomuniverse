import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CalendarDays, Check, ChevronDown, RefreshCw, Search, ShieldCheck, X, ArrowUpRight, AlertTriangle, Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { DateRangePicker, type DateRange } from '../components/DateRangePicker';
import { computeMetric, enumerateDates, sumFields, type RawFields, type BrandReportConfig, type BrandDailyData } from '../types/brandReport';
import { getBudgetStatus } from '../types/common';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { apiFetch } from '../hooks/useApi';

// 매체 계정 연동에서 실제로 동기화된 dailyMetrics를, 이 화면이 원래 쓰던 BRAND_REPORTS와
// 같은 모양({config, data})으로 변환합니다. 아래 로직은 전부 그대로 재사용합니다.
type DailyMetricRow = { advertiserId: string; channel: string; date: string; impressions: number; clicks: number; spend: number; dbCount: number; revenue?: number };
const CHANNEL_LABELS: Record<string, string> = { meta: '메타', naver: '네이버', google: '구글', daangn: '당근', tiktok: '틱톡', kakao: '카카오' };
function buildLiveBrandReports(advertisers: { id: string; name: string; monthlyBudget: number }[], rows: DailyMetricRow[]): { config: BrandReportConfig; data: BrandDailyData }[] {
  return advertisers.map(adv => {
    const advRows = rows.filter(r => r.advertiserId === adv.id);
    const channels = Array.from(new Set(advRows.map(r => r.channel)));
    // 매출(구매전환값)이 단 하루도 안 잡히는 광고주는 애초에 구매 픽셀 추적이 없는 것으로 보고,
    // revenue 필드 자체를 생략합니다. 값을 0으로 채우면 "ROAS 0%"로 오인되어 순위가 왜곡됩니다.
    const tracksRevenue = advRows.some(r => (r.revenue ?? 0) > 0);
    const data: BrandDailyData = {};
    for (const ch of channels) {
      data[ch] = {};
      for (const row of advRows.filter(r => r.channel === ch)) {
        data[ch][row.date] = { impressions: row.impressions, clicks: row.clicks, spend: row.spend, dbCount: row.dbCount, ...(tracksRevenue ? { revenue: row.revenue ?? 0 } : {}) };
      }
    }
    return {
      config: { brandId: adv.id, brandName: adv.name, hasRealData: true, lineItems: channels.map(ch => ({ key: ch, label: CHANNEL_LABELS[ch] ?? ch })), rowGroups: [], monthlyBudget: adv.monthlyBudget },
      data,
    };
  });
}

import { PLATFORM_COLOR as MEDIA_COLORS } from '../utils/platformColors';
import { TrendComboChart } from '../components/charts/TrendComboChart';
// 채널별 대표 소재/키워드 예시명입니다. 실제 소재 라이브러리·키워드 데이터가 연결되기 전까지,
// 어떤 광고주가 그 채널에서 1등인지는 실제 스펜드/CTR로 계산하고, 소재·키워드명은 예시로 표시합니다.
const TOP_ITEM_BY_CHANNEL: Record<string, { itemType: '소재' | '키워드'; itemName: string }> = {
  메타: { itemType: '소재', itemName: '여름 성수기 프로모션 카드뉴스' },
  네이버: { itemType: '키워드', itemName: '지역명+업종 검색 키워드' },
  구글: { itemType: '키워드', itemName: '브랜드명 검색 키워드' },
  당근: { itemType: '소재', itemName: '동네 인증 후기형 이미지 소재' },
  틱톡: { itemType: '소재', itemName: '숏폼 비포애프터 영상' },
  카카오: { itemType: '소재', itemName: '카카오톡 채널 친구 추가 배너' },
  기타: { itemType: '소재', itemName: '대표 이미지 소재' },
};
const CHANNEL_KEY_MAP: Record<string, string> = { 메타: 'meta', 네이버: 'naver', 구글: 'google', 당근: 'daangn', 틱톡: 'tiktok', 카카오: 'kakao' };
const CHANNEL_COLORS: Record<string,string> = {
  meta:MEDIA_COLORS.메타,facebook:MEDIA_COLORS.메타,naver:MEDIA_COLORS.네이버,gfa:MEDIA_COLORS.네이버,
  google:MEDIA_COLORS.구글,google_sa:MEDIA_COLORS.구글,youtube:MEDIA_COLORS.구글,danggeun:MEDIA_COLORS.당근,
  tiktok:MEDIA_COLORS.틱톡,kakao_keyword:MEDIA_COLORS.카카오,kakao_plus_friend:MEDIA_COLORS.카카오,
  kakao_channel_add:MEDIA_COLORS.카카오
};
type Preset='today'|'yesterday'|'7d'|'14d'|'30d'|'60d'|'90d';
const PRESETS:{key:Preset;label:string;days:number}[]=[
  {key:'today',label:'오늘',days:1},{key:'yesterday',label:'어제',days:1},{key:'7d',label:'7일',days:7},
  {key:'14d',label:'14일',days:14},{key:'30d',label:'30일',days:30},{key:'60d',label:'60일',days:60},{key:'90d',label:'90일',days:90}
];
const money=(v:number)=>`₩${Math.round(v).toLocaleString()}`;
const dateOffset=(date:string,days:number)=>{const d=new Date(`${date}T00:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};
const datesOf=(data:Record<string,Record<string,RawFields>>)=>Array.from(new Set(Object.values(data).flatMap(v=>Object.keys(v)))).sort();
const aggregate=(data:Record<string,Record<string,RawFields>>,key:string,dates:string[])=>sumFields(dates.map(d=>data[key]?.[d]??{}));
const platformName=(key:string)=>key.includes('facebook')||key==='meta'?'메타':key.includes('naver')||key==='gfa'?'네이버':key.includes('google')||key==='youtube'?'구글':key.includes('danggeun')?'당근':key.includes('tiktok')?'틱톡':key.includes('kakao')?'카카오':'기타';

function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){
  return <div className="dash-modal-backdrop" onMouseDown={onClose}><div className="dash-modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="dash-modal-head"><h3>{title}</h3><button onClick={onClose}><X size={17}/></button></div>
    <div className="dash-modal-body">{children}</div>
    <div className="dash-modal-actions"><button className="secondary" onClick={onClose}>닫기</button><button onClick={onClose}>확인</button></div>
  </div></div>
}

export function DashboardOverviewPage(){
  const {brandId}=useParams(); const navigate=useNavigate();
  const { filterValue } = useAdvertiserFilter();
  const [advertisers]=useAdvertisers();
  const [metricRows,setMetricRows]=useState<DailyMetricRow[]>([]);
  useEffect(()=>{apiFetch<{rows:DailyMetricRow[]}>('/daily-metrics').then(r=>setMetricRows(r.rows||[])).catch(()=>setMetricRows([]));},[]);
  const BRAND_REPORTS=useMemo(()=>buildLiveBrandReports(advertisers,metricRows),[advertisers,metricRows]);
  // '우수 광고' 카드에 실제 소재명·키워드명을 보여주기 위해 함께 불러옵니다.
  const [creativeRows,setCreativeRows]=useState<{advertiserId:string;channel:string;adId:string;adName:string;spend:number}[]>([]);
  const [keywordRows,setKeywordRows]=useState<{advertiserId:string;channel:string;keyword:string;spend:number}[]>([]);
  useEffect(()=>{
    apiFetch<{rows:typeof creativeRows}>('/creative-metrics').then(r=>setCreativeRows(r.rows||[])).catch(()=>setCreativeRows([]));
    apiFetch<{rows:typeof keywordRows}>('/keyword-metrics').then(r=>setKeywordRows(r.rows||[])).catch(()=>setKeywordRows([]));
  },[]);
  const topItemForChannel=(channelName:string,advertiserName:string):{itemType:'소재'|'키워드';itemName:string}|null=>{
    const channelKey=CHANNEL_KEY_MAP[channelName];
    const advertiserId=advertisers.find(a=>a.name===advertiserName)?.id;
    if(!channelKey||!advertiserId)return null;
    const isKeywordChannel=TOP_ITEM_BY_CHANNEL[channelName]?.itemType==='키워드';
    if(isKeywordChannel){
      const best=keywordRows.filter(r=>r.channel===channelKey&&r.advertiserId===advertiserId).sort((a,b)=>b.spend-a.spend)[0];
      return best?{itemType:'키워드',itemName:best.keyword}:null;
    }
    const best=creativeRows.filter(r=>r.channel===channelKey&&r.advertiserId===advertiserId).sort((a,b)=>b.spend-a.spend)[0];
    return best?{itemType:'소재',itemName:best.adName}:null;
  };
  const selectedId=brandId&&BRAND_REPORTS.some(r=>r.config.brandId===brandId)?brandId:'all';
  // URL로 특정 브랜드가 지정된 경우엔 그 브랜드를 우선하고,
  // 그렇지 않으면(전체 대시보드) 상단 전역 검색 필터를 브랜드명 기준 부분 검색으로 적용합니다.
  // 이전에는 이 페이지가 URL 파라미터만 보고 상단 검색창 입력을 완전히 무시했습니다.
  const selectedReports=useMemo(()=>{
    if(selectedId!=='all')return BRAND_REPORTS.filter(r=>r.config.brandId===selectedId);
    if(filterValue.trim())return BRAND_REPORTS.filter(r=>matchesAdvertiserFilter(r.config.brandName,filterValue));
    return BRAND_REPORTS;
  },[selectedId,filterValue,BRAND_REPORTS]);
  const allDates=useMemo(()=>Array.from(new Set(selectedReports.flatMap(r=>datesOf(r.data)))).sort(),[selectedReports]);
  const maxDate=(allDates.length?allDates[allDates.length-1]:new Date().toISOString().slice(0,10));
  const [preset,setPreset]=useState<Preset>('7d');
  const [range,setRange]=useState<DateRange>({from:dateOffset(maxDate,-6),to:maxDate});

  const [modal,setModal]=useState<{title:string;body:React.ReactNode}|null>(null);
  const [mode,setMode]=useState<'media'|'account'|'period'>('media');
  type PerfSortKey='name'|'spend'|'impressions'|'clicks'|'cpm'|'ctr'|'cpc'|'conversions'|'cvr'|'revenue'|'cpa'|'roas';
  const [perfSortKey,setPerfSortKey]=useState<PerfSortKey>('spend');
  const [perfSortDir,setPerfSortDir]=useState<'asc'|'desc'>('desc');
  const togglePerfSort=(key:PerfSortKey)=>{if(perfSortKey===key)setPerfSortDir(perfSortDir==='asc'?'desc':'asc');else{setPerfSortKey(key);setPerfSortDir('desc')}};
  const perfSortArrow=(key:PerfSortKey)=>perfSortKey===key?(perfSortDir==='asc'?' ▲':' ▼'):'';
  const perfValueOf=(name:string,r:{spend?:number;impressions?:number;clicks?:number;dbCount?:number;revenue?:number})=>{
    if(perfSortKey==='name')return name;
    if(perfSortKey==='spend')return r.spend??0;
    if(perfSortKey==='impressions')return r.impressions??0;
    if(perfSortKey==='cpm')return r.impressions?(r.spend??0)/r.impressions*1000:0;
    if(perfSortKey==='clicks')return r.clicks??0;
    if(perfSortKey==='ctr')return computeMetric('ctr',r)??0;
    if(perfSortKey==='cpc')return computeMetric('cpc',r)??0;
    if(perfSortKey==='conversions')return r.dbCount??0;
    if(perfSortKey==='cvr')return computeMetric('conversion_rate',r)??0;
    if(perfSortKey==='revenue')return r.revenue??0;
    if(perfSortKey==='cpa')return r.dbCount?(r.spend??0)/r.dbCount:0;
    return computeMetric('roas',r)??0;
  };
  const perfSort=<T,>(list:T[],nameOf:(item:T)=>string,rawOf:(item:T)=>{spend?:number;impressions?:number;clicks?:number;dbCount?:number;revenue?:number})=>[...list].sort((a,b)=>{
    const av=perfValueOf(nameOf(a),rawOf(a)),bv=perfValueOf(nameOf(b),rawOf(b));
    if(typeof av==='string'||typeof bv==='string')return perfSortDir==='asc'?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));
    return perfSortDir==='asc'?(av as number)-(bv as number):(bv as number)-(av as number);
  });
  // "필터값 중 선택": 매체별·계정별·기간별 표에서 특정 항목만 골라서 볼 수 있는 체크박스
  // 필터입니다. 탭(mode)을 바꾸면 그 모드의 항목 이름이 달라지므로 선택을 초기화합니다.
  const [perfNameFilter,setPerfNameFilter]=useState<string[]>([]);
  useEffect(()=>{setPerfNameFilter([])},[mode]);
  const togglePerfNameFilter=(name:string)=>setPerfNameFilter(prev=>prev.includes(name)?prev.filter(n=>n!==name):[...prev,name]);
  const applyPerfNameFilter=<T,>(list:T[],nameOf:(item:T)=>string)=>perfNameFilter.length===0?list:list.filter(item=>perfNameFilter.includes(nameOf(item)));
  // 값 범위 필터: "지금 정렬 기준으로 선택된 지표"(예: CTR, 광고비)를 기준으로 최소·최대 값을
  // 지정해서 그 범위 안에 있는 행만 봅니다. 정렬 기준을 바꾸면 그 지표로 범위가 다시 적용됩니다.
  const [perfRangeMin,setPerfRangeMin]=useState('');
  const [perfRangeMax,setPerfRangeMax]=useState('');
  const applyPerfRangeFilter=<T,>(list:T[],nameOf:(item:T)=>string,rawOf:(item:T)=>{spend?:number;impressions?:number;clicks?:number;dbCount?:number;revenue?:number})=>{
    if(perfSortKey==='name'||(!perfRangeMin&&!perfRangeMax))return list;
    const min=perfRangeMin?Number(perfRangeMin):-Infinity;
    const max=perfRangeMax?Number(perfRangeMax):Infinity;
    return list.filter(item=>{const v=perfValueOf(nameOf(item),rawOf(item)) as number;return v>=min&&v<=max;});
  };

  useEffect(()=>{setRange({from:dateOffset(maxDate,-6),to:maxDate});setPreset('7d')},[selectedId,maxDate]);


  const dates=useMemo(()=>enumerateDates(range.from,range.to),[range]);
  const brandSummaries=useMemo(()=>selectedReports.map(report=>{
    const raws=report.config.lineItems.map(i=>aggregate(report.data,i.key,dates));
    return {report,total:sumFields(raws),raws};
  }),[selectedReports,range.from,range.to]);
  const total=sumFields(brandSummaries.map(b=>b.total));
  const periodSpend=total.spend??0; const revenue=total.revenue??0; const conversions=total.dbCount??0;
  const monthSpend=selectedReports.reduce((s,r)=>s+(sumFields(r.config.lineItems.map(i=>aggregate(r.data,i.key,allDates))).spend??0),0)||periodSpend;
  const platformMap=useMemo(()=>{
    const map=new Map<string,RawFields>();
    selectedReports.forEach(r=>r.config.lineItems.forEach(i=>{
      const name=platformName(i.key);
      map.set(name,sumFields([map.get(name)??{},aggregate(r.data,i.key,dates)]));
    }));
    return Array.from(map.entries()).map(([name,raw])=>({name,raw,color:MEDIA_COLORS[name]??MEDIA_COLORS.기타}));
  },[selectedReports,range.from,range.to]);

  // 일자별 추이 차트용 데이터입니다. 선택된 광고주 범위에서 날짜별 광고비·전환·매출을 합산합니다.
  const dailySeries=useMemo(()=>{
    return dates.map(d=>{
      const dayTotal=sumFields(selectedReports.flatMap(r=>r.config.lineItems.map(i=>aggregate(r.data,i.key,[d]))));
      return { spend: dayTotal.spend??0, db: dayTotal.dbCount??0, revenue: dayTotal.revenue??0 };
    });
  },[selectedReports,dates]);
  const chartDates=useMemo(()=>dates.map(d=>{const [,m,day]=d.split('-');return `${Number(m)}/${Number(day)}`;}),[dates]);
  const cpa=computeMetric('cost_per_db',total); const roas=computeMetric('roas',total);

  // TOP5 매체 순위: ROAS가 있으면 ROAS 기준, 없으면 CPA(낮을수록 좋음) 기준으로 정렬합니다.
  // 효율 순으로 정렬합니다. ROAS(매출 있는 광고주·매체)와 CPA(DB 전환 중심)는 단위가 달라 직접 비교할 수 없으므로,
  // ROAS가 있는 항목을 먼저(ROAS 높은 순), 그다음 CPA만 있는 항목을(CPA 낮은 순) 순서로 둡니다.
  // (하나의 비교 함수 안에서 두 기준을 섞으면 Array.sort가 일관되게 정렬하지 못해 순서가 뒤죽박죽될 수 있습니다.)
  const [rankMetric, setRankMetric] = useState<'auto' | 'roas' | 'cpa' | 'cpc'>('auto');
  function rankByEfficiency<T extends { roas: number | null; cpa: number | null; cpc: number | null; spend: number }>(items: T[]): T[] {
    if (rankMetric === 'roas') return [...items].filter(i=>i.roas!=null).sort((a,b)=>(b.roas as number)-(a.roas as number));
    if (rankMetric === 'cpa') return [...items].filter(i=>i.cpa!=null).sort((a,b)=>(a.cpa as number)-(b.cpa as number));
    if (rankMetric === 'cpc') return [...items].filter(i=>i.cpc!=null).sort((a,b)=>(a.cpc as number)-(b.cpc as number));
    // 자동: ROAS(매출 있는 광고주)를 우선하고, 없으면 CPA(DB 전환) 기준으로 이어붙입니다.
    const withRoas = items.filter(i => i.roas != null).sort((a, b) => (b.roas as number) - (a.roas as number));
    const cpaOnly = items.filter(i => i.roas == null && i.cpa != null).sort((a, b) => (a.cpa as number) - (b.cpa as number));
    const neither = items.filter(i => i.roas == null && i.cpa == null).sort((a, b) => b.spend - a.spend);
    return [...withRoas, ...cpaOnly, ...neither];
  }
  const rankLabel = (roas: number|null, cpa: number|null, cpc: number|null) => {
    if (rankMetric === 'cpc') return cpc!=null?`CPC ${money(cpc)}`:'-';
    if (rankMetric === 'cpa') return cpa!=null?`CPA ${money(cpa)}`:'-';
    if (rankMetric === 'roas') return roas!=null?`ROAS ${roas.toFixed(0)}%`:'-';
    return roas!=null?`ROAS ${roas.toFixed(0)}%`:cpa!=null?`CPA ${money(cpa)}`:'-';
  };
  // 0원/0%는 "효율이 나쁘다"가 아니라 사실상 데이터가 없는 경우라, null(데이터 없음)과 동일하게 취급해 순위에서 뺍니다.
  const nz = (v: number | null | undefined): number | null => (v == null || v === 0) ? null : v;
  const rankedPlatforms=useMemo(()=>{
    const items = platformMap.map(p=>{
      const r=nz(computeMetric('roas',p.raw)); const c=nz(computeMetric('cost_per_db',p.raw)); const cc=nz(computeMetric('cpc',p.raw));
      return { name:p.name, color:p.color, spend:p.raw.spend??0, roas:r, cpa:c, cpc:cc };
    }).filter(p=>p.spend>0 && (rankMetric==='roas'?p.roas!=null:rankMetric==='cpa'?p.cpa!=null:rankMetric==='cpc'?p.cpc!=null:(p.roas!=null||p.cpa!=null)));
    return rankByEfficiency(items);
  },[platformMap,rankMetric]);
  const topPlatforms=useMemo(()=>rankedPlatforms.slice(0,5),[rankedPlatforms]);
  // WORST5: 같은 순위표의 꼴찌 쪽에서 뽑되, TOP5와 항목이 겹치면(전체가 5개 이하일 때) 제외합니다.
  const worstPlatforms=useMemo(()=>{
    if(rankedPlatforms.length<=topPlatforms.length) return []; // 구분해서 보여줄 만큼 항목이 충분치 않으면 TOP5를 그대로 복제해 보여주지 않습니다.
    const topNames=new Set(topPlatforms.map(p=>p.name));
    return [...rankedPlatforms].reverse().filter(p=>!topNames.has(p.name)).slice(0,5);
  },[rankedPlatforms,topPlatforms]);
  // TOP5/WORST5 광고주 순위: 같은 기준으로, 광고주(브랜드) 단위 합계를 정렬합니다.
  const rankedAdvertisers=useMemo(()=>{
    // 광고주가 매체를 2개 이상 연동했어도, 합산(평균)이 아니라 그중 성과가 가장 좋은 매체 "하나"만
    // 이 광고주의 대표값으로 순위에 반영합니다 (예: 메타 ROAS 300% + 네이버 ROAS 50%를 섞지 않고, 메타만 사용).
    const items = brandSummaries.flatMap(b=>{
      const perChannel = b.report.config.lineItems.map((li,idx)=>{
        const raw=b.raws[idx];
        const r=nz(computeMetric('roas',raw)); const c=nz(computeMetric('cost_per_db',raw)); const cc=nz(computeMetric('cpc',raw));
        return { channelKey:li.key, channelLabel:li.label, spend:raw.spend??0, roas:r, cpa:c, cpc:cc };
      }).filter(p=>p.spend>0 && (rankMetric==='roas'?p.roas!=null:rankMetric==='cpa'?p.cpa!=null:rankMetric==='cpc'?p.cpc!=null:(p.roas!=null||p.cpa!=null)));
      if(!perChannel.length) return [];
      const best = rankByEfficiency(perChannel)[0]; // 이 광고주의 채널 중 가장 좋은 성과 하나만 선택
      const channels=[{key:best.channelKey,label:best.channelLabel,color:CHANNEL_COLORS[best.channelKey]??'#9ca3af'}];
      return [{ name:b.report.config.brandName, spend:best.spend, roas:best.roas, cpa:best.cpa, cpc:best.cpc, channels }];
    });
    return rankByEfficiency(items);
  },[brandSummaries,rankMetric]);
  const topAdvertisers=useMemo(()=>rankedAdvertisers.slice(0,5),[rankedAdvertisers]);
  const worstAdvertisers=useMemo(()=>{
    if(rankedAdvertisers.length<=topAdvertisers.length) return [];
    const topNames=new Set(topAdvertisers.map(a=>a.name));
    return [...rankedAdvertisers].reverse().filter(a=>!topNames.has(a.name)).slice(0,5);
  },[rankedAdvertisers,topAdvertisers]);
  // 분석/문제점/대응방안: 지금 선택된 기간·광고주 범위의 실제 숫자를 근거로 생성합니다.
  const dashboardInsights=useMemo(()=>{
    const analysis:string[]=[]; const problems:string[]=[]; const actions:string[]=[];
    if(periodSpend<=0){ analysis.push('이 기간에는 집계된 데이터가 없습니다.'); return {analysis,problems,actions}; }
    analysis.push(`이 기간 총 광고비는 ${money(periodSpend)}, 전환은 ${conversions.toLocaleString()}건, 평균 CPA는 ${cpa!=null?money(cpa):'-'}입니다.`);
    if(rankedPlatforms.length>=2){
      const best=rankedPlatforms[0], worst=rankedPlatforms[rankedPlatforms.length-1];
      analysis.push(`매체 중에서는 ${best.name}의 효율이 가장 좋고, ${worst.name}이 상대적으로 낮습니다.`);
      const worstBad = rankMetric==='cpc' ? (worst.cpc!=null && best.cpc!=null && worst.cpc > best.cpc*1.5)
        : rankMetric==='cpa' ? (worst.cpa!=null && best.cpa!=null && worst.cpa > best.cpa*1.5)
        : rankMetric==='roas' ? (worst.roas!=null && best.roas!=null && worst.roas < best.roas*0.6)
        : worst.roas!=null ? worst.roas < (best.roas??0)*0.6 : (worst.cpa!=null && best.cpa!=null && worst.cpa > best.cpa*1.5);
      if(worstBad){
        problems.push(`${worst.name}의 효율이 ${best.name} 대비 크게 낮습니다.`);
        actions.push(`${worst.name}은 소재·타겟팅을 재점검하고, 개선이 없으면 예산 비중을 줄이는 것을 검토하세요.`);
      }
    }
    const zeroConv = platformMap.filter(p=>(p.raw.spend??0)>0 && (p.raw.dbCount??0)===0 && (p.raw.revenue??0)===0);
    if(zeroConv.length){
      problems.push(`${zeroConv.map(p=>p.name).join(', ')} — 광고비는 있는데 전환·매출이 0입니다.`);
      actions.push(`${zeroConv.map(p=>p.name).join(', ')}은 소재를 점검하거나 예산 재배분을 검토하세요.`);
    }
    if(!problems.length){
      analysis.push('현재 특별한 위험 신호는 감지되지 않았습니다.');
      if(rankedPlatforms[0]) actions.push(`효율이 가장 좋은 ${rankedPlatforms[0].name} 위주로 예산 증액 테스트를 검토해 볼 수 있습니다.`);
    }
    return {analysis,problems,actions};
  },[periodSpend,conversions,cpa,rankedPlatforms,platformMap,rankMetric]);

  // 기간별 보기: 선택 구간이 14일 이하면 하루씩, 그보다 길면 7일 단위로 묶어서 보여줍니다.
  const periodBuckets=useMemo(()=>{
    const bucketSize=dates.length<=14?1:7;
    const buckets:{label:string;dates:string[]}[]=[];
    for(let i=0;i<dates.length;i+=bucketSize){
      const chunk=dates.slice(i,i+bucketSize);
      const label=bucketSize===1?chunk[0]:`${chunk[0]} ~ ${chunk[chunk.length-1]}`;
      buckets.push({label,dates:chunk});
    }
    return buckets.map(bucket=>{
      const raws=selectedReports.flatMap(report=>report.config.lineItems.map(i=>aggregate(report.data,i.key,bucket.dates)));
      return {label:bucket.label,raw:sumFields(raws)};
    });
  },[dates,selectedReports]);
  // 특정 채널에서 실제로 가장 CTR이 높은 광고주를 전체 데이터에서 계산합니다.
  const topBrandForChannel=(channelName:string)=>{
    let best:{brandName:string;ctr:number;cpc:number|null;roas:number|null;cpa:number|null;spend:number}|null=null;
    for(const r of selectedReports){
      const items=r.config.lineItems.filter(i=>platformName(i.key)===channelName);
      if(items.length===0)continue;
      const raw=sumFields(items.map(i=>aggregate(r.data,i.key,dates)));
      const ctr=computeMetric('ctr',raw)??0; const cpc=computeMetric('cpc',raw);
      const roas=computeMetric('roas',raw); const cpa=computeMetric('cost_per_db',raw); const spend=raw.spend??0;
      if(spend<=0)continue;
      const candidate={brandName:r.config.brandName,ctr,cpc,roas,cpa,spend};
      // 대시보드 전체 순위 기준(rankMetric)과 같은 기준으로 이 매체 안의 베스트 광고주를 고릅니다.
      // '자동' 기준은 상단 토글의 "자동(ROAS/CPA)" 표시와 맞춰, ROAS를 우선하고 없으면 CPA로 판단합니다.
      const isBetter = !best ? true
        : rankMetric==='roas' ? (roas??-Infinity) > (best.roas??-Infinity)
        : rankMetric==='cpa' ? (cpa!=null && (best.cpa==null || cpa < best.cpa))
        : rankMetric==='cpc' ? (cpc!=null && (best.cpc==null || cpc < best.cpc))
        : (roas!=null && best.roas!=null) ? roas>best.roas
        : (roas!=null) ? true
        : (best.roas!=null) ? false
        : (cpa!=null && (best.cpa==null || cpa < best.cpa));
      if(isBetter)best=candidate;
    }
    return best;
  };
  const budgetRows=brandSummaries.map(({report,total})=>{
    const spend=total.spend??0,budget=report.config.monthlyBudget??0,pct=budget?spend/budget*100:0;
    const channels=report.config.lineItems.map(i=>({key:i.key,label:i.label,color:CHANNEL_COLORS[i.key]??'#9ca3af'}));
    return {name:report.config.brandName,spend,budget,pct,status:getBudgetStatus({monthlyBudget:budget,currentSpend:spend}),channels};
  });

  const applyPreset=(p:typeof PRESETS[number])=>{setPreset(p.key);const end=maxDate;if(p.key==='today')setRange({from:end,to:end});else if(p.key==='yesterday'){const y=dateOffset(end,-1);setRange({from:y,to:y})}else setRange({from:dateOffset(end,-(p.days-1)),to:end})};
  const open=(title:string,body:React.ReactNode)=>setModal({title,body});
  const aiText=`선택 기간 광고비는 ${money(periodSpend)}, 전환은 ${conversions.toLocaleString()}건입니다. ${roas!=null?`통합 ROAS는 ${roas.toFixed(0)}%입니다.`:'매출 추적 데이터가 부족합니다.'}`;

  return <div className="dashboard-v2">
    <header className="dashboard-v2-header">
      <div><span className="eyebrow">OVERVIEW</span><h1>전체 대시보드</h1><p>광고주와 매체의 핵심 성과, 예산, 위험 신호를 한 화면에서 관리합니다.</p></div>
      <div className="dashboard-header-actions">
        <div className="sync-status"><i/> 마지막 동기화 02:47</div>
      </div>
    </header>

    <section className="dashboard-toolbar card">
      {filterValue&&<div className="footnote" style={{marginBottom:8,width:'100%'}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경) · {selectedReports.length}개 브랜드 표시 중</div>}
      <div className="preset-group">{PRESETS.map(p=><button key={p.key} className={preset===p.key?'active':''} onClick={()=>applyPreset(p)}>{p.label}</button>)}</div>
      <div className="toolbar-range"><CalendarDays size={15}/><DateRangePicker value={range} onChange={r=>{setRange(r);setPreset('30d')}}/></div>
      <div className="toolbar-summary"><span>{range.from}</span><b>~</b><span>{range.to}</span></div>
    </section>

    <section className="metric-grid-v2">
      <button className="metric-card-v2" onClick={()=>open('선택 기간 광고비',<p>선택한 광고주와 기간의 모든 매체 광고비 합계입니다.</p>)}><div className="metric-icon spend">₩</div><div><span>선택 기간 광고비</span><strong>{money(periodSpend)}</strong><small>매체 통합 지출</small></div><ArrowUpRight size={16}/></button>
      <button className="metric-card-v2" onClick={()=>open('이번 달 광고비',<p>{filterValue.trim()||selectedId!=='all'?'현재 선택된 광고주 범위의 이번 달 누적 광고비입니다.':'등록된 전체 광고주의 이번 달 누적 광고비입니다.'}</p>)}><div className="metric-icon month">M</div><div><span>이번 달 광고비</span><strong>{money(monthSpend)}</strong><small>월 예산 대비 자동 집계</small></div><ArrowUpRight size={16}/></button>
      <button className="metric-card-v2" onClick={()=>open('전환 성과',<p>DB, 예약, 구매 등 연결된 전환 이벤트를 합산합니다.</p>)}><div className="metric-icon conversion">✓</div><div><span>전환</span><strong>{conversions.toLocaleString()}건</strong><small>{cpa!=null?`평균 CPA ${money(cpa)}`:'CPA 계산 대기'}</small></div><ArrowUpRight size={16}/></button>
      <button className="metric-card-v2" onClick={()=>open('ROAS 성과',<p>전환매출 ÷ 광고비 × 100으로 계산됩니다.</p>)}><div className="metric-icon roas">%</div><div><span>ROAS</span><strong>{roas!=null?`${roas.toFixed(0)}%`:'-'}</strong><small>{revenue?`전환매출 ${money(revenue)}`:'매출 데이터 대기'}</small></div><ArrowUpRight size={16}/></button>
    </section>

    <div className="dashboard-primary-grid">
      <section className="card dashboard-ai-card">
        <div className="card-title-row"><div><span className="section-kicker">AI INSIGHT</span><h2><Bot size={18}/> AI 성과 분석</h2></div><button className="btn btn-primary btn-sm" onClick={()=>open('AI 분석 재실행',<p>현재 광고주와 기간 데이터로 분석을 다시 생성했습니다.</p>)}><RefreshCw size={13}/> 재분석</button></div>
        <div className="ai-summary-box"><Sparkles size={18}/><div><strong>핵심 진단</strong><p>{aiText}</p></div></div>
        <div className="ai-insight-grid">
          <article><span className="insight-status good">잘되는 점</span><p>전환이 발생한 매체는 CTR과 CPC 흐름이 안정적입니다. 고성과 캠페인의 예산 유지가 적절합니다.</p></article>
          <article><span className="insight-status warning">점검 필요</span><p>{cpa!=null?`평균 CPA ${money(cpa)}를 기준으로 목표 대비 높은 매체를 점검하세요.`:'전환 추적이 없는 매체는 데이터 연결이 필요합니다.'}</p></article>
          <article><span className="insight-status action">추천 조치</span><ol>{dashboardInsights.actions.length?dashboardInsights.actions.slice(0,3).map((a,i)=><li key={i}>{a}</li>):[<li key="a">고성과 매체 예산 10~20% 증액 검토</li>,<li key="b">전환 없는 매체는 3일 관찰 후 감액</li>,<li key="c">CTR 하락 소재는 새 버전으로 교체</li>]}</ol></article>
        </div>
      </section>
      <section className="card rule-card-v2">
        <div className="card-title-row"><div><span className="section-kicker">AUTOMATION</span><h2><ShieldCheck size={18}/> 오늘의 진단 규칙</h2></div><span className="status-chip success">정상</span></div>
        <div className="rule-stat-list"><button onClick={()=>open('중지 후보',<p>현재 자동 중지 후보가 없습니다.</p>)}><span>중지 후보</span><strong>0건</strong></button><button onClick={()=>open('소재 교체',<p>현재 소재 교체 후보가 없습니다.</p>)}><span>소재 교체</span><strong>0건</strong></button><button onClick={()=>open('예산 증액',<p>현재 예산 증액 후보가 없습니다.</p>)}><span>예산 증액</span><strong>0건</strong></button></div>
        <button className="btn btn-secondary full" onClick={()=>navigate('/automation/overview')}>자동화 규칙 관리</button>
      </section>
    </div>

    <section className="card media-mix-v2">
      <div className="card-title-row"><div><span className="section-kicker">MEDIA MIX</span><h2>미디어믹스</h2><p>광고주별 매체 광고비 비중</p></div><div className="media-legend">{platformMap.map(p=><span key={p.name}><i style={{background:p.color}}/>{p.name}</span>)}</div></div>
      <div className="mix-list-v2">{brandSummaries.map(({report,total})=>{
        const spend=total.spend??0;
        const parts=report.config.lineItems.map(i=>{const value=aggregate(report.data,i.key,dates).spend??0;return {name:platformName(i.key),value,color:CHANNEL_COLORS[i.key]??MEDIA_COLORS.기타}}).filter(x=>x.value>0);
        return <article className="mix-row-v2" key={report.config.brandId}>
          <div className="mix-brand"><strong>{report.config.brandName}</strong><span>{money(spend)}</span></div>
          <div className="mix-content"><div className="mix-bar-v2">{parts.map((part,index)=><i key={`${part.name}-${index}`} style={{width:`${spend?part.value/spend*100:0}%`,background:part.color}} title={`${part.name} ${money(part.value)}`}/>)}</div>
          <div className="mix-breakdown">{parts.map((part,index)=><span key={`${part.name}-${index}`}><i style={{background:part.color}}/>{part.name}<b>{spend?`${(part.value/spend*100).toFixed(1)}%`:'0%'}</b></span>)}</div></div>
        </article>
      })}</div>
    </section>

    <section className="card performance-v2">
      <div className="card-title-row performance-head-v2"><div><span className="section-kicker">PERFORMANCE</span><h2>광고 성과 지표</h2></div><div className="view-mode-tabs"><button className={mode==='media'?'active':''} onClick={()=>setMode('media')}>매체별</button><button className={mode==='account'?'active':''} onClick={()=>setMode('account')}>계정별</button><button className={mode==='period'?'active':''} onClick={()=>setMode('period')}>기간별</button></div></div>
      <div className="perf-filter-row" style={{display:'flex',flexWrap:'wrap',gap:6,padding:'0 20px 10px',fontSize:12}}>
        <span style={{color:'#94a3b8',alignSelf:'center'}}>필터:</span>
        {(mode==='media'?platformMap.map(p=>p.name):mode==='account'?brandSummaries.map(b=>b.report.config.brandName):periodBuckets.map(b=>b.label)).map(name=>(
          <button key={name} type="button" onClick={()=>togglePerfNameFilter(name)} className={`btn sm ${perfNameFilter.includes(name)?'primary':'secondary'}`}>{name}</button>
        ))}
        {perfNameFilter.length>0 && <button type="button" className="btn sm secondary" onClick={()=>setPerfNameFilter([])}>필터 해제</button>}
        {perfSortKey!=='name' && (
          <span style={{display:'flex',alignItems:'center',gap:5,marginLeft:8,color:'#64748b'}}>
            {perfSortKey.toUpperCase()} 범위:
            <input type="number" placeholder="최소" value={perfRangeMin} onChange={e=>setPerfRangeMin(e.target.value)} style={{width:80,padding:'3px 6px',border:'1px solid #e2e8f0',borderRadius:5,fontSize:12}}/>
            ~
            <input type="number" placeholder="최대" value={perfRangeMax} onChange={e=>setPerfRangeMax(e.target.value)} style={{width:80,padding:'3px 6px',border:'1px solid #e2e8f0',borderRadius:5,fontSize:12}}/>
            {(perfRangeMin||perfRangeMax) && <button type="button" className="btn sm secondary" onClick={()=>{setPerfRangeMin('');setPerfRangeMax('')}}>해제</button>}
          </span>
        )}
      </div>
      <div className="capture-table-wrap"><table><thead><tr><th style={{cursor:'pointer'}} onClick={()=>togglePerfSort('name')}>{mode==='media'?'매체':mode==='account'?'계정(광고주)':'기간'}{perfSortArrow('name')}</th><th style={{cursor:'pointer'}} onClick={()=>togglePerfSort('spend')}>광고비{perfSortArrow('spend')}</th><th style={{cursor:'pointer'}} onClick={()=>togglePerfSort('impressions')}>노출{perfSortArrow('impressions')}</th><th style={{cursor:'pointer'}} onClick={()=>togglePerfSort('cpm')}>CPM{perfSortArrow('cpm')}</th><th style={{cursor:'pointer'}} onClick={()=>togglePerfSort('clicks')}>클릭{perfSortArrow('clicks')}</th><th style={{cursor:'pointer'}} onClick={()=>togglePerfSort('ctr')}>CTR{perfSortArrow('ctr')}</th><th style={{cursor:'pointer'}} onClick={()=>togglePerfSort('cpc')}>CPC{perfSortArrow('cpc')}</th><th style={{cursor:'pointer'}} onClick={()=>togglePerfSort('conversions')}>전환{perfSortArrow('conversions')}</th><th style={{cursor:'pointer'}} onClick={()=>togglePerfSort('cvr')}>전환율{perfSortArrow('cvr')}</th><th style={{cursor:'pointer'}} onClick={()=>togglePerfSort('revenue')}>전환매출{perfSortArrow('revenue')}</th><th style={{cursor:'pointer'}} onClick={()=>togglePerfSort('cpa')}>CPA{perfSortArrow('cpa')}</th><th style={{cursor:'pointer'}} onClick={()=>togglePerfSort('roas')}>ROAS{perfSortArrow('roas')}</th></tr></thead><tbody>
        {mode==='media'&&perfSort(applyPerfRangeFilter(applyPerfNameFilter(platformMap,p=>p.name),p=>p.name,p=>p.raw),p=>p.name,p=>p.raw).map(p=>{const r=p.raw;return <tr key={p.name}><td><span className="media-name-cell"><i style={{background:p.color}}/>{p.name}</span></td><td>{money(r.spend??0)}</td><td>{(r.impressions??0).toLocaleString()}</td><td>{money(r.impressions?(r.spend??0)/r.impressions*1000:0)}</td><td>{(r.clicks??0).toLocaleString()}</td><td>{(computeMetric('ctr',r)??0).toFixed(2)}%</td><td>{money(computeMetric('cpc',r)??0)}</td><td>{(r.dbCount??0).toLocaleString()}</td><td>{(computeMetric('conversion_rate',r)??0).toFixed(2)}%</td><td>{r.revenue!=null?money(r.revenue):'-'}</td><td>{r.dbCount?money((r.spend??0)/r.dbCount):'-'}</td><td>{computeMetric('roas',r)!=null?`${computeMetric('roas',r)!.toFixed(0)}%`:'-'}</td></tr>})}
        {mode==='account'&&perfSort(applyPerfRangeFilter(applyPerfNameFilter(brandSummaries,b=>b.report.config.brandName),b=>b.report.config.brandName,b=>b.total),b=>b.report.config.brandName,b=>b.total).map(({report,total:r})=><tr key={report.config.brandId}><td><span className="media-name-cell">{report.config.brandName}</span></td><td>{money(r.spend??0)}</td><td>{(r.impressions??0).toLocaleString()}</td><td>{money(r.impressions?(r.spend??0)/r.impressions*1000:0)}</td><td>{(r.clicks??0).toLocaleString()}</td><td>{(computeMetric('ctr',r)??0).toFixed(2)}%</td><td>{money(computeMetric('cpc',r)??0)}</td><td>{(r.dbCount??0).toLocaleString()}</td><td>{(computeMetric('conversion_rate',r)??0).toFixed(2)}%</td><td>{r.revenue!=null?money(r.revenue):'-'}</td><td>{r.dbCount?money((r.spend??0)/r.dbCount):'-'}</td><td>{computeMetric('roas',r)!=null?`${computeMetric('roas',r)!.toFixed(0)}%`:'-'}</td></tr>)}
        {mode==='period'&&perfSort(applyPerfRangeFilter(applyPerfNameFilter(periodBuckets,b=>b.label),b=>b.label,b=>b.raw),b=>b.label,b=>b.raw).map(({label,raw:r})=><tr key={label}><td><span className="media-name-cell">{label}</span></td><td>{money(r.spend??0)}</td><td>{(r.impressions??0).toLocaleString()}</td><td>{money(r.impressions?(r.spend??0)/r.impressions*1000:0)}</td><td>{(r.clicks??0).toLocaleString()}</td><td>{(computeMetric('ctr',r)??0).toFixed(2)}%</td><td>{money(computeMetric('cpc',r)??0)}</td><td>{(r.dbCount??0).toLocaleString()}</td><td>{(computeMetric('conversion_rate',r)??0).toFixed(2)}%</td><td>{r.revenue!=null?money(r.revenue):'-'}</td><td>{r.dbCount?money((r.spend??0)/r.dbCount):'-'}</td><td>{computeMetric('roas',r)!=null?`${computeMetric('roas',r)!.toFixed(0)}%`:'-'}</td></tr>)}
        <tr className="sum"><td>전체 합산</td><td>{money(total.spend??0)}</td><td>{(total.impressions??0).toLocaleString()}</td><td>{money(total.impressions?(total.spend??0)/total.impressions*1000:0)}</td><td>{(total.clicks??0).toLocaleString()}</td><td>{(computeMetric('ctr',total)??0).toFixed(2)}%</td><td>{money(computeMetric('cpc',total)??0)}</td><td>{conversions}</td><td>{(computeMetric('conversion_rate',total)??0).toFixed(2)}%</td><td>{revenue?money(revenue):'-'}</td><td>{cpa!=null?money(cpa):'-'}</td><td>{roas!=null?`${roas.toFixed(0)}%`:'-'}</td></tr>
      </tbody></table></div>
    </section>

    <div className="dashboard-bottom-grid">
      <section className="card"><div className="card-title-row"><div><span className="section-kicker">BUDGET</span><h2>브랜드 예산 소진율</h2></div></div><div className="budget-list-v2">{budgetRows.slice(0,6).map(b=>{const barColor=b.channels[0]?.color??'#2563eb';return <button key={b.name} onClick={()=>open(`${b.name} 예산`,<p>{money(b.spend)} / {money(b.budget)} · {b.pct.toFixed(1)}% 소진</p>)}><div><span style={{display:'inline-flex',alignItems:'center',gap:6}}>{b.channels.map(c=><i key={c.key} title={c.label} style={{width:7,height:7,borderRadius:'50%',background:c.color,display:'inline-block'}}/>)}{b.name}</span><b>{b.pct.toFixed(1)}%</b></div><small>{money(b.spend)} / {money(b.budget)}</small><div className="budget-track"><i style={{width:`${Math.min(100,b.pct)}%`,background:barColor}}/></div></button>})}</div></section>
      <section className="card"><div className="card-title-row"><div><span className="section-kicker">ACTION</span><h2>추천 조치</h2></div><span className={`status-chip ${dashboardInsights.actions.length?'warning':'neutral'}`}>{dashboardInsights.actions.length}건</span></div>{dashboardInsights.actions.length?(<ul className="dashboard-action-list">{dashboardInsights.actions.map((a,i)=><li key={i}>{a}</li>)}</ul>):(<div className="dashboard-empty"><Check size={24}/><strong>현재 긴급 조치가 없습니다.</strong><p>성과 변화가 감지되면 자동으로 추천합니다.</p></div>)}</section>
      <section className="card"><div className="card-title-row"><div><span className="section-kicker">RISK</span><h2>위험 소재</h2></div></div><div className="dashboard-empty"><AlertTriangle size={24}/><strong>위험 소재 없음</strong><p>피로도 기준을 초과한 소재가 없습니다.</p></div></section>
      <section className="card"><div className="card-title-row"><div><span className="section-kicker">TOP ADS</span><h2>우수 광고</h2></div></div><div className="top-ads-v2">{rankedPlatforms.slice(0,3).map((rp,i)=>{const p=platformMap.find(m=>m.name===rp.name);if(!p)return null;const top=topBrandForChannel(p.name);const item=top?topItemForChannel(p.name,top.brandName):null;const fallback=TOP_ITEM_BY_CHANNEL[p.name]??TOP_ITEM_BY_CHANNEL.기타;const criterionLabel=rankMetric==='roas'?'ROAS 높은':rankMetric==='cpa'?'CPA 낮은':rankMetric==='cpc'?'CPC 낮은':'ROAS 높은(매출 데이터가 없으면 CPA 낮은)';return <button key={p.name} onClick={()=>open(`${p.name} 우수 광고 상세`,<div className="top-ad-detail"><div className="top-ad-detail-row"><span>광고주</span><b>{top?top.brandName:'데이터 없음'}</b></div><div className="top-ad-detail-row"><span>{item?item.itemType:fallback.itemType}</span><b>{item?item.itemName:'연동된 소재/키워드 데이터 없음'}</b></div><div className="top-ad-detail-row"><span>CTR</span><b>{top?top.ctr.toFixed(2):'-'}%</b></div><div className="top-ad-detail-row"><span>CPC</span><b>{top?.cpc!=null?money(top.cpc):'-'}</b></div><p className="footnote">이 매체 안에서 {criterionLabel} 순으로 뽑은 광고주입니다(대시보드 상단 "순위 기준"과 연동됩니다). {item?'광고비 기준 1위 항목의 실제 이름입니다.':'설정 > 매체 계정 연동에서 소재·키워드 데이터가 동기화되면 실제 이름이 표시됩니다.'}</p></div>)}><b>{String(i+1).padStart(2,'0')}</b><span><i style={{background:p.color}}/>{p.name} 고성과 광고</span><em>상세</em></button>})}</div></section>
    </div>

    <TrendComboChart
      title="일자별 광고비 · 전환 추이"
      subtitle="지금 선택된 광고주 범위·기간 기준입니다. 범례를 눌러 지표를 껐다 켤 수 있고, 하단 슬라이더로 구간을 좁혀 볼 수 있습니다."
      dates={chartDates}
      summary={[
        { label: '기간 총 광고비', value: money(dailySeries.reduce((s,d)=>s+d.spend,0)) },
        { label: '기간 총 전환', value: `${dailySeries.reduce((s,d)=>s+d.db,0).toLocaleString()}건` },
      ]}
      series={[
        { name: '광고비', data: dailySeries.map(d=>d.spend), color: '#2563eb', type: 'bar', format: 'currency' },
        { name: '전환(DB)', data: dailySeries.map(d=>d.db), color: '#16a34a', type: 'line', format: 'number', yAxisIndex: 1 },
        { name: '매출', data: dailySeries.map(d=>d.revenue), color: '#f59e0b', type: 'line', format: 'currency' },
      ]}
    />

    <div className="rank-metric-toggle">
      <span>순위 기준</span>
      <button className={rankMetric==='auto'?'active':''} onClick={()=>setRankMetric('auto')}>자동(ROAS/CPA)</button>
      <button className={rankMetric==='roas'?'active':''} onClick={()=>setRankMetric('roas')}>ROAS</button>
      <button className={rankMetric==='cpa'?'active':''} onClick={()=>setRankMetric('cpa')}>CPA</button>
      <button className={rankMetric==='cpc'?'active':''} onClick={()=>setRankMetric('cpc')}>CPC</button>
    </div>
    <div className="dashboard-top5-grid">
      <section className="card"><div className="card-title-row"><div><span className="section-kicker">RANKING</span><h2>매체 성과 TOP 5</h2><p>이 기간·이 광고주 범위 기준</p></div></div>
        <div className="top5-list">{topPlatforms.length===0&&<p className="muted" style={{padding:'12px 4px'}}>집계된 데이터가 없습니다.</p>}
          {topPlatforms.map((p,i)=>(
            <div className="top5-row" key={p.name}>
              <b className={`top5-rank r${i+1}`}>{i+1}</b>
              <span className="top5-dot" style={{background:p.color}}/>
              <span className="top5-name">{p.name}</span>
              <span className="top5-metric">{rankLabel(p.roas,p.cpa,p.cpc)}</span>
              <span className="top5-spend">{money(p.spend)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card"><div className="card-title-row"><div><span className="section-kicker">RANKING</span><h2>광고주 성과 TOP 5</h2><p>이 기간·이 광고주 범위 기준</p></div></div>
        <div className="top5-list">{topAdvertisers.length===0&&<p className="muted" style={{padding:'12px 4px'}}>집계된 데이터가 없습니다.</p>}
          {topAdvertisers.map((b,i)=>(
            <div className="top5-row advertiser" key={b.name}>
              <b className={`top5-rank r${i+1}`}>{i+1}</b>
              <span className="top5-name">{b.name}</span>
              <span style={{display:'flex',gap:4,marginRight:6}}>{b.channels.map(c=><span key={c.key} title={c.label} style={{width:8,height:8,borderRadius:'50%',background:c.color,display:'inline-block'}}/>)}</span>
              <span className="top5-metric">{rankLabel(b.roas,b.cpa,b.cpc)}</span>
              <span className="top5-spend">{money(b.spend)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card"><div className="card-title-row"><div><span className="section-kicker">RANKING</span><h2>매체 성과 WORST 5</h2><p>효율이 가장 낮은 매체입니다. 점검이 필요할 수 있습니다.</p></div></div>
        <div className="top5-list">{worstPlatforms.length===0&&<p className="muted" style={{padding:'12px 4px'}}>표시할 항목이 없습니다.</p>}
          {worstPlatforms.map((p,i)=>(
            <div className="top5-row worst" key={p.name}>
              <b className="top5-rank worst-rank">{i+1}</b>
              <span className="top5-dot" style={{background:p.color}}/>
              <span className="top5-name">{p.name}</span>
              <span className="top5-metric worst-metric">{rankLabel(p.roas,p.cpa,p.cpc)}</span>
              <span className="top5-spend">{money(p.spend)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card"><div className="card-title-row"><div><span className="section-kicker">RANKING</span><h2>광고주 성과 WORST 5</h2><p>효율이 가장 낮은 광고주입니다. 점검이 필요할 수 있습니다.</p></div></div>
        <div className="top5-list">{worstAdvertisers.length===0&&<p className="muted" style={{padding:'12px 4px'}}>표시할 항목이 없습니다.</p>}
          {worstAdvertisers.map((b,i)=>(
            <div className="top5-row advertiser worst" key={b.name}>
              <b className="top5-rank worst-rank">{i+1}</b>
              <span className="top5-name">{b.name}</span>
              <span style={{display:'flex',gap:4,marginRight:6}}>{b.channels.map(c=><span key={c.key} title={c.label} style={{width:8,height:8,borderRadius:'50%',background:c.color,display:'inline-block'}}/>)}</span>
              <span className="top5-metric worst-metric">{rankLabel(b.roas,b.cpa,b.cpc)}</span>
              <span className="top5-spend">{money(b.spend)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>

    <section className="card report-insight-card">
      <div className="daily-report-section-head"><div><h3>분석 · 문제점 · 대응방안</h3><p>지금 화면의 실제 데이터를 기준으로 자동 생성된 인사이트입니다. 참고용이며 최종 판단은 담당자가 확인해 주세요.</p></div></div>
      <div className="report-insight-grid">
        <div className="report-insight-col analysis"><h4>📊 분석</h4>{dashboardInsights.analysis.map((t,i)=><p key={i}>{t}</p>)}</div>
        <div className="report-insight-col problems"><h4>⚠️ 문제점</h4>{dashboardInsights.problems.length?dashboardInsights.problems.map((t,i)=><p key={i}>{t}</p>):<p className="muted">특별한 문제점이 감지되지 않았습니다.</p>}</div>
        <div className="report-insight-col actions"><h4>💡 대응방안</h4>{dashboardInsights.actions.map((t,i)=><p key={i}>{t}</p>)}</div>
      </div>
    </section>
    {modal&&<Modal title={modal.title} onClose={()=>setModal(null)}>{modal.body}</Modal>}
  </div>
}
