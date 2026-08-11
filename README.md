# HOWTOM 유니버스 v1.0.1

HOWTOM의 광고 운영, 데이터 분석, 콘텐츠 제작, 자동화, 자산관리, 광고주 Workspace, 설정, 관리자 기능을 하나의 프론트엔드에서 관리하기 위한 통합 마케팅 운영 플랫폼입니다.

이 저장본은 **프론트엔드 Ver.1 안정화 완료본**입니다. 로컬 데모와 사내 기능 검토에는 사용할 수 있지만, 실제 광고주 데이터를 인터넷 공개 환경에서 운영하려면 인증 백엔드·서버 DB·광고 매체 API·Secret Store 연결이 추가로 필요합니다.

---

## 1. 현재 상태

### 구현 완료 또는 사용 가능한 영역

- 통합 홈
- 운영센터
- 인사이트
  - 통합 성과 분석
  - 매체별 분석
  - 광고주별 분석
  - 캠페인 분석
  - 소재 분석
  - 경쟁사 분석
  - 광고 트렌드
  - 후킹·CTA 분석
  - AI 추천(규칙·분석 엔진 기반)
- 콘텐츠
  - 레퍼런스
  - 광고 제작
  - 블로그 작성
  - 영상 대본 작성
  - 문서 작성
  - 제작물 보관함
  - 템플릿
- AI 자동화
  - 보고서 자동 생성
  - 광고 문구 자동 생성
  - 알림 자동화
  - 작업 흐름
  - 실행 기록
- 자산관리
- 광고주 Workspace
- 업무지원센터
- 설정 14개 영역
- 관리자 Control Plane
- Google Sheets / Apps Script 기반 DB 연동 구조
- PDF·JPG·PNG·XLSX 등 보고서 내보내기 구조
- 샘플 데이터 및 데모 분석 엔진

### 아직 실제 서버 연결이 필요한 영역

- 실제 로그인 / 회원 시스템
- 서버 권한검사
- PostgreSQL 등 운영 DB
- Meta / 네이버 / Google / 카카오 / 당근 / TikTok 등 광고 API 실제 호출
- 광고 API Credential / Secret Store
- 서버 감사 로그
- PG 결제
- 2FA / SSO
- 서버 기반 자동 스케줄러
- 운영 서버 파일 저장소(Object Storage)

### 계획 상태 메뉴

다음 메뉴는 의도적으로 계획 상태로 유지합니다.

- 이미지 제작
- 레퍼런스 자동 수집
- 블로그 자동 생성
- 승인 요청 자동화
- 로고·브랜드 자료
- 자산 템플릿
- 프롬프트

---

## 2. 실행 방법

### 가장 간단한 실행

Node.js 20 이상에서:

```bash
npm run dev
```

`node_modules`가 없으면 포함된 `dist` 완성 실행본으로 자동 전환합니다.

기본 주소:

```text
http://127.0.0.1:5173/home
```

Windows에서는 다음 실행 파일도 사용할 수 있습니다.

```text
start-dev.cmd
start-app.cmd
HOWTOM_유니버스_실행.bat
```

### 소스 수정 개발 모드

```bash
npm run setup
npm run dev:source
```

### 빌드 / 검사

```bash
npm run typecheck
npm test
npm run build
```

패키지 설치가 완료된 환경에서 위 명령으로 새 `dist`를 생성하세요.

---

## 3. 보안 원칙

### 로컬 데모 자동 로그인 제한

`VITE_DEMO_MODE=true`여도 관리자 데모 세션은 기본적으로 다음 주소에서만 활성화됩니다.

```text
localhost
127.0.0.1
::1
```

Railway, Vercel 또는 일반 공개 도메인에서는 자동 관리자 데모를 허용하지 않습니다.

공개 데모가 정말 필요한 별도 시험 환경에서만 다음 값을 명시적으로 사용합니다.

```env
VITE_ALLOW_REMOTE_DEMO=true
```

운영 환경에서는 사용하지 않는 것을 권장합니다.

### 포함된 dist 실행본

포함된 `dist`는 로컬 검토용 데모 빌드입니다.

공개 도메인에서 그대로 열 경우 `runtime-security-guard.js`가 앱 실행을 차단하고, 운영 인증 백엔드 연결 안내 화면만 표시합니다.

### 내장 데모 API

`server.mjs`의 인증 없는 내장 API는 다음 조건에서만 사용할 수 있습니다.

- 로컬 개발 환경
- loopback 요청

