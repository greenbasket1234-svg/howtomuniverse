import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ExternalLink, Eye, FilePlus2, Plus, Search, Sparkles, Trash2, TrendingDown, TrendingUp, Wand2, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useSortableRows } from '../hooks/useSortableRows';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { useLiveCreatives } from '../hooks/useLiveCreatives';
import { apiFetch } from '../hooks/useApi';
import { loadCreativeAnalysisRows, normalizeCreativeMedia } from '../analytics/creativeAnalysis';
import { analyzeHookCta, type HookCtaAggregate } from '../intelligence/creative/hookCtaAnalysis';
import {
  createCompetitor, createObservation, deleteCompetitor, deleteObservation,
  loadCompetitors, loadObservations, patchCompetitor,
} from '../intelligence/external/competitorApi';
import { externalPatternSummary, summarizeCompetitor } from '../intelligence/external/competitorEngine';
import { buildTrendSignals } from '../intelligence/external/trendEngine';
import type { Competitor, ExternalCreativeObservation, ExternalCreativeType, TrendSignal } from '../intelligence/external/externalTypes';
import { saveCreativeBrief } from '../utils/creativeBriefStore';

const MEDIA = ['메타', '네이버', '구글 검색', '유튜브', '당근', '카카오', '틱톡'];
const FORMAT_LABEL: Record<string, string> = { image: '이미지', video: '영상', copy: '카피', landing: '랜딩' };
const money = (n: number) => (n ? `₩${Math.round(n).toLocaleString()}` : '-');
const pct = (n: number, d = 1) => (Number.isFinite(n) ? `${n.toFixed(d)}%` : '-');
const date = (v: string) => (v ? new Date(v.slice(0, 10) + 'T00:00:00').toLocaleDateString('ko-KR') : '-');
const split = (v: string) => v.split(',').map(x => x.trim()).filter(Boolean);

/**
 * 경쟁사·관찰 소재는 이제 서버(Postgres)에 저장되므로, localStorage 시절의 동기(sync) 로드
 * 대신 이 훅으로 비동기 로드 + 새로고침을 관리합니다. 어느 한 페이지에서 저장/삭제해도
 * 다른 페이지를 다시 열면 최신 상태가 보이도록 매 마운트마다 새로 불러옵니다.
 */
function useCompetitorData() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [observations, setObservations] = useState<ExternalCreativeObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [c, o] = await Promise.all([loadCompetitors(), loadObservations()]);
      setCompetitors(c); setObservations(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { competitors, observations, loading, error, refresh };
}

