const KEY = 'howtom-prompt-library-v1';

export type PromptCategory = 'ad-copy' | 'blog' | 'video-script' | 'image' | 'analysis' | 'other';

export type SavedPrompt = {
  promptId: string;
  title: string;
  category: PromptCategory;
  body: string;
  tags: string[];
  advertiserId?: string;
  advertiserName?: string;
  isFavorite: boolean;
  useCount: number;
  createdAt: string;
  updatedAt: string;
};

function parse(): SavedPrompt[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function save(rows: SavedPrompt[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent('howtom:prompts-changed'));
}

export function loadPrompts(): SavedPrompt[] { return parse(); }

export function createPrompt(input: Omit<SavedPrompt, 'promptId' | 'useCount' | 'createdAt' | 'updatedAt'>): SavedPrompt {
  const stamp = new Date().toISOString();
  const row: SavedPrompt = { ...input, promptId: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, useCount: 0, createdAt: stamp, updatedAt: stamp };
  save([row, ...parse()]);
  return row;
}

export function patchPrompt(promptId: string, patch: Partial<SavedPrompt>) {
  const rows = parse();
  const current = rows.find(x => x.promptId === promptId);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  save(rows.map(x => x.promptId === promptId ? next : x));
  return next;
}

export function deletePrompt(promptId: string) {
  save(parse().filter(x => x.promptId !== promptId));
}

/** 프롬프트를 실제로 사용(복사)했을 때 사용 횟수를 늘립니다 - 어떤 프롬프트가 실제로
 * 자주 쓰이는지 파악해 상단에 노출하기 위함입니다. */
export function recordPromptUse(promptId: string) {
  const rows = parse();
  const current = rows.find(x => x.promptId === promptId);
  if (!current) return;
  save(rows.map(x => x.promptId === promptId ? { ...x, useCount: x.useCount + 1 } : x));
}
