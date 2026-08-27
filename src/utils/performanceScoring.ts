/**
 * 캠페인·키워드 등의 "고성과/저성과"를 ROAS 하나만 보지 않고, ROAS·전환수·CVR·클릭수를
 * 종합해서 판단합니다. 각 지표는 단위가 서로 달라서(ROAS는 %, 클릭수는 건수 등) 그대로
 * 더할 수 없어, 같은 그룹 안에서 "순위를 0~1 사이 백분위"로 바꾼 뒤 평균을 냅니다.
 * 예: 클릭수가 10개 중 3등이면 상위 78% 정도로 환산됩니다.
 * '전환'은 리드(dbCount)만 세면 안 됩니다 - 판매(구매) 목적 캠페인은 리드가 0이어도
 * 구매(purchases)로 실제 전환이 있을 수 있어, 반드시 리드+구매 합계로 판단합니다.
 */
export type ScorableRow = { spend: number; clicks: number; dbCount: number; purchases?: number; revenue: number };
const totalConv = (r: ScorableRow) => r.dbCount + (r.purchases || 0);

function percentileRanks<T>(items: T[], getValue: (item: T) => number): Map<T, number> {
  const n = items.length;
  const sorted = [...items].sort((a, b) => getValue(b) - getValue(a));
  const map = new Map<T, number>();
  sorted.forEach((item, idx) => map.set(item, n > 1 ? 1 - idx / (n - 1) : 1));
  return map;
}

/**
 * items에 종합 성과 점수(0~1, 높을수록 좋음)를 매겨서 반환합니다.
 * ROAS는 매출을 추적하는 항목에만 의미가 있어, 매출이 없는 항목은 CVR·전환수·클릭수 3개만으로 계산합니다.
 */
export function scoreByCompositePerformance<T extends ScorableRow>(items: T[]): Map<T, number> {
  const cvrOf = (r: T) => (r.clicks > 0 ? totalConv(r) / r.clicks : 0);
  const roasOf = (r: T) => (r.spend > 0 ? r.revenue / r.spend : 0);
  const roasRank = percentileRanks(items, roasOf);
  const cvrRank = percentileRanks(items, cvrOf);
  const convRank = percentileRanks(items, totalConv);
  const clickRank = percentileRanks(items, r => r.clicks);
  const scores = new Map<T, number>();
  for (const item of items) {
    const hasRevenue = item.revenue > 0;
    const parts = hasRevenue
      ? [[roasRank.get(item)!, 0.35], [cvrRank.get(item)!, 0.35], [convRank.get(item)!, 0.2], [clickRank.get(item)!, 0.1]]
      : [[cvrRank.get(item)!, 0.5], [convRank.get(item)!, 0.3], [clickRank.get(item)!, 0.2]];
    const total = parts.reduce((sum, [v, w]) => sum + v * w, 0);
    scores.set(item, total);
  }
  return scores;
}

/** 광고비가 있는 항목만 대상으로, 종합 점수 상위/하위를 각각 최대 count개씩 뽑습니다. */
export function splitHighLowPerformers<T extends ScorableRow>(items: T[], count = 8): { high: T[]; low: T[] } {
  const active = items.filter(i => i.spend > 0);
  if (!active.length) return { high: [], low: [] };
  const scores = scoreByCompositePerformance(active);
  const sorted = [...active].sort((a, b) => scores.get(b)! - scores.get(a)!);
  // 고성과: 종합 점수 상위 + 실제 전환(리드+구매)이 있는 항목. 저성과: 종합 점수 하위 + (전환 0건이거나 점수가 낮음).
  const high = sorted.filter(r => totalConv(r) > 0).slice(0, count);
  const low = [...sorted].reverse().filter(r => totalConv(r) === 0 || scores.get(r)! < 0.3).slice(0, count);
  return { high, low };
}
