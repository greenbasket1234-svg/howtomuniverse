/**
 * Zero State 정책: 운영 빌드에는 샘플 데이터 생성 기능을 포함하지 않습니다.
 * 과거 화면의 호환 호출을 위해 API 이름만 유지하며 새 샘플을 절대 만들지 않습니다.
 */
import { saveSampleReports, loadSampleReports } from '../features/reports/reportCore';
import { deleteSampleMonthlyReports, loadSampleMonthlyReports } from './monthlyReportStore';

export type SeedResult = { ok: boolean; count?: number; error?: string };

export function generateSampleData(): SeedResult {
  return { ok: false, count: 0, error: 'Zero State 운영 모드에서는 샘플 데이터를 생성하지 않습니다.' };
}

export function deleteSampleData(): SeedResult {
  try {
    const reportsOk = saveSampleReports([]);
    const monthlyOk = deleteSampleMonthlyReports();
    return reportsOk && monthlyOk
      ? { ok: true, count: 0 }
      : { ok: false, error: '기존 샘플 저장값 일부를 정리하지 못했습니다.' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '기존 샘플 저장값 정리 중 오류가 발생했습니다.' };
  }
}

export function hasSampleData(): boolean {
  return loadSampleReports().length > 0 || loadSampleMonthlyReports().length > 0;
}
