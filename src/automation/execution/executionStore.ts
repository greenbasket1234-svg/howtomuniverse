import { AUTOMATION_EVENT, AUTOMATION_RUNS_KEY } from '../automationStore';
import type { ExtendedAutomationRun } from './executionTypes';

function read(): ExtendedAutomationRun[] {
  try {
    const raw = localStorage.getItem(AUTOMATION_RUNS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row: any) => ({
      ...row,
      trigger: row.trigger ?? 'manual',
      startedAt: row.startedAt ?? row.createdAt ?? new Date().toISOString(),
      createdAt: row.createdAt ?? row.startedAt ?? new Date().toISOString(),
      error: row.error ?? (row.errorCode || row.errorMessage ? { code: row.errorCode ?? 'UNKNOWN', message: row.errorMessage ?? '실행 오류' } : undefined),
    })) as ExtendedAutomationRun[];
  } catch { return []; }
}

function emit() { try { window.dispatchEvent(new CustomEvent(AUTOMATION_EVENT)); } catch {} }

export function loadExecutionRuns(): ExtendedAutomationRun[] { return read(); }
export function saveExecutionRuns(rows: ExtendedAutomationRun[]) {
  localStorage.setItem(AUTOMATION_RUNS_KEY, JSON.stringify(rows.slice(0, 500)));
  emit();
}
export function addExecutionRun(run: ExtendedAutomationRun) {
  saveExecutionRuns([run, ...read()]);
  return run;
}

export function createRun(input: Omit<ExtendedAutomationRun, 'runId' | 'createdAt' | 'startedAt'> & { startedAt?: string }) {
  const startedAt = input.startedAt ?? new Date().toISOString();
  return addExecutionRun({ ...input, runId: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, startedAt, createdAt: startedAt });
}

export function finishRun(runId: string, patch: Partial<ExtendedAutomationRun>) {
  const rows = read();
  const current = rows.find(row => row.runId === runId);
  if (!current) return null;
  const finishedAt = patch.finishedAt ?? new Date().toISOString();
  const next: ExtendedAutomationRun = {
    ...current,
    ...patch,
    finishedAt,
    durationMs: patch.durationMs ?? Math.max(0, new Date(finishedAt).getTime() - new Date(current.startedAt).getTime()),
  };
  saveExecutionRuns(rows.map(row => row.runId === runId ? next : row));
  return next;
}

export function correlationId(prefix = 'WF') {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
