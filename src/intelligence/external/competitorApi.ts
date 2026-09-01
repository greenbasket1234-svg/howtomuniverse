// ============================================================
// 경쟁사 추적 - Postgres 연동 버전
// ------------------------------------------------------------
// 예전엔 브라우저 localStorage(externalStore.ts)에만 저장돼서 팀원끼리 공유가
// 안 되고 기기를 바꾸면 사라졌습니다. 이제 서버(competitors, references_store
// 테이블)에 저장해 팀 전체가 공유하고, Meta 광고 라이브러리 같은 실제 자동
// 수집 결과도 그대로 여기 연결됩니다.
//
// competitorEngine.ts / trendEngine.ts는 이 모듈이 아니라 기존 externalTypes.ts의
// Competitor / ExternalCreativeObservation 타입만 알고 있으면 되므로, 여기서
// 서버 응답(스네이크 케이스)을 그 타입 모양으로 변환해서 돌려줍니다 - 분석 엔진은
// 전혀 수정하지 않아도 됩니다.
// ============================================================
import { apiFetch } from '../../hooks/useApi';
import type { Competitor, ExternalCreativeObservation, ExternalCreativeType } from './externalTypes';

type CompetitorRow = {
  id: string; advertiser_id: string | null; advertiser_name: string | null; name: string;
  industry: string | null; website_url: string | null; channels: { platform: string; profileUrl?: string }[] | null;
  priority: string; status: string; created_at: string; updated_at: string;
};

function mapCompetitor(row: CompetitorRow): Competitor {
  return {
    competitorId: row.id,
    advertiserId: row.advertiser_id || undefined,
    advertiserName: row.advertiser_name || undefined,
    name: row.name,
    industry: row.industry || undefined,
    websiteUrl: row.website_url || undefined,
    channels: row.channels || [],
    priority: (row.priority as Competitor['priority']) || 'normal',
    status: (row.status as Competitor['status']) || 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type ReferenceRow = {
  id: string; competitor_id: string | null; advertiser_id: string | null; advertiser_name?: string | null;
  platform: string; content_type: string | null; url: string | null; thumbnail_url: string | null;
  headline: string | null; body: string | null; cta: string | null; hook_types: string[] | null; tags?: string[];
  note: string | null; reference_id?: string; first_seen_at: string | null; last_seen_at: string | null;
  collected_at: string; created_at: string; updated_at: string;
};

const CREATIVE_TYPE_BY_CONTENT: Record<string, ExternalCreativeType> = { '영상': 'video', '숏폼': 'video', '이미지': 'image', '카드뉴스': 'image', '텍스트': 'copy', '광고': 'copy' };

function mapObservation(row: ReferenceRow, competitorName: string): ExternalCreativeObservation {
  return {
    observationId: row.id,
    competitorId: row.competitor_id || '',
    competitorName,
    advertiserId: row.advertiser_id || undefined,
    advertiserName: row.advertiser_name || undefined,
    platform: row.platform,
    creativeType: CREATIVE_TYPE_BY_CONTENT[row.content_type || ''] || 'copy',
    sourceUrl: row.url || undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    headline: row.headline || undefined,
    body: row.body || undefined,
    cta: row.cta || undefined,
    hookTypes: row.hook_types || [],
    tags: row.tags || [],
    memo: row.note || undefined,
    referenceId: row.id, // 이 테이블 자체가 references_store 행이므로 자기 자신이 곧 레퍼런스입니다.
    capturedAt: row.first_seen_at || row.collected_at,
    firstSeenAt: row.first_seen_at || undefined,
    lastSeenAt: row.last_seen_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadCompetitors(advertiserId?: string): Promise<Competitor[]> {
  const qs = advertiserId ? `?advertiserId=${encodeURIComponent(advertiserId)}` : '';
  const res = await apiFetch<{ items: CompetitorRow[] }>(`/competitors${qs}`);
  return (res.items || []).map(mapCompetitor);
}

export async function createCompetitor(input: Omit<Competitor, 'competitorId' | 'createdAt' | 'updatedAt'>): Promise<Competitor> {
  const row = await apiFetch<CompetitorRow>('/competitors', {
    method: 'POST',
    body: JSON.stringify({ advertiserId: input.advertiserId, name: input.name, industry: input.industry, websiteUrl: input.websiteUrl, channels: input.channels, priority: input.priority, status: input.status }),
  });
  return mapCompetitor(row);
}

export async function patchCompetitor(competitorId: string, patch: Partial<Competitor>): Promise<Competitor> {
  const row = await apiFetch<CompetitorRow>(`/competitors/${competitorId}`, {
    method: 'PATCH',
    body: JSON.stringify({ advertiserId: patch.advertiserId, name: patch.name, industry: patch.industry, websiteUrl: patch.websiteUrl, channels: patch.channels, priority: patch.priority, status: patch.status }),
  });
  return mapCompetitor(row);
}

export async function deleteCompetitor(competitorId: string): Promise<void> {
  await apiFetch(`/competitors/${competitorId}`, { method: 'DELETE' });
}

/** 특정 경쟁사(또는 전체, competitorId 생략 시)의 관찰 소재를 불러옵니다. */
export async function loadObservations(competitorId?: string): Promise<ExternalCreativeObservation[]> {
  const params = new URLSearchParams({ limit: '200' });
  if (competitorId) params.set('competitorId', competitorId);
  else params.set('hasCompetitor', 'true');
  const [refsRes, competitors] = await Promise.all([
    apiFetch<{ items: ReferenceRow[] }>(`/references?${params.toString()}`),
    loadCompetitors(),
  ]);
  const nameById = new Map(competitors.map(c => [c.competitorId, c.name]));
  return (refsRes.items || []).filter(r => r.competitor_id).map(r => mapObservation(r, nameById.get(r.competitor_id!) || '알 수 없음'));
}

export async function createObservation(input: Omit<ExternalCreativeObservation, 'observationId' | 'createdAt' | 'updatedAt'>): Promise<ExternalCreativeObservation> {
  const contentTypeByCreative: Record<ExternalCreativeType, string> = { image: '이미지', video: '영상', copy: '텍스트', landing: '텍스트' };
  const row = await apiFetch<{ id: string }>('/references', {
    method: 'POST',
    body: JSON.stringify({
      advertiserId: input.advertiserId,
      competitorId: input.competitorId,
      platform: input.platform,
      referenceType: 'ADVERTISEMENT',
      sourceType: 'manual_url',
      item: {
        url: input.sourceUrl, canonicalUrl: input.sourceUrl, thumbnailUrl: input.thumbnailUrl,
        headline: input.headline, body: input.body, cta: input.cta, hookTypes: input.hookTypes,
        contentType: contentTypeByCreative[input.creativeType], capturedAt: input.capturedAt,
      },
    }),
  });
  const competitors = await loadCompetitors();
  const name = competitors.find(c => c.competitorId === input.competitorId)?.name || input.competitorName;
  return { ...input, observationId: row.id, referenceId: row.id, competitorName: name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export async function patchObservation(observationId: string, patch: Partial<ExternalCreativeObservation>): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.memo !== undefined) body.note = patch.memo;
  if (patch.hookTypes !== undefined) body.hookTypes = patch.hookTypes;
  if (patch.tags !== undefined) body.tags = patch.tags;
  if (patch.advertiserId !== undefined) body.advertiserId = patch.advertiserId;
  if (patch.lastSeenAt !== undefined) body.lastSeenAt = patch.lastSeenAt;
  await apiFetch(`/references/${observationId}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteObservation(observationId: string): Promise<void> {
  await apiFetch(`/references/${observationId}`, { method: 'DELETE' });
}
