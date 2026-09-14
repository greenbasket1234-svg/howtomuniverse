import { apiFetch } from '../hooks/useApi';

export type AutomationRuleType = 'report' | 'ad-copy' | 'notification' | 'workflow';
export type AutomationRule = {
  id: string;
  tenant_id: string;
  type: AutomationRuleType;
  advertiser_id: string | null;
  name: string;
  config: Record<string, any>;
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};
export type AutomationRun = {
  id: string;
  tenant_id: string;
  rule_id: string | null;
  rule_type: string;
  rule_name: string | null;
  advertiser_id: string | null;
  trigger: 'scheduled' | 'manual';
  status: 'running' | 'success' | 'failed';
  result: Record<string, any> | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};
export type AutomationNotification = {
  id: string;
  rule_id: string | null;
  advertiser_id: string | null;
  title: string;
  message: string | null;
  recipient: string | null;
  channels: string[];
  read_at: string | null;
  created_at: string;
};

export const automationApi = {
  rules: {
    list: (type?: AutomationRuleType) => apiFetch<{ items: AutomationRule[] }>(`/automation/rules${type ? `?type=${type}` : ''}`).then(r => r.items),
    create: (input: { type: AutomationRuleType; advertiserId?: string; name: string; config: Record<string, any>; enabled?: boolean }) =>
      apiFetch<AutomationRule>('/automation/rules', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, patch: Partial<{ name: string; config: Record<string, any>; enabled: boolean }>) =>
      apiFetch<AutomationRule>(`/automation/rules/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id: string) => apiFetch<{ ok: true }>(`/automation/rules/${id}`, { method: 'DELETE' }),
    runNow: (id: string) => apiFetch<{ runId: string; status: string; result: any }>(`/automation/rules/${id}/run`, { method: 'POST' }),
  },
  runs: {
    list: (ruleId?: string) => apiFetch<{ items: AutomationRun[] }>(`/automation/runs${ruleId ? `?ruleId=${ruleId}` : ''}`).then(r => r.items),
  },
  notifications: {
    list: () => apiFetch<{ items: AutomationNotification[] }>('/automation/notifications').then(r => r.items),
    markRead: (id: string) => apiFetch<{ ok: true }>(`/automation/notifications/${id}/read`, { method: 'PATCH' }),
  },
};
