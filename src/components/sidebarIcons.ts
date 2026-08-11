export type SidebarEmojiIcon = {
  symbol: string;
  label: string;
};

/**
 * 사이드바 전용 이모지 아이콘 세트입니다.
 * 외부 이미지 없이 메뉴별 이모지 심볼만 표시합니다.
 */
export const SIDEBAR_EMOJI_ICONS: Record<string, SidebarEmojiIcon> = {
  dashboard: { symbol: '📊', label: '대시보드' },
  reports: { symbol: '📋', label: '보고서' },
  'monthly-reports': { symbol: '📅', label: '월간 보고서' },
  advertisers: { symbol: '👥', label: '광고주' },
  'ad-accounts': { symbol: '🔌', label: '광고계정' },
  link: { symbol: '🔗', label: '링크' },
  target: { symbol: '🎯', label: '목표' },
  'conversion-funnel': { symbol: '🔽', label: '퍼널' },
  'keyword-analysis': { symbol: '🔎', label: '검색광고' },
  'creative-library': { symbol: '🖼️', label: '소재' },
  'creative-fatigue': { symbol: '⚠️', label: '피로도' },
  'creative-reupload': { symbol: '♻️', label: '재등록' },
  palette: { symbol: '🎨', label: '제작' },
  'brands-budget': { symbol: '💰', label: '예산' },
  trend: { symbol: '📈', label: '추천' },
  campaigns: { symbol: '📣', label: '캠페인' },
  'schedule-slots': { symbol: '🗓️', label: '일정' },
  reservations: { symbol: '✅', label: '예약' },
  weather: { symbol: '🌤️', label: '시즌' },
  promotion: { symbol: '🏷️', label: '프로모션' },
  folder: { symbol: '📁', label: '업무' },
  approval: { symbol: '🛡️', label: '승인' },
  history: { symbol: '🕘', label: '로그' },
  activity: { symbol: '🗄️', label: '수집' },
  'automation-rules': { symbol: '⚡', label: '자동화' },
  send: { symbol: '📨', label: '발송' },
  'alerts-logs': { symbol: '🔔', label: '알림' },
  settings: { symbol: '⚙️', label: '설정' },
  settlement: { symbol: '🧾', label: '정산' },
  default: { symbol: '◆', label: '메뉴' },
};

export function getSidebarEmojiIcon(iconKey?: string): SidebarEmojiIcon {
  return (iconKey && SIDEBAR_EMOJI_ICONS[iconKey]) || SIDEBAR_EMOJI_ICONS.default;
}
