import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './useApi';
import { Advertiser, saveAdvertisers } from '../data/advertisers';

type SetAdvertisers = (next: Advertiser[] | ((prev: Advertiser[]) => Advertiser[])) => void;

/** 광고주 데이터는 백엔드 API를 단일 Source of Truth로 사용합니다. */
export function useAdvertisers(): [Advertiser[], SetAdvertisers, () => Promise<void>] {
  const [advertisers, setAdvertisersState] = useState<Advertiser[]>([]);

  const loadFromApi = useCallback(async () => {
    try {
      const data = await apiFetch<Record<string, unknown>[]>('/advertisers');
      if (!Array.isArray(data)) return;
      if (data.length === 0) { setAdvertisersState([]); saveAdvertisers([]); return; }

      const CHANNELS = ['Meta', '네이버', '구글', '당근', '틱톡', '카카오'] as const;
      const CH_KEY: Record<string, string> = {
        Meta: 'meta', '네이버': 'naver', '구글': 'google',
        '당근': 'daangn', '틱톡': 'tiktok', '카카오': 'kakao',
      };
      const STORE_CHANNELS: Array<'cafe24' | 'naver_store'> = ['cafe24', 'naver_store'];

      const mapped: Advertiser[] = data.map((adv) => {
        const accounts = (adv.accounts as Record<string, unknown>[] | null) ?? [];
        return {
          id:            String(adv.id),
          name:          String(adv.name),
          monthlyBudget: Number(adv.monthly_budget ?? 0),
          color:         String(adv.brand_color ?? '#2563eb'),
          initial:       String(adv.name)?.[0] ?? '?',
          industry:      String(adv.industry ?? ''),
          website:       String(adv.website ?? ''),
          phone:         String(adv.phone ?? ''),
          address:       String(adv.address ?? ''),
          businessRegNo: adv.business_reg_no ? String(adv.business_reg_no) : undefined,
          autopostProIndustry: adv.autopost_pro_industry ? String(adv.autopost_pro_industry) : undefined,
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
          // 쇼핑몰 채널 연동 상태 (카페24·네이버 스마트스토어)
          storeLinks: STORE_CHANNELS.map(ch => {
            const acc = accounts.find((a) => (a as Record<string,unknown>).channel === ch) as Record<string,unknown> | undefined;
            const status = acc?.status === 'connected' ? '연결됨' : acc?.status === 'error' ? '수집 실패' : '미연동';
            return {
              channel: ch,
              status,
              accountId: acc ? String(acc.account_id ?? '') : undefined,
              lastSync:  acc?.last_synced_at ? new Date(String(acc.last_synced_at)).toLocaleDateString('ko-KR') : undefined,
              lastError: acc?.last_sync_error ? String(acc.last_sync_error) : undefined,
              rowCount:  acc?.last_row_count ? Number(acc.last_row_count) : undefined,
            };
          }),
        };
      });

      setAdvertisersState(mapped);
      saveAdvertisers(mapped);
    } catch {
      // 운영 백엔드가 실패한 경우 샘플 데이터로 대체하지 않습니다.
      setAdvertisersState([]);
    }
  }, []);

  useEffect(() => { loadFromApi(); }, []);

  // 크로스 컴포넌트 동기화
  useEffect(() => {
    const sync = (e: Event) => {
      const detail = (e as CustomEvent<Advertiser[]>).detail;
      setAdvertisersState(detail ?? []);
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
