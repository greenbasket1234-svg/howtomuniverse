# HOWTOM 통합 제품 요구사항 문서 (PRD)

**문서 버전**: v2.1  
**기준일**: 2026-08-26  
**제품 범위**: HOWTOM 유니버스 + HOWTOM 콘텐츠 제작소 + 공유 Core  
**문서 목적**: 제품의 역할, 데이터 기준, 기능 요구사항, 구현 우선순위, 완료 기준을 하나의 기준 문서로 통합한다.

> 이 문서는 기존 PRD를 기반으로 제품 구조와 개발 원칙을 재정리한 개선본이다.  
> 외부 플랫폼 API 정책은 변경될 수 있으므로 실제 연동 직전에 공식 문서를 다시 확인한다.
>
> **코드 검증 기준**: 2026-08-26 첨부 최종 소스 `howtom uni 4.zip`의
> `howtom-universe-deploy-ready` + `howtom-content-studio`를 기준으로 정적 코드 대조했다.
> 이 문서의 `✅ 검증 완료`는 실제 배포 환경·외부 Credential까지 검증한 경우에만 사용하며,
> 단순 코드 존재 확인은 `🟢 구현됨`으로 기록한다.

---

## 0. 이번 개정의 핵심

기존 문서에서 다음을 보완한다.

1. **현재 상태(As-Is)와 목표 상태(To-Be)를 분리**한다.
2. “화면이 있음”과 “실제 서버 기능이 동작함”을 구분한다.
3. **PostgreSQL / Central Metrics를 Source of Truth**로 명확히 한다.
4. 프론트엔드 `localStorage`는 영구 데이터 저장소로 사용하지 않는다.
5. 광고 수치 계산과 AI 해석을 분리한다.
6. 블로그 `AI 원고 작성`은 HOWTOM 공용 AI가 아니라 **제휴 업체 API Adapter**를 통해 연결한다.
7. 레퍼런스 수집은 플랫폼별 공식/허용 API의 기능 차이를 `capabilities`로 관리한다.
8. Threads와 TikTok을 같은 제약으로 묶지 않는다.
9. 자동화 기능에는 실제 실행 서버·실행 로그·재시도·실패 상태가 반드시 존재해야 한다.
10. 속도·보안·유지보수·비용에 대한 비기능 요구사항과 Definition of Done을 추가한다.
11. 광고주 로그인/Tenant/RBAC과 결제는 외부 SaaS 출시 직전 단계로 유지하되, 데이터 모델의 `tenant_id`는 지금부터 보존한다.
12. 개발자가 아닌 운영자가 AI 코딩 도구로 유지보수할 수 있도록 서비스 경계와 수정 범위를 작게 유지한다.

---

# 1. 제품 정의

## 1.1 비전

HOWTOM은 광고 운영자가 다음 흐름을 하나의 생태계에서 처리하도록 만드는 마케팅 운영 플랫폼이다.

```text
광고 데이터 수집
      ↓
성과 분석
      ↓
인사이트 / 보고서
      ↓
레퍼런스 탐색
      ↓
콘텐츠 제작
      ↓
광고 집행
      ↓
성과 재수집
```

목표는 단순 광고 대시보드가 아니라,

> **광고 운영 → 분석 → 콘텐츠 제작 → 성과 학습**

이 반복되는 운영 루프를 구축하는 것이다.

## 1.2 제품 구성

```text
                         HOWTOM
                            │
                    Shared Core / DB
                            │
             ┌──────────────┴──────────────┐
             │                             │
      HOWTOM UNIVERSE             HOWTOM CONTENT STUDIO
       광고 운영·분석                 콘텐츠 제작·레퍼런스
```

| 구분 | HOWTOM 유니버스 | HOWTOM 콘텐츠 제작소 |
|---|---|---|
| 핵심 역할 | 광고 운영, 성과, 인사이트, 보고서 | 레퍼런스, 콘텐츠 제작, 자산 |
| 사용자 관점 | “광고가 어떻게 되고 있는가?” | “다음에 무엇을 만들 것인가?” |
| 배포 | 독립 웹 서비스 | 독립 웹 서비스 |
| DB | 공유 PostgreSQL | 공유 PostgreSQL |
| 광고주 | 동일 `advertiser_id` | 동일 `advertiser_id` |
| 향후 권한 | 동일 Tenant/RBAC 체계 | 동일 Tenant/RBAC 체계 |

두 앱은 서로의 프론트엔드 코드에 직접 의존하지 않는다.

---

# 2. 제품 목표와 비목표

## 2.1 핵심 목표

### G1. 광고 데이터 신뢰성

같은 광고주·매체·기간을 선택하면 모든 화면에서 같은 수치가 보여야 한다.

### G2. 실제 업무 사용 가능성

단순 UI가 아니라 저장·실행·조회·내보내기까지 실제 업무가 끝나야 한다.

### G3. 낮은 운영비

매출이 발생하기 전에 서버·AI·스토리지 비용이 불필요하게 증가하지 않아야 한다.

### G4. 유지보수 용이성

한 기능 수정이 다른 앱이나 광고 데이터 엔진을 깨뜨리지 않아야 한다.

### G5. 점진적 SaaS 확장

내부 사용 → 소수 광고주 유료 사용 → Tenant/RBAC → 결제 순으로 확장한다.

## 2.2 현재 비목표

다음은 초기 핵심 범위가 아니다.

- 모든 광고 매체 동시 연동
- 수천만 개 SNS 원본 미디어 자체 보관
- 모든 화면에서 실시간 AI 호출
- 처음부터 완전한 Microservice 아키텍처
- 초기 단계의 복잡한 구독/권한 체계
- 공식/허용 범위를 벗어난 SNS 데이터 수집
- AI가 광고 성과 수치를 자체 계산하는 구조

---

# 3. 사용자와 역할

## 3.1 내부 운영자

광고주를 관리하고 광고 데이터를 분석하며 콘텐츠와 보고서를 제작한다.

주요 작업:

- 광고주 선택
- 매체 동기화
- 성과 확인
- 캠페인/소재/키워드 분석
- KPI/예산 확인
- 보고서 작성
- 레퍼런스 탐색
- 광고·블로그·영상 대본 제작

## 3.2 관리자

전체 광고주·계정·연동·실행 로그·오류·사용량을 관리한다.

## 3.3 외부 광고주 — 향후

SaaS 출시 단계에서 자신의 광고주 Workspace만 볼 수 있다.

> 실제 Tenant/RBAC 구현은 후순위지만, 모든 신규 데이터 구조는 `tenant_id` 확장을 막지 않아야 한다.

---

# 4. 공통 제품 원칙

## 4.1 Source of Truth

실제 업무 데이터의 기준은 PostgreSQL이다.

```text
외부 API
   ↓
Sync Backend
   ↓
PostgreSQL
   ↓
Metrics / Domain API
   ↓
Universe / Content Studio
```

금지:

```text
화면 A → Meta API 직접 호출
화면 B → Meta API 직접 호출
화면 C → 별도 계산
```

## 4.2 Mock 원칙

