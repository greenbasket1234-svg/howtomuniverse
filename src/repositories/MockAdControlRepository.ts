import type { AdControlRepository } from './AdControlRepository';
import { METRIC_VIEWS, EMPTY_DEV_CAMPAIGNS, MOCK_FUNNEL_ROWS, MOCK_SEASON_EVENTS, MOCK_SLOTS } from '../data/operationsMock';
import type { Campaign, MetricView, ScheduleSlot } from '../types/operations';

const clone = <T,>(value:T):T => JSON.parse(JSON.stringify(value));
export class MockAdControlRepository implements AdControlRepository {
  private campaigns=clone(EMPTY_DEV_CAMPAIGNS); private slots=clone(MOCK_SLOTS); private views=clone(METRIC_VIEWS);
  async getCampaigns(){return clone(this.campaigns)}
  async saveCampaigns(rows:Campaign[]){this.campaigns=clone(rows)}
  async getFunnelRows(){return clone(MOCK_FUNNEL_ROWS)}
  async getMetricViews(advertiserId:string){return clone(this.views.filter(v=>v.advertiserId===advertiserId||v.advertiserId==='all'))}
  async saveMetricView(view:MetricView){this.views=[...this.views.filter(v=>v.id!==view.id),clone(view)]}
  async getScheduleSlots(){return clone(this.slots)}
  async saveScheduleSlot(slot:ScheduleSlot){this.slots=[...this.slots.filter(v=>v.id!==slot.id),clone(slot)]}
  async deleteScheduleSlot(slotId:string){this.slots=this.slots.filter(v=>v.id!==slotId)}
  async getSeasonEvents(){return clone(MOCK_SEASON_EVENTS)}
}
