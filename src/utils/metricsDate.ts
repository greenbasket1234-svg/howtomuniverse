import type { DateRange } from '../components/DateRangePicker';

export type MetricsPresetKey = 'today'|'yesterday'|'7d'|'14d'|'30d'|'60d'|'90d'|'last_month'|'this_month'|'custom';

export const METRICS_PRESETS: { key: MetricsPresetKey; label: string }[] = [
  { key:'today', label:'오늘' }, { key:'yesterday', label:'어제' }, { key:'7d', label:'최근 7일' },
  { key:'14d', label:'최근 14일' }, { key:'30d', label:'최근 30일' }, { key:'60d', label:'최근 60일' },
  { key:'90d', label:'최근 90일' }, { key:'last_month', label:'지난달' }, { key:'this_month', label:'이번달' },
  { key:'custom', label:'기간 직접 선택' },
];

export function toIso(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function addDays(d:Date,n:number){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
export function presetRange(key:MetricsPresetKey, today=new Date()):DateRange{
  if(key==='today') return {from:toIso(today),to:toIso(today)};
  if(key==='yesterday'){const y=addDays(today,-1);return{from:toIso(y),to:toIso(y)}}
  if(key.endsWith('d')){const n=Number(key.slice(0,-1));return{from:toIso(addDays(today,-n+1)),to:toIso(today)}}
  if(key==='last_month'){const first=new Date(today.getFullYear(),today.getMonth()-1,1);const last=new Date(today.getFullYear(),today.getMonth(),0);return{from:toIso(first),to:toIso(last)}}
  if(key==='this_month')return{from:toIso(new Date(today.getFullYear(),today.getMonth(),1)),to:toIso(today)};
  return{from:toIso(addDays(today,-29)),to:toIso(today)};
}
