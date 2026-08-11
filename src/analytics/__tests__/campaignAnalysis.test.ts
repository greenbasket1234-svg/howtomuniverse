import { describe, it, expect } from 'vitest';
import { campaignStatusLabel } from '../campaignAnalysis';
import type { CampaignStatus } from '../../types/operations';

describe('campaignStatusLabel', () => {
  const cases: Array<[CampaignStatus, string]> = [
    ['on', '운영 중'],
    ['off', '중지'],
    ['scheduled', '예약 대기'],
    ['review', '심사 중'],
    ['error', '오류'],
    ['unsupported', '지원 불가'],
  ];

  it.each(cases)('status "%s"는 "%s"로 표시된다', (status, expected) => {
    expect(campaignStatusLabel(status)).toBe(expected);
  });
});
