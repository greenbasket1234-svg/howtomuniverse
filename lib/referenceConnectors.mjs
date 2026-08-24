// ============================================================
// 레퍼런스 수집 Connector 구조
// ------------------------------------------------------------
// 플랫폼별 API 코드를 UI/엔드포인트에 직접 박지 않고, 이 파일에서
// 공통 형태(ReferenceItem)로 정규화해서 돌려줍니다.
//
// 각 Connector는 다음 형태를 따릅니다:
//   {
//     platform, referenceType, label,
//     capabilities: { views, likes, comments, shares, saves, followers } (지원 여부, boolean),
//     implemented: boolean,
//     search({ query, ...filters }) => Promise<{ items: ReferenceItem[], status, message? }>
//   }
//
// 중요: 공식 API가 제공하지 않는 지표는 절대 0으로 채우지 않고 null로 둡니다.
// 미구현 Connector는 가짜 데이터를 만들지 않고 상태값(status)만 정직하게 돌려줍니다.
// ============================================================

/** 미구현 커넥터 공통 응답 - 항상 이 형태로 "왜 안 되는지"를 알려줍니다. */
function unimplemented(platform, label, message) {
  return {
    platform, referenceType: 'ORGANIC_CONTENT', label, implemented: false,
    capabilities: { views: false, likes: false, comments: false, shares: false, saves: false, followers: false },
    async search() { return { items: [], status: 'connector_unimplemented', message: message || `${label} 커넥터는 아직 구현되지 않았습니다.` }; },
  };
}

/**
 * Meta 광고 라이브러리(Ad Library) - 공개된 모든 활성/과거 광고를 검색하는 Meta의 공식 API입니다.
 * 일반 마케팅 API(Marketing API, 광고 성과 조회용)와는 별개의 API이며, 별도의 접근 권한
 * (Meta의 광고주 신원 확인 절차)이 필요할 수 있습니다. 권한이 없으면 해당 에러를 그대로 보여줍니다.
 */
function createMetaAdsConnector({ metaGraphGet, metaConfigured, ctaLabelKo }) {
  return {
    platform: 'meta',
    referenceType: 'ADVERTISEMENT',
    label: 'Meta 광고',
    implemented: true,
    // 광고 라이브러리는 공개 성과 지표(조회수/좋아요 등)를 제공하지 않습니다 - 광고주만 볼 수 있는 정보입니다.
    capabilities: { views: false, likes: false, comments: false, shares: false, saves: false, followers: false },
    async search({ query, country, adType, limit }) {
      if (!metaConfigured()) return { items: [], status: 'permission_required', message: 'META_ACCESS_TOKEN이 설정되지 않았습니다.' };
      if (!query || !query.trim()) return { items: [], status: 'connected', message: '검색어를 입력해주세요.' };
      try {
        const data = await metaGraphGet('/ads_archive', {
          search_terms: query,
          ad_reached_countries: JSON.stringify([country || 'KR']),
          ad_type: adType || 'ALL',
          ad_active_status: 'ALL',
          limit: String(Math.min(limit || 25, 50)),
          fields: 'id,page_name,page_id,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_descriptions,ad_creative_link_captions,ad_snapshot_url,ad_delivery_start_time,ad_delivery_stop_time,publisher_platforms,languages',
        });
        const items = (data?.data || []).map(ad => ({
          externalId: String(ad.id),
          url: ad.ad_snapshot_url || null,
          canonicalUrl: ad.ad_snapshot_url || null,
          title: (ad.ad_creative_link_titles || [])[0] || null,
          body: (ad.ad_creative_bodies || [])[0] || null,
          description: (ad.ad_creative_link_descriptions || [])[0] || null,
          cta: null, // 라이브러리 API는 CTA 버튼 타입을 별도로 안 줍니다(광고 본문 텍스트로만 확인 가능).
          authorId: ad.page_id || null,
          authorName: ad.page_name || null,
          authorFollowers: null,
          thumbnailUrl: null, // 스냅샷은 이미지가 아니라 미리보기 페이지 URL입니다(ad_snapshot_url).
          mediaUrl: null,
          mediaType: null,
          contentType: '광고',
          adStatus: ad.ad_delivery_stop_time ? 'inactive' : 'active',
          adStartedAt: ad.ad_delivery_start_time || null,
          publishedAt: ad.ad_delivery_start_time || null,
          views: null, likes: null, comments: null, shares: null, saves: null,
          availableMetrics: [],
          rawMetadata: ad,
        }));
        return { items, status: 'connected' };
      } catch (err) {
        const msg = err?.message || String(err);
        // Ad Library 접근 권한이 없으면 Meta가 특정 OAuth 에러를 돌려줍니다 - 그대로 보여줘서
        // "왜 안 되는지" 사용자가 알 수 있게 합니다(가짜로 되는 척하지 않습니다).
        return { items: [], status: 'permission_required', message: `Meta 광고 라이브러리 조회 실패: ${msg}` };
      }
    },
  };
}

