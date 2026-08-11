import { describe, it, expect } from 'vitest';
import { buildRecommendations, summarizeRecommendations } from '../recommendationEngine';

// 개별 규칙(rules/score/confidence/dedupe)은 각자 유닛 테스트가 있으니, 여기서는
// "실제 데이터로 전체 파이프라인을 돌렸을 때 런타임 에러 없이 형태가 올바른 결과가
// 나오는가"만 확인합니다. typecheck는 타입 오류만 잡아내고, undefined 프로퍼티 접근 같은
// 런타임 문제는 못 잡기 때문에 이 테스트가 필요합니다.

describe('buildRecommendations (통합)', () => {
  it('기본 옵션으로 호출해도 에러 없이 배열을 반환한다', () => {
    expect(() => buildRecommendations()).not.toThrow();
    const recommendations = buildRecommendations();
    expect(Array.isArray(recommendations)).toBe(true);
  });

  it('반환된 각 추천은 필수 필드를 전부 채우고 있다', () => {
    const recommendations = buildRecommendations({ period: '최근 30일', comparison: '직전 동일기간' });
    recommendations.forEach(rec => {
      expect(rec.recommendationId).toBeTruthy();
      expect(rec.advertiserName).toBeTruthy();
      expect(rec.title).toBeTruthy();
      expect(rec.summary).toBeTruthy();
      expect(rec.priorityScore).toBeGreaterThanOrEqual(0);
      expect(rec.priorityScore).toBeLessThanOrEqual(100);
      expect(['긴급', '높음', '보통', '낮음']).toContain(rec.priorityLabel);
      expect(['low', 'medium', 'high']).toContain(rec.confidence.level);
      expect(Array.isArray(rec.evidence)).toBe(true);
      expect(Array.isArray(rec.suggestedActions)).toBe(true);
    });
  });

  it('데이터 부족(insufficientData) 추천은 우선순위 점수가 낮게 눌려 있다', () => {
    const recommendations = buildRecommendations();
    recommendations.filter(r => r.insufficientData).forEach(rec => {
      expect(rec.priorityScore).toBeLessThanOrEqual(20);
    });
  });

  it('같은 옵션으로 두 번 호출하면 같은 추천 ID 집합을 반환한다(결정론적)', () => {
    const first = buildRecommendations({ period: '최근 30일', comparison: '직전 동일기간' });
    const second = buildRecommendations({ period: '최근 30일', comparison: '직전 동일기간' });
    expect(first.map(r => r.recommendationId)).toEqual(second.map(r => r.recommendationId));
  });

  it('결과는 우선순위 점수 내림차순으로 정렬되어 있다', () => {
    const recommendations = buildRecommendations();
    for (let i = 1; i < recommendations.length; i++) {
      expect(recommendations[i - 1].priorityScore).toBeGreaterThanOrEqual(recommendations[i].priorityScore);
    }
  });

  it('summarizeRecommendations의 각 항목 합은 전체 개수 이하다', () => {
    const recommendations = buildRecommendations();
    const summary = summarizeRecommendations(recommendations);
    const total = summary.urgent + summary.needsImprovement + summary.expansionCandidate + summary.monitoring + summary.insufficientData;
    expect(total).toBeLessThanOrEqual(recommendations.length);
  });
});
