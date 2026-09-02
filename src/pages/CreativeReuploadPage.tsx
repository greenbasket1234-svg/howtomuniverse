import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { Link } from 'react-router-dom';

export function CreativeReuploadPage(){
  return <div><PageHeader title="소재 재등록 센터" description="광고 매체 쓰기 권한을 사용하는 기능입니다."/><MetricsDateBar/><section className="card"><div className="empty-state"><div className="empty-state-title">소재(이미지·영상) 업로드·신규 광고 생성은 아직 미구현입니다</div><div>실제 광고 ID 생성·소재 업로드를 가짜로 처리하지 않습니다. 각 매체 쓰기 API와 권한 검증이 완료되면 이 기능을 활성화합니다.<br/><br/>다만 <b>기존 캠페인 ON/OFF</b>는 <Link to="/campaigns">캠페인 관리</Link> 화면에서 실제로 지원됩니다(네이버 검색광고 기준 - Meta는 현재 조회 전용 권한이라 아직 지원하지 않습니다).</div></div></section></div>;
}
