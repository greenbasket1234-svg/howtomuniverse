import { loadReportAutomationConfigs, generateReportsNow } from '../report/reportAutomation';
import { loadAdCopyAutomationConfigs, generateAdCopyNow } from '../adCopy/adCopyAutomation';
import { sendInternalNotification } from '../notifications/notificationEngine';
import { correlationId, createRun, finishRun } from '../execution/executionStore';
import type { AutomationRunStep } from '../execution/executionTypes';
import type { AutomationWorkflow, WorkflowStep } from './workflowTypes';

const KEY = 'howtom-automation-workflows-v1';
function read(): AutomationWorkflow[] { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
function emit() { try { window.dispatchEvent(new CustomEvent('howtom-automation-updated')); } catch {} }
export function loadWorkflows() { return read(); }
export function saveWorkflows(rows: AutomationWorkflow[]) { localStorage.setItem(KEY, JSON.stringify(rows)); emit(); }
export function upsertWorkflow(row: AutomationWorkflow) { const rows = read(); const next = { ...row, updatedAt: new Date().toISOString() }; saveWorkflows(rows.some(x => x.workflowId === row.workflowId) ? rows.map(x => x.workflowId === row.workflowId ? next : x) : [next, ...rows]); return next; }
export function deleteWorkflow(workflowId: string) { saveWorkflows(read().filter(x => x.workflowId !== workflowId)); }

export function validateWorkflow(workflow: AutomationWorkflow) {
  const errors: string[] = [];
  if (!workflow.name.trim()) errors.push('작업 흐름 이름이 필요합니다.');
  if (!workflow.steps.length) errors.push('최소 1개 단계가 필요합니다.');
  const approvalIndex = workflow.steps.findIndex(x => x.type === 'approval');
  if (approvalIndex >= 0 && approvalIndex !== workflow.steps.length - 1) errors.push('현재 프론트 단계에서는 승인 단계 이후 자동 실행을 이어가지 않습니다. 승인 단계는 마지막에 두세요.');
  return errors;
}

// (블로그 생성 단계는 실제 서버 AI API를 호출하는 비동기 작업이라, 워크플로 실행 전체를
// async로 전환했습니다. 다른 단계(보고서·문구 생성 등)는 기존처럼 동기 함수를 그대로 감싸
// await 하므로 동작은 동일합니다.)
export async function runWorkflowNow(workflow: AutomationWorkflow) {
  const errors = validateWorkflow(workflow);
  const corr = correlationId('WF');
  const run = createRun({ workflowId: workflow.workflowId, correlationId: corr, jobName: workflow.name, advertiserId: workflow.advertiserId, advertiserName: workflow.advertiserName, type: 'workflow', trigger: 'manual', status: errors.length ? 'blocked' : 'running', inputSummary: { steps: workflow.steps.length } });
  if (errors.length) return finishRun(run.runId, { status: 'blocked', error: { code: 'WORKFLOW_INVALID', message: errors.join(' ') } });
  const steps: AutomationRunStep[] = [];
  for (const step of workflow.steps) {
    const result = await executeStep(step, workflow);
    steps.push({ stepId: step.stepId, name: step.name, status: result.status, message: result.message, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() });
    if (result.status === 'failed') return finishRun(run.runId, { status: 'failed', steps, error: { code: 'WORKFLOW_STEP_FAILED', message: result.message || `${step.name} 실행 실패` } });
    if (result.status === 'blocked') return finishRun(run.runId, { status: 'blocked', steps, outputSummary: { awaitingApproval: step.type === 'approval' } });
  }
  return finishRun(run.runId, { status: 'success', steps, outputSummary: { completedSteps: steps.length } });
}

async function executeStep(step: WorkflowStep, workflow: AutomationWorkflow): Promise<{ status: 'success' | 'failed' | 'blocked'; message?: string }> {
  if (step.type === 'approval') return { status: 'blocked', message: '담당자 승인 대기 상태로 전환했습니다. 현재 프론트 단계에서는 승인 이후 자동 실행을 이어가지 않습니다.' };
  if (step.type === 'wait') return { status: 'success', message: '대기 단계는 프론트 시뮬레이션에서 즉시 통과합니다.' };
  if (step.type === 'data_sync') return { status: 'success', message: '실제 서버 자동 수집은 미연동입니다. 현재는 데이터 동기화 단계 존재 여부만 확인했습니다.' };
  if (step.type === 'data_validation') return { status: 'success', message: '현재 저장된 데이터 기준 검증 단계입니다.' };
  if (step.type === 'report_generation') {
    const configId = String(step.config.configId || ''); const config = loadReportAutomationConfigs().find(x => x.configId === configId);
    if (!config) return { status: 'failed', message: '연결된 보고서 자동화 설정을 찾을 수 없습니다.' };
    const result = generateReportsNow(config); return { status: result?.status === 'success' ? 'success' : result?.status === 'blocked' ? 'blocked' : 'failed', message: result?.error?.message };
  }
  if (step.type === 'ad_copy_generation') {
    const configId = String(step.config.configId || ''); const config = loadAdCopyAutomationConfigs().find(x => x.configId === configId);
    if (!config) return { status: 'failed', message: '연결된 광고 문구 자동화 설정을 찾을 수 없습니다.' };
    const result = await generateAdCopyNow(config); return { status: result?.status === 'success' ? 'success' : result?.status === 'blocked' ? 'blocked' : 'failed', message: result?.error?.message };
  }
  if (step.type === 'notification') {
    const notice = sendInternalNotification({ advertiserId: workflow.advertiserId, advertiserName: workflow.advertiserName, title: `${workflow.name} 실행 알림`, message: `${step.name} 단계가 실행되었습니다.`, severity: 'info', dedupeKey: `${workflow.workflowId}:${step.stepId}:${new Date().toISOString().slice(0,10)}` }, 24);
    return { status: 'success', message: notice ? '내부 알림 생성 완료' : '중복 알림으로 생략' };
  }
  return { status: 'failed', message: '지원하지 않는 단계입니다.' };
}
