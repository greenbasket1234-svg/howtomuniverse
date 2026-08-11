import { BrandReportConfig, BrandDailyData } from '../types/brandReport';

export const DATES_JUL_1_TO_12 = Array.from({ length: 12 }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`);

function d(fields: Partial<{ impressions: number; clicks: number; spend: number; dbCount: number; revenue: number }>) {
  return fields;
}
const z = () => d({});

// ============================================================
// 1) 다방이사 — DB(리드) 기반, 6개 매체, 8개 지표 행
// ============================================================
const dabangIsaConfig: BrandReportConfig = {
  brandId: 'dabang-isa',
  brandName: '다방이사',
  hasRealData: false,
  lineItems: [
    { key: 'meta', label: '메타' }, { key: 'danggeun', label: '당근' }, { key: 'naver', label: '네이버' },
    { key: 'google_sa', label: '구글 SA' }, { key: 'youtube', label: 'YouTube' }, { key: 'tiktok', label: '틱톡' },
  ],
  rowGroups: [
    { metric: 'db_count', label: 'DB 개수', totalLabel: '총 DB 개수', items: ['meta', 'danggeun', 'naver', 'google_sa', 'youtube', 'tiktok'] },
    { metric: 'clicks', label: '클릭수', totalLabel: '총 클릭수', items: ['meta', 'danggeun', 'naver', 'google_sa', 'youtube', 'tiktok'] },
    { metric: 'impressions', label: '노출수', totalLabel: '총 노출수', items: ['meta', 'danggeun', 'naver', 'google_sa', 'youtube', 'tiktok'] },
    { metric: 'ad_spend', label: '광고비', totalLabel: '총 광고비', items: ['meta', 'danggeun', 'naver', 'google_sa', 'youtube', 'tiktok'] },
    { metric: 'cost_per_db', label: 'DB 1개당 비용', totalLabel: 'DB 1개당 평균단가', items: ['meta', 'danggeun', 'naver', 'google_sa', 'youtube', 'tiktok'] },
    { metric: 'cpc', label: 'CPC', totalLabel: '전체 클릭당비용', items: ['meta', 'danggeun', 'naver', 'google_sa', 'youtube', 'tiktok'] },
    { metric: 'ctr', label: '클릭율', totalLabel: '총 클릭율', items: ['meta', 'danggeun', 'naver', 'google_sa', 'youtube', 'tiktok'] },
    { metric: 'conversion_rate', label: '전환율', totalLabel: '총 전환율', items: ['meta', 'danggeun', 'naver', 'google_sa', 'youtube', 'tiktok'] },
  ],
  monthlyBudget: 3_000_000,
};
const dabangIsaData: BrandDailyData = {
  meta: { '2026-07-01': d({ impressions: 0, clicks: 0, spend: 0, dbCount: 0 }), '2026-07-02': d({ impressions: 0, clicks: 0, spend: 0, dbCount: 0 }) },
  danggeun: { '2026-07-01': d({ impressions: 0, clicks: 0, spend: 0, dbCount: 0 }), '2026-07-02': d({ impressions: 0, clicks: 0, spend: 0, dbCount: 0 }) },
  naver: { '2026-07-01': d({ impressions: 0, clicks: 0, spend: 0, dbCount: 0 }), '2026-07-02': d({ impressions: 0, clicks: 0, spend: 0, dbCount: 0 }) },
  google_sa: { '2026-07-01': d({ impressions: 0, clicks: 0, spend: 0, dbCount: 0 }), '2026-07-02': d({ impressions: 0, clicks: 0, spend: 0, dbCount: 0 }) },
  youtube: { '2026-07-01': d({ impressions: 0, clicks: 0, spend: 0, dbCount: 0 }), '2026-07-02': d({ impressions: 0, clicks: 0, spend: 0, dbCount: 0 }) },
  tiktok: { '2026-07-01': d({ impressions: 0, clicks: 0, spend: 0, dbCount: 0 }), '2026-07-02': d({ impressions: 0, clicks: 0, spend: 0, dbCount: 0 }) },
};

// ============================================================
// 2) 노멜 — 매출/ROAS 기반 (자사몰+스마트스토어)
// ============================================================
const nomelConfig: BrandReportConfig = {
  brandId: 'nomel',
  brandName: '노멜',
  hasRealData: false,
  lineItems: [
    { key: 'facebook', label: '메타' }, { key: 'naver', label: '네이버' }, { key: 'gfa', label: 'GFA' },
    { key: 'google', label: '구글' }, { key: 'indirect', label: '간접전환' },
    { key: 'cafe24', label: '카페24' }, { key: 'smartstore', label: '스마트스토어' },
  ],
  rowGroups: [
    { metric: 'revenue', label: '매출 (채널 귀속)', items: ['facebook', 'naver', 'gfa', 'google', 'indirect'] },
    { metric: 'revenue', label: '매출 (판매채널)', totalLabel: '총 매출(자사몰+스마트스토어)', items: ['cafe24', 'smartstore'] },
    { metric: 'ad_spend', label: '광고비', totalLabel: '총 광고비', items: ['facebook', 'naver', 'gfa', 'google'] },
    {
      metric: 'roas', label: 'ROAS', totalLabel: '전체 ROAS', items: ['facebook', 'naver', 'gfa', 'google'],
      totalNumeratorItems: ['facebook', 'naver', 'gfa', 'google', 'indirect'],
    },
  ],
  monthlyBudget: 500_000,
};
const nomelData: BrandDailyData = {
  facebook: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  naver: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  gfa: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  google: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  indirect: { '2026-07-01': d({ revenue: 0 }), '2026-07-02': d({ revenue: 0 }) },
  cafe24: { '2026-07-01': d({ revenue: 0 }), '2026-07-02': d({ revenue: 0 }) },
  smartstore: { '2026-07-01': d({ revenue: 0 }), '2026-07-02': d({ revenue: 0 }) },
};

// ============================================================
// 3) 완도군수산 — 매출/ROAS 기반, 카카오모먼트 플친은 CPA로 대체 표시
// ============================================================
const wandoConfig: BrandReportConfig = {
  brandId: 'wando-fisheries',
  brandName: '완도군수산',
  hasRealData: false,
  lineItems: [
    { key: 'facebook', label: '메타' }, { key: 'naver', label: '네이버' }, { key: 'gfa', label: 'GFA(네이버 성과형)' },
    { key: 'kakao_keyword', label: '카카오키워드' }, { key: 'kakao_plus_friend', label: '카카오모먼트 플러스친구' },
    { key: 'mobion', label: '모비온' }, { key: 'adn', label: 'ADN' }, { key: 'indirect', label: '간접전환' },
    { key: 'cafe24', label: '카페24' }, { key: 'smartstore', label: '스마트스토어' },
  ],
  rowGroups: [
    { metric: 'revenue', label: '매출 (채널 귀속)', items: ['facebook', 'naver', 'gfa', 'kakao_keyword', 'mobion', 'adn', 'indirect'] },
    { metric: 'db_count', label: '친구추가 수', items: ['kakao_plus_friend'] },
    { metric: 'revenue', label: '매출 (판매채널)', totalLabel: '총 매출(카페24+스마트스토어)', items: ['cafe24', 'smartstore'] },
    { metric: 'ad_spend', label: '광고비', totalLabel: '총 광고비', items: ['facebook', 'naver', 'gfa', 'kakao_keyword', 'kakao_plus_friend', 'mobion', 'adn'] },
    {
      metric: 'roas', label: 'ROAS', totalLabel: '전체 ROAS', items: ['facebook', 'naver', 'gfa', 'kakao_keyword', 'kakao_plus_friend'],
      totalNumeratorItems: ['facebook', 'naver', 'gfa', 'kakao_keyword', 'mobion', 'adn', 'indirect'],
      itemOverrides: { kakao_plus_friend: { metric: 'cost_per_db', label: '카카오모먼트 플친 CPA' } },
    },
  ],
  monthlyBudget: 2_000_000,
};
const wandoData: BrandDailyData = {
  facebook: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  naver: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  gfa: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  kakao_keyword: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  kakao_plus_friend: { '2026-07-01': d({ spend: 0, dbCount: 0 }), '2026-07-02': d({ spend: 0, dbCount: 0 }) },
  mobion: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  adn: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  indirect: { '2026-07-01': d({ revenue: 0 }), '2026-07-02': d({ revenue: 0 }) },
  cafe24: { '2026-07-01': d({ revenue: 0 }), '2026-07-02': d({ revenue: 0 }) },
  smartstore: { '2026-07-01': d({ revenue: 0 }), '2026-07-02': d({ revenue: 0 }) },
};

// ============================================================
// 4) 다시마전복수산 — 매출/ROAS 기반, 채널 수가 가장 많음
// ============================================================
const dasimaConfig: BrandReportConfig = {
  brandId: 'dasima-abalone',
  brandName: '다시마전복수산',
  hasRealData: false,
  lineItems: [
    { key: 'facebook', label: '메타' }, { key: 'naver', label: '네이버' }, { key: 'gfa', label: 'GFA' },
    { key: 'kakao_keyword', label: '카카오키워드' }, { key: 'kakao_channel_add', label: '카카오모먼트 채널추가' },
    { key: 'mobion', label: '모비온' }, { key: 'adn', label: 'ADN' }, { key: 'google', label: '구글' },
    { key: 'indirect', label: '간접전환' }, { key: 'cafe24', label: '카페24' }, { key: 'smartstore', label: '스마트스토어' },
  ],
  rowGroups: [
    { metric: 'revenue', label: '매출 (채널 귀속)', items: ['facebook', 'naver', 'gfa', 'kakao_keyword', 'mobion', 'adn', 'google', 'indirect'] },
    { metric: 'revenue', label: '매출 (판매채널)', totalLabel: '총 매출(카페24+스마트스토어)', items: ['cafe24', 'smartstore'] },
    { metric: 'ad_spend', label: '광고비', totalLabel: '총 광고비', items: ['facebook', 'naver', 'gfa', 'kakao_keyword', 'kakao_channel_add', 'mobion', 'adn', 'google'] },
    {
      metric: 'roas', label: 'ROAS', totalLabel: '전체 ROAS', items: ['facebook', 'naver', 'gfa', 'kakao_keyword', 'mobion', 'adn', 'google'],
      totalNumeratorItems: ['facebook', 'naver', 'gfa', 'kakao_keyword', 'mobion', 'adn', 'google', 'indirect'],
      itemOverrides: { kakao_channel_add: { metric: 'cost_per_db', label: '카카오모먼트 채널추가당 비용' } },
    },
  ],
  monthlyBudget: 4_000_000,
};
const dasimaData: BrandDailyData = {
  facebook: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  naver: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  gfa: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  kakao_keyword: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  kakao_channel_add: { '2026-07-01': d({ spend: 0, dbCount: 0 }), '2026-07-02': d({ spend: 0, dbCount: 0 }) },
  mobion: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  adn: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  google: { '2026-07-01': d({ spend: 0, revenue: 0 }), '2026-07-02': d({ spend: 0, revenue: 0 }) },
  indirect: { '2026-07-01': d({ revenue: 0 }), '2026-07-02': d({ revenue: 0 }) },
  cafe24: { '2026-07-01': d({ revenue: 0 }), '2026-07-02': d({ revenue: 0 }) },
  smartstore: { '2026-07-01': d({ revenue: 0 }), '2026-07-02': d({ revenue: 0 }) },
};

// ============================================================
// 5) 서울우리아이치과 — 클릭/CPC 기반 (매출·전환 개념 없음)
// ============================================================
const dentalConfig: BrandReportConfig = {
  brandId: 'seoul-uriai-dental',
  brandName: '서울우리아이치과',
  hasRealData: false,
  lineItems: [
    { key: 'facebook', label: '메타' }, { key: 'naver', label: '네이버' }, { key: 'google', label: '구글' },
    { key: 'kakao_moment', label: '카카오모먼트' }, { key: 'gfa', label: 'GFA' }, { key: 'danggeun', label: '당근' },
  ],
  rowGroups: [
    { metric: 'clicks', label: '클릭수', totalLabel: '총 클릭수', items: ['facebook', 'naver', 'google', 'kakao_moment', 'gfa', 'danggeun'] },
    { metric: 'ad_spend', label: '광고비', totalLabel: '총 광고비', items: ['facebook', 'naver', 'google', 'kakao_moment', 'gfa', 'danggeun'] },
    { metric: 'cpc', label: '클릭당비용', totalLabel: '전체 클릭당비용', items: ['facebook', 'naver', 'google', 'kakao_moment', 'gfa', 'danggeun'] },
  ],
  monthlyBudget: 1_500_000,
};
const dentalData: BrandDailyData = {
  facebook: { '2026-07-01': d({ clicks: 0, spend: 0 }), '2026-07-02': d({ clicks: 0, spend: 0 }) },
  naver: { '2026-07-01': d({ clicks: 0, spend: 0 }), '2026-07-02': d({ clicks: 0, spend: 0 }) },
  google: { '2026-07-01': d({ clicks: 0, spend: 0 }), '2026-07-02': d({ clicks: 0, spend: 0 }) },
  kakao_moment: { '2026-07-01': d({ clicks: 0, spend: 0 }), '2026-07-02': d({ clicks: 0, spend: 0 }) },
  gfa: { '2026-07-01': d({ clicks: 0, spend: 0 }), '2026-07-02': d({ clicks: 0, spend: 0 }) },
  danggeun: { '2026-07-01': d({ clicks: 0, spend: 0 }), '2026-07-02': d({ clicks: 0, spend: 0 }) },
};

// ============================================================
// 6) 웰컴투바베큐 — 클릭/CPC 기반 (매장 방문 유도, 온라인 매출 없음)
// ============================================================
const bbqConfig: BrandReportConfig = {
  brandId: 'welcome-bbq',
  brandName: '웰컴투바베큐',
  hasRealData: false,
  lineItems: [
    { key: 'facebook', label: '메타' }, { key: 'naver', label: '네이버' },
    { key: 'google', label: '구글' }, { key: 'danggeun', label: '당근' },
  ],
  rowGroups: [
    { metric: 'clicks', label: '클릭수', totalLabel: '총 클릭수', items: ['facebook', 'naver', 'google', 'danggeun'] },
    { metric: 'ad_spend', label: '광고비', totalLabel: '총 광고비', items: ['facebook', 'naver', 'google', 'danggeun'] },
    { metric: 'cpc', label: '클릭당비용', totalLabel: '전체 클릭당비용', items: ['facebook', 'naver', 'google', 'danggeun'] },
  ],
  monthlyBudget: 800_000,
};
const bbqData: BrandDailyData = {
  facebook: { '2026-07-01': d({ clicks: 0, spend: 0 }), '2026-07-02': d({ clicks: 0, spend: 0 }) },
  naver: { '2026-07-01': d({ clicks: 0, spend: 0 }), '2026-07-02': d({ clicks: 0, spend: 0 }) },
  google: { '2026-07-01': d({ clicks: 0, spend: 0 }), '2026-07-02': d({ clicks: 0, spend: 0 }) },
  danggeun: { '2026-07-01': d({ clicks: 0, spend: 0 }), '2026-07-02': d({ clicks: 0, spend: 0 }) },
};

// ============================================================
// 캡처가 없는 나머지 광고주 — 예시 구성 (hasRealData: false)
// 실제 보고서 캡처를 주시면 위 브랜드들과 동일한 방식으로 그대로 교체됩니다.
// ============================================================
function placeholderClickBrand(brandId: string, brandName: string): { config: BrandReportConfig; data: BrandDailyData } {
  const config: BrandReportConfig = {
    brandId, brandName, hasRealData: false,
    lineItems: [{ key: 'meta', label: '메타' }, { key: 'naver', label: '네이버' }],
    rowGroups: [
      { metric: 'clicks', label: '클릭수', totalLabel: '총 클릭수', items: ['meta', 'naver'] },
      { metric: 'ad_spend', label: '광고비', totalLabel: '총 광고비', items: ['meta', 'naver'] },
      { metric: 'cpc', label: '클릭당비용', totalLabel: '전체 클릭당비용', items: ['meta', 'naver'] },
    ],
  };
  const data: BrandDailyData = {
    meta: { '2026-07-01': d({ clicks: 0, spend: 0 }), '2026-07-02': d({ clicks: 0, spend: 0 }) },
    naver: { '2026-07-01': d({ clicks: 0, spend: 0 }), '2026-07-02': d({ clicks: 0, spend: 0 }) },
  };
  return { config, data };
}

function placeholderDbBrand(brandId: string, brandName: string): { config: BrandReportConfig; data: BrandDailyData } {
  const config: BrandReportConfig = {
    brandId, brandName, hasRealData: false,
    lineItems: [{ key: 'meta', label: '메타' }, { key: 'naver', label: '네이버' }],
    rowGroups: [
      { metric: 'db_count', label: 'DB 개수', totalLabel: '총 DB 개수', items: ['meta', 'naver'] },
      { metric: 'ad_spend', label: '광고비', totalLabel: '총 광고비', items: ['meta', 'naver'] },
      { metric: 'cost_per_db', label: 'DB 1개당 비용', totalLabel: 'DB 1개당 평균단가', items: ['meta', 'naver'] },
    ],
  };
  const data: BrandDailyData = {
    meta: { '2026-07-01': d({ spend: 0, dbCount: 0 }), '2026-07-02': d({ spend: 0, dbCount: 0 }) },
    naver: { '2026-07-01': d({ spend: 0, dbCount: 0 }), '2026-07-02': d({ spend: 0, dbCount: 0 }) },
  };
  return { config, data };
}

export const BRAND_REPORTS: { config: BrandReportConfig; data: BrandDailyData }[] = [
  { config: dabangIsaConfig, data: dabangIsaData },
  { config: nomelConfig, data: nomelData },
  { config: wandoConfig, data: wandoData },
  { config: dasimaConfig, data: dasimaData },
  { config: dentalConfig, data: dentalData },
  { config: bbqConfig, data: bbqData },
  placeholderDbBrand('renda-direct', '렌다다이렉트 (알에스컴퍼니)'),
  placeholderDbBrand('lotte-rentacar', '롯데렌터카 (알에스컴퍼니)'),
  placeholderClickBrand('on-animal-hospital', '온동물병원'),
  placeholderDbBrand('smart-rentcar', '스마트렌트카'),
  placeholderDbBrand('sincha-recipe', '신차레시피'),
  placeholderClickBrand('kkondae-bbq-gangnam', '꼰대김부장고깃집 강남역점 (멋진이유)'),
];
