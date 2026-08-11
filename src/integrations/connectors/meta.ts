import { AdChannelConnector, ChannelCredential, FetchedDailyMetrics, ConnectorNotImplementedError } from '../types';

// 실제 연동 시 참고:
//   Meta Marketing API - Insights
//   GET https://graph.facebook.com/v21.0/act_{accountId}/insights
//     ?time_range={"since":"{date}","until":"{date}"}
//     &fields=impressions,clicks,spend,actions
//     &access_token={ACCESS_TOKEN}
//   actions 배열 안에서 action_type이 브랜드가 정의한 전환 액션(예: lead, purchase)인
//   값을 dbCount 또는 revenue로 매핑해야 합니다 (매체 자체는 "전환"을 구분하지 않음).
//   인증: OAuth2 (Business Manager System User 토큰 권장, 60일 만료 토큰 대신)
export const metaConnector: AdChannelConnector = {
  channelKey: 'meta',
  async fetchDailyMetrics(_credential: ChannelCredential, _date: string): Promise<FetchedDailyMetrics> {
    throw new ConnectorNotImplementedError('meta');
  },
};
