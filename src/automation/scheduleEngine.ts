import type { AutomationSchedule } from './automationTypes';

const WEEKDAY_KR = ['일','월','화','수','목','금','토'];

function ymd(date: Date) {
  const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function atTime(date: Date, time: string) {
  const [h,m]=time.split(':').map(Number);
  const next=new Date(date); next.setHours(h||0,m||0,0,0); return next;
}
function inBounds(date: Date, schedule: AutomationSchedule) {
  const key=ymd(date);
  if (schedule.startDate && key < schedule.startDate) return false;
  if (schedule.endDate && key > schedule.endDate) return false;
  if (schedule.exceptionDates?.includes(key)) return false;
  return true;
}

export function scheduleSummary(schedule?: AutomationSchedule) {
  if (!schedule) return '수동';
  const time=schedule.time || '00:00';
  if (schedule.scheduleType==='once') return `${schedule.date || schedule.startDate || '-'} ${time}`;
  if (schedule.scheduleType==='daily') return `매일 ${time}`;
  if (schedule.scheduleType==='weekly') {
    const days=(schedule.daysOfWeek?.length ? schedule.daysOfWeek : [1,2,3,4,5]).map(d=>WEEKDAY_KR[d]).join('·');
    return `매주 ${days} ${time}`;
  }
  if (schedule.scheduleType==='monthly') return `매월 ${schedule.dayOfMonth || 1}일 ${time}`;
  return `사용자 지정 ${time}`;
}

export function nextOccurrences(schedule: AutomationSchedule | undefined, count=5, from=new Date()) {
  if (!schedule || count<=0) return [] as Date[];
  const result: Date[]=[];
  const start=new Date(from);
  if (schedule.scheduleType==='once') {
    const dateText=schedule.date || schedule.startDate;
    if (!dateText) return result;
    const candidate=atTime(new Date(`${dateText}T00:00:00`), schedule.time);
    if (candidate > from && inBounds(candidate,schedule)) result.push(candidate);
    return result;
  }
  for (let i=0; i<370 && result.length<count; i++) {
    const day=new Date(start); day.setDate(start.getDate()+i); day.setHours(0,0,0,0);
    if (!inBounds(day,schedule)) continue;
    let matches=false;
    if (schedule.scheduleType==='daily' || schedule.scheduleType==='custom') matches=true;
    if (schedule.scheduleType==='weekly') matches=(schedule.daysOfWeek?.length ? schedule.daysOfWeek : [1,2,3,4,5]).includes(day.getDay());
    if (schedule.scheduleType==='monthly') matches=day.getDate()===(schedule.dayOfMonth || 1);
    if (!matches) continue;
    const candidate=atTime(day,schedule.time);
    if (candidate > from) result.push(candidate);
  }
  return result;
}

export function nextRunIso(schedule?: AutomationSchedule) {
  return nextOccurrences(schedule,1)[0]?.toISOString();
}

export function formatKoreanDateTime(value?: string | Date) {
  if (!value) return '-';
  const date=value instanceof Date ? value : new Date(value);
  if (Number.isNaN(+date)) return '-';
  return `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}
