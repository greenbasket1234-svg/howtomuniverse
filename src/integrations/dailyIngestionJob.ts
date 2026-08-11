import { CONNECTOR_REGISTRY } from './registry';
import { ChannelCredential } from './types';

// ============================================================
// 일일 수집 파이프라인
// ============================================================
// 일간 보고가 매일 오전 8~9시에 이뤄지므로, 이 잡은 07:00 KST 전에 "끝나 있어야" 합니다.
// 실행 스케줄은 이 파일이 아니라 배포 환경의 스케줄러(cron)에서 설정합니다
// (운영 스케줄 예시는 루트 README.md 참고). 이 파일은 "몇 시에 도는지"가 아니라
// "돌면 무엇을 하는지"만 정의합니다.

export type IngestionResult = {
  brandId: string;
  channelKey: string;
  date: string;
  status: 'success' | 'failed';
  error?: string;
};

// 브랜드 × 채널 자격증명 목록. 실제 저장소에서는 DB 테이블로 옮기고,
// access token 등 민감정보는 반드시 별도 시크릿 저장소에서 조회하세요.
// 여기서는 구조만 보여주기 위해 다방이사 예시 하나만 채워둡니다.
export const CHANNEL_CREDENTIALS: ChannelCredential[] = [
  { brandId: 'dabang-isa', channelKey: 'meta', accountId: 'act_XXXXXXXXX' },
  { brandId: 'dabang-isa', channelKey: 'naver', accountId: 'naver_ad_XXXX' },
  // GATE: 나머지 브랜드 × 채널 자격증명을 실제 DB에서 조회하도록 교체
];

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * targetDate(보통 어제, T-1) 하루치 데이터를 모든 브랜드 × 채널에 대해 수집합니다.
 * 매체 API는 자정 이후 몇 시간 지나야 안정적인 값을 주는 경우가 많으므로,
 * "오늘 데이터"가 아니라 "어제 데이터"를 수집 대상으로 삼는 걸 권장합니다.
 */
export async function runDailyIngestion(targetDate: string): Promise<IngestionResult[]> {
  const results: IngestionResult[] = [];

  for (const credential of CHANNEL_CREDENTIALS) {
    const connector = CONNECTOR_REGISTRY[credential.channelKey];
    try {
      const metrics = await withRetry(() => connector.fetchDailyMetrics(credential, targetDate));
      await saveDailyMetrics(credential.brandId, credential.channelKey, metrics);
      results.push({ brandId: credential.brandId, channelKey: credential.channelKey, date: targetDate, status: 'success' });
    } catch (err) {
      results.push({
        brandId: credential.brandId,
        channelKey: credential.channelKey,
        date: targetDate,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
      // GATE: 실패 시 Slack/이메일 알림 발송 — 06:50까지 실패가 남아있으면
      // 07:00 보고 전에 사람이 확인할 수 있도록 별도 알림 잡을 하나 더 두는 걸 권장합니다.
    }
  }

  return results;
}

// GATE: 실제 저장소(DB) 연결 지점. 지금은 아무것도 하지 않습니다.
async function saveDailyMetrics(
  brandId: string,
  channelKey: string,
  metrics: { date: string; impressions?: number; clicks?: number; spend?: number; dbCount?: number; revenue?: number }
): Promise<void> {
  // 예: await db.dailyMetrics.upsert({ where: { brandId, channelKey, date: metrics.date }, data: metrics })
  void brandId; void channelKey; void metrics;
}
