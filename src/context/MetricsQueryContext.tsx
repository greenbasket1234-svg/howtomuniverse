import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DateRange } from '../components/DateRangePicker';
import { METRICS_PRESETS, presetRange, type MetricsPresetKey } from '../utils/metricsDate';

const KEY='howtom-metrics-range-v2';
type Stored={range:DateRange;preset:MetricsPresetKey};
function same(a:DateRange,b:DateRange){return a.from===b.from&&a.to===b.to}
function inferPreset(range:DateRange):MetricsPresetKey{
  for(const item of METRICS_PRESETS){if(item.key==='custom')continue;if(same(range,presetRange(item.key)))return item.key}
  return 'custom';
}
function initial():Stored{
  try{
    const x=JSON.parse(sessionStorage.getItem(KEY)||'null');
    if(x?.range?.from&&x?.range?.to)return{range:x.range,preset:x.preset||inferPreset(x.range)};
    // v1 저장값 호환
    const old=JSON.parse(sessionStorage.getItem('howtom-metrics-range-v1')||'null');
    if(old?.from&&old?.to)return{range:old,preset:inferPreset(old)};
  }catch{}
  return{range:presetRange('30d'),preset:'30d'};
}

type Value={range:DateRange;preset:MetricsPresetKey;setPreset:(p:MetricsPresetKey)=>void;setRange:(r:DateRange)=>void};
const Ctx=createContext<Value|null>(null);
export function MetricsQueryProvider({children}:{children:ReactNode}){
  const [state,setState]=useState<Stored>(initial);
  const persist=(next:Stored)=>{setState(next);try{sessionStorage.setItem(KEY,JSON.stringify(next))}catch{}};
  const setRange=(range:DateRange)=>persist({range,preset:'custom'});
  const setPreset=(preset:MetricsPresetKey)=>{if(preset==='custom'){persist({...state,preset});return}persist({range:presetRange(preset),preset})};
  return <Ctx.Provider value={useMemo(()=>({range:state.range,preset:state.preset,setPreset,setRange}),[state])}>{children}</Ctx.Provider>;
}
export function useMetricsQuery(){const v=useContext(Ctx);if(!v)throw new Error('MetricsQueryProvider가 필요합니다.');return v;}
