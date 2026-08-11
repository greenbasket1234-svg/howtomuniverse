import type { NextMonthProposalData } from './nextMonthProposal';

// 다음달 제안서를 "저장"하면 그 시점의 데이터(KPI·매체별 제안·차트·인사이트 문구)를
// 그대로 스냅샷으로 담아둡니다. 월간 보고서 저장소(monthlyReportStore.ts)와 같은 원칙입니다 —
// 실제 제안서와 테스트 샘플은 서로 다른 localStorage 키에 저장해서 섞이지 않게 합니다.
export type SavedProposal = {
  id: string;
  advertiserName: string;
  sourceMonth: string;
  targetMonth: string;
  label: string;
  data: NextMonthProposalData;
  proposals: string[];
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
};

export const PROPOSAL_STORAGE_KEY = 'adcc-next-month-proposals-v1';
export const SAMPLE_PROPOSAL_STORAGE_KEY = 'adcc-sample-next-month-proposals-v1';

function read(key: string): SavedProposal[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persist(key: string, list: SavedProposal[]): boolean {
  try { localStorage.setItem(key, JSON.stringify(list)); return true; } catch { return false; }
}

export function loadSavedProposals(): SavedProposal[] {
  return [...read(PROPOSAL_STORAGE_KEY), ...read(SAMPLE_PROPOSAL_STORAGE_KEY)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveProposal(
  id: string | null,
  advertiserName: string,
  sourceMonth: string,
  targetMonth: string,
  data: NextMonthProposalData,
  proposals: string[],
  isSample: boolean,
  label?: string,
): SavedProposal | null {
  const key = isSample ? SAMPLE_PROPOSAL_STORAGE_KEY : PROPOSAL_STORAGE_KEY;
  const list = read(key);
  const now = new Date().toISOString();
  if (id) {
    const existing = list.find(item => item.id === id);
    if (existing) {
      const updated: SavedProposal = { ...existing, data, proposals, updatedAt: now, label: label ?? existing.label };
      const ok = persist(key, list.map(item => item.id === id ? updated : item));
      return ok ? updated : null;
    }
  }
  const created: SavedProposal = {
    id: `${isSample ? 'sample-' : ''}proposal-${Date.now()}`,
    advertiserName,
    sourceMonth,
    targetMonth,
    label: label ?? `${advertiserName} ${targetMonth} 다음달 제안서`,
    data,
    proposals,
    createdAt: now,
    updatedAt: now,
    isSample,
  };
  const ok = persist(key, [created, ...list]);
  return ok ? created : null;
}

export function deleteProposal(id: string): boolean {
  const isSample = id.startsWith('sample-');
  const key = isSample ? SAMPLE_PROPOSAL_STORAGE_KEY : PROPOSAL_STORAGE_KEY;
  const list = read(key);
  return persist(key, list.filter(item => item.id !== id));
}

export function deleteSampleProposals(): boolean {
  return persist(SAMPLE_PROPOSAL_STORAGE_KEY, []);
}
