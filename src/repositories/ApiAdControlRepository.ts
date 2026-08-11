import type { AdControlRepository } from './AdControlRepository';
import type { Campaign, FunnelRow, MetricView, ScheduleSlot, SeasonEvent } from '../types/operations';
export class ApiAdControlRepository implements AdControlRepository {
  constructor(private baseUrl:string, private token?:string){}
  private async request<T>(path:string, init?:RequestInit):Promise<T>{
    const res=await fetch(`${this.baseUrl}${path}`,{...init,headers:{'Content-Type':'application/json',...(this.token?{Authorization:`Bearer ${this.token}`}:{}) ,...(init?.headers||{})}});
    if(!res.ok) throw new Error(`API ${res.status}: ${path}`); return res.json() as Promise<T>;
  }
  getCampaigns(){return this.request<Campaign[]>('/campaigns')}
  saveCampaigns(rows:Campaign[]){return this.request<void>('/campaigns',{method:'PUT',body:JSON.stringify(rows)})}
  getFunnelRows(){return this.request<FunnelRow[]>('/funnels/channels')}
  getMetricViews(advertiserId:string){return this.request<MetricView[]>(`/advertisers/${advertiserId}/metric-views`)}
  saveMetricView(view:MetricView){return this.request<void>('/metric-views',{method:'POST',body:JSON.stringify(view)})}
  getScheduleSlots(){return this.request<ScheduleSlot[]>('/schedule-slots')}
  saveScheduleSlot(slot:ScheduleSlot){return this.request<void>(`/schedule-slots/${slot.id}`,{method:'PUT',body:JSON.stringify(slot)})}
  deleteScheduleSlot(slotId:string){return this.request<void>(`/schedule-slots/${slotId}`,{method:'DELETE'})}
  getSeasonEvents(){return this.request<SeasonEvent[]>('/season-events')}
}
