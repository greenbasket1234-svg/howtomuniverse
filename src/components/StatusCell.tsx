import { MetricValue, STATUS_LABEL, DataAvailabilityStatus } from '../types/common';
import { Badge, BadgeTone } from './Badge';

const TONE_BY_STATUS: Record<Exclude<DataAvailabilityStatus, 'available'>, BadgeTone> = {
  empty: 'neutral',
  not_connected: 'warning',
  token_expired: 'danger',
  fetch_failed: 'danger',
  permission_denied: 'danger',
  unsupported: 'neutral',
};

// 실제 값이 0인 경우와 데이터가 없는 경우를 구분해서 표시합니다.
// (0, "-", 연동 대기, 토큰 만료, 수집 실패, 권한 오류, 미지원 — 3차 검토 8번 기준)
export function StatusCell({ value }: { value: MetricValue }) {
  if (value.status === 'available') {
    return <>{value.value}</>;
  }
  if (value.status === 'empty') {
    return <span style={{ color: 'var(--text-muted)' }}>{STATUS_LABEL.empty}</span>;
  }
  return <Badge tone={TONE_BY_STATUS[value.status]}>{STATUS_LABEL[value.status]}</Badge>;
}
