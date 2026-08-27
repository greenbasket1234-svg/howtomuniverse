import type { MonthlyKpiTotals, MonthlyReportData, MediaPerformanceRow } from './monthlyReportData';
import { loadProposalSettings, type ProposalCalculationSettings } from './proposalSettings';

// 신규 매체 예산 비율, 증액·감액 폭 등 계산 기준값입니다. 환경설정 > 제안 계산 기준에서
// 저장한 값을 buildNextMonthProposal 호출 시작 시 여기에 로드해서, 이 파일의 하위 계산
// 함수들이 함수 인자로 일일이 전달받지 않고 참조합니다(단일 스레드 UI 컨텍스트라 안전).
let calcSettings: ProposalCalculationSettings = loadProposalSettings();

export type BudgetAction = '증액' | '감액' | '유지' | '광고 중지';

export type ProposalMediaRow = MediaPerformanceRow & {
  action: BudgetAction;
  proposedSpend: number;
  budgetChangePercent: number;
  expectedImpressions: number;
  expectedClicks: number;
  expectedLeads: number;
  expectedPurchases: number;
  expectedRevenue: number;
  expectedRoas: number;
  reason: string;
  // 사용자 지정형에서 매체별 예산 증액·감액 판단에 실제로 사용한 커스텀 지표입니다.
  customBasis?: { id: string; name: string; unit: string; value: number; target: number; direction: 'up' | 'down' | 'neutral'; aggregation: 'sum' | 'ratio' | 'average' | 'last' };
};

export type NewPlatformSuggestion = {
  platform: string;
  proposedBudget: number;
  expectedImpressions: number;
  expectedClicks: number;
  expectedLeads: number;
  expectedPurchases: number;
  expectedCpa: number;
  expectedReach: number;
  expectedCpm: number;
  expectedRevenue: number;
  expectedRoas: number;
  reason: string;
  guide: {
    targeting: string[];
    message: string[];
    campaign: string[];
    expectedNote: string;
    tips: string[];
  };
};

export type NextMonthProposalData = {
  advertiserName: string;
  sourceMonth: string;
  targetMonth: string;
  reportType: MonthlyReportData['reportType'];
  current: MonthlyKpiTotals;
  target: MonthlyKpiTotals;
  mediaRows: ProposalMediaRow[];
  proposals: string[];
  isSample?: boolean;
  // 사용자 지정형에서 저장된 커스텀 지표(환경설정에서 만든 수식)의 이번 달 실적과 다음달
  // 기대값입니다. 전체 KPI 목표용이며, 매체별 증액·감액 판단은 ProposalMediaRow.customBasis에
  // 저장된 매체별 커스텀 지표 값을 우선 사용합니다.
  customMetrics?: { id: string; name: string; unit: string; current: number; target: number; direction: 'up' | 'down' | 'neutral' }[];
  newPlatformSuggestion?: NewPlatformSuggestion;
};

function addMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(year, monthNumber, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function safeDivide(a: number, b: number) { return b > 0 ? a / b : 0; }
function sum<T>(rows: T[], getter: (row: T) => number) { return rows.reduce((total, row) => total + getter(row), 0); }
function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pickCustomBasis(row: MediaPerformanceRow, data: MonthlyReportData) {
  if (data.reportType !== 'custom') return undefined;
  // 사용자가 환경설정에서 고른 순서대로 커스텀 지표를 확인합니다. 그 매체에서 계산되지 않는
  // 지표(원본 데이터 자체가 없는 경우)나 중립형(direction:'neutral', 좋고 나쁨을 판단할 수
  // 없는 지표)은 건너뛰고, 판단에 쓸 수 있는(direction이 up 또는 down인) 첫 지표를 찾습니다.
  const ordered = (data.customMetrics ?? [])
    .map(metric => row.customMetrics?.find(item => item.id === metric.id))
    .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));
  return ordered.find(metric => metric.direction !== 'neutral') ?? ordered[0];
}

function customMetricScore(row: MediaPerformanceRow, data: MonthlyReportData) {
  const basis = pickCustomBasis(row, data);
  if (!basis) return null;
  // 중립형(direction:'neutral')은 높고 낮음으로 좋고 나쁨을 판단할 수 없는 지표입니다.
  // 예산 증액·감액 판단 기준으로 쓰면 안 되므로, 판단 불가로 처리해 표준 지표로 폴백시킵니다.
  if (basis.direction === 'neutral') return null;
  const value = basis.value;
  if (!Number.isFinite(value)) return null;
  // 합계형은 매체 규모가 클수록 커질 수 있으므로 광고비 대비 효율로 비교합니다.
  // 비율형·평균형·최종값형은 이미 효율/상태값인 경우가 많아 값 자체를 비교합니다.
  const rawScore = basis.aggregation === 'sum' ? safeDivide(value, row.spend) : value;
  // '낮을수록 좋음' 지표(예: 환불률·계약당비용)는 값이 작을수록 좋은 성과입니다. 값이 정확히
  // 0이면(예: 환불률 0%) 최상의 결과이므로 무한대에 가까운 매우 좋은 점수로 취급해야지,
  // 계산 불가로 취급하면 안 됩니다.
  const score = basis.direction === 'down' ? (rawScore <= 0 ? Number.MAX_SAFE_INTEGER : safeDivide(1, rawScore)) : rawScore;
  return Number.isFinite(score) ? { basis, score } : null;
}

