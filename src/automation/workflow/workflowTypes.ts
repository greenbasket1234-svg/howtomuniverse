export type WorkflowStepType = 'data_sync' | 'data_validation' | 'report_generation' | 'ad_copy_generation' | 'notification' | 'approval' | 'wait';
export type WorkflowStep = {
  stepId: string;
  type: WorkflowStepType;
  name: string;
  config: Record<string, unknown>;
};
export type AutomationWorkflow = {
  workflowId: string;
  name: string;
  advertiserId?: string;
  advertiserName?: string;
  description?: string;
  triggerType: 'manual' | 'schedule' | 'event';
  scheduleText?: string;
  steps: WorkflowStep[];
  status: 'active' | 'paused' | 'draft';
  createdAt: string;
  updatedAt: string;
};
