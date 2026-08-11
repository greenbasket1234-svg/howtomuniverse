import { AdChannelConnector, ChannelCredential, FetchedDailyMetrics, ConnectorNotImplementedError } from '../types';

// 실제 연동 시 참고:
//   Google Ads API — GoogleAdsService.SearchStream (GAQL)
//   SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
//   FROM campaign WHERE segments.date = '{date}'
//   구글 SA(검색)와 YouTube(디스플레이/동영상)는 같은 API, campaign.advertising_channel_type
//   으로 구분해서 조회합니다.
//   인증: OAuth2 + Developer Token, MCC(관리자 계정) 하위 개별 계정 접근
export const googleConnector: AdChannelConnector = {
  channelKey: 'google_sa',
  async fetchDailyMetrics(_credential: ChannelCredential, _date: string): Promise<FetchedDailyMetrics> {
    throw new ConnectorNotImplementedError('google_sa');
  },
};

export const youtubeConnector: AdChannelConnector = {
  channelKey: 'youtube',
  async fetchDailyMetrics(_credential: ChannelCredential, _date: string): Promise<FetchedDailyMetrics> {
    throw new ConnectorNotImplementedError('youtube');
  },
};
