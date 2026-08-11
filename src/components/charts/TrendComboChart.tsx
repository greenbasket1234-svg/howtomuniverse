import { useMemo } from 'react';
import { ChartEmptyState } from './ChartEmptyState';

export type ComboSeries = {
  name: string;
  data: number[];
  color: string;
  type: 'bar' | 'line';
  format?: 'currency' | 'number' | 'percent';
  yAxisIndex?: 0 | 1; // 값의 크기 차이가 큰 지표(예: ROAS %)는 보조축(1)에 둡니다.
};

export type TrendComboChartProps = {
  title: string;
  subtitle?: string;
  dates: string[]; // X축 (일자별 라벨, 예: '07-01')
  series: ComboSeries[];
  summary?: { label: string; value: string }[]; // 카드 상단 요약 수치
  loading?: boolean;
  height?: number;
};

function formatValue(value: number, format?: ComboSeries['format']) {
  if (format === 'currency') return `₩${Math.round(value).toLocaleString()}`;
  if (format === 'percent') return `${value.toFixed(1)}%`;
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function compactValue(value: number, format?: ComboSeries['format']) {
  const suffix = format === 'percent' ? '%' : format === 'currency' ? '원' : '';
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${Math.round(value / 100000000)}억${suffix}`;
  if (abs >= 10000) return `${Math.round(value / 10000)}만${suffix}`;
  if (abs >= 1000) return `${Math.round(value).toLocaleString()}${suffix}`;
  if (Number.isInteger(value)) return `${value}${suffix}`;
  return `${Number(value.toFixed(1))}${suffix}`;
}

function buildDomain(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { min: 0, max: 1 };
  let min = Math.min(0, ...finite);
  let max = Math.max(0, ...finite);
  if (min === max) {
    min = min > 0 ? 0 : min - 1;
    max = max + 1;
  }
  const padding = (max - min) * 0.08;
  return { min: min - padding, max: max + padding };
}

function getAxisValues(series: ComboSeries[], axisIndex: 0 | 1) {
  return series
    .filter(item => (item.yAxisIndex ?? 0) === axisIndex)
    .flatMap(item => item.data)
    .filter(Number.isFinite);
}

function getAxisFormat(series: ComboSeries[], axisIndex: 0 | 1) {
  return series.find(item => (item.yAxisIndex ?? 0) === axisIndex)?.format ?? 'number';
}

// ECharts/zrender 의존성 없이 Vite 개발 서버가 바로 실행되도록 만든 경량 SVG 복합 차트입니다.
// 날짜·매체 카테고리별 막대/꺾은선을 함께 표시하고, 보조축이 필요한 지표는 별도 스케일로 그립니다.
export function TrendComboChart({ title, subtitle, dates, series, summary, loading, height = 320 }: TrendComboChartProps) {
  const hasData = dates.length > 0 && series.some(s => s.data.some(v => Number.isFinite(v) && v !== 0));

  const chart = useMemo(() => {
    const svgWidth = 760;
    const svgHeight = Math.max(220, height);
    const hasSecondaryAxis = series.some(s => s.yAxisIndex === 1);
    const margin = { top: 18, right: hasSecondaryAxis ? 58 : 24, bottom: 48, left: 62 };
    const plotWidth = svgWidth - margin.left - margin.right;
    const plotHeight = svgHeight - margin.top - margin.bottom;
    const primaryDomain = buildDomain(getAxisValues(series, 0));
    const secondaryDomain = buildDomain(getAxisValues(series, 1));
    const primaryFormat = getAxisFormat(series, 0);
    const secondaryFormat = getAxisFormat(series, 1);
    const barSeries = series.filter(s => s.type === 'bar');
    const categoryStep = dates.length > 1 ? plotWidth / (dates.length - 1) : plotWidth;
    const xFor = (index: number) => (dates.length > 1 ? margin.left + index * categoryStep : margin.left + plotWidth / 2);
    const scaleY = (value: number, axisIndex: 0 | 1 = 0) => {
      const domain = axisIndex === 1 ? secondaryDomain : primaryDomain;
      return margin.top + ((domain.max - value) / (domain.max - domain.min)) * plotHeight;
    };
    const xLabelStep = Math.max(1, Math.ceil(dates.length / 8));
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
      ratio,
      y: margin.top + plotHeight * ratio,
      primary: primaryDomain.max - (primaryDomain.max - primaryDomain.min) * ratio,
      secondary: secondaryDomain.max - (secondaryDomain.max - secondaryDomain.min) * ratio,
    }));

    return {
      svgWidth,
      svgHeight,
      margin,
      plotWidth,
      plotHeight,
      hasSecondaryAxis,
      primaryFormat,
      secondaryFormat,
      barSeries,
      categoryStep,
      xFor,
      scaleY,
      xLabelStep,
      yTicks,
    };
  }, [dates, height, series]);

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {summary && summary.length > 0 && (
          <div className="chart-summary-row">
            {summary.map(item => (
              <div key={item.label} className="chart-summary-item"><span>{item.label}</span><b>{item.value}</b></div>
            ))}
          </div>
        )}
      </div>
      {loading ? (
        <div className="chart-loading">불러오는 중...</div>
      ) : !hasData ? (
        <ChartEmptyState message="이 기간·조건에 표시할 데이터가 없습니다." />
      ) : (
        <div className="chart-svg-wrap" style={{ minHeight: height }}>
          <div className="chart-legend" aria-label="차트 범례">
            {series.map(item => (
              <span key={`${item.name}-${item.type}`}>
                <i style={{ background: item.color }} />
                {item.name}
              </span>
            ))}
          </div>
          <svg role="img" aria-label={title} viewBox={`0 0 ${chart.svgWidth} ${chart.svgHeight}`} className="trend-svg-chart">
            <rect x="0" y="0" width={chart.svgWidth} height={chart.svgHeight} rx="12" fill="transparent" />
            {chart.yTicks.map(tick => (
              <g key={`grid-${tick.ratio}`}>
                <line
                  x1={chart.margin.left}
                  x2={chart.margin.left + chart.plotWidth}
                  y1={tick.y}
                  y2={tick.y}
                  className="chart-grid-line"
                />
                <text x={chart.margin.left - 10} y={tick.y + 4} textAnchor="end" className="chart-axis-label">
                  {compactValue(tick.primary, chart.primaryFormat)}
                </text>
                {chart.hasSecondaryAxis && (
                  <text x={chart.margin.left + chart.plotWidth + 10} y={tick.y + 4} textAnchor="start" className="chart-axis-label">
                    {compactValue(tick.secondary, chart.secondaryFormat)}
                  </text>
                )}
              </g>
            ))}
            <line
              x1={chart.margin.left}
              x2={chart.margin.left + chart.plotWidth}
              y1={chart.margin.top + chart.plotHeight}
              y2={chart.margin.top + chart.plotHeight}
              className="chart-axis-line"
            />
            <line
              x1={chart.margin.left}
              x2={chart.margin.left}
              y1={chart.margin.top}
              y2={chart.margin.top + chart.plotHeight}
              className="chart-axis-line"
            />
            {chart.hasSecondaryAxis && (
              <line
                x1={chart.margin.left + chart.plotWidth}
                x2={chart.margin.left + chart.plotWidth}
                y1={chart.margin.top}
                y2={chart.margin.top + chart.plotHeight}
                className="chart-axis-line"
              />
            )}

            {dates.map((date, index) => (
              index % chart.xLabelStep === 0 || index === dates.length - 1 ? (
                <text key={`x-${date}-${index}`} x={chart.xFor(index)} y={chart.margin.top + chart.plotHeight + 24} textAnchor="middle" className="chart-axis-label">
                  {date}
                </text>
              ) : null
            ))}

            {chart.barSeries.map((item, barIndex) => {
              const barCount = Math.max(1, chart.barSeries.length);
              const barWidth = Math.min(24, Math.max(4, (chart.categoryStep * 0.62) / barCount));
              const totalBarWidth = barWidth * barCount;
              const zeroY = chart.scaleY(0, item.yAxisIndex ?? 0);
              return item.data.map((value, index) => {
                if (!Number.isFinite(value)) return null;
                const x = chart.xFor(index) - totalBarWidth / 2 + barIndex * barWidth + 1;
                const y = chart.scaleY(value, item.yAxisIndex ?? 0);
                const rectY = Math.min(y, zeroY);
                const rectHeight = Math.max(1, Math.abs(zeroY - y));
                return (
                  <rect
                    key={`bar-${item.name}-${index}`}
                    x={x}
                    y={rectY}
                    width={Math.max(2, barWidth - 2)}
                    height={rectHeight}
                    rx="3"
                    fill={item.color}
                    opacity="0.78"
                  >
                    <title>{`${dates[index]} · ${item.name}: ${formatValue(value, item.format)}`}</title>
                  </rect>
                );
              });
            })}

            {series.filter(item => item.type === 'line').map(item => {
              const points = item.data
                .map((value, index) => Number.isFinite(value) ? { value, index, x: chart.xFor(index), y: chart.scaleY(value, item.yAxisIndex ?? 0) } : null)
                .filter((point): point is { value: number; index: number; x: number; y: number } => Boolean(point));
              if (points.length === 0) return null;
              const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
              return (
                <g key={`line-${item.name}`}>
                  <path d={path} fill="none" stroke={item.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  {points.map(point => (
                    <circle key={`point-${item.name}-${point.index}`} cx={point.x} cy={point.y} r="3.2" fill="#fff" stroke={item.color} strokeWidth="2">
                      <title>{`${dates[point.index]} · ${item.name}: ${formatValue(point.value, item.format)}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
