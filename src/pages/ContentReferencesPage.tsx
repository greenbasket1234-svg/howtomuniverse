import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Play, Bookmark, FolderPlus, X, ExternalLink, Wand2, Star } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ModalPortal } from '../components/ModalPortal';
import { ChannelTag } from '../components/ChannelTag';
import { apiFetch } from '../hooks/useApi';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { CONTENT_STUDIO_URL } from '../data/universeMenu';

// ============================================================
// 타입
// ============================================================
type ReferenceType = 'ADVERTISEMENT' | 'ORGANIC_CONTENT';
type ReferenceStatus = 'unread' | 'reviewing' | 'saved' | 'used_in_production' | 'archived';
type ConnectorInfo = { key: string; platform: string; label: string; referenceType: ReferenceType; implemented: boolean; capabilities: Record<string, boolean> };
type ReferenceItem = {
  id: string; advertiser_id?: string | null; advertiser_name?: string | null;
  reference_type: ReferenceType; platform: string; source_type: string;
  external_id?: string | null; url?: string | null; canonical_url?: string | null;
  title?: string | null; body?: string | null; headline?: string | null; description?: string | null; cta?: string | null;
  author_id?: string | null; author_name?: string | null; author_followers?: number | null;
  thumbnail_url?: string | null; media_url?: string | null; media_type?: string | null; content_type?: string | null;
  ad_status?: string | null; ad_started_at?: string | null;
  published_at?: string | null; collected_at: string;
  views: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null;
  available_metrics: string[]; status: ReferenceStatus; is_favorite: boolean; note?: string | null;
  tags: string[]; collections?: { id: string; name: string }[];
  viewFollowerRatio?: number | null; likeFollowerRatio?: number | null; commentFollowerRatio?: number | null;
};
type SearchResultItem = {
  externalId?: string; url?: string | null; canonicalUrl?: string | null; title?: string | null; body?: string | null;
  description?: string | null; cta?: string | null; authorId?: string | null; authorName?: string | null; authorFollowers?: number | null;
  thumbnailUrl?: string | null; mediaUrl?: string | null; mediaType?: string | null; contentType?: string | null;
  adStatus?: string | null; adStartedAt?: string | null; publishedAt?: string | null;
  views?: number | null; likes?: number | null; comments?: number | null; shares?: number | null; saves?: number | null;
  availableMetrics: string[]; rawMetadata?: unknown; alreadySaved?: boolean; captionMatchesQuery?: boolean;
};
type Collection = { id: string; name: string; description?: string | null; item_count: number };
type CollectionRule = {
  id: string; name: string; advertiser_id?: string | null; advertiser_name?: string | null; content_kind: string;
  platforms: string[]; keywords: string[]; min_metrics: Record<string, number>; mode: string; is_active: boolean;
  last_collected_at?: string | null; last_collected_count?: number | null;
};

const won = (n?: number | null) => (n == null ? '-' : `₩${Math.round(n).toLocaleString()}`);
const num = (n?: number | null) => (n == null ? '-' : n.toLocaleString());
const pct = (n?: number | null) => (n == null ? '-' : `${(n * 100).toFixed(1)}%`);
const STATUS_LABEL: Record<ReferenceStatus, string> = { unread: '미확인', reviewing: '검토중', saved: '저장', used_in_production: '제작 사용', archived: '보관' };
const CONTENT_TYPES = ['영상', '숏폼', '이미지', '카드뉴스', '텍스트', '광고', '기타'];
const REFERENCE_SCOPES = ['구조만 참고', '후킹 참고', '톤앤매너 참고', '주제 참고', '전체적인 방향 참고'];
const CREATE_TARGETS: { key: string; label: string; path: string; external?: boolean }[] = [
  { key: 'ad_copy', label: '광고 문구 만들기', path: '/content/ad-creation' },
  { key: 'blog', label: '블로그 글 만들기 ↗', path: CONTENT_STUDIO_URL.replace(/\/$/,'')+'/production/blog', external: true },
  { key: 'video_script', label: '영상 대본 만들기', path: '/content/video-scripts' },
  { key: 'image_ad', label: '이미지 광고 기획 만들기', path: '/content/image-creation' },
  { key: 'document', label: '문서에 추가', path: '/content/documents' },
];

