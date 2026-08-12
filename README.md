# HOWTOM 유니버스 v1.1.0

이 버전은 **Zero State + Railway 백엔드 + 블로그 제작 워크스페이스**를 기준으로 정리한 운영 전환본입니다. 기존에 코드와 브라우저 저장소에 포함되어 있던 광고주·성과·소재·키워드·보고서·자동화 샘플/시드 데이터는 기본값에서 제거했습니다.

## 1. 이번 버전 핵심 변경

- `콘텐츠 > 블로그 작성`을 **`콘텐츠 > 블로그 제작`**으로 고도화했습니다.
- 블로그 프로젝트·광고주 문체 프로필·블로그 사진 자산을 `server.mjs` 백엔드 API와 JSON 저장소에 저장합니다.
- 새 설치의 백엔드 DB는 `advertisers`, `blogProjects`, `blogStyles`, `blogAssets`, `logs` 모두 빈 배열로 시작합니다.
- 과거 빌드가 브라우저 `localStorage`에 남긴 업무 데이터는 v1.1.0 최초 실행 시 로그인 세션을 제외하고 한 번 정리해 **Zero State**로 전환합니다.
- 홈 인사말은 로그인 사용자 기준으로 표시합니다. 관리자는 항상 `안녕하세요, 관리자님!`, 일반 사용자는 `닉네임 → 이름 → 광고주명 → 사용자` 순으로 표시합니다.
- Railway 운영 환경에서는 인증된 요청만 데이터 API를 사용할 수 있습니다.

## 2. 블로그 제작 기능

### 제작 홈
- 이번 달 제작 / 작성 중 / 검토 필요 / 발행 완료 / 규정 경고 KPI
- 광고주 필터와 제목·키워드 검색
- 서버에 저장된 블로그 프로젝트 목록
- Zero State 안내

### 새 글 제작 워크스페이스
- 광고주, 플랫폼, 업종, 콘텐츠 유형
- 메인·서브 키워드, 지역, 목적, 목표 글자수, 톤앤매너
- 참고자료
- 기존 문체 반영 / 광고주 정보 반영 / 사진 추천 / 업종별 규정 검수 / SEO 사전점검
- 의료 업종은 의료광고 사전점검 옵션 추가

### 초안·편집
- 외부 AI API 연동 초안 생성 (설정 안 하면 규칙 기반 폴백)
- 제목 후보 생성
- 본문 / 소제목 / 사진 / 목록 / 인용문 / FAQ / CTA / 구분선 블록
- 전체 복사
- TXT / HTML 내보내기
- 서버 저장

`/api/blog/generate`는 `BLOG_AI_PROVIDER` 환경변수(`anthropic` | `openai` | `custom`)가 설정되어 있으면 실제 외부 AI API를 호출해 제목·본문을 생성합니다. 설정하지 않았거나 외부 호출이 실패하면 비용 없는 **규칙 기반 백엔드 생성기**로 자동 대체됩니다. `/api/blog/ai-status`로 현재 연결 상태를 확인할 수 있고, 화면에는 어떤 방식으로 생성됐는지 안내 문구가 그대로 표시됩니다. 자세한 변수는 `.env.example`을 참고하세요.

### SEO 점검
HOWTOM 내부 작성 기준으로 제목·도입부·소제목 키워드, 목표 글자수, FAQ, CTA, 이미지 배치, 키워드 과다 반복을 점검합니다. 검색 순위를 보장하는 점수는 아닙니다.

### 업종별 규정 사전점검
- 과도한 단정/보장 표현
- 객관적 근거가 필요한 최상급 표현
- 가격·혜택 표현
- 의료 업종 추가 검수: 치료효과 단정, 치료경험담, 비교·비방, 전문병원 명칭, 할인 표현, 부작용·중요정보 확인, 사전심의 대상 여부 확인

이 기능은 **내부 사전점검 및 심의관리 보조 도구**이며 법률 자문이나 의료광고 자율심의기구의 공식 심의·승인을 대체하지 않습니다.

### 의료광고 심의 관리
- 사전심의 대상 여부 담당자 확인
- 심의 준비 / 심의 중 / 수정 요청 / 심의 완료 상태
- 심의필번호
- 심의 완료일
- 심의 완료 문안 잠금
- 수정 필요 시 잠금 해제와 동시에 재검토 상태 전환

### 광고주 문체·자료
광고주별로 톤앤매너, 문체 규칙, 선호 표현, 금지 표현, 기본 CTA, 기존 글/참고 원문을 서버에 저장합니다. 향후 AI 생성 프롬프트의 Style Profile로 사용할 수 있습니다.

### 사진 자산
광고주별 이미지 URL·이름·태그를 백엔드에 저장하고 블로그 키워드와 태그의 연관도를 기준으로 추천합니다. 본문의 사진 블록에 자산을 연결할 수 있습니다.

## 3. Zero State 정책

신규 실행 시 임의 광고주나 임의 성과 숫자를 생성하지 않습니다. 다음 항목의 코드 기본 데이터는 빈 상태입니다.

- 광고주
- 광고 성과
- 키워드 분석
- 소재 성과/라이브러리
- 캠페인
- 퍼널 데이터
- DB/수당/일정/업로드 데이터
- 보고서 원본
- 자동화 규칙 및 실행 데이터
- 날씨/시즌 예시 데이터
- 데이터 수집 상태 예시
- 관리자 사용자 시드/구독상품 시드

