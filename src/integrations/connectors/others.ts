import { AdChannelConnector, ChannelCredential, FetchedDailyMetrics, ConnectorNotImplementedError } from '../types';

// 당근마켓 비즈니스 광고 API (파트너 승인 계정만 접근 가능 — 일반 공개 문서가 제한적이라
// 실제 연동 전 당근마켓 비즈니스 담당자를 통한 API 권한 협의가 먼저 필요합니다.)
export const danggeunConnector: AdChannelConnector = {
  channelKey: 'danggeun',
  async fetchDailyMetrics(_credential: ChannelCredential, _date: string): Promise<FetchedDailyMetrics> {
    throw new ConnectorNotImplementedError('danggeun');
  },
};

// TikTok Marketing API — GET /open_api/v1.3/report/integrated/get/
// (advertiser_id, report_type=BASIC, dimensions=["stat_time_day"], metrics=[impressions,clicks,spend])
export const tiktokConnector: AdChannelConnector = {
  channelKey: 'tiktok',
  async fetchDailyMetrics(_credential: ChannelCredential, _date: string): Promise<FetchedDailyMetrics> {
    throw new ConnectorNotImplementedError('tiktok');
  },
};

// 모비온 · ADN은 공개 REST API 문서가 표준화되어 있지 않은 경우가 많습니다.
// 대행사 전용 보고서 다운로드(엑셀/CSV) 방식만 제공되는 경우, 실제 연동은
// "매일 자동 다운로드 + 파싱" 방식으로 만들어야 할 수 있습니다 — 이 부분은
// 매체사 담당자에게 API 제공 여부를 먼저 확인하는 걸 권장합니다.
export const mobionConnector: AdChannelConnector = {
  channelKey: 'mobion',
  async fetchDailyMetrics(_credential: ChannelCredential, _date: string): Promise<FetchedDailyMetrics> {
    throw new ConnectorNotImplementedError('mobion');
  },
};

export const adnConnector: AdChannelConnector = {
  channelKey: 'adn',
  async fetchDailyMetrics(_credential: ChannelCredential, _date: string): Promise<FetchedDailyMetrics> {
    throw new ConnectorNotImplementedError('adn');
  },
};