function efficiencyScore(row: MediaPerformanceRow, type: MonthlyReportData['reportType'], data?: MonthlyReportData) {
  if (type === 'custom' && data) {
    const custom = customMetricScore(row, data);
    if (custom) return custom.score;
  }
  if (type === 'revenue') return safeDivide(row.revenue, row.spend);
  if (type === 'click') return safeDivide(row.clicks, row.spend);
  if (type === 'reach') return safeDivide(row.reach || row.impressions, row.spend);
  if (type === 'integrated') {
    const revenueScore = safeDivide(row.revenue, row.spend);
    const leadScore = safeDivide(row.leads * 50000, row.spend);
    const clickScore = safeDivide(row.clicks * 500, row.spend);
    return revenueScore + leadScore + clickScore;
  }
  return safeDivide(row.leads, row.spend);
}

function expectedCustomTarget(basis: NonNullable<ReturnType<typeof pickCustomBasis>>, performanceFactor: number, change: number) {
  if (basis.aggregation === 'sum') {
    // '낮을수록 좋음'인 합계형 지표(예: 불량 DB 수)는 예산 증가율(performanceFactor)을 그대로
    // 곱하면, 예산이 늘어난 매체일수록 절대 기대값도 함께 증가해 "기대 성과"가 오히려
    // 악화되는 모순이 생깁니다. 이 경우 예산 증감과 무관하게 항상 개선된 값으로 계산합니다.
    if (basis.direction === 'down') return Math.round(basis.value * (1 - calcSettings.lowerIsBetterImprovementPercent / 100) * 100) / 100;
    return Math.round(basis.value * performanceFactor * 100) / 100;
  }
  if (basis.aggregation === 'last') return basis.value;
  // 비율·평균형은 광고비 증감에 그대로 비례시키지 않고, 예산 판단 결과에 맞춰 보수적으로만 조정합니다.
  const directionFactor = basis.direction === 'down'
    ? change > 0 ? 0.97 : change < 0 ? 1.02 : 0.99
    : change > 0 ? 1.03 : change < 0 ? 0.98 : 1.01;
  return Math.round(basis.value * directionFactor * 100) / 100;
}

function decideAction(row: MediaPerformanceRow, score: number, medianScore: number, type: MonthlyReportData['reportType'], basis?: NonNullable<ReturnType<typeof pickCustomBasis>>): { action: BudgetAction; change: number; reason: string; uplift: number } {
  // '낮을수록 좋음' 지표(환불률·계약당비용 등)는 값이 0이면 오히려 최상의 성과이므로, 아래
  // "핵심 성과가 발생하지 않음" 판정에서 제외해야 합니다. 중립형(neutral)은 이 함수에 basis로
  // 전달되지 않도록 이미 customMetricScore에서 걸러지지만, 혹시 남아있어도 무시합니다.
  const basisIsLowerBetter = basis?.direction === 'down';
  const primary = basis ? (basisIsLowerBetter ? (basis.value <= 0 ? 1 : basis.value) : basis.value) : type === 'revenue' ? row.revenue
    : type === 'click' ? row.clicks
    : type === 'reach' ? row.reach || row.impressions
    : type === 'integrated' ? (row.revenue || row.leads || row.clicks || row.reach || row.impressions)
    : row.leads;
  const basisName = basis?.name;
  if (row.spend <= 0) return { action: '광고 중지', change: -100, reason: '집행 실적이 없어 다음달 예산 배정에서 제외합니다.', uplift: 0 };
  // '낮을수록 좋음' 지표는 값이 0 이하라도 중지 사유가 아니므로 이 조건을 건너뜁니다.
  if (!basisIsLowerBetter && primary <= 0) return { action: '광고 중지', change: -100, reason: basisName ? `${basisName}이 산출되지 않아 중지 후 수식 입력값·캠페인 구조를 점검합니다.` : '핵심 성과가 발생하지 않아 중지 후 소재·타기팅 재설계를 제안합니다.', uplift: 0 };
  if (medianScore > 0 && score >= medianScore * 1.25) return { action: '증액', change: calcSettings.increasePercent, reason: basisName ? `${basisName} 기준 효율이 매체 평균보다 높아 예산을 확대하고 성과 볼륨을 확보합니다.` : '평균보다 효율이 높아 예산을 확대하고 성과 볼륨을 확보합니다.', uplift: 1.06 };
  if (medianScore > 0 && score < medianScore * 0.7) return { action: '감액', change: -calcSettings.decreasePercent, reason: basisName ? `${basisName} 기준 효율이 매체 평균보다 낮아 예산을 줄이고 수식 입력값·소재를 함께 점검합니다.` : '평균 대비 효율이 낮아 예산을 줄이고 개선 테스트를 우선합니다.', uplift: 0.98 };
  return { action: '유지', change: 0, reason: basisName ? `${basisName} 기준 효율이 안정권이라 현 예산을 유지하며 세부 테스트를 병행합니다.` : '효율이 안정적이므로 현 예산을 유지하며 소재 교체 테스트를 병행합니다.', uplift: 1.02 };
}

