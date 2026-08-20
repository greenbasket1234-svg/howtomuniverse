import { useMemo } from 'react';
import type { Creative } from '../data/creativeLibrary';
import type { CreativeMetricRow } from '../types/metrics';
import { useMetricRows } from './useMetrics';

/** 중앙 creative_daily_metrics를 현재 공통 기간으로 집계한 실제 소재만 반환합니다. */
export function useLiveCreatives(): Creative[] {
  const {rows}=useMetricRows<CreativeMetricRow>('/metrics/creatives');
  return useMemo(()=>rows.map((r):Creative=>({
    id:`${r.channel}-${r.adId}`,name:r.adName,brand:r.advertiserName??r.advertiserId,platform:r.channel==='meta'?'메타':r.channel==='naver'?'네이버':r.channel,
    type:r.mediaType==='video'?'영상':r.mediaType==='text'?'키워드':'이미지',objective:r.dbCount>0?'DB 수집':r.revenue>0?'판매':'트래픽',thumb:r.thumbnailUrl||'🖼️',copy:[r.title,r.body].filter(Boolean).join('\n'),
    status:r.clicks>0&&r.dbCount/Math.max(1,r.clicks)>0.05?'성과 좋음':r.clicks>0?'보통':'피로',liveStatus:'노출중',fatigue:'데이터 부족',tags:[],spend:r.spend,uses:1,date:new Date().toISOString().slice(0,10),
    campaignId:r.campaignId,campaignName:r.campaignName,headline:r.title,primaryText:r.body,description:r.description,cta:r.cta,
    impressions:r.impressions,clicks:r.clicks,dbCount:r.dbCount,purchases:r.purchases,revenue:r.revenue,ctr:r.ctr,cpc:r.cpc,cpm:r.cpm,cpa:r.cpa,roas:r.roas,
  })),[rows]);
}
