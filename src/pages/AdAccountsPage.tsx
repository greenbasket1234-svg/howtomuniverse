import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, KeyRound, Plus, RefreshCw, Search, X, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CHANNELS, Channel, type StoreLink } from '../data/advertisers';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { apiFetch } from '../hooks/useApi';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const CHANNEL_META: Record<Channel, { label: string; color: string; abbr: string; implemented: boolean }> = {
  Meta:   { label: 'Meta Marketing API',  color: '#2563eb', abbr: 'M', implemented: true },
  네이버: { label: '네이버 검색광고',     color: '#16a34a', abbr: 'N', implemented: true },
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
  const [naverForm,      setNaverForm]      = useState({ customerId: '', apiKey: '', secretKey: '' });
  const [naverSaving,    setNaverSaving]    = useState(false);
  const [toast,          setToast]          = useState('');
  const [syncing,        setSyncing]        = useState('');
  const [autoSyncStatus, setAutoSyncStatus] = useState<{enabled:boolean;hoursKst:number[];lastRunAt:string|null;lastResult:{total:number;success:number;failed:number}|null}|null>(null);

  // 카페24 연동 상태
  const [cafe24Form,     setCafe24Form]     = useState({ mallId: '', clientId: '', clientSecret: '' });
  const [cafe24Saving,   setCafe24Saving]   = useState(false);
  const [cafe24Testing,  setCafe24Testing]  = useState(false);
  // 네이버 스마트스토어 연동 상태
  const [storeForm,      setStoreForm]      = useState({ clientId: '', clientSecret: '' });
  const [storeSaving,    setStoreSaving]    = useState(false);
  const [storeTesting,   setStoreTesting]   = useState(false);
  useEffect(() => {
    const load = () => apiFetch<typeof autoSyncStatus>('/integrations/auto-sync-status').then(setAutoSyncStatus).catch(() => {});
    load();
    // 자동 동기화는 하루에 5번(7,9,14,17,19시) 실행되는데, 예전에는 페이지를 열 때 딱 한 번만
    // 조회해서 그 뒤로는 뒤에서 실제로 실행되고 갱신돼도 화면에는 절대 반영되지 않는 문제가
    // 있었습니다("실행은 되는데 기록만 안 남아있어"). 1분마다 다시 불러오고, 다른 탭에 있다가
    // 이 페이지로 돌아왔을 때도 즉시 최신값을 반영합니다.
    const interval = setInterval(load, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

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
    setNaverForm({ customerId: '', apiKey: '', secretKey: '' });
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
  const [metaConnecting, setMetaConnecting] = useState(false);
  const connect = async () => {
    if (!connectTarget) { showToast('연결 대상 정보가 없습니다. 창을 닫고 다시 열어주세요.'); return; }
    if (!metaSelected) { showToast('광고계정을 먼저 선택해주세요.'); return; }
    const { channel, adId } = connectTarget;
    const channelKey = CH_KEY_MAP[channel];
    const picked = metaAccounts.find(a => a.account_id === metaSelected);
    setMetaConnecting(true);
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
      setMetaConnecting(false);
      setConnectTarget(null);
    }
  };

  /** 네이버는 광고주마다 CUSTOMER_ID/API Key/Secret Key가 전부 다르므로, 직접 입력받아 저장합니다. */
  const connectNaver = async () => {
    if (!connectTarget) return;
    const { adId } = connectTarget;
    const { customerId, apiKey, secretKey } = naverForm;
    if (!customerId.trim() || !apiKey.trim() || !secretKey.trim()) { showToast('CUSTOMER_ID, API Key, Secret Key를 모두 입력해주세요.'); return; }
    setNaverSaving(true);
    try {
      await apiFetch(`/advertisers/${encodeURIComponent(adId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ accounts: [{ channel: 'naver', status: 'connected', account_id: customerId.trim(), api_key: apiKey.trim(), secret_key: secretKey.trim() }] }),
      });
      await apiFetch(`/integrations/sync`, { method: 'POST', body: JSON.stringify({ advertiserId: adId, channel: 'naver' }) });
      await reload();
      showToast('네이버 계정이 연결되고 최근 데이터가 동기화되었습니다.');
      setConnectTarget(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '네이버 연동에 실패했습니다.');
    } finally {
      setNaverSaving(false);
    }
  };

  /** 카페24: mall_id + client_id + client_secret → OAuth client_credentials */
  const connectCafe24 = async (adId: string) => {
    const { mallId, clientId, clientSecret } = cafe24Form;
    if (!mallId.trim() || !clientId.trim() || !clientSecret.trim()) { showToast('쇼핑몰 ID, Client ID, Client Secret을 모두 입력해주세요.'); return; }
    setCafe24Saving(true);
    try {
      await apiFetch(`/advertisers/${encodeURIComponent(adId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ accounts: [{ channel: 'cafe24', status: 'connected', account_id: mallId.trim(), api_key: clientId.trim(), secret_key: clientSecret.trim() }] }),
      });
      await apiFetch('/integrations/sync-cafe24', { method: 'POST', body: JSON.stringify({ advertiserId: adId }) });
      await reload();
      showToast('카페24 계정이 연결되고 주문 데이터가 동기화되었습니다.');
      setConnectTarget(null);
    } catch (e) { showToast(e instanceof Error ? e.message : '카페24 연동에 실패했습니다.'); }
    finally { setCafe24Saving(false); }
  };

  const testCafe24 = async () => {
    const { mallId, clientId, clientSecret } = cafe24Form;
    if (!mallId.trim() || !clientId.trim() || !clientSecret.trim()) { showToast('쇼핑몰 ID, Client ID, Client Secret을 모두 입력해주세요.'); return; }
    setCafe24Testing(true);
    try {
      const r = await apiFetch<{ok:boolean;mallName:string}>('/integrations/cafe24/test', { method:'POST', body: JSON.stringify({ mallId: mallId.trim(), clientId: clientId.trim(), clientSecret: clientSecret.trim() }) });
      showToast(`✅ 카페24 연결 성공! (${r.mallName})`);
    } catch (e) { showToast(`❌ ${e instanceof Error ? e.message : '연결 실패'}`); }
    finally { setCafe24Testing(false); }
  };

  /** 네이버 스마트스토어: application_id + application_secret */
  const connectNaverStore = async (adId: string) => {
    const { clientId, clientSecret } = storeForm;
    if (!clientId.trim() || !clientSecret.trim()) { showToast('Application ID와 Secret Key를 모두 입력해주세요.'); return; }
    setStoreSaving(true);
    try {
      await apiFetch(`/advertisers/${encodeURIComponent(adId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ accounts: [{ channel: 'naver_store', status: 'connected', account_id: clientId.trim(), api_key: clientId.trim(), secret_key: clientSecret.trim() }] }),
      });
      await apiFetch('/integrations/sync-naver-store', { method: 'POST', body: JSON.stringify({ advertiserId: adId }) });
      await reload();
      showToast('네이버 스마트스토어가 연결되고 주문 데이터가 동기화되었습니다.');
      setConnectTarget(null);
    } catch (e) { showToast(e instanceof Error ? e.message : '네이버 스마트스토어 연동에 실패했습니다.'); }
    finally { setStoreSaving(false); }
  };

  const testNaverStore = async () => {
    const { clientId, clientSecret } = storeForm;
    if (!clientId.trim() || !clientSecret.trim()) { showToast('Application ID와 Secret Key를 모두 입력해주세요.'); return; }
    setStoreTesting(true);
    try {
      const r = await apiFetch<{ok:boolean;sellerName:string}>('/integrations/naver-store/test', { method:'POST', body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }) });
      showToast(`✅ 스마트스토어 연결 성공! (${r.sellerName})`);
    } catch (e) { showToast(`❌ ${e instanceof Error ? e.message : '연결 실패'}`); }
    finally { setStoreTesting(false); }
  };

  const [syncDaysByChannel,setSyncDaysByChannel]=useState<Record<string,number>>({});
  const sync = async (channel: Channel) => {
    if (!selected) return;
    setSyncing(channel);
    try {
      const result = await apiFetch<{ ok: boolean; count?: number; background?: boolean; message?: string }>('/integrations/sync', {
        method: 'POST', body: JSON.stringify({ advertiserId: selected.id, channel: CH_KEY_MAP[channel], days: syncDaysByChannel[channel] ?? 90 }),
      });
      if (result.background) showToast(result.message ?? '수집을 백그라운드에서 시작했습니다. 데이터 수집 현황에서 확인하세요.');
      else showToast(`${channel} 동기화 완료 · ${result.count}일치 데이터`);
      await reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '동기화에 실패했습니다.');
    }
    setSyncing('');
  };

  const [probingConversionReport, setProbingConversionReport] = useState(false);
  const probeNaverConversionReport = async () => {
    if (!selected) return;
    setProbingConversionReport(true);
    try {
      const result = await apiFetch<{ ok: boolean; message: string; sampleRowCount: number }>('/integrations/naver-conversion-report-probe', {
        method: 'POST', body: JSON.stringify({ advertiserId: selected.id }),
      });
      showToast(`${result.message} (${result.sampleRowCount}행)`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '리포트 확인에 실패했습니다.');
    }
    setProbingConversionReport(false);
  };

  const disconnect = async (channel: Channel) => {
    if (!selected) return;
    if (!confirm('연결을 해제할까요?')) return;
    const channelKey = CH_KEY_MAP[channel];
    try {
      await apiFetch(`/advertisers/${encodeURIComponent(selected.id)}`, { method: 'PATCH', body: JSON.stringify({ accounts: [{ channel: channelKey, _remove: true }] }) });
      await reload();
      showToast(`${channel} 연결이 해제되었습니다.`);
    } catch (error) { showToast(error instanceof Error ? error.message : '연결 해제에 실패했습니다.'); }
  };

  return (
    <>
      <PageHeader
        title="광고계정 연동"
        description="매체별 광고계정과 브랜드를 연결하고 API 동기화 상태를 관리합니다."
        action={<Link className="btn primary" to="/advertisers"><Plus size={15} /> 광고주 등록</Link>}
      />

      {autoSyncStatus && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 16, background: autoSyncStatus.enabled ? '#f0fdf4' : '#fef2f2', borderColor: autoSyncStatus.enabled ? '#bbf7d0' : '#fecaca' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: autoSyncStatus.enabled ? '#16a34a' : '#dc2626', flexShrink: 0 }} />
          <div style={{ fontSize: 13.5 }}>
            {autoSyncStatus.enabled ? (
              <>
                <b>자동 동기화 켜짐</b> · 매일 한국시간 {autoSyncStatus.hoursKst.join(', ')}시에 연결된 모든 매체를 자동으로 동기화합니다.
                {autoSyncStatus.lastRunAt ? (
                  <> · 마지막 실행: {new Date(autoSyncStatus.lastRunAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {autoSyncStatus.lastResult && ` (성공 ${autoSyncStatus.lastResult.success}개 / 실패 ${autoSyncStatus.lastResult.failed}개)`}
                  </>
                ) : ' · 아직 실행 이력이 없습니다(다음 예약 시각에 실행됩니다).'}
              </>
            ) : <><b>자동 동기화 꺼짐</b> · DATABASE_URL이 설정되지 않아 자동 동기화를 사용할 수 없습니다.</>}
          </div>
        </div>
      )}

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
                      <select value={syncDaysByChannel[channel]??90} onChange={e=>setSyncDaysByChannel(prev=>({...prev,[channel]:Number(e.target.value)}))} title="수집 기간" style={{marginRight:6}}>
                        <option value={1}>오늘</option>
                        <option value={0}>어제</option>
                        <option value={3}>최근 3일</option>
                        <option value={7}>최근 7일</option>
                        <option value={14}>최근 14일</option>
                        <option value={30}>최근 30일</option>
                        <option value={60}>최근 60일</option>
                        <option value={90}>최근 90일</option>
                        <option value={180}>최근 6개월</option>
                        <option value={396}>최근 13개월</option>
                        <option value={730}>최근 24개월</option>
                      </select>
                      <button className="btn secondary" onClick={() => sync(channel)} disabled={syncing === channel}>
                        <RefreshCw size={14} className={syncing === channel ? 'is-spinning' : ''} />
                        {syncing === channel ? '동기화 중' : '동기화'}
                      </button>
                      {CH_KEY_MAP[channel] === 'naver' && (
                        <button className="btn secondary" onClick={probeNaverConversionReport} disabled={probingConversionReport} title="전환 유형별 상세 리포트가 실제로 어떤 데이터를 주는지 Railway 로그로 확인합니다(저장 안 함, 진단용).">
                          {probingConversionReport ? '확인 중...' : '전환 유형 리포트 확인'}
                        </button>
                      )}
                      <button className="btn danger" onClick={() => disconnect(channel)}>
                        연결 해제
                      </button>
                    </div>
                    {CH_KEY_MAP[channel] === 'naver' && (syncDaysByChannel[channel] ?? 90) > 90 && (
                      <p style={{margin:'8px 0 0',fontSize:12,color:'#64748b'}}>
                        장기 수집은 계정·캠페인 성과를 선택 기간 전체로 저장합니다. 소재·키워드는 API 호출 폭증을 막기 위해 최근 90일만 백필하며, 일자별 재조회가 필요한 대형 계정은 최근 30일만 백필합니다. 기존에 저장된 과거 세부 데이터는 삭제하지 않습니다.
                      </p>
                    )}
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
          })}{/* /CHANNELS.map */}

          {/* ── 쇼핑몰 연동 카드 (카페24 · 네이버 스마트스토어) ── */}
          {selected && (() => {
            const STORE_META: Record<string, { label: string; color: string; abbr: string; desc: string }> = {
              cafe24:      { label: '카페24',              color: '#ef4444', abbr: 'C24', desc: 'mall_id + Client ID + Secret → 일별 주문·매출 동기화' },
              naver_store: { label: '네이버 스마트스토어', color: '#16a34a', abbr: 'NS',  desc: 'Application ID + Secret → 일별 주문·매출 동기화' },
            };
            const storeLinks: StoreLink[] = selected.storeLinks ?? [];

            const syncStore = async (channel: string) => {
              if (!selected) return;
              setSyncing(channel);
              try {
                const endpoint = channel === 'cafe24' ? '/integrations/sync-cafe24' : '/integrations/sync-naver-store';
                await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ advertiserId: selected.id, days: 90 }) });
                showToast('동기화가 완료됐습니다.');
                await reload();
              } catch (e) { showToast(e instanceof Error ? e.message : '동기화 실패'); }
              finally { setSyncing(''); }
            };

            const disconnectStore = async (channel: string) => {
              if (!confirm(`${STORE_META[channel]?.label} 연결을 해제할까요?`)) return;
              try {
                await apiFetch(`/advertisers/${encodeURIComponent(selected.id)}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ accounts: [{ channel, status: 'disconnected', account_id: '', api_key: '', secret_key: '' }] }),
                });
                showToast('연결을 해제했습니다.');
                await reload();
              } catch (e) { showToast(e instanceof Error ? e.message : '해제 실패'); }
            };

            return Object.entries(STORE_META).map(([ch, meta]) => {
              const link = storeLinks.find(l => l.channel === ch);
              const isConnected = link?.status === '연결됨';
              const isCafe24 = ch === 'cafe24';

              return (
                <section key={ch} className={`card account-channel-card ${isConnected ? 'connected' : ''}`}>
                  <div className="account-channel-head">
                    <div className="account-channel-title">
                      <span className="account-channel-icon" style={{ background: meta.color, fontSize: 11, fontWeight: 800 }}>{meta.abbr}</span>
                      <div>
                        <h3>{meta.label} 연동</h3>
                        <p>{isConnected ? `연결됨 — ${link?.accountId ?? ''}` : meta.desc}</p>
                      </div>
                    </div>
                    <span className={`status-pill ${isConnected ? 'success' : 'warning'}`}>{link?.status ?? '미연동'}</span>
                  </div>

                  {isConnected ? (
                    <div className="account-sync-box">
                      <div>
                        <b>동기화 상태</b>
                        <p>마지막 동기화 {link?.lastSync ?? '-'}{link?.rowCount ? ` · ${link.rowCount}건` : ''}</p>
                        {link?.lastError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>오류: {link.lastError}</p>}
                      </div>
                      <div className="account-sync-actions">
                        <button className="btn secondary" onClick={() => syncStore(ch)} disabled={syncing === ch}>
                          <RefreshCw size={14} className={syncing === ch ? 'is-spinning' : ''} />
                          {syncing === ch ? '동기화 중' : '재동기화 (90일)'}
                        </button>
                        <button className="btn danger" onClick={() => disconnectStore(ch)}>연결 해제</button>
                      </div>
                    </div>
                  ) : (
                    <div className="account-empty-connect" style={{ display: 'block' }}>
                      {isCafe24 ? (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <label className="field-label" style={{ margin: 0 }}>쇼핑몰 ID (mall_id)
                              <input value={cafe24Form.mallId} onChange={e => setCafe24Form({ ...cafe24Form, mallId: e.target.value })} placeholder="예: mymall" />
                            </label>
                            <label className="field-label" style={{ margin: 0 }}>Client ID
                              <input value={cafe24Form.clientId} onChange={e => setCafe24Form({ ...cafe24Form, clientId: e.target.value })} placeholder="Cafe24 API 클라이언트 ID" />
                            </label>
                          </div>
                          <label className="field-label" style={{ marginBottom: 8 }}>Client Secret
                            <input type="password" value={cafe24Form.clientSecret} onChange={e => setCafe24Form({ ...cafe24Form, clientSecret: e.target.value })} placeholder="Client Secret" />
                          </label>
                          <div className="api-help" style={{ marginBottom: 10 }}>카페24 개발자센터(developers.cafe24.com)에서 앱 등록 후 발급받은 키를 입력하세요. 권한 범위: mall.read_order</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn secondary" onClick={testCafe24} disabled={cafe24Testing}>{cafe24Testing ? '테스트 중...' : '연결 테스트'}</button>
                            <button className="btn primary" onClick={() => connectCafe24(selected.id)} disabled={cafe24Saving}>{cafe24Saving ? '연결 중...' : '연결 및 동기화'}</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <label className="field-label" style={{ margin: 0 }}>Application ID
                              <input value={storeForm.clientId} onChange={e => setStoreForm({ ...storeForm, clientId: e.target.value })} placeholder="네이버 커머스 Application ID" />
                            </label>
                            <label className="field-label" style={{ margin: 0 }}>Application Secret
                              <input type="password" value={storeForm.clientSecret} onChange={e => setStoreForm({ ...storeForm, clientSecret: e.target.value })} placeholder="Application Secret" />
                            </label>
                          </div>
                          <div className="api-help" style={{ marginBottom: 10 }}>네이버 API 센터(apicenter.commerce.naver.com)에서 애플리케이션 등록 후 발급받은 키를 입력하세요.</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn secondary" onClick={testNaverStore} disabled={storeTesting}>{storeTesting ? '테스트 중...' : '연결 테스트'}</button>
                            <button className="btn primary" onClick={() => connectNaverStore(selected.id)} disabled={storeSaving}>{storeSaving ? '연결 중...' : '연결 및 동기화'}</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </section>
              );
            });
          })()}
        </main>
      </div>


      {/* 연동 모달 */}
      {connectTarget && (
        <div className="modal-backdrop" onClick={() => setConnectTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>{CHANNEL_META[connectTarget.channel].label} 연결</h3>
                <p>{connectTarget.channel === '네이버' ? '광고주에게 전달받은 CUSTOMER_ID / API Key / Secret Key를 입력합니다.' : '연결된 광고계정 목록을 불러와 선택합니다.'}</p>
              </div>
              <button className="icon-btn" onClick={() => setConnectTarget(null)}><X size={18} /></button>
            </div>
            {connectTarget.channel === '네이버' ? (
              <>
                <label className="field-label">CUSTOMER_ID<input value={naverForm.customerId} onChange={e => setNaverForm({ ...naverForm, customerId: e.target.value })} placeholder="예: 123456" /></label>
                <label className="field-label" style={{ marginTop: 10 }}>액세스라이선스 (API Key)<input value={naverForm.apiKey} onChange={e => setNaverForm({ ...naverForm, apiKey: e.target.value })} placeholder="0100000000..." /></label>
                <label className="field-label" style={{ marginTop: 10 }}>비밀키 (Secret Key)<input type="password" value={naverForm.secretKey} onChange={e => setNaverForm({ ...naverForm, secretKey: e.target.value })} placeholder="비밀키 입력" /></label>
                <div className="api-help">이 값들은 이 광고주 계정에만 저장되고, 화면에는 다시 표시되지 않습니다. 연결하면 즉시 최근 90일 데이터를 자동으로 가져옵니다.</div>
                <div className="modal-actions">
                  <button className="btn secondary" onClick={() => setConnectTarget(null)}>취소</button>
                  <button className="btn primary" onClick={connectNaver} disabled={naverSaving}>{naverSaving ? '연결 중...' : '연결 및 데이터 동기화'}</button>
                </div>
              </>
            ) : (
              <>
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
                  <button className="btn secondary" onClick={() => setConnectTarget(null)} disabled={metaConnecting}>취소</button>
                  <button className="btn primary" onClick={connect} disabled={!metaSelected || metaConnecting}>{metaConnecting ? '연결 및 동기화 중... (최대 1분 정도 걸릴 수 있어요)' : '연결 및 데이터 동기화'}</button>
                </div>
                {!metaSelected && <div className="footnote" style={{marginTop:6}}>⚠ 광고계정을 선택해야 버튼이 활성화됩니다. {!metaAccounts.length && '먼저 "연결된 계정 불러오기"를 눌러주세요.'}</div>}
              </>
            )}
          </div>
        </div>
      )}

    </>
  );
}
