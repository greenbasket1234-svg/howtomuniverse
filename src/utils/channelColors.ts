/**
 * 매체(채널)별 색상·이름을 한 곳에서 관리합니다. 여러 화면에서 이 파일을 가져다 써서
 * "Meta는 항상 파란색, 네이버는 항상 초록색"처럼 앱 전체에서 색상이 일관되게 보이도록 합니다.
 * 색상은 각 매체의 공식 브랜드 컬러를 기준으로 했습니다.
 */
export const CHANNEL_COLORS: Record<string, string> = {
  meta: '#1877F2',   // Meta 공식 브랜드 블루
  naver: '#03C75A',  // 네이버 공식 그린
  google: '#4285F4', // 구글 블루
  kakao: '#FEE500',  // 카카오 옐로우
  daangn: '#FF6F0F', // 당근 오렌지
  karrot: '#FF6F0F', // 당근(영문 표기 다른 곳에서 karrot을 씀)
  tiktok: '#111827', // 틱톡 블랙
  youtube: '#FF0000',
  instagram: '#E1306C',
  blog: '#2DB400', // 네이버 블로그 그린
};

export const CHANNEL_LABELS: Record<string, string> = {
  meta: 'Meta', naver: '네이버', google: '구글', kakao: '카카오', daangn: '당근', karrot: '당근',
  tiktok: '틱톡', youtube: 'YouTube', instagram: 'Instagram', blog: '블로그',
};

/** 한글 매체명(메타/네이버 등)으로도 색상을 찾을 수 있도록 별칭을 함께 둡니다. */
const ALIAS_TO_KEY: Record<string, string> = {
  메타: 'meta', 네이버: 'naver', 구글: 'google', '구글 검색': 'google', 카카오: 'kakao', 당근: 'daangn', 틱톡: 'tiktok',
};

function resolveKey(channel: string): string {
  const lower = (channel || '').trim().toLowerCase();
  if (CHANNEL_COLORS[lower]) return lower;
  return ALIAS_TO_KEY[channel?.trim()] || lower;
}

export function channelColor(channel: string): string {
  return CHANNEL_COLORS[resolveKey(channel)] || '#64748b';
}

export function channelLabel(channel: string): string {
  const key = resolveKey(channel);
  return CHANNEL_LABELS[key] || channel;
}

/** 카카오(#FEE500)는 배경이 밝은 노란색이라 흰 글씨가 잘 안 보여서, 텍스트 색을 따로 계산합니다. */
export function channelTextColor(channel: string): string {
  return resolveKey(channel) === 'kakao' ? '#3c1e1e' : '#fff';
}