브라우저에서는 v1.1.0 최초 실행 시 기존 업무 관련 `localStorage`를 초기화하고 인증 세션만 유지합니다. 서버 DB도 파일이 처음 생성될 때 빈 배열로 시작합니다.

## 4. 로그인 인사말

홈 화면은 `AuthContext`에서 현재 로그인 사용자를 읽습니다.

- `role === admin` → `안녕하세요, 관리자님!`
- 일반 사용자 → `nickname`이 있으면 닉네임
- 닉네임이 없으면 `name`
- 둘 다 없으면 연결된 `advertiser_name`
- 최종 폴백 → `사용자`

현재 내장 백엔드는 Railway 환경변수로 설정하는 **관리자 1계정 인증**을 우선 제공합니다. 일반 사용자 계정 DB/초대 기능을 이후 연결하더라도 프론트 인사말은 같은 규칙으로 동작하도록 준비되어 있습니다.

## 5. 백엔드 저장소

`server.mjs`가 Node 기본 모듈만으로 최소 운영 백엔드를 제공합니다.

기본 저장 파일:

```text
.data/howtom-db.json
```

Railway에서는 휘발성 파일시스템 대신 **Volume을 연결**해야 합니다. 예를 들어 Volume을 `/data`에 마운트하고 다음 환경변수를 설정합니다.

```text
HOWTOM_DATA_DIR=/data
```

DB 초기 구조:

```json
{
  "advertisers": [],
  "blogProjects": [],
  "blogStyles": [],
  "blogAssets": [],
  "logs": []
}
```

## 6. 주요 API

인증:

```text
POST /api/auth/login
GET  /api/auth/me
```

광고주:

```text
GET    /api/advertisers
POST   /api/advertisers
PATCH  /api/advertisers/:id
DELETE /api/advertisers/:id
```

블로그:

```text
GET    /api/blog/projects
POST   /api/blog/projects
GET    /api/blog/projects/:id
PATCH  /api/blog/projects/:id
DELETE /api/blog/projects/:id
POST   /api/blog/generate
GET    /api/blog/styles/:advertiserId
PUT    /api/blog/styles/:advertiserId
GET    /api/blog/assets
POST   /api/blog/assets
```

상태 확인:

```text
GET /api/health
```

`/api/health`를 제외한 데이터 API는 로그인 JWT가 필요합니다.

## 7. Railway 배포

`railway.toml`은 배포 시 다음 순서로 실행하도록 구성했습니다.

```text
npm ci --no-audit --no-fund
npm run build
node server.mjs
```

Railway Variables에 최소 다음 값을 설정하세요.

```text
HOWTOM_ADMIN_EMAIL=<로그인 아이디>
HOWTOM_ADMIN_PASSWORD=<로그인 비밀번호>
JWT_SECRET=<32자 이상 랜덤 문자열>
HOWTOM_ADMIN_NAME=관리자
HOWTOM_DATA_DIR=/data
```

그리고 Railway Volume을 `/data`에 마운트하는 것을 권장합니다.

프론트와 백엔드를 같은 서비스로 배포할 때는 `VITE_API_URL`을 비워두면 `/api`를 사용합니다. 데모 로그인 우회 기능은 없으며, 로컬·운영 모두 `/api/auth/login`을 통한 실제 로그인만 사용합니다.

블로그 초안을 외부 AI로 생성하려면 `BLOG_AI_PROVIDER`, `BLOG_AI_API_KEY`(또는 `custom` 모드의 `BLOG_AI_API_URL`)를 함께 설정하세요. 비워두면 규칙 기반 생성기로 동작합니다.

## 8. 로컬 실행

패키지가 설치되어 있다면:

```bash
npm ci
npm run build
npm start
```

개발 모드:

```bash
npm run dev
```

`npm run dev`는 패키지가 없으면 설치를 시도한 뒤 Vite 프론트와 Node 백엔드를 함께 실행합니다. 이 배포본에는 수정 전 번들이 섞이지 않도록 `dist`를 포함하지 않으며, Railway 또는 로컬 빌드 과정에서 새로 생성합니다.

운영 인증을 로컬에서도 확인하려면 `.env.example`을 참고해 필요한 환경변수를 쉘 또는 실행 환경에 설정하세요. 실제 비밀번호/Secret이 들어간 `.env` 파일은 배포 ZIP에 포함하지 않습니다.

## 9. 현재 범위와 다음 연결점

이번 버전에서 실제 백엔드 저장까지 구현된 핵심 영역은 **광고주 + 블로그 제작**입니다. 기존 HOWTOM 유니버스의 다른 메뉴는 샘플 데이터를 제거해 Zero State로 두었고, 실제 광고 API·운영 DB가 연결될 때 데이터를 받도록 확장해야 합니다.

다음 실제 연동 우선순위는 다음과 같습니다.

1. Railway Volume 확인
2. 관리자 로그인 환경변수 설정
3. 첫 광고주 등록
4. 블로그 제작 프로젝트 생성·저장 검증
5. Meta 광고 API 1개 계정 연결
6. 광고 성과 DB 스키마와 일일 자동수집 연결
7. 블로그 생성 AI API 선택 연결

---

**버전:** 1.1.0  
**기준:** 2026-08-11  
**상태:** Zero State / Railway backend / Blog Production v1
