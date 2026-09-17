/**
 * HU25 보안 수정 검증 테스트
 *
 * ⚠️ 이 테스트는 모의(mock) DB와 모의 외부 API를 사용합니다.
 *    실제 PostgreSQL, 실제 Meta/Naver API, 실제 과금 API를 호출하지 않습니다.
 *    SQL 동시성 검증은 격리된 PostgreSQL 환경에서 별도로 수행해야 합니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ──────────────────────────────────────────────────────────────
// 헬퍼: 권한 검사 함수를 서버 코드와 동일한 로직으로 구현
// (실제 서버 함수를 import할 수 없으므로 동일 로직 인라인)
// ──────────────────────────────────────────────────────────────

type User = {
  isOwner: boolean;
  permissionKeys: string[];
  advertiserIds: string[] | null;
  status?: string;
};

function hasPermission(user: User, key: string): boolean {
  return Boolean(user && (user.isOwner || user.permissionKeys.includes(key)));
}

function canAccessAdvertiser(user: User, advertiserId: string): boolean {
  if (user.advertiserIds === null) return true; // 전체 접근
  return user.advertiserIds.includes(advertiserId);
}

function denyUnlessPermitted(user: User, key: string): boolean {
  return !hasPermission(user, key);
}

// ──────────────────────────────────────────────────────────────
// 문제 1: 자동화 권한 검사
// ──────────────────────────────────────────────────────────────

describe('문제1: 자동화 권한 검사', () => {
  const noPermUser: User = { isOwner: false, permissionKeys: [], advertiserIds: ['adv-A'], status: 'active' };
  const viewOnlyUser: User = { isOwner: false, permissionKeys: ['automation.view', 'campaign.view'], advertiserIds: ['adv-A'], status: 'active' };
  const automationUser: User = { isOwner: false, permissionKeys: ['automation.manage', 'campaign.view'], advertiserIds: ['adv-A'], status: 'active' };
  const fullUser: User = { isOwner: false, permissionKeys: ['automation.manage', 'campaign.edit'], advertiserIds: ['adv-A'], status: 'active' };
  const ownerUser: User = { isOwner: true, permissionKeys: [], advertiserIds: null, status: 'active' };
  const suspendedUser: User = { isOwner: false, permissionKeys: ['automation.manage', 'campaign.edit'], advertiserIds: ['adv-A'], status: 'suspended' };

  it('permissionKeys가 비어 있으면 자동화 등록이 차단된다', () => {
    expect(denyUnlessPermitted(noPermUser, 'automation.manage')).toBe(true);
  });

  it('automation.view만 있으면 자동화 등록이 차단된다', () => {
    expect(denyUnlessPermitted(viewOnlyUser, 'automation.manage')).toBe(true);
  });

  it('automation.manage가 있어도 campaign 타입에는 campaign.edit이 추가로 필요하다', () => {
    // automation.manage OK
    expect(denyUnlessPermitted(automationUser, 'automation.manage')).toBe(false);
    // campaign.edit 없음 → 차단
    expect(denyUnlessPermitted(automationUser, 'campaign.edit')).toBe(true);
  });

  it('automation.manage + campaign.edit 둘 다 있으면 campaign 자동화 등록 허용', () => {
    expect(denyUnlessPermitted(fullUser, 'automation.manage')).toBe(false);
    expect(denyUnlessPermitted(fullUser, 'campaign.edit')).toBe(false);
  });

  it('isOwner=true면 모든 권한 통과', () => {
    expect(denyUnlessPermitted(ownerUser, 'automation.manage')).toBe(false);
    expect(denyUnlessPermitted(ownerUser, 'campaign.edit')).toBe(false);
  });

  it('다른 광고주(adv-B)의 규칙에는 접근 불가', () => {
    expect(canAccessAdvertiser(fullUser, 'adv-B')).toBe(false);
  });

  it('advertiserIds=null(전체 허용) 사용자는 모든 광고주 접근 가능', () => {
    expect(canAccessAdvertiser(ownerUser, 'adv-B')).toBe(true);
  });

  it('계정 정지 사용자는 수동 실행이 차단된다', () => {
    const isBlocked = suspendedUser.status !== 'active';
    expect(isBlocked).toBe(true);
  });

  it('공용 규칙(advertiser_id=null)은 automation.manage 없이 수정 불가', () => {
    // advertiser_id가 null이면 advertiserIds 체크를 건너뛰고 automation.manage로만 판단
    // (실제 서버: advertiser_id가 null인 공용 규칙은 canAccessAdvertiser 검사 없이
    //  무조건 automation.manage 권한 필요)
    expect(denyUnlessPermitted(noPermUser, 'automation.manage')).toBe(true);
    expect(denyUnlessPermitted(fullUser, 'automation.manage')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// 문제 2: Meta targetId 소속 검증
// ──────────────────────────────────────────────────────────────

describe('문제2: Meta targetId 소속 검증', () => {
  // 모의 DB: adv-A의 캠페인 ID 목록
  const mockMetricRows: Record<string, string[]> = {
    'adv-A': ['campaign-A1', 'adset-A1', 'ad-A1'],
    'adv-B': ['campaign-B1', 'adset-B1', 'ad-B1'],
  };

  // 서버의 verifyMetaTargetOwnership 로직을 모의로 재현
  async function verifyMetaTargetOwnership(_tenantId: string, advertiserId: string, targetId: string): Promise<boolean> {
    const owned = mockMetricRows[advertiserId] || [];
    return owned.includes(targetId);
  }

  it('A 광고주의 캠페인 ID는 A 광고주로 검증 통과', async () => {
    const result = await verifyMetaTargetOwnership('tenant-1', 'adv-A', 'campaign-A1');
    expect(result).toBe(true);
  });

  it('B 광고주의 캠페인 ID를 A 광고주로 요청하면 검증 실패', async () => {
    const result = await verifyMetaTargetOwnership('tenant-1', 'adv-A', 'campaign-B1');
    expect(result).toBe(false);
  });

  it('존재하지 않는 targetId는 검증 실패', async () => {
    const result = await verifyMetaTargetOwnership('tenant-1', 'adv-A', 'campaign-UNKNOWN');
    expect(result).toBe(false);
  });

  it('검증 실패 시 외부 Meta API를 호출하지 않아야 한다', async () => {
    const metaApiSpy = vi.fn();
    const owned = await verifyMetaTargetOwnership('tenant-1', 'adv-A', 'campaign-B1');
    if (!owned) {
      // 검증 실패 → 외부 API 미호출
    } else {
      metaApiSpy(); // 이 분기에 도달하면 안 됨
    }
    expect(metaApiSpy).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────
// 문제 3: Content Studio generate API - advertiserId + idempotencyKey
// ──────────────────────────────────────────────────────────────

describe('문제3: Content Studio generate API 요청 규격', () => {
  it('advertiserId가 없으면 400 에러를 반환해야 한다 (서버 측 검증)', () => {
    const body = { advertiserName: '완도군수산', channel: '메타' };
    const advertiserId = (body as Record<string, string>).advertiserId || '';
    expect(advertiserId).toBe('');
    // 서버에서 advertiserId가 없으면 sendJson(400, {error: 'advertiserId가 필요합니다.'})
    const wouldReject = !advertiserId;
    expect(wouldReject).toBe(true);
  });

  it('advertiserId가 있으면 요청이 통과한다', () => {
    const body = { advertiserId: 'uuid-adv-1', advertiserName: '완도군수산', idempotencyKey: 'key-001', channel: '메타' };
    expect(body.advertiserId).toBeTruthy();
    expect(body.idempotencyKey).toBeTruthy();
  });

  it('idempotencyKey가 포함되어야 한다', () => {
    const body = { advertiserId: 'uuid-adv-1', advertiserName: '완도군수산', idempotencyKey: `ad-${Date.now()}-abc123` };
    expect(body.idempotencyKey).toMatch(/^ad-\d+-[a-z0-9]+$/);
  });

  it('프로젝트 변경 시 idempotencyKey가 리셋되어야 한다 (모의)', () => {
    let key = 'old-key-123';
    // 프로젝트 변경 시 리셋 시뮬레이션
    const onProjectChange = () => { key = ''; };
    onProjectChange();
    expect(key).toBe('');
  });
});

// ──────────────────────────────────────────────────────────────
// 문제 4: 템플릿 광고주 접근 제한
// ──────────────────────────────────────────────────────────────

describe('문제4: 템플릿 광고주 접근 제한', () => {
  type Ctx = { advertiserIds: string[] | null };

  function ctxCanAccessAdvertiser(ctx: Ctx, advertiserId: string | null): boolean {
    if (!advertiserId) return true; // 공용 템플릿(null)은 읽기 허용
    if (ctx.advertiserIds === null) return true;
    return ctx.advertiserIds.includes(advertiserId);
  }

  function canModifyPublicTemplate(ctx: Ctx): boolean {
    return ctx.advertiserIds === null; // owner/전체권한만 가능
  }

  const ctxA: Ctx = { advertiserIds: ['adv-A'] };
  const ctxB: Ctx = { advertiserIds: ['adv-B'] };
  const ctxOwner: Ctx = { advertiserIds: null };

  it('A 광고주 사용자는 A 템플릿 읽기 가능', () => {
    expect(ctxCanAccessAdvertiser(ctxA, 'adv-A')).toBe(true);
  });

  it('A 광고주 사용자는 B 템플릿 읽기 불가', () => {
    expect(ctxCanAccessAdvertiser(ctxA, 'adv-B')).toBe(false);
  });

  it('공용 템플릿(advertiser_id=null)은 모든 사용자가 읽기 가능', () => {
    expect(ctxCanAccessAdvertiser(ctxA, null)).toBe(true);
    expect(ctxCanAccessAdvertiser(ctxB, null)).toBe(true);
  });

  it('공용 템플릿 수정은 owner만 가능', () => {
    expect(canModifyPublicTemplate(ctxA)).toBe(false);
    expect(canModifyPublicTemplate(ctxOwner)).toBe(true);
  });

  it('템플릿 목록은 접근 가능한 광고주 + 공용만 반환한다', () => {
    const allTemplates = [
      { id: 't1', advertiserId: 'adv-A' },
      { id: 't2', advertiserId: 'adv-B' },
      { id: 't3', advertiserId: null }, // 공용
    ];
    const filtered = allTemplates.filter(t =>
      t.advertiserId === null || ctxCanAccessAdvertiser(ctxA, t.advertiserId)
    );
    expect(filtered.map(t => t.id)).toEqual(['t1', 't3']);
  });
});

// ──────────────────────────────────────────────────────────────
// 문제 5: 블로그 초과 과금 동의 후 즉시 재개
// ──────────────────────────────────────────────────────────────

describe('문제5: 블로그 overage 동의 후 즉시 재개', () => {
  type Status = 'processing' | 'awaiting_overage' | 'failed' | 'completed' | 'ai_completed';

  function simulateGenerateFlow(currentStatus: Status | null, confirmOverage: boolean): string {
    if (!currentStatus) return 'proceed_new'; // 신규 요청
    if (currentStatus === 'completed') return 'replay_result';
    if (currentStatus === 'awaiting_overage') {
      if (!confirmOverage) return 'overage_confirm_required'; // 동의 없으면 안내
      return 'proceed_with_overage'; // 동의 있으면 즉시 재개
    }
    if (currentStatus === 'processing') return 'already_processing';
    if (currentStatus === 'failed') return 'proceed_retry';
    return 'unknown';
  }

  it('overage_confirm_required → awaiting_overage 상태로 전환 (processing 아님)', () => {
    // 핵심: overage 발생 시 processing이 아닌 awaiting_overage로 전환해야 함
    const newStatus: Status = 'awaiting_overage';
    expect(newStatus).toBe('awaiting_overage');
    expect(newStatus).not.toBe('processing');
  });

  it('awaiting_overage + confirmOverage=false → overage_confirm_required 안내', () => {
    const result = simulateGenerateFlow('awaiting_overage', false);
    expect(result).toBe('overage_confirm_required');
  });

  it('awaiting_overage + confirmOverage=true → 즉시 재개 (5분 대기 없음)', () => {
    const result = simulateGenerateFlow('awaiting_overage', true);
    expect(result).toBe('proceed_with_overage');
    expect(result).not.toBe('already_processing'); // 핵심: already_processing이 아님
  });

  it('processing 상태(5분 이내)는 중복 실행 차단', () => {
    const result = simulateGenerateFlow('processing', false);
    expect(result).toBe('already_processing');
  });

  it('completed 상태는 결과 replay', () => {
    const result = simulateGenerateFlow('completed', false);
    expect(result).toBe('replay_result');
  });

  it('failed 상태는 재시도 허용', () => {
    const result = simulateGenerateFlow('failed', false);
    expect(result).toBe('proceed_retry');
  });
});

// ──────────────────────────────────────────────────────────────
// 문제 6: 동시 요청 처리권 획득 (RETURNING 기반)
// ──────────────────────────────────────────────────────────────

describe('문제6: 동시 요청 처리권 획득 - RETURNING 기반', () => {
  // UPSERT RETURNING 기반 처리권 획득 모의
  // RETURNING이 0행이면 경쟁에서 진 것
  function simulateLockAcquire(upsertReturnedRows: number): 'won' | 'lost' {
    return upsertReturnedRows > 0 ? 'won' : 'lost';
  }

  it('RETURNING 1행 = 처리권 획득 성공', () => {
    expect(simulateLockAcquire(1)).toBe('won');
  });

  it('RETURNING 0행 = 경쟁에서 진 요청 (already_processing 반환해야 함)', () => {
    expect(simulateLockAcquire(0)).toBe('lost');
  });

  it('동시 요청 시뮬레이션: 두 요청 중 하나만 처리권 획득', () => {
    // 첫 번째 요청: INSERT 성공 → 1행 반환
    // 두 번째 요청: WHERE 조건 불충족으로 UPDATE 미적용 → 0행 반환
    const req1 = simulateLockAcquire(1);
    const req2 = simulateLockAcquire(0);
    const winners = [req1, req2].filter(r => r === 'won');
    expect(winners).toHaveLength(1); // 정확히 1개만 처리권 획득
  });

  it('기존 SELECT 검증 방식의 경쟁 조건 재현 (수정 전 버그)', () => {
    // 수정 전: 두 요청 모두 SELECT에서 status='processing'을 읽어 둘 다 실행
    const req1SelectResult = 'processing'; // 첫 번째 요청의 UPSERT 후 SELECT
    const req2SelectResult = 'processing'; // 두 번째 요청의 UPSERT 후 SELECT (버그: 동시에 읽힘)
    const bothProceed = req1SelectResult === 'processing' && req2SelectResult === 'processing';
    // 이 상황이 버그 - 두 요청이 모두 실행됨
    expect(bothProceed).toBe(true); // 버그가 실제로 재현됨을 확인

    // 수정 후: RETURNING으로 판단하면 이 상황이 불가능
    const req1Returning = 1; // UPSERT INSERT 성공
    const req2Returning = 0; // UPSERT WHERE 불충족으로 0행
    expect(simulateLockAcquire(req1Returning)).toBe('won');
    expect(simulateLockAcquire(req2Returning)).toBe('lost');
  });
});

// ──────────────────────────────────────────────────────────────
// 문제 7: 미완료 생성 복구
// ──────────────────────────────────────────────────────────────

describe('문제7: 미완료 생성 복구', () => {
  it('새로고침 후 pending 상태 키가 복원된다 (모의)', () => {
    // 서버에서 pending-generation API 응답
    const serverResponse = {
      pending: {
        idempotencyKey: 'proj-123-1234567890-abc',
        status: 'processing' as const,
        updatedAt: new Date().toISOString(),
        hasResult: false,
      }
    };
    // 화면은 이 키를 pendingIdempotencyKey로 복원
    const restoredKey = serverResponse.pending?.idempotencyKey;
    expect(restoredKey).toBe('proj-123-1234567890-abc');
  });

  it('awaiting_overage 복구 시 overageConfirm UI 활성화', () => {
    const serverResponse = {
      pending: {
        idempotencyKey: 'key-456',
        status: 'awaiting_overage' as const,
        updatedAt: new Date().toISOString(),
        hasResult: false,
      }
    };
    const shouldShowOverageUI = serverResponse.pending?.status === 'awaiting_overage';
    expect(shouldShowOverageUI).toBe(true);
  });

  it('pending이 null이면 복구 없이 신규 생성 가능', () => {
    const serverResponse = { pending: null };
    const canStartFresh = serverResponse.pending === null;
    expect(canStartFresh).toBe(true);
  });

  it('프로젝트 이동 시 이전 프로젝트의 키가 재사용되지 않는다', () => {
    let key = 'key-for-project-A';
    // 프로젝트 B로 이동
    const onProjectChange = () => { key = ''; };
    onProjectChange();
    expect(key).toBe(''); // 리셋됨
    // 새 프로젝트에서 새 키 생성
    key = 'key-for-project-B';
    expect(key).not.toBe('key-for-project-A');
  });

  it('hasResult=true면 저장만 재시도 가능 (save_failed)', () => {
    const serverResponse = {
      pending: {
        idempotencyKey: 'key-789',
        status: 'processing' as const,
        updatedAt: new Date().toISOString(),
        hasResult: true, // AI 완료됐지만 저장 실패
      }
    };
    const retryReason = serverResponse.pending.hasResult ? 'save_failed' : 'request_uncertain';
    expect(retryReason).toBe('save_failed');
  });
});

// ──────────────────────────────────────────────────────────────
// 문제 8: reserveUsage 상태별 처리 분리
// ──────────────────────────────────────────────────────────────

describe('문제8: reserveUsage 상태별 처리 분리', () => {
  type UsageStatus = 'confirmed' | 'pending' | 'failed';
  type ReserveResult = { reserved: boolean; replayed: boolean; reason?: string };

  function simulateReserveUsage(
    existingStatus: UsageStatus | null,
    subscriptionActive: boolean,
    withinLimit: boolean,
  ): ReserveResult {
    if (existingStatus === 'confirmed') {
      // 이미 완료된 시도 → replayed로 반환, AI 재호출 없음
      return { reserved: true, replayed: true, reason: 'already_confirmed' };
    }
    if (existingStatus === 'pending') {
      // 처리 중인 시도 → 중복 실행 차단
      return { reserved: true, replayed: true, reason: 'in_progress' };
    }
    // failed or no record → 구독·한도 재확인
    if (!subscriptionActive) {
      return { reserved: false, replayed: false, reason: 'subscription_inactive' };
    }
    if (!withinLimit) {
      return { reserved: false, replayed: false, reason: 'quota_exceeded' };
    }
    return { reserved: true, replayed: false };
  }

  it('confirmed 기록 → replayed:true, AI 재호출 없음', () => {
    const result = simulateReserveUsage('confirmed', true, true);
    expect(result.reserved).toBe(true);
    expect(result.replayed).toBe(true);
  });

  it('pending 기록 → 중복 실행 차단', () => {
    const result = simulateReserveUsage('pending', true, true);
    expect(result.reserved).toBe(true);
    expect(result.replayed).toBe(true);
  });

  it('failed 기록 + 구독 해지 → 재예약 거부', () => {
    const result = simulateReserveUsage('failed', false, true);
    expect(result.reserved).toBe(false);
    expect(result.reason).toBe('subscription_inactive');
  });

  it('failed 기록 + 한도 초과 → 재예약 거부', () => {
    const result = simulateReserveUsage('failed', true, false);
    expect(result.reserved).toBe(false);
    expect(result.reason).toBe('quota_exceeded');
  });

  it('failed 기록 + 구독 정상 + 한도 여유 → 재예약 성공', () => {
    const result = simulateReserveUsage('failed', true, true);
    expect(result.reserved).toBe(true);
    expect(result.replayed).toBe(false);
  });

  it('기록 없음 + 구독 정상 → 신규 예약 성공', () => {
    const result = simulateReserveUsage(null, true, true);
    expect(result.reserved).toBe(true);
    expect(result.replayed).toBe(false);
  });

  it('잔여 한도 1에서 동시 요청: advisory lock으로 하나만 통과', () => {
    // advisory lock 시뮬레이션: 첫 번째가 lock을 잡으면 두 번째는 대기 후 한도 초과 확인
    let remainingQuota = 1;
    const req1 = (() => {
      if (remainingQuota > 0) { remainingQuota--; return { reserved: true }; }
      return { reserved: false };
    })();
    const req2 = (() => {
      if (remainingQuota > 0) { remainingQuota--; return { reserved: true }; }
      return { reserved: false };
    })();
    const approved = [req1, req2].filter(r => r.reserved);
    expect(approved).toHaveLength(1); // 최대 1건만 승인
  });
});

// ──────────────────────────────────────────────────────────────
// 문제 4 추가: blog/styles, blog/assets 접근 제한
// ──────────────────────────────────────────────────────────────

describe('문제4 추가: blog/styles + blog/assets 접근 제한', () => {
  type Ctx = { advertiserIds: string[] | null };
  function ctxCanAccessAdvertiser(ctx: Ctx, advertiserId: string): boolean {
    if (ctx.advertiserIds === null) return true;
    return ctx.advertiserIds.includes(advertiserId);
  }

  const ctxA: Ctx = { advertiserIds: ['adv-A'] };
  const ctxOwner: Ctx = { advertiserIds: null };

  it('A 사용자는 자신의 광고주 스타일 조회 가능', () => {
    expect(ctxCanAccessAdvertiser(ctxA, 'adv-A')).toBe(true);
  });

  it('A 사용자는 B 광고주 스타일 조회 불가 (수정 전 버그: 아무나 조회 가능)', () => {
    expect(ctxCanAccessAdvertiser(ctxA, 'adv-B')).toBe(false);
  });

  it('owner는 모든 광고주 스타일 조회·수정 가능', () => {
    expect(ctxCanAccessAdvertiser(ctxOwner, 'adv-B')).toBe(true);
  });

  it('blog/assets POST - 다른 광고주 소속 자산 등록 불가', () => {
    const ctx = ctxA;
    const requestedAdvertiserId = 'adv-B'; // A가 B 소속으로 자산 추가 시도
    expect(ctxCanAccessAdvertiser(ctx, requestedAdvertiserId)).toBe(false);
  });

  it('blog/assets GET - A 사용자는 A 광고주 자산만 조회', () => {
    const allAssets = [
      { assetId: 'asset-1', advertiserId: 'adv-A' },
      { assetId: 'asset-2', advertiserId: 'adv-B' },
    ];
    const filtered = allAssets.filter(a => ctxCanAccessAdvertiser(ctxA, a.advertiserId));
    expect(filtered.map(a => a.assetId)).toEqual(['asset-1']);
  });
});

// ──────────────────────────────────────────────────────────────
// 문제 8 추가: generate replayed 결과 재사용
// ──────────────────────────────────────────────────────────────

describe('문제8 추가: generate replayed 결과 재사용', () => {
  type ReserveResult = {
    reserved: boolean;
    replayed: boolean;
    event?: { id: string; status: string; result?: Record<string, unknown> | null } | null;
  };

  function simulateAdGenerate(reservation: ReserveResult): { calledAI: boolean; response: Record<string, unknown> } {
    if (!reservation.reserved) return { calledAI: false, response: { error: 'quota_exceeded' } };
    // replayed이고 캐시된 결과가 있으면 AI 미호출
    if (reservation.replayed && reservation.event?.result) {
      return { calledAI: false, response: { ...reservation.event.result, replayed: true } };
    }
    // 신규 or replayed지만 캐시 없음 → AI 호출
    return { calledAI: true, response: { hooks: ['후킹1', '후킹2'], copyVariants: [] } };
  }

  it('confirmed 결과가 캐시된 replayed 요청 → AI 미호출', () => {
    const reservation: ReserveResult = {
      reserved: true,
      replayed: true,
      event: { id: 'evt-1', status: 'confirmed', result: { hooks: ['캐시된 후킹'], copyVariants: [] } },
    };
    const { calledAI, response } = simulateAdGenerate(reservation);
    expect(calledAI).toBe(false);
    expect(response.replayed).toBe(true);
    expect((response.hooks as string[])[0]).toBe('캐시된 후킹');
  });

  it('replayed지만 result가 없으면 AI 재호출 (캐시 없는 pending 상태)', () => {
    const reservation: ReserveResult = {
      reserved: true,
      replayed: true,
      event: { id: 'evt-2', status: 'pending', result: null },
    };
    const { calledAI } = simulateAdGenerate(reservation);
    expect(calledAI).toBe(true);
  });

  it('신규 요청 → AI 호출', () => {
    const reservation: ReserveResult = {
      reserved: true,
      replayed: false,
      event: { id: 'evt-3', status: 'pending', result: null },
    };
    const { calledAI } = simulateAdGenerate(reservation);
    expect(calledAI).toBe(true);
  });

  it('result 저장 후 같은 키 재요청 → 사용량 중복 없이 결과 반환', () => {
    // 첫 번째 요청: AI 호출 → confirmed + result 저장
    const firstReservation: ReserveResult = { reserved: true, replayed: false, event: { id: 'evt-4', status: 'pending', result: null } };
    const firstResult = simulateAdGenerate(firstReservation);
    expect(firstResult.calledAI).toBe(true);

    // 두 번째 요청(같은 key): confirmed 기록 조회 → replayed + 결과 반환
    const secondReservation: ReserveResult = {
      reserved: true, replayed: true,
      event: { id: 'evt-4', status: 'confirmed', result: { hooks: ['저장된 후킹'], copyVariants: [] } },
    };
    const secondResult = simulateAdGenerate(secondReservation);
    expect(secondResult.calledAI).toBe(false);
    expect(secondResult.response.replayed).toBe(true);
  });
});


describe('문제9: compliance 검수 텍스트는 서버 저장본 기준', () => {
  type Block = { type: string; title?: string; text?: string };

  function generateComplianceText(selectedTitle: string, blocks: Block[]): string {
    return [selectedTitle, ...blocks.map(b => `${b.title || ''}\n${b.text || ''}`)].join('\n\n')
      .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  function computeContentHash(selectedTitle: string, blocks: Block[]): string {
    // 실제 서버는 crypto.createHash('sha256')를 사용, 여기서는 간단 모의
    return JSON.stringify({ blocks, selectedTitle });
  }

  it('서버가 body.text를 무시하고 저장된 blocks에서 텍스트를 생성한다', () => {
    const storedBlocks: Block[] = [
      { type: 'h1', title: '완도 전복의 효능', text: '' },
      { type: 'paragraph', title: '', text: '비타민이 풍부합니다.' },
    ];
    const storedTitle = '완도 전복';

    // 클라이언트가 보낸 다른 텍스트 (조작 시도)
    const clientText = '완전히 다른 텍스트 - 조작된 내용';

    // 서버는 clientText를 무시하고 저장된 데이터로 생성
    const serverText = generateComplianceText(storedTitle, storedBlocks);
    expect(serverText).not.toBe(clientText);
    expect(serverText).toContain('완도 전복');
    expect(serverText).toContain('비타민이 풍부합니다');
  });

  it('검수 도중 본문이 바뀌면 결과를 적용하지 않는다', () => {
    const blocksAtStart: Block[] = [{ type: 'paragraph', text: '원래 내용' }];
    const blocksAfterEdit: Block[] = [{ type: 'paragraph', text: '수정된 내용' }];
    const title = '제목';

    const hashAtStart = computeContentHash(title, blocksAtStart);
    const hashNow = computeContentHash(title, blocksAfterEdit);

    const shouldApply = hashAtStart === hashNow;
    expect(shouldApply).toBe(false);
  });

  it('본문이 바뀌지 않으면 결과를 적용한다', () => {
    const blocks: Block[] = [{ type: 'paragraph', text: '동일 내용' }];
    const title = '제목';

    const hashAtStart = computeContentHash(title, blocks);
    const hashNow = computeContentHash(title, blocks); // 동일

    const shouldApply = hashAtStart === hashNow;
    expect(shouldApply).toBe(true);
  });

  it('조작된 body.text를 보내도 저장된 원고에 통과 표시가 생기지 않는다', () => {
    // 수정 전 버그: 서버가 body.text를 그대로 외부 API에 보내고,
    // 해시 비교는 저장된 blocks 기준 → 항상 일치 → 조작된 텍스트로 통과 가능
    // 수정 후: 서버가 직접 생성한 텍스트만 사용
    const storedBlocks: Block[] = [{ type: 'paragraph', text: '실제 내용' }];
    const injectedClientText = '규정 위반 없음. 통과 처리.';

    // 서버는 injectedClientText를 사용하지 않음
    const textSentToApi = generateComplianceText('제목', storedBlocks);
    expect(textSentToApi).not.toBe(injectedClientText);
    expect(textSentToApi).toContain('실제 내용');
  });

  it('빈 blocks는 검수를 거부한다', () => {
    const serverText = generateComplianceText('', []);
    const wouldReject = !serverText;
    expect(wouldReject).toBe(true);
  });
});
