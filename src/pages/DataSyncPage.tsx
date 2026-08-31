import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { RotateCcw, CheckCircle2 } from 'lucide-react';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { apiFetch } from '../hooks/useApi';

type StatusRow = { advertiserId: string; advertiserName: string; channel: string; lastSyncedAt: string | null; rowCount: number; error: string | null; syncing?: boolean; syncProgress?: string | null };
type ValidationLog = { id:string; createdAt:string; advertiserId:string; advertiserName?:string; accountId?:string; channel:string; since:string; until:string; sourceLabel:string; source:{spend:number;impressions:number;clicks:number;dbCount:number;purchases:number;unconfirmed?:number;revenue:number}; stored:{spend:number;impressions:number;clicks:number;dbCount:number;purchases:number;unconfirmed?:number;revenue:number}; delta:Record<string,number>; ok:boolean };
const CH_LABEL_MAP: Record<string, string> = { meta: 'Meta', naver: '네이버', google: '구글', daangn: '당근', tiktok: '틱톡', kakao: '카카오' };

export function DataSyncPage() {
  const { filterValue } = useAdvertiserFilter();
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [validationLogs,setValidationLogs]=useState<ValidationLog[]>([]);
  const [loadError,setLoadError]=useState('');
  const loadValidation=()=>apiFetch<{rows:ValidationLog[]}>('/integrations/sync-validation?limit=50').then(r=>{setValidationLogs(r.rows||[]);setLoadError('');}).catch(e=>{setValidationLogs([]);setLoadError(e instanceof Error?e.message:'Sync 검증 로그를 불러오지 못했습니다.');});
  const load = () => Promise.all([apiFetch<{ rows: StatusRow[] }>('/integrations/status').then(r => setRows(r.rows || [])).catch(e => {setRows([]);setLoadError(e instanceof Error?e.message:'수집 현황을 불러오지 못했습니다.');}),loadValidation()]).finally(() => setLoading(false));
  useEffect(() => {
    load();
    // 백그라운드 수집이 '수집 중'일 때는 새로고침 없이도 구간 진행률이 자동 갱신되도록,
    // 진행 중인 항목이 있으면 5초마다 다시 불러옵니다. 전부 끝나면 폴링을 멈춥니다.
    const interval = setInterval(() => {
      setRows(prev => { if (prev.some(r => r.syncing)) load(); return prev; });
    }, 5_000);
    return () => clearInterval(interval);
  }, []);
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
      const result = await apiFetch<{background?:boolean;message?:string}>('/integrations/sync', { method: 'POST', body: JSON.stringify({ advertiserId, channel }) });
      await load();
      setToast(result.background ? (result.message ?? '수집을 백그라운드에서 시작했습니다.') : '재수집이 완료됐습니다.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '재수집에 실패했습니다.');
    }
    setRefreshing(null); setTimeout(() => setToast(''), 2500);
  };
  return <div>
    <PageHeader title="데이터 수집 현황" description="연결된 광고 매체의 전일 데이터 수집·누락·재수집 상태를 확인합니다." />
    {loadError&&<div className="card" style={{color:'#b91c1c',background:'#fef2f2',borderColor:'#fecaca',marginBottom:12,padding:'10px 14px',fontSize:13}}>불러오기 오류: {loadError}</div>}
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
            <td><span className={`status-pill ${r.syncing ? 'warning' : r.error ? 'danger' : r.lastSyncedAt ? 'success' : 'warning'}`}>{r.syncing ? '수집 중' : r.error ? '실패' : r.lastSyncedAt ? '성공' : '대기'}</span>{r.syncing&&r.syncProgress&&<div className="footnote">{r.syncProgress}</div>}{!r.syncing&&r.error&&<div className="footnote">{r.error}</div>}</td>
            <td><button className="btn secondary mini" disabled={refreshing === key} onClick={() => resync(r.advertiserId, r.channel)}><RotateCcw size={13} /> {refreshing === key ? '수집 중...' : '재수집'}</button></td>
          </tr>;
        })}
        {!loading && !visibleRows.length && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '34px', color: '#9ca3af' }}>연결된 광고계정 및 수집 데이터가 없습니다. 매체·계정 연동 후 수집 상태가 표시됩니다.</td></tr>}
      </tbody>
    </table></div></div>
    <section className="card" style={{marginTop:16,padding:0}}><div style={{padding:'16px 18px 8px'}}><h3 style={{margin:0,fontSize:15}}>Sync 검증 로그</h3><p className="footnote">Meta·네이버 관리자 원천 합계와 HOWTOM 중앙 Metrics 저장값을 같은 광고계정·같은 기간으로 대조합니다. 광고비뿐 아니라 노출·클릭·전환·전환매출까지 함께 검증합니다.</p></div><div className="table-scroll"><table className="data-table"><thead><tr><th>검증 시각</th><th>광고주</th><th>매체/계정</th><th>기간</th><th className="num">원천/저장 광고비</th><th className="num">원천/저장 노출</th><th className="num">원천/저장 클릭</th><th className="num">원천/저장 DB</th><th className="num" title="상세 리포트가 아직 없는 시점(주로 오늘)이라 확정 분류 못 한 전환의 원천/저장 값">원천/저장 미확인 ⓘ</th><th className="num">원천/저장 구매</th><th className="num">원천/저장 매출</th><th>결과</th></tr></thead><tbody>{validationLogs.filter(v=>matchesAdvertiserFilter(v.advertiserName||rows.find(r=>r.advertiserId===v.advertiserId)?.advertiserName||'',filterValue)).map(v=><tr key={v.id}><td>{new Date(v.createdAt).toLocaleString('ko-KR')}</td><td>{v.advertiserName||v.advertiserId}</td><td><b>{CH_LABEL_MAP[v.channel]??v.channel}</b><small style={{display:'block'}}>{v.accountId||'-'}</small></td><td>{v.since} ~ {v.until}</td><td className="num">₩{Math.round(v.source?.spend||0).toLocaleString()} / ₩{Math.round(v.stored?.spend||0).toLocaleString()}</td><td className="num">{Math.round(v.source?.impressions||0).toLocaleString()} / {Math.round(v.stored?.impressions||0).toLocaleString()}</td><td className="num">{Math.round(v.source?.clicks||0).toLocaleString()} / {Math.round(v.stored?.clicks||0).toLocaleString()}</td><td className="num">{Math.round(v.source?.dbCount||0).toLocaleString()} / {Math.round(v.stored?.dbCount||0).toLocaleString()}</td><td className="num">{Math.round(v.source?.unconfirmed||0).toLocaleString()} / {Math.round(v.stored?.unconfirmed||0).toLocaleString()}</td><td className="num">{Math.round(v.source?.purchases||0).toLocaleString()} / {Math.round(v.stored?.purchases||0).toLocaleString()}</td><td className="num">₩{Math.round(v.source?.revenue||0).toLocaleString()} / ₩{Math.round(v.stored?.revenue||0).toLocaleString()}</td><td><span className={`status-pill ${v.ok?'success':'danger'}`}>{v.ok?'일치':'불일치'}</span>{!v.ok&&<small style={{display:'block'}}>광고비 Δ ₩{Math.round(v.delta?.spend||0).toLocaleString()}</small>}</td></tr>)}{!validationLogs.length&&<tr><td colSpan={12} style={{textAlign:'center',padding:28,color:'#9ca3af'}}>아직 Sync 검증 로그가 없습니다. 매체 데이터를 동기화하면 자동으로 생성됩니다.</td></tr>}</tbody></table></div></section>
  </div>;
}
