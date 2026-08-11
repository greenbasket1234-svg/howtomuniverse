export type CreativePerformanceSampleRow = {
  id: string;
  creativeId?: string;
  name: string;
  advertiser: string;
  campaign: string;
  campaignId?: string;
  media: string;
  spend: number;
  impressions: number;
  clicks: number;
  frequency?: number;
  status: '라이브'|'보관됨';
  days: number;
  health: number;
  trend: number[];
};

/**
 * 기존 Meta 소재 보고서에서 이미 사용하던 데모 성과 데이터입니다.
 * 소재 분석은 이 값을 임의 확장하지 않고, 소재 라이브러리와 이름/ID가 정확히 연결되는 행만 사용합니다.
 * 실제 API 또는 소재 단위 업로드 데이터가 연결되면 이 데모 소스를 대체할 수 있습니다.
 */
export const CREATIVE_PERFORMANCE_SAMPLE: CreativePerformanceSampleRow[] = [
  {id:'m1',name:'20260618_인스타1 퇴근캠핑',advertiser:'월컴투바베큐',campaign:'20260609_트래픽',media:'메타',spend:120587,impressions:20617,clicks:623,frequency:1.03,status:'라이브',days:14,health:5,trend:[45,62,55,72,61,83]},
  {id:'m2',creativeId:'cr-1004',name:'20260610_인스타4 삼겹살',advertiser:'완도군수산',campaign:'20260609_트래픽',media:'메타',spend:83041,impressions:20059,clicks:730,frequency:1.07,status:'라이브',days:26,health:20,trend:[37,55,42,66,80,73]},
  {id:'m3',name:'20260616_인스타1 야장',advertiser:'월컴투바베큐',campaign:'20260609_트래픽',media:'메타',spend:60073,impressions:9367,clicks:314,frequency:1.04,status:'라이브',days:20,health:0,trend:[42,68,51,34,59,47]},
  {id:'m4',creativeId:'cr-1003',name:'20260610_인스타3 수영장',advertiser:'완도군수산',campaign:'20260609_트래픽',media:'메타',spend:39051,impressions:5972,clicks:359,frequency:1.03,status:'라이브',days:26,health:0,trend:[80,56,46,27,21,18]},
  {id:'m5',name:'20260630_인스타4 수완지구 캠핑',advertiser:'월컴투바베큐',campaign:'20260630_트래픽',media:'메타',spend:27231,impressions:8042,clicks:278,frequency:1.02,status:'보관됨',days:0,health:0,trend:[44,65,51,75,32,12]},
  {id:'m6',name:'20260630_인스타2 용기증기',advertiser:'월컴투바베큐',campaign:'20260630_트래픽',media:'메타',spend:18247,impressions:2455,clicks:126,frequency:1.02,status:'보관됨',days:0,health:0,trend:[20,55,22,65,42,88]},
  {id:'m7',name:'20260701_인스타6 반려동물',advertiser:'월컴투바베큐',campaign:'20260630_트래픽',media:'메타',spend:16919,impressions:3389,clicks:135,frequency:1.04,status:'라이브',days:5,health:0,trend:[12,25,61,23,47,39]},
  {id:'m8',name:'20260701_인스타8 강아지 포미',advertiser:'월컴투바베큐',campaign:'20260630_트래픽',media:'메타',spend:16130,impressions:2446,clicks:123,frequency:1.05,status:'라이브',days:5,health:0,trend:[20,38,50,68,49,73]},
  {id:'m9',creativeId:'cr-1006',name:'수영장',advertiser:'완도군수산',campaign:'수영장',media:'구글 검색',spend:8388,impressions:1861,clicks:82,frequency:1.02,status:'라이브',days:3,health:0,trend:[25,44,53,62,77,71]},
  {id:'m10',name:'드론',advertiser:'월컴투바베큐',campaign:'드론',media:'메타',spend:8387,impressions:1839,clicks:55,frequency:1.13,status:'라이브',days:3,health:0,trend:[12,35,65,74,50,88]},
];