- 실제 기능 자리에 Mock 결과를 반환하지 않는다.
- API 오류 시 Mock 데이터로 fallback하지 않는다.
- 미연동은 `미연동`이라고 표시한다.
- 미구현은 `준비중` 또는 `커넥터 미구현`이라고 표시한다.
- 권한 부족은 `API 권한 필요`라고 표시한다.
- API가 제공하지 않는 수치를 `0`으로 표시하지 않는다.

## 4.3 NULL과 0

```text
0    = 실제 값이 0
NULL = 데이터를 제공받지 못함 / 지원하지 않음
```

UI에서는 NULL을 `—` 또는 `데이터 미제공`으로 표시한다.

## 4.4 광고주 범위

모든 데이터 화면은 공통적으로 다음 두 범위를 지원한다.

```text
전체 보기
특정 광고주
```

특정 광고주 선택 시 모든 하위 화면이 동일한 `advertiser_id` 범위를 사용한다.

---

# 5. 공유 데이터 아키텍처

## 5.1 핵심 엔티티

```text
tenants
users
advertisers
media_accounts

campaigns
creatives
keywords

campaign_daily_metrics
creative_daily_metrics
keyword_daily_metrics

conversions
budgets
kpis

reports
proposals

content_projects
content_assets
references
```

현재 실제 테이블명이 다르더라도 개념적 책임은 위 구조를 따른다.

## 5.2 Central Metrics

모든 광고 성과 화면은 중앙 일별 성과 데이터를 기준으로 계산한다.

필수 일별 구조:

- `date`
- `tenant_id`
- `advertiser_id`
- `media_account_id`
- campaign / creative / keyword 식별자
- spend
- impressions
- reach
- clicks
- link_clicks
- conversions
- purchases
- revenue
- 플랫폼이 제공하는 기타 원본 지표

## 5.3 계산 책임

다음 수치는 Backend/Metrics Layer가 계산한다.

- CPM
- CTR
- CPC
- CVR
- CPA
- ROAS
- 예산 소진율
- 퍼널 전환율
- 증감률
- 계정 규모 대비 반응률

AI가 이 값을 다시 계산하지 않는다.

## 5.4 날짜 필터 표준

데이터를 보는 모든 화면은 동일한 기간 옵션을 사용한다.

```text
오늘
어제
최근 7일
최근 14일
최근 30일
최근 60일
최근 90일
지난달
이번달
기간 직접 선택
```

비교 기능이 있는 경우:

```text
비교 안 함
직전 동일기간
전월
전년 동기간
```

Frontend와 Backend는 `from`, `to` 파라미터를 공통으로 사용한다.

---

# 6. 데이터 동기화

## 6.1 기본 구조

```text
외부 광고 API
      ↓
수집
      ↓
정규화
      ↓
검증
      ↓
DB 저장
      ↓
Metrics API 반영
```

## 6.2 사용자 경험

각 매체/광고주 화면에는 다음을 표시한다.

- 마지막 동기화 시각
- 동기화 상태
- 실패 여부
- `지금 동기화` 버튼

“실시간”은 매 화면에서 외부 API를 즉시 호출하는 의미가 아니다.

> **최신 DB 데이터를 즉시 표시하고, 동기화는 별도 작업으로 실행**한다.

## 6.3 실패 격리

한 광고 계정의 동기화 실패가 다른 계정 수집을 중단시키지 않아야 한다.

각 동기화 작업에는 다음 상태를 저장한다.

```text
queued
running
success
partial_success
failed
```

실패 시:

- error_code
- error_message
- started_at
- finished_at
- affected_account
- retry_count

를 기록한다.

---

# 7. HOWTOM 유니버스

## 7.1 역할

HOWTOM Universe는 **광고 운영과 숫자**에 집중한다.

### 메뉴 방향

```text
홈

운영센터
 ├ 광고 데이터
 ├ DB 데이터
 ├ KPI
 ├ 캠페인
 ├ 키워드
 ├ 소재 성과
 ├ 전환 퍼널
 ├ 광고 캘린더
 └ 예산

인사이트
 ├ 통합 성과
 ├ 매체별
 ├ 광고주별
 ├ 캠페인
 ├ 소재
 └ 키워드

보고서
 ├ 월간 보고서
 └ 다음달 제안서

자동화

광고주

설정
관리자

콘텐츠
 └ 콘텐츠 제작소 ↗
```

콘텐츠 제작 기능을 Universe에 중복 구현하지 않는다.

## 7.2 현재 핵심 기능

기존 PRD에 따르면 다음 기능이 구현되어 있다.

- Meta / 네이버 광고 계정 연동
- 수동·자동 동기화
- 통합/매체/광고주/캠페인/소재/키워드 분석
- 전환 퍼널
- 보고서·제안서
- 광고주 관리
- 접속·보안·동기화 로그

> `완료` 표기는 배포 환경에서 Definition of Done을 통과한 기능에만 사용한다.

---

# 8. Universe 자동화

## 8.1 현재 가장 중요한 신뢰 문제

설정 화면이 존재하더라도 실제 서버 실행기가 없다면 사용자에게 “동작하는 기능”처럼 보여서는 안 된다.

다음 상태를 명시한다.

```text
사용 가능
부분 지원
준비중
연동 필요
```

## 8.2 예약 작업

예:

- 특정 캠페인 ON
- 특정 캠페인 OFF
- 특정 시각 예산 변경

필수 구조:

```text
automation_rules
automation_jobs
automation_job_logs
```

필수 요구사항:

- PostgreSQL 저장
- 서버 Scheduler/Worker 실행
- idempotency
- 재시도
- 성공/실패 로그
- 마지막 실행 시각
- 다음 실행 시각
- 수동 실행
- ON/OFF
- 삭제

캠페인 상태를 변경하는 자동화는 실제 광고 API 응답 성공 후에만 `success`가 된다.

## 8.3 보고서 자동 생성

설정만 저장해서는 안 된다.

실제 결과물까지 만들어야 완료다.

```text
Schedule
  ↓
Report Job
  ↓
Metrics Snapshot
  ↓
Report Generation
  ↓
Saved Report
```

## 8.4 알림

알림 Rule과 Delivery Channel을 분리한다.

```text
Rule Engine
   ↓
Notification Event
   ↓
HOWTOM Internal
Email
Naver Works
기타
```

구현되지 않은 채널은 선택 가능하게 노출하지 않거나 `미연동`으로 표시한다.

---

# 9. HOWTOM 콘텐츠 제작소

## 9.1 역할

Content Studio는 **레퍼런스를 발견하고 실제 제작물로 만드는 곳**이다.

```text
홈

레퍼런스
 ├ 레퍼런스 탐색
 ├ 경쟁사 모니터링
 ├ 레퍼런스 보드
 └ 수집 설정

제작
 ├ 광고 제작
 ├ 블로그 제작
 ├ 이미지 제작
 ├ 영상 대본
 └ 문서 작성

콘텐츠 관리
 ├ 제작물 보관함
 ├ 콘텐츠 캘린더
 └ 템플릿

자산
 ├ 이미지
 ├ 영상
 └ 문서
```

## 9.2 데이터 원칙

