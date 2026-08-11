import { AdChannelConnector, ChannelCredential, FetchedDailyMetrics, ConnectorNotImplementedError } from '../types';

// 실제 연동 시 참고:
//   카카오모먼트 API — Report 조회
//   GET https://apis.moment.kakao.com/openapi/v4/adAccounts/{accountId}/report/campaigns
//     ?start=YYYY-MM-DD&end=YYYY-MM-DD&fields=impression,click,cost,conversion,friendConnected
//   friendConnected(친구추가 전환)는 dbCount로, 일반 전환은 브랜드 설정에 따라
//   dbCount 또는 revenue로 매핑합니다.
//   인증: OAuth2 (카카오 비즈니스 계정)
export const kakaoMomentConnector: AdChannelConnector = {
  channelKey: 'kakao_moment',
  async fetchDailyMetrics(_credential: ChannelCredential, _date: string): Promise<FetchedDailyMetrics> {
    throw new ConnectorNotImplementedError('kakao_moment');
  },
};

// 카카오키워드(다음/카카오 검색광고)는 모먼트와 별개 제품·별개 API입니다.
export const kakaoKeywordConnector: AdChannelConnector = {
  channelKey: 'kakao_keyword',
  async fetchDailyMetrics(_credential: ChannelCredential, _date: string): Promise<FetchedDailyMetrics> {
    throw new ConnectorNotImplementedError('kakao_keyword');
  },
};