`NODE_ENV=production` 또는 Railway 실행 환경이 감지되면 `/api/health`를 제외한 내장 데모 API는 기본적으로 `503`으로 차단됩니다.

예외 스위치:

```env
HOWTOM_ALLOW_INSECURE_DEMO_API=true
```

이 값은 인증 없는 공개 서버를 의도적으로 만드는 옵션이므로 운영 환경에서는 사용하지 마세요.

### 계정 보관함

현재 업무지원센터의 계정 보관함은 다음 정보만 브라우저에 저장합니다.

- 서비스명
- 광고주명
- 계정 ID
- 담당자
- 최근 변경일
- 변경 예정일
- 메모

**실제 비밀번호·API Secret은 localStorage에 저장하지 않습니다.**

이전 버전에서 저장된 `secret` 필드가 있으면 로드 시 자동으로 제거 또는 빈 값으로 정리합니다.

실제 Credential 저장은 다음 구조가 준비된 뒤 연결합니다.

```text
프론트엔드
  ↓ 인증된 API
서버 권한검사
  ↓
암호화 Secret Store / Credential DB
```

---

## 4. 설정 구조

설정의 기준 화면은 다음입니다.

```text
/settings
/settings/control/account
/settings/control/company
/settings/control/team
/settings/control/display
/settings/control/notifications
/settings/control/integrations
/settings/control/metrics
/settings/control/reports
/settings/control/content
/settings/control/ai
/settings/control/automation
/settings/control/storage
/settings/control/subscription
/settings/control/security
```

기존 KPI·퍼널·수식·Google Sheets·제안 계산 등 전문 운영 설정은 다음 하위 구조로 분리했습니다.

```text
/settings/advanced/...
```

즉, `/settings`와 14개 `control` 영역이 **설정 Source of Truth**이고, `advanced`는 전문 운영 세부 설정입니다.

기존 `/settings/<legacy-key>` 주소는 호환을 위해 유지되며 새 세부 운영 경로로 이동됩니다.

---

## 5. 주요 구조

```text
src/
├─ analytics/          성과·소재·캠페인 분석 엔진
├─ ai/                 AI Gateway 및 규칙 기반 처리
├─ components/         공통 UI
├─ config/             런타임·보안 설정
├─ context/            인증 등 전역 상태
├─ control/            조직·권한·구독·관리자 Control Plane
├─ data/               메뉴 및 공통 데이터
├─ features/           보고서 등 기능 모듈
├─ gates/              인증·관리자 접근 Gate
├─ integrations/       광고 채널 연동 인터페이스·수집 파이프라인
├─ layouts/            전체 레이아웃·사이드바
├─ pages/              화면
├─ repositories/       데이터 접근 계층
└─ utils/              저장·변환·내보내기·Google Sheets 등
```

서버:

```text
server.mjs
```

개발 실행 폴백:

```text
scripts/dev-server.mjs
```

---

## 6. 광고 매체 API 연동 구조

현재 매체 Connector 인터페이스와 수집 파이프라인은 준비되어 있지만 실제 외부 광고 API 호출은 아직 GATE 상태입니다.

대상 채널:

- Meta
- 네이버 검색광고
- 네이버 GFA
- Google 검색
- YouTube
- 카카오 키워드
- 카카오 모먼트
- 당근
- TikTok
- 모비온
- ADN

구조:

```text
광고 매체 API
   ↓
서버 Connector
   ↓
표준 FetchedDailyMetrics
   ↓
운영 DB upsert
   ↓
HOWTOM Repository
   ↓
대시보드 / 보고서 / 인사이트 / 자동화
```

프론트 코드 또는 localStorage에 광고 API Access Token과 Secret을 넣지 마세요.

### 권장 첫 연동 순서

1. 실제 로그인 백엔드
2. 서버 DB
3. 광고주·광고계정 테이블
4. Secret Store
5. Meta 광고계정 1곳
6. 일일 데이터 DB 저장
7. HOWTOM 화면과 실제 데이터 연결
8. 네이버 및 다른 매체 순차 확대

모든 매체를 동시에 붙이기보다 한 광고주의 한 매체가 처음부터 끝까지 정상 흐르는 것을 먼저 검증하는 구조를 권장합니다.

---

## 7. 일일 수집 스케줄 권장안

KST 기준:

| 시각 | 작업 |
|---|---|
| 05:30 | T-1 데이터 1차 수집 |
| 06:15 | 실패 채널 재시도 |
| 06:45 | 최종 상태 확인·담당자 알림 |
| 07:00 | 데이터 등록 완료 목표 |
| 08:00~09:00 | 일일 보고 |

