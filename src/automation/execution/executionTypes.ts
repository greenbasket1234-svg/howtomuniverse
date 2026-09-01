export type ExtendedRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'blocked' | 'skipped';
export type ExecutionTrigger = 'manual' | 'schedule' | 'workflow' | 'event';

export type AutomationRunStep = {
  stepId: string;
  name: string;
  status: ExtendedRunStatus;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
};

export type AutomationErrorInfo = {
  code: string;
  message: string;
};

export type ExtendedAutomationRun = {
  runId: string;
  jobId?: string;
  jobName: string;
  workflowId?: string;
  correlationId?: string;
  advertiserId?: string;
  advertiserName?: string;
  type?: 'data' | 'campaign' | 'report' | 'ad-copy' | 'blog' | 'notification' | 'workflow' | 'other';
  trigger: ExecutionTrigger;
  status: ExtendedRunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  recordsProcessed?: number;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  steps?: AutomationRunStep[];
  error?: AutomationErrorInfo;
  createdAt: string;
};