- 프로젝트 데이터는 PostgreSQL 저장
- `localStorage`는 UI 임시 상태 이외에 Source of Truth로 사용하지 않음
- 모든 제작물은 `advertiser_id`를 갖는 것을 기본으로 함
- `전체 보기`에서는 전체 광고주 프로젝트를 조회
- 특정 광고주 선택 시 해당 광고주 프로젝트만 조회

---

# 10. 콘텐츠 제작 기능

## 10.1 광고 제작

필수 데이터:

- 광고주
- 프로젝트명
- 채널
- 캠페인 목적
- 소재 유형
- KPI
- 타겟
- 핵심 혜택
- 가격/조건
- 필수 문구
- 금지 문구
- 랜딩 URL
- 후킹안
- 카피안
- CTA
- 이미지/영상 기획
- 상태

상태 예:

```text
draft
review
approved
completed
archived
```

## 10.2 블로그 제작

필수 기능:

- 광고주 선택
- 프로젝트 저장
- 제목
- 키워드
- 본문 편집
- 문체 설정
- 선호/금지 표현
- CTA
- 참고 자료
- 콘텐츠 일정
- 내보내기

### AI 원고 작성

블로그 `AI 원고 작성`은 HOWTOM 공용 AI Gateway에 직접 종속시키지 않는다.

```text
Content Studio
     ↓
POST /api/blog/generate
     ↓
BlogGenerationProvider
     ↓
Partner API Adapter
     ↓
제휴 업체 AI 원고 작성 API
```

장점:

- API Key 비노출
- 제휴 업체 교체 가능
- 요청/실패 로그 관리 가능
- Content Studio 프론트 코드를 제휴 업체 규격과 분리

내부 표준 응답 예:

```json
{
  "title": "...",
  "content": "...",
  "summary": "...",
  "keywords": [],
  "provider": "partner",
  "generated_at": "..."
}
```

제휴 API 확정 전에는 가짜 원고를 생성하지 않는다.

> **현재 코드와 목표 구조의 차이**  
> 최종 첨부 코드에는 공용 `callAI()` Gateway가 이미 존재하고 `/api/blog/generate`도
> 해당 Gateway를 호출하도록 구현되어 있다. 그러나 제품 정책상 **블로그 원고 작성만큼은
> 제휴 업체 API Adapter 방식으로 분리**하기로 한다.
>
> 따라서 현재 `/api/blog/generate`의 공용 AI 호출은 최종 채택 구조가 아니다.
> 제휴 업체가 확정되기 전에는 UI에서 비활성화하거나 서버에서 명확히 `연동 필요`를 반환하고,
> 확정 후 `BlogGenerationProvider → Partner Adapter`로 교체한다.
> 레퍼런스 분석 등 다른 AI 기능은 공용 AI Gateway를 사용할 수 있다.

## 10.3 영상 대본

광고주/플랫폼/길이/목표/핵심 메시지/후킹/구간별 화면·자막·대사를 프로젝트 단위로 저장한다.

## 10.4 문서 작성

기획안·제안 문구·스크립트 등 일반 콘텐츠 프로젝트를 저장한다.

## 10.5 이미지 제작

별도 기능으로 구현할 경우 다음을 분리한다.

- 이미지 기획
- 이미지 생성
- 기존 이미지 편집
- 생성 결과 저장

이미지 생성 API 비용이 발생하는 경우 사용자 실행 시점에만 호출한다.

---

# 11. 레퍼런스 시스템

## 11.1 목적

검색 결과를 많이 보여주는 것이 목적이 아니다.

> **업무에 참고할 콘텐츠를 발견 → 저장 → 광고주와 연결 → 제작으로 전달**

하는 것이 목적이다.

## 11.2 공통 흐름

```text
검색 / 경쟁사
      ↓
외부 Connector
      ↓
Normalize
      ↓
검색 결과
      ↓
저장
      ↓
Reference Board
      ↓
이 레퍼런스로 제작
```

## 11.3 타입

```text
ADVERTISEMENT
ORGANIC_CONTENT
```

## 11.4 플랫폼 Connector

공통 인터페이스:

```text
ReferenceConnector

search()
fetchDetail()
normalize()
getCapabilities()
```

예:

```text
MetaAdsReferenceConnector
InstagramOrganicReferenceConnector
YouTubeReferenceConnector
TikTokReferenceConnector
ThreadsReferenceConnector
ManualReferenceConnector
```

## 11.5 Capability 기반 UI

플랫폼마다 제공 지표가 다르다.

예:

```json
{
  "views": true,
  "likes": true,
  "comments": true,
  "shares": false,
  "saves": false,
  "followers": true
}
```

지원하지 않는 필터는 자동 비활성화한다.

---

# 12. 레퍼런스 데이터 모델

## 12.1 references

권장 필드:

```text
id
tenant_id
advertiser_id

reference_type
platform
source_type
external_id

url
canonical_url

title
body

author_id
author_name
author_followers

thumbnail_url
media_url
content_type

published_at
collected_at

views
likes
comments
shares
saves

available_metrics

status
is_favorite

raw_text
transcript
raw_metadata

created_by
created_at
updated_at
```

## 12.2 중복 방지

우선순위:

```text
platform + external_id
```

없으면:

```text
canonical_url
```

## 12.3 관련 테이블

```text
reference_collection_rules
reference_competitors

reference_boards
reference_board_items

reference_tags
reference_tag_links

reference_notes
reference_usage
```

하나의 레퍼런스는 여러 보드에 포함될 수 있다.

---

# 13. 레퍼런스 탐색 UI

## 13.1 기본 필터

```text
전체 / 광고 / 일반 콘텐츠

플랫폼

게시기간

광고주

키워드

콘텐츠 유형

상태

보드
```

## 13.2 성과 필터

플랫폼이 실제로 제공하는 경우에만:

- 조회수
- 좋아요
- 댓글
- 공유
- 저장
- 팔로워/구독자

Backend 계산 가능 항목:

```text
viewFollowerRatio
likeFollowerRatio
commentFollowerRatio
```

이 값으로:

```text
🔥 계정 규모 대비 반응 높음
```

같은 보조 배지를 표시할 수 있다.

---

# 14. 플랫폼별 레퍼런스 정책

외부 API는 변경 가능성이 높으므로 아래 내용은 제품 방향이며, 실제 개발 직전에 공식 정책을 재검증한다.

## 14.1 Meta 광고

- Meta의 공식 Ad Library/허용 데이터 범위를 우선 사용
- 광고 게재기간 계산 가능 시 장기 게재 소재 표시
- 실제 ROAS/CPA를 알 수 없으면 성과 우수 광고라고 단정하지 않음
- 공개 API가 제공하지 않는 지표는 생성하지 않음

표현:

```text
장기 게재
장기 운영 소재
위닝 가능성
```

## 14.2 Instagram 일반 콘텐츠

공식 API 범위에서 다음을 우선한다.

- Professional Business/Creator 계정 기반 기능
- Hashtagged media
- 허용된 기본 메타데이터/지표

Instagram 앱 검색창처럼 전체 공개 게시물을 자유 키워드 검색할 수 있다고 가정하지 않는다.

