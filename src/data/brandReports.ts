import type { BrandReportConfig, BrandDailyData } from '../types/brandReport';

/**
 * Zero State: 광고 성과 데이터는 더 이상 프론트에 샘플로 포함하지 않습니다.
 * 실제 데이터는 백엔드/API 수집 이후 채워집니다.
 */
export const DATES_JUL_1_TO_12: string[] = [];
export const BRAND_REPORTS: { config: BrandReportConfig; data: BrandDailyData }[] = [];
