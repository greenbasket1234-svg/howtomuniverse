# HOWTOM 유니버스 — API 연동 체크리스트

이 문서는 지금까지 "메뉴는 다 만들고, API는 나중에"라는 원칙으로 미뤄둔 외부 연동을
한 번에 정리한 것입니다. 전부 **코드 작업이 아니라 Railway 환경변수 설정**만 하면 됩니다.
연동 안 해도 서비스는 정상 작동하고(해당 기능만 "미연동" 안내가 뜸), 하나씩 순서대로
연동하셔도 됩니다 — 서로 의존관계 없습니다.

각 항목은 "지금 연동 안 하면 어떻게 보이는지" → "연동하려면 뭘 해야 하는지" 순서로 적었습니다.

---

## 1. Meta 광고 라이브러리 / Instagram 검색 (경쟁사 분석)

**안 하면**: 경쟁사 분석에서 "매체에서 검색" 버튼을 눌러도 검색 결과가 안 나오고, 대신
"권한이 필요합니다" 같은 메시지가 뜹니다. 수동으로 URL 입력하는 건 그대로 됩니다.

**하려면**:
1. [Meta for Developers](https://developers.facebook.com/)에서 앱 생성 (Business 유형)
2. Business Manager에서 **System User Access Token** 발급 (Ads Library 읽기 권한 포함)
3. Railway 환경변수 추가:
   ```
   META_ACCESS_TOKEN=발급받은토큰
   META_API_VERSION=v21.0   (생략 가능, 기본값 이미 v21.0)
   ```

이 토큰은 **레퍼런스 수집**(`/content/references`)에서도 같이 쓰입니다 — 한 번만 설정하면
두 기능 모두 켜집니다.

---

## 2. Claude API (AI 추천 — 심층 분석)

**안 하면**: 인사이트 > AI 추천에서 규칙 기반 추천 목록(실제 데이터 기반, 정상 작동)은
그대로 보이고, "AI 심층 분석" 버튼만 "아직 연결되지 않았습니다" 안내가 뜹니다.

**하려면**:
1. [Anthropic Console](https://console.anthropic.com/)에서 API 키 발급
2. Railway 환경변수 추가:
   ```
   ANTHROPIC_API_KEY=발급받은키
   ANTHROPIC_MODEL=claude-sonnet-4-6   (생략 가능, 기본값 이미 이 모델)
   ```

---

## 3. 블로그 자동 생성 (블로그 제작 화면 + AI 자동화 > 블로그 자동 생성)

**안 하면**: 블로그 제작 화면에서 제목/본문 초안을 AI로 생성하는 버튼이 "미연동" 상태로
뜹니다. 자동화 규칙은 등록·예약해둘 수 있지만 실제 실행은 "보류"로 기록됩니다.

**하려면** (OpenAI 또는 Anthropic 중 하나 선택):
```
BLOG_AI_PROVIDER=anthropic
BLOG_AI_API_KEY=발급받은키
```
또는
```
BLOG_AI_PROVIDER=openai
BLOG_AI_API_KEY=발급받은키
BLOG_AI_MODEL=gpt-4o   (생략 가능)
```
자체 서버(사내 GPT 게이트웨이 등)를 쓰신다면:
```
BLOG_AI_PROVIDER=custom
BLOG_AI_API_URL=https://내부서버주소/generate
```

> `ANTHROPIC_API_KEY`를 2번 항목에서 이미 설정했다면, `BLOG_AI_PROVIDER=anthropic`에
> `BLOG_AI_API_KEY`로 **같은 값**을 넣으시면 됩니다(두 기능이 별도 키를 쓰도록 분리해뒀지만,
> 같은 키를 재사용해도 무방합니다).

---

## 4. 이미지 자동 생성 (콘텐츠 > 이미지 제작)

**안 하면**: 이미지 기획 입력은 그대로 저장되고, "AI 이미지 생성" 버튼만 "아직 연결되지
않았습니다" 안내가 뜹니다.

**하려면** (OpenAI DALL-E 3 기준):
```
IMAGE_AI_PROVIDER=openai
IMAGE_AI_API_KEY=발급받은키
IMAGE_AI_MODEL=dall-e-3   (생략 가능, 기본값)
```
자체 이미지 생성 서버가 있다면:
```
IMAGE_AI_PROVIDER=custom
IMAGE_AI_API_URL=https://내부서버주소/generate
```

---

## 5. 광고 문구 자동 생성 (AI 자동화 > 광고 문구 자동 생성)

**안 하면**: 템플릿/규칙 기반 생성(서버 연결 없이 항상 정상 작동)만 쓸 수 있고,
설정에서 OpenAI/Claude를 선택해도 "미연동" 안내가 뜨며 실행이 "보류"로 기록됩니다.

**하려면** (블로그와 동일한 방식):
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

> 2·3번에서 이미 `ANTHROPIC_API_KEY`를 발급받으셨다면, `AD_COPY_AI_PROVIDER=anthropic`에
> `AD_COPY_AI_API_KEY`로 같은 키를 재사용하시면 됩니다.

---

## 6. (참고용 — 이번 세션과 무관하게 이미 코드에 있던 항목)

아래 둘은 제가 이번에 만든 게 아니라 원래부터 코드에 있던 기능인데, 같이 체크리스트에
넣어드립니다.

### Notion으로 보고서 내보내기
```
NOTION_API_TOKEN=발급받은토큰
NOTION_PARENT_PAGE_ID=보고서를저장할상위페이지ID
```
[Notion Integrations](https://www.notion.so/my-integrations)에서 발급, 해당 페이지에
연동 앱을 초대해야 합니다.

### Google Sheets 웹훅 내보내기
```
GOOGLE_SHEETS_WEBHOOK_URL=Apps Script 웹앱URL
```
Google Sheets에서 Apps Script로 웹앱을 배포한 뒤 그 URL을 넣습니다.

---

## 6. 오토포스트 Pro (블로그 자동 생성 - ㈜시온랩스 제휴 API)

**안 하면**: AI 자동화 > 블로그 자동 생성 화면에 "아직 연결되지 않았습니다" 안내만 뜨고, 위쪽의 규칙 기반 자동화(BLOG_AI_PROVIDER)는 그것대로 별개로 계속 작동합니다.

**하려면**:
```
AUTOPOST_PRO_API_KEY=발급받은키
```
(BASE URL은 기본값 `https://aiblog.zionlabs.org`이 이미 맞게 설정되어 있어 생략 가능)

**추가로 필요한 것**: 실제로 이 기능을 쓰려는 광고주마다 광고주 정보 화면에서
- **사업자등록번호** 입력 (좌석 생성 기준)
- **업종**: 병원·의료기관/치과/한의원/동물병원/세무사·세무법인/학원·교육은 자동 인식됩니다. **식품·이사·렌트카 등 다른 업종은 제휴사(㈜시온랩스)에 업종 추가를 요청**하시고, 안내받은 코드를 광고주 정보의 "오토포스트 Pro 업종 코드"란에 직접 입력하시면 됩니다.

**주의**: 이건 실제로 돈이 오가는 연동입니다. 사업자번호당 평생 무료체험 3건 이후 유료 전환되고, 월 한도(의료·세무·수의 60건 / 학원 30건) 초과 시 건당 3,000원이 청구됩니다. 화면에서 한도 초과 시 반드시 직접 "동의하고 진행" 버튼을 눌러야만 청구되도록 만들어뒀습니다 - 자동으로 청구되는 경우는 없습니다.

---

## 적용 방법 (공통)

1. Railway 대시보드 → 해당 프로젝트 → **Variables** 탭
2. 위 표에서 필요한 항목만 골라서 추가 (전부 다 할 필요 없음, 필요한 기능만 골라서)
3. 저장하면 자동으로 재배포됩니다
4. 재배포 완료 후 해당 화면에서 "미연동" 배너가 사라지고 실제로 작동하는지 확인

키는 **절대 git 저장소에 커밋하지 마세요** — Railway Variables에만 넣으시면 됩니다.