// 아직 쓰지 않는 매체를 추천할 때 함께 보여줄 운영 가이드입니다. 매체별로 실무에서 통용되는
// 타겟팅·소재·캠페인 설정 방향을 담았습니다. 목록에 없는 매체는 신규 추천 대상에서 제외합니다.
const PLATFORM_GUIDE_TEMPLATES: Record<string, { targeting: string[]; message: string[]; campaign: string[]; tips: string[] }> = {
  '카카오모먼트': {
    targeting: ['연령: 핵심 구매 연령대 위주로 좁혀서 시작', '지역: 주력 상권·서비스 권역 우선 배포', '관심사: 업종과 밀접한 관심사 카테고리 선택', '행동 타겟팅: 관련 서비스 앱 사용 이력자'],
    message: ['메시지 방향: 가격 소구형·불안 해소형·편의성 강조형을 각각 1개 소재로 테스트', '소재 제작 팁: 비포/애프터 이미지, 실제 후기 캡처, 신뢰 요소(자격증·장비 등) 노출'],
    campaign: ['캠페인 목적: 카카오톡 메시지 전송(즉시 상담) 우선, 채널 친구 추가는 리타게팅용', '노출 지면: 카카오톡 채널 탭 홈, 채팅방 상단 배너 우선', '입찰 전략: 1~2주차 자동 입찰로 데이터 수집 후 3주차부터 목표 CPA로 수동 전환'],
    tips: ['카톡 유입 고객은 빠른 응답을 기대하므로 10분 내 응답 체계가 중요합니다.', '성수기에는 타겟팅을 넓히고 일 예산을 상향해 점유율을 선점합니다.'],
  },
  '틱톡': {
    targeting: ['연령: 20~30대 중심으로 시작 후 반응 보며 확장', '관심사: 트렌드·라이프스타일 관심사 위주', '유사 타겟: 기존 전환 고객 기반 유사 타겟 활용'],
    message: ['메시지 방향: 숏폼 특유의 빠른 후킹(3초 이내 핵심 전달)', '소재 제작 팁: 세로 풀스크린 영상, 자막 필수, 트렌드 사운드 활용'],
    campaign: ['캠페인 목적: 트래픽 또는 전환 목적으로 시작', '노출 지면: 피드 자동 재생 영역 우선', '입찰 전략: 초반 2주는 자동 입찰로 학습 데이터 확보'],
    tips: ['소재 피로도가 빠르게 오르므로 2주 단위로 새 소재를 준비합니다.', '숏폼 특성상 초반 3초 이탈률을 반드시 모니터링합니다.'],
  },
  '유튜브': {
    targeting: ['연령·성별: 핵심 고객층 기준 설정', '관심사: 관련 카테고리 시청자 타겟팅', '리마케팅: 사이트 방문자·기존 영상 시청자 대상'],
    message: ['메시지 방향: 스토리텔링형 브랜드 인지 확산', '소재 제작 팁: 15초 범퍼 광고와 30초 인스트림 광고를 함께 운영'],
    campaign: ['캠페인 목적: 인지도·도달 또는 액션(전환) 목적', '노출 지면: 인스트림, 인피드 동영상', '입찰 전략: CPV 낮은 타겟부터 확장'],
    tips: ['조회율(VTR)을 CTR과 함께 핵심 지표로 관리합니다.', '브랜드 인지도 목적이면 전환보다 도달·조회 지표로 평가합니다.'],
  },
  '인스타그램': {
    targeting: ['연령: 핵심 구매 연령대', '관심사: 라이프스타일·비주얼 소비 성향 타겟', '유사 타겟: 기존 팔로워·구매 고객 기반 확장'],
    message: ['메시지 방향: 비주얼 중심의 감성 소구', '소재 제작 팁: 릴스 형태의 세로 영상, 캐러셀로 다양한 각도 노출'],
    campaign: ['캠페인 목적: 트래픽·전환 또는 참여(팔로워 증가)', '노출 지면: 릴스, 피드, 스토리', '입찰 전략: 자동 입찰로 시작 후 안정화되면 목표 비용 설정'],
    tips: ['비주얼 완성도가 성과에 직결되므로 소재 퀄리티에 투자합니다.', '스토리 광고는 24시간 내 소멸되므로 순환 게재 일정이 필요합니다.'],
  },
  '모비온': {
    targeting: ['리타게팅 중심: 사이트 방문·장바구니 이탈 고객', '유사 세그먼트: 구매 고객 데이터 기반 확장'],
    message: ['메시지 방향: 개인화 추천 상품·가격 혜택 강조', '소재 제작 팁: 동적 상품 이미지(DPA) 활용'],
    campaign: ['캠페인 목적: 리타게팅 전환 극대화', '노출 지면: 제휴 매체 네트워크 배너', '입찰 전략: 목표 ROAS 기준 자동 입찰'],
    tips: ['신규 방문자 볼륨이 먼저 확보돼야 리타게팅 효과가 커집니다.', '광고 피로도 방지를 위해 노출 빈도 상한을 설정합니다.'],
  },
};

// 같은 매체를 가리키는 여러 이름(예: 'YouTube AD'와 '유튜브')을 하나의 정규화된 키로
// 묶어서 비교합니다. 이게 없으면 이미 운영 중인 매체를 "아직 안 쓰는 매체"로 착각해
// 중복 추천할 수 있습니다.
const PLATFORM_ALIAS_GROUPS: string[][] = [
  ['유튜브', 'YouTube AD', 'YouTube'],
  ['인스타그램', 'Instagram'],
  // 카카오키워드(검색 광고)와 카카오모먼트(디스플레이·메시지 광고)는 운영 목적과 노출
  // 지면이 서로 다른 별도 상품이라 함께 운영할 수 있으므로, 하나로 묶지 않고 분리합니다.
  ['카카오모먼트', '카카오'],
  ['카카오키워드'],
  ['구글', '구글 SA', 'Google', 'Google SA'],
];
function normalizePlatformName(name: string): string {
  const group = PLATFORM_ALIAS_GROUPS.find(aliases => aliases.includes(name));
  return group ? group[0] : name;
}

