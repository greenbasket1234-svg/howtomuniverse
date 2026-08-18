import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { RotateCcw, CheckCircle2 } from 'lucide-react';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { apiFetch } from '../hooks/useApi';

type StatusRow = { advertiserId: string; advertiserName: string; channel: string; lastSyncedAt: string | null; rowCount: number; error: string | null };
const CH_LABEL_MAP: Record<string, string> = { meta: 'Meta', naver: '네이버', google: '구글', daangn: '당근', tiktok: '틱톡', kakao: '카카오' };

export function DataSyncPage() {
  const { filterValue } = useAdvertiserFilter();
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const load = () => apiFetch<{ rows: StatusRow[] }>('/integrations/status').then(r => setRows(r.rows || [])).catch(() => setRows([])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const visibleRows = rows.filter(r => matchesAdvertiserFilter(r.advertiserName, filterValue));
  const timeAgo = (iso: string | null) => {
    if (!iso) return '수집 이력 없음';
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffMin < 1440) return `${Math.round(diffMin / 60)}시간 전`;
    return `${Math.round(diffMin / 1440)}일 전`;
  };
  const resync = async (advertiserId: string, channel: string) => {
    const key = `${advertiserId}-${channel}`;
    setRefreshing(key);
    try {
      await apiFetch('/integrations/sync', { method: 'POST', body: JSON.stringify({ advertiserId, channel }) });
      await load();
      setToast('재수집이 완료됐습니다.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '재수집에 실패했습니다.');
    }
    setRefreshing(null); setTimeout(() => setToast(''), 2500);
  };
  return <div>
    <PageHeader title="데이터 수집 현황" description="연결된 광고 매체의 전일 데이터 수집·누락·재수집 상태를 확인합니다." />
    {toast && <div className="save-toast"><CheckCircle2 size={16} />{toast}</div>}
    {filterValue && <div className="footnote" style={{ marginBottom: 8 }}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
    <div className="card" style={{ padding: 0 }}><div className="table-scroll"><table className="data-table">
      <thead><tr><th>매체</th><th>광고주</th><th>최근 수집</th><th className="num">수집 건수</th><th>상태</th><th>작업</th></tr></thead>
      <tbody>
        {visibleRows.map(r => {
          const key = `${r.advertiserId}-${r.channel}`;
          return <tr key={key}>
            <td>{CH_LABEL_MAP[r.channel] ?? r.channel}</td>
            <td><b>{r.advertiserName}</b></td>
            <td>{timeAgo(r.lastSyncedAt)}</td>
            <td className="num">{r.rowCount.toLocaleString()}행</td>
            <td><span className={`status-pill ${r.error ? 'danger' : r.lastSyncedAt ? 'success' : 'warning'}`}>{r.error ? '실패' : r.lastSyncedAt ? '성공' : '대기'}</span>{r.error && <div className="footnote">{r.error}</div>}</td>
            <td><button className="btn secondary mini" disabled={refreshing === key} onClick={() => resync(r.advertiserId, r.channel)}><RotateCcw size={13} /> {refreshing === key ? '수집 중...' : '재수집'}</button></td>
          </tr>;
        })}
        {!loading && !visibleRows.length && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '34px', color: '#9ca3af' }}>연결된 광고계정 및 수집 데이터가 없습니다. 매체·계정 연동 후 수집 상태가 표시됩니다.</td></tr>}
      </tbody>
    </table></div></div>
  </div>;
}
