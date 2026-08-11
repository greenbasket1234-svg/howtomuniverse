import { loadProfiles } from '../../features/reports/reportCore';
import { buildMonthlyReportData, generateMonthlyInsights } from '../../utils/monthlyReportData';
import { buildNextMonthProposal } from '../../utils/nextMonthProposal';
import { loadActualMonthlyReports, saveMonthlyReport } from '../../utils/monthlyReportStore';
import { loadSavedProposals, saveProposal } from '../../utils/nextMonthProposalStore';
import { loadBrandSettings } from '../../utils/reportBrandSettings';
import { createRun, finishRun } from '../execution/executionStore';
import { removeAutomationJob, upsertAutomationJob } from '../automationStore';

export type ReportAutomationType = 'monthly' | 'proposal';
export type ReportAutomationConfig = {
  configId: string;
  advertiserId: string;
  advertiserName: string;
  types: ReportAutomationType[];
  dayOfMonth: number;
  time: string;
  sourcePeriod: 'previous_month';
  requireActualData: boolean;
  draftOnly: boolean;
  notifyOnFailure: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReportReadiness = {
  ready: boolean;
  month: string;
  reasons: string[];
  origin: string;
  isSample: boolean;
  periodLabel?: string;
};

const KEY = 'howtom-report-automation-configs-v1';

function read(): ReportAutomationConfig[] {
  try { const parsed = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
function emit() { try { window.dispatchEvent(new CustomEvent('howtom-automation-updated')); } catch {} }
export function loadReportAutomationConfigs() { return read(); }
export function saveReportAutomationConfigs(rows: ReportAutomationConfig[]) { localStorage.setItem(KEY, JSON.stringify(rows)); emit(); }
export function upsertReportAutomationConfig(row: ReportAutomationConfig) {
  const rows = read(); const next = { ...row, updatedAt: new Date().toISOString() };
  saveReportAutomationConfigs(rows.some(x => x.configId === row.configId) ? rows.map(x => x.configId === row.configId ? next : x) : [next, ...rows]);
  upsertAutomationJob({
    jobId: `report-config-${next.configId}`, name: `${next.advertiserName} 보고서 자동 생성`, jobType: 'report_generation', advertiserId: next.advertiserId, advertiserName: next.advertiserName,
    targetType: 'advertiser', targetId: next.advertiserId, targetName: next.advertiserName, status: next.enabled ? 'active' : 'paused', implementationStatus: 'mock', source: 'scheduler', readOnly: true,
    schedule: { scheduleType: 'monthly', time: next.time, dayOfMonth: next.dayOfMonth, timezone: 'Asia/Seoul' }, createdAt: next.createdAt, updatedAt: next.updatedAt,
  });
  return next;
}
export function deleteReportAutomationConfig(configId: string) { saveReportAutomationConfigs(read().filter(x => x.configId !== configId)); removeAutomationJob(`report-config-${configId}`); }

export function previousMonthKey(base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function targetMonthKey(sourceMonth: string) {
  const [y, m] = sourceMonth.split('-').map(Number); const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function nextReportRun(config: ReportAutomationConfig, now = new Date()) {
  const candidate = new Date(now.getFullYear(), now.getMonth(), Math.min(28, Math.max(1, config.dayOfMonth)), 0, 0, 0, 0);
  const [h, m] = config.time.split(':').map(Number); candidate.setHours(h || 0, m || 0, 0, 0);
  if (candidate <= now) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}

export function checkReportReadiness(advertiserName: string, month = previousMonthKey(), requireActual = true): ReportReadiness {
  const data = buildMonthlyReportData(advertiserName, month, loadProfiles());
  const reasons: string[] = [];
  const actual = data.currentOrigin === 'saved-monthly' || data.currentOrigin === 'saved-other';
  if (requireActual && !actual) reasons.push('저장된 실제 광고 데이터가 없습니다.');
  if (data.isSample) reasons.push('테스트 샘플 데이터는 자동 보고서 생성에 사용하지 않습니다.');
  if (!data.rows?.length) reasons.push('보고서에 사용할 행 데이터가 없습니다.');
  if (data.current.spend <= 0 && data.current.clicks <= 0 && data.current.leads <= 0 && data.current.revenue <= 0) reasons.push('핵심 성과 지표가 모두 0입니다.');
  return { ready: reasons.length === 0, month, reasons, origin: data.currentOrigin, isSample: Boolean(data.isSample), periodLabel: data.periodLabel };
}

export function generateReportsNow(config: ReportAutomationConfig, month = previousMonthKey()) {
  const run = createRun({
    jobId: `report-config-${config.configId}`,
    jobName: `${config.advertiserName} 보고서 자동 생성`,
    advertiserId: config.advertiserId,
    advertiserName: config.advertiserName,
    type: 'report', trigger: 'manual', status: 'running',
    inputSummary: { month, types: config.types },
  });
  try {
    if (!config.types.length) return finishRun(run.runId, { status: 'blocked', error: { code: 'REPORT_TYPE_REQUIRED', message: '월간 보고서 또는 다음달 제안서 중 하나 이상을 선택하세요.' } });
    const readiness = checkReportReadiness(config.advertiserName, month, config.requireActualData);
    if (!readiness.ready) {
      return finishRun(run.runId, { status: 'blocked', outputSummary: { readiness }, error: { code: 'REPORT_DATA_NOT_READY', message: readiness.reasons.join(' ') } });
    }
    const profiles = loadProfiles();
    const monthlyData = buildMonthlyReportData(config.advertiserName, month, profiles);
    const outputs: Record<string, string> = {};
    if (config.types.includes('monthly')) {
      const existing = loadActualMonthlyReports().find(x => x.advertiserName === config.advertiserName && x.month === month);
      const saved = saveMonthlyReport(existing?.id ?? null, config.advertiserName, month, monthlyData, generateMonthlyInsights(monthlyData), loadBrandSettings(config.advertiserName), `${config.advertiserName} ${month} 월간 보고서 · 자동화 초안`);
      if (saved) outputs.monthlyReportId = saved.id;
    }
    if (config.types.includes('proposal')) {
      const proposalData = buildNextMonthProposal(monthlyData);
      const existing = loadSavedProposals().find(x => !x.isSample && x.advertiserName === config.advertiserName && x.sourceMonth === month);
      const saved = saveProposal(existing?.id ?? null, config.advertiserName, month, proposalData.targetMonth, proposalData, proposalData.proposals, false, `${config.advertiserName} ${proposalData.targetMonth} 다음달 제안서 · 자동화 초안`);
      if (saved) outputs.proposalId = saved.id;
    }
    return finishRun(run.runId, { status: 'success', outputSummary: outputs, steps: [
      { stepId: 'readiness', name: '데이터 준비 상태 확인', status: 'success' },
      { stepId: 'generate', name: '기존 보고서 생성 엔진 호출', status: 'success' },
      { stepId: 'store', name: '기존 보고서 저장소에 초안 저장', status: 'success' },
    ] });
  } catch (error) {
    return finishRun(run.runId, { status: 'failed', error: { code: 'REPORT_GENERATION_FAILED', message: error instanceof Error ? error.message : '보고서 생성 중 오류가 발생했습니다.' } });
  }
}
