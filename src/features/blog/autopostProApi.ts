import { apiFetch } from '../../hooks/useApi';

export type AutopostSeat = {
  id: string;
  external_id?: string;
  name: string;
  industry: string;
  business_reg_no: string;
  plan: 'trial' | 'paid';
  trial_remaining?: number;
  status: 'active' | 'suspended';
  created_at: string;
};

export type AutopostDraft = {
  id: string;
  seat_id: string;
  title: string;
  body: string; // HTML
  tags: string[];
  meta_description: string;
  billing: {
    billable: boolean;
    plan: 'trial' | 'paid';
    quota_used: number;
    quota_limit: number;
    overage: boolean;
    overage_price_krw: number;
  };
};

export type AutopostComplianceIssue = { category: string; label: string; law: string; guide: string; matched: string[] };
export type AutopostComplianceResult = { passed: boolean; issues: AutopostComplianceIssue[] };

/** 서버가 이 에러 코드로 던지면(HTTP 409) "생성 실패"가 아니라 "과금 동의가 필요하다"는 뜻입니다. */
export class OverageConfirmRequiredError extends Error {}

export const autopostProApi = {
  status: () => apiFetch<{ configured: boolean }>('/autopost-pro/status'),
  seat: (advertiserId: string) => apiFetch<AutopostSeat>(`/autopost-pro/seat?advertiserId=${encodeURIComponent(advertiserId)}`),
  compliance: (input: { industry: string; text: string; orgName?: string }) =>
    apiFetch<AutopostComplianceResult>('/autopost-pro/compliance', { method: 'POST', body: JSON.stringify(input) }),

  async createDraft(input: { advertiserId: string; keyword: string; length?: 'short' | 'medium' | 'long' | 'auto'; numImages?: number; confirmOverage?: boolean; idempotencyKey?: string }) {
    try {
      return await apiFetch<AutopostDraft>('/autopost-pro/drafts', { method: 'POST', body: JSON.stringify(input) });
    } catch (error) {
      const code = (error as { code?: string } | undefined)?.code;
      if (code === 'overage_confirm_required') throw new OverageConfirmRequiredError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  },
};
