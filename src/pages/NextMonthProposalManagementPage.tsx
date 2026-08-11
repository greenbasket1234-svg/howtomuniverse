import { PageHeader } from '../components/PageHeader';
import { MonthlyReportBuilder } from '../components/monthlyReport/MonthlyReportBuilder';

export function NextMonthProposalManagementPage() {
  return (
    <>
      <PageHeader title="다음달 제안서" description="이번 달 실제 성과를 기준으로, 다음달 예산 제안·매체별 KPI·강점과 보완할 점·인사이트가 담긴 다음달 제안서를 자동으로 만들고 PDF로 저장합니다." />
      <MonthlyReportBuilder focusMode="proposal" />
    </>
  );
}
