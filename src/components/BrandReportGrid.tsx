import { Fragment } from 'react';
import {
  BrandReportConfig,
  BrandDailyData,
  RowGroupConfig,
  RawFields,
  PeriodType,
  computeMetric,
  sumFields,
  formatValue,
  lineItemLabel,
  ROW_METRIC_FORMAT,
  bucketKey,
  bucketLabel,
  orderedBuckets,
} from '../types/brandReport';

function fieldsForBucket(data: BrandDailyData, itemKey: string, datesInBucket: string[]): RawFields {
  return sumFields(datesInBucket.map((dt) => data[itemKey]?.[dt] ?? {}));
}

function groupTotalValue(group: RowGroupConfig, data: BrandDailyData, dates: string[]): number | null {
  const mainSum = sumFields(group.items.map((key) => fieldsForBucket(data, key, dates)));
  if (group.totalNumeratorItems) {
    const numSum = sumFields(group.totalNumeratorItems.map((key) => fieldsForBucket(data, key, dates)));
    if (mainSum.spend === undefined) return null;
    return mainSum.spend ? (numSum.revenue ?? 0) / mainSum.spend * 100 : 0;
  }
  return computeMetric(group.metric, mainSum);
}

export function BrandReportGrid({
  config,
  data,
  dates,
  period,
}: {
  config: BrandReportConfig;
  data: BrandDailyData;
  dates: string[];
  period: PeriodType;
}) {
  const buckets = orderedBuckets(dates, period);
  const datesByBucket = (b: string) => dates.filter((dt) => bucketKey(dt, period) === b);

  return (
    <div className="table-scroll">
      <table className="channel-grid">
        <thead>
          <tr>
            <th>{config.brandName}</th>
            <th>전체기간</th>
            {buckets.map((b) => (
              <th key={b}>{bucketLabel(b, period)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.rowGroups.map((group, gi) => (
            <Fragment key={gi}>
              {group.items.map((itemKey) => {
                const override = group.itemOverrides?.[itemKey];
                const metric = override?.metric ?? group.metric;
                const label = override?.label ?? `${lineItemLabel(config, itemKey)} ${group.label}`;
                const format = ROW_METRIC_FORMAT[metric];
                const fullValue = computeMetric(metric, fieldsForBucket(data, itemKey, dates));
                return (
                  <tr key={`${gi}-${itemKey}`}>
                    <td>{label}</td>
                    <td className="num">{formatValue(fullValue, format, metric)}</td>
                    {buckets.map((b) => {
                      const v = computeMetric(metric, fieldsForBucket(data, itemKey, datesByBucket(b)));
                      return <td className="num" key={b}>{formatValue(v, format, metric)}</td>;
                    })}
                  </tr>
                );
              })}
              {group.totalLabel && (
                <tr className="channel-grid-total-row" key={`${gi}-total`}>
                  <td>{group.totalLabel}</td>
                  <td className="num">{formatValue(groupTotalValue(group, data, dates), ROW_METRIC_FORMAT[group.metric], group.metric)}</td>
                  {buckets.map((b) => (
                    <td className="num" key={b}>
                      {formatValue(groupTotalValue(group, data, datesByBucket(b)), ROW_METRIC_FORMAT[group.metric], group.metric)}
                    </td>
                  ))}
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PeriodSelector({ value, onChange }: { value: PeriodType; onChange: (p: PeriodType) => void }) {
  const options: { key: PeriodType; label: string }[] = [
    { key: 'daily', label: '일간 보고' },
    { key: 'weekly', label: '주간 보고' },
    { key: 'monthly', label: '월간 보고' },
    { key: 'yearly', label: '연간 보고' },
  ];
  return (
    <div className="date-range">
      {options.map((o) => (
        <button key={o.key} className={o.key === value ? 'active' : ''} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
