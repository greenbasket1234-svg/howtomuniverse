import type { RecommendationConfidence } from './recommendationTypes';

// 신뢰도는 "표본이 부족하면 조치보다 관찰을 권장한다"는 안전장치입니다.
// AI/추천 엔진이 전환 3건짜리 캠페인에 "예산을 줄이세요"라고 말하는 걸 막는 게 목적이라,
// 기준을 낮추기보다는 다소 보수적으로 잡았습니다.

export type ConfidenceInput = {
  /** 비교에 사용된 기간(일) */
  days: number;
  /** 전환(leads) 또는 클릭처럼 판단 근거가 되는 표본 수 */
  sampleSize: number;
  /** 표본의 성격 - 화면 문구에 사용 ("전환 12건" / "클릭 340건") */
  sampleUnit?: string;
};

export function evaluateConfidence({ days, sampleSize, sampleUnit = '전환' }: ConfidenceInput): RecommendationConfidence {
  const sampleNote = `데이터 ${Math.max(0, Math.round(days))}일 · ${sampleUnit} ${Math.max(0, Math.round(sampleSize))}건`;

  if (days < 3 || sampleSize < 5) {
    return {
      level: 'low',
      label: '신뢰도 낮음',
      reason: '데이터 기간이나 표본이 부족합니다. 아직 조치보다 추가 관찰을 권장합니다.',
      sampleNote,
    };
  }
  if (days < 10 || sampleSize < 20) {
    return {
      level: 'medium',
      label: '신뢰도 보통',
      reason: '판단은 가능하지만 표본이 넉넉하지 않아 결과가 며칠 사이 바뀔 수 있습니다.',
      sampleNote,
    };
  }
  return {
    level: 'high',
    label: '신뢰도 높음',
    reason: '충분한 기간과 표본을 근거로 판단했습니다.',
    sampleNote,
  };
}

/** 신뢰도가 낮아 실행 조치보다 관찰을 권장해야 하는지 여부 */
export function shouldHoldForMoreData(confidence: RecommendationConfidence): boolean {
  return confidence.level === 'low';
}