function Kpis({ items }: { items: { label: string; value: string | number; sub?: string }[] }) {
  return <section className="intel-kpis">{items.map(x => <article className="card intel-kpi" key={x.label}><span>{x.label}</span><strong>{x.value}</strong>{x.sub && <small>{x.sub}</small>}</article>)}</section>;
}
function Modal({ title, description, children, onClose, wide }: { title: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="intel-modal-back" onClick={onClose}><div className={`intel-modal card${wide ? ' intel-modal-wide' : ''}`} onClick={e => e.stopPropagation()}><header><div><h3>{title}</h3>{description && <p>{description}</p>}</div><button onClick={onClose}><X size={18} /></button></header>{children}</div></div>;
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="intel-empty"><Eye size={24} /><p>{children}</p></div>;
}

// ============================================================
// 경쟁사 분석
// ============================================================
export function CompetitorAnalysisPage() {
  const { competitors, observations, loading, error, refresh } = useCompetitorData();
  const [advertisers] = useAdvertisers();
  const [advertiserId, setAdvertiserId] = useState('');
  const [competitorId, setCompetitorId] = useState('');
  const [platform, setPlatform] = useState('');
  const [type, setType] = useState('');
  const [addComp, setAddComp] = useState(false);
  const [editComp, setEditComp] = useState<Competitor | null>(null);
  const [addObs, setAddObs] = useState(false);
  const [searchFor, setSearchFor] = useState<Competitor | null>(null);
  const liveCreatives = useLiveCreatives();

  const scopedCompetitors = competitors.filter(c => !advertiserId || c.advertiserId === advertiserId);
  const allowedIds = new Set(scopedCompetitors.map(c => c.competitorId));
  const scopedObs = observations.filter(o => allowedIds.has(o.competitorId) && (!competitorId || o.competitorId === competitorId) && (!platform || o.platform === platform) && (!type || o.creativeType === type));
  const advName = advertisers.find(a => a.id === advertiserId)?.name || '';
  const internalRows = loadCreativeAnalysisRows(undefined, liveCreatives).filter(r => !advName || r.creative.brand === advName);
  const internal = analyzeHookCta(internalRows);
  const external = externalPatternSummary(scopedObs);
  const recentCut = Date.now() - 30 * 86_400_000;
  const recent = scopedObs.filter(o => +new Date(o.capturedAt) >= recentCut).length;

  return <div className="intel-page">
    <PageHeader title="경쟁사 분석" description="Meta 광고 라이브러리 등 실제 매체 검색과, 직접 등록한 URL·카피·태그를 함께 활용해 경쟁사 소재를 관찰하고 HOWTOM 내부 실제 성과 패턴과 비교합니다." action={<div className="intel-actions"><button className="btn secondary" onClick={() => setAddComp(true)}><Plus size={15} /> 경쟁사 등록</button><button className="btn primary" onClick={() => setAddObs(true)} disabled={!competitors.length}><FilePlus2 size={15} /> 수동으로 소재 추가</button></div>} />
    <MetricsDateBar />
    {error && <div className="intel-source-note" style={{ borderColor: '#f87171' }}><AlertTriangle size={16} /><div><b>불러오기 실패</b><span>{error}</span></div></div>}
    <div className="intel-source-note"><Sparkles size={16} /><div><b>Meta 광고 라이브러리 자동 검색 지원</b><span>경쟁사 카드의 "매체에서 검색" 버튼으로 Meta 공식 광고 라이브러리·Instagram 해시태그를 실시간 검색해 바로 저장할 수 있습니다. 그 외 매체(유튜브·틱톡 등)나 API가 못 찾는 소재는 URL을 직접 등록하세요.</span></div></div>
    <div className="card intel-filters"><select value={advertiserId} onChange={e => { setAdvertiserId(e.target.value); setCompetitorId(''); }}><option value="">광고주 전체</option>{advertisers.filter(a => a.id !== 'default').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><select value={competitorId} onChange={e => setCompetitorId(e.target.value)}><option value="">경쟁사 전체</option>{scopedCompetitors.map(c => <option value={c.competitorId} key={c.competitorId}>{c.name}</option>)}</select><select value={platform} onChange={e => setPlatform(e.target.value)}><option value="">매체 전체</option>{MEDIA.map(x => <option key={x}>{x}</option>)}</select><select value={type} onChange={e => setType(e.target.value)}><option value="">소재 유형 전체</option><option value="image">이미지</option><option value="video">영상</option><option value="copy">카피</option><option value="landing">랜딩</option></select></div>
    <Kpis items={[{ label: '등록 경쟁사', value: scopedCompetitors.length + '곳' }, { label: '저장된 관찰 소재', value: scopedObs.length + '개' }, { label: '최근 30일 등록', value: recent + '개' }, { label: '관찰 후킹', value: external.hooks.length + '종' }, { label: '관찰 CTA', value: external.ctas.length + '종' }]} />
    <div className="intel-grid-2">
      <section className="card intel-panel">
        <div className="intel-panel-head"><div><h3>경쟁사 목록</h3><p>경쟁사 카드에서 바로 실제 매체를 검색하거나 소재를 추가합니다.</p></div></div>
        {loading ? <Empty>불러오는 중...</Empty> : scopedCompetitors.length ? <div className="intel-competitors">{scopedCompetitors.map(c => {
          const s = summarizeCompetitor(c, observations);
          return <article key={c.competitorId}>
            <div><b>{c.name}</b><small>{c.advertiserName || '공통'} · {c.industry || '업종 미지정'}</small></div>
            <span>{s.observationCount}개 관찰</span>
            <em className={c.priority === 'high' ? 'high' : ''}>{c.priority === 'high' ? '핵심' : c.priority === 'low' ? '낮음' : '일반'}</em>
            <button className="btn secondary intel-btn-sm" title="Meta 광고 라이브러리 등에서 검색" onClick={() => setSearchFor(c)}><Search size={13} /> 매체에서 검색</button>
            <button title="수정" onClick={() => setEditComp(c)}>수정</button>
            <button title="삭제" onClick={async () => { if (confirm(`${c.name}의 경쟁사 추적을 중단할까요? (이미 저장된 관찰 소재는 지워지지 않고 연결만 해제됩니다)`)) { await deleteCompetitor(c.competitorId); refresh(); } }}><Trash2 size={14} /></button>
          </article>;
        })}</div> : <Empty>등록된 경쟁사가 없습니다. 광고주별 경쟁사를 먼저 등록하세요.</Empty>}
      </section>
      <section className="card intel-panel">
        <div className="intel-panel-head"><div><h3>우리 광고 vs 경쟁사 관찰 패턴</h3><p>경쟁사가 많이 쓰는 패턴을 그대로 모방하지 않고 HOWTOM 내부 실제 성과와 나란히 봅니다.</p></div></div>
        <div className="intel-compare"><PatternMini title="우리 고성과 후킹" rows={internal.hooks.filter(x => x.confidence.level !== 'insufficient').slice(0, 5).map(x => [x.label, `${x.count}개 · ${x.avgScore?.toFixed(0) || '-'}점`])} /><PatternMini title="경쟁사 관찰 후킹" rows={external.hooks.slice(0, 5).map(([x, n]) => [x, `${n}회 관찰`])} /><PatternMini title="우리 CTA" rows={internal.ctas.slice(0, 5).map(x => [x.label, `${x.count}개 · 유효DB ${pct(x.validDbRate)}`])} /><PatternMini title="경쟁사 CTA" rows={external.ctas.slice(0, 5).map(([x, n]) => [x, `${n}회 관찰`])} /></div>
        {!scopedObs.length && <p className="intel-muted">외부 관찰 데이터가 없어 경쟁사 비교는 아직 활성화되지 않았습니다.</p>}
      </section>
    </div>
    <section className="card intel-panel">
      <div className="intel-panel-head"><div><h3>경쟁사 소재 갤러리</h3><p>실제 성과를 알 수 없는 외부 소재이므로 '고성과'라고 표현하지 않고 관찰 정보만 표시합니다. 여기 저장된 소재는 콘텐츠 &gt; 레퍼런스 라이브러리에도 자동으로 함께 보입니다.</p></div><Link className="btn secondary" to="/content/references">레퍼런스 라이브러리 <ArrowRight size={14} /></Link></div>
      {loading ? <Empty>불러오는 중...</Empty> : scopedObs.length ? <div className="intel-observation-grid">{scopedObs.map(o => <article key={o.observationId}>
        <div className={`intel-observation-preview ${o.creativeType}`}>{o.thumbnailUrl ? <img src={o.thumbnailUrl} alt="" /> : <span>{FORMAT_LABEL[o.creativeType]}</span>}</div>
        <div className="intel-observation-body">
          <div className="intel-badges"><span>{o.competitorName}</span><span>{o.platform}</span><span>{FORMAT_LABEL[o.creativeType]}</span></div>
          <b>{o.headline || '제목 미입력'}</b>{o.body && <p>{o.body}</p>}
          <div className="intel-tags">{o.hookTypes.map(x => <span key={x}>{x}</span>)}{o.cta && <span>CTA {o.cta}</span>}{o.tags.slice(0, 3).map(x => <span key={x}>{x}</span>)}</div>
          <small>관찰일 {date(o.capturedAt)}</small>
          <div className="intel-card-actions">{o.sourceUrl && <a href={o.sourceUrl} target="_blank" rel="noreferrer">원본 <ExternalLink size={13} /></a>}<button className="danger" onClick={async () => { await deleteObservation(o.observationId); refresh(); }}>삭제</button></div>
        </div>
      </article>)}</div> : <Empty>등록된 경쟁사 소재가 없습니다. 위 "매체에서 검색"으로 자동 검색하거나 URL을 직접 등록하세요.</Empty>}
    </section>
    {addComp && <CompetitorModal advertisers={advertisers.filter(a => a.id !== 'default')} onClose={() => setAddComp(false)} onSaved={refresh} />}
    {editComp && <CompetitorModal advertisers={advertisers.filter(a => a.id !== 'default')} initial={editComp} onClose={() => setEditComp(null)} onSaved={refresh} />}
    {addObs && <ObservationModal competitors={competitors} onClose={() => setAddObs(false)} onSaved={refresh} />}
    {searchFor && <ConnectorSearchModal competitor={searchFor} onClose={() => setSearchFor(null)} onSaved={refresh} />}
  </div>;
}

function PatternMini({ title, rows }: { title: string; rows: [string, string][] }) {
  return <div className="intel-pattern-mini"><h4>{title}</h4>{rows.length ? rows.map(([a, b], i) => <div key={`${a}-${i}`}><b>{a}</b><small>{b}</small></div>) : <span>데이터 부족</span>}</div>;
}

function CompetitorModal({ advertisers, onClose, initial, onSaved }: { advertisers: { id: string; name: string }[]; onClose: () => void; initial?: Competitor; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const aid = String(f.get('advertiserId') || '');
    const payload = {
      advertiserId: aid || undefined,
      name: String(f.get('name') || ''),
      industry: String(f.get('industry') || ''),
      websiteUrl: String(f.get('websiteUrl') || ''),
      channels: initial?.channels || [],
      priority: String(f.get('priority')) as Competitor['priority'],
      status: String(f.get('status')) as Competitor['status'],
    };
    setSaving(true); setErr('');
    try {
      if (initial) await patchCompetitor(initial.competitorId, payload);
      else await createCompetitor(payload);
      onSaved(); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : '저장에 실패했습니다.'); }
    finally { setSaving(false); }
  }
  return <Modal title={initial ? '경쟁사 수정' : '경쟁사 등록'} description="광고주별 추적 대상을 등록합니다." onClose={onClose}>
    <form className="intel-form" onSubmit={submit}>
      <label>광고주<select name="advertiserId" defaultValue={initial?.advertiserId || ''}><option value="">전사 공통</option>{advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label>경쟁사명<input name="name" required defaultValue={initial?.name || ''} /></label>
      <label>업종<input name="industry" defaultValue={initial?.industry || ''} /></label>
      <label>중요도<select name="priority" defaultValue={initial?.priority || 'normal'}><option value="high">핵심</option><option value="normal">일반</option><option value="low">낮음</option></select></label>
      <label>상태<select name="status" defaultValue={initial?.status || 'active'}><option value="active">추적</option><option value="paused">일시중지</option></select></label>
      <label className="span2">웹사이트 URL<input name="websiteUrl" type="url" placeholder="https://..." defaultValue={initial?.websiteUrl || ''} /></label>
      {err && <p className="intel-muted span2">{err}</p>}
      <footer><button type="button" className="btn secondary" onClick={onClose}>취소</button><button className="btn primary" disabled={saving}>{saving ? '저장 중...' : '저장'}</button></footer>
    </form>
  </Modal>;
}

function ObservationModal({ competitors, onClose, onSaved }: { competitors: Competitor[]; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const cid = String(f.get('competitorId') || '');
    const c = competitors.find(x => x.competitorId === cid);
    if (!c) return;
    const capturedAt = String(f.get('capturedAt') || new Date().toISOString().slice(0, 10));
    setSaving(true); setErr('');
    try {
      await createObservation({
        competitorId: cid, competitorName: c.name, advertiserId: c.advertiserId, advertiserName: c.advertiserName,
        platform: String(f.get('platform')), creativeType: String(f.get('creativeType')) as ExternalCreativeType,
        sourceUrl: String(f.get('sourceUrl') || ''), thumbnailUrl: String(f.get('thumbnailUrl') || ''),
        headline: String(f.get('headline') || ''), body: String(f.get('body') || ''), cta: String(f.get('cta') || ''),
        hookTypes: split(String(f.get('hooks') || '')), tags: split(String(f.get('tags') || '')), memo: String(f.get('memo') || ''),
        capturedAt, firstSeenAt: capturedAt, lastSeenAt: capturedAt,
      });
      onSaved(); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : '저장에 실패했습니다.'); }
    finally { setSaving(false); }
  }
  return <Modal title="경쟁사 관찰 소재 추가" description="자동 검색이 못 찾는 매체는 확인 가능한 URL·카피·태그를 직접 등록합니다." onClose={onClose}>
    <form className="intel-form" onSubmit={submit}>
      <label>경쟁사<select name="competitorId" required>{competitors.map(c => <option key={c.competitorId} value={c.competitorId}>{c.name} · {c.advertiserName || '공통'}</option>)}</select></label>
      <label>매체<select name="platform">{MEDIA.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>소재 유형<select name="creativeType"><option value="image">이미지</option><option value="video">영상</option><option value="copy">카피</option><option value="landing">랜딩</option></select></label>
      <label>관찰일<input name="capturedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
      <label className="span2">원본 URL<input name="sourceUrl" type="url" placeholder="https://..." /></label>
      <label className="span2">썸네일 URL<input name="thumbnailUrl" placeholder="선택 사항" /></label>
      <label className="span2">제목/헤드라인<input name="headline" /></label>
      <label className="span2">본문/카피<textarea name="body" rows={3} /></label>
      <label>후킹 태그<input name="hooks" placeholder="후기형, 가격형" /></label>
      <label>CTA<input name="cta" placeholder="상담 신청" /></label>
      <label className="span2">태그<input name="tags" placeholder="가격, UGC, 인물, 한정" /></label>
      <label className="span2">메모<textarea name="memo" rows={2} /></label>
      {err && <p className="intel-muted span2">{err}</p>}
      <footer><button type="button" className="btn secondary" onClick={onClose}>취소</button><button className="btn primary" disabled={saving}>{saving ? '저장 중...' : '저장'}</button></footer>
    </form>
  </Modal>;
}

type ConnectorStatus = { key: string; platform: string; label: string; implemented: boolean };
type SearchItem = {
  externalId?: string; url?: string; canonicalUrl?: string; title?: string; body?: string; description?: string; cta?: string;
  authorId?: string; authorName?: string; thumbnailUrl?: string; mediaUrl?: string; mediaType?: string; contentType?: string;
  adStatus?: string; adStartedAt?: string; publishedAt?: string; views?: number; likes?: number; comments?: number;
  alreadySaved?: boolean; [k: string]: unknown;
};

/** Meta 광고 라이브러리 / Instagram 해시태그 검색으로 실제 매체 데이터를 바로 저장하는 모달. */
function ConnectorSearchModal({ competitor, onClose, onSaved }: { competitor: Competitor; onClose: () => void; onSaved: () => void }) {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [connectorKey, setConnectorKey] = useState('meta_ads');
  const [query, setQuery] = useState(competitor.name);
  const [country, setCountry] = useState('KR');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [message, setMessage] = useState('');
  const [savingKey, setSavingKey] = useState('');

  useEffect(() => { apiFetch<{ connectors: ConnectorStatus[] }>('/references/connectors/status').then(r => setConnectors(r.connectors || [])).catch(() => {}); }, []);

  const search = useCallback(async () => {
    setLoading(true); setMessage('');
    try {
      const res = await apiFetch<{ items: SearchItem[]; status: string; message?: string; platform: string; referenceType: string }>('/references/search', {
        method: 'POST', body: JSON.stringify({ connector: connectorKey, query, country, limit: 25 }),
      });
      setResults(res.items || []);
      setMessage(res.message || (res.items?.length ? '' : '검색 결과가 없습니다.'));
    } catch (e) {
      setResults([]); setMessage(e instanceof Error ? e.message : '검색에 실패했습니다.');
    } finally { setLoading(false); }
  }, [connectorKey, query, country]);

  // 모달을 열면 경쟁사명으로 바로 한 번 검색해봅니다.
  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(item: SearchItem) {
    const key = item.externalId || item.url || item.title || '';
    setSavingKey(key);
    try {
      const meta = connectors.find(c => c.key === connectorKey);
      await apiFetch('/references', {
        method: 'POST',
        body: JSON.stringify({
          advertiserId: competitor.advertiserId, competitorId: competitor.competitorId,
          platform: meta?.platform || 'meta', referenceType: meta?.platform === 'meta' ? 'ADVERTISEMENT' : 'ORGANIC_CONTENT',
          sourceType: 'collected', item,
        }),
      });
      setResults(prev => prev.map(r => r === item ? { ...r, alreadySaved: true } : r));
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally { setSavingKey(''); }
  }

  const activeConnector = connectors.find(c => c.key === connectorKey);
  return <Modal title={`${competitor.name} · 매체에서 검색`} description="공식 API로 실제 데이터를 검색해 관찰 소재로 바로 저장합니다." onClose={onClose} wide>
    <div className="intel-search-bar">
      <select value={connectorKey} onChange={e => setConnectorKey(e.target.value)}>
        <option value="meta_ads">Meta 광고 라이브러리</option>
        <option value="instagram_organic">Instagram (해시태그)</option>
      </select>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="검색어(페이지명·해시태그)" onKeyDown={e => e.key === 'Enter' && search()} />
      {connectorKey === 'meta_ads' && <select value={country} onChange={e => setCountry(e.target.value)}><option value="KR">대한민국</option><option value="US">미국</option><option value="JP">일본</option></select>}
      <button className="btn primary" onClick={search} disabled={loading}>{loading ? '검색 중...' : '검색'}</button>
    </div>
    {activeConnector && !activeConnector.implemented && <p className="intel-muted">이 커넥터는 아직 준비되지 않았습니다.</p>}
    {message && <p className="intel-muted">{message}</p>}
    <div className="intel-search-results">
      {results.map((item, i) => {
        const key = item.externalId || item.url || item.title || String(i);
        return <article key={key} className="intel-search-item">
          <div className="intel-search-thumb">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <span>미리보기 없음</span>}</div>
          <div className="intel-search-body">
            <b>{item.title || item.authorName || '제목 없음'}</b>
            {item.authorName && item.title && <small>{item.authorName}</small>}
            {(item.body || item.description) && <p>{(item.body || item.description || '').slice(0, 120)}</p>}
            {item.adStartedAt && <small>집행 시작 {date(item.adStartedAt)} · {item.adStatus === 'active' ? '진행중' : '종료'}</small>}
          </div>
          <div className="intel-search-actions">
            {item.url && <a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 원본</a>}
            <button className="btn secondary" onClick={() => save(item)} disabled={item.alreadySaved || savingKey === key}>
              {item.alreadySaved ? '저장됨' : savingKey === key ? '저장 중...' : '관찰 소재로 저장'}
            </button>
          </div>
        </article>;
      })}
    </div>
  </Modal>;
}

// ============================================================
// 광고 트렌드
// ============================================================
export function AdTrendsPage() {
  const { competitors, observations, loading } = useCompetitorData();
  const [advertisers] = useAdvertisers();
  const [advertiserId, setAdvertiserId] = useState('');
  const [industry, setIndustry] = useState('');
  const [platform, setPlatform] = useState('');
  const [days, setDays] = useState(30);
  const liveCreatives = useLiveCreatives();

  const allowed = new Set(competitors.filter(c => (!advertiserId || c.advertiserId === advertiserId) && (!industry || c.industry === industry)).map(c => c.competitorId));
  const rows = observations.filter(o => allowed.has(o.competitorId) && (!platform || o.platform === platform));
  const trends = buildTrendSignals(rows, days);
  const rising = trends.filter(x => x.status === 'rising' || x.status === 'emerging');
  const declining = trends.filter(x => x.status === 'declining');
  const advName = advertisers.find(a => a.id === advertiserId)?.name || '';
  const internal = analyzeHookCta(loadCreativeAnalysisRows(undefined, liveCreatives).filter(r => !advName || r.creative.brand === advName));
  const industries = [...new Set(competitors.map(c => c.industry).filter(Boolean))] as string[];
  const { sorted: sortedTrends, toggleSort: toggleTrendSort, arrow: trendArrow } = useSortableRows(trends, 'currentCount', (r, k) => k === 'growthRate' ? (r.growthRate ?? 0) : k === 'value' ? r.value : (r as any)[k] ?? 0);

  return <div className="intel-page">
    <PageHeader title="광고 트렌드" description="저장된 경쟁사·업계 관찰 데이터를 집계해 시장에서 늘고 줄고 있는 패턴을 봅니다. 외부 사용 빈도와 HOWTOM 내부 실제 성과는 분리해 표시합니다." />
    <MetricsDateBar />
    <div className="intel-source-note"><AlertTriangle size={16} /><div><b>시장 전체를 대표하는 통계가 아닙니다</b><span>현재 트렌드는 HOWTOM에 저장된 관찰 표본만 집계합니다. 비교기간·경쟁사 수가 부족하면 트렌드를 확정하지 않고 '데이터 부족'으로 표시합니다.</span></div></div>
    <div className="card intel-filters"><select value={advertiserId} onChange={e => setAdvertiserId(e.target.value)}><option value="">광고주 전체</option>{advertisers.filter(a => a.id !== 'default').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><select value={industry} onChange={e => setIndustry(e.target.value)}><option value="">업종 전체</option>{industries.map(x => <option key={x}>{x}</option>)}</select><select value={platform} onChange={e => setPlatform(e.target.value)}><option value="">매체 전체</option>{MEDIA.map(x => <option key={x}>{x}</option>)}</select><select value={days} onChange={e => setDays(Number(e.target.value))}><option value={30}>최근 30일 vs 직전 30일</option><option value={60}>최근 60일 vs 직전 60일</option></select></div>
    <Kpis items={[{ label: '분석 관찰 소재', value: rows.length + '개' }, { label: '관찰 경쟁사', value: new Set(rows.map(x => x.competitorId)).size + '곳' }, { label: '상승/신규 패턴', value: rising.length + '개' }, { label: '하락 패턴', value: declining.length + '개' }, { label: '신뢰도 높은 패턴', value: trends.filter(x => x.confidenceLabel === '높음').length + '개' }]} />
    {loading ? <Empty>불러오는 중...</Empty> : !rows.length ? <section className="card intel-panel"><Empty>관찰 데이터가 없습니다. 경쟁사 분석에서 소재를 등록한 뒤 트렌드를 확인하세요.<br /><Link to="/insights/competitors">경쟁사 분석으로 이동</Link></Empty></section> : <>
      <div className="intel-grid-2"><TrendSection title="상승 신규 트렌드" rows={rising.slice(0, 10)} icon="up" internal={internal} /><TrendSection title="하락 트렌드" rows={declining.slice(0, 10)} icon="down" internal={internal} /></div>
      <section className="card intel-panel"><div className="intel-panel-head"><div><h3>시장 관찰 패턴 전체</h3><p>후킹·CTA·포맷·메시지별 관찰 비중과 비교기간을 함께 표시합니다.</p></div></div><div className="intel-trend-table"><table><thead><tr>
        <th>분류</th>
        <th className="sortable-th" onClick={() => toggleTrendSort('value')}>패턴{trendArrow('value')}</th>
        <th className="sortable-th" onClick={() => toggleTrendSort('currentCount')}>현재{trendArrow('currentCount')}</th>
        <th className="sortable-th" onClick={() => toggleTrendSort('previousCount')}>직전{trendArrow('previousCount')}</th>
        <th className="sortable-th" onClick={() => toggleTrendSort('growthRate')}>증감{trendArrow('growthRate')}</th>
        <th className="sortable-th" onClick={() => toggleTrendSort('competitorCoverage')}>경쟁사{trendArrow('competitorCoverage')}</th>
        <th>신뢰도</th><th>판정</th>
      </tr></thead><tbody>{sortedTrends.slice(0, 40).map(t => <tr key={t.trendId}><td>{trendCategory(t)}</td><td><b>{t.value}</b></td><td>{t.currentCount}회 · {pct(t.currentShare)}</td><td>{t.previousCount}회 · {pct(t.previousShare)}</td><td className={(t.growthRate ?? 0) > 0 ? 'up metric-positive' : (t.growthRate ?? 0) < 0 ? 'down metric-negative' : ''}>{t.growthRate === undefined ? '-' : `${t.growthRate > 0 ? '+' : ''}${t.growthRate.toFixed(0)}%`}</td><td>{t.competitorCoverage}곳</td><td>{t.confidenceLabel}</td><td><span className={`intel-trend-state ${t.status}`}>{trendStatus(t)}</span></td></tr>)}</tbody></table></div></section></>}
  </div>;
}
function trendCategory(t: TrendSignal) { return t.category === 'hook' ? '후킹' : t.category === 'cta' ? 'CTA' : t.category === 'format' ? '포맷' : t.category === 'message' ? '메시지' : '비주얼'; }
function trendStatus(t: TrendSignal) { return t.status === 'emerging' ? '신규' : t.status === 'rising' ? '상승' : t.status === 'declining' ? '하락' : t.status === 'stable' ? '유지' : '데이터 부족'; }
function internalMatch(t: TrendSignal, internal: ReturnType<typeof analyzeHookCta>) { if (t.category === 'hook') return internal.hooks.find(x => x.label === t.value); if (t.category === 'cta') return internal.ctas.find(x => x.label === t.value); return undefined; }
function TrendSection({ title, rows, icon, internal }: { title: string; rows: TrendSignal[]; icon: 'up' | 'down'; internal: ReturnType<typeof analyzeHookCta> }) {
  return <section className="card intel-panel"><div className="intel-panel-head"><div><h3>{title}</h3><p>외부 사용 빈도와 내부 광고 성과를 혼용하지 않습니다.</p></div></div>{rows.length ? <div className="intel-trend-cards">{rows.map(t => { const match = internalMatch(t, internal); return <article key={t.trendId}>{icon === 'up' ? <TrendingUp /> : <TrendingDown />}<div><b>{t.value}</b><small>{trendCategory(t)} · 현재 {t.currentCount}회 · 경쟁사 {t.competitorCoverage}곳</small><span>시장 관찰 {t.growthRate === undefined ? '신규/비교불가' : `${t.growthRate > 0 ? '+' : ''}${t.growthRate.toFixed(0)}%`}</span>{match ? <span>HOWTOM 내부 성과 {match.avgScore?.toFixed(0) || '-'}점 · 신뢰도 {match.confidence.label}</span> : <span>HOWTOM 내부 비교 데이터 없음</span>}</div><em>{t.confidenceLabel}</em></article>; })}</div> : <Empty>표본 기준을 충족한 패턴이 없습니다.</Empty>}</section>;
}

// ============================================================
// 후킹·CTA 분석 (전적으로 우리 내부 성과 데이터 기반 - 경쟁사 데이터와 무관, 변경 없음)
// ============================================================
export function HookCtaAnalysisPage() {
  const navigate = useNavigate();
  const [advertiser, setAdvertiser] = useState('');
  const [media, setMedia] = useState('');
  const [campaign, setCampaign] = useState('');
  const [type, setType] = useState('');
  const [mode, setMode] = useState<'hook' | 'cta'>('hook');
  const liveCreatives = useLiveCreatives();

  const all = loadCreativeAnalysisRows(undefined, liveCreatives);
  const advertisers = [...new Set(all.map(r => r.creative.brand))].sort();
  const medias = [...new Set(all.filter(r => !advertiser || r.creative.brand === advertiser).map(r => normalizeCreativeMedia(r.creative.platform)))].sort();
  const campaigns = [...new Set(all.filter(r => (!advertiser || r.creative.brand === advertiser) && (!media || normalizeCreativeMedia(r.creative.platform) === media)).map(r => r.campaignName).filter(x => x && x !== '-'))].sort();
  const types = [...new Set(all.map(r => r.creative.type))];
  const rows = all.filter(r => (!advertiser || r.creative.brand === advertiser) && (!media || normalizeCreativeMedia(r.creative.platform) === media) && (!campaign || r.campaignName === campaign) && (!type || r.creative.type === type));
  const analysis = analyzeHookCta(rows);
  const ranked = mode === 'hook' ? analysis.hooks : analysis.ctas;
  const reliable = ranked.filter(x => x.confidence.level === 'high' || x.confidence.level === 'medium');
  const best = reliable[0];
  const { sorted: sortedRanked, toggleSort: toggleRankSort, arrow: rankArrow } = useSortableRows(ranked, 'spend', (r, k) => k === 'ctr' ? r.ctr : k === 'cpa' ? (r.cpa ?? 0) : k === 'roas' ? (r.roas ?? 0) : (r as any)[k] ?? 0);

  function createFromPattern(p: HookCtaAggregate) {
    const source = rows.filter(r => p.creativeIds.includes(r.creative.id)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    if (!source) return;
    saveCreativeBrief({ sourceCreativeId: source.creative.id, advertiserName: source.creative.brand, campaignId: source.creative.campaignId, campaignName: source.campaignName, creativeType: source.creative.type, winningElements: [p.label, `표본 ${p.count}개`, `신뢰도 ${p.confidence.label}`], weakElements: [], recommendedHook: p.hook || source.hookTypes[0], recommendedCta: p.cta || source.cta, objectiveMetric: source.kpiLabel, createdAt: new Date().toISOString() });
    navigate(`/content/ad-creation?sourceCreative=${encodeURIComponent(source.creative.id)}`);
  }
  function sendAiSignal(p: HookCtaAggregate) {
    sessionStorage.setItem('howtom-hook-cta-signal-v1', JSON.stringify({ label: p.label, kind: p.kind, advertiser, media, count: p.count, avgScore: p.avgScore, validDbRate: p.validDbRate, cpa: p.cpa, confidence: p.confidence.label, createdAt: new Date().toISOString() }));
    navigate(`/insights/ai-recommendations${advertiser ? `?advertiser=${encodeURIComponent(advertiser)}` : ''}`);
  }

  return <div className="intel-page">
    <PageHeader title="후킹 CTA 분석" description="소재 DB의 실제 CTR·DB·유효DB·계약·ROAS를 후킹과 CTA별로 집계합니다. 클릭률 하나로 성공 패턴을 단정하지 않고 표본 신뢰도를 함께 봅니다." />
    <MetricsDateBar />
    <div className="card intel-filters"><select value={advertiser} onChange={e => { setAdvertiser(e.target.value); setMedia(''); setCampaign(''); }}><option value="">광고주 전체</option>{advertisers.map(x => <option key={x}>{x}</option>)}</select><select value={media} onChange={e => { setMedia(e.target.value); setCampaign(''); }}><option value="">매체 전체</option>{medias.map(x => <option key={x}>{x}</option>)}</select><select value={campaign} onChange={e => setCampaign(e.target.value)}><option value="">캠페인 전체</option>{campaigns.map(x => <option key={x}>{x}</option>)}</select><select value={type} onChange={e => setType(e.target.value)}><option value="">소재 유형 전체</option>{types.map(x => <option key={x}>{x}</option>)}</select></div>
    <Kpis items={[{ label: '분석 가능 소재', value: analysis.eligible.length + '개' }, { label: '후킹 유형', value: analysis.hooks.length + '개' }, { label: 'CTA 유형', value: analysis.ctas.length + '개' }, { label: '충분한 표본', value: analysis.hooks.filter(x => x.confidence.level === 'high' || x.confidence.level === 'medium').length + '개' }, { label: '데이터 부족', value: analysis.hooks.filter(x => x.confidence.level === 'insufficient').length + '개' }]} />
    {best && <section className="card intel-highlight"><Sparkles size={22} /><div><small>현재 조건의 성과 우수 패턴</small><h3>{best.label}</h3><p>평균 성과점수 {best.avgScore?.toFixed(0) || '-'}점 · 소재 {best.count}개 · 신뢰도 {best.confidence.label}. 인과관계가 아니라 관찰된 성과 패턴입니다.</p></div><button className="btn primary" onClick={() => createFromPattern(best)}><Wand2 size={15} /> 이 패턴으로 제작</button></section>}
    <div className="intel-tabs"><button className={mode === 'hook' ? 'active' : ''} onClick={() => setMode('hook')}>후킹 성과</button><button className={mode === 'cta' ? 'active' : ''} onClick={() => setMode('cta')}>CTA 성과</button></div>
    <section className="card intel-panel"><div className="intel-panel-head"><div><h3>{mode === 'hook' ? '후킹 성과 랭킹' : 'CTA 성과 랭킹'}</h3><p>광고 목적이 다른 데이터가 섞일 수 있으므로 광고주·매체·캠페인 필터로 동일 조건을 좁혀 해석하세요.</p></div></div>{ranked.length ? <div className="intel-hook-table"><table><thead><tr>
      <th>패턴</th>
      <th className="sortable-th" onClick={() => toggleRankSort('count')}>소재{rankArrow('count')}</th>
      <th className="sortable-th" onClick={() => toggleRankSort('spend')}>광고비{rankArrow('spend')}</th>
      <th className="sortable-th" onClick={() => toggleRankSort('ctr')}>CTR{rankArrow('ctr')}</th>
      <th className="sortable-th" onClick={() => toggleRankSort('db')}>DB{rankArrow('db')}</th>
      <th className="sortable-th" onClick={() => toggleRankSort('cpa')}>CPA{rankArrow('cpa')}</th>
      <th>유효DB율</th><th>계약률</th>
      <th className="sortable-th" onClick={() => toggleRankSort('roas')}>ROAS{rankArrow('roas')}</th>
      <th>신뢰도</th><th>반복성</th><th></th>
    </tr></thead><tbody>{sortedRanked.map(p => <tr key={p.key} className={p.confidence.level === 'insufficient' ? 'muted' : ''}><td><b>{p.label}</b><small>{p.advertiserCount}광고주 · {p.mediaCount}매체 · {p.campaignCount}캠페인</small></td><td>{p.count}</td><td className="metric-emphasis">{money(p.spend)}</td><td>{pct(p.ctr, 2)}</td><td><b>{p.db || '-'}</b></td><td>{p.cpa ? money(p.cpa) : '-'}</td><td>{p.db ? pct(p.validDbRate) : '-'}</td><td>{p.contracts ? pct(p.contractRate) : '-'}</td><td className={p.revenue && p.roas >= 2 ? 'metric-positive' : p.revenue && p.roas < 1 ? 'metric-negative' : ''}>{p.revenue ? pct(p.roas) : '-'}</td><td><span className={`intel-confidence ${p.confidence.level}`}>{p.confidence.label}</span></td><td>{p.reliability}</td><td><button onClick={() => createFromPattern(p)} disabled={p.confidence.level === 'insufficient'}>제작</button></td></tr>)}</tbody></table></div> : <Empty>분석 가능한 소재 데이터가 없습니다.</Empty>}</section>
    <div className="intel-grid-2"><section className="card intel-panel"><div className="intel-panel-head"><div><h3>후킹 × CTA 조합</h3><p>CTR뿐 아니라 DB 품질·계약까지 함께 확인합니다.</p></div></div><div className="intel-pair-list">{analysis.matrix.slice(0, 12).map(p => <article key={p.key}><div><b>{p.label}</b><small>{p.count}개 소재 · 신뢰도 {p.confidence.label}</small></div><span>CTR {pct(p.ctr, 2)}</span><span>CPA {p.cpa ? money(p.cpa) : '-'}</span><span>유효DB {p.db ? pct(p.validDbRate) : '-'}</span><button onClick={() => createFromPattern(p)} disabled={p.confidence.level === 'insufficient'}><Wand2 size={13} /></button></article>)}</div></section>
      <section className="card intel-panel"><div className="intel-panel-head"><div><h3>분석 해석 가이드</h3><p>통계적 착시를 줄이기 위한 신뢰도·반복성 기준입니다.</p></div></div><div className="intel-guide"><div><b>표본 신뢰도</b><p>소재 수·광고비·클릭·DB·광고주/캠페인 분산을 함께 평가합니다.</p></div><div><b>패턴 반복성</b><p>한 캠페인 하나가 평균을 끌어올린 경우보다 여러 광고주·매체에서 반복된 패턴을 높게 봅니다.</p></div><div><b>성과 우수 패턴</b><p>'성공 공식'으로 표현하지 않고 현재 연결된 데이터에서 관찰된 우수 패턴으로만 사용합니다.</p></div></div>{best && <div className="intel-ai-link"><button className="btn secondary" onClick={() => sendAiSignal(best)}><Sparkles size={15} /> AI 추천으로 보내기</button></div>}</section></div>
    <section className="card intel-panel"><div className="intel-panel-head"><div><h3>매체별 후킹 차이</h3><p>같은 후킹이 매체마다 다르게 작동할 수 있어 상위 패턴을 분리합니다.</p></div></div><div className="intel-media-patterns">{[...new Set(rows.map(r => normalizeCreativeMedia(r.creative.platform)))].map(m => { const a = analyzeHookCta(rows.filter(r => normalizeCreativeMedia(r.creative.platform) === m)), p = a.hooks.find(x => x.confidence.level !== 'insufficient') || a.hooks[0]; return <article key={m}><b>{m}</b>{p ? <><strong>{p.label}</strong><small>{p.count}개 · CTR {pct(p.ctr, 2)} · 신뢰도 {p.confidence.label}</small></> : <small>데이터 부족</small>}</article>; })}</div></section>
  </div>;
}