// 아직 쓰지 않는 매체 중 하나를 추천합니다. 데이터가 있는 매체 수가 적을수록(다각화 여지가
// 있을수록) 추천하고, 이미 6개 이상 운영 중이면 추가 제안을 생략합니다.
function suggestNewPlatform(data: MonthlyReportData, existingPlatforms: string[], avgCpa: number, avgPurchaseCpa: number, avgCtr: number, avgRoas: number, avgReachRatio: number, totalBudgetForNext: number): NewPlatformSuggestion | undefined {
  if (existingPlatforms.length >= 8) return undefined;
  // 다음달 총 예산 자체가 없으면 시범 예산도 0원이 되어 의미 없는 제안이 생성됩니다.
  // 실제로 배정할 예산이 있을 때만 추천합니다.
  if (totalBudgetForNext <= 0) return undefined;
  const normalizedExisting = new Set(existingPlatforms.map(normalizePlatformName));
  const candidateOrder = data.reportType === 'revenue' ? ['카카오모먼트', '인스타그램', '틱톡', '유튜브']
    : data.reportType === 'reach' ? ['유튜브', '인스타그램', '틱톡', '카카오모먼트']
    : ['카카오모먼트', '틱톡', '유튜브', '인스타그램', '모비온'];
  const candidate = candidateOrder.find(name => !normalizedExisting.has(normalizePlatformName(name)) && PLATFORM_GUIDE_TEMPLATES[name]);
  if (!candidate) return undefined;
  const guideTemplate = PLATFORM_GUIDE_TEMPLATES[candidate];
  // 신규 매체 예산은 다음달 전체 예산의 8~12% 수준으로, 기존 매체의 평균 CPA·CTR을
  // 벤치마크로 삼아 보수적으로 예상 성과를 추정합니다.
  const proposedBudget = Math.round(totalBudgetForNext * calcSettings.newPlatformBudgetRatio);
  const safeCpa = avgCpa > 0 ? avgCpa * 1.15 : calcSettings.defaultInitialCpa; // 신규 매체는 초기 학습 구간이라 다소 보수적으로
  const safeCtr = avgCtr > 0 ? avgCtr * 0.85 : 0.008;
  const expectedImpressions = Math.round(proposedBudget / 15); // CPM 약 15원 가정(대략치)
  const expectedClicks = Math.round(expectedImpressions * safeCtr);
  const expectedLeads = data.reportType === 'revenue' ? 0 : (safeCpa > 0 ? Math.round(proposedBudget / safeCpa) : 0);
  const expectedPurchases = data.reportType === 'revenue' && avgPurchaseCpa > 0 ? Math.round(proposedBudget / (avgPurchaseCpa * 1.15)) : 0;
  // 매출 실적이 전혀 없는 광고주(DB형·클릭형·도달형 등)에서 임의의 ROAS 기본값(250%)으로
  // 매출을 만들어내면, 근거 없는 "전체 주문 매출"이 표지·자동 문구에 생길 수 있습니다.
  // 매출 실적이 있을 때만 벤치마크를 적용하고, 없으면 0으로 둡니다(매출형·통합형에서
  // 실제 매출 이력이 있는 경우에만 신규 매체 기대 매출이 계산됩니다).
  const safeRoas = avgRoas > 0 ? avgRoas * 0.9 : 0;
  const expectedRevenue = Math.round(proposedBudget * (safeRoas / 100));
  const expectedReach = Math.round(expectedImpressions * (avgReachRatio > 0 ? Math.min(0.9, avgReachRatio) : 0.7));
  const expectedCpm = expectedImpressions > 0 ? Math.round((proposedBudget / expectedImpressions) * 1000) : 0;
  return {
    platform: candidate,
    proposedBudget,
    expectedImpressions,
    expectedClicks,
    expectedLeads,
    expectedPurchases,
    expectedCpa: Math.round(safeCpa),
    expectedReach,
    expectedCpm,
    expectedRevenue,
    expectedRoas: Math.round(safeRoas),
    reason: `현재 ${existingPlatforms.length}개 매체를 운영 중이며, ${candidate}는 아직 시도하지 않았습니다. 기존 매체 평균 효율을 벤치마크로 다음달 예산의 약 10%를 시범 배정해 신규 채널 확장 가능성을 검증합니다.`,
    guide: {
      targeting: guideTemplate.targeting,
      message: guideTemplate.message,
      campaign: guideTemplate.campaign,
      expectedNote: `월 예산 ${Math.round(proposedBudget).toLocaleString()}원 기준 예상치이며, 실제 성과는 초기 2주 학습 기간 이후 안정화됩니다. 신규 매체의 광고 귀속 매출은 기존 매체와 전환이 겹칠 수 있어, 전체 목표 매출에는 이 매출의 약 40%만 순수 증분으로 반영했습니다.`,
      tips: guideTemplate.tips,
    },
  };
}

