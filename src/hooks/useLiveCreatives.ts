import { useEffect, useMemo, useState } from 'react';
import { useAdvertisers } from './useAdvertisers';
import { apiFetch } from './useApi';
import type { Creative } from '../data/creativeLibrary';

type CreativeMetricRow = {
  advertiserId: string; channel: string; adId: string; adName: string; campaignName?: string;
  impressions: number; clicks: number; spend: number; dbCount: number; revenue?: number;
  thumbnailUrl?: string | null; mediaType?: 'image' | 'video' | null; title?: string; body?: string; cta?: string;
};

/** 설정 > 매체 계정 연동으로 동기화된 실제 소재 데이터를, 소재 분석 화면들이 쓰는 Creative[] 형태로 변환합니다. */
export function useLiveCreatives(): Creative[] {
  const [advertisers] = useAdvertisers();
  const [rows, setRows] = useState<CreativeMetricRow[]>([]);
  useEffect(() => {
    apiFetch<{ rows: CreativeMetricRow[] }>('/creative-metrics').then(r => setRows(r.rows || [])).catch(() => setRows([]));
  }, []);
  return useMemo(() => rows.map((r): Creative => ({
    id: `${r.channel}-${r.adId}`,
    name: r.adName,
    brand: advertisers.find(a => a.id === r.advertiserId)?.name ?? r.advertiserId,
    platform: r.channel === 'meta' ? '메타' : r.channel,
    type: r.mediaType === 'video' ? '영상' : '이미지',
    objective: r.dbCount > 0 ? 'DB 수집' : '트래픽',
    thumb: r.thumbnailUrl || '🖼️',
    copy: [r.title, r.body].filter(Boolean).join('\n'),
    status: r.clicks > 0 && r.dbCount / Math.max(1, r.clicks) > 0.05 ? '성과 좋음' : r.clicks > 0 ? '보통' : '피로',
    liveStatus: '노출중',
    fatigue: '데이터 부족',
    tags: [],
    spend: r.spend,
    uses: 1,
    date: new Date().toISOString().slice(0, 10),
    campaignName: r.campaignName,
    headline: r.title,
    primaryText: r.body,
    cta: r.cta,
  })), [rows, advertisers]);
}
