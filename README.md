# HOWTOM 유니버스 v1.2.0 — Central Metrics / Actual API Data Build

이 버전은 **Meta·네이버 실제 광고 API → 일자별 중앙 성과 저장소 → HOWTOM 데이터/인사이트/보고서 화면**을 하나의 데이터 흐름으로 통일한 빌드입니다. 실제 성과 화면에서는 샘플/Mock/저장 보고서를 성과 Source로 사용하지 않습니다.

## 1. 핵심 데이터 원칙

- Production Repository는 항상 `api` 모드입니다.
- 실제 성과 화면에서 `loadPerformanceDataset`, `MOCK_CAMPAIGNS`, `CREATIVE_PERFORMANCE_SAMPLE`, `BRAND_REPORTS`를 사용하지 않습니다.
- 외부 매체 장애 시 Mock 성과로 fallback하지 않습니다.
- 미연동 매체는 `disconnected`, 아직 개발하지 않은 커넥터는 `connector_unimplemented`, 동기화 실패는 `error` 상태로 표시합니다.
- 동일 광고주·동일 기간은 대시보드/인사이트/중앙 보고서가 동일한 중앙 Metrics 데이터를 사용합니다.

## 2. 실제 매체 API 데이터 파이프라인

현재 실제 성과 수집 커넥터:

- Meta Ads
  - 계정 일별 인사이트
  - 캠페인 일별 인사이트
  - 소재(Ad) 일별 인사이트
  - 소재 썸네일/텍스트 메타데이터
- 네이버 검색광고
  - 캠페인 일별 성과
  - 소재 일별 성과
  - 키워드 일별 성과
  - 전환/전환금액은 네이버 `/stats`에서 제공되는 범위에서 저장

수집 흐름:

```text
Meta / Naver API
        ↓
POST /api/integrations/sync
        ↓
dailyMetrics
campaignMetrics (campaign + date)
creativeDailyMetrics (ad + date)
keywordDailyMetrics (keyword + date)
        ↓
Central Metrics API
        ↓
대시보드 / 광고 데이터 / 인사이트 / 소재 / 키워드 / 보고서 / AI 추천
```

Google·Kakao·당근·TikTok 등 아직 구현하지 않은 매체는 실제 데이터 0으로 가장하지 않고 `커넥터 미구현`으로 표시합니다.

## 3. 중앙 Metrics API

모든 실제 데이터 조회는 다음 API를 기준으로 합니다.

```text
GET /api/metrics/summary
GET /api/metrics/daily
GET /api/metrics/media
GET /api/metrics/advertisers
GET /api/metrics/campaigns
GET /api/metrics/creatives
GET /api/metrics/keywords
GET /api/metrics/funnel
GET /api/metrics/status
```

공통 조회 파라미터:

```text
advertiserId
channel
from=YYYY-MM-DD
to=YYYY-MM-DD
```

`tenant_id`는 향후 멀티테넌트 PostgreSQL 전환 시 로그인 세션/JWT에서 서버가 강제하는 구조로 전환합니다.

## 4. 공통 기간 선택

실제 데이터를 보는 화면은 공통 `MetricsQueryContext`와 `MetricsDateBar`를 사용합니다.

- 오늘
- 어제
- 최근 7일
- 최근 14일
- 최근 30일
- 최근 60일
- 최근 90일
- 지난달
- 이번달
- 기간 직접 선택

선택한 기간은 데이터 화면 이동 중 유지되며 API에 동일한 `from/to`로 전달됩니다.

## 5. 실제 성과가 연결된 주요 화면

- 통합 홈
- 전체 대시보드
- 통합 성과 분석
- 매체별 분석
- 광고주별 분석
- 캠페인 분석 — 실제 `campaign_id` 기준
- 소재 성과 — Meta·네이버 실제 `creative_daily_metrics`
- 소재 라이브러리/상세
- 소재 분석
- 소재 피로도 — `creative_daily_metrics` 일별 추이 기반
- 키워드 분석/성과 — 실제 `keyword_daily_metrics`
- 검색광고 관리의 성과 조회
- 전환 퍼널
- DB 데이터의 광고 성과 연결 영역
- AI 추천의 성과 입력값
- 통합 보고서

캠페인 분석은 계정 전체 성과를 캠페인 성과로 추정하지 않습니다. 소재 분석과 소재 성과는 같은 `creative_daily_metrics`를 사용합니다.

## 6. Sync 검증 로그

Meta·네이버 동기화 시 외부 매체의 계정 합계와 HOWTOM에 저장된 캠페인 일별 집계를 대조합니다.