export function ContentReferencesPage() {
  const [advertisers] = useAdvertisers();
  const [summary, setSummary] = useState({ todayCollected: 0, weekCollected: 0, savedReferences: 0, activeKeywordRules: 0 });
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [rules, setRules] = useState<CollectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 필터 상태
  const [kindTab, setKindTab] = useState<'all' | ReferenceType>('all');
  const [platformTab, setPlatformTab] = useState<'all' | 'meta' | 'youtube' | 'tiktok' | 'threads'>('all');
  const [metaSubTab, setMetaSubTab] = useState<'all' | 'facebook' | 'instagram'>('all');
  const [query, setQuery] = useState('');
  const [advertiserFilter, setAdvertiserFilter] = useState('');
  const [contentType, setContentType] = useState('');
  const [status, setStatus] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [sort, setSort] = useState<'latest' | 'views' | 'likes' | 'comments' | 'ratio'>('latest');
  const [minViews, setMinViews] = useState('');
  const [minComments, setMinComments] = useState('');
  const [minFollowers, setMinFollowers] = useState('');

  const [selected, setSelected] = useState<ReferenceItem | null>(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showRuleSettings, setShowRuleSettings] = useState(false);

  const reload = () => {
    setLoading(true); setError('');
    const params = new URLSearchParams();
    if (kindTab !== 'all') params.set('referenceType', kindTab);
    if (platformTab !== 'all') params.set('platform', metaSubTab !== 'all' ? metaSubTab : platformTab);
    if (advertiserFilter) params.set('advertiserId', advertiserFilter);
    if (contentType) params.set('contentType', contentType);
    if (status) params.set('status', status);
    if (collectionFilter) params.set('collectionId', collectionFilter);
    if (query) params.set('query', query);
    if (minViews) params.set('minViews', minViews);
    if (minComments) params.set('minComments', minComments);
    if (minFollowers) params.set('minFollowers', minFollowers);
    params.set('sort', sort === 'ratio' ? 'latest' : sort); // 비율 정렬은 서버 정렬 대상이 아니라 받아온 뒤 클라이언트에서 다시 정렬합니다.
    apiFetch<{ items: ReferenceItem[] }>(`/references?${params.toString()}`)
      .then(r => setItems(r.items || []))
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [kindTab, platformTab, metaSubTab, advertiserFilter, contentType, status, collectionFilter, sort]);
  useEffect(() => {
    apiFetch<typeof summary>('/references/summary').then(setSummary).catch(() => {});
    apiFetch<{ connectors: ConnectorInfo[] }>('/references/connectors/status').then(r => setConnectors(r.connectors || [])).catch(() => {});
    reloadCollections();
    reloadRules();
  }, []);
  const reloadCollections = () => apiFetch<{ collections: Collection[] }>('/reference-collections').then(r => setCollections(r.collections || [])).catch(() => {});
  const reloadRules = () => apiFetch<{ rules: CollectionRule[] }>('/reference-collection-rules').then(r => setRules(r.rules || [])).catch(() => {});

  const sortedItems = useMemo(() => {
    if (sort !== 'ratio') return items;
    return [...items].sort((a, b) => (b.viewFollowerRatio ?? b.likeFollowerRatio ?? 0) - (a.viewFollowerRatio ?? a.likeFollowerRatio ?? 0));
  }, [items, sort]);

  const connectorOf = (platform: string) => connectors.find(c => c.platform === platform);
  const platformStatusLabel = (platform: string): string => {
    const c = connectorOf(platform);
    if (!c) return '준비중';
    if (!c.implemented) return '준비중';
    return '연동됨';
  };

  return <div className="ref-collect-page">
    <PageHeader
      title="레퍼런스 수집"
      description="광고와 인기 콘텐츠를 수집하고, 성과 지표를 기준으로 좋은 레퍼런스를 찾아 HOWTOM 콘텐츠 제작에 활용합니다."
      action={<div className="toolbar-actions">
        <button className="btn secondary" onClick={() => setShowUrlModal(true)}><Plus size={15}/>URL 직접 저장</button>
        <button className="btn secondary" onClick={() => setShowRuleSettings(true)}><FolderPlus size={15}/>수집 설정</button>
        <button className="btn btn-primary" onClick={() => setShowCollectModal(true)}><Search size={15}/>지금 수집</button>
      </div>}
    />

    <div className="summary-grid summary-grid-compact">
      <div className="summary-card"><div className="summary-card-label">오늘 수집</div><div className="summary-card-value">{summary.todayCollected}</div></div>
      <div className="summary-card"><div className="summary-card-label">이번 주 수집</div><div className="summary-card-value">{summary.weekCollected}</div></div>
      <div className="summary-card"><div className="summary-card-label">저장한 레퍼런스</div><div className="summary-card-value text-success">{summary.savedReferences}</div></div>
      <div className="summary-card"><div className="summary-card-label">등록 키워드(수집 규칙)</div><div className="summary-card-value text-accent">{summary.activeKeywordRules}</div></div>
    </div>

    <div className="ref-kind-tabs" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      {(['all', 'ADVERTISEMENT', 'ORGANIC_CONTENT'] as const).map(k => (
        <button key={k} className={`chip-tab ${kindTab === k ? 'active' : ''}`} onClick={() => setKindTab(k)}>
          {k === 'all' ? '전체' : k === 'ADVERTISEMENT' ? '광고' : '일반 콘텐츠'}
        </button>
      ))}
    </div>

    <div className="ref-platform-tabs" style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
      {(['all', 'meta', 'youtube', 'tiktok', 'threads'] as const).map(p => (
        <button key={p} className={`chip-tab ${platformTab === p ? 'active' : ''}`} onClick={() => { setPlatformTab(p); setMetaSubTab('all'); }}>
          {p === 'all' ? '전체' : p === 'meta' ? 'Meta' : p === 'youtube' ? 'YouTube' : p === 'tiktok' ? 'TikTok' : 'Threads'}
          {p !== 'all' && <span className="chip-tab-status"> · {platformStatusLabel(p === 'meta' ? 'meta' : p)}</span>}
        </button>
      ))}
    </div>
    {platformTab === 'meta' && (
      <div className="ref-meta-subtabs" style={{ display: 'flex', gap: 6, marginBottom: 12, paddingLeft: 4 }}>
        {(['all', 'facebook', 'instagram'] as const).map(s => (
          <button key={s} className={`chip-tab small ${metaSubTab === s ? 'active' : ''}`} onClick={() => setMetaSubTab(s)}>
            {s === 'all' ? '전체' : s === 'facebook' ? 'Facebook' : 'Instagram'}
          </button>
        ))}
      </div>
    )}

    {['youtube', 'tiktok', 'threads'].includes(platformTab) && (
      <div className="status-banner neutral" style={{ marginBottom: 12 }}>
        {platformTab === 'youtube' && '준비중 — YouTube Data API 연동이 아직 준비되지 않았습니다.'}
        {platformTab === 'tiktok' && 'API 권한 필요 — TikTok 공식 API 권한 확인이 필요합니다.'}
        {platformTab === 'threads' && '준비중 — Threads API 연동이 아직 준비되지 않았습니다.'}
      </div>
    )}

    <div className="card compact-card">
      <div className="filter-row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="campaign-search-box" style={{ flex: '1 1 260px' }}>
          <Search size={14}/><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && reload()} placeholder="예: 장기렌트, 임플란트, 포장이사"/>
        </div>
        <button className="btn secondary" onClick={reload}>검색</button>
        <select value={advertiserFilter} onChange={e => setAdvertiserFilter(e.target.value)}><option value="">전체 광고주</option>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select value={contentType} onChange={e => setContentType(e.target.value)}><option value="">전체 유형</option>{CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <select value={status} onChange={e => setStatus(e.target.value)}><option value="">전체 상태</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={collectionFilter} onChange={e => setCollectionFilter(e.target.value)}><option value="">전체 컬렉션</option>{collections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.item_count})</option>)}</select>
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
          <option value="latest">최신순</option><option value="views">조회수 높은순</option><option value="likes">좋아요 높은순</option><option value="comments">댓글 높은순</option><option value="ratio">계정 규모 대비 반응 높은순</option>
        </select>
      </div>
      <div className="filter-row" style={{ marginTop: 8, gap: 10, flexWrap: 'wrap' }}>
        <label className="ref-perf-filter">조회수 <select value={minViews} onChange={e => { setMinViews(e.target.value); }}><option value="">제한 없음</option><option value="10000">1만 이상</option><option value="100000">10만 이상</option><option value="1000000">100만 이상</option></select></label>
        <label className="ref-perf-filter">댓글 <select value={minComments} onChange={e => setMinComments(e.target.value)}><option value="">제한 없음</option><option value="10">10 이상</option><option value="100">100 이상</option><option value="1000">1,000 이상</option></select></label>
        <label className="ref-perf-filter">팔로워/구독자 <select value={minFollowers} onChange={e => setMinFollowers(e.target.value)}><option value="">제한 없음</option><option value="1000">1천 이상</option><option value="10000">1만 이상</option><option value="100000">10만 이상</option></select></label>
        <button className="btn secondary small" onClick={reload}>필터 적용</button>
      </div>
    </div>

    {error && <div className="status-banner danger" style={{ marginTop: 12 }}>{error}</div>}
    {loading ? (
      <div className="card empty-state" style={{ marginTop: 12 }}>레퍼런스를 불러오는 중입니다.</div>
    ) : sortedItems.length === 0 ? (
      <div className="card empty-state" style={{ marginTop: 12 }}>
        <div className="empty-state-title">조건에 맞는 레퍼런스가 없습니다.</div>
        <div>상단의 "지금 수집"으로 새로 검색하거나, "URL 직접 저장"으로 개별 레퍼런스를 추가해보세요.</div>
      </div>
    ) : (
      <div className="ref-card-grid">
        {sortedItems.map(item => <ReferenceCard key={item.id} item={item} onOpen={() => setSelected(item)}/>)}
      </div>
    )}

    {selected && (
      <ReferenceDetailDrawer
        item={selected}
        advertisers={advertisers}
        collections={collections}
        onClose={() => setSelected(null)}
        onUpdated={() => { reload(); }}
        onCollectionsChanged={reloadCollections}
      />
    )}
    {showCollectModal && (
      <CollectNowModal
        connectors={connectors}
        rules={rules}
        advertisers={advertisers}
        onClose={() => setShowCollectModal(false)}
        onSaved={() => { reload(); apiFetch<typeof summary>('/references/summary').then(setSummary).catch(() => {}); }}
      />
    )}
    {showUrlModal && (
      <SaveUrlModal advertisers={advertisers} onClose={() => setShowUrlModal(false)} onSaved={() => { reload(); setShowUrlModal(false); }}/>
    )}
    {showRuleSettings && (
      <RuleSettingsModal rules={rules} advertisers={advertisers} onClose={() => setShowRuleSettings(false)} onChanged={reloadRules}/>
    )}
  </div>;
}