UTC cron 예시:

```cron
30 20 * * *  # KST 05:30
15 21 * * *  # KST 06:15
45 21 * * *  # KST 06:45
```

실제 서버 잡을 만들 때는 다음을 추가해야 합니다.

- Connector 실제 API 구현
- 광고주 × 채널 Credential DB 조회
- `saveDailyMetrics` 운영 DB upsert
- 실패 알림
- 중복 수집 방지
- 재시도 정책
- API Rate Limit 처리

---

## 8. Google Sheets / Apps Script

Pre-Revenue 또는 초기 검증 단계에서는 Google Sheets / Apps Script 연동을 사용할 수 있도록 관련 샘플을 유지합니다.

```text
integrations/google-apps-script-example.gs
integrations/google-sheets-db-webapp.gs
integrations/google-sheets-db-sample.csv
```

고객 개인정보 원문을 무분별하게 저장하지 말고, HOWTOM 화면에 필요한 집계 데이터 중심으로 연결하는 것을 권장합니다.

---

## 9. Railway 배포 기준

현재 저장본을 그대로 공개 운영 서버로 사용하지 마세요.

현재 `server.mjs`는 정적 화면과 로컬 데모 API 확인용 서버이며 실제 사용자 인증 서버가 아닙니다.

Railway 운영 전 최소 조건:

```text
/api/auth/login
/api/auth/me
서버 세션 또는 검증 가능한 토큰
관리자/광고주 서버 권한검사
운영 DB
암호화 Credential Store
광고 API 서버 Connector
감사 로그
```

환경변수 예시는 `.env.example`을 사용합니다.

실제 운영용 `dist`는 인증 백엔드와 환경변수 구성을 완료한 뒤 다시 빌드하는 것을 원칙으로 합니다.

---

## 10. 이번 v1.0.1 안정화 반영 사항

- 관리자 데모 자동 로그인 로컬 전용화
- 공개 도메인에서 포함 `dist` 자동 차단
- production / Railway 내장 데모 API 기본 차단
- `/api/health` 추가
- HTTP 기본 보안 헤더 추가
- 운영 모드 인증 검증 실패 시 로컬 토큰 신뢰 제거
- 로그인 서버 응답 검증 강화
- 계정 보관함의 비밀번호·API Secret localStorage 저장 제거
- 레거시 브라우저 Credential 데이터 자동 정리
- 설정 Source of Truth를 `/settings` + `/settings/control/*`로 정리
- 전문 운영 설정을 `/settings/advanced/*`로 분리
- 기존 설정 주소 호환 유지
- `.env.example` 보안 옵션 정리
- 서버 Promise 오류 안전 처리 추가
- 기존 다수 작업 로그 Markdown 제거
- 프로젝트 문서를 이 `README.md` 하나로 통합

---

## 11. 검증 결과

이 안정화본에서 확인한 항목:

```text
TS/TSX 파일: 203개
구문 오류: 0개
server.mjs 구문 검사: 정상
scripts/dev-server.mjs 구문 검사: 정상
dist 번들 JS 구문 검사: 정상
로컬 npm run dev 폴백 실행: 정상
/home HTTP: 200
/api/health 로컬: 200
/api/advertisers 로컬 데모: 200
production 모드 /api/advertisers: 503 차단 정상
```

현재 작업 환경에서는 npm 패키지 다운로드가 완료되지 않아 새 `node_modules`를 설치한 전체 `npm run build`와 `npm test` 재실행은 수행하지 못했습니다. 대신 소스 203개 구문 검사, 포함 번들 구문 검사, 정적 서버 실제 실행, 로컬/production API 동작을 검증했습니다.

패키지 설치가 가능한 개발 PC에서는 최종적으로 다음을 한 번 실행하세요.

```bash
npm ci
npm run typecheck
npm test
npm run build
```

---

## 12. 개발 원칙

1. 프론트 기능을 무한히 늘리기보다 실제 데이터 흐름을 우선 검증합니다.
2. Secret은 브라우저에 두지 않습니다.
3. 관리자 권한은 화면 숨김이 아니라 서버에서 강제합니다.
4. 광고 API → DB → Repository → 화면 순서로 데이터를 통과시킵니다.
5. 광고 API와 AI 비용은 실제 고객·매출 단계에 맞춰 확대합니다.
6. Mock·샘플·규칙 기반 결과는 실제 API 결과처럼 표시하지 않습니다.
7. 설정은 `/settings` 구조를 기준으로 유지해 중복 화면을 만들지 않습니다.

