// ============================================================
// 연동 GATE — 매체별 API 연동 공통 인터페이스
// ============================================================
// 이 폴더 전체는 "구조는 완성, 실제 API 호출은 GATE" 상태입니다.
// 실제 Meta/네이버/구글/카카오 등의 API 키·시크릿이 없는 환경에서는
// 실제 데이터를 가져올 수 없으므로, 여기서는 다음까지만 만듭니다.
//   1. 매체가 공통으로 구현해야 하는 인터페이스
//   2. 매체별 연동 지점(어떤 API를, 어떤 파라미터로 불러야 하는지 주석으로 명시)
//   3. 전체 파이프라인이 도는 순서(dailyIngestionJob.ts)
// 실제 저장소에서는 각 connector의 fetchDailyMetrics 내부만 채우면 되고,
// 나머지 구조(등록·집계·저장)는 그대로 재사용할 수 있게 만들었습니다.

export type ChannelKey =
  | 'meta' | 'naver' | 'google_sa' | 'danggeun' | 'youtube' | 'tiktok'
  | 'gfa' | 'kakao_keyword' | 'kakao_moment' | 'mobion' | 'adn';

// 실제 access token / secret은 여기 두지 않습니다. 환경변수 또는 별도의
// 시크릿 매니저(예: AWS Secrets Manager, Doppler)에서 주입받는 걸 권장합니다.
export type ChannelCredential = {
  brandId: string;
  channelKey: ChannelKey;
  accountId: string; // 광고계정 ID (예: Meta는 act_XXXXXXXXX)
};

export type FetchedDailyMetrics = {
  date: string; // YYYY-MM-DD
  impressions?: number;
  clicks?: number;
  spend?: number;
  dbCount?: number; // 전환·DB·리드. 매체마다 어떤 액션을 이걸로 볼지는 브랜드 설정에서 정의
  revenue?: number; // 매출 (전환값 연동이 되는 브랜드만)
};

export interface AdChannelConnector {
  channelKey: ChannelKey;
  /** 지정한 날짜 하루치 데이터를 가져옵니다. 매체 API는 대부분 "완료된 하루" 기준으로만
   *  안정적인 값을 주므로, date는 보통 어제(T-1)를 사용합니다. */
  fetchDailyMetrics(credential: ChannelCredential, date: string): Promise<FetchedDailyMetrics>;
}

export class ConnectorNotImplementedError extends Error {
  constructor(channelKey: string) {
    super(`[GATE] ${channelKey} 커넥터가 아직 실제 API에 연결되지 않았습니다.`);
  }
}