검색 UX는 필요하면:

```text
검색어
 ↓
관련 해시태그 후보
 ↓
Hashtag media
 ↓
Caption 내부 관련도 필터
```

방식으로 보완한다.

## 14.3 YouTube

공식 Data API 기반 검색을 우선한다.

공개 가능한 경우:

- 영상
- 채널
- 조회수
- 좋아요
- 댓글
- 구독자 관련 공개 지표

공유/저장 등 제공되지 않는 지표는 표시하지 않는다.

## 14.4 Threads

Threads는 TikTok과 별도로 취급한다.

현재 공식 Threads API에는 공개 Threads 게시물의 **keyword search** 기능이 존재하므로, 권한·필드·Rate Limit을 검증한 뒤 공식 커넥터 후보로 유지한다.

검증된 사실 (2026-08-26 기준, `developers.facebook.com/documentation/threads/keyword-search`):

- 엔드포인트: `GET /keyword_search` (`search_mode=TAG`로 토픽 태그 검색도 지원)
- 검색 결과 정렬: `search_type=TOP` 또는 `RECENT`
- Rate Limit: 사용자 1명당 **24시간 롤링 기준 최대 2,200건** 쿼리 (앱이 여러 개여도 사용자 단위로 합산됨, 결과 없는 쿼리는 한도에 포함 안 됨)
- **앱 리뷰(승인) 필요** — 승인 전에는 호출 불가
- 반환 필드에 `owner`(작성자 상세)는 제외됨

지원 가능 시:

```text
KEYWORD
TAG
TOP
RECENT
```

검색 모드를 활용한다.

## 14.5 TikTok

TikTok은 기능 종류와 접근 자격을 분리한다.

- Display API
- Research API
- Commercial Content API

일반 공개 유기적 콘텐츠를 HOWTOM 상업 SaaS가 자유롭게 검색할 수 있다고 가정하지 않는다.

Commercial Content/Ads 데이터는 공식 API의 국가·권한·사용 목적 범위가 HOWTOM에 적합한지 검증 후 연결한다.

검증된 사실 (2026-08-26 기준, `developers.tiktok.com/products/commercial-content-api`):

- 엔드포인트 예: `POST /v2/research/adlib/ad/query`, `POST /v2/research/adlib/commercial_content/query`, `POST /v2/research/adlib/advertiser/query`
- **현재는 EU 국가 데이터만 제공** — 한국을 포함한 비EU 상업 콘텐츠는 이 API로 아직 조회 불가
- 신청자 위치는 어디든 가능하지만, **"연구자(researcher)" 대상 승인제**로 운영되며 신청 후 승인까지 영업일 기준 2일 소요
- 광고 데이터는 게재 기간 + 마지막 노출 후 최대 1년까지만 보관

**결론**: TikTok Commercial Content API는 존재하지만, (1) EU 외 지역 데이터 미제공, (2) 연구자 승인제라는 두 가지 이유로 **현재 시점에 HOWTOM(한국 상업 광고주 대상 SaaS)이 바로 활용하기는 어렵다.** "미지원"이 아니라 "**연동 필요 — 자격/지역 요건 재확인 필요**"로 상태를 관리하고, TikTok이 비EU로 데이터를 확장하는지 주기적으로 재확인한다.

---

# 15. 경쟁사 모니터링

광고주별로 경쟁 브랜드를 등록한다.

```text
advertiser
  ↓
competitors
  ↓
scheduled collection
  ↓
new references
```

초기:

```text
[지금 수집]
```

후속:

```text
자동 수집 Worker
```

수집 작업은 Universe의 광고 데이터 API 서버를 막지 않도록 독립 실행한다.

---

# 16. 레퍼런스 Worker

## 16.1 역할

- 경쟁사 신규 광고 확인
- 신규 레퍼런스 저장
- 기존 광고 상태 갱신
- 종료 광고 확인
- 재시도
- 실행 로그

## 16.2 배포

초기에는 Content Studio 서버 내부 Scheduler로 시작할 수 있다.

수집량이 증가하면:

```text
Content Studio Web/API
        +
Reference Worker
```

로 분리한다.

## 16.3 무거운 미디어 저장 방지

기본 저장:

- metadata
- thumbnail URL
- original URL

원본 이미지/영상은 꼭 필요한 경우에만 Object Storage에 저장한다.

---

# 17. AI 아키텍처

## 17.1 AI의 역할

AI는 다음에 사용한다.

- 성과 해석
- 소재 해석
- 레퍼런스 요약
- 후킹/소구 분석
- 제작 보조
- 보고서 문장화

AI가 하지 않는 것:

- spend 계산
- CTR 계산
- CPC 계산
- CPA 계산
- ROAS 계산
- 정확한 KPI 판정값 산출

## 17.2 AI Context

향후 공용 AI Gateway는 다음 구조를 받을 수 있어야 한다.

```text
advertiser
dateRange

metrics
campaigns
creatives
keywords

kpi
budget

brandContext

references
```

## 17.3 Task Type

예:

```text
performance_analysis
media_analysis
campaign_analysis
creative_analysis
keyword_analysis

budget_recommendation

monthly_report
proposal

reference_analysis

ad_copy
video_script
```

블로그 원고 생성은 별도 Partner Provider로 유지할 수 있다.

## 17.4 비용 통제

- 사용자 요청 시 호출
- 동일 입력 결과 캐시
- 대용량 Raw Log를 그대로 AI에 전달하지 않음
- Backend에서 요약한 JSON 전달
- advertiser/function별 사용량 기록
- 실패 시 무한 재시도 금지

---

# 18. 성능 요구사항

## 18.1 Frontend

- 페이지별 Lazy Loading
- Code Splitting
- Thumbnail Lazy Loading
- 불필요한 영상 자동재생 금지
- 초기 화면에서 전체 DB 로드 금지
- 대량 결과는 Pagination 또는 Virtualization
- 모바일에서 전체 페이지가 가로로 밀리지 않도록 처리

## 18.2 Backend

- Server-side Pagination
- Server-side Filtering
- 주요 필터 컬럼 Index
- 장기 작업은 요청-응답과 분리
- 외부 API Timeout
- Retry + Backoff
- 캐시 가능한 데이터는 캐시

## 18.3 권장 체감 목표

내부 업무 사용 기준:

- 일반 데이터 화면은 정상 환경에서 수 초 이상 계속 빈 화면이 되지 않도록 한다.
- 긴 동기화/수집 작업은 로딩 화면을 붙잡지 않고 Job 상태로 전환한다.
- Content Studio의 레퍼런스 수집 장애가 Universe 성과 조회에 영향을 주지 않아야 한다.

---

# 19. 보안 요구사항

## 19.1 Secret

다음은 Git에 절대 포함하지 않는다.

```text
.env
API Key
Access Token
JWT Secret
DB Password
```

Git에는 `.env.example`만 유지한다.

## 19.2 인증

현재 내부 단계:

- 관리자 인증
- JWT

외부 SaaS 전환 전:

- 사용자 계정
- Tenant
- RBAC
- 광고주 Workspace 권한
- 세션 정책
- 비밀번호 재설정
- 감사 로그

