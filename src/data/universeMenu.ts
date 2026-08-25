export type UniverseMenuItem = {
  key: string;
  label: string;
  path: string;
  icon?: string;
  prefixPath?: string;
  badge?: string;
  planned?: boolean;
  /** true면 내부 라우팅(Link)이 아니라 완전히 다른 배포 서비스로 이동하는 외부 링크로 취급합니다. */
  external?: boolean;
};

/** 콘텐츠 제작소(별도 배포 서비스)의 실제 주소입니다. 빌드 시점에 VITE_CONTENT_STUDIO_URL로 지정합니다. */
const CONTENT_STUDIO_URL = import.meta.env?.VITE_CONTENT_STUDIO_URL || 'https://content.howtom.example.com';

export type UniverseMenuGroup = {
  key: 'home' | 'operations' | 'insights' | 'content' | 'automation' | 'assets' | 'advertisers' | 'settings' | 'admin';
  label: string;
  path: string;
  planet: 'earth' | 'jupiter' | 'neptune' | 'saturn' | 'mars' | 'uranus' | 'venus' | 'mercury' | 'pluto';
  items: UniverseMenuItem[];
  adminOnly?: boolean;
};

/**
 * 사이드바에서는 한 기능을 한 위치에만 노출합니다.
 * 다른 메뉴에서 같은 기능이 필요하면 해당 화면의 바로가기 카드로 연결합니다.
 */
