import { useParams, Link } from 'react-router-dom';
import { IntegrationGate } from '../gates/IntegrationGate';
import { DashboardPageMock } from '../reference/DashboardPageMock';
import { EmptyState } from '../components/EmptyState';
import { BRAND_REPORTS } from '../data/brandReports';

// 연동 GATE: 기존 저장소의 실제 DashboardPage로 교체하세요.
// - 유지해야 할 것: 기존 API 호출, 상태관리, 스타일, 4개 영역(광고비 믹스/성과 지표/
//   예산 소진율/추천 조치)의 실제 로직
// - :brandId 라우트 파라미터로 광고주를 구분합니다. 실제 연동 시에는 이 값으로
//   기존 API를 호출하면 됩니다.
export function DashboardPage() {
  const { brandId } = useParams();
  const report = BRAND_REPORTS.find((r) => r.config.brandId === brandId);

  if (!report) {
    return (
      <div>
        <Link to="/dashboard" className="breadcrumb-back">← 광고주 목록으로</Link>
        <div className="card">
          <EmptyState title={`"${brandId}" 광고주를 찾을 수 없습니다.`} />
        </div>
      </div>
    );
  }

  return (
    <IntegrationGate
      name="DashboardPage"
      description={`기존 저장소의 실제 DashboardPage를 이 자리에 연결하세요 (광고주: ${report.config.brandName}). 설계서 11번(리팩터링 안전장치) 절차를 따르면 됩니다.`}
    >
      <DashboardPageMock config={report.config} data={report.data} />
    </IntegrationGate>
  );
}