를 구현한다.

## 19.3 Tenant

현재 단일 관리자라도 신규 데이터 구조에서 `tenant_id`를 함부로 제거하지 않는다.

외부 출시 전에는 모든 주요 쿼리에 Tenant Scope를 강제한다.

---

# 20. 로그와 관측성

관리자에서 최소 다음을 확인할 수 있어야 한다.

## 20.1 광고 데이터

- 동기화 실행
- 성공/실패
- 광고 계정
- 소요시간
- 수집 건수
- 오류

## 20.2 자동화

- Rule
- Job
- 실행 시각
- 실행 결과
- 외부 API 결과
- 재시도

## 20.3 레퍼런스

- Provider
- 검색어
- 수집 건수
- 저장 건수
- 중복 건수
- API 오류

## 20.4 AI

- 기능
- Provider
- 광고주
- 요청 시각
- 성공/실패
- 사용량
- 예상 비용 또는 Provider 사용량 ID

---

# 21. 유지보수 원칙

HOWTOM은 개발자가 아닌 운영자가 AI 코딩 도구를 이용해 장기간 유지보수할 수 있어야 한다.

따라서:

1. 한 파일에 여러 도메인을 몰아넣지 않는다.
2. Universe와 Content Studio가 서로 프론트 코드 import를 하지 않는다.
3. Connector / Provider를 교체 가능하게 만든다.
4. DB Schema 변경은 Migration으로 관리한다.
5. README에 실행·배포·환경변수·DB 구조를 기록한다.
6. 기능 수정 시 관련 없는 메뉴를 함께 변경하지 않는다.
7. 작은 수정은 변경 파일 단위로 배포 가능하게 유지한다.
8. 삭제 파일이 있으면 명시적으로 삭제한다.
9. `package-lock.json`을 유지한다.
10. `.git`, `.env`, `node_modules`, `.data`, 임시 build ZIP을 배포 소스에 섞지 않는다.

---

# 22. 준비중 메뉴 정책

실제 기능이 없는 메뉴가 과도하게 늘어나면 제품 신뢰도가 떨어진다.

각 메뉴는 다음 중 하나여야 한다.

```text
실제 기능
외부 앱 이동 링크
명확한 준비중
메뉴에서 숨김
```

추천:

### Universe

콘텐츠 관련 메뉴는 Content Studio로 이동한다.

```text
콘텐츠
 └ 콘텐츠 제작소 ↗
```

### 자산/템플릿

Content Studio가 책임지는 기능은 Universe에서 중복 구현하지 않는다.

---

# 23. 상태 정의

앞으로 문서의 기능 상태는 아래 용어만 사용한다.

| 상태 | 정의 |
|---|---|
| ✅ 검증 완료 | 서버·DB·UI·Production Build·실제 흐름까지 검증 |
| 🟢 구현됨 | 코드 구현 완료, 외부 환경/API 검증 일부 남음 |
| 🟡 부분 지원 | 일부 범위만 실제 작동 |
| 🔗 연동 필요 | UI/Backend 준비, 외부 Credential 필요 |
| ⬜ 준비중 | 실제 기능 없음 |
| ⛔ 미지원 | 현재 정책/기술상 제공하지 않음 |

단순히 화면이 존재한다고 `완료`로 표시하지 않는다.

---

# 24. Definition of Done

기능 하나가 `✅ 검증 완료`가 되려면 최소 다음을 통과해야 한다.

## 24.1 공통

- TypeScript 검사 통과
- Production Build 통과
- 상대 import 누락 없음
- Desktop/Tablet/Mobile 확인
- Zero/Empty/Error/Loading 상태 존재
- Mock fallback 없음
- README 업데이트

## 24.2 DB 기능

- 실제 PostgreSQL 저장
- 새로고침 후 유지
- 다른 브라우저/PC에서도 동일 데이터 조회 가능
- 광고주 Scope 정상
- 전체 보기 Scope 정상
- 삭제/수정 정상
- Migration 또는 초기화 로직 확인

## 24.3 API 기능

- 정상 응답
- 인증 오류
- 권한 오류
- Rate Limit
- Timeout
- 외부 장애

각 상태를 구분한다.

## 24.4 자동화

- 설정 저장
- 실제 Job 생성
- 실제 실행
- 결과 저장
- 실패 로그
- Retry
- 중복 실행 방지

까지 검증해야 완료다.

---

# 25. 비용 통제

초기 HOWTOM의 원칙:

> **비용이 매출보다 먼저 커지지 않는다.**

## 25.1 Pre-Revenue

- 기존 Railway 최소 구성 유지
- PostgreSQL 공유
- 유료 AI 상시 자동실행 금지
- 원본 미디어 대량 보관 금지
- 공식 무료/저가 API 우선

## 25.2 유료 고객 증가 후

필요한 시점에만:

- Worker
- Object Storage
- Queue
- 추가 광고 API
- AI Gateway
- 고급 검색
- 외부 데이터 Provider

를 단계적으로 확장한다.

---

# 26. 권장 다음 작업 우선순위

최종 코드 대조 결과, 콘텐츠 제작소의 PHASE 2~7 상당 부분은 이미 코드로 구현되어 있다.
따라서 기존 우선순위의 “아직 구현되지 않은 것으로 가정한 작업”은 실제 상태에 맞게 재정렬한다.

## P0 — 코드·문서·제품 정책 정합성

1. **블로그 AI 경로 정리**  
   현재 `/api/blog/generate`가 공용 AI Gateway를 호출하는 구현을 제품 정책과 맞춘다.
   제휴 업체 확정 전에는 `연동 필요`로 유지하고, 확정 후 `BlogGenerationProvider → Partner Adapter`로 교체한다.

2. **Content Studio 문서/환경변수 드리프트 수정**  
   실제 코드에는 Meta Ad Library, YouTube, Instagram, AI Gateway가 존재하지만
   현재 `.env.example`과 README는 PHASE 2B 수준에 머물러 있다.
   실제 코드가 요구하는 환경변수와 현재 구현 Phase를 README / `.env.example` / package version에 맞춘다.

3. **Threads 안내 문구 수정**  
   현재 코드와 UI는 TikTok·Threads를 함께 “공개 검색 API가 없어 지원하지 않음”으로 처리한다.
   제품 정책상 Threads는 별도 Connector 후보이므로, 적어도 안내 문구를
   `현재 HOWTOM 커넥터 미구현`으로 바꿔 외부 플랫폼 자체가 불가능한 것처럼 단정하지 않는다.

4. **Universe 콘텐츠 중복 메뉴 정리**  
   Universe에는 `콘텐츠 제작소 ↗`가 이미 있으나 기존 콘텐츠 홈/제작 메뉴도 함께 남아 있다.
   Content Studio에서 실제 사용 검증이 끝난 기능부터 Universe 중복 메뉴를 제거하거나 외부 링크로 전환한다.

5. **Universe 자동화 Mock 신뢰 문제 정리**  
   `implementationStatus: 'mock'`인 예약 작업·보고서 자동 생성·광고 문구 자동 생성 등을
   `부분 지원/준비중`으로 명확히 표시하고, 실제 실행되지 않는 기능을 작동하는 것처럼 보이지 않게 한다.

