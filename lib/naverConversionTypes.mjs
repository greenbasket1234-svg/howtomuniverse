/**
 * 네이버 전환유형 → HOWTOM 내부 필드 분류
 * ------------------------------------------------------------------
 * 네이버 대용량 보고서(AD_CONVERSION_DETAIL)의 전환유형 컬럼은 사이트에 설치된
 * 전환 스크립트 버전에 따라 서로 다른 표기로 내려옵니다.
 *
 *   - 구 스크립트(cnv) / 보고서 숫자 코드:
 *       1 = 구매완료, 2 = 회원가입, 3 = 장바구니 담기, 4 = 신청·예약, 5 = 기타
 *   - 신 스크립트(trans) 문자열:
 *       purchase / sign_up / add_to_cart / lead / custom001 … 등
 *
 * 이전 코드는 문자열 표기만 매핑하고 "모르는 유형은 전부 DB(리드)"로 처리했기 때문에,
 * 숫자 코드로 내려오는 계정에서는 구매완료(1)·장바구니(3)까지 전부 '모르는 유형'이 되어
 * DB 전환에 합산되는 버그가 있었습니다(구매/장바구니가 DB 전환에 섞여 보이던 원인).
 * 이 모듈은 숫자 코드와 문자열 표기를 모두 명시적으로 분류합니다.
 */

/** 전환유형(소문자 정규화 기준) → HOWTOM 필드명 */
export const NAVER_CONVERSION_TYPE_MAP = {
  // 숫자 코드 (구 스크립트 cnv / 대용량 보고서)
  '1': 'purchases',            // 구매완료
  '2': 'completeRegistration', // 회원가입
  '3': 'addToCart',            // 장바구니 담기
  '4': 'dbCount',              // 신청·예약 → DB(리드)
  '5': 'dbCount',              // 기타 → 상담/DB성 이벤트로 취급

  // 문자열 (신 스크립트 trans)
  purchase: 'purchases',
  sign_up: 'completeRegistration',
  signup: 'completeRegistration',
  add_to_cart: 'addToCart',
  cart: 'addToCart',
  lead: 'dbCount',
  application: 'dbCount',
  reservation: 'dbCount',
  schedule: 'dbCount', // 예약/일정 전환 - 실제 운영 보고서에서 확인된 유형 (2026-08-28)
  booking: 'dbCount',
  apply: 'dbCount',
  other: 'dbCount',
  etc: 'dbCount',
  payment: 'initiateCheckout',
  initiate_checkout: 'initiateCheckout',
  checkout: 'initiateCheckout',

  // 한글 표기 (보고서가 유형명을 한글로 내려주는 계정 대비)
  '구매완료': 'purchases',
  '구매': 'purchases',
  '회원가입': 'completeRegistration',
  '장바구니': 'addToCart',
  '장바구니담기': 'addToCart',
  '장바구니 담기': 'addToCart',
  '신청·예약': 'dbCount',
  '신청예약': 'dbCount',
  '신청': 'dbCount',
  '신청완료': 'dbCount',
  '예약': 'dbCount',
  '예약완료': 'dbCount',
  '상담신청': 'dbCount',
  '기타': 'dbCount',
  '결제시작': 'initiateCheckout',
  '결제 시작': 'initiateCheckout',
};

/**
 * 리드(DB)가 아닌 '단순 참여성' 전환유형. (상품상세보기·컨텐츠보기·상품찜·소식받기 등)
 * 카페24 등 임대몰은 이런 이벤트를 자동으로 잔뜩 만들어내는데, 이걸 DB 전환에 섞으면
 * DB 숫자가 다시 오염되므로 집계에서 제외합니다.
 */
export const NAVER_ENGAGEMENT_TYPES = new Set([
  'view_product_detail', 'product_detail', 'view_content', 'content_view',
  'wishlist', 'product_wish', 'wish',
  'subscription', 'news_subscription', 'subscribe', 'follow',
  '상품상세보기', '상품 상세보기', '컨텐츠보기', '콘텐츠보기', '상품찜', '위시리스트',
  '소식받기', '소식받기/구독', '구독',
]);

/**
 * 전환유형 하나를 분류합니다.
 * @returns {{field: string|null, known: boolean, engagement: boolean}}
 *   field: 합산할 HOWTOM 필드명(engagement면 null = 집계 제외)
 *   known: 명시적으로 아는 유형인지(false면 호출부에서 경고 로그 권장)
 */
export function classifyNaverConversionType(rawType) {
  const t = String(rawType ?? '').trim().toLowerCase();
  if (!t) return { field: 'dbCount', known: false, engagement: false };
  const mapped = NAVER_CONVERSION_TYPE_MAP[t];
  if (mapped) return { field: mapped, known: true, engagement: false };
  if (NAVER_ENGAGEMENT_TYPES.has(t)) return { field: null, known: true, engagement: true };
  // 사용자정의 전환(custom001~custom010)은 대부분 상담신청 등 DB성 이벤트로 사용됩니다.
  if (t.startsWith('custom')) return { field: 'dbCount', known: true, engagement: false };
  // 정말 모르는 유형: 예전처럼 DB로 보되(전환을 조용히 버리지 않기 위해),
  // known=false를 돌려주므로 호출부에서 반드시 경고 로그를 남깁니다.
  return { field: 'dbCount', known: false, engagement: false };
}