export const universeMenuGroups: UniverseMenuGroup[] = [
  {
    key: 'home', label: '홈', path: '/home', planet: 'earth',
    items: [
      { key: 'home-overview', label: '통합 홈', path: '/home', icon: 'dashboard' },
      { key: 'today-operations', label: '오늘의 업무', path: '/today-operations', icon: 'folder' },
    ],
  },
  {
    key: 'operations', label: '운영센터', path: '/dashboard', planet: 'jupiter',
    items: [
      { key: 'dashboard', label: '전체 대시보드', path: '/dashboard', icon: 'dashboard' },
      { key: 'ad-data', label: '광고 데이터', path: '/reports', icon: 'reports' },
      { key: 'db-data', label: 'DB 데이터', path: '/db-management', icon: 'activity' },
      { key: 'kpi-goals', label: 'KPI 관리', path: '/kpi-goals', icon: 'target' },
      { key: 'campaigns', label: '캠페인 관리', path: '/campaigns', icon: 'campaigns' },
      { key: 'keywords', label: '키워드 관리', path: '/keywords', icon: 'keyword-analysis' },
      { key: 'creative-library', label: '소재 관리', path: '/creatives/library', icon: 'creative-library' },
      { key: 'conversion-funnel', label: '전환 퍼널', path: '/conversion-funnel', icon: 'conversion-funnel' },
      { key: 'operations-calendar', label: '광고 캘린더', path: '/operations-calendar/schedule', prefixPath: '/operations-calendar', icon: 'schedule-slots' },
      { key: 'brands-budget', label: '브랜드 예산', path: '/brands-budget', icon: 'brands-budget' },
      { key: 'report-center', label: '보고서', path: '/report-center', prefixPath: '/report-center', icon: 'reports' },
      { key: 'monthly-reports', label: '월간 보고서', path: '/monthly-reports', icon: 'reports' },
      { key: 'next-month-proposal', label: '다음달 제안서', path: '/next-month-proposal', icon: 'reports' },
      { key: 'commission-settlement', label: '수당 수수료', path: '/commission-settlement', icon: 'settlement' },
    ],
  },
  {
    key: 'insights', label: '인사이트', path: '/insights', planet: 'neptune',
    items: [
      { key: 'insights-home', label: '인사이트 홈', path: '/insights', icon: 'trend' },
      { key: 'integrated-performance', label: '통합 성과 분석', path: '/insights/performance', icon: 'trend' },
      { key: 'media-analysis', label: '매체별 분석', path: '/insights/media', icon: 'trend' },
      { key: 'advertiser-analysis', label: '광고주별 분석', path: '/insights/advertisers', icon: 'advertisers' },
      { key: 'campaign-analysis', label: '캠페인 분석', path: '/insights/campaigns', icon: 'campaigns' },
      { key: 'creative-analysis', label: '소재 분석', path: '/insights/creatives', icon: 'creative-library' },
      { key: 'customer-analysis', label: '고객 분석', path: '/customer-analytics', icon: 'advertisers' },
      { key: 'budget-recommendations', label: '예산 추천', path: '/budget-recommendations', icon: 'trend' },
      { key: 'competitor-analysis', label: '경쟁사 분석', path: '/insights/competitors', icon: 'trend' },
      { key: 'ad-trends', label: '광고 트렌드', path: '/insights/trends', icon: 'trend' },
      { key: 'hook-cta', label: '후킹 CTA 분석', path: '/insights/hook-cta', icon: 'trend' },
      { key: 'ai-recommendations', label: 'AI 추천', path: '/insights/ai-recommendations', icon: 'automation-rules' },
    ],
  },
  {
    key: 'content', label: '콘텐츠', path: '/content', planet: 'saturn',
    items: [
      { key: 'content-studio', label: '콘텐츠 제작소 ↗', path: CONTENT_STUDIO_URL, icon: 'palette', external: true },
      { key: 'content-home', label: '콘텐츠 홈', path: '/content', icon: 'palette' },
      { key: 'references', label: '레퍼런스', path: '/content/references', icon: 'creative-library' },
      { key: 'ad-creation', label: '광고 제작', path: '/content/ad-creation', icon: 'palette' },
      { key: 'blog-writing', label: '블로그 제작', path: '/content/blog', icon: 'folder' },
      { key: 'image-creation', label: '이미지 제작', path: '/planned/image-creation', icon: 'creative-library', planned: true },
      { key: 'video-script', label: '영상 대본', path: '/content/video-scripts', icon: 'creative-library' },
      { key: 'document-writing', label: '문서 작성', path: '/content/documents', icon: 'folder' },
      { key: 'content-library', label: '제작물 보관함', path: '/content/productions', icon: 'folder' },
      { key: 'content-templates', label: '템플릿', path: '/content/templates', icon: 'folder' },
    ],
  },
  {
    key: 'automation', label: 'AI 자동화', path: '/automation/overview', planet: 'mars',
    items: [
      { key: 'automation-overview', label: '자동화 현황', path: '/automation/overview', icon: 'automation-rules' },
      { key: 'scheduled-jobs', label: '예약 작업', path: '/automation/scheduled-jobs', icon: 'schedule-slots' },
      { key: 'data-auto-collection', label: '데이터 자동 수집', path: '/automation/data-collection', icon: 'activity' },
      { key: 'report-automation', label: '보고서 자동 생성', path: '/automation/report-generation', icon: 'reports' },
      { key: 'reference-automation', label: '레퍼런스 자동 수집', path: '/planned/reference-automation', icon: 'automation-rules', planned: true },
      { key: 'copy-automation', label: '광고 문구 자동 생성', path: '/automation/ad-copy', icon: 'automation-rules' },
      { key: 'approval-automation', label: '승인 요청 자동화', path: '/planned/approval-automation', icon: 'approval', planned: true },
      { key: 'notification-automation', label: '알림 자동화', path: '/automation/notifications', icon: 'send' },
      { key: 'automation-workflows', label: '작업 흐름', path: '/automation/workflows', icon: 'folder' },
      { key: 'automation-history', label: '실행 기록', path: '/automation/execution-logs', icon: 'history' },
    ],
  },
  {
    key: 'assets', label: '자산관리', path: '/assets', planet: 'uranus',
    items: [
      { key: 'assets-home', label: '전체 자산', path: '/assets', icon: 'folder' },
      { key: 'asset-images', label: '이미지', path: '/assets/images', icon: 'creative-library' },
      { key: 'asset-videos', label: '영상', path: '/assets/videos', icon: 'creative-library' },
      { key: 'asset-documents', label: '문서', path: '/assets/documents', icon: 'folder' },
      { key: 'asset-creatives', label: '광고 소재', path: '/assets/creatives', icon: 'creative-library' },
      { key: 'brand-assets', label: '로고 브랜드 자료', path: '/planned/brand-assets', icon: 'folder', planned: true },
      { key: 'asset-templates', label: '템플릿', path: '/planned/asset-templates', icon: 'folder', planned: true },
      { key: 'asset-prompts', label: '프롬프트', path: '/planned/prompts', icon: 'automation-rules', planned: true },
      { key: 'advertiser-folders', label: '광고주별 폴더', path: '/assets/advertisers', icon: 'folder' },
      { key: 'asset-trash', label: '휴지통', path: '/assets/trash', icon: 'history' },
    ],
  },
  {
    key: 'advertisers', label: '광고주', path: '/advertisers', planet: 'venus',
    items: [
      { key: 'advertiser-management', label: '광고주 목록 등록', path: '/advertisers', icon: 'advertisers' },
      { key: 'advertiser-dashboard', label: '광고주 대시보드', path: '/advertisers/dashboard', icon: 'dashboard' },
      { key: 'advertiser-owner', label: '담당자', path: '/advertisers/contacts', icon: 'advertisers' },
      { key: 'advertiser-subscription', label: '계약 구독', path: '/advertisers/subscription', icon: 'settlement' },
      { key: 'advertiser-permission', label: '기능 권한', path: '/advertisers/permissions', icon: 'approval' },
      { key: 'advertiser-approval', label: '승인 요청', path: '/advertisers/approvals', icon: 'approval' },
      { key: 'advertiser-share', label: '공유 자료', path: '/advertisers/shared-materials', icon: 'link' },
      { key: 'advertiser-activity', label: '활동 기록', path: '/advertisers/activity', icon: 'history' },
      { key: 'advertiser-portal', label: '광고주 접속 화면', path: '/advertisers/portal-preview', icon: 'dashboard' },
    ],
  },
  {
    key: 'admin', label: '관리자', path: '/admin', planet: 'pluto', adminOnly: true,
    items: [
      { key: 'admin-home', label: '관리자 대시보드', path: '/admin', icon: 'approval' },
      { key: 'admin-users', label: '사용자 관리', path: '/admin/users', icon: 'advertisers' },
      { key: 'admin-advertisers', label: '광고주 관리', path: '/admin/advertisers', icon: 'advertisers' },
      { key: 'admin-roles', label: '권한 묶음 관리', path: '/admin/roles', icon: 'approval' },
      { key: 'admin-feature-permissions', label: '기능별 이용 권한', path: '/admin/feature-permissions', icon: 'approval' },
      { key: 'admin-plans', label: '구독 상품 관리', path: '/admin/plans', icon: 'settlement' },
      { key: 'admin-payments', label: '결제 내역', path: '/admin/payments', icon: 'settlement' },
      { key: 'admin-ai-usage', label: 'AI 사용량', path: '/admin/ai-usage', icon: 'automation-rules' },
      { key: 'admin-storage', label: '저장 공간 사용량', path: '/admin/storage', icon: 'folder' },
      { key: 'admin-executions', label: '작업 실행 기록', path: '/admin/executions', icon: 'history' },
      { key: 'admin-security', label: '접속 보안 기록', path: '/admin/security', icon: 'approval' },
      { key: 'admin-notices', label: '공지사항', path: '/admin/notices', icon: 'alerts-logs' },
      { key: 'admin-menu', label: '메뉴 관리', path: '/admin/menu', icon: 'settings' },
      { key: 'admin-flags', label: '기능 공개 설정', path: '/admin/feature-flags', icon: 'settings' },
      { key: 'admin-backup', label: '데이터 백업', path: '/admin/backup', icon: 'activity' },
      { key: 'admin-system', label: '시스템 설정', path: '/admin/system', icon: 'settings' },
    ],
  },
  {
    key: 'settings', label: '설정', path: '/settings', planet: 'mercury',
    items: [
      { key: 'settings-account', label: '내 정보', path: '/settings/control/account', icon: 'advertisers' },
      { key: 'settings-company', label: '회사 정보', path: '/settings/control/company', icon: 'settings' },
      { key: 'settings-team', label: '팀원 관리', path: '/settings/control/team', icon: 'advertisers' },
      { key: 'settings-display', label: '화면 설정', path: '/settings/control/display', icon: 'settings' },
      { key: 'settings-notifications', label: '알림 설정', path: '/settings/control/notifications', icon: 'alerts-logs' },
      { key: 'settings-integrations', label: '매체 계정 연동', path: '/settings/control/integrations', icon: 'ad-accounts' },
      { key: 'settings-metrics', label: '지표 설정', path: '/settings/control/metrics', icon: 'target' },
      { key: 'settings-report', label: '보고서 설정', path: '/settings/control/reports', icon: 'reports' },
      { key: 'settings-content', label: '콘텐츠 설정', path: '/settings/control/content', icon: 'creative-library' },
      { key: 'settings-ai', label: 'AI 설정', path: '/settings/control/ai', icon: 'automation-rules' },
      { key: 'settings-automation', label: '자동화 설정', path: '/settings/control/automation', icon: 'automation-rules' },
      { key: 'settings-storage', label: '저장 공간', path: '/settings/control/storage', icon: 'folder' },
      { key: 'settings-subscription', label: '구독 결제', path: '/settings/control/subscription', icon: 'settlement' },
      { key: 'settings-security', label: '보안', path: '/settings/control/security', icon: 'approval' },
    ],
  },
];