## P1 — 실제 배포 환경 검증

6. Content Studio 제작 기능(광고/블로그/영상대본/문서/템플릿/자산)의 실제 PostgreSQL CRUD 검증
7. 제작물 보관함·콘텐츠 캘린더의 전체 보기/특정 광고주 필터 및 4종 프로젝트 통합 조회 검증
8. Meta Ad Library Credential 연결 후 검색→저장→보드→경쟁사→Worker 실제 사이클 검증
9. YouTube API Key 연결 후 검색·조회수·좋아요 필드 검증
10. Instagram Credential + IG Business Account ID 연결 후 해시태그 검색 검증
11. Reference Worker 08·20시 실행 로그와 수동 실행 경로 검증
12. Universe 자동 동기화 07·09·14·17·19시 Production 실행 로그 검증

## P2 — Universe 자동화 실제 Backend

13. 예약 캠페인 ON/OFF 실제 서버 실행기
14. `automation_rules / automation_jobs / automation_job_logs` PostgreSQL 구조
15. Retry / Idempotency / 실행 결과 로그
16. 보고서 자동 생성 실제 Backend
17. 이메일/네이버웍스 등 외부 알림 채널은 필요성이 확인된 뒤 연결

## P3 — 콘텐츠 제작소 고도화

18. 이미지 제작 기능
19. **레퍼런스 → 광고/블로그/영상대본/문서 제작 Context 전달**
20. Threads Connector 구현 가능 범위 재검증 후 개발
21. TikTok은 한국 상업 SaaS에서 실제 사용 가능한 공식 범위가 확인될 때까지 보류
22. 수집량이 커질 때 Reference Worker를 웹 서버와 분리
23. 원본 미디어 저장은 실제 필요가 생길 때 Object Storage 추가

## P4 — AI

24. 블로그 제휴 업체 API Adapter 연결
25. 현재 구현된 레퍼런스 AI 분석의 실제 Provider 검증
26. 광고 제작/영상 대본 AI 지원
27. 성과 분석·보고서 AI
28. Semantic Search는 레퍼런스 데이터와 실제 사용량이 충분히 쌓인 뒤 검토

## P5 — 외부 SaaS 출시

29. Tenant/RBAC
30. 광고주 로그인
31. 구독/결제
32. Entitlement
33. 사용량/비용 관리
34. 외부 고객용 온보딩

---

# 27. 외부 API 운영 정책

외부 플랫폼 API의 숫자·권한·보관기간은 PRD에 장기간 고정하지 않는다.

대신 Connector별로 관리한다.

```text
provider
api_version
capabilities
required_scopes
rate_limit_policy
backfill_policy
last_verified_at
```

관리자 또는 문서에:

```text
마지막 정책 확인일
```

을 남긴다.

---

# 28. 주요 제품 리스크

| 리스크 | 대응 |
|---|---|
| 메뉴가 너무 많아짐 | Universe / Content Studio 역할 분리 |
| Content Studio가 무거워짐 | Pagination, Lazy Loading, Worker 분리 |
| 외부 API 변경 | Connector/Provider 추상화 |
| 데이터 숫자 불일치 | Central Metrics 단일 기준 |
| Mock이 실제 기능처럼 보임 | 상태 표시 및 Mock fallback 금지 |
| AI 비용 증가 | On-demand + Cache + Usage Log |
| 제휴 AI 업체 변경 | BlogGenerationProvider Adapter |
| SNS 원본 저장 비용 | URL/Metadata 우선 |
| AI 코딩 수정 중 회귀 | 작은 변경 단위 + Build/Regression Test |
| 외부 SaaS 데이터 노출 | Tenant/RBAC 출시 전 강제 |

---

# 29. 의사결정 기준

새 기능을 넣기 전 아래 질문에 답한다.

1. 이 기능은 Universe인가 Content Studio인가?
2. 실제 업무 시간을 줄이는가?
3. 실제 데이터가 존재하는가?
4. 외부 API가 필요한가?
5. 반복 비용이 발생하는가?
6. 지금 고객 수에서 필요한가?
7. 다른 기능과 중복되는가?
8. AI 없이 Backend 규칙으로 해결 가능한가?
9. 장애가 발생했을 때 다른 핵심 기능을 막는가?
10. 개발자가 아닌 운영자가 이후 수정할 수 있는 구조인가?

3개 이상 명확하지 않으면 즉시 구현하지 않고 Backlog로 보낸다.

---

# 30. 현재 코드 위치 참고

기존 PRD의 코드 위치 기준:

| 영역 | 주요 위치 |
|---|---|
| Universe 메뉴 | `src/data/universeMenu.ts` |
| Universe 자동화 | `src/automation/*` |
| Universe 동기화 Scheduler | `server.mjs` |
| Content Studio 라우트 | `src/App.tsx` |
| Content Studio 레퍼런스 | `src/features/references/` |
| Content Studio Reference Worker | `server.mjs` |
| Content Studio AI/Provider | 향후 Provider별 모듈 분리 권장 |

`server.mjs`가 지나치게 비대해지면 다음 단위로 분리한다.

```text
server/
 ├ routes/
 ├ services/
 ├ repositories/
 ├ connectors/
 ├ providers/
 ├ jobs/
 └ middleware/
```

단, 실제 유지보수 필요가 생기기 전부터 과도한 Microservice로 쪼개지는 않는다.

---

# 31. 최종 제품 구조

```text
HOWTOM
│
├── Shared Core
│   ├ Advertisers
│   ├ Tenant-ready Data Model
│   ├ PostgreSQL
│   └ Common Domain Definitions
│
├── HOWTOM Universe
│   ├ 광고 데이터
│   ├ 운영
│   ├ 인사이트
│   ├ KPI/예산
│   ├ 자동화
│   └ 보고서
│
└── HOWTOM Content Studio
    ├ 레퍼런스
    ├ 경쟁사 모니터링
    ├ 광고 제작
    ├ 블로그 제작
    ├ 이미지 제작
    ├ 영상 대본
    ├ 문서
    ├ 제작물/캘린더
    ├ 템플릿
    └ 자산
```

장기적으로 HOWTOM의 차별점은 기능 수가 아니라 다음 연결에 있다.

```text
외부 레퍼런스
      ↓
HOWTOM 제작
      ↓
실제 광고 집행
      ↓
Meta / 네이버 성과
      ↓
성과가 좋았던 소재 학습
      ↓
다음 제작
```

**이 Closed Loop를 만드는 것이 HOWTOM의 핵심 제품 방향이다.**

---

# 부록 A. 실측 As-Is 현황 (2026-08-26, `howtom uni 4.zip` 코드 직접 확인 기준)

본문(0~31장)은 제품 원칙과 목표 구조를 정의한다.
이 부록은 **최종 첨부 소스에 실제로 어떤 코드가 존재하는지**를 고정한다.

