import { PageHeader } from '../components/PageHeader';
import { MetricsDateBar } from '../components/MetricsDateBar';

export function CreativeReuploadPage(){
  return <div><PageHeader title="소재 재등록 센터" description="광고 매체 쓰기 권한을 사용하는 기능입니다."/><MetricsDateBar/><section className="card"><div className="empty-state"><div className="empty-state-title">재등록 커넥터 미구현</div><div>현재 Meta·네이버 연결은 성과 조회 및 동기화 중심입니다. 실제 광고 ID 생성·소재 업로드·ON/OFF를 가짜로 처리하지 않습니다. 각 매체 쓰기 API와 권한 검증이 완료되면 이 기능을 활성화합니다.</div></div></section></div>;
}
