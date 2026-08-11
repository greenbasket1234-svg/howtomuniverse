import { PageHeader } from '../components/PageHeader';
import { MonthlyReportBuilder } from '../components/monthlyReport/MonthlyReportBuilder';

export function MonthlyReportManagementPage() {
  return (
    <>
      <PageHeader title="월간 보고서" description="광고주별 월간 마케팅 성과를 KPI·매체별 성과표·차트·인사이트로 자동 구성하고 PDF로 저장합니다. 저장된 보고서는 다시 열어 수정하거나 복제할 수 있습니다." />
      <MonthlyReportBuilder focusMode="report" />
    </>
  );
}