> 중요: 이 부록은 정적 코드 대조 결과다.  
> 외부 API Key, Railway Variables, 실제 Production DB, Scheduler 실행 로그까지 검증하지 않은 기능은
> 코드가 존재하더라도 `✅ 검증 완료`가 아니라 `🟢 구현됨` 또는 `🔗 연동 필요`로 기록한다.

## A.1 HOWTOM 유니버스 — 실측 상태

| 기능 | 상태 | 코드 기준 판단 |
|---|---|---|
| Meta / 네이버 매체 연동 및 동기화 Backend | 🟢 구현됨 | 실제 `/api/integrations/sync` 계열과 DB 기반 동기화 구조 존재 |
| 자동 동기화 Scheduler | 🟢 구현됨 | `AUTO_SYNC_HOURS_KST = [7, 9, 14, 17, 19]`, KST 기준 1분 주기 감시, 계정별 180초 timeout 및 실패 격리 구현 |
| 광고 성과 / Central Metrics | 🟢 구현됨 | 캠페인·소재·키워드 일별 데이터 및 Metrics 관련 코드 존재 |
| 콘텐츠 제작소 외부 이동 | 🟢 구현됨 | Universe 메뉴에 `콘텐츠 제작소 ↗` 존재 |
| 콘텐츠 > 이미지 제작 | ⬜ 준비중 | `/planned/image-creation` |
| AI 자동화 > 레퍼런스 자동 수집 | ⬜ 준비중 (Universe) | Content Studio에는 실제 Reference Worker가 별도로 존재하므로 Universe에서는 중복 제거/외부 링크 대상 |
| AI 자동화 > 승인 요청 자동화 | ⬜ 준비중 | `/planned/approval-automation` |
| 자산관리 > 로고 브랜드 자료 / 템플릿 / 프롬프트 | ⬜ 준비중 | `/planned/*` |
| 예약 작업(캠페인 ON/OFF) | 🟡 부분 지원 | `localStorage` 저장 + `implementationStatus: 'mock'`; 실제 매체 API 실행 Scheduler 없음 |
| 보고서 자동 생성 | 🟡 부분 지원 | 설정 저장 코드 존재, 실제 주기적 파일 생성 서버 실행기 없음 |
| 광고 문구 자동 생성 | 🟡 부분 지원 | 설정/수동 실행 UI 코드 존재, 자동 서버 실행은 `mock` |
| 데이터 자동 수집 자동화 | 🟡 부분 지원 | 일부 Source만 available, 설정 저장은 localStorage |
| 알림 규칙 평가 | 🟢 구현됨 | notification rule/engine 코드 존재 |
| 알림 외부 발송 채널 | 🟡 부분 지원 | HOWTOM 내부 알림은 구현, 외부 채널은 미완성 |

### A.1.1 자동 동기화와 “자동화 메뉴”는 다른 기능이다

둘을 혼동하지 않는다.

```text
매체 자동 동기화
= server.mjs 실제 Scheduler
= 07 / 09 / 14 / 17 / 19 KST
= 실제 광고 계정 Sync 호출

AI 자동화 메뉴의 예약/보고서/카피
= 대부분 Frontend localStorage 설정
= 현재 실제 서버 Job 실행기 없음
```

따라서 **매체 자동 동기화는 구현되어 있지만, 자동화 메뉴 전체가 구현된 것은 아니다.**

---

## A.2 HOWTOM 콘텐츠 제작소 — 실제 라우트/기능 상태

최종 `src/App.tsx` 기준 실제 기능 라우트:

```text
/references
/references/competitors
/references/boards
/references/settings

/production/ad
/production/blog
/production/video-script
/production/document

/library
/calendar
/templates

/assets/images
/assets/videos
/assets/documents
```

`/production/image`만 현재 Stub이다.

| Phase | 범위 | 상태 | 코드 기준 비고 |
|---|---|---|---|
| 1 | 앱 분리, 공통 광고주, Universe 상호 이동 | 🟢 구현됨 | 동일 광고주 Context와 전체 보기 지원 |
| 2 | 광고 제작 | 🟢 구현됨 | `ad_projects` PostgreSQL CRUD |
| 2 | 블로그 제작 | 🟢 구현됨 | `blog_projects`, `blog_styles`, `blog_assets` |
| 2 | 영상 대본 | 🟢 구현됨 | `video_script_projects` CRUD |
| 2 | 문서 작성 | 🟢 구현됨 | `document_projects` CRUD |
| 2 | 템플릿 | 🟢 구현됨 | `content_templates` CRUD/복제/버전 |
| 2 | 자산 | 🟢 구현됨 | `content_assets`, URL/metadata 등록 방식 |
| 2 | 제작물 보관함 | 🟢 구현됨 | 광고·블로그·영상대본·문서 4개 API를 병렬 조회 후 통합 표시 |
| 2 | 콘텐츠 캘린더 | 🟢 구현됨 | 4개 프로젝트를 통합해 월간 캘린더 표시 |
| 2 | 이미지 제작 | ⬜ 준비중 | `Stub` 라우트 유지 |
| 3 | Meta 레퍼런스 탐색 | 🔗 연동 필요 | Meta Ad Library 검색 코드 구현, Token 필요 |
| 3 | 레퍼런스 저장/보드 | 🟢 구현됨 | `content_references`, `reference_boards`, `reference_board_items` |
| 3 | 경쟁사 모니터링 | 🟢 구현됨 | `reference_competitors` CRUD |
| 4 | Reference Worker | 🔗 연동 필요 | KST 08·20시 Scheduler + 수동 실행 API 구현, Meta Token 연결 시 실제 동작 |
| 5 | YouTube Connector | 🔗 연동 필요 | 검색 + statistics 조회 코드 구현, `YOUTUBE_API_KEY` 필요 |
| 6 | Instagram 해시태그 Connector | 🔗 연동 필요 | 공식 Graph API 기반 코드 구현, `META_ACCESS_TOKEN` + IG Business Account ID 필요 |
| 6 | Threads Connector | ⬜ 준비중 | 현재 `connector-status=false`, 검색 요청 시 지원하지 않는다는 오류를 반환함 |
| 6 | TikTok Connector | ⬜ 준비중 | 현재 `connector-status=false`, 실제 Connector 코드 없음 |
| 7 | 공용 AI Gateway | 🔗 연동 필요 | Anthropic/OpenAI/custom 호출 코드 구현, Credential 필요 |
| 7 | 레퍼런스 AI 분석 | 🔗 연동 필요 | 저장 레퍼런스 분석 API 구현, AI Gateway 연결 필요 |
| 7 | 블로그 AI 생성 | 🟡 구현은 있으나 정책 불일치 | 현재 공용 AI Gateway에 연결되어 있으나 To-Be는 제휴업체 Partner Adapter |
| 7 | AI 의미 검색 | ⬜ 준비중 | Semantic/Vector 검색 구현 없음 |
| 7 | 광고/영상 제작 AI 고도화 | ⬜ 준비중 | 별도 AI 제작 지원 미구현 |

---

## A.3 Content Studio 실제 PostgreSQL 테이블

최종 `server.mjs`에서 실제 `CREATE TABLE IF NOT EXISTS`가 확인되는 콘텐츠 관련 테이블:

