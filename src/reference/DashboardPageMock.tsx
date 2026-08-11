import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { MockNote } from '../components/MockNote';
import { EmptyState } from '../components/EmptyState';
import { BrandReportGrid, PeriodSelector } from '../components/BrandReportGrid';
import { DateRangePicker, DateRange } from '../components/DateRangePicker';
import { MetricPicker } from '../components/MetricPicker';
import { BrandReportConfig, BrandDailyData, PeriodType, sumFields, enumerateDates } from '../types/brandReport';
import { getBudgetStatus, BUDGET_STATUS_LABEL } from '../types/common';

// 이 파일은 라이브 라우트에 연결되지 않은 "참고용" 목업입니다 (DashboardPage.tsx의 GATE 참고).
// 광고주별로 지표 철학(매출/클릭/DB)까지 다르므로, 보고서 페이지와 동일한
// BrandReportConfig를 재사용해서 대시보드도 광고주마다 자동으로 다르게 그려지도록 만들었습니다.
export function DashboardPageMock({ config, data }: { config: BrandReportConfig; data: BrandDailyData }) {
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [range, setRange] = useState<DateRange>({ from: '2026-07-01', to: '2026-07-12' });
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const dates = enumerateDates(range.from, range.to);

  useEffect(() => {
    setSelectedGroups(new Set(config.rowGroups.map((_, i) => i)));
  }, [config.brandId]);

  const filteredConfig = useMemo(
    () => ({ ...config, rowGroups: config.rowGroups.filter((_, i) => selectedGroups.has(i)) }),
    [config, selectedGroups]
  );
  const metricOptions = config.rowGroups.map((g, i) => ({ key: i, label: g.label }));

  const spendByItem = config.lineItems
    .map((item) => ({ item, total: sumFields(dates.map((dt) => data[item.key]?.[dt] ?? {})).spend }))
    .filter((r): r is { item: typeof r.item; total: number } => r.total !== undefined);
  const totalSpend = spendByItem.reduce((s, r) => s + r.total, 0);

  const budgetEval = getBudgetStatus({ monthlyBudget: config.monthlyBudget, currentSpend: totalSpend });

  return (
    <div>
      <Link to="/dashboard" className="breadcrumb-back">← 광고주 목록으로</Link>

      <PageHeader
        title={`${config.brandName} 대시보드`}
        description={`라인아이템 ${config.lineItems.length}개 · 지표 그룹 ${config.rowGroups.length}개`}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <DateRangePicker value={range} onChange={setRange} />
            <PeriodSelector value={period} onChange={setPeriod} />
            <MetricPicker options={metricOptions} selected={selectedGroups} onChange={setSelectedGroups} />
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: spendByItem.length > 0 ? '1.1fr 1fr' : '1fr', gap: 16 }}>
        {spendByItem.length > 0 && (
          <div className="card">
            <div className="card-title">채널별 광고비 믹스</div>
            {spendByItem.map(({ item, total }) => {
              const pct = totalSpend ? (total / totalSpend) * 100 : 0;
              return (
                <div key={item.key} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span>{item.label}</span>
                    <span>₩{total.toLocaleString()} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="footnote">전체 합계 ₩{totalSpend.toLocaleString()}</div>
          </div>
        )}

        <div className="card">
          <div className="card-title">예산 소진율</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>{config.brandName}</span>
            <span style={{ fontSize: 12.5 }}>
              ₩{totalSpend.toLocaleString()}{config.monthlyBudget ? ` / ₩${config.monthlyBudget.toLocaleString()}` : ''}{' '}
              <Badge tone={budgetEval.status === 'normal' ? 'success' : budgetEval.status === 'overrun' ? 'danger' : 'warning'}>
                {BUDGET_STATUS_LABEL[budgetEval.status]}
              </Badge>
            </span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${config.monthlyBudget ? Math.min(100, (totalSpend / config.monthlyBudget) * 100) : 0}%` }}
            />
          </div>
          <div className="card-title" style={{ marginTop: 16 }}>추천 조치</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>현재 추천할 조치가 없습니다.</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">광고 성과 지표</div>
        {filteredConfig.rowGroups.length === 0 ? (
          <EmptyState title="표시할 지표를 선택해주세요." description="상단의 '지표 선택'에서 최소 1개 이상 켜주세요." />
        ) : (
          <BrandReportGrid config={filteredConfig} data={data} dates={dates} period={period} />
        )}
      </div>

      <MockNote>실제 API 연동은 Phase 2 대상</MockNote>
    </div>
  );
}
