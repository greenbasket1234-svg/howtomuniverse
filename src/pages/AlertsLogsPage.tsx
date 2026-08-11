import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Clock3, Download, RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { apiFetch } from '../hooks/useApi';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

type LogStatus = 'success' | 'error' | 'warning' | 'info';
type LogType   = 'batch' | 'connect' | 'error' | 'info' | 'warning';

type ApiLog = {
  id: number;
  type: LogType;
  channel?: string;
  advertiser_name?: string;
  message: string;
  detail?: string;
  status: LogStatus;
  created_at: string;
};

type LogTab = 'all' | 'success' | 'error' | 'warning' | 'batch' | 'connect';

const TAB_LABELS: Record<LogTab, string> = {
  all: '전체', success: '성공', error: '오류',
  warning: '경고', batch: '배치', connect: '연동',
};

const STATUS_STYLE: Record<LogStatus, { color: string; bg: string; label: string }> = {
  success: { color: '#16a34a', bg: '#eafaf0', label: '성공' },
  error:   { color: '#e35353', bg: '#fdecec', label: '오류' },
  warning: { color: '#f59e0b', bg: '#fff8ec', label: '경고' },
  info:    { color: '#2563eb', bg: '#eaf1ff', label: '정보' },
};

const CH_COLOR: Record<string, string> = {
  meta:'#2563eb', naver:'#16a34a', google:'#ea4335',
  daangn:'#ff6f0f', tiktok:'#111827', kakao:'#ca8a04',
};
const CH_LABEL: Record<string, string> = {
  meta:'Meta', naver:'네이버', google:'구글',
  daangn:'당근', tiktok:'틱톡', kakao:'카카오',
};
const TYPE_ICON: Record<LogType, string> = {
  batch:'⚙', connect:'🔗', error:'❌', info:'ℹ', warning:'⚠',
};

const SAMPLE_LOGS: ApiLog[] = [
  { id: 1, type: 'batch', channel: 'meta', advertiser_name: '다방이사', message: 'Meta 일일 데이터 수집 완료', detail: 'DB, 클릭수, 노출수, 광고비 자동 입력', status: 'success', created_at: new Date().toISOString() },
  { id: 2, type: 'connect', channel: 'naver', advertiser_name: '다시마전복수산', message: '네이버 광고 API 연결 대기', detail: '실제 API 키 등록 후 자동 수집 활성화 예정', status: 'warning', created_at: new Date(Date.now() - 3600_000).toISOString() },
  { id: 3, type: 'batch', channel: 'google', advertiser_name: '서울우리아이치과', message: '클릭 성과형 보고서 데모 데이터 갱신', detail: '클릭수, 광고비, CPC 계산 완료', status: 'info', created_at: new Date(Date.now() - 7200_000).toISOString() },
];

export function AlertsLogsPage() {
  const [logs,       setLogs]       = useState<ApiLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState<LogTab>('all');
  const [query,      setQuery]      = useState('');
  const { filterValue } = useAdvertiserFilter();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await apiFetch<ApiLog[]>('/logs?limit=200');
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs(current => current.length ? current : SAMPLE_LOGS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = logs;
    if (tab !== 'all') result = result.filter(l => l.status === tab || l.type === tab);
    // 광고주 필터: 광고주가 특정되지 않은 시스템 로그(로그인 등)는 필터와 무관하게 항상 보여줍니다.
    if (filterValue) result = result.filter(l => !l.advertiser_name || matchesAdvertiserFilter(l.advertiser_name, filterValue));
    if (query.trim()) result = result.filter(l =>
      (l.message + (l.detail ?? '') + (l.advertiser_name ?? '')).toLowerCase().includes(query.trim().toLowerCase())
    );
    return result;
  }, [logs, tab, query, filterValue]);

  const exportCsv = () => {
    const header = ['날짜', '유형', '채널', '광고주', '메시지', '상세'].join(',');
    const rows   = filtered.map(l =>
      [
        new Date(l.created_at).toLocaleString('ko-KR'),
        l.status, l.channel ?? '', l.advertiser_name ?? '', l.message, l.detail ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `alerts-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const fmt = (ts: string) =>
    new Date(ts).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });

  return (
    <>
      <PageHeader
        title="알림 / 로그"
        description="배치 실행, 채널 연동, 오류 내역을 확인합니다."
        action={
          <div className="action-row">
            <button className="btn secondary" onClick={exportCsv}>
              <Download size={14} /> CSV
            </button>
            <button className="btn secondary" onClick={load}>
              <RefreshCw size={14} className={refreshing ? 'is-spinning' : ''} /> 새로고침
            </button>
          </div>
        }
      />

      {/* 탭 */}
      <div className="log-tabs">
        {(Object.keys(TAB_LABELS) as LogTab[]).map(k => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {k === 'warning' ? <Bell size={14} />
             : k === 'batch' ? <Clock3 size={14} />
             : <CheckCircle2 size={14} />}
            {' '}{TAB_LABELS[k]}
            {tab === k && <span>{filtered.length}</span>}
          </button>
        ))}
      </div>

      {/* 검색 */}
      {filterValue && <div className="footnote" style={{ marginBottom: 6 }}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
      <div className="log-search">
        <Search size={15} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="로그 내용 검색"
        />
      </div>

      {/* 목록 */}
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'#9ca3af' }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <section className="card" style={{ textAlign:'center', padding:40, color:'#9ca3af' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
          로그가 없습니다
        </section>
      ) : (
        <section className="card log-table-card" style={{ padding:0, overflow:'hidden' }}>
          {filtered.map((log, i) => {
            const sc = STATUS_STYLE[log.status] ?? STATUS_STYLE.info;
            return (
              <div
                key={log.id}
                style={{
                  display:'flex', alignItems:'flex-start', gap:14, padding:'13px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid #f9fafb' : 'none',
                  background: i % 2 === 0 ? '#fff' : '#fafafa',
                }}
              >
                <div style={{ fontSize:16, flexShrink:0, marginTop:2 }}>
                  {TYPE_ICON[log.type] ?? 'ℹ'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
                    <span style={{
                      fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:999,
                      background:sc.bg, color:sc.color,
                    }}>
                      {sc.label}
                    </span>
                    {log.channel && (
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:999,
                        background: CH_COLOR[log.channel] ?? '#6b7280', color:'#fff',
                      }}>
                        {CH_LABEL[log.channel] ?? log.channel}
                      </span>
                    )}
                    {log.advertiser_name && (
                      <span style={{ fontSize:11, color:'#9ca3af' }}>{log.advertiser_name}</span>
                    )}
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1a1d23', marginBottom: log.detail ? 3 : 0 }}>
                    {log.message}
                  </div>
                  {log.detail && log.detail !== log.message && (
                    <div style={{ fontSize:11, color:'#9ca3af', wordBreak:'break-all' }}>
                      {log.detail.slice(0, 150)}
                    </div>
                  )}
                </div>
                <div style={{ fontSize:11, color:'#9ca3af', flexShrink:0, marginTop:2 }}>
                  {fmt(log.created_at)}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
