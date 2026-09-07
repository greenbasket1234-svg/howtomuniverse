# HOWTOM 유니버스 — API 연동 체크리스트

이 문서는 "메뉴는 다 만들고, API는 나중에"라는 원칙으로 미뤄둔 외부 연동을 정리한
것입니다. 전부 **코드 작업이 아니라 Railway 환경변수 설정**만 하면 됩니다.
연동 안 해도 서비스는 정상 작동하고(해당 기능만 "미연동" 안내가 뜸), 하나씩 순서대로
연동하셔도 됩니다 — 서로 의존관계 없습니다.

> **참고**: 블로그 AI 생성(오토포스트 Pro)은 이제 이 프로젝트가 아니라
> **콘텐츠 제작소(howtom-content-studio)** 쪽에서 연동합니다. 아래 목록에는
> 없습니다 — 콘텐츠 제작소의 `.env.example`을 확인하세요.

---

## 1. Meta 광고 라이브러리 / Instagram 검색 (경쟁사 분석)

**안 하면**: 경쟁사 분석에서 "매체에서 검색" 버튼을 눌러도 검색 결과가 안 나옵니다.

**하려면**:
```
META_ACCESS_TOKEN=발급받은토큰
META_API_VERSION=v21.0   (생략 가능, 기본값 이미 v21.0)
```
지금은 **조회 전용(ads_read)** 권한입니다. 캠페인 관리 화면의 **ON/OFF 토글**과
**소재 업로드**까지 쓰려면, Meta Business Manager에서 이 토큰을 **`ads_management`
권한이 포함된 새 토큰으로 재발급**해서 교체해야 합니다.

---

## 2. Claude API (AI 추천 — 심층 분석)

**안 하면**: 인사이트 > AI 추천에서 "AI 심층 분석" 버튼만 "아직 연결되지 않았습니다" 안내가 뜹니다.

**하려면**:
```
ANTHROPIC_API_KEY=발급받은키
ANTHROPIC_MODEL=claude-sonnet-4-6   (생략 가능)
```

---

## 3. 이미지 자동 생성 (콘텐츠 > 이미지 제작)

**안 하면**: 이미지 기획 입력은 그대로 저장되고, "AI 이미지 생성" 버튼만 "아직 연결되지 않았습니다" 안내가 뜹니다.

**하려면** (OpenAI DALL-E 3 기준):
```
IMAGE_AI_PROVIDER=openai
IMAGE_AI_API_KEY=발급받은키
IMAGE_AI_MODEL=dall-e-3   (생략 가능)
```
자체 이미지 생성 서버가 있다면:
```
IMAGE_AI_PROVIDER=custom
IMAGE_AI_API_URL=https://내부서버주소/generate
```

---

## 4. 광고 문구 자동 생성 (AI 자동화 > 광고 문구 자동 생성)

**안 하면**: 템플릿/규칙 기반 생성(항상 정상 작동)만 쓸 수 있고, AI 선택 시 "미연동" 안내가 뜹니다.

**하려면**:
```
AD_COPY_AI_PROVIDER=anthropic
AD_COPY_AI_API_KEY=발급받은키
```
또는
```
AD_COPY_AI_PROVIDER=openai
AD_COPY_AI_API_KEY=발급받은키
AD_COPY_AI_MODEL=gpt-4o-mini   (생략 가능)
```
> 2번에서 이미 `ANTHROPIC_API_KEY`를 넣으셨다면, 여기도 같은 키를 재사용하시면 됩니다.

---

## 5. (참고용 — 기존 코드에 원래 있던 기능)

### Notion으로 보고서 내보내기
```
NOTION_API_TOKEN=발급받은토큰
NOTION_PARENT_PAGE_ID=보고서를저장할상위페이지ID
```
[Notion Integrations](https://www.notion.so/my-integrations)에서 발급, 해당 페이지에 연동 앱을 초대해야 합니다.

### Google Sheets 웹훅 내보내기
```
GOOGLE_SHEETS_WEBHOOK_URL=Apps Script 웹앱URL
```

---

## 네이버 검색광고 API

이건 전역 환경변수가 아니라 **광고주마다** 광고주 정보 화면에서 직접 등록합니다
(customerId, API 키, Secret 키). 이미 연동해서 쓰고 계신 부분이라 이 문서에는 없습니다.

---

## 적용 방법 (공통)

1. Railway 대시보드 → **howtom-universe** 프로젝트 → **Variables** 탭
2. 필요한 항목만 골라서 추가
3. 저장하면 자동으로 재배포됩니다
4. 재배포 완료 후 해당 화면에서 "미연동" 배너가 사라지고 실제로 작동하는지 확인

키는 **절대 git 저장소에 커밋하지 마세요** — Railway Variables에만 넣으시면 됩니다.
