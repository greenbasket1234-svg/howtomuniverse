import { apiFetch } from '../hooks/useApi';

export type AutomationRuleType = 'report' | 'ad-copy' | 'notification' | 'workflow' | 'campaign';
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

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 규칙의 예약 주기 설명(예: "매주 월 09:00")을 만듭니다. notification은 조건 감시형이라 별도 문구를 씁니다. */
export function ruleScheduleSummary(rule: AutomationRule): string {
  const c = rule.config || {};
  if (rule.type === 'notification') return '조건 발생 시 자동 감시(매시 정각 확인)';
  if (rule.type === 'report' || rule.type === 'workflow') return c.dayOfMonth ? `매월 ${c.dayOfMonth}일 ${c.time || ''}` : '수동 실행';
  if (c.cadence === 'manual' || !c.cadence) return '수동 실행';
  if (c.cadence === 'daily') return `매일 ${c.time}`;
  if (c.cadence === 'weekly') return `매주 ${WEEKDAY_LABELS[c.weekday ?? 1]} ${c.time}`;
  if (c.cadence === 'monthly') return `매월 ${c.dayOfMonth || 1}일 ${c.time}`;
  return '-';
}

/** 다음 예약 실행 시각을 계산합니다(한국 시간 기준). 수동/조건감시형은 null을 반환합니다. */
export function nextRunAt(rule: AutomationRule): Date | null {
  const c = rule.config || {};
  if (rule.type === 'notification' || rule.type === 'workflow') return null; // 조건 감시형·미구현은 "다음 실행"이 의미가 없습니다.
  if (rule.type !== 'report' && (c.cadence === 'manual' || !c.cadence)) return null;
  const time = c.time as string | undefined;
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(h, m, 0, 0);
  const cadence = rule.type === 'report' ? 'monthly' : c.cadence;
  if (cadence === 'daily') {
    if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }
  if (cadence === 'weekly') {
    const targetDay = c.weekday ?? 1;
    let diff = (targetDay - candidate.getDay() + 7) % 7;
    if (diff === 0 && candidate <= now) diff = 7;
    candidate.setDate(candidate.getDate() + diff);
    return candidate;
  }
  if (cadence === 'monthly' || rule.type === 'report') {
    const targetDay = c.dayOfMonth || 1;
    candidate.setDate(targetDay);
    if (candidate <= now) candidate.setMonth(candidate.getMonth() + 1, targetDay);
    return candidate;
  }
  return null;
}

