import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const rows = [
  { channel: 'Meta', account: '다방 Meta 광고계정', due: '전일', last: '06:41', count: '63,776', status: '정상', tone: 'success' as const },
  { channel: 'Naver', account: '검색광고 계정', due: '전일', last: '06:48', count: '12,440', status: '정상', tone: 'success' as const },
  { channel: 'Karrot', account: '당근 광고계정', due: '전일', last: '06:56', count: '1,204', status: '일부 누락', tone: 'warning' as const },
  { channel: 'Kakao', account: '카카오모먼트', due: '전일', last: '07:12', count: '880', status: '지연', tone: 'danger' as const },
];

export function DataSyncPage() {
  const { filterValue } = useAdvertiserFilter();
  const visible = rows.filter(r => matchesAdvertiserFilter(r.account, filterValue));
  return <div>
    <PageHeader title="데이터 수집 현황" description="오전 7시 이전 전일 광고 데이터 수집·누락·재수집 상태를 확인합니다." />
    {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경) · 광고계정명 기준 매칭</div>}
    <div className="card" style={{padding:0}}><div className="table-scroll"><table className="data-table">
      <thead><tr><th>매체</th><th>광고계정</th><th>수집 대상</th><th>최근 수집</th><th className="num">수집 건수</th><th>상태</th><th>작업</th></tr></thead>
      <tbody>{visible.length===0?<tr><td colSpan={7} style={{textAlign:'center',padding:'24px',color:'#9ca3af'}}>해당 광고주의 연동 계정이 없습니다.</td></tr>:visible.map(r=><tr key={r.channel}><td>{r.channel}</td><td>{r.account}</td><td>{r.due}</td><td>{r.last}</td><td className="num">{r.count}</td><td><Badge tone={r.tone}>{r.status}</Badge></td><td><button className="btn">재수집</button></td></tr>)}</tbody>
    </table></div></div>
  </div>;
}
