import { PageHeader } from '../components/PageHeader';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';

type SyncRow = { channel:string; account:string; due:string; last:string; count:string; status:string; tone:'success'|'warning'|'danger'|'neutral' };
const rows: SyncRow[] = [];

export function DataSyncPage() {
  const { filterValue } = useAdvertiserFilter();
  return <div>
    <PageHeader title="데이터 수집 현황" description="연결된 광고 매체의 전일 데이터 수집·누락·재수집 상태를 확인합니다." />
    {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
    <div className="card" style={{padding:0}}><div className="table-scroll"><table className="data-table">
      <thead><tr><th>매체</th><th>광고계정</th><th>수집 대상</th><th>최근 수집</th><th className="num">수집 건수</th><th>상태</th><th>작업</th></tr></thead>
      <tbody>{rows.length===0?<tr><td colSpan={7} style={{textAlign:'center',padding:'34px',color:'#9ca3af'}}>연결된 광고계정 및 수집 데이터가 없습니다. 매체·계정 연동 후 수집 상태가 표시됩니다.</td></tr>:null}</tbody>
    </table></div></div>
  </div>;
}
