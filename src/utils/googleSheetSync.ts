// '환경설정 > 구글 시트 연동'과 '보고서 관리'가 함께 쓰는 구글 시트(Apps Script 웹훅) 연동 설정입니다.
// 실제 구글 인증은 다루지 않습니다 — 사용자가 자신의 구글 시트에 배포한 Apps Script 웹앱 URL로
// fetch(POST)를 보내는 방식이라, 토큰이나 키를 이 앱이 저장·관리할 필요가 없습니다.

export type GoogleSheetSettings = {
  webhookUrl: string;
  autoSendOnSave: boolean;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastSentAt?: string;
};

const STORAGE_KEY = 'adcc-google-sheet-settings-v1';

const DEFAULT_SETTINGS: GoogleSheetSettings = { webhookUrl: '', autoSendOnSave: false };

export function loadGoogleSheetSettings(): GoogleSheetSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? { ...DEFAULT_SETTINGS, ...parsed } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

export function saveGoogleSheetSettings(settings: GoogleSheetSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export type SheetRowPayload = {
  date: string; advertiser: string; platform: string;
  spend: number; impressions: number; clicks: number;
  db: number; contract: number; revenue: number; roas: number;
};

// Apps Script 웹앱으로 행 하나를 전송합니다. doPost가 한 번에 한 행씩 받는 구조라
// 여러 행을 보낼 때는 이 함수를 반복 호출합니다.
// 브라우저 fetch가 Apps Script 도메인에 CORS로 막히는 환경이 있어, 일반 요청이 실패하면
// no-cors로 한 번 더 시도합니다(이 경우 응답 내용은 읽을 수 없어 "전송 완료"까지만 확인됩니다).
export async function sendRowToGoogleSheet(webhookUrl: string, row: SheetRowPayload): Promise<{ ok: boolean; message: string }> {
  if (!webhookUrl.trim()) return { ok: false, message: 'Apps Script 웹앱 URL이 비어 있습니다.' };
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Apps Script는 application/json 프리플라이트를 못 받는 경우가 있어 text/plain으로 보냅니다.
      body: JSON.stringify(row),
    });
    const text = await res.text().catch(() => '');
    try {
      const parsed = JSON.parse(text);
      if (parsed.result === 'success') return { ok: true, message: '시트에 반영되었습니다.' };
      return { ok: false, message: parsed.message || '스크립트가 오류를 반환했습니다.' };
    } catch {
      return res.ok ? { ok: true, message: '전송했습니다. (응답 형식을 확인할 수 없어 시트를 직접 확인해 주세요)' } : { ok: false, message: `요청이 실패했습니다 (${res.status}).` };
    }
  } catch {
    // CORS 등으로 응답을 읽을 수 없는 경우, no-cors로 한 번 더 보내봅니다.
    try {
      await fetch(webhookUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(row) });
      return { ok: true, message: '전송은 완료됐지만 응답은 읽을 수 없습니다(브라우저 보안 정책). 시트에서 직접 확인해 주세요.' };
    } catch {
      return { ok: false, message: 'URL에 연결할 수 없습니다. 주소와 배포 상태(액세스 권한: 모든 사용자)를 확인해 주세요.' };
    }
  }
}
