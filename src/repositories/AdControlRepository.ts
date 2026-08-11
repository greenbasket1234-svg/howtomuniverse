import type { Campaign, FunnelRow, MetricView, ScheduleSlot, SeasonEvent } from '../types/operations';

export interface AdControlRepository {
  getCampaigns(): Promise<Campaign[]>;
  saveCampaigns(rows: Campaign[]): Promise<void>;
  getFunnelRows(): Promise<FunnelRow[]>;
  getMetricViews(advertiserId: string): Promise<MetricView[]>;
  saveMetricView(view: MetricView): Promise<void>;
  getScheduleSlots(): Promise<ScheduleSlot[]>;
  saveScheduleSlot(slot: ScheduleSlot): Promise<void>;
  deleteScheduleSlot(slotId: string): Promise<void>;
  getSeasonEvents(): Promise<SeasonEvent[]>;
}
