import { channelColor, channelLabel } from '../utils/channelColors';

/** 매체(Meta/네이버 등)를 항상 같은 색상의 작은 배지로 표시합니다. 앱 전체에서 재사용합니다. */
export function ChannelTag({ channel }: { channel: string }) {
  const color = channelColor(channel);
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 11.5, fontWeight: 750, padding: '2px 8px', borderRadius: 999,
        background: `${color}18`, color, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {channelLabel(channel)}
    </span>
  );
}

/** 네이버 캠페인 유형(파워링크/쇼핑검색/브랜드검색/플레이스 등)을 유형별로 다른 색상 배지로 표시합니다. */
const CAMPAIGN_TYPE_COLORS: Record<string, string> = {
  파워링크: '#03C75A',   // 네이버 그린 (가장 기본적인 검색 광고)
  쇼핑검색: '#F97316',   // 오렌지
  브랜드검색: '#8B5CF6', // 보라
  파워컨텐츠: '#EC4899', // 핑크
  플레이스: '#0EA5E9',   // 하늘색
};
export function CampaignTypeTag({ type }: { type?: string | null }) {
  if (!type || type === '-') return <span style={{ color: '#94a3b8' }}>-</span>;
  const color = CAMPAIGN_TYPE_COLORS[type] || '#64748b';
  return (
    <span style={{ fontSize: 11.5, fontWeight: 750, padding: '2px 8px', borderRadius: 999, background: `${color}18`, color, whiteSpace: 'nowrap' }}>
      {type}
    </span>
  );
}
