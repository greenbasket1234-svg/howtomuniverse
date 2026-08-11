import type { AutomationJob } from './automationTypes';
import { nextOccurrences } from './scheduleEngine';

export type ScheduleConflict = { id:string; jobIds:string[]; title:string; detail:string };

export function findScheduleConflicts(jobs: AutomationJob[]) {
  const active=jobs.filter(j=>j.status==='active' && j.schedule && !j.readOnly);
  const conflicts: ScheduleConflict[]=[];
  for (let i=0;i<active.length;i++) for (let k=i+1;k<active.length;k++) {
    const a=active[i], b=active[k];
    if (!a.targetId || a.targetId!==b.targetId) continue;
    const meaningful = (a.jobType==='campaign_on' && b.jobType==='campaign_off') || (a.jobType==='campaign_off' && b.jobType==='campaign_on') || (a.jobType===b.jobType);
    if (!meaningful) continue;
    const aRuns=nextOccurrences(a.schedule,8).map(d=>d.getTime());
    const bRuns=nextOccurrences(b.schedule,8).map(d=>d.getTime());
    const same=aRuns.find(x=>bRuns.some(y=>Math.abs(x-y)<60_000));
    if (same) conflicts.push({id:`${a.jobId}:${b.jobId}`,jobIds:[a.jobId,b.jobId],title:'예약 충돌 발견',detail:`${a.name} / ${b.name} · 동일 대상에 같은 시각 규칙이 있습니다.`});
  }
  return conflicts;
}
