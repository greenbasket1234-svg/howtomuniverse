export type NotificationTriggerType = 'performance_anomaly' | 'kpi_miss' | 'budget_pacing' | 'data_collection_failed' | 'automation_failed' | 'review_required' | 'manual';
export type NotificationRule = {
  ruleId: string;
  name: string;
  advertiserId?: string;
  advertiserName?: string;
  triggerType: NotificationTriggerType;
  threshold?: number;
  consecutiveCount?: number;
  recipient: 'advertiser_manager' | 'admin' | 'content_manager' | 'all';
  channels: ('internal' | 'naverworks' | 'email')[];
  dedupeHours: number;
  reminderHours?: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InternalNotification = {
  notificationId: string;
  ruleId?: string;
  advertiserId?: string;
  advertiserName?: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  dedupeKey?: string;
  read: boolean;
  createdAt: string;
};
