export type AutomationJobType =
  | 'campaign_on'
  | 'campaign_off'
  | 'campaign_schedule'
  | 'data_sync'
  | 'notification'
  | 'report_generation'
  | 'ai_analysis'
  | 'content_generation'
  | 'blog_generation';

export type AutomationJobStatus = 'active' | 'paused' | 'disabled';
export type AutomationImplementationStatus = 'available' | 'mock' | 'not_implemented';
export type AutomationSource = 'scheduler' | 'campaign' | 'data-collection' | 'rule';
export type AutomationRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'skipped';
export type AutomationScheduleType = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';

export type AutomationSchedule = {
  scheduleType: AutomationScheduleType;
  time: string;
  date?: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  startDate?: string;
  endDate?: string;
  exceptionDates?: string[];
  timezone: string;
};

export type AutomationJob = {
  jobId: string;
  name: string;
  jobType: AutomationJobType;
  advertiserId?: string;
  advertiserName?: string;
  targetType?: 'campaign' | 'advertiser' | 'account' | 'data-source' | 'other';
  targetId?: string;
  targetName?: string;
  platform?: string;
  schedule?: AutomationSchedule;
  scheduleText?: string;
  status: AutomationJobStatus;
  implementationStatus: AutomationImplementationStatus;
  source: AutomationSource;
  readOnly?: boolean;
  syncedCampaignRuleLabel?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRun = {
  runId: string;
  jobId: string;
  jobName: string;
  status: AutomationRunStatus;
  startedAt?: string;
  finishedAt?: string;
  recordsProcessed?: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
};

export type DataCollectionSource = 'google_sheets' | 'csv' | 'meta' | 'naver' | 'google' | 'kakao' | 'karrot';
export type DataCollectionCadence = 'manual' | 'daily' | 'hourly' | 'custom';

export type DataCollectionConfig = {
  configId: string;
  advertiserId: string;
  advertiserName: string;
  source: DataCollectionSource;
  dataTypes: ('ad' | 'db')[];
  cadence: DataCollectionCadence;
  time: string;
  intervalHours?: number;
  collectionRange: 'previous_day' | 'recent_3_days' | 'recent_7_days';
  recheckDays: number;
  enabled: boolean;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed';
  lastRowCount?: number;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
};