export const universePermissionItems = universeMenuGroups.flatMap(group =>
  group.items.map(item => ({ key: item.key, label: `${group.label} ${item.label}` })),
);

export function isUniverseItemActive(pathname: string, item: UniverseMenuItem): boolean {
  const matchPath = item.prefixPath ?? item.path;
  if (matchPath === '/home') return pathname === '/home';
  return pathname === item.path || pathname.startsWith(`${matchPath}/`);
}

export function activeUniverseGroup(pathname: string): UniverseMenuGroup['key'] {
  if (pathname === '/home' || pathname.startsWith('/today-operations')) return 'home';
  if (pathname.startsWith('/insights') || pathname.startsWith('/customer-analytics') || pathname.startsWith('/budget-recommendations')) return 'insights';
  if (pathname === '/content' || pathname.startsWith('/content/') || pathname.startsWith('/creative-requests') || pathname.startsWith('/support/sales')) return 'content';
  if (pathname === '/assets' || pathname.startsWith('/assets/')) return 'assets';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname.startsWith('/planned/')) {
    const item = universeMenuGroups.flatMap(group => group.items.map(item => ({ group, item }))).find(({ item }) => item.path === pathname);
    return item?.group.key ?? 'content';
  }
  if (pathname.startsWith('/automation') || pathname.startsWith('/ad-schedule') || pathname.startsWith('/notification-send') || pathname.startsWith('/operations-history') || pathname.startsWith('/ad-accounts/data-sync')) return 'automation';
  if (pathname.startsWith('/advertisers') || pathname.startsWith('/approval-queue') || pathname.startsWith('/shared-links') || pathname.startsWith('/settings/advertisers')) return 'advertisers';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'operations';
}