```text
GET /api/integrations/sync-validation
```

로그에 저장되는 항목:

- 광고주
- 매체
- from / to
- 외부 매체 원천 합계
- HOWTOM 저장 합계
- 차이(delta)
- 일치 여부
- 검증 시각

`데이터 동기화` 화면에서도 확인할 수 있습니다.

## 7. Zero State

신규 설치는 샘플 광고주나 임의 성과 숫자를 생성하지 않습니다.

```json
{
  "advertisers": [],
  "dailyMetrics": [],
  "campaignMetrics": [],
  "creativeDailyMetrics": [],
  "keywordDailyMetrics": [],
  "syncValidationLogs": []
}
```

연결되지 않은 매체는 빈 실제 데이터 + 연결 상태로 표시됩니다.

## 8. 로그인 인사말

- 관리자 → `안녕하세요, 관리자님!`
- 일반 사용자 → `nickname → name → advertiser_name → 사용자` 순으로 표시합니다.

현재 내장 인증은 관리자 1계정 기반 최소 구현입니다. 유료 SaaS 공개 전에는 PostgreSQL 기반 `tenant / users / tenant_members / RBAC`로 전환해야 합니다.

## 9. 로컬 실행

일반 실행:

```bash
npm run dev
```

패키지가 설치되어 있으면 Vite 개발모드를 사용합니다. 패키지가 없고 `dist`가 있으면 포함된 완성 빌드를 즉시 실행합니다. 둘 다 없을 때는 Portable Mode로 전환합니다.

소스 HMR 개발을 명시적으로 원할 때:

```bash
npm run setup
npm run dev:source
```

## 10. 검증 명령

```bash
npm run typecheck
npm run audit:data
npm run test:metrics
npm run build
```

- `audit:data`: 실제 데이터 화면의 금지 Mock 성과 Source와 Production Repository 설정 검사
- `test:metrics`: 기간 필터, campaign/creative/keyword, 파생지표, 연결상태, sync 검증 로그 API 통합 테스트
- `build`: TypeScript 검사 후 Vite build를 우선 실행합니다. 현재 OS용 Rollup optional binary가 없는 압축본 환경에서는 portable ESM production build로 자동 검증합니다.

## 11. Railway

Railway/Nixpacks에서는 정상적인 Linux 의존성을 새로 설치한 뒤 배포합니다.

필수 운영 환경변수 예:

```text
HOWTOM_ADMIN_EMAIL=
HOWTOM_ADMIN_PASSWORD=
HOWTOM_ADMIN_NAME=관리자
JWT_SECRET=
HOWTOM_DATA_DIR=/data
META_ACCESS_TOKEN=
VITE_REPOSITORY_MODE=api
```

Railway Volume은 `/data`에 마운트하는 것을 권장합니다.

## 12. 아직 상용 SaaS 출시 전 반드시 남은 구조 작업

이번 버전은 12개 성과 데이터 완료조건을 중심으로 실제 API 파이프라인을 통일했습니다. 하지만 외부 광고주에게 유료 판매하는 멀티테넌트 SaaS의 최종 데이터 기반은 아직 아닙니다.

다음 P0는:

1. JSON 저장소 → PostgreSQL 실제 Source of Truth 전환
2. `tenant / users / tenant_members / RBAC` 실제 인증·데이터 격리
3. 광고 API Credential의 암호화 저장 및 Secret 관리
4. 자동 수집 Worker/Scheduler + 재시도/장애 모니터링
5. 구독·Entitlement·결제·사용량 관리
6. Object Storage 기반 자산/보고서 파일 저장

---

**버전:** 1.2.0  
**기준:** 2026-08-19  
**상태:** Central Metrics / Meta + Naver actual API pipeline / Zero State

## 13. HOWTOM 콘텐츠 제작소 분리 (PHASE 1)

콘텐츠/레퍼런스 기능은 향후 별도 웹앱 `HOWTOM 콘텐츠 제작소`로 단계적으로 이전합니다.
현재 Universe의 기존 콘텐츠 기능은 아직 삭제하지 않으며, Content Studio PHASE 2 이전 완료 후 정리합니다.

Universe에서 Content Studio로 이동하는 외부 링크는 빌드 환경변수로 지정합니다.

```text
VITE_CONTENT_STUDIO_URL=https://<content-studio-domain>
```

두 앱은 같은 PostgreSQL과 동일한 `advertiser_id`를 사용합니다. Content Studio PHASE 1은 로그인, 광고주 목록 조회, 앱 전환, 홈/Stub 라우트만 제공합니다.
