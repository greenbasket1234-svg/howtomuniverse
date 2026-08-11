import type { SidebarMenuItem } from '../types/common';

export const sidebarMenuItems: SidebarMenuItem[] = [
  { key:'dashboard',            label:'전체 대시보드',      path:'/dashboard',                  section:'overview',    activeMatch:'prefix', icon:'dashboard' },

  { key:'advertisers',          label:'광고주 관리',         path:'/advertisers',                 section:'advertiser',  activeMatch:'prefix', icon:'advertisers' },
  { key:'ad-accounts',          label:'광고계정 관리',       path:'/ad-accounts/connections',     section:'advertiser',  activeMatch:'prefix', prefixPath:'/ad-accounts', icon:'ad-accounts' },
  { key:'shared-links',         label:'광고주 공유 링크',    path:'/shared-links',                section:'advertiser',  activeMatch:'prefix', icon:'link' },

  { key:'reports',              label:'보고서 관리',         path:'/reports',                     section:'reports',     activeMatch:'prefix', prefixPath:'/reports', icon:'reports' },
  { key:'monthly-reports',      label:'월간 광고분석 보고서', path:'/monthly-reports',             section:'reports',     activeMatch:'prefix', icon:'monthly-reports' },
  { key:'next-month-proposal',  label:'다음달 제안서', path:'/next-month-proposal',         section:'reports',     activeMatch:'prefix', icon:'monthly-reports' },

  { key:'kpi-goals',            label:'KPI 목표 달성',       path:'/kpi-goals',                   section:'analysis',    activeMatch:'prefix', icon:'target' },
  { key:'conversion-funnel',    label:'전환 퍼널 분석',      path:'/conversion-funnel',           section:'analysis',    activeMatch:'prefix', icon:'conversion-funnel' },
  { key:'attribution-links',    label:'어트리뷰션 링크',     path:'/attribution-links',           section:'analysis',    activeMatch:'prefix', icon:'link' },
  { key:'search-ads',           label:'검색 광고 관리',       path:'/search-ads/naver',            section:'analysis',    activeMatch:'prefix', prefixPath:'/search-ads', icon:'keyword-analysis' },

  { key:'creative-library',     label:'소재 라이브러리',     path:'/creatives/library',           section:'creative',    activeMatch:'prefix', prefixPath:'/creatives/library', icon:'creative-library' },
  { key:'creative-fatigue',     label:'소재 피로도',         path:'/creatives/fatigue',           section:'creative',    activeMatch:'prefix', icon:'creative-fatigue' },
  { key:'creative-reupload',    label:'소재 재등록',         path:'/creatives/reupload',          section:'creative',    activeMatch:'prefix', icon:'creative-reupload' },
  { key:'creative-requests',    label:'소재 제작 요청',      path:'/creative-requests',           section:'creative',    activeMatch:'prefix', icon:'palette' },

  { key:'brands-budget',        label:'브랜드 예산',         path:'/brands-budget',               section:'budget',      activeMatch:'prefix', icon:'brands-budget' },
  { key:'budget-recommendations',label:'예산 추천',          path:'/budget-recommendations',      section:'budget',      activeMatch:'prefix', icon:'trend' },
  { key:'campaigns',            label:'캠페인 관리',         path:'/campaigns',                   section:'budget',      activeMatch:'prefix', icon:'campaigns' },

  { key:'operations-calendar',  label:'운영 캘린더',         path:'/operations-calendar/schedule',section:'calendar',    activeMatch:'prefix', prefixPath:'/operations-calendar', icon:'schedule-slots' },
  { key:'weather-season',       label:'시즌 캘린더',         path:'/operations-calendar/weather', section:'calendar',    activeMatch:'prefix', prefixPath:'/operations-calendar/weather', icon:'weather' },
  { key:'promotion-schedule',   label:'프로모션 일정',       path:'/promotion-schedule',          section:'calendar',    activeMatch:'prefix', icon:'promotion' },

  { key:'project-tasks',        label:'프로젝트 태스크',     path:'/project-tasks',               section:'work',        activeMatch:'prefix', icon:'folder' },
  { key:'approval-queue',       label:'승인 검수',           path:'/approval-queue',              section:'work',        activeMatch:'prefix', icon:'approval' },
  { key:'operations-history',   label:'작업 로그',           path:'/operations-history',          section:'work',        activeMatch:'prefix', icon:'history' },
  { key:'data-collection-status',label:'데이터 수집 현황',   path:'/data-collection-status',      section:'work',        activeMatch:'prefix', icon:'activity' },

  { key:'ad-schedule',          label:'예약 작업',           path:'/automation/scheduled-jobs',  section:'automation',  activeMatch:'prefix', icon:'schedule-slots' },
  { key:'automation',           label:'자동화 현황',         path:'/automation/overview',         section:'automation',  activeMatch:'prefix', prefixPath:'/automation/overview', icon:'automation-rules' },
  { key:'data-auto-collection', label:'데이터 자동 수집',    path:'/automation/data-collection',  section:'automation',  activeMatch:'prefix', icon:'activity' },
  { key:'report-automation',    label:'보고서 자동 생성',    path:'/automation/report-generation',section:'automation',  activeMatch:'prefix', icon:'reports' },
  { key:'copy-automation',      label:'광고 문구 자동 생성', path:'/automation/ad-copy',           section:'automation',  activeMatch:'prefix', icon:'automation-rules' },
  { key:'notification-send',    label:'알림 자동화',         path:'/automation/notifications',    section:'automation',  activeMatch:'prefix', icon:'send' },
  { key:'automation-workflows', label:'작업 흐름',           path:'/automation/workflows',        section:'automation',  activeMatch:'prefix', icon:'folder' },
  { key:'alerts',               label:'실행 기록',           path:'/automation/execution-logs',   section:'automation',  activeMatch:'prefix', prefixPath:'/automation/execution-logs', icon:'alerts-logs' },

  { key:'support-hub',           label:'홈',                 path:'/support',                     section:'support', activeMatch:'exact', icon:'folder' },
  { key:'support-knowledge',     label:'지식 라이브러리',     path:'/support/knowledge',           section:'support', activeMatch:'prefix', icon:'folder' },
  { key:'support-sales',         label:'영업 문서',           path:'/support/sales',               section:'support', activeMatch:'prefix', icon:'folder' },
  { key:'support-ops',           label:'업무 운영',           path:'/support/ops',                 section:'support', activeMatch:'prefix', icon:'folder' },
  { key:'support-news',          label:'사내 소식',           path:'/support/news',                section:'support', activeMatch:'prefix', icon:'folder' },
  { key:'support-security',      label:'계정 보안',           path:'/support/security',            section:'support', activeMatch:'prefix', icon:'approval' },
  { key:'commission-settlement', label:'수당 및 수수료 정산', path:'/commission-settlement',       section:'settlement',  activeMatch:'prefix', icon:'settlement' },

  { key:'settings',             label:'환경설정',            path:'/settings',                    section:'management',  activeMatch:'prefix', prefixPath:'/settings', icon:'settings' },
];

/** 광고주 필터바를 숨길 경로 목록 */
const FILTER_HIDDEN_PATHS = ['/home', '/settings', '/admin', '/content', '/assets', '/planned', '/login'];

export function shouldShowFilterBar(pathname: string): boolean {
  return !FILTER_HIDDEN_PATHS.some(p => pathname.startsWith(p));
}