/**
 * Instagram 일반 콘텐츠 - 공식 해시태그 검색 API(ig_hashtag_search)를 씁니다.
 * 이 API는 "특정 해시태그가 달린 공개 게시물"만 검색할 수 있고(자유 키워드 전체 검색 불가),
 * 계정당 주간 조회 가능한 해시태그 개수 제한이 있습니다(Meta 정책).
 * 저장수·공유수·상세 인사이트는 타인 게시물에서 공식적으로 제공되지 않아 항상 null입니다.
 */
function createInstagramOrganicConnector({ metaGraphGet, metaConfigured }) {
  return {
    platform: 'instagram',
    referenceType: 'ORGANIC_CONTENT',
    label: 'Instagram 일반 콘텐츠',
    implemented: true,
    capabilities: { views: false, likes: true, comments: true, shares: false, saves: false, followers: false },
    async search({ query, igUserId, limit }) {
      if (!metaConfigured()) return { items: [], status: 'permission_required', message: 'META_ACCESS_TOKEN이 설정되지 않았습니다.' };
      if (!igUserId) return { items: [], status: 'permission_required', message: '해시태그 검색을 하려면 연결된 Instagram 비즈니스 계정(IG User ID)이 필요합니다.' };
      const hashtag = (query || '').trim().replace(/^#/, '');
      if (!hashtag) return { items: [], status: 'connected', message: '검색할 해시태그를 입력해주세요.' };
      try {
        const hashtagSearch = await metaGraphGet('/ig_hashtag_search', { user_id: igUserId, q: hashtag });
        const hashtagId = hashtagSearch?.data?.[0]?.id;
        if (!hashtagId) return { items: [], status: 'connected', message: `'#${hashtag}' 해시태그를 찾을 수 없습니다.` };
        const media = await metaGraphGet(`/${hashtagId}/top_media`, {
          user_id: igUserId,
          fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count,username',
          limit: String(Math.min(limit || 25, 50)),
        });
        const items = (media?.data || []).map(m => ({
          externalId: String(m.id),
          url: m.permalink || null,
          canonicalUrl: m.permalink || null,
          title: null,
          body: m.caption || null,
          description: null,
          cta: null,
          authorId: null,
          authorName: m.username || null,
          authorFollowers: null, // 해시태그 검색 결과는 작성자 팔로워 수를 제공하지 않습니다.
          thumbnailUrl: m.thumbnail_url || m.media_url || null,
          mediaUrl: m.media_url || null,
          mediaType: m.media_type === 'VIDEO' ? 'video' : m.media_type === 'CAROUSEL_ALBUM' ? 'carousel' : 'image',
          contentType: m.media_type === 'VIDEO' ? '영상' : '이미지',
          adStatus: null, adStartedAt: null,
          publishedAt: m.timestamp || null,
          views: null,
          likes: m.like_count ?? null,
          comments: m.comments_count ?? null,
          shares: null, saves: null,
          availableMetrics: ['likes', 'comments'],
          rawMetadata: m,
        }));
        return { items, status: 'connected' };
      } catch (err) {
        return { items: [], status: 'permission_required', message: `Instagram 해시태그 검색 실패: ${err?.message || err}` };
      }
    },
  };
}

/** 전체 Connector 레지스트리를 만듭니다. server.mjs에서 필요한 헬퍼를 주입받아 사용합니다. */
function buildReferenceConnectors(deps) {
  return {
    meta_ads: createMetaAdsConnector(deps),
    instagram_organic: createInstagramOrganicConnector(deps),
    youtube: unimplemented('youtube', 'YouTube', 'YouTube Data API 연동이 아직 준비되지 않았습니다.'),
    tiktok: unimplemented('tiktok', 'TikTok', 'TikTok 공식 API 권한 확인이 필요합니다.'),
    threads: unimplemented('threads', 'Threads', 'Threads API 연동이 아직 준비되지 않았습니다.'),
  };
}

export { buildReferenceConnectors };
