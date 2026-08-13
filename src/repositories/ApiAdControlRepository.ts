import type { AdControlRepository } from './AdControlRepository';
import type { Campaign, FunnelRow, MetricView, ScheduleSlot, SeasonEvent } from '../types/operations';
import { apiFetch } from '../hooks/useApi';

// 별도의 정적 토큰(VITE_API_ACCESS_TOKEN) 대신, 앱 전체가 쓰는 로그인 JWT를 그대로 사용합니다.
// apiFetch가 이미 API_BASE('/api')와 Authorization 헤더를 자동으로 붙여줍니다.
export class ApiAdControlRepository implements AdControlRepository {
  getCampaigns(){return apiFetch<Campaign[]>('/campaigns')}
  saveCampaigns(rows:Campaign[]){return apiFetch<void>('/campaigns',{method:'PUT',body:JSON.stringify(rows)})}
  getFunnelRows(){return apiFetch<FunnelRow[]>('/funnels/channels')}
  getMetricViews(advertiserId:string){return apiFetch<MetricView[]>(`/advertisers/${advertiserId}/metric-views`)}
  saveMetricView(view:MetricView){return apiFetch<void>('/metric-views',{method:'POST',body:JSON.stringify(view)})}
  getScheduleSlots(){return apiFetch<ScheduleSlot[]>('/schedule-slots')}
  saveScheduleSlot(slot:ScheduleSlot){return apiFetch<void>(`/schedule-slots/${slot.id}`,{method:'PUT',body:JSON.stringify(slot)})}
  deleteScheduleSlot(slotId:string){return apiFetch<void>(`/schedule-slots/${slotId}`,{method:'DELETE'})}
  getSeasonEvents(){return apiFetch<SeasonEvent[]>('/season-events')}
}
