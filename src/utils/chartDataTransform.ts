// 보고서 관리·대시보드의 일자별 원본 데이터를 TrendComboChart가 바로 그릴 수 있는
// {날짜 배열, 시리즈 배열} 형태로 바꿔주는 함수들입니다.

export type DailyRowLike = { metric: string; platform?: string; values: number[]; derived?: boolean; group?: string; customMetricId?: string };

// 환경설정에서 만든 커스텀 지표(수식) 행은 ReportRow 타입상 metric 필드에 'spend' 등 기존 값을
// 임시로 채워 넣습니다. customMetricId로 구분해서, 실제 광고비·클릭수 집계에 섞이지 않도록 제외합니다.
const isRealMetricRow = (r: DailyRowLike) => !r.customMetricId && r.group !== '커스텀 지표';

// 지정한 지표들의 '총합(전체 매체 합산)' 일별 값을 뽑아 차트 시리즈로 만듭니다.
// rows에서 platform이 없는 행(총 OO)을 우선 쓰고, 없으면 같은 지표의 매체별 행을 모두 더합니다.
export function buildDailyTrendData(
  rows: DailyRowLike[],
  dayIndexes: number[],
  specs: { metric: string; name: string; color: string; type: 'bar' | 'line'; format?: 'currency' | 'number' | 'percent'; yAxisIndex?: 0 | 1 }[],
  platform?: string, // 지정하면 그 매체만, 없으면 전체 매체 합산
) {
  const seriesForMetric = (metric: string) => {
    if (platform && platform !== '전체') {
      const row = rows.find(r => r.platform === platform && r.metric === metric && isRealMetricRow(r));
      return dayIndexes.map(i => row?.values[i] ?? 0);
    }
    const totalRow = rows.find(r => !r.platform && r.metric === metric && isRealMetricRow(r));
    if (totalRow) return dayIndexes.map(i => totalRow.values[i] ?? 0);
    const platformRows = rows.filter(r => r.platform && r.metric === metric && isRealMetricRow(r));
    return dayIndexes.map(i => platformRows.reduce((sum, r) => sum + (r.values[i] ?? 0), 0));
  };
  return specs.map(spec => ({
    name: spec.name,
    color: spec.color,
    type: spec.type,
    format: spec.format,
    yAxisIndex: spec.yAxisIndex,
    data: seriesForMetric(spec.metric),
  }));
}

// 매체별로 값을 묶어서(예: 매체 비교용) 반환합니다. { 매체명: 일별 배열 } 구조입니다.
export function groupByDateAndMedia(rows: DailyRowLike[], metric: string, dayIndexes: number[]) {
  const platforms = Array.from(new Set(rows.filter(r => r.platform && r.metric === metric && isRealMetricRow(r)).map(r => r.platform as string)));
  const result: Record<string, number[]> = {};
  platforms.forEach(platform => {
    const row = rows.find(r => r.platform === platform && r.metric === metric && isRealMetricRow(r));
    result[platform] = dayIndexes.map(i => row?.values[i] ?? 0);
  });
  return result;
}

// 광고비·매출 일별 배열로부터 ROAS(%) 일별 시리즈를 계산합니다. 광고비가 0인 날은 0으로 둡니다.
export function calculateROASSeries(spend: number[], revenue: number[]) {
  return spend.map((s, i) => (s > 0 ? Math.round((revenue[i] / s) * 1000) / 10 : 0));
}
