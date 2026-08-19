import { DateRangePicker } from './DateRangePicker';
import { useMetricsQuery } from '../context/MetricsQueryContext';
import { METRICS_PRESETS } from '../utils/metricsDate';

export function MetricsDateBar({compact=false}:{compact?:boolean}){
  const {range,preset,setPreset,setRange}=useMetricsQuery();
  return <div className={`metrics-date-bar${compact?' compact':''}`}>
    <div className="metrics-date-presets">{METRICS_PRESETS.filter(p=>p.key!=='custom').map(p=><button key={p.key} className={`tiny-filter ${preset===p.key?'active':''}`} onClick={()=>setPreset(p.key)}>{p.label}</button>)}</div>
    <DateRangePicker value={range} onChange={setRange}/>
  </div>;
}
