import { AdChannelConnector, ChannelCredential, FetchedDailyMetrics, ConnectorNotImplementedError } from '../types';

// 실제 연동 시 참고:
//   네이버 검색광고 API (Searchad API)
//   GET https://api.searchad.naver.com/stats
//     ?ids={campaignId}&fields=["impCnt","clkCnt","salesAmt"]&timeRange={"since":"{date}","until":"{date}"}
//   인증: API License(고객centre ID + Secret Key), 매 요청마다 HMAC 서명 필요
export const naverConnector: AdChannelConnector = {
  channelKey: 'naver',
  async fetchDailyMetrics(_credential: ChannelCredential, _date: string): Promise<FetchedDailyMetrics> {
    throw new ConnectorNotImplementedError('naver');
  },
};

// 실제 연동 시 참고:
//   네이버 GFA(성과형 디스플레이) API — 검색광고 API와 별개 제품/별개 인증
//   GET https://gfa.naver.com/api/... (계정 매니저를 통한 보고서 다운로드 API)
//   인증: GFA 광고관리자 계정 기반 OAuth
export const gfaConnector: AdChannelConnector = {
  channelKey: 'gfa',
  async fetchDailyMetrics(_credential: ChannelCredential, _date: string): Promise<FetchedDailyMetrics> {
    throw new ConnectorNotImplementedError('gfa');
  },
};