export function buildNextMonthProposal(data: MonthlyReportData): NextMonthProposalData {
  calcSettings = loadProposalSettings();
  const paidMediaRows = data.mediaTable.filter(row => !['카페24', '스마트스토어'].includes(row.platform));
  const customScoreInfo = paidMediaRows.map(row => data.reportType === 'custom' ? customMetricScore(row, data) : null);
  const scores = paidMediaRows.map((row, index) => customScoreInfo[index]?.score ?? efficiencyScore(row, data.reportType, data));
  const middle = median(scores);
  const mediaRows: ProposalMediaRow[] = paidMediaRows.map((row, index) => {
    const basis = customScoreInfo[index]?.basis;
    const decision = decideAction(row, scores[index], middle, data.reportType, basis);
    const spendFactor = Math.max(0, 1 + decision.change / 100);
    const performanceFactor = spendFactor * decision.uplift;
    const proposedSpend = Math.round(row.spend * spendFactor);
    const expectedImpressions = Math.round(row.impressions * performanceFactor);
    const expectedClicks = Math.round(row.clicks * performanceFactor);
    const expectedLeads = Math.round(row.leads * performanceFactor);
    const expectedPurchases = Math.round(row.purchases * performanceFactor);
    const expectedRevenue = Math.round(row.revenue * performanceFactor);
    const customBasis = basis ? { ...basis, target: expectedCustomTarget(basis, performanceFactor, decision.change) } : undefined;
    return {
      ...row,
      action: decision.action,
      budgetChangePercent: decision.change,
      proposedSpend,
      expectedImpressions,
      expectedClicks,
      expectedLeads,
      expectedPurchases,
      expectedRevenue,
      expectedRoas: proposedSpend > 0 ? expectedRevenue / proposedSpend * 100 : 0,
      reason: decision.reason,
      customBasis,
    };
  });

  const spend = sum(mediaRows, row => row.proposedSpend);
  const impressions = sum(mediaRows, row => row.expectedImpressions);
  const clicks = sum(mediaRows, row => row.expectedClicks);
  const leads = sum(mediaRows, row => row.expectedLeads);
  const purchases = sum(mediaRows, row => row.expectedPurchases);
  // 광고 매체 귀속 매출(paidMediaRows)과 카페24·스마트스토어 같은 주문 채널 매출을 각각 더하면,
  // 광고 귀속 매출이 이미 전체 주문 매출에 포함된 개념이라 매출이 이중으로 잡힙니다(예: 실제
  // 500% ROAS인데 다음달 예상이 765%로 튀는 문제). 그래서 매출은 "더하기"가 아니라, 광고
  // 매체들의 평균적인 기대 성장률을 이번 달 실제 총매출(주문 채널 포함) 하나에 곱하는 방식으로
  // 바꿨습니다 — 서로 다른 두 숫자를 합치지 않으므로 중복 집계 자체가 구조적으로 생기지 않습니다.
  const paidMediaCurrentRevenue = sum(paidMediaRows, row => row.revenue);
  const paidMediaExpectedRevenue = sum(mediaRows, row => row.expectedRevenue);
  const revenueGrowthFactor = paidMediaCurrentRevenue > 0 ? paidMediaExpectedRevenue / paidMediaCurrentRevenue : 1;
  const revenue = Math.round(data.current.revenue * revenueGrowthFactor);
  const reachRatio = data.current.impressions > 0 ? data.current.reach / data.current.impressions : 0.72;
  const reach = Math.round(impressions * Math.min(0.92, Math.max(0.45, reachRatio || 0.72)));
  // 결제·환불도 이번 달 실제 비율(결제/매출, 환불/결제)을 다음달 예상 매출에 그대로 적용합니다.
  // revenue가 이미 단일 기준(이번 달 총매출 × 성장률)이므로 별도로 더할 값이 없습니다.
  const paymentRatio = data.current.revenue > 0 ? data.current.payments / data.current.revenue : 0.93;
  const refundRatio = data.current.payments > 0 ? data.current.refunds / data.current.payments : 0.06;
  const payments = Math.round(revenue * Math.min(1, Math.max(0, paymentRatio)));
  const refunds = Math.round(payments * Math.min(0.2, Math.max(0, refundRatio)));
  const target: MonthlyKpiTotals = {
    impressions,
    clicks,
    spend,
    leads,
    purchases,
    revenue,
    reach,
    payments,
    refunds,
    ctr: safeDivide(clicks, impressions) * 100,
    cpc: safeDivide(spend, clicks),
    cvr: safeDivide(leads, clicks) * 100,
    cpa: safeDivide(spend, leads),
    roas: safeDivide(revenue, spend) * 100,
    cpm: safeDivide(spend, impressions) * 1000,
    frequency: safeDivide(impressions, reach),
    netRevenue: payments - refunds,
  };

  // 사용자 지정형(그리고 다른 유형이라도 커스텀 지표를 쓰고 있으면)에서, 저장된 커스텀 지표의
  // 다음달 기대값을 함께 계산합니다. 집계 방식(aggregationType)과 판정 방향(direction), 전월
  // 대비 추세를 함께 반영합니다.
  // - 합계형(sum): 물량 지표이므로 광고비 성장률을 그대로 적용합니다.
  // - 비율형(ratio)·평균형(average): 광고비가 늘어난다고 비례하지 않으므로, 전월 대비 이번 달
  //   추세를 절반만 반영해 완만하게 이어갑니다. direction이 'down'(낮을수록 좋음)인 지표는
  //   추세가 개선되는 쪽(값이 낮아지는 쪽)으로 살짝 더 반영합니다.
  // - 최종값형(last): 특정 시점의 값(예: 최근 잔여 예산)이라 추세를 곱하는 게 의미가 없어
  //   이번 달 값을 그대로 유지합니다.
  const spendGrowthFactor = data.current.spend > 0 ? spend / data.current.spend : 1;
  // 산출 불가(NaN, 예: 결제 0건일 때 환불률)인 커스텀 지표는 다음달 목표를 계산하지 않고
  // 통째로 제외합니다. 포함시키면 NaN이 카드·차트·자동 문구에 그대로 노출되거나 다른
  // 계산에 전파될 수 있습니다.
  const customMetrics = (data.customMetrics ?? []).filter(metric => Number.isFinite(metric.current)).map(metric => {
    let target: number;
    if (metric.aggregation === 'sum') {
      if (metric.direction === 'down') {
        // '낮을수록 좋음'인 합계형 지표(예: 불량 DB 수, 클레임 건수)는 광고비 성장률이나
        // 비율을 곱하면 광고비가 그만큼 이상 늘어날 때 절대 목표값이 여전히 증가할 수
        // 있습니다. "목표"라는 표현에 맞게 광고비 증감과 무관하게 항상 현재값보다 개선된
        // (2% 낮은) 절대값으로 고정합니다.
        target = Math.round(metric.current * (1 - calcSettings.lowerIsBetterImprovementPercent / 100) * 100) / 100;
      } else {
        target = Math.round(metric.current * spendGrowthFactor);
      }
    } else if (metric.aggregation === 'last') {
      target = metric.current;
    } else {
      const trendFactor = metric.previous > 0 ? metric.current / metric.previous : 1;
      // 추세가 "개선되는 방향"일 때만 그 추세를 절반만 완만하게 반영합니다. 추세가 악화되는
      // 방향이면(예: 낮을수록 좋은 지표인데 값이 오르고 있는 경우) 그 나쁜 추세를 다음달
      // 목표로 그대로 연장하지 않고, 대신 현재값 대비 소폭 개선(2%)하는 보수적 목표를 세웁니다.
      const isImproving = metric.direction === 'down' ? trendFactor <= 1 : metric.direction === 'up' ? trendFactor >= 1 : true;
      if (metric.direction === 'neutral' || !isImproving) {
        // 중립형이거나 추세가 나빠지는 중이면, 추세를 따라가지 않고 현재값 기준 소폭
        // 개선(direction이 있으면 그 방향으로 2%, 중립이면 그대로 유지)만 반영합니다.
        const nudge = metric.direction === 'down' ? 0.98 : metric.direction === 'up' ? 1.02 : 1;
        target = Math.round(metric.current * nudge * 100) / 100;
      } else {
        const dampedTrend = 1 + (trendFactor - 1) * 0.5;
        target = Math.round(metric.current * Math.max(0.5, Math.min(1.5, dampedTrend)) * 100) / 100;
      }
    }
    return {
      id: metric.id,
      name: metric.name,
      unit: metric.unit,
      current: metric.current,
      target,
      direction: metric.direction,
    };
  });

  const increase = mediaRows.filter(row => row.action === '증액').map(row => row.platform);
  const decrease = mediaRows.filter(row => row.action === '감액').map(row => row.platform);
  const pause = mediaRows.filter(row => row.action === '광고 중지').map(row => row.platform);
  const summaryLine =
    data.reportType === 'revenue'
      ? `기대 성과는 구매 전환 ${purchases.toLocaleString()}건, 매출 ${Math.round(revenue).toLocaleString()}원, ROAS ${(safeDivide(revenue, spend) * 100).toFixed(1)}%이며 실제 주간 성과에 따라 10~15% 범위에서 재조정합니다.`
      : data.reportType === 'click'
      ? `기대 성과는 클릭 ${clicks.toLocaleString()}건, CTR ${(safeDivide(clicks, impressions) * 100).toFixed(2)}%이며 실제 주간 성과에 따라 10~15% 범위에서 재조정합니다.`
      : data.reportType === 'reach'
      ? `기대 성과는 노출 ${impressions.toLocaleString()}회, 도달 ${reach.toLocaleString()}명이며 실제 주간 성과에 따라 10~15% 범위에서 재조정합니다.`
      : data.reportType === 'custom' && customMetrics.length
      ? (() => {
          const directional = customMetrics.filter(m => m.direction !== 'neutral').slice(0, 2);
          const neutralOnes = customMetrics.filter(m => m.direction === 'neutral').slice(0, 2 - directional.length);
          const mainPart = directional.length
            ? `기대 성과는 ${directional.map(m => `${m.name} ${m.target.toLocaleString()}${m.unit}`).join(', ')}`
            : '기대 성과는 초기 2주 데이터 수집 후 산출 예정';
          const neutralPart = neutralOnes.length ? ` (참고 지표: ${neutralOnes.map(m => `${m.name} ${m.target.toLocaleString()}${m.unit}`).join(', ')})` : '';
          return `${mainPart}${neutralPart}이며 실제 주간 성과에 따라 10~15% 범위에서 재조정합니다.`;
        })()
      : data.reportType === 'integrated'
      ? `기대 성과는 클릭 ${clicks.toLocaleString()}건, DB ${leads.toLocaleString()}건, 전체 주문 매출 ${Math.round(revenue).toLocaleString()}원, ROAS ${(safeDivide(revenue, spend) * 100).toFixed(1)}%이며 실제 주간 성과에 따라 10~15% 범위에서 재조정합니다.`
      : `기대 성과는 클릭 ${clicks.toLocaleString()}건, DB ${leads.toLocaleString()}건, CPA ${Math.round(safeDivide(spend, leads)).toLocaleString()}원이며 실제 주간 성과에 따라 10~15% 범위에서 재조정합니다.`;
  const proposals = [
    `다음달 총 광고비는 ${Math.round(spend).toLocaleString()}원으로 제안하며, 이번 달 대비 ${data.current.spend > 0 ? ((spend / data.current.spend - 1) * 100).toFixed(1) : '0.0'}% 조정합니다.`,
    increase.length ? `${increase.join(', ')}는 효율 우수 매체로 판단해 예산을 단계적으로 증액합니다.` : '효율이 압도적으로 높은 매체가 없어 무리한 증액보다 안정 운영을 우선합니다.',
    decrease.length ? `${decrease.join(', ')}는 예산을 감액하고 소재·타기팅 개선 후 재평가합니다.` : '감액 대상 없이 현재 예산 구조를 유지합니다.',
    pause.length ? `${pause.join(', ')}는 핵심 성과가 없어 일시 중지하고 신규 캠페인 구조로 재출발합니다.` : '성과가 전혀 없는 매체는 없어 운영 중지 없이 테스트를 이어갑니다.',
    summaryLine,
  ];

  // 기존 매체들의 평균 CPA·CTR을 벤치마크로, 아직 쓰지 않는 매체 중 하나를 시범 도입
  // 후보로 추천합니다(전체 통합형·매출형 등 광고비 데이터가 있는 유형에서만 의미가 있습니다).
  // 분자·분모를 모두 "다음달 기대치" 기준으로 통일합니다(제안 광고비 ÷ 기대 DB처럼) —
  // 다음달 제안 광고비를 이번달 실적 DB·매출과 섞어 나누면 예산이 늘거나 줄어든 만큼
  // CPA·ROAS가 왜곡됩니다.
  const existingPlatforms = mediaRows.map(row => row.platform);
  const totalLeadsForCpa = sum(mediaRows, row => row.expectedLeads);
  const avgCpa = totalLeadsForCpa > 0 ? spend / totalLeadsForCpa : 0;
  const totalCurrentPurchases = sum(paidMediaRows, row => row.purchases);
  const totalCurrentPaidSpend = sum(paidMediaRows, row => row.spend);
  const avgPurchaseCpa = totalCurrentPurchases > 0 ? totalCurrentPaidSpend / totalCurrentPurchases : 0;
  const totalImpressionsForCtr = sum(mediaRows, row => row.expectedImpressions);
  const totalClicksForCtr = sum(mediaRows, row => row.expectedClicks);
  const avgCtr = totalImpressionsForCtr > 0 ? totalClicksForCtr / totalImpressionsForCtr : 0;
  const totalRevenueForRoas = sum(mediaRows, row => row.expectedRevenue);
  const avgRoas = spend > 0 ? (totalRevenueForRoas / spend) * 100 : 0;
  const totalReachForRatio = sum(mediaRows, row => row.reach);
  const avgReachRatio = totalImpressionsForCtr > 0 ? totalReachForRatio / totalImpressionsForCtr : 0;
  const newPlatformSuggestion = suggestNewPlatform(data, existingPlatforms, avgCpa, avgPurchaseCpa, avgCtr, avgRoas, avgReachRatio, spend);
  // 신규 매체 시범 예산·성과는 "다음달 총 광고비 제안"과 별개로 취급하지 않고, 실제로
  // 집행하면 합산되는 값이므로 표지·KPI에도 함께 반영합니다. 다만 spend·leads 같은 원본
  // 합계만 더하고 CTR·CPC·ROAS 같은 파생 지표를 그대로 두면 서로 안 맞는 숫자가 됩니다.
  // 원본 합계를 전부 더한 뒤 모든 파생 지표를 이 자리에서 다시 계산합니다.
  let targetWithNewPlatform: MonthlyKpiTotals = target;
  if (newPlatformSuggestion) {
    const totalImpressions = target.impressions + newPlatformSuggestion.expectedImpressions;
    const totalClicks = target.clicks + newPlatformSuggestion.expectedClicks;
    const totalSpend = target.spend + newPlatformSuggestion.proposedBudget;
    const totalLeads = target.leads + newPlatformSuggestion.expectedLeads;
    const totalPurchases = target.purchases + newPlatformSuggestion.expectedPurchases;
    // 신규 매체의 "광고 귀속 매출"을 그대로 전체 주문 매출에 더하면, 신규 매체가 사실은
    // 기존 매체의 전환을 일부 가져온 것일 수도 있어 총매출을 과대평가할 위험이 있습니다.
    // 보수적으로 그 중 약 40%만 순수 증분 매출로 보고 전체 목표에 반영합니다(광고 귀속
    // 매출 전액은 신규 매체 페이지에 참고 KPI로 별도 표시합니다).
    const NEW_PLATFORM_REVENUE_CONTRIBUTION_RATIO = calcSettings.newPlatformRevenueContributionRatio;
    const newPlatformIncrementalRevenue = newPlatformSuggestion.expectedRevenue * NEW_PLATFORM_REVENUE_CONTRIBUTION_RATIO;
    const totalRevenue = target.revenue + newPlatformIncrementalRevenue;
    const totalReach = target.reach + newPlatformSuggestion.expectedReach;
    // 신규 매체의 결제·환불은 실적이 없어 직접 알 수 없으므로, 기존 매체의 결제/매출·환불/결제
    // 비율을 그대로 적용한 근사치를 씁니다. 매출과 마찬가지로 결제·환불도 증분 기여율을 반영한
    // "실제로 전체 목표에 더해지는 매출(newPlatformIncrementalRevenue)" 기준으로 계산해야
    // 합니다 — 매출은 40%만 반영하고 결제는 100% 반영하면, 결제가 매출보다 커지는 등
    // 수학적으로 불가능한 결과가 나올 수 있습니다.
    const paymentRatio = target.revenue > 0 ? target.payments / target.revenue : 0.93;
    const refundRatio = target.payments > 0 ? target.refunds / target.payments : 0.06;
    const newPlatformPayments = Math.round(newPlatformIncrementalRevenue * paymentRatio);
    const newPlatformRefunds = Math.round(newPlatformPayments * refundRatio);
    const totalPayments = target.payments + newPlatformPayments;
    const totalRefunds = target.refunds + newPlatformRefunds;
    targetWithNewPlatform = {
      impressions: totalImpressions,
      clicks: totalClicks,
      spend: totalSpend,
      leads: totalLeads,
      purchases: totalPurchases,
      revenue: totalRevenue,
      reach: totalReach,
      payments: totalPayments,
      refunds: totalRefunds,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      cvr: totalClicks > 0 ? (totalLeads / totalClicks) * 100 : 0,
      cpa: totalLeads > 0 ? totalSpend / totalLeads : 0,
      roas: totalSpend > 0 ? (totalRevenue / totalSpend) * 100 : 0,
      cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
      frequency: totalReach > 0 ? totalImpressions / totalReach : 0,
      netRevenue: totalPayments - totalRefunds,
    };
    // 자동 제안 첫 문장의 "다음달 총 광고비"도 신규 매체 시범 예산을 포함한 최종 총액으로
    // 다시 씁니다(그대로 두면 표지 총예산과 이 문장의 금액이 서로 달라 보입니다).
    proposals[0] = `다음달 총 광고비는 ${Math.round(totalSpend).toLocaleString()}원(신규 매체 시범 예산 ${Math.round(newPlatformSuggestion.proposedBudget).toLocaleString()}원 포함)으로 제안하며, 이번 달 대비 ${data.current.spend > 0 ? ((totalSpend / data.current.spend - 1) * 100).toFixed(1) : '0.0'}% 조정합니다.`;
    // 마지막 "기대 성과는 ~" 요약 문장도 신규 매체 반영 전 숫자(clicks/leads/revenue 등)로
    // 계산돼 있었으므로, 신규 매체를 포함한 최종 합계 기준으로 다시 씁니다. 그대로 두면 같은
    // 제안서 안에서 KPI 카드 숫자와 이 문장의 숫자가 서로 달라 보입니다.
    const finalSummaryLine =
      data.reportType === 'revenue'
        ? `기대 성과는 구매 전환 ${totalPurchases.toLocaleString()}건, 매출 ${Math.round(totalRevenue).toLocaleString()}원, ROAS ${targetWithNewPlatform.roas.toFixed(1)}%이며 실제 주간 성과에 따라 10~15% 범위에서 재조정합니다.`
        : data.reportType === 'click'
        ? `기대 성과는 클릭 ${totalClicks.toLocaleString()}건, CTR ${targetWithNewPlatform.ctr.toFixed(2)}%이며 실제 주간 성과에 따라 10~15% 범위에서 재조정합니다.`
        : data.reportType === 'reach'
        ? `기대 성과는 노출 ${totalImpressions.toLocaleString()}회, 도달 ${totalReach.toLocaleString()}명이며 실제 주간 성과에 따라 10~15% 범위에서 재조정합니다.`
        : data.reportType === 'custom' && customMetrics.length
        ? summaryLine
        : data.reportType === 'integrated'
        ? `기대 성과는 클릭 ${totalClicks.toLocaleString()}건, DB ${totalLeads.toLocaleString()}건, 전체 주문 매출 ${Math.round(totalRevenue).toLocaleString()}원, ROAS ${targetWithNewPlatform.roas.toFixed(1)}%이며 실제 주간 성과에 따라 10~15% 범위에서 재조정합니다.`
        : `기대 성과는 클릭 ${totalClicks.toLocaleString()}건, DB ${totalLeads.toLocaleString()}건, CPA ${Math.round(targetWithNewPlatform.cpa).toLocaleString()}원이며 실제 주간 성과에 따라 10~15% 범위에서 재조정합니다.`;
    proposals[proposals.length - 1] = finalSummaryLine;
  }

  return {
    advertiserName: data.advertiserName,
    sourceMonth: data.month,
    targetMonth: addMonth(data.month),
    reportType: data.reportType,
    current: data.current,
    target: targetWithNewPlatform,
    mediaRows,
    proposals,
    isSample: data.isSample,
    customMetrics: customMetrics.length ? customMetrics : undefined,
    newPlatformSuggestion,
  };
}
