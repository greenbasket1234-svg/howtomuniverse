/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 콘텐츠 제작소(별도 배포 서비스)의 실제 주소 - 사이드바의 "콘텐츠 제작소 ↗" 링크에 씁니다. */
  readonly VITE_CONTENT_STUDIO_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

