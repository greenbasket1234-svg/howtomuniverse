# 수정 내역 (2026-08-28)

## 문제 1 — 네이버 구매전환·장바구니가 'DB 전환'으로 집계되던 버그
- 원인: `server.mjs`의 AD_CONVERSION_DETAIL 보고서 파싱에서 전환유형을 영문 문자열
  (`purchase`, `add_to_cart` 등)로만 매핑. 실제 보고서는 계정에 따라 숫자 코드
  (1=구매완료, 2=회원가입, 3=장바구니, 4=신청·예약, 5=기타)로 내려와 전부
  "모르는 유형 → DB(리드)"로 합산됐고, 이 값이 /stats 기반 분리값을 덮어쓰면서
  구매·장바구니가 DB 전환에 섞이고 구매전환은 0으로 지워짐.
- 수정: `lib/naverConversionTypes.mjs` 신설(숫자 코드 + 문자열 표기 모두 명시 매핑,
  상품상세보기·상품찜 등 참여성 이벤트는 집계 제외, 미지 유형은 경고 로그와 함께 DB 유지).
  `server.mjs`의 `naverFetchDailyMetricsViaReport()`가 이 모듈을 사용하도록 교체.
- 필요 조치: 잘못 저장된 기간을 덮어쓰려면 '매체 계정 연동' 또는 '데이터 수집 현황'에서
  해당 기간을 포함해 **네이버 재수집(재동기화)** 1회 실행.

## 문제 2 — 동기화해도 '데이터 수집 현황'에 기록이 안 보이던 버그
- 원인: `db/schema.sql`이 "관리자 > 마이그레이션" 버튼을 누를 때만 실행되는 구조라,
  새 컬럼(`sync_validation_logs.account_id`)이 추가된 코드를 배포해도 DB에는 컬럼이 없음.
  `/api/integrations/status`가 그 테이블까지 통째로 읽는 `pgReadDb`를 쓰다가
  `column "account_id" does not exist` 500으로 실패 → 화면은 에러를 삼키고 빈 목록 표시.
  (로컬 PostgreSQL로 동일 증상 재현/확인 완료)
- 수정 3가지:
  1. `server.mjs`: 서버 시작 시 `db/schema.sql` 자동 적용(전부 IF NOT EXISTS라 안전).
     이제 배포만 하면 스키마가 항상 코드와 함께 갱신됨.
  2. `server.mjs`: `/api/integrations/status`가 광고주+매체 계정 테이블만 직접 조회하도록
     변경(무관한 테이블 문제로 화면 전체가 죽지 않음, 속도도 개선).
  3. `src/pages/FinalSystemPages.tsx`: 불러오기 실패 시 에러 배너 표시(조용히 빈 화면 금지).
- dist/ 는 Vite production build로 재빌드 완료(프론트 수정 반영됨).

## 검증
- `lib/naverConversionTypes.mjs` 단위 테스트 통과(숫자/문자/참여성/미지 유형 15케이스).
- 로컬 PostgreSQL E2E: 광고주 생성 → 네이버 연결 → 동기화(실패 포함) → 수집 현황 기록 확인,
  구버전 스키마 상태에서 서버 재시작만으로 자동 복구되어 200 응답 확인.
- `tsc --noEmit` 타입체크, `node --check server.mjs` 통과.


## 2026-08-31 — 네이버 커머스 광고주 6개월+ 장기 동기화 반복 실패 수정

- 원인 1: `naverNeedsDayByDayFallback` 여부를 알기 전에 30일 세그먼트를 먼저 확정해, 서버 재시작/첫 실행에서는 fallback 계정도 30일 단위로 처리됨.
- 원인 2: 180/396/730일 백필에서도 소재·키워드 수백~수천 개를 전체 기간에 대해 일자별로 반복 조회해 API 호출 수와 메모리가 기간에 비례해 폭증함.
- 수정: 장기 동기화 시작 전 7일 preflight로 일별 fallback 여부를 선판정하고, fallback 계정은 10일 세그먼트를 사용.
- 수정: 계정/캠페인은 요청 기간 전체를 유지하되 소재·키워드 장기 백필은 일반 계정 최근 90일, fallback 대형 계정 최근 30일로 제한. 기존 DB의 과거 세부 행은 삭제하지 않음.
- 수정: fallback 계정의 소재 처리 상한도 키워드와 동일하게 150개로 낮춰 일자별 개별 호출 폭증을 차단.
