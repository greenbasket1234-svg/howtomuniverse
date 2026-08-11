import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, KeyRound, Link2, Plus, RefreshCw, Search, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CHANNELS, Channel, Advertiser, AccountLink } from '../data/advertisers';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { apiFetch } from '../hooks/useApi';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const CHANNEL_META: Record<Channel, { label: string; color: string; abbr: string }> = {
  Meta:   { label: 'Meta Marketing API',  color: '#2563eb', abbr: 'M' },
  네이버: { label: '네이버 검색광고',     color: '#16a34a', abbr: 'N' },
  구글:   { label: '구글 광고',            color: '#ef4444', abbr: 'G' },
  당근:   { label: '당근 광고',            color: '#f97316', abbr: '당' },
  틱톡:   { label: 'TikTok Ads',           color: '#111827', abbr: 'T' },
  카카오: { label: '카카오 광고',          color: '#eab308', abbr: 'K' },
};

const CH_KEY_MAP: Record<Channel, string> = {
  Meta: 'meta', 네이버: 'naver', 구글: 'google',
  당근: 'daangn', 틱톡: 'tiktok', 카카오: 'kakao',
};

export function AdAccountsPage() {
  const [advertisers, setAdvertisers, reload] = useAdvertisers();
  const { filterValue } = useAdvertiserFilter();
  const [query,          setQuery]          = useState('');
  const [selectedId,     setSelectedId]     = useState(() => advertisers[0]?.id ?? '');
  const [connectTarget,  setConnectTarget]  = useState<{ channel: Channel; adId: string } | null>(null);
  const [accountId,      setAccountId]      = useState('');
  const [token,          setToken]          = useState('');
  const [toast,          setToast]          = useState('');
  const [syncing,        setSyncing]        = useState('');
  const [testing,        setTesting]        = useState(false);

  // 이전엔 상단 전역 광고주 검색과 이 페이지의 사이드바 목록이 완전히 분리되어 있었습니다.
  // 전역 필터를 걸어도 이 페이지에서는 아무 반응이 없었기 때문에, 사이드바 목록에도
  // 전역 필터를 함께 적용하고, 필터에 일치하는 광고주가 있으면 자동으로 선택합니다.
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  };

  const updateLink = (adId: string, channel: Channel, patch: Partial<AccountLink>) =>
    setAdvertisers(prev =>
      prev.map(a =>
        a.id === adId
          ? { ...a, links: a.links.map(l => l.channel === channel ? { ...l, ...patch } : l) }
          : a,
      ),
    );

  /** API 연동 테스트 후 상태 저장 */
  const connect = async () => {
    if (!connectTarget || !token.trim()) return;
    setTesting(true);

    const channel      = connectTarget.channel;
    const channelKey   = CH_KEY_MAP[channel];
    const advertiserId = connectTarget.adId;

    const credentials: Record<string, string> = {};
    if (accountId.trim()) credentials.accountId = accountId.trim();
    credentials.accessToken = token.trim();

    try {
      // 1. 자격증명 저장
      await apiFetch(`/advertisers/${advertiserId}`, {
        method: 'PUT',
        body: JSON.stringify({ accounts: [{ channel: channelKey, credentials }] }),
      });

      // 2. 연동 테스트
      const result = await apiFetch<{ ok: boolean; message: string }>(
        `/advertisers/${advertiserId}/channels/${channelKey}/test`,
        { method: 'POST', body: JSON.stringify({ credentials }) },
      );

      if (result.ok) {
        updateLink(advertiserId, channel, {
          status: '연결됨', keyRegistered: true,
          accountId: accountId || `${channelKey}-${Date.now().toString().slice(-6)}`,
          accountName: `${selected?.name ?? ''} ${CHANNEL_META[channel].label}`,
          lastSync: '방금 전',
        });
        showToast(`${channel} 광고계정 연동 완료: ${result.message}`);
      } else {
        showToast(`연동 실패: ${result.message}`);
      }
    } catch (err: unknown) {
      updateLink(advertiserId, channel, {
        status: '연결됨', keyRegistered: true,
        accountId: accountId || `demo-${channelKey}-${Date.now().toString().slice(-6)}`,
        accountName: `${selected?.name ?? ''} ${CHANNEL_META[channel].label} 데모 계정`,
        lastSync: '방금 전',
      });
      showToast(`데모 모드로 ${channel} 광고계정이 연결 처리되었습니다. 실제 API 연결은 마지막 단계에서 활성화합니다.`);
    } finally {
      setTesting(false);
      setConnectTarget(null);
      setToken('');
      setAccountId('');
      reload();
    }
  };

  const sync = (channel: Channel) => {
    setSyncing(channel);
    setTimeout(() => {
      updateLink(selected!.id, channel, { lastSync: '방금 전' });
      setSyncing('');
      showToast(`${channel} 동기화 완료`);
    }, 650);
  };

  const disconnect = (channel: Channel) => {
    if (!confirm('연결을 해제할까요?')) return;
    updateLink(selected!.id, channel, {
      status: '미연동', keyRegistered: false,
      accountId: undefined, accountName: undefined, lastSync: undefined,
    });
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
                    <p>API 키 또는 OAuth 연결을 등록하면 데이터 수집과 캠페인 제어 기능이 활성화됩니다.</p>
                    <button
                      className="btn primary"
                      onClick={() => setConnectTarget({ channel, adId: selected.id })}
                    >
                      <KeyRound size={15} /> 연결 설정
                    </button>
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
                <p>광고계정 ID와 액세스 토큰을 입력합니다.</p>
              </div>
              <button className="icon-btn" onClick={() => setConnectTarget(null)}><X size={18} /></button>
            </div>
            <label className="field-label">
              광고계정 ID (선택)
              <input value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="예: act_123456789" />
            </label>
            <label className="field-label">
              API 키 또는 액세스 토큰
              <input value={token} onChange={e => setToken(e.target.value)} placeholder="토큰 입력" type="password" />
            </label>
            <div className="api-help">
              <Link2 size={15} /> 현재는 데모 모드입니다. 입력값은 연결 테스트 UI 확인용이며, 실제 암호화 저장은 로그인과 백엔드 연동 단계에서 활성화됩니다.
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setConnectTarget(null)}>취소</button>
              <button className="btn primary" onClick={connect} disabled={testing}>
                {testing ? '테스트 중...' : '등록 및 테스트'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
