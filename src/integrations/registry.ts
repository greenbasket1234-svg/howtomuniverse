import { AdChannelConnector, ChannelKey } from './types';
import { metaConnector } from './connectors/meta';
import { naverConnector, gfaConnector } from './connectors/naver';
import { googleConnector, youtubeConnector } from './connectors/google';
import { kakaoMomentConnector, kakaoKeywordConnector } from './connectors/kakao';
import { danggeunConnector, tiktokConnector, mobionConnector, adnConnector } from './connectors/others';

export const CONNECTOR_REGISTRY: Record<ChannelKey, AdChannelConnector> = {
  meta: metaConnector,
  naver: naverConnector,
  gfa: gfaConnector,
  google_sa: googleConnector,
  youtube: youtubeConnector,
  kakao_moment: kakaoMomentConnector,
  kakao_keyword: kakaoKeywordConnector,
  danggeun: danggeunConnector,
  tiktok: tiktokConnector,
  mobion: mobionConnector,
  adn: adnConnector,
};
