import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from './useApi';
import { useMetricsQuery } from '../context/MetricsQueryContext';
import type { MetricsMeta, MetricsResponse } from '../types/metrics';

export function metricQuery(range:{from:string;to:string}, extra:{advertiserId?:string;channel?:string}={}){
  const q=new URLSearchParams({from:range.from,to:range.to});if(extra.advertiserId)q.set('advertiserId',extra.advertiserId);if(extra.channel)q.set('channel',extra.channel);return q.toString();
}
export function useMetricRows<T>(endpoint:string, extra:{advertiserId?:string;channel?:string}={}){
  const {range}=useMetricsQuery();const key=useMemo(()=>metricQuery(range,extra),[range.from,range.to,extra.advertiserId,extra.channel]);
  const [rows,setRows]=useState<T[]>([]);const [meta,setMeta]=useState<MetricsMeta|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  useEffect(()=>{let alive=true;setLoading(true);setError('');apiFetch<MetricsResponse<T>>(`${endpoint}?${key}`).then(r=>{if(!alive)return;setRows(r.rows||[]);setMeta(r.meta||null)}).catch(e=>{if(!alive)return;setRows([]);setError(e instanceof Error?e.message:String(e))}).finally(()=>alive&&setLoading(false));return()=>{alive=false}},[endpoint,key]);
  return {rows,meta,loading,error,range};
}