// ============================================================
// 지금 수집 모달
// ============================================================
function CollectNowModal({ connectors, rules, advertisers, onClose, onSaved }: {
  connectors: ConnectorInfo[]; rules: CollectionRule[]; advertisers: { id: string; name: string }[];
  onClose: () => void; onSaved: () => void;
}) {
  const [mode, setMode] = useState<'adhoc' | 'rule'>('adhoc');
  const [connectorKey, setConnectorKey] = useState('meta_ads');
  const [igUserId, setIgUserId] = useState('');
  const [ruleId, setRuleId] = useState(rules[0]?.id || '');
  const [query, setQuery] = useState('');
  const [advertiserId, setAdvertiserId] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [meta, setMeta] = useState<{ status: string; message?: string; platform?: string; referenceType?: ReferenceType } | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [running, setRunning] = useState(false);
  const [ruleResult, setRuleResult] = useState<Record<string, { status: string; saved: number; message?: string }> | null>(null);

  const runSearch = async () => {
    setSearching(true); setResults([]); setMeta(null); setSelectedIdx(new Set());
    try {
      const r = await apiFetch<{ items: SearchResultItem[]; status: string; message?: string; platform: string; referenceType: ReferenceType }>('/references/search', {
        method: 'POST', body: JSON.stringify({ connector: connectorKey, query, igUserId }),
      });
      setResults(r.items || []); setMeta(r);
      setSelectedIdx(new Set((r.items || []).map((_, i) => i).filter(i => !r.items[i].alreadySaved)));
    } catch (e) {
      setMeta({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
    setSearching(false);
  };

  const saveSelected = async () => {
    if (!meta) return;
    setRunning(true);
    let saved = 0;
    for (const idx of selectedIdx) {
      const item = results[idx];
      try {
        await apiFetch('/references', { method: 'POST', body: JSON.stringify({ referenceType: meta.referenceType, platform: meta.platform, advertiserId: advertiserId || null, item }) });
        saved++;
      } catch { /* 중복 등은 건너뜁니다 */ }
    }
    setRunning(false);
    onSaved();
    if (saved) onClose();
  };

  const runRule = async () => {
    if (!ruleId) return;
    setRunning(true); setRuleResult(null);
    try {
      const r = await apiFetch<{ results: Record<string, { status: string; saved: number; message?: string }> }>(`/reference-collection-rules/${ruleId}/run`, { method: 'POST' });
      setRuleResult(r.results);
      onSaved();
    } catch (e) { setRuleResult({ error: { status: 'error', saved: 0, message: e instanceof Error ? e.message : String(e) } }); }
    setRunning(false);
  };

  return (
    <ModalPortal onClose={onClose} wide>
      <div className="modal-head"><h3>지금 수집</h3><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className={`chip-tab ${mode === 'adhoc' ? 'active' : ''}`} onClick={() => setMode('adhoc')}>검색어로 바로 수집</button>
        <button className={`chip-tab ${mode === 'rule' ? 'active' : ''}`} onClick={() => setMode('rule')}>저장된 수집 규칙 실행</button>
      </div>

      {mode === 'adhoc' ? (
        <>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label>커넥터
              <select value={connectorKey} onChange={e => setConnectorKey(e.target.value)}>
                {connectors.map(c => <option key={c.key} value={c.key} disabled={!c.implemented}>{c.label}{!c.implemented ? ' (준비중)' : ''}</option>)}
              </select>
            </label>
            <label>저장 시 연결할 광고주<select value={advertiserId} onChange={e => setAdvertiserId(e.target.value)}><option value="">연결 안 함</option>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          </div>
          {connectorKey === 'instagram_organic' && (
            <label style={{ display: 'block', marginTop: 10 }}>
              연결된 Instagram 비즈니스 계정 ID
              <input value={igUserId} onChange={e => setIgUserId(e.target.value)} placeholder="예: 178414...  (Meta 비즈니스 관리자에서 확인)"/>
              <span className="footnote">해시태그 검색은 Meta 정책상 연결된 Instagram 비즈니스 계정을 통해서만 가능합니다.</span>
            </label>
          )}
          <div className="campaign-search-box" style={{ marginTop: 10 }}>
            <Search size={14}/><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()} placeholder="검색어 (예: 장기렌트, 임플란트)"/>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={runSearch} disabled={searching || !query.trim() || (connectorKey === 'instagram_organic' && !igUserId.trim())}><Play size={14}/> {searching ? '검색 중...' : '검색'}</button>

          {meta?.message && <div className={`status-banner ${meta.status === 'permission_required' || meta.status === 'error' ? 'danger' : 'neutral'}`} style={{ marginTop: 12 }}>{meta.message}</div>}

          {results.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="footnote" style={{ marginBottom: 8 }}>{selectedIdx.size}개 선택됨 (총 {results.length}개, 이미 수집된 항목은 기본 선택 해제)</div>
              <div style={{ maxHeight: 360, overflowY: 'auto', display: 'grid', gap: 8 }}>
                {results.map((r, i) => (
                  <label key={i} className="ref-search-result-row" style={{ display: 'flex', gap: 10, padding: 8, border: '1px solid #eef2f7', borderRadius: 10, opacity: r.alreadySaved ? 0.5 : 1 }}>
                    <input type="checkbox" checked={selectedIdx.has(i)} onChange={() => setSelectedIdx(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; })}/>
                    {r.thumbnailUrl ? <img src={r.thumbnailUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}/> : <div style={{ width: 56, height: 56, background: '#f1f5f9', borderRadius: 8, flexShrink: 0 }}/>}
                    <div style={{ minWidth: 0 }}>
                      <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || r.body?.slice(0, 60) || '(제목 없음)'}</b>
                      <small className="muted-text">{r.authorName || '-'} {r.captionMatchesQuery && <span className="badge badge-success" style={{ marginLeft: 4 }}>캡션에도 일치</span>} {r.alreadySaved && '· 이미 수집된 레퍼런스입니다'}</small>
                    </div>
                  </label>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={saveSelected} disabled={running || !selectedIdx.size}>{running ? '저장 중...' : `선택한 ${selectedIdx.size}개 저장`}</button>
            </div>
          )}
        </>
      ) : (
        <>
          {rules.length === 0 ? (
            <p className="muted-text">저장된 수집 규칙이 없습니다. "수집 설정"에서 먼저 만들어주세요.</p>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 6 }}>
                {rules.map(r => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="radio" name="rule" checked={ruleId === r.id} onChange={() => setRuleId(r.id)}/> {r.name} <span className="muted-text">({r.keywords.join(', ') || '키워드 없음'})</span></label>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={runRule} disabled={running || !ruleId}><Play size={14}/> {running ? '수집 중...' : '수집 시작'}</button>
              {ruleResult && (
                <div style={{ marginTop: 12 }}>
                  {Object.entries(ruleResult).map(([key, r]) => (
                    <div key={key} className="ref-collect-progress-row">
                      <span>{connectors.find(c => c.key === key)?.label || key}</span>
                      <span>{r.status === 'connected' ? `완료 (${r.saved}건 저장)` : r.status === 'connector_unimplemented' ? '준비중' : r.status === 'permission_required' ? 'API 권한 필요' : r.message || r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </ModalPortal>
  );
}

function ReferenceDetailDrawer({ item, advertisers, collections, onClose, onUpdated, onCollectionsChanged }: {
  item: ReferenceItem; advertisers: { id: string; name: string }[]; collections: Collection[];
  onClose: () => void; onUpdated: () => void; onCollectionsChanged: () => void;
}) {
  const [advertiserId, setAdvertiserId] = useState(item.advertiser_id || '');
  const [status, setStatus] = useState(item.status);
  const [note, setNote] = useState(item.note || '');
  const [tagsInput, setTagsInput] = useState((item.tags || []).join(', '));
  const [favorite, setFavorite] = useState(item.is_favorite);
  const [saving, setSaving] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [createTarget, setCreateTarget] = useState<typeof CREATE_TARGETS[number] | null>(null);
  const [scope, setScope] = useState(REFERENCE_SCOPES[0]);
  const [collectionIds, setCollectionIds] = useState<Set<string>>(new Set((item.collections || []).map(c => c.id)));

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/references/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ advertiserId: advertiserId || null, status, note, isFavorite: favorite, tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean) }),
      });
      onUpdated();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const toggleCollection = async (collectionId: string) => {
    const has = collectionIds.has(collectionId);
    try {
      if (has) { await apiFetch(`/reference-collections/${collectionId}/items/${item.id}`, { method: 'DELETE' }); }
      else { await apiFetch(`/reference-collections/${collectionId}/items`, { method: 'POST', body: JSON.stringify({ referenceId: item.id }) }); }
      setCollectionIds(prev => { const next = new Set(prev); has ? next.delete(collectionId) : next.add(collectionId); return next; });
      onCollectionsChanged();
    } catch (e) { console.error(e); }
  };

  const runCreate = async () => {
    if (!createTarget) return;
    await apiFetch(`/references/${item.id}/usage`, { method: 'POST', body: JSON.stringify({ usedFor: createTarget.key, referenceScope: scope }) }).catch(() => {});
    const ctx = { referenceId: item.id, advertiserId: item.advertiser_id, referenceType: item.reference_type, platform: item.platform, title: item.title, body: item.body, url: item.url, thumbnailUrl: item.thumbnail_url, rawText: item.body, transcript: null, scope };
    // 콘텐츠 제작소는 완전히 다른 도메인이라 sessionStorage가 넘어가지 않습니다 - 그 경우엔
    // 참고 자료 자동 전달 없이 이동만 하고, 사용자가 직접 내용을 옮겨 붙이게 됩니다.
    if (!createTarget.external) sessionStorage.setItem('howtom-reference-context', JSON.stringify(ctx));
    window.location.href = createTarget.path;
  };

  const isAd = item.reference_type === 'ADVERTISEMENT';

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-head"><div><h3>{item.title || item.headline || '레퍼런스 상세'}</h3><p style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><ChannelTag channel={item.platform}/> {item.author_name && `· ${item.author_name}`}</p></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>

      {item.thumbnail_url ? <img className="creative-detail-preview" src={item.thumbnail_url} alt=""/> : <div className="creative-detail-preview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, background: '#f1f5f9', borderRadius: 10, color: '#94a3b8' }}>미리보기 없음</div>}

      {(item.body || item.description) && (
        <div style={{ margin: '14px 0', padding: 12, background: '#f8fafc', borderRadius: 10 }}>
          {item.body && <p style={{ whiteSpace: 'pre-wrap', marginBottom: 6 }}>{item.body}</p>}
          {item.description && <p className="muted-text">{item.description}</p>}
          {item.cta && <p><b>CTA:</b> {item.cta}</p>}
        </div>
      )}

      {!isAd && (
        <div className="detail-kpi-grid">
          <div><span>조회</span><b>{item.available_metrics.includes('views') ? num(item.views) : '데이터 미제공'}</b></div>
          <div><span>좋아요</span><b>{item.available_metrics.includes('likes') ? num(item.likes) : '데이터 미제공'}</b></div>
          <div><span>댓글</span><b>{item.available_metrics.includes('comments') ? num(item.comments) : '데이터 미제공'}</b></div>
          <div><span>공유</span><b>{item.available_metrics.includes('shares') ? num(item.shares) : '데이터 미제공'}</b></div>
          <div><span>저장</span><b>{item.available_metrics.includes('saves') ? num(item.saves) : '데이터 미제공'}</b></div>
          <div><span>팔로워/구독자</span><b>{num(item.author_followers)}</b></div>
        </div>
      )}

      <dl className="kv-grid" style={{ marginTop: 14 }}>
        <dt>플랫폼</dt><dd>{item.platform}</dd>
        <dt>게시일</dt><dd>{item.published_at ? String(item.published_at).slice(0, 10) : '-'}</dd>
        <dt>수집일</dt><dd>{String(item.collected_at).slice(0, 10)}</dd>
        <dt>원문</dt><dd>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">원문 보기 <ExternalLink size={12}/></a> : '-'}</dd>
      </dl>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #eef2f7' }}>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label>광고주<select value={advertiserId} onChange={e => setAdvertiserId(e.target.value)}><option value="">연결 안 함</option>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>상태<select value={status} onChange={e => setStatus(e.target.value as ReferenceStatus)}>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <label style={{ display: 'block', marginTop: 10 }}>태그 (쉼표로 구분)<input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="예: 릴스 후킹, 가격 강조"/></label>
        <label style={{ display: 'block', marginTop: 10 }}>내 메모<textarea value={note} onChange={e => setNote(e.target.value)} rows={2}/></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}><input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)}/> 즐겨찾기</label>

        <div style={{ marginTop: 12 }}>
          <span className="footnote" style={{ marginBottom: 6, display: 'block' }}>컬렉션</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {collections.map(c => (
              <button key={c.id} type="button" className={`chip-tab small ${collectionIds.has(c.id) ? 'active' : ''}`} onClick={() => toggleCollection(c.id)}>{c.name}</button>
            ))}
            {!collections.length && <span className="muted-text">컬렉션이 없습니다. "수집 설정"에서 만들 수 있어요.</span>}
          </div>
        </div>
      </div>

      <div className="modal-actions" style={{ justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-primary" onClick={() => setShowCreateMenu(v => !v)}><Wand2 size={15}/> 이 레퍼런스로 제작 ▾</button>
          {showCreateMenu && (
            <div className="sidebar-footer-menu" style={{ bottom: 'auto', top: 'calc(100% + 6px)', left: 0, minWidth: 220 }}>
              {CREATE_TARGETS.map(t => (
                <button key={t.key} className="sidebar-footer-menu-item" onClick={() => { setCreateTarget(t); setShowCreateMenu(false); }}>{t.label}</button>
              ))}
            </div>
          )}
        </div>
        <button className="btn secondary" onClick={save} disabled={saving}><Bookmark size={15}/> {saving ? '저장 중...' : '저장'}</button>
      </div>

      {createTarget && (
        <ModalPortal onClose={() => setCreateTarget(null)}>
          <div className="modal-head"><h3>이 레퍼런스를 어떻게 참고할까요?</h3><button className="icon-btn" onClick={() => setCreateTarget(null)}><X size={18}/></button></div>
          <p className="muted-text">"{createTarget.label}"로 이동합니다.{createTarget.external?' 콘텐츠 제작소는 별도 서비스라 이 레퍼런스 내용이 자동으로 전달되지 않으니, 필요하면 직접 옮겨 붙여주세요.':' 이 레퍼런스의 내용을 참고 자료로 함께 전달합니다.'}</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {REFERENCE_SCOPES.map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="radio" name="scope" checked={scope === s} onChange={() => setScope(s)}/> {s}</label>
            ))}
          </div>
          <div className="modal-actions"><button className="btn secondary" onClick={() => setCreateTarget(null)}>취소</button><button className="btn btn-primary" onClick={runCreate}>이 방식으로 참고하기</button></div>
        </ModalPortal>
      )}
    </ModalPortal>
  );
}

function ReferenceCard({ item, onOpen }: { item: ReferenceItem; onOpen: () => void }) {
  const isAd = item.reference_type === 'ADVERTISEMENT';
  return (
    <article className="ref-card" onClick={onOpen}>
      <div className="ref-card-thumb">
        {item.thumbnail_url ? <img src={item.thumbnail_url} alt={item.title || item.body || ''}/> : <span className="ref-card-thumb-empty">{isAd ? '광고 미리보기 없음' : '썸네일 없음'}</span>}
        {item.is_favorite && <Star size={14} className="ref-card-fav" fill="currentColor"/>}
      </div>
      <div className="ref-card-body">
        <div className="ref-card-meta"><ChannelTag channel={item.platform}/>{isAd && <span className="badge badge-neutral">META AD</span>}</div>
        <h3 className="ref-card-title">{item.title || item.headline || item.body?.slice(0, 60) || '(제목 없음)'}</h3>
        {isAd ? (
          <>
            <p className="ref-card-sub">{item.author_name || '-'}</p>
            {item.body && <p className="ref-card-copy">{item.body.slice(0, 80)}</p>}
            {item.cta && <p className="ref-card-cta">CTA: {item.cta}</p>}
            {item.ad_started_at && <p className="ref-card-date">시작일 {String(item.ad_started_at).slice(0, 10)}</p>}
          </>
        ) : (
          <>
            <p className="ref-card-sub">{item.author_name || '-'} {item.author_followers != null && `· 팔로워 ${num(item.author_followers)}`}</p>
            <div className="ref-card-stats">
              <span>조회 {item.available_metrics.includes('views') ? num(item.views) : '—'}</span>
              <span>좋아요 {item.available_metrics.includes('likes') ? num(item.likes) : '—'}</span>
              <span>댓글 {item.available_metrics.includes('comments') ? num(item.comments) : '—'}</span>
              <span>공유 {item.available_metrics.includes('shares') ? num(item.shares) : '—'}</span>
              <span>저장 {item.available_metrics.includes('saves') ? num(item.saves) : '—'}</span>
            </div>
            {(item.viewFollowerRatio || item.likeFollowerRatio) && ((item.viewFollowerRatio ?? 0) >= 1 || (item.likeFollowerRatio ?? 0) >= 0.15) && (
              <span className="badge badge-warning" style={{ marginTop: 4 }}>🔥 계정 규모 대비 반응 높음</span>
            )}
            {item.published_at && <p className="ref-card-date">{String(item.published_at).slice(0, 10)}</p>}
          </>
        )}
        {item.tags?.length > 0 && <div className="ref-card-tags">{item.tags.slice(0, 3).map(t => <span key={t} className="ref-card-tag">#{t}</span>)}</div>}
        <div className="ref-card-status"><span className={`badge badge-${item.status === 'used_in_production' ? 'success' : item.status === 'archived' ? 'neutral' : 'accent'}`}>{STATUS_LABEL[item.status]}</span></div>
      </div>
    </article>
  );
}

// ============================================================
// URL 직접 저장 모달
// ============================================================
function SaveUrlModal({ advertisers, onClose, onSaved }: { advertisers: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [url, setUrl] = useState('');
  const [advertiserId, setAdvertiserId] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!url.trim()) { setError('URL을 입력해주세요.'); return; }
    setSaving(true); setError('');
    try {
      const r = await apiFetch<{ id: string }>('/references/url', { method: 'POST', body: JSON.stringify({ url: url.trim(), advertiserId: advertiserId || null, referenceType: category === '광고' ? 'ADVERTISEMENT' : 'ORGANIC_CONTENT' }) });
      if (r.id && (tags.trim() || note.trim())) {
        await apiFetch(`/references/${r.id}`, { method: 'PATCH', body: JSON.stringify({ note: note || undefined, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }) }).catch(() => {});
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setSaving(false);
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-head"><h3>URL 직접 저장</h3><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
      {error && <div className="status-banner danger">{error}</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        <label>콘텐츠 URL<input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."/></label>
        <label>광고주<select value={advertiserId} onChange={e => setAdvertiserId(e.target.value)}><option value="">연결 안 함</option>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>카테고리<select value={category} onChange={e => setCategory(e.target.value)}><option value="">일반 콘텐츠</option><option value="광고">광고</option></select></label>
        <label>태그 (쉼표로 구분)<input value={tags} onChange={e => setTags(e.target.value)} placeholder="예: 경쟁사, 릴스"/></label>
        <label>메모<textarea value={note} onChange={e => setNote(e.target.value)} rows={2}/></label>
        <span className="footnote">저장하면 가능한 경우 제목·썸네일·설명을 자동으로 가져옵니다. 실패하면 URL만 저장되고, 나중에 직접 채울 수 있습니다.</span>
      </div>
      <div className="modal-actions"><button className="btn secondary" onClick={onClose}>취소</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중...' : '저장'}</button></div>
    </ModalPortal>
  );
}

// ============================================================
// 수집 설정 모달 (수집 규칙 목록 + 생성/수정)
// ============================================================
function RuleSettingsModal({ rules, advertisers, onClose, onChanged }: { rules: CollectionRule[]; advertisers: { id: string; name: string }[]; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState<Partial<CollectionRule> | null>(null);
  const [name, setName] = useState('');
  const [advertiserId, setAdvertiserId] = useState('');
  const [contentKind, setContentKind] = useState('BOTH');
  const [platforms, setPlatforms] = useState<string[]>(['meta']);
  const [keywords, setKeywords] = useState('');
  const [minViews, setMinViews] = useState('');
  const [minComments, setMinComments] = useState('');
  const [minFollowers, setMinFollowers] = useState('');
  const [mode, setMode] = useState('manual');
  const [saving, setSaving] = useState(false);

  const startCreate = () => { setEditing({}); setName(''); setAdvertiserId(''); setContentKind('BOTH'); setPlatforms(['meta']); setKeywords(''); setMinViews(''); setMinComments(''); setMinFollowers(''); setMode('manual'); };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(), advertiserId: advertiserId || null, contentKind, platforms,
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      minMetrics: { ...(minViews ? { views: Number(minViews) } : {}), ...(minComments ? { comments: Number(minComments) } : {}), ...(minFollowers ? { followers: Number(minFollowers) } : {}) },
      mode,
    };
    try {
      if (editing?.id) await apiFetch(`/reference-collection-rules/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await apiFetch('/reference-collection-rules', { method: 'POST', body: JSON.stringify(payload) });
      setEditing(null); onChanged();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const toggle = async (rule: CollectionRule) => { await apiFetch(`/reference-collection-rules/${rule.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !rule.is_active }) }).catch(() => {}); onChanged(); };
  const duplicate = async (rule: CollectionRule) => { await apiFetch(`/reference-collection-rules/${rule.id}/duplicate`, { method: 'POST' }).catch(() => {}); onChanged(); };
  const remove = async (rule: CollectionRule) => { if (!confirm(`"${rule.name}" 수집 규칙을 삭제할까요?`)) return; await apiFetch(`/reference-collection-rules/${rule.id}`, { method: 'DELETE' }).catch(() => {}); onChanged(); };

  return (
    <ModalPortal onClose={onClose} wide>
      <div className="modal-head"><h3>수집 설정</h3><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>

      {!editing ? (
        <>
          <button className="btn btn-primary" onClick={startCreate} style={{ marginBottom: 12 }}><Plus size={14}/> 새 수집 규칙</button>
          <div className="table-scroll"><table className="data-table">
            <thead><tr><th>수집명</th><th>광고주</th><th>콘텐츠 종류</th><th>플랫폼</th><th>키워드</th><th>최근 수집</th><th>상태</th><th>작업</th></tr></thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id}>
                  <td><b>{r.name}</b></td><td>{r.advertiser_name || '-'}</td>
                  <td>{r.content_kind === 'ADVERTISEMENT' ? '광고' : r.content_kind === 'ORGANIC_CONTENT' ? '일반 콘텐츠' : '모두'}</td>
                  <td>{r.platforms.join(', ') || '전체'}</td><td>{r.keywords.join(', ') || '-'}</td>
                  <td>{r.last_collected_at ? `${String(r.last_collected_at).slice(0, 10)} (${r.last_collected_count ?? 0}건)` : '없음'}</td>
                  <td><span className={`badge badge-${r.is_active ? 'success' : 'neutral'}`}>{r.is_active ? 'ON' : 'OFF'}</span></td>
                  <td><div className="row-actions">
                    <button className="icon-btn" title="수정" onClick={() => { setEditing(r); setName(r.name); setAdvertiserId(r.advertiser_id || ''); setContentKind(r.content_kind); setPlatforms(r.platforms); setKeywords(r.keywords.join(', ')); setMinViews(String(r.min_metrics?.views || '')); setMinComments(String(r.min_metrics?.comments || '')); setMinFollowers(String(r.min_metrics?.followers || '')); setMode(r.mode); }}>수정</button>
                    <button className="icon-btn" title="복제" onClick={() => duplicate(r)}>복제</button>
                    <button className="icon-btn" title="ON/OFF" onClick={() => toggle(r)}>{r.is_active ? 'OFF' : 'ON'}</button>
                    <button className="icon-btn" title="삭제" onClick={() => remove(r)}>삭제</button>
                  </div></td>
                </tr>
              ))}
              {!rules.length && <tr><td colSpan={8} className="empty-cell">저장된 수집 규칙이 없습니다.</td></tr>}
            </tbody>
          </table></div>
        </>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <label>수집 이름<input value={name} onChange={e => setName(e.target.value)}/></label>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label>광고주<select value={advertiserId} onChange={e => setAdvertiserId(e.target.value)}><option value="">연결 안 함</option>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <label>콘텐츠 종류<select value={contentKind} onChange={e => setContentKind(e.target.value)}><option value="BOTH">모두</option><option value="ADVERTISEMENT">광고</option><option value="ORGANIC_CONTENT">일반 콘텐츠</option></select></label>
          </div>
          <div>
            <span className="footnote">플랫폼</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {['meta', 'youtube', 'tiktok', 'threads'].map(p => (
                <button key={p} type="button" className={`chip-tab small ${platforms.includes(p) ? 'active' : ''}`} onClick={() => setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}>{p}</button>
              ))}
            </div>
          </div>
          <label>키워드 (쉼표로 구분)<input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="예: 장기렌트, 임플란트"/></label>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <label>최소 조회수<input type="number" value={minViews} onChange={e => setMinViews(e.target.value)} placeholder="예: 100000"/></label>
            <label>최소 댓글수<input type="number" value={minComments} onChange={e => setMinComments(e.target.value)} placeholder="예: 100"/></label>
            <label>최소 팔로워<input type="number" value={minFollowers} onChange={e => setMinFollowers(e.target.value)} placeholder="예: 10000"/></label>
          </div>
          <label>수집 방식<select value={mode} onChange={e => setMode(e.target.value)}><option value="manual">수동</option><option value="auto">자동(향후 자동화 연결 예정)</option></select></label>
          <div className="modal-actions"><button className="btn secondary" onClick={() => setEditing(null)}>목록으로</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중...' : '저장'}</button></div>
        </div>
      )}
    </ModalPortal>
  );
}