| 영역 | 실제 테이블 |
|---|---|
| 광고 제작 | `ad_projects` |
| 템플릿 | `content_templates` |
| 문서 작성 | `document_projects` |
| 영상 대본 | `video_script_projects` |
| 공통 자산 | `content_assets` |
| 레퍼런스 | `content_references` |
| 경쟁 브랜드 | `reference_competitors` |
| 레퍼런스 보드 | `reference_boards` |
| 보드-레퍼런스 연결 | `reference_board_items` |
| 블로그 | `blog_projects` |
| 광고주별 블로그 스타일 | `blog_styles` |
| 블로그 사진 자산 | `blog_assets` |

제작물 보관함과 콘텐츠 캘린더는 별도 테이블을 만들지 않고:

```text
ad_projects
blog_projects
document_projects
video_script_projects
```

4개 프로젝트 API를 조회해 통합한다.

---

## A.4 Content Studio Connector / AI 환경변수 정합성

### 코드가 실제로 참조하는 환경변수

```text
DATABASE_URL

HOWTOM_ADMIN_EMAIL
HOWTOM_ADMIN_PASSWORD
HOWTOM_ADMIN_NAME
JWT_SECRET

VITE_UNIVERSE_URL

META_AD_LIBRARY_ACCESS_TOKEN
YOUTUBE_API_KEY
META_ACCESS_TOKEN

AI_PROVIDER
AI_API_KEY
AI_API_URL
AI_MODEL
```

### 현재 문서 드리프트

최종 첨부 코드의 `.env.example`은 PHASE 2B 시점 내용에 머물러 있으며
다음 Connector/AI 변수가 빠져 있다.

```text
META_AD_LIBRARY_ACCESS_TOKEN
YOUTUBE_API_KEY
META_ACCESS_TOKEN
AI_PROVIDER
AI_API_KEY
AI_API_URL
AI_MODEL
```

따라서 **실제 코드를 바꾸는 작업이 아니라 `.env.example` / README / package version을 현재 구현 상태와 맞추는 문서 정리 작업이 필요하다.**

---

## A.5 Content Studio README / package metadata 드리프트

최종 코드에는 PHASE 3~7 기능이 존재하지만:

- README 제목/설명은 PHASE 2B 중심
- README 일부에는 레퍼런스가 아직 Stub이라고 적혀 있음
- README에는 블로그 AI가 비활성이라고 적혀 있지만 실제 서버에는 공용 AI Gateway 기반 `/api/blog/generate` 코드가 존재
- `package.json` 버전도 `0.2.0-phase2a-blog`로 최신 구현 범위를 반영하지 않음
- `server.listen` 로그도 `PHASE 2B blog+ad server`라고 출력

이는 기능 장애보다는 **유지보수 위험**이다.
AI 코딩 도구가 README/버전 문자열을 믿고 잘못된 전제에서 작업하지 않도록 P0에서 정리한다.

---

## A.6 현재 코드에서 즉시 수정이 필요한 제품 정책 불일치

> **✅ 조치 완료 (2026-08-26)**: 아래 1~2번, 그리고 A.5의 README/package.json/서버 로그 드리프트는
> 본 PRD 검토 직후 실제 코드에 반영했다. `/api/blog/generate`는 이제 공용 AI Gateway(`callAI`)가 아니라
> 별도 `callBlogGenerationProvider()`(`BLOG_PARTNER_API_URL`/`BLOG_PARTNER_API_KEY`)를 호출하며,
> 두 값이 비어있으면 정직하게 "연동 필요" 오류를 반환한다. Threads/TikTok 안내 문구도 하나로
> 뭉치지 않고 각각의 실제 제약(Threads=HOWTOM 커넥터 미구현, TikTok=EU 한정·연구자 승인제)을
> 명시하도록 분리했다. 3번(Universe 콘텐츠 중복 메뉴 정리)은 아직 미착수.

### 1. 블로그 AI

As-Is:

```text
/api/blog/generate
   ↓
callAI()
   ↓
Anthropic / OpenAI / custom
```

To-Be:

```text
/api/blog/generate
   ↓
BlogGenerationProvider
   ↓
Partner API Adapter
   ↓
제휴 업체 원고 API
```

따라서 **현재 구현은 기술적으로 존재하지만 최종 제품 정책에는 맞지 않는다.**

### 2. Threads 안내

현재 코드:

```text
TikTok, Threads
→ 공개 콘텐츠 검색 API가 없어 지원하지 않음
```

제품 정책:

```text
Threads
→ HOWTOM Connector 현재 미구현
→ 공식 지원 범위를 별도 검증해 Connector 후보로 유지
```

즉 UI에서는 플랫폼 자체가 불가능하다고 단정하지 않고
`현재 HOWTOM에서 준비중`으로 표현한다.

### 3. Universe 콘텐츠 중복

Universe에는 이미:

```text
콘텐츠 제작소 ↗
```

가 존재하지만 동시에 기존:

```text
콘텐츠 홈
광고 제작
블로그 제작
영상 대본
문서 작성
제작물
템플릿
```

등의 내부 메뉴도 남아 있다.

Content Studio 실제 사용 검증이 끝난 기능부터 Universe 중복 메뉴를 정리한다.

---

## A.7 배포/보안 패키징 주의

최종 첨부 ZIP 내부에는 두 프로젝트의 `.git` 디렉터리가 포함되어 있다.

실제 Git 작업 폴더에는 존재해도 되지만,
**외부 전달용/배포용 ZIP에는 `.git`을 포함하지 않는 원칙**을 유지한다.

이번 코드에는 실제 `.env` 파일은 포함되어 있지 않은 것으로 확인했다.

---

## A.8 최종 As-Is 한 줄 요약

### HOWTOM Universe

> **광고 데이터/동기화 기반은 실제 Backend 수준까지 올라와 있지만, 자동화 메뉴 상당수는 아직 Frontend 설정·Mock 수준이다.**

### HOWTOM Content Studio

> **이미 광고·블로그·영상대본·문서·템플릿·자산·레퍼런스·Worker·YouTube·Instagram·공용 AI Gateway까지 코드가 구현되어 있다. 다만 외부 Credential 검증, 블로그 AI 제휴 API 분리, Threads/TikTok Connector, 이미지 제작이 남아 있다.**

---

# 부록 B. 기능 상태를 갱신하는 방법

새 기능을 추가하거나 기존 기능을 수정한 뒤 PRD의 As-Is를 갱신할 때는 다음 순서로 확인한다.

1. 실제 Route가 있는가?
2. 실제 API Endpoint가 있는가?
3. PostgreSQL에 저장되는가?
4. Mock/localStorage만 쓰고 있지 않은가?
5. 외부 Credential이 없어도 상태를 정직하게 표시하는가?
6. Production Build가 통과하는가?
7. 실제 Railway에서 요청/DB/외부 API가 성공했는가?
8. 성공/실패/빈 상태가 모두 처리되는가?

1~5까지만 확인되었다면 보통 `🟢 구현됨` 또는 `🔗 연동 필요`다.

6~8과 실제 운영 흐름까지 통과해야 `✅ 검증 완료`로 올린다.
