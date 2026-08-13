import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, KeyRound, Plus, RefreshCw, Search, X, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CHANNELS, Channel } from '../data/advertisers';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { apiFetch } from '../hooks/useApi';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const CHANNEL_META: Record<Channel, { label: string; color: string; abbr: string; implemented: boolean }> = {
  Meta:   { label: 'Meta Marketing API',  color: '#2563eb', abbr: 'M', implemented: true },
  네이버: { label: '네이버 검색광고',     color: '#16a34a', abbr: 'N', implemented: false },
  구글:   { label: '구글 광고',            color: '#ef4444', abbr: 'G', implemented: false },
  당근:   { label: '당근 광고',            color: '#f97316', abbr: '당', implemented: false },
  틱톡:   { label: 'TikTok Ads',           color: '#111827', abbr: 'T', implemented: false },
  카카오: { label: '카카오 광고',          color: '#eab308', abbr: 'K', implemented: false },
};

const CH_KEY_MAP: Record<Channel, string> = {
  Meta: 'meta', 네이버: 'naver', 구글: 'google',
  당근: 'daangn', 틱톡: 'tiktok', 카카오: 'kakao',
};

export function AdAccountsPage() {
  const [advertisers, , reload] = useAdvertisers();
  const { filterValue } = useAdvertiserFilter();
  const [query,          setQuery]          = useState('');
  const [selectedId,     setSelectedId]     = useState(() => advertisers[0]?.id ?? '');
  const [connectTarget,  setConnectTarget]  = useState<{ channel: Channel; adId: string } | null>(null);
  const [metaAccounts,   setMetaAccounts]   = useState<{id:string;name:string;account_id:string}[]>([]);
  const [metaSelected,   setMetaSelected]   = useState('');
  const [metaLoading,    setMetaLoading]    = useState(false);
  const [metaError,      setMetaError]      = useState('');
  const [toast,          setToast]          = useState('');
  const [syncing,        setSyncing]        = useState('');

  const filtered = useMemo(
    () => advertisers.filter(a => a.name.includes(query.trim()) && matchesAdvertiserFilter(a.name, filterValue)),
    [advertisers, query, filterValue],
  );

  useEffect(() => {
    if (!filterValue.trim()) return;
    const match = advertisers.find(a => matchesAdvertiserFilter(a.name, filterValue));
    if (match) setSelectedId(match.id);
  }, [filterValue, advertisers]);

  const selected = advertisers.find(a => a.id === selectedId) ?? advertisers[0];

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2600); };

  const openConnect = (channel: Channel, adId: string) => {
    setConnectTarget({ channel, adId }); setMetaAccounts([]); setMetaSelected(''); setMetaError('');
  };

  const loadMetaAccounts = async () => {
    setMetaLoading(true); setMetaError('');
    try {
      const result = await apiFetch<{ accounts: { id: string; name: string; account_id: string }[] }>('/integrations/meta/accounts');
      setMetaAccounts(result.accounts || []);
    } catch (error) { setMetaError(error instanceof Error ? error.message : 'Meta 계정 목록을 불러오지 못했습니다.'); }
    setMetaLoading(false);
  };

  /** 계정을 선택해 실제로 저장하고, 곧바로 최근 데이터를 동기화합니다. */
  const connect = async () => {
    if (!connectTarget || !metaSelected) return;
    const { channel, adId } = connectTarget;
    const channelKey = CH_KEY_MAP[channel];
    const picked = metaAccounts.find(a => a.account_id === metaSelected);
    try {
      await apiFetch(`/advertisers/${encodeURIComponent(adId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ accounts: [{ channel: channelKey, status: 'connected', account_id: metaSelected }] }),
      });
      await apiFetch(`/integrations/sync`, { method: 'POST', body: JSON.stringify({ advertiserId: adId, channel: channelKey }) });
      await reload();
      showToast(`${picked?.name ?? metaSelected} 계정이 연결되고 최근 데이터가 동기화되었습니다.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '연동에 실패했습니다.');
    } finally {
      setConnectTarget(null);
    }
  };

  const sync = async (channel: Channel) => {
    if (!selected) return;
    setSyncing(channel);
    try {
      const result = await apiFetch<{ ok: boolean; count: number }>('/integrations/sync', {
        method: 'POST', body: JSON.stringify({ advertiserId: selected.id, channel: CH_KEY_MAP[channel] }),
      });
      showToast(`${channel} 동기화 완료 · ${result.count}일치 데이터`);
      await reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '동기화에 실패했습니다.');
    }
    setSyncing('');
  };

  const disconnect = async (channel: Channel) => {
    if (!selected) return;
    if (!confirm('연결을 해제할까요?')) return;
    const remaining = selected.links.filter(l => l.channel !== channel && l.status === '연결됨').map(l => ({ channel: CH_KEY_MAP[l.channel], status: 'connected', account_id: l.accountId }));
    try {
      await apiFetch(`/advertisers/${encodeURIComponent(selected.id)}`, { method: 'PATCH', body: JSON.stringify({ accounts: remaining }) });
      await reload();
    } catch (error) { showToast(error instanceof Error ? error.message : '연결 해제에 실패했습니다.'); }
  };

  return (
    <>
      <PageHeader
        title="광고계정 연동"
        description="매체별 광고계정과 브랜드를 연결하고 API 동기화 상태를 관리합니다."
        action={<Link className="btn primary" to="/advertisers"><Plus size={15} /> 광고주 등록</Link>}
      />

      <div className="account-layout">
        {/* 광고주 목록 */}
        <aside className="card account-advertiser-list">
          <div className="account-search">
            <Search size={15} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="광고주 검색" />
          </div>
          {filtered.map(a => (
            <button
              key={a.id}
              className={selected?.id === a.id ? 'active' : ''}
              onClick={() => setSelectedId(a.id)}
            >
              <span style={{ background: a.color }}>{a.initial}</span>
              <div>
                <b>{a.name}</b>
                <small>{a.links.filter(l => l.status === '연결됨').length}개 채널 연동</small>
              </div>
            </button>
          ))}
        </aside>

        {/* 채널별 연동 카드 */}
        <main className="account-main">
          {toast && <div className="save-toast"><CheckCircle2 size={16} />{toast}</div>}

          {selected && CHANNELS.map(channel => {
            const link = selected.links.find(l => l.channel === channel)!;
            const meta = CHANNEL_META[channel];
            return (
              <section
                key={channel}
                className={`card account-channel-card ${link.status === '연결됨' ? 'connected' : ''}`}
              >
                <div className="account-channel-head">
                  <div className="account-channel-title">
                    <span className="account-channel-icon" style={{ background: meta.color }}>{meta.abbr}</span>
                    <div>
                      <h3>{meta.label} 연동</h3>
                      <p>{link.status === '연결됨'
                        ? `연결 성공 — ${link.accountName ?? '광고계정'}`
                        : '연결된 광고계정이 없습니다.'}
                      </p>
                    </div>
                  </div>
                  <span className={`status-pill ${link.status === '연결됨' ? 'success' : 'warning'}`}>
                    {link.status}
                  </span>
                </div>

                {link.status === '연결됨' ? (
                  <div className="account-sync-box">
                    <div>
                      <b>동기화 상태</b>
                      <p>
                        <span className="status-pill success">{selected.name}</span>
                        {' '}{link.accountId} · 마지막 동기화 {link.lastSync}
                      </p>
                    </div>
                    <div className="account-sync-actions">
                      <button className="btn secondary" onClick={() => alert(`${channel} 캠페인 미리보기`)}>
                        캠페인 키워드 미리보기
                      </button>
                      <button className="btn secondary" onClick={() => sync(channel)}>
                        <RefreshCw size={14} className={syncing === channel ? 'is-spinning' : ''} />
                        {syncing === channel ? '동기화 중' : '동기화'}
                      </button>
                      <button className="btn danger" onClick={() => disconnect(channel)}>
                        연결 해제
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="account-empty-connect">
                    {meta.implemented ? (
                      <>
                        <p>Meta 계정을 선택해 연결하면 즉시 최근 데이터가 동기화됩니다.</p>
                        <button className="btn primary" onClick={() => openConnect(channel, selected.id)}>
                          <KeyRound size={15} /> 연결 설정
                        </button>
                      </>
                    ) : (
                      <p className="muted">이 매체 커넥터는 아직 준비 중입니다. (Meta부터 순서대로 연결됩니다)</p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </main>
      </div>

      {/* 연동 모달 */}
      {connectTarget && (
        <div className="modal-backdrop" onClick={() => setConnectTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>{CHANNEL_META[connectTarget.channel].label} 연결</h3>
                <p>연결된 광고계정 목록을 불러와 선택합니다.</p>
              </div>
              <button className="icon-btn" onClick={() => setConnectTarget(null)}><X size={18} /></button>
            </div>
            <button type="button" className="btn secondary" onClick={loadMetaAccounts} disabled={metaLoading}>
              <Sparkles size={14} /> {metaLoading ? '불러오는 중...' : '연결된 계정 불러오기'}
            </button>
            {metaError && <div className="final-form-meta-error">{metaError}</div>}
            {!!metaAccounts.length && (
              <label className="field-label" style={{ marginTop: 12 }}>
                광고계정 선택
                <select value={metaSelected} onChange={e => setMetaSelected(e.target.value)}>
                  <option value="">선택 안 함</option>
                  {metaAccounts.map(a => <option key={a.id} value={a.account_id}>{a.name} ({a.id})</option>)}
                </select>
              </label>
            )}
            <div className="api-help">
              System User Access Token은 서버 환경변수(META_ACCESS_TOKEN)로만 보관됩니다. 계정을 연결하면 즉시 최근 90일 데이터를 자동으로 가져옵니다.
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setConnectTarget(null)}>취소</button>
              <button className="btn primary" onClick={connect} disabled={!metaSelected}>
                연결 및 데이터 동기화
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
