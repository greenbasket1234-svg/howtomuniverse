import { createRun, finishRun } from '../execution/executionStore';
import { removeAutomationJob, upsertAutomationJob } from '../automationStore';
import type { InternalNotification, NotificationRule } from './notificationTypes';

const RULE_KEY = 'howtom-notification-rules-v1';
const NOTICE_KEY = 'howtom-internal-notifications-v1';
function read<T>(key: string): T[] { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
function emit() { try { window.dispatchEvent(new CustomEvent('howtom-automation-updated')); } catch {} }
export function loadNotificationRules() { return read<NotificationRule>(RULE_KEY); }
export function saveNotificationRules(rows: NotificationRule[]) { localStorage.setItem(RULE_KEY, JSON.stringify(rows)); emit(); }
export function upsertNotificationRule(row: NotificationRule) {
  const rows = loadNotificationRules(); const next = { ...row, updatedAt: new Date().toISOString() }; saveNotificationRules(rows.some(x => x.ruleId === row.ruleId) ? rows.map(x => x.ruleId === row.ruleId ? next : x) : [next, ...rows]);
  upsertAutomationJob({jobId:`notification-rule-${next.ruleId}`,name:next.name,jobType:'notification',advertiserId:next.advertiserId,advertiserName:next.advertiserName,targetType:'advertiser',targetId:next.advertiserId,targetName:next.advertiserName,scheduleText:`${next.triggerType} 조건 평가`,status:next.enabled?'active':'paused',implementationStatus:'available',source:'rule',createdAt:next.createdAt,updatedAt:next.updatedAt});
  return next;
}
export function deleteNotificationRule(ruleId: string) { saveNotificationRules(loadNotificationRules().filter(x => x.ruleId !== ruleId)); removeAutomationJob(`notification-rule-${ruleId}`); }
export function loadInternalNotifications() { return read<InternalNotification>(NOTICE_KEY); }
function saveNotices(rows: InternalNotification[]) { localStorage.setItem(NOTICE_KEY, JSON.stringify(rows.slice(0, 300))); emit(); }
export function markNotificationRead(notificationId: string, read = true) { saveNotices(loadInternalNotifications().map(x => x.notificationId === notificationId ? { ...x, read } : x)); }

export function sendInternalNotification(input: Omit<InternalNotification, 'notificationId' | 'read' | 'createdAt'>, dedupeHours = 24) {
  const rows = loadInternalNotifications(); const now = Date.now();
  if (input.dedupeKey && rows.some(x => x.dedupeKey === input.dedupeKey && now - new Date(x.createdAt).getTime() < dedupeHours * 3600000)) return null;
  const row: InternalNotification = { ...input, notificationId: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, read: false, createdAt: new Date().toISOString() };
  saveNotices([row, ...rows]); return row;
}

export function testNotificationRule(rule: NotificationRule) {
  const run = createRun({ jobId: `notification-rule-${rule.ruleId}`, jobName: `${rule.name} 테스트`, advertiserId: rule.advertiserId, advertiserName: rule.advertiserName, type: 'notification', trigger: 'manual', status: 'running' });
  if (!rule.channels.includes('internal')) return finishRun(run.runId, { status: 'blocked', error: { code: 'NOTIFICATION_CHANNEL_NOT_CONNECTED', message: '네이버웍스/이메일 채널은 서버 연동 후 사용할 수 있습니다. 현재 내부 알림을 선택해 테스트하세요.' } });
  const notice = sendInternalNotification({ ruleId: rule.ruleId, advertiserId: rule.advertiserId, advertiserName: rule.advertiserName, title: `[테스트] ${rule.name}`, message: `알림 규칙이 정상적으로 내부 알림을 생성했습니다. 트리거: ${rule.triggerType}`, severity: 'info', dedupeKey: `test:${rule.ruleId}:${new Date().toISOString().slice(0,13)}` }, 1);
  return finishRun(run.runId, { status: 'success', outputSummary: { notificationId: notice?.notificationId ?? 'deduped' } });
}
