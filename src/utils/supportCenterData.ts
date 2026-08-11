export type SupportDocStatus = 'draft' | 'organized' | 'in_progress' | 'resolved' | 'archived';

export const SUPPORT_STATUS_LABEL: Record<SupportDocStatus, string> = {
  draft: '작성 중',
  organized: '정리 완료',
  in_progress: '진행 중',
  resolved: '해결',
  archived: '보관',
};

export type SupportDocAttachment = {
  id: string;
  name: string;
  dataUrl: string; // base64 이미지
};

export type SupportDocVersion = {
  versionAt: string;
  title: string;
  body: string;
  editedBy: string;
};

export type SupportDoc = {
  id: string;
  categoryKey: string; // 예: 'setting-manual', 'faq', 'quote' 등 세부 카테고리 키
  title: string;
  body: string; // 리치 텍스트(HTML)
  status: SupportDocStatus;
  tags: string[];
  owner: string;
  advertiserName?: string; // 광고주와 연결되는 문서(커뮤니케이션 기록, 견적서 등)에 사용
  linkUrl?: string; // 네이버 웍스 등 외부 문서 링크
  attachments?: SupportDocAttachment[];
  history?: SupportDocVersion[]; // 저장할 때마다 직전 버전을 여기에 쌓습니다.
  // 견적서 전용 부가 필드(다른 문서 유형에서는 비워둡니다)
  quoteMeta?: {
    deliveredAt?: string;
    validUntil?: string;
    decision?: '검토중' | '수락' | '거절';
  };
  followUpAt?: string; // 후속 조치 예정일(인수인계, 이슈 등에 사용)
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = 'acc-support-docs-v1';

export function loadSupportDocs(): SupportDoc[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveSupportDocs(docs: SupportDoc[]): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(docs)); return true; } catch { return false; }
}

export function upsertSupportDoc(doc: SupportDoc): boolean {
  const list = loadSupportDocs();
  const exists = list.some(d => d.id === doc.id);
  const next = exists ? list.map(d => d.id === doc.id ? doc : d) : [...list, doc];
  return saveSupportDocs(next);
}

export function deleteSupportDoc(id: string): boolean {
  return saveSupportDocs(loadSupportDocs().filter(d => d.id !== id));
}

// 계정 보관함은 현재 프론트엔드 시험판에서는 "계정 메타데이터"만 보관합니다.
// 비밀번호/API Secret 같은 실제 자격증명은 localStorage에 저장하지 않습니다.
// 향후 인증·권한검사·서버 암호화 저장소가 준비되면 별도 API로 연결합니다.
export type CredentialEntry = {
  id: string;
  scope: 'company' | 'advertiser';
  serviceName: string;
  advertiserName?: string;
  accountId: string;
  /** @deprecated 프론트 저장 금지. 레거시 데이터 마이그레이션 호환용으로만 유지합니다. */
  secret?: string;
  memo: string;
  lastChangedAt: string;
  changeDueAt?: string;
  owner: string;
};

export type CredentialLogEntry = {
  id: string;
  credentialId: string;
  action: '열람' | '변경';
  actor: string;
  at: string;
};

const CRED_STORAGE_KEY = 'acc-support-credentials-v1';
const CRED_LOG_STORAGE_KEY = 'acc-support-credential-logs-v1';

function stripCredentialSecret(entry: CredentialEntry): CredentialEntry {
  const { secret: _secret, ...safe } = entry;
  return safe;
}

export function loadCredentials(): CredentialEntry[] {
  try {
    const raw = localStorage.getItem(CRED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const list = parsed.map((entry) => stripCredentialSecret(entry as CredentialEntry));
    // 예전 버전이 localStorage에 비밀번호를 저장했다면 읽는 즉시 제거한 안전한 형식으로 덮어씁니다.
    if (parsed.some((entry) => entry && typeof entry === 'object' && 'secret' in entry)) {
      localStorage.setItem(CRED_STORAGE_KEY, JSON.stringify(list));
    }
    return list;
  } catch { return []; }
}

export function saveCredentials(list: CredentialEntry[]): boolean {
  try {
    const safe = list.map(stripCredentialSecret);
    localStorage.setItem(CRED_STORAGE_KEY, JSON.stringify(safe));
    return true;
  } catch { return false; }
}

export function loadCredentialLogs(): CredentialLogEntry[] {
  try {
    const raw = localStorage.getItem(CRED_LOG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function appendCredentialLog(entry: CredentialLogEntry): boolean {
  const list = loadCredentialLogs();
  try {
    localStorage.setItem(CRED_LOG_STORAGE_KEY, JSON.stringify([entry, ...list].slice(0, 200)));
    return true;
  } catch { return false; }
}

