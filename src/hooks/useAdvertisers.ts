import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './useApi';
import { Advertiser, DEFAULT_ADVERTISERS, saveAdvertisers } from '../data/advertisers';

type SetAdvertisers = (next: Advertiser[] | ((prev: Advertiser[]) => Advertiser[])) => void;

/** 백엔드 API 우선, 실패 시 localStorage 폴백 */
export function useAdvertisers(): [Advertiser[], SetAdvertisers, () => Promise<void>] {
  const [advertisers, setAdvertisersState] = useState<Advertiser[]>(DEFAULT_ADVERTISERS);

  const loadFromApi = useCallback(async () => {
    try {
      const data = await apiFetch<Record<string, unknown>[]>('/advertisers');
      if (!Array.isArray(data) || data.length === 0) return;

      const CHANNELS = ['Meta', '네이버', '구글', '당근', '틱톡', '카카오'] as const;
      const CH_KEY: Record<string, string> = {
        Meta: 'meta', '네이버': 'naver', '구글': 'google',
        '당근': 'daangn', '틱톡': 'tiktok', '카카오': 'kakao',
      };

      const mapped: Advertiser[] = data.map((adv) => {
        const accounts = (adv.accounts as Record<string, unknown>[] | null) ?? [];
        return {
          id:            String(adv.id),
          name:          String(adv.name),
          monthlyBudget: Number(adv.monthly_budget ?? 0),
          color:         String(adv.brand_color ?? '#2563eb'),
          initial:       String(adv.name)?.[0] ?? '?',
          links: CHANNELS.map(channel => {
            const acc = accounts.find((a) => (a as Record<string,unknown>).channel === CH_KEY[channel]) as Record<string,unknown> | undefined;
            const status = acc?.status === 'connected' ? '연결됨' : acc?.status === 'error' ? '수집 실패' : '미연동';
            return {
              channel,
              status,
              accountId: acc ? String(acc.account_id ?? '') : undefined,
              lastSync:  acc?.last_synced_at ? new Date(String(acc.last_synced_at)).toLocaleDateString('ko-KR') : undefined,
              keyRegistered: status === '연결됨',
            };
          }),
        };
      });

      setAdvertisersState(mapped);
      saveAdvertisers(mapped);
    } catch {
      // API 실패 → localStorage 폴백
      try {
        const raw = localStorage.getItem('ad-control-center-advertisers-v1');
        if (raw) {
          const parsed = JSON.parse(raw) as Advertiser[];
          if (Array.isArray(parsed) && parsed.length) setAdvertisersState(parsed);
        }
      } catch { /* 무시 */ }
    }
  }, []);

  useEffect(() => { loadFromApi(); }, []);

  // 크로스 컴포넌트 동기화
  useEffect(() => {
    const sync = (e: Event) => {
      const detail = (e as CustomEvent<Advertiser[]>).detail;
      setAdvertisersState(detail ?? DEFAULT_ADVERTISERS);
    };
    window.addEventListener('adcc:advertisers-changed', sync);
    return () => window.removeEventListener('adcc:advertisers-changed', sync);
  }, []);

  const setAdvertisers: SetAdvertisers = (next) => {
    setAdvertisersState(prev => {
      const value = typeof next === 'function' ? next(prev) : next;
      saveAdvertisers(value);
      return value;
    });
  };

  return [advertisers, setAdvertisers, loadFromApi];
}
