import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CalendarDays, CheckCircle2, Database, Download, FilePlus2, FileSpreadsheet, FileText, Folder, LayoutTemplate, Plus, RefreshCw, Save, Search, Settings2, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { apiFetch } from '../hooks/useApi';
import { MediaPerformancePage } from './MediaPerformancePage';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { getPlatformColor } from '../utils/platformColors';
import { TrendComboChart } from '../components/charts/TrendComboChart';
import { buildDailyTrendData } from '../utils/chartDataTransform';
import { MonthlyReportBuilder } from '../components/monthlyReport/MonthlyReportBuilder';
import { loadCustomPlatforms, loadMetricLabelOverrides, loadCustomMetrics, evaluateFormula, type CustomMetricDefinition } from '../utils/metricCatalog';
import { loadReportIntegrationSettings } from '../data/reportIntegrations';
import { sendRowToGoogleSheet } from '../utils/googleSheetSync';
import {
  ALL_REPORT_METRICS,
  BASE_ADVERTISERS,
  CLICK_SOURCE,
  CLICK_SOURCE_RAW,
  COMBINED_SOURCE,
  EXTRA_ADVERTISER_KEY,
  GENERATED_STORAGE_KEY,
  LEAD_SOURCE,
  LEAD_SOURCE_RAW,
  METRIC_LABELS,
  PROFILE_STORAGE_KEY,
  RAW_METRICS,
  REACH_RATIO_BY_PLATFORM,
  REACH_SOURCE,
  REACH_SOURCE_RAW,
  REPORT_TYPE_DESCRIPTIONS,
  REPORT_TYPE_LABEL,
  REVENUE_SOURCE,
  REVENUE_SOURCE_RAW,
  SAVED_TEMPLATE_STORAGE_KEY,
  applyReach,
  buildAoA,
  buildCombinedSource,
  buildCustomMetricRows,
  buildRows,
  byIndex,
  customProfileFor,
  defaultProfileFor,
  deriveMetric,
  downloadCsv,
  downloadXlsx,
  estimateImpressionsFromClicks,
  estimateImpressionsFromSpend,
  formatCell,
  formatCellForAdvertiser,
  formatDateForAdvertiser,
  getMonthDays,
  inferFormat,
  inferReportType,
  integratedProfileFor,
  loadExtraAdvertisers,
  isSampleReport,
  loadAllGeneratedReports,
  loadGeneratedReports,
  loadProfiles,
  loadSampleReports,
  loadSavedTemplates,
  mergeBundles,
  metricGroup,
  normalizeApiSource,
  openPrint,
  pad31,
  parseCsvLine,
  parseNumber,
  reachProfileFor,
  resolveRangeTotal,
  rowsToSource,
  mergeIntegratedReports,
  safeDivide,
  sanitizeReportProfile,
  saveExtraAdvertisers,
  saveReportRowsPdf,
  saveGeneratedReports,
  saveSampleReports,
  saveProfiles,
  saveSavedTemplates,
  sourceFor,
  sum,
  totalLabel,
  withReach,
} from '../features/reports/reportCore';
import type {
  CellFormat,
  ClickMode,
  DailyReportProfile,
  GeneratedReport,
  MetricBundle,
  MetricKey,
  ReportRow,
  ReportTab,
  ReportType,
  SavedReportTemplate,
  SourceMap,
} from '../features/reports/reportCore';
function ReportTypeCard({ type, active, onClick }: { type: ReportType; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`daily-report-type-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span>{REPORT_TYPE_LABEL[type]}</span>
      <small>{REPORT_TYPE_DESCRIPTIONS[type]}</small>
    </button>
  );
}

function ReportGrid({ advertiserName, month, rows, editable, onCellChange, onDeleteRow, visibleDayIndexes, periodLabel }: { advertiserName: string; month: string; rows: ReportRow[]; editable?: boolean; onCellChange?: (rowId: string, dayIndex: number, value: number) => void; onDeleteRow?: (row: ReportRow) => void; visibleDayIndexes?: number[]; periodLabel?: string }) {
  const allDays = getMonthDays(month);
  const indexes = visibleDayIndexes ?? allDays.map((_, i) => i);
  const days = indexes.map(i => allDays[i]);
  const rowTotalFor = (row: ReportRow) => resolveRangeTotal(row, indexes, visibleDayIndexes);
  const [sortMode, setSortMode] = useState<'original' | 'asc' | 'desc'>('original');
  const [filterValue, setFilterValue] = useState('all');
  const filterOptions = useMemo(() => {
    const values = new Set<string>();
    rows.forEach(row => {
      values.add(`label::${row.label}`);
      if (row.platform) values.add(`platform::${row.platform}`);
      if (row.group) values.add(`group::${row.group}`);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'ko-KR'));
  }, [rows]);
  const filteredRows = useMemo(() => {
    const filtered = filterValue === 'all' ? [...rows] : rows.filter(row => {
      const [kind, value] = filterValue.split('::');
      if (kind === 'label') return row.label === value;
      if (kind === 'platform') return row.platform === value;
      if (kind === 'group') return row.group === value;
      return true;
    });
    if (sortMode === 'asc') return filtered.sort((a, b) => rowTotalFor(a) - rowTotalFor(b));
    if (sortMode === 'desc') return filtered.sort((a, b) => rowTotalFor(b) - rowTotalFor(a));
    return filtered;
  }, [rows, filterValue, sortMode, indexes.join('|'), visibleDayIndexes]);
  const optionLabel = (value: string) => {
    const [kind, label] = value.split('::');
    if (kind === 'platform') return `매체: ${label}`;
    if (kind === 'group') return `구분: ${label}`;
    return `지표: ${label}`;
  };
  return (
    <>
      <div className="daily-report-table-filter-row">
        <label>정렬
          <select value={sortMode} onChange={event => setSortMode(event.target.value as 'original' | 'asc' | 'desc')}>
            <option value="original">기본 순서</option>
            <option value="asc">오름차순</option>
            <option value="desc">내림차순</option>
          </select>
        </label>
        <label>필터값 중 선택
          <select value={filterValue} onChange={event => setFilterValue(event.target.value)}>
            <option value="all">전체 보기</option>
            {filterOptions.map(option => <option key={option} value={option}>{optionLabel(option)}</option>)}
          </select>
        </label>
        <span>{filteredRows.length.toLocaleString()}개 행 표시</span>
      </div>
      <div className="daily-report-table-wrap">
      <table className="daily-report-table">
        <thead>
          <tr className="weekday-row">
            <th className="sticky-name"></th>
            <th className="sticky-total"></th>
            {days.map(day => <th key={day.iso} className={day.isWeekend ? 'weekend-col' : ''}>{day.weekday}</th>)}
          </tr>
          <tr className="date-row">
            <th className="sticky-name">{advertiserName} {periodLabel ?? `${Number(month.split('-')[1])}월`}</th>
            <th className="sticky-total">TOTAL</th>
            {days.map(day => <th key={day.iso} className={day.isWeekend ? 'weekend-col' : ''}>{day.fullLabel}</th>)}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row, rowIndex) => {
            const previousGroup = filteredRows[rowIndex - 1]?.group;
            const groupStart = rowIndex === 0 || previousGroup !== row.group;
            const rowTotal = rowTotalFor(row);
            return (
              <tr key={row.id} className={`${row.emphasis ? 'sum-row' : ''} ${groupStart ? 'group-start' : ''}`}>
                <td className="sticky-name"><div className="sticky-name-row"><span>{row.label}</span>{editable && onDeleteRow && !row.derived && !row.emphasis && <button type="button" className="row-delete-btn" title="이 항목 삭제" onClick={()=>onDeleteRow(row)}>✕</button>}</div>{row.derived && <small>자동계산</small>}</td>
                <td className="sticky-total">{formatCellForAdvertiser(rowTotal, row.format, advertiserName)}</td>
                {indexes.map((dayIndex) => (
                  <td key={`${row.id}-${dayIndex}`} className={allDays[dayIndex].isWeekend ? 'weekend-col' : ''}>
                    {editable && !row.derived && !row.emphasis ? (
                      <input
                        value={Math.round(row.values[dayIndex])}
                        onChange={(event) => onCellChange?.(row.id, dayIndex, parseNumber(event.target.value))}
                        inputMode="numeric"
                      />
                    ) : formatCellForAdvertiser(row.values[dayIndex], row.format, advertiserName)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

export function AdvertiserDailyReportPage() {
  const { filterValue, setFilter } = useAdvertiserFilter();
  const [realAdvertisers] = useAdvertisers(); // 실제(Postgres) 광고주 목록 - 상단 필터와 자동 연동하기 위해 사용합니다.
  const [tab, setTab] = useState<ReportTab>('preview');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [profiles, setProfiles] = useState<Record<string, DailyReportProfile>>(() => loadProfiles());
  function resolveInitialAdvertiser(value: string) {
    if (!value.trim()) return '';
    const matches = BASE_ADVERTISERS.filter(name => matchesAdvertiserFilter(name, value));
    return matches.length === 1 ? matches[0] : '';
  }
  const [advertiserName, setAdvertiserName] = useState(() => resolveInitialAdvertiser(filterValue));
  const [extraAdvertisers, setExtraAdvertisers] = useState<string[]>(() => loadExtraAdvertisers());
  const allAdvertisers = useMemo(() => Array.from(new Set([...BASE_ADVERTISERS, ...realAdvertisers.map(a=>a.name), ...extraAdvertisers])), [extraAdvertisers, realAdvertisers]);
  const [newReportModalOpen, setNewReportModalOpen] = useState(false);
  const [newReportAdvertiser, setNewReportAdvertiser] = useState('');
  const [newReportType, setNewReportType] = useState<ReportType>('lead');
  const [rowsOverride, setRowsOverride] = useState<Record<string, ReportRow[]>>({});
  const [newRowLabel, setNewRowLabel] = useState('');
  // '매체 추가'와 '지표 추가'를 별도 버튼·모달로 분리합니다. null이면 둘 다 닫힌 상태입니다.
  const [addDataModal, setAddDataModal] = useState<'platform' | 'metric' | 'manual' | null>(null);
  const [addDataQuery, setAddDataQuery] = useState('');
  const [platformSearch, setPlatformSearch] = useState('');
  // 환경설정 > 지표 표시 설정에서 추가/수정한 매체·지표 표시명입니다. 페이지에 들어올 때 한 번 읽어옵니다.
  const [customPlatforms] = useState<string[]>(() => loadCustomPlatforms());
  const [metricLabelOverrides] = useState<Record<string, string>>(() => loadMetricLabelOverrides());
  const [customMetrics] = useState<CustomMetricDefinition[]>(() => loadCustomMetrics());
  const getMetricLabel = (key: MetricKey) => metricLabelOverrides[key] ?? METRIC_LABELS[key];
  const [metricSearch, setMetricSearch] = useState('');
  const [newRowFormat, setNewRowFormat] = useState<CellFormat>('currency');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [periodAnchor, setPeriodAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>(() => loadAllGeneratedReports());
  const [generatedSearch, setGeneratedSearch] = useState('');
  const [generatedGroupBy, setGeneratedGroupBy] = useState<'none' | 'advertiser' | 'type' | 'period'>('advertiser');
  const [generatedSort, setGeneratedSort] = useState<'latest' | 'oldest' | 'name'>('latest');
  const [saveNameModal, setSaveNameModal] = useState<{ periodType: 'daily' | 'weekly' | 'monthly'; name: string } | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<SavedReportTemplate[]>(() => loadSavedTemplates());
  const [uploadText, setUploadText] = useState('');
  // 엑셀에서 읽은 원본 표(string[][])를 텍스트 왕복 없이 그대로 들고 있다가 적용합니다.
  // 사용자가 미리보기 textarea를 직접 고치면(엑셀 내용과 달라질 수 있으므로) 비웁니다.
  const [pendingExcelRows, setPendingExcelRows] = useState<string[][] | null>(null);
  const [notice, setNotice] = useState('');
  const [syncingApi, setSyncingApi] = useState(false);
  const [apiSourceLabel, setApiSourceLabel] = useState('대기 중');
  const [reportSource, setReportSource] = useState<'api' | 'manual' | 'upload' | 'demo' | 'sample'>('manual');
  // 샘플을 열어 셀·행·양식을 수정해도 실제 보고서로 전환되지 않도록, 데이터 출처와 별개로
  // 현재 편집 세션의 샘플 여부를 유지합니다.
  const [sampleContext, setSampleContext] = useState(false);
  const currentIsSample = sampleContext || reportSource === 'sample';
  const markManualEdit = () => setReportSource(previous => (sampleContext || previous === 'sample') ? 'sample' : 'manual');
  // 샘플을 열면 실제 profiles STATE(모든 광고주의 보고서 유형·매체·지표 구성)를 바꾸지 않고,
  // 이 화면에서만 보이는 임시 override로 따로 둡니다. 실제 profiles를 바꾸면 화면을 벗어나도
  // (다른 광고주로 갔다가 돌아와도) 그 광고주의 실제 설정이 샘플 것으로 남아있게 되기 때문입니다.
  const [sampleProfileOverride, setSampleProfileOverride] = useState<DailyReportProfile | null>(null);
  // 샘플을 열 때 rowsOverride에 채워 넣은 storageKey들을 기록해둡니다. 샘플 세션이 끝나면(다른
  // 광고주·월로 이동 등) 이 키들의 override를 함께 지워서, 나중에 같은 광고주·월·유형으로
  // 다시 돌아왔을 때 샘플 숫자가 실제 데이터인 것처럼 남아있지 않게 합니다.
  const sampleStorageKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (sampleContext) return;
    setSampleProfileOverride(null);
    if (sampleStorageKeysRef.current.size === 0) return;
    const keysToClear = sampleStorageKeysRef.current;
    sampleStorageKeysRef.current = new Set();
    setRowsOverride(prev => {
      const next = { ...prev };
      keysToClear.forEach(key => { delete next[key]; });
      return next;
    });
  }, [sampleContext]);

  useEffect(() => {
    if (!filterValue.trim()) return;
    // 부분 검색 중(예: "서울"만 입력한 상태)에는 후보가 여러 개이거나 아직 완성되지 않은 이름일 수 있어,
    // 정확히 광고주 1명만 매칭될 때만 보고서 대상 광고주를 자동으로 전환합니다.
    // (예전엔 filterValue를 그대로 advertiserName에 넣어서, "서울"만 쳐도 광고주명이 "서울"이 되어버렸습니다.)
    const matches = allAdvertisers.filter(name => matchesAdvertiserFilter(name, filterValue));
    if (matches.length === 1 && matches[0] !== advertiserName) { setSampleContext(false); setReportSource('manual'); setAdvertiserName(matches[0]); }
  }, [filterValue, allAdvertisers]);

  const rawProfile = sampleProfileOverride ?? profiles[advertiserName] ?? defaultProfileFor(advertiserName);
  const profile = sanitizeReportProfile(rawProfile);
  const [templateName, setTemplateName] = useState(() => `${advertiserName} · ${REPORT_TYPE_LABEL[profile.reportType]} 양식`);

  // 전체 통합형은 단순히 데모용 통합 원본만 보여주는 것이 아니라, 이 광고주·이 월에 저장된
  // 실제 일별/주별/월별 보고서들을 모두 훑어 최신 값 기준으로 합칩니다. 같은 매체·지표가
  // 여러 보고서에 있으면 더 최근에 저장된 값이 우선하고, 다른 지표는 그대로 함께 유지됩니다.
  const integratedSavedSource = useMemo(() => {
    if (profile.reportType !== 'integrated') return null;
    const scoped = generatedReports
      .filter(report => report.advertiserName === advertiserName && report.month === month && report.source !== 'demo' && report.rows?.length);
    const actualCandidates = scoped.filter(report => !isSampleReport(report));
    // 실제 데이터가 한 건이라도 있으면 테스트 샘플은 통합에서 완전히 제외합니다. 실제 데이터가
    // 없는 광고주·월에서만 테스트 전용 저장소의 샘플을 폴백으로 사용합니다.
    const candidates = actualCandidates.length > 0 ? actualCandidates : scoped.filter(isSampleReport);
    const result = mergeIntegratedReports(candidates, month);
    if (!result || (Object.keys(result.source).length === 0 && result.customRows.length === 0)) return null;
    return { ...result, isSample: candidates.length > 0 && candidates.every(isSampleReport) };
  }, [profile.reportType, generatedReports, advertiserName, month]);

  useEffect(() => {
    if (profile.reportType !== 'integrated' || !integratedSavedSource) return;
    setSampleContext(Boolean(integratedSavedSource.isSample));
    setReportSource(integratedSavedSource.isSample ? 'sample' : 'manual');
    setApiSourceLabel(`${integratedSavedSource.isSample ? '테스트 샘플' : '저장된 실제 보고서'} ${integratedSavedSource.reportCount}건 통합`);
  }, [profile.reportType, integratedSavedSource]);

  const source = integratedSavedSource?.source ?? sourceFor(profile.reportType, profile.advertiserName);
  const availablePlatforms = Object.keys(source);
  // 환경설정에서 등록한 매체는 원본 데이터가 없어도 '매체 표시' 체크박스에서 바로 고를 수 있어야 합니다.
  const checkboxPlatforms = [...availablePlatforms, ...customPlatforms.filter(p => !availablePlatforms.includes(p))];
  const availableMetrics: MetricKey[] = profile.reportType === 'lead'
    ? ['leads','clicks','impressions','spend','cpa','cpc','ctr','conversionRate','reach']
    : profile.reportType === 'revenue'
      ? ['revenue','spend','roas','payments','refunds','netRevenue','reach']
      : profile.reportType === 'click'
        ? ['impressions','clicks','ctr','spend','cpc','reach']
        : profile.reportType === 'reach'
          ? ['impressions','reach','frequency','spend']
          : [...ALL_REPORT_METRICS];


  const baseRows = useMemo(() => {
    const runtimeProfile = profile.reportType === 'integrated'
      ? { ...profile, platforms: Array.from(new Set([...profile.platforms, ...availablePlatforms])), metrics: [...ALL_REPORT_METRICS] }
      : profile;
    return buildRows(runtimeProfile, month, source);
  }, [profile, month, source, availablePlatforms]);
  const storageKey = `${advertiserName}-${month}-${profile.reportType}`;
  const rows = rowsOverride[storageKey] ?? baseRows;

  // '매체 추가' 모달: 지금 선택 안 된 매체 중, 이 보고서 유형에 실제 데이터가 있는 것만 후보로 보여줍니다.
  const platformOptions = useMemo(() => {
    const fromSource = availablePlatforms.filter(p => !profile.platforms.includes(p));
    const fromSettings = customPlatforms.filter(p => !profile.platforms.includes(p) && !fromSource.includes(p));
    return [...fromSource, ...fromSettings];
  }, [availablePlatforms, profile.platforms, customPlatforms]);
  const filteredPlatformOptions = useMemo(() => {
    const nq = addDataQuery.trim().toLowerCase().replace(/\s+/g, '');
    if (!nq) return platformOptions;
    return platformOptions.filter(p => p.toLowerCase().replace(/\s+/g, '').includes(nq));
  }, [platformOptions, addDataQuery]);

  // '지표 추가' 모달: 지금 선택 안 된 지표 중, 원본 데이터로 존재하는(파생지표 제외) 것만 후보로 보여줍니다.
  const metricOptions = useMemo(() => {
    return availableMetrics.filter(m => RAW_METRICS.includes(m) && !profile.metrics.includes(m));
  }, [availableMetrics, profile.metrics]);
  const filteredMetricOptions = useMemo(() => {
    const nq = addDataQuery.trim().toLowerCase().replace(/\s+/g, '');
    if (!nq) return metricOptions;
    return metricOptions.filter(m => getMetricLabel(m).toLowerCase().replace(/\s+/g, '').includes(nq));
  }, [metricOptions, addDataQuery]);
  const allMonthDays = useMemo(() => getMonthDays(month), [month]);
  const resolvePeriodView = (type: 'daily' | 'weekly' | 'monthly') => {
    if (type === 'monthly') {
      // 전체 통합형은 여러 저장분을 합친 결과라 실제로 담당하는 날짜 범위를 그대로 보존합니다.
      const integratedDays = profile.reportType === 'integrated' && integratedSavedSource
        ? (integratedSavedSource.visibleDayIndexes.length < allMonthDays.length ? integratedSavedSource.visibleDayIndexes : undefined)
        : undefined;
      // 현재 진행 중인 달의 샘플은 오늘까지만 생성되어 있습니다. 샘플을 열었다가 다시 월별 저장해도
      // 미래 날짜가 포함되거나 visibleDayIndexes가 사라지지 않도록 같은 범위를 유지합니다.
      const today = new Date();
      const [selectedYear, selectedMonth] = month.split('-').map(Number);
      const sampleCurrentDays = currentIsSample &&
        today.getFullYear() === selectedYear && today.getMonth() + 1 === selectedMonth &&
        today.getDate() < allMonthDays.length
        ? Array.from({ length: today.getDate() }, (_, index) => index)
        : undefined;
      const effectiveDays = integratedDays ?? sampleCurrentDays;
      const monthNumber = Number(month.split('-')[1]);
      const label = effectiveDays?.length
        ? `${monthNumber}월 1일~${effectiveDays[effectiveDays.length - 1] + 1}일 (진행 중 월간 보고서)`
        : `${monthNumber}월 전체 (월간 보고서)`;
      return { visibleDayIndexes: effectiveDays, periodLabel: label };
    }
    const anchor = periodAnchor.startsWith(month) ? periodAnchor : `${month}-01`;
    if (type === 'daily') {
      const idx = allMonthDays.findIndex(d => d.iso === anchor);
      const safeIdx = idx >= 0 ? idx : 0;
      return { visibleDayIndexes: [safeIdx], periodLabel: `${Number(month.split('-')[1])}월 ${allMonthDays[safeIdx]?.day ?? 1}일 (일간 보고서)` };
    }
    const anchorIdx = allMonthDays.findIndex(d => d.iso === anchor);
    const baseIdx = anchorIdx >= 0 ? anchorIdx : 0;
    const weekday = allMonthDays[baseIdx].date.getDay();
    const start = Math.max(0, baseIdx - weekday);
    const end = Math.min(allMonthDays.length - 1, start + 6);
    const idxs = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    return { visibleDayIndexes: idxs, periodLabel: `${allMonthDays[start].dayLabel} ~ ${allMonthDays[end].dayLabel} (주간 보고서)` };
  };
  const { visibleDayIndexes, periodLabel } = useMemo(() => resolvePeriodView(periodType), [periodType, periodAnchor, month, allMonthDays, currentIsSample, profile.reportType, integratedSavedSource]);

  // 선택된 커스텀 지표(환경설정에서 만든 수식)를 일자별로 계산해서 표에 추가할 행을 만듭니다.
  // 수식은 총합 행(예: '총 광고비', '총 매출')의 원본 지표 키를 참조합니다.
  const customMetricRows = useMemo(() => {
    if (profile.reportType === 'integrated' && integratedSavedSource?.customRows.length) return integratedSavedSource.customRows;
    // 저장된 보고서를 열면 rows 안에 이미 그 시점의 커스텀 지표 값(수식·단위·판정방향 포함)이
    // 들어 있을 수 있습니다. 이걸 무시하고 항상 지금 환경설정 수식으로 다시 계산하면, 나중에
    // 그 수식을 고치거나 지웠을 때 과거에 저장했던 값이 조용히 바뀌거나 사라집니다. 그래서
    // 저장된 커스텀 지표는 그대로 쓰고, 아직 저장분에 없는(사용자가 화면에서 새로 고른) 지표만
    // 지금 환경설정 수식으로 계산합니다.
    const savedCustomRows = rows.filter(row => row.customMetricId);
    const savedIds = new Set(savedCustomRows.map(row => row.customMetricId));
    const newlySelectedIds = (profile.customMetricIds ?? []).filter(id => !savedIds.has(id));
    const newlyComputedRows = buildCustomMetricRows(rows.filter(row => !row.customMetricId), month, customMetrics, newlySelectedIds, visibleDayIndexes);
    return [...savedCustomRows, ...newlyComputedRows];
  }, [profile.customMetricIds, customMetrics, rows, month, profile.reportType, integratedSavedSource, visibleDayIndexes]);

  // 화면 표시·내보내기(표/CSV/엑셀/PDF)에는 커스텀 지표 행까지 포함합니다.
  const standardDisplayRows = rows.filter(row => !row.customMetricId);
  const displayRows = customMetricRows.length ? [...standardDisplayRows, ...customMetricRows] : standardDisplayRows;

  const buildDefaultGeneratedReportName = (targetPeriodType: 'daily' | 'weekly' | 'monthly') => {
    const created = new Date();
    const createdStamp = `${created.getFullYear()}년${String(created.getMonth() + 1).padStart(2, '0')}월${String(created.getDate()).padStart(2, '0')}일`;
    const [year, monthNumber] = month.split('-').map(Number);
    const periodView = resolvePeriodView(targetPeriodType);
    let periodName = `${year}년 ${monthNumber}월 월간`;
    if (targetPeriodType === 'daily') {
      const dayIndex = periodView.visibleDayIndexes?.[0] ?? 0;
      periodName = `${year}년 ${monthNumber}월 ${allMonthDays[dayIndex]?.day ?? 1}일 일일`;
    } else if (targetPeriodType === 'weekly') {
      const indexes = periodView.visibleDayIndexes ?? [];
      const startDay = allMonthDays[indexes[0] ?? 0]?.day ?? 1;
      const endDay = allMonthDays[indexes[indexes.length - 1] ?? 0]?.day ?? startDay;
      periodName = `${year}년 ${monthNumber}월 ${startDay}일~${endDay}일 주간`;
    }
    return `${advertiserName} · ${REPORT_TYPE_LABEL[profile.reportType]} · ${periodName} · 매체별 광고보고서 · ${createdStamp}`;
  };

  const requestGeneratedSave = (targetPeriodType: 'daily' | 'weekly' | 'monthly' = periodType) => {
    setSaveNameModal({ periodType: targetPeriodType, name: buildDefaultGeneratedReportName(targetPeriodType) });
  };

  const buildSummaryForIndexes = (indexes?: number[]) => {
    const targetIndexes = indexes ?? allMonthDays.map((_, i) => i);
    const totalFor = (row?: ReportRow) => row ? resolveRangeTotal(row, targetIndexes, indexes) : 0;
    const pick = (metric: MetricKey, emphasisOnly = true) => rows.find(row => row.metric === metric && (!emphasisOnly || row.emphasis));
    const clicks = totalFor(pick('clicks'));
    const spend = totalFor(pick('spend'));
    const leads = totalFor(pick('leads'));
    const revenue = totalFor(rows.find(row => row.id === 'store-total-revenue') ?? pick('revenue'));
    const impressions = totalFor(pick('impressions'));
    const reach = totalFor(pick('reach'));
    return { clicks, spend, leads, revenue, impressions, reach, cpc: safeDivide(spend, clicks), cpa: safeDivide(spend, leads), roas: safeDivide(revenue, spend) * 100 };
  };
  const summary = useMemo(() => buildSummaryForIndexes(visibleDayIndexes), [rows, visibleDayIndexes, allMonthDays]);

  // 매체별 시각화 + 하단 분석/문제점/대응방안에서 함께 씁니다.
  // 같은 platform을 가진 원본(비파생) 행들을 모아 그 매체의 기간 내 핵심 지표를 계산합니다.
  // "광고주별 광고비 비율" 도넛용: 등록된 광고주 전체에 대해, 이번 달 총 광고비를 계산합니다.
  // 그 광고주에 저장된 실제 보고서가 있으면(같은 달 중 가장 최근 것) 그 값을, 없으면 데모
  // 원본으로 근사합니다 — 매체별 시각화의 다른 도넛들과 같은 계산 원칙(저장 데이터 우선)입니다.
  const advertiserSpendBreakdown = useMemo(() => {
    const names = allAdvertisers;
    return names.map(name => {
      const savedForMonth = generatedReports
        .filter(r => r.advertiserName === name && r.month === month && r.source !== 'demo' && r.rows?.length)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      let spend = 0;
      if (savedForMonth?.rows) {
        const totalRow = savedForMonth.rows.find(r => !r.platform && r.metric === 'spend' && !r.derived);
        spend = totalRow ? totalRow.total : savedForMonth.rows.filter(r => r.platform && r.metric === 'spend' && !r.derived).reduce((s, r) => s + r.total, 0);
      }
      return { platform: name, spend };
    }).filter(item => item.spend > 0).sort((a, b) => b.spend - a.spend);
  }, [generatedReports, month, allAdvertisers]);

  const channelBreakdown = useMemo(() => {
    const indexes = visibleDayIndexes ?? allMonthDays.map((_, i) => i);
    const platforms = Array.from(new Set(rows.filter(r => r.platform).map(r => r.platform as string)));
    const pick = (platform: string, metric: MetricKey) => rows.find(r => r.platform === platform && r.metric === metric && !r.derived);
    const totalFor = (row?: ReportRow) => row ? resolveRangeTotal(row, indexes, visibleDayIndexes) : 0;
    // 전체 통합형(또는 사용자 지정형)은 정해진 유형이 없으므로, 실제로 유의미한 매출 데이터가
    // 있으면 매출/ROAS 기준으로, 없으면 DB/CPA 기준으로 판단합니다. (완전히 지표별로 나누는
    // 것보다는 단순하지만, 매출형 데이터를 무조건 DB/CPA로 잘못 분석하는 것은 막아줍니다.)
    const hasMeaningfulRevenue = (profile.reportType === 'integrated' || profile.reportType === 'custom')
      && rows.some(r => r.metric === 'revenue' && !r.derived && r.total > 0);
    const effectiveType = hasMeaningfulRevenue ? 'revenue' : profile.reportType;
    return platforms.map(platform => {
      const spend = totalFor(pick(platform, 'spend'));
      const leads = totalFor(pick(platform, 'leads'));
      const clicks = totalFor(pick(platform, 'clicks'));
      const impressions = totalFor(pick(platform, 'impressions'));
      const revenue = totalFor(pick(platform, 'revenue'));
      const primary = effectiveType === 'revenue' ? revenue : effectiveType === 'reach' ? impressions : effectiveType === 'click' ? clicks : leads;
      const efficiency = effectiveType === 'revenue' ? safeDivide(revenue, spend) * 100 // ROAS, 높을수록 좋음
        : effectiveType === 'click' ? safeDivide(spend, clicks) // CPC, 낮을수록 좋음
        : effectiveType === 'reach' ? safeDivide(spend, impressions) * 1000 // CPM, 낮을수록 좋음
        : safeDivide(spend, leads); // CPA, 낮을수록 좋음
      return { platform, spend, leads, clicks, impressions, revenue, primary, efficiency };
    }).filter(c => c.spend > 0 || c.primary > 0).sort((a, b) => b.spend - a.spend);
  }, [rows, visibleDayIndexes, allMonthDays, profile.reportType]);

  // 분석/문제점/대응방안: 실제 채널별 데이터를 근거로 생성합니다(고정 문구가 아닙니다).
  const reportInsights = useMemo(() => {
    const analysis: string[] = [];
    const problems: string[] = [];
    const actions: string[] = [];
    const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(0)}%` : '0%';
    const won = (v: number) => formatCell(v, 'currency');

    if (channelBreakdown.length === 0) {
      analysis.push('이 기간에는 집계된 매체 데이터가 없습니다. 기간을 넓히거나 데이터 입력/수집을 먼저 진행해 주세요.');
      return { analysis, problems, actions };
    }

    const totalSpend = channelBreakdown.reduce((s, c) => s + c.spend, 0);
    const top = channelBreakdown[0];
    analysis.push(`이 기간 총 광고비는 ${won(totalSpend)}이며, ${channelBreakdown.length}개 매체 중 ${top.platform}이(가) ${pct(top.spend, totalSpend)}로 가장 큰 비중을 차지합니다.`);

    if (profile.reportType === 'integrated') {
      // 전체 통합형은 "매출이 있으니 전부 매출형"처럼 하나로 뭉뚱그리지 않고, 실제 데이터가
      // 있는 영역(노출·클릭·DB·매출)을 각각 따로 짚어줍니다.
      const totalImpressions = channelBreakdown.reduce((s, c) => s + c.impressions, 0);
      const totalClicks = channelBreakdown.reduce((s, c) => s + c.clicks, 0);
      const totalLeads = channelBreakdown.reduce((s, c) => s + c.leads, 0);
      const totalRevenue = channelBreakdown.reduce((s, c) => s + c.revenue, 0);

      if (totalImpressions > 0) {
        analysis.push(`[도달] 총 노출수는 ${totalImpressions.toLocaleString()}회입니다.`);
      }
      if (totalClicks > 0) {
        const ctrRanked = channelBreakdown.filter(c => c.impressions > 0).map(c => ({ ...c, ctr: c.clicks / c.impressions })).sort((a, b) => b.ctr - a.ctr);
        if (ctrRanked.length >= 2) {
          analysis.push(`[유입] CTR 기준으로는 ${ctrRanked[0].platform}(${(ctrRanked[0].ctr * 100).toFixed(2)}%)이 가장 반응이 좋습니다.`);
        }
      }
      if (totalLeads > 0) {
        const cpaRanked = channelBreakdown.filter(c => c.leads > 0).map(c => ({ ...c, cpa: c.spend / c.leads })).sort((a, b) => a.cpa - b.cpa);
        if (cpaRanked.length >= 2) {
          const best = cpaRanked[0], worst = cpaRanked[cpaRanked.length - 1];
          analysis.push(`[전환] CPA 기준으로는 ${best.platform}(${won(best.cpa)})이 가장 효율이 좋고, ${worst.platform}(${won(worst.cpa)})이 가장 낮습니다.`);
          const noConversion = channelBreakdown.filter(c => c.spend > 0 && c.leads === 0 && c.revenue === 0);
          if (noConversion.length) {
            problems.push(`[전환] ${noConversion.map(c => c.platform).join(', ')} — 광고비는 있는데 DB가 0건입니다.`);
            actions.push(`${noConversion.map(c => c.platform).join(', ')}은(는) 소재·타겟팅을 점검해 보세요.`);
          }
        }
      }
      if (totalRevenue > 0) {
        const roasRanked = channelBreakdown.filter(c => c.spend > 0).map(c => ({ ...c, roas: c.revenue / c.spend })).sort((a, b) => b.roas - a.roas);
        if (roasRanked.length >= 2) {
          analysis.push(`[매출] ROAS 기준으로는 ${roasRanked[0].platform}(${(roasRanked[0].roas * 100).toFixed(0)}%)이 가장 효율이 좋습니다.`);
        }
      }
      const concentrated = channelBreakdown.find(c => totalSpend > 0 && c.spend / totalSpend > 0.7 && channelBreakdown.length > 1);
      if (concentrated) {
        problems.push(`${concentrated.platform} 한 매체에 전체 광고비의 ${pct(concentrated.spend, totalSpend)}가 몰려 있어 특정 매체 의존도가 높습니다.`);
        actions.push(`${concentrated.platform} 의존도를 낮추기 위해 다른 매체에 소액으로 테스트 예산을 배분해 보세요.`);
      }
      if (!problems.length) analysis.push('현재 특별한 위험 신호는 감지되지 않았습니다.');
      return { analysis, problems, actions };
    }

    const isRevenue = profile.reportType === 'revenue', isClick = profile.reportType === 'click', isReach = profile.reportType === 'reach';
    const effLabel = isRevenue ? 'ROAS' : isClick ? 'CPC' : isReach ? 'CPM' : 'CPA';
    const fmtEff = (v: number) => isRevenue ? `${v.toFixed(0)}%` : formatCell(v, 'currency');

    const ranked = [...channelBreakdown].filter(c => c.spend > 0).sort((a, b) => isRevenue ? b.efficiency - a.efficiency : a.efficiency - b.efficiency);
    if (ranked.length >= 2) {
      const best = ranked[0], worst = ranked[ranked.length - 1];
      analysis.push(`매체별 ${effLabel} 기준으로는 ${best.platform}(${fmtEff(best.efficiency)})이 가장 효율이 좋고, ${worst.platform}(${fmtEff(worst.efficiency)})이 가장 낮습니다.`);
    }

    const noConversion = channelBreakdown.filter(c => c.spend > 0 && c.primary === 0);
    if (noConversion.length) {
      problems.push(`${noConversion.map(c => c.platform).join(', ')} — 광고비는 있는데 ${isRevenue ? '매출' : isClick ? '클릭' : isReach ? '노출수' : 'DB'}이(가) 0건입니다.`);
      actions.push(`${noConversion.map(c => c.platform).join(', ')}은(는) 소재·타겟팅을 점검하거나, 개선이 없으면 예산을 다른 매체로 재배분하는 것을 검토하세요.`);
    }
    const concentrated = channelBreakdown.find(c => totalSpend > 0 && c.spend / totalSpend > 0.7 && channelBreakdown.length > 1);
    if (concentrated) {
      problems.push(`${concentrated.platform} 한 매체에 전체 광고비의 ${pct(concentrated.spend, totalSpend)}가 몰려 있어 특정 매체 의존도가 높습니다.`);
      actions.push(`${concentrated.platform} 의존도를 낮추기 위해 다른 매체에 소액으로 테스트 예산을 배분해 보세요.`);
    }
    if (ranked.length >= 2) {
      const worst = ranked[ranked.length - 1];
      const avgEff = safeDivide(ranked.reduce((s, c) => s + c.efficiency, 0), ranked.length);
      const isBad = isRevenue ? worst.efficiency < avgEff * 0.7 : worst.efficiency > avgEff * 1.3;
      if (isBad && worst.spend > 0) {
        problems.push(`${worst.platform}의 ${effLabel}(${fmtEff(worst.efficiency)})가 평균(${fmtEff(avgEff)}) 대비 뚜렷하게 저조합니다.`);
        actions.push(`${worst.platform}은 소재 피로도·타겟팅을 재점검하고, 개선 안 되면 예산 비중을 줄이는 것을 권장합니다.`);
      }
    }
    if (!problems.length) {
      analysis.push('현재 특별한 위험 신호는 감지되지 않았습니다. 현재 매체 구성과 예산 배분을 유지하며 다음 기간 추이를 지켜보세요.');
      actions.push(`효율이 가장 좋은 ${ranked[0]?.platform ?? top.platform} 위주로 예산 증액 테스트를 검토해 볼 수 있습니다.`);
    }
    return { analysis, problems, actions };
  }, [channelBreakdown, profile.reportType, rows]);

  const updateProfile = (patch: Partial<DailyReportProfile>, forcePersist = false) => {
    const nextProfile = sanitizeReportProfile({ ...profile, ...patch, advertiserName });
    const next = { ...profiles, [advertiserName]: nextProfile };
    setProfiles(next);
    if (forcePersist || !currentIsSample) saveProfiles(next);
    setRowsOverride(prev => {
      const clone = { ...prev };
      Object.keys(clone).forEach(key => { if (key.startsWith(`${advertiserName}-`)) delete clone[key]; });
      return clone;
    });
  };
  // 행 삭제·이름수정·직접추가처럼 "지금 보이는 표(rowsOverride)는 이미 내가 직접 맞춰놨고,
  // profile에는 그 설정만 같이 저장하면 되는" 경우에 씁니다. updateProfile과 달리 rowsOverride를 지우지 않습니다.
  // (매체/지표 체크박스, 보고서 유형 전환처럼 원본 데이터 구성 자체가 바뀌는 경우는 기존 updateProfile을 그대로 씁니다.)
  const updateProfileOnly = (patch: Partial<DailyReportProfile>) => {
    const nextProfile = sanitizeReportProfile({ ...profile, ...patch, advertiserName });
    const next = { ...profiles, [advertiserName]: nextProfile };
    setProfiles(next);
    if (!currentIsSample) saveProfiles(next);
  };

  const [advertiserQuery, setAdvertiserQuery] = useState(advertiserName);
  useEffect(() => { setAdvertiserQuery(advertiserName); }, [advertiserName]);
  const changeAdvertiser = (value: string) => {
    setAdvertiserQuery(value); // 입력 중에는 검색어만 바꿉니다.
    if (!value.trim()) return;
    // 정확히 한 명만 매칭되거나(부분 검색), 완전히 일치하는 이름을 골랐을 때만 실제로 광고주를 전환합니다.
    // (그렇지 않으면 "서"처럼 입력 중인 텍스트가 그대로 광고주명이 되어 defaultProfileFor('서')처럼 깨지는 문제가 있었습니다.)
    const matches = allAdvertisers.filter(name => matchesAdvertiserFilter(name, value));
    if (matches.length === 1) {
      setSampleContext(false);
      setReportSource('manual');
      setAdvertiserName(matches[0]);
      setFilter(matches[0]);
      const nextType = (profiles[matches[0]] ?? defaultProfileFor(matches[0])).reportType;
      setTemplateName(`${matches[0]} · ${REPORT_TYPE_LABEL[nextType]} 양식`);
    } else if (allAdvertisers.includes(value)) {
      setSampleContext(false);
      setReportSource('manual');
      setAdvertiserName(value);
      setFilter(value);
      const nextType = (profiles[value] ?? defaultProfileFor(value)).reportType;
      setTemplateName(`${value} · ${REPORT_TYPE_LABEL[nextType]} 양식`);
    }
  };

  // 커스텀(직접 추가) 행이면 목록에서, 기본 매체·지표 행이면 hiddenRowIds에 추가해서 숨깁니다.
  // 직접입력 탭과 보고서 양식 탭에서 공통으로 씁니다.
  const deleteReportRow = (row: ReportRow) => {
    markManualEdit();
    const isCustom = row.id.startsWith('custom-');
    // 원본 지표(파생이 아닌 행)를 지우면, 같은 매체의 파생 지표(클릭률·클릭당 비용 등)도
    // 그 원본 값으로 계산되므로 더 이상 의미가 없습니다. 같은 매체의 파생 행들도 함께 숨깁니다.
    const dependentDerivedIds = (!isCustom && !row.derived && row.platform)
      ? rows.filter(r => r.platform === row.platform && r.derived && !r.customMetricId).map(r => r.id)
      : [];
    const next = rows.filter(r => r.id !== row.id && !dependentDerivedIds.includes(r.id));
    setRowsOverride(prev => ({ ...prev, [storageKey]: next }));
    if (isCustom) {
      updateProfileOnly({ customRows: (profile.customRows ?? []).filter(r => r.id !== row.id) });
    } else {
      updateProfileOnly({ hiddenRowIds: [...(profile.hiddenRowIds ?? []), row.id, ...dependentDerivedIds] });
    }
  };

  // 행 이름 수정. 커스텀(직접 추가) 행이면 profile.customRows에도 같이 반영해야
  // 새로고침·API 자동수집·양식 변경 후에도 바뀐 이름이 유지됩니다.
  const renameReportRow = (rowId: string, label: string) => {
    markManualEdit();
    setRowsOverride(prev => ({ ...prev, [storageKey]: rows.map(r => r.id === rowId ? { ...r, label } : r) }));
    if (rowId.startsWith('custom-')) {
      updateProfileOnly({ customRows: (profile.customRows ?? []).map(r => r.id === rowId ? { ...r, label } : r) });
    }
  };

  // '매체 추가'/'지표 추가' 모달에서 고른 항목을 실제로 반영하는 함수입니다.
  // '새 보고서 만들기': 데이터가 아직 없는 광고주도 유형만 고르면, 0으로 채워진 빈 보고서를 만들어서
  // 바로 값을 채워나갈 수 있게 합니다. 목록에 없는 광고주명을 입력하면 새 광고주로 등록됩니다.
  const createNewReport = () => {
    const name = newReportAdvertiser.trim();
    if (!name) { setNotice('광고주 이름을 입력하거나 선택하세요.'); setTimeout(() => setNotice(''), 2200); return; }
    if (!allAdvertisers.includes(name)) {
      const nextExtra = [...extraAdvertisers, name];
      setExtraAdvertisers(nextExtra);
      saveExtraAdvertisers(nextExtra);
    }
    const blankProfile = newReportType === 'integrated' ? integratedProfileFor(name)
      : newReportType === 'reach' ? reachProfileFor(name)
      : newReportType === 'revenue' ? { ...defaultProfileFor(name), reportType: 'revenue' as const, platforms: ['메타', '네이버', 'GFA', '카카오키워드', '카카오모먼트', '모비온', 'ADN', '구글', '카페24', '스마트스토어'], metrics: ['revenue', 'spend', 'roas'] as MetricKey[] }
      : newReportType === 'click' ? { ...defaultProfileFor(name), reportType: 'click' as const, clickMode: 'efficiency' as const, platforms: ['메타', '네이버', '구글', '카카오모먼트', 'GFA', '당근'], metrics: ['impressions', 'clicks', 'ctr', 'spend', 'cpc'] as MetricKey[] }
      : { ...defaultProfileFor(name), reportType: 'lead' as const, platforms: ['메타', '당근', '네이버', '구글 SA', 'YouTube AD', '틱톡'], metrics: ['leads', 'clicks', 'impressions', 'spend', 'cpa', 'cpc', 'ctr', 'conversionRate'] as MetricKey[] };
    const nextProfiles = { ...profiles, [name]: sanitizeReportProfile(blankProfile) };
    setProfiles(nextProfiles);
    saveProfiles(nextProfiles);
    // 이 광고주는 원본 데이터가 아직 없으니, 공용 데모 데이터 대신 0으로 채워진 빈 표로 시작합니다.
    const days = getMonthDays(month);
    const zeroSource: SourceMap = {};
    blankProfile.platforms.forEach(platform => {
      const bundle: Partial<Record<MetricKey, number[]>> = {};
      RAW_METRICS.forEach(metric => { bundle[metric] = days.map(() => 0); });
      zeroSource[platform] = bundle;
    });
    const blankRows = buildRows(blankProfile, month, zeroSource);
    const key = `${name}-${month}-${blankProfile.reportType}`;
    setRowsOverride(prev => ({ ...prev, [key]: blankRows }));
    setAdvertiserName(name);
    setFilter(name);
    setSampleContext(false);
    setReportSource('manual');
    setNewReportModalOpen(false);
    setTab('preview');
    setNotice(`"${name}" 광고주로 새 ${REPORT_TYPE_LABEL[blankProfile.reportType]} 보고서를 만들었습니다. 이제 데이터를 입력하고 저장하면 됩니다.`);
    setTimeout(() => setNotice(''), 3200);
  };

  const addPlatform = (platform: string) => {
    if (profile.platforms.includes(platform)) return;
    const hasSourceData = availablePlatforms.includes(platform);
    updateProfile({ platforms: [...profile.platforms, platform] });
    if (!hasSourceData) {
      // 환경설정에서 등록한 매체라 원본 데이터가 없으므로, 빈 커스텀 행을 만들어서 바로 값을 입력할 수 있게 합니다.
      const days = getMonthDays(month);
      const newRow: ReportRow = { id: `custom-${Date.now()}`, group: '직접 추가한 항목', platform, label: `${platform} 광고비`, metric: 'spend', format: 'currency', values: days.map(() => 0), total: 0 };
      updateProfileOnly({ customRows: [...(profile.customRows ?? []), newRow] });
    }
    markManualEdit();
    setNotice(`"${platform}" 매체를 추가했습니다.`);
    setTimeout(() => setNotice(''), 2600);
  };
  const addMetric = (metric: MetricKey) => {
    if (profile.metrics.includes(metric)) return;
    updateProfile({ metrics: [...profile.metrics, metric] });
    markManualEdit();
    setNotice(`"${getMetricLabel(metric)}" 지표를 추가했습니다.`);
    setTimeout(() => setNotice(''), 2600);
  };

  const changeReportType = (type: ReportType) => {
    const next = type === 'integrated' ? integratedProfileFor(advertiserName)
      : type === 'reach' ? reachProfileFor(advertiserName)
      : type === 'custom' ? customProfileFor(advertiserName)
      : type === 'revenue' ? { ...defaultProfileFor(advertiserName), reportType: 'revenue' as const, platforms: ['메타', '네이버', 'GFA', '카카오키워드', '카카오모먼트', '모비온', 'ADN', '구글', '카페24', '스마트스토어'], metrics: ['revenue', 'spend', 'roas'] as MetricKey[] }
      : type === 'click' ? { ...defaultProfileFor(advertiserName), reportType: 'click' as const, clickMode: 'efficiency' as const, platforms: ['메타', '네이버', '구글', '카카오모먼트', 'GFA', '당근'], metrics: ['impressions', 'clicks', 'ctr', 'spend', 'cpc'] as MetricKey[] }
      : { ...defaultProfileFor(advertiserName), reportType: 'lead' as const, platforms: ['메타', '당근', '네이버', '구글 SA', 'YouTube AD', '틱톡'], metrics: ['leads', 'clicks', 'impressions', 'spend', 'cpa', 'cpc', 'ctr', 'conversionRate'] as MetricKey[] };
    updateProfile({ ...next, advertiserName });
    setReportSource(currentIsSample ? 'sample' : 'manual');
    setApiSourceLabel('대기 중');
    setTemplateName(`${advertiserName} · ${REPORT_TYPE_LABEL[next.reportType]} 양식`);
  };

  const onCellChange = (rowId: string, dayIndex: number, value: number) => {
    markManualEdit();
    setRowsOverride(prev => {
      const current = prev[storageKey] ?? baseRows;
      const editedRows = current.map(row => {
        if (row.id !== rowId) return row;
        const values = [...row.values];
        values[dayIndex] = value;
        return { ...row, values, total: sum(values) };
      });
      const editedSource = rowsToSource(editedRows, getMonthDays(month).length);
      const customRows = editedRows.filter(row => row.id.startsWith('custom-') || row.group === '직접 추가한 항목');
      const recalculatedRows = Object.keys(editedSource).length ? [...buildRows(profile, month, editedSource, { includeCustomRows: false }), ...customRows] : editedRows;
      return { ...prev, [storageKey]: recalculatedRows };
    });
  };

  const syncApiData = async () => {
    if (currentIsSample) {
      setNotice('테스트 샘플 편집 중에는 실제 API 데이터를 수집할 수 없습니다. 실제 보고서를 새로 만들거나 열어 다시 시도해 주세요.');
      setTimeout(() => setNotice(''), 4200);
      return;
    }
    setSyncingApi(true);
    setApiSourceLabel('API 수집 중');
    try {
      const result = await apiFetch<{ ok?: boolean; source?: SourceMap; mode?: string; collectedAt?: string }>('/reports/daily-performance', {
        method: 'POST',
        body: JSON.stringify({ advertiserName, month, reportType: profile.reportType, platforms: profile.platforms, metrics: profile.metrics }),
      });
      if (!result.source || !Object.keys(result.source).length) throw new Error('연결된 매체 데이터가 없습니다.');
      const apiSource = normalizeApiSource(result.source, {});
      const syncedRows = buildRows(profile, month, apiSource);
      setRowsOverride(prev => ({ ...prev, [storageKey]: syncedRows }));
      setApiSourceLabel(`API 자동수집 완료 ${result.collectedAt ? new Date(result.collectedAt).toLocaleString('ko-KR') : ''}`);
      setSampleContext(false);
      setReportSource('api');
      setTab('preview');
      setNotice('매체별 API 데이터가 자동 입력되고 계산 지표가 갱신되었습니다.');
    } catch (error) {
      setApiSourceLabel('연결된 API 데이터 없음');
      setSampleContext(false);
      setReportSource('manual');
      setNotice(error instanceof Error ? error.message : '연결된 광고 API가 없습니다. 매체·계정 연동 후 다시 시도해 주세요.');
    } finally {
      setSyncingApi(false);
      setTimeout(() => setNotice(''), 3200);
    }
  };

  // "열기": 저장 당시의 advertiserName·month·reportType·profile·period 설정을 모두 함께 복원합니다.
  // profile을 먼저 복원해야 storageKey(advertiserName-month-reportType)가
  // 저장된 rows의 키와 일치해서, 화면에 정확히 그 보고서가 다시 보입니다.
  const openGeneratedReport = (report: GeneratedReport) => {
    const restoredProfile: DailyReportProfile = report.profile ?? {
      ...defaultProfileFor(report.advertiserName),
      reportType: report.reportType,
    };

    setAdvertiserName(report.advertiserName);
    setMonth(report.month);
    const openedAsSample = isSampleReport(report);
    if (openedAsSample) {
      // 테스트 샘플을 열었다고 실제 광고주 프로필 설정까지 바뀌면 안 됩니다. profiles STATE는
      // 그대로 두고, 이 화면에서만 쓰는 override로 따로 관리합니다(샘플 세션이 끝나면 자동 정리).
      setSampleProfileOverride(restoredProfile);
    } else {
      setSampleProfileOverride(null);
      setProfiles(prev => {
        const next = { ...prev, [report.advertiserName]: restoredProfile };
        saveProfiles(next);
        return next;
      });
    }

    const storageKeyForReport = `${report.advertiserName}-${report.month}-${report.reportType}`;
    if (report.rows) {
      setRowsOverride(prev => ({ ...prev, [storageKeyForReport]: report.rows! }));
    }
    if (openedAsSample) sampleStorageKeysRef.current.add(storageKeyForReport);
    setSampleContext(openedAsSample);
    setReportSource(openedAsSample ? 'sample' : (report.source ?? 'manual'));
    if (report.periodType) setPeriodType(report.periodType);
    if (report.visibleDayIndexes?.length) {
      const firstDay = getMonthDays(report.month)[report.visibleDayIndexes[0]];
      if (firstDay?.iso) setPeriodAnchor(firstDay.iso);
    }
    setTab('preview');
  };

  const [sheetSyncStatus, setSheetSyncStatus] = useState('');
  const [chartPlatform, setChartPlatform] = useState('전체');
  // 지금 화면에 보이는 기간(일별/주별/월별 선택에 따라 다름)의 매체별 데이터를 구글 시트로 전송합니다.
  // 환경설정 > 보고서 외부 연동에서 등록한 Apps Script 웹앱 URL로 날짜 x 매체 조합마다 한 번씩 보냅니다.
  const sendToGoogleSheet = async () => {
    if (currentIsSample) {
      setSheetSyncStatus('테스트 샘플 데이터는 실제 구글 시트로 전송할 수 없습니다. 실제 보고서를 열어 다시 시도해 주세요.');
      setTimeout(() => setSheetSyncStatus(''), 4200);
      return;
    }
    const settings = loadReportIntegrationSettings();
    const url = settings.googleSheets.webhookUrl.trim();
    if (!url) { setSheetSyncStatus('환경설정 > 보고서 외부 연동에서 Apps Script 웹앱 URL을 먼저 등록해 주세요.'); setTimeout(() => setSheetSyncStatus(''), 3600); return; }
    const indexes = visibleDayIndexes ?? allMonthDays.map((_, i) => i);
    const platforms = Array.from(new Set(rows.filter(r => r.platform).map(r => r.platform as string)));
    const pick = (platform: string, metric: MetricKey) => rows.find(r => r.platform === platform && r.metric === metric && !r.derived);
    let sent = 0, failed = 0;
    setSheetSyncStatus('구글 시트로 전송하는 중...');
    for (const platform of platforms) {
      const spendRow = pick(platform, 'spend'), impRow = pick(platform, 'impressions'), clickRow = pick(platform, 'clicks'), leadRow = pick(platform, 'leads'), revRow = pick(platform, 'revenue');
      for (const i of indexes) {
        const spend = spendRow?.values[i] ?? 0;
        const revenue = revRow?.values[i] ?? 0;
        if (spend === 0 && revenue === 0 && (impRow?.values[i] ?? 0) === 0 && (clickRow?.values[i] ?? 0) === 0 && (leadRow?.values[i] ?? 0) === 0) continue; // 데이터 없는 날은 건너뜁니다.
        const payload = {
          date: allMonthDays[i]?.iso ?? '', advertiser: advertiserName, platform,
          spend, impressions: impRow?.values[i] ?? 0, clicks: clickRow?.values[i] ?? 0,
          db: leadRow?.values[i] ?? 0, contract: 0, revenue,
          roas: spend > 0 ? Math.round((revenue / spend) * 1000) / 10 : 0,
        };
        const result = await sendRowToGoogleSheet(url, payload);
        if (result.ok) sent += 1; else failed += 1;
      }
    }
    setSheetSyncStatus(failed === 0 ? `${sent}건을 구글 시트에 전송했습니다.` : `${sent}건 전송, ${failed}건 실패했습니다. URL과 배포 상태를 확인해 주세요.`);
    setTimeout(() => setSheetSyncStatus(''), 4200);
  };

  const saveGenerated = (targetPeriodType: 'daily' | 'weekly' | 'monthly', requestedName: string) => {
    const periodView = resolvePeriodView(targetPeriodType);
    const reportName = requestedName.trim() || buildDefaultGeneratedReportName(targetPeriodType);
    const report: GeneratedReport = {
      id: `${Date.now()}`,
      advertiserName,
      month,
      reportType: profile.reportType,
      createdAt: new Date().toISOString(),
      rowCount: displayRows.length,
      rows: displayRows,
      summary: buildSummaryForIndexes(periodView.visibleDayIndexes),
      source: currentIsSample ? 'sample' : reportSource,
      isSample: currentIsSample,
      profile,
      reportName,
      periodType: targetPeriodType,
      periodLabel: periodView.periodLabel,
      visibleDayIndexes: periodView.visibleDayIndexes,
      customMetricSnapshots: Array.from(new Map(customMetricRows
        .filter(row => row.customMetricId)
        .map(row => [row.customMetricId!, {
          id: row.customMetricId!,
          name: row.customMetricName ?? row.label,
          formula: row.customMetricFormula ?? '',
          unit: row.customMetricUnit ?? '',
          direction: row.customMetricDirection,
          aggregationType: row.customMetricAggregation,
        }] as const)).values()),
    };
    const actualReports = generatedReports.filter(item => !isSampleReport(item));
    const sampleReports = generatedReports.filter(isSampleReport);
    const isSample = isSampleReport(report);
    const nextActual = isSample ? actualReports : [report, ...actualReports].slice(0, 50);
    const nextSample = isSample ? [report, ...sampleReports].slice(0, 80) : sampleReports;
    const ok = isSample ? saveSampleReports(nextSample) : saveGeneratedReports(nextActual);
    if (ok) {
      setGeneratedReports([...nextActual, ...nextSample]);
      setSaveNameModal(null);
    }
    setNotice(ok ? `“${reportName}” 이름으로 생성된 보고서 목록에 저장했습니다.` : '브라우저 저장 공간이 부족해 저장하지 못했습니다. 오래된 보고서를 정리한 뒤 다시 시도해 주세요.');
    setTimeout(() => setNotice(''), ok ? 3000 : 4000);
  };

  const saveCurrentTemplate = () => {
    if (currentIsSample) {
      setNotice('테스트 샘플에서 수정한 양식은 실제 광고주 양식으로 저장할 수 없습니다. 실제 보고서에서 다시 설정해 주세요.');
      setTimeout(() => setNotice(''), 3600);
      return;
    }
    const trimmedName = templateName.trim() || `${advertiserName} · ${REPORT_TYPE_LABEL[profile.reportType]} 양식`;
    const template: SavedReportTemplate = {
      id: `${Date.now()}`,
      name: trimmedName,
      advertiserName,
      reportType: profile.reportType,
      createdAt: new Date().toISOString(),
      profile: sanitizeReportProfile(profile),
    };
    const nextProfiles = { ...profiles, [advertiserName]: sanitizeReportProfile(profile) };
    // 같은 광고주에서 이름까지 똑같을 때만 이전 버전을 덮어씁니다. 이름을 다르게 저장하면
    // "광고주명 · 병원용", "광고주명 · 원장님 보고용"처럼 여러 버전을 함께 보관할 수 있습니다.
    const nextTemplates = [template, ...savedTemplates.filter(item => !(item.advertiserName === advertiserName && item.name === trimmedName))].slice(0, 50);
    setProfiles(nextProfiles);
    saveProfiles(nextProfiles);
    setSavedTemplates(nextTemplates);
    saveSavedTemplates(nextTemplates);
    setNotice(`"${trimmedName}" 이름으로 저장된 양식 목록에 저장했습니다.`);
    setTimeout(() => setNotice(''), 2600);
  };

  const openSavedTemplate = (template: SavedReportTemplate) => {
    // 그 광고주에 직접 수정한 값(rowsOverride)이 남아있으면, 양식을 불러오는 순간 사라지므로 먼저 확인합니다.
    const hasUnsavedEdits = Object.keys(rowsOverride).some(key => key.startsWith(`${template.advertiserName}-`));
    if (hasUnsavedEdits && !confirm(`"${template.advertiserName}" 광고주에서 직접 수정한 데이터가 있습니다. 양식을 불러오면 그 수정 내용이 초기화됩니다. 계속할까요?`)) {
      return;
    }
    setSampleContext(false);
    setReportSource('manual');
    setAdvertiserName(template.advertiserName);
    setTemplateName(template.name);
    setProfiles(prev => {
      const next = { ...prev, [template.advertiserName]: sanitizeReportProfile(template.profile) };
      saveProfiles(next);
      return next;
    });
    setRowsOverride(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => { if (key.startsWith(`${template.advertiserName}-`)) delete next[key]; });
      return next;
    });
    setTab('template');
    setNotice('저장된 양식을 불러왔습니다.');
    setTimeout(() => setNotice(''), 2200);
  };

  const deleteSavedTemplate = (templateId: string) => {
    const next = savedTemplates.filter(template => template.id !== templateId);
    setSavedTemplates(next);
    saveSavedTemplates(next);
  };

  const exportGeneratedReport = async (report: GeneratedReport) => {
    const reportRows = report.rows ?? [];
    if (!reportRows.length) {
      setNotice('이 저장본에는 내보낼 행 데이터가 없습니다. 보고서를 열어 다시 저장해 주세요.');
      setTimeout(() => setNotice(''), 3600);
      return;
    }
    const sample = isSampleReport(report);
    const label = report.reportName || `${report.advertiserName}_${report.month}_매체별_광고보고서`;
    try {
      setNotice('저장된 보고서 PDF를 생성하는 중입니다...');
      const result = await saveReportRowsPdf(report.advertiserName, report.month, reportRows, report.visibleDayIndexes, report.periodLabel, sample, label);
      setNotice(result === 'saved' ? 'PDF를 저장했습니다.' : '');
      setTimeout(() => setNotice(''), 2400);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'PDF 생성 중 문제가 발생했습니다.');
      setTimeout(() => setNotice(''), 4600);
    }
  };

  const visibleGeneratedReports = useMemo(() => {
    const base = generatedReports.filter(report => matchesAdvertiserFilter(report.advertiserName, filterValue));
    const q = generatedSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(report => {
      const name = (report.reportName || '').toLowerCase();
      const adv = report.advertiserName.toLowerCase();
      const period = (report.periodLabel || '').toLowerCase();
      const type = REPORT_TYPE_LABEL[report.reportType].toLowerCase();
      return name.includes(q) || adv.includes(q) || period.includes(q) || type.includes(q);
    });
  }, [generatedReports, filterValue, generatedSearch]);

  // 광고주별/보고서 유형별/기간별로 묶어서 볼 때 쓰는 그룹 목록입니다. '보기 없음'이면
  // 전체를 하나의 그룹으로 취급합니다.
  const groupedGeneratedReports = useMemo(() => {
    if (generatedGroupBy === 'none') return [{ label: '', items: visibleGeneratedReports }];
    const groups = new Map<string, GeneratedReport[]>();
    visibleGeneratedReports.forEach(report => {
      const periodTypeLabel = report.periodType === 'daily' ? '일간' : report.periodType === 'weekly' ? '주간' : '월간';
      const [y, m] = report.month.split('-');
      const monthLabel = y && m ? `${y}년 ${Number(m)}월` : report.month;
      const key = generatedGroupBy === 'advertiser' ? report.advertiserName
        : generatedGroupBy === 'type' ? REPORT_TYPE_LABEL[report.reportType]
        : `${monthLabel} · ${periodTypeLabel}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(report);
    });
    const sortItems = (items: GeneratedReport[]) => [...items].sort((a, b) =>
      generatedSort === 'name' ? (a.reportName ?? '').localeCompare(b.reportName ?? '')
        : generatedSort === 'oldest' ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt)
    );
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items: sortItems(items) }));
  }, [visibleGeneratedReports, generatedGroupBy, generatedSort]);

  const visibleSavedTemplates = useMemo(
    () => savedTemplates.filter(template => matchesAdvertiserFilter(template.advertiserName, filterValue)),
    [savedTemplates, filterValue],
  );

  // CSV로 붙여넣은 텍스트든, 엑셀에서 바로 읽은 표든 결국 문자열 2차원 배열(string[][])만 있으면 되므로,
  // 실제 반영 로직은 이 함수 하나로 통일합니다. 엑셀은 더 이상 CSV 문자열로 변환했다가 다시 파싱하지 않습니다.
  const applyParsedRows = (rawParsedRows: string[][]) => {
    // 이 앱에서 받은 CSV/엑셀을 그대로 다시 올리는 경우, 표의 헤더 2줄과 맨 아래 "생성 기준: ..." 안내 줄까지
    // 데이터 행으로 들어가지 않도록 걸러냅니다. CSV와 엑셀 둘 다 이 함수를 거치므로 같은 기준으로 걸러집니다.
    const parsedRows = rawParsedRows.filter(line => {
      const label = line[0] ?? '';
      const second = line[1] ?? '';
      if (!label) return false;
      if (second === 'TOTAL') return false; // 헤더 2번째 줄(광고주명, TOTAL, 날짜...)
      if (label.includes('생성 기준')) return false;
      if (label.includes('광고관제소') || label.includes('유니버스')) return false;
      const numericValues = line.slice(2).map(parseNumber);
      return numericValues.some(value => value !== 0);
    });
    if (parsedRows.length < 1) {
      setNotice('반영할 데이터가 없습니다. 행 이름, TOTAL, 날짜별 값 순서로 입력해 주세요.');
      setTimeout(() => setNotice(''), 3000);
      return;
    }
    const monthDays = getMonthDays(month);
    const uploadedSource: SourceMap = {};
    const customRows: ReportRow[] = [];

    parsedRows.forEach((line, index) => {
      const label = line[0] || `업로드 행 ${index + 1}`;
      const values = pad31(line.slice(2).map(parseNumber), monthDays.length);
      const metric: MetricKey = label.includes('DB') && !label.includes('당') ? 'leads'
        : label.includes('도달') ? 'reach'
        : label.includes('클릭률') || label.includes('클릭율') ? 'ctr'
        : label.includes('전환률') || label.includes('전환율') ? 'conversionRate'
        : label.includes('클릭당') ? 'cpc' // '클릭당 비용' — 파생지표라 RAW_METRICS에 없어 원본 데이터로 안 씀
        : label.includes('1개당') || label.includes('당 비용') ? 'cpa' // 'DB 1개당 비용' — 파생지표
        : label.includes('ROAS') ? 'roas'
        : label.includes('순매출') ? 'netRevenue'
        : label.includes('노출') ? 'impressions'
        : label.includes('광고비') ? 'spend' // '비용'이 아니라 '광고비'로만 매칭해야 위의 파생지표들과 안 겹칩니다.
        : label.includes('매출') ? 'revenue'
        : label.includes('결제') ? 'payments'
        : label.includes('환불') ? 'refunds'
        : label.includes('클릭') ? 'clicks'
        : 'leads';
      const platform = profile.platforms.find(name => label.replace(/\s/g, '').includes(name.replace(/\s/g, '')));
      const isDerivedMetric = !RAW_METRICS.includes(metric);
      // 파생지표 행(매체별 "메타 클릭당 비용"이든, 합계 "전체 ROAS"든)은 buildRows가 원본 데이터로부터
      // 자동으로 다시 계산하므로, 업로드 데이터로 남겨두면 똑같은 값이 중복 행으로 쌓이기만 합니다. 건너뜁니다.
      if (isDerivedMetric && (platform || label.startsWith('총') || label.startsWith('전체') || label.startsWith('평균'))) return;

      if (platform && RAW_METRICS.includes(metric)) {
        const bundle = uploadedSource[platform] ?? {};
        (bundle as Record<string, number[]>)[metric] = values;
        uploadedSource[platform] = bundle;
      } else {
        customRows.push({
          id: `upload-${Date.now()}-${index}`,
          group: '업로드 데이터',
          label,
          metric,
          format: inferFormat(metric),
          values,
          total: sum(values),
        });
      }
    });

    const hasSource = Object.keys(uploadedSource).length > 0;
    const reportRows = hasSource ? [...buildRows(profile, month, uploadedSource), ...customRows] : customRows;
    setRowsOverride(prev => ({ ...prev, [storageKey]: reportRows }));
    setReportSource(currentIsSample ? 'sample' : 'upload');
    setTab('preview');
    setNotice(hasSource ? '업로드 원본 데이터로 표와 자동계산 행을 다시 생성했습니다.' : '업로드 행을 사용자 지정 행으로 반영했습니다.');
    setTimeout(() => setNotice(''), 3000);
  };

  const applyCsvUpload = () => {
    // 엑셀에서 바로 읽어둔 표가 있으면(텍스트로 왕복하지 않고) 그걸 그대로 씁니다.
    // 헤더/생성기준 필터는 applyParsedRows 안에서 공통으로 처리됩니다.
    if (pendingExcelRows) { applyParsedRows(pendingExcelRows); setPendingExcelRows(null); return; }
    const lines = uploadText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      setNotice('CSV 데이터가 부족합니다. 행 이름, TOTAL, 날짜별 값 순서로 붙여넣어 주세요.');
      setTimeout(() => setNotice(''), 3000);
      return;
    }
    const parsedRows = lines.map(line => parseCsvLine(line).map(cell => cell.trim().replace(/^"|"$/g, '')));
    applyParsedRows(parsedRows);
  };

  const handleFileUpload = async (file?: File | null) => {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      // 엑셀 표를 string[][]로 바로 읽어서 저장해둡니다. CSV 문자열로 바꿨다가 다시 파싱하지 않으므로
      // 셀 안에 쉼표나 따옴표가 있어도 안전합니다. 미리보기 텍스트는 화면 확인용일 뿐 실제 반영에는 이 배열을 씁니다.
      const excelRows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, raw: false })
        .map(row => row.map(cell => String(cell ?? '').trim()))
        .filter(row => row.some(cell => cell));
      setPendingExcelRows(excelRows);
      setUploadText(excelRows.map(row => row.join(', ')).join('\n'));
      setNotice('엑셀 파일을 읽었습니다. 미리보기 후 업로드 데이터 적용을 눌러 주세요.');
      setTimeout(() => setNotice(''), 2800);
      return;
    }
    setPendingExcelRows(null);
    const text = await file.text();
    setUploadText(text);
  };

  return (
    <div className="advertiser-daily-report-page">
      <PageHeader
        title="보고서 관리"
        description="광고주를 고르고, 데이터를 확인한 뒤, 필요한 항목만 선택해 저장하는 흐름으로 정리했습니다."
        action={
          <div className="action-row">
            <Link className="btn secondary" to="/db-management"><Database size={15}/> DB 데이터</Link>
            <button className="btn primary" onClick={()=>{setNewReportModalOpen(true);setNewReportAdvertiser('');setNewReportType('lead')}}><FilePlus2 size={15}/> 새 보고서 만들기</button>
            <button className="btn secondary" onClick={() => downloadCsv(advertiserName, month, displayRows, visibleDayIndexes, periodType!=='monthly'?`_${periodType==='daily'?'일간':'주간'}`:'', currentIsSample)}><Download size={15}/> CSV</button>
            <button className="btn secondary" onClick={() => downloadXlsx(advertiserName, month, displayRows, visibleDayIndexes, periodType!=='monthly'?`_${periodType==='daily'?'일간':'주간'}`:'', currentIsSample)}><FileSpreadsheet size={15}/> 엑셀</button>
            <button className="btn secondary" onClick={() => openPrint(advertiserName, month, displayRows, visibleDayIndexes, periodLabel, currentIsSample)}><FileText size={15}/> PDF 인쇄</button>
            <button className="btn secondary" onClick={() => {
              setNotice('PDF를 생성하는 중입니다...');
              void saveReportRowsPdf(advertiserName, month, displayRows, visibleDayIndexes, periodLabel, currentIsSample)
                .then((result) => { setNotice(result === 'saved' ? 'PDF를 저장했습니다.' : ''); setTimeout(() => setNotice(''), 2200); })
                .catch((error) => { setNotice(error instanceof Error ? error.message : 'PDF 생성 중 문제가 발생했습니다.'); setTimeout(() => setNotice(''), 4200); });
            }}><Download size={15}/> PDF 저장</button>
            <button className="btn secondary" onClick={syncApiData} disabled={syncingApi}><RefreshCw size={15} className={syncingApi ? 'is-spinning' : ''}/> API 자동수집</button>
            <button className="btn primary" onClick={() => requestGeneratedSave()}><Save size={15}/> 생성 저장</button>
            <button className="btn secondary" onClick={sendToGoogleSheet}><Upload size={15}/> 구글 시트에 저장</button>
          </div>
        }
      />
      {newReportModalOpen && (
        <div className="modal-backdrop" onClick={()=>setNewReportModalOpen(false)}>
          <div className="modal-card wide" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <div><h3>새 보고서 만들기</h3><p>아직 데이터가 없는 광고주도 유형만 고르면 0으로 채워진 빈 보고서를 바로 시작할 수 있습니다.</p></div>
              <button className="icon-btn" onClick={()=>setNewReportModalOpen(false)}><X size={18}/></button>
            </div>
            <label className="field-label">광고주
              <input value={newReportAdvertiser} onChange={e=>setNewReportAdvertiser(e.target.value)} list="new-report-advertiser-list" placeholder="기존 광고주를 고르거나, 새 광고주명을 입력하세요" autoFocus/>
              <datalist id="new-report-advertiser-list">{allAdvertisers.map(name => <option key={name} value={name}/>)}</datalist>
            </label>
            <p className="footnote" style={{margin:'10px 0'}}>목록에 없는 이름을 입력하면 새 광고주로 등록됩니다.</p>
            <div className="daily-report-type-cards">
              {(['lead','revenue','click','reach','integrated'] as ReportType[]).map(type => (
                <ReportTypeCard key={type} type={type} active={newReportType===type} onClick={()=>setNewReportType(type)}/>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={()=>setNewReportModalOpen(false)}>취소</button>
              <button className="btn primary" onClick={createNewReport}><FilePlus2 size={15}/> 이 조건으로 보고서 만들기</button>
            </div>
          </div>
        </div>
      )}

      {saveNameModal && (
        <div className="modal-backdrop" onClick={() => setSaveNameModal(null)}>
          <div className="modal-card wide" onClick={event => event.stopPropagation()}>
            <div className="modal-head">
              <div><h3>보고서 이름 확인</h3><p>기본 보고서명을 그대로 사용하거나, 관리자가 원하는 이름으로 수정한 뒤 저장할 수 있습니다.</p></div>
              <button className="icon-btn" onClick={() => setSaveNameModal(null)}><X size={18}/></button>
            </div>
            <label className="field-label">보고서명
              <input
                value={saveNameModal.name}
                onChange={event => setSaveNameModal({ ...saveNameModal, name: event.target.value })}
                maxLength={160}
                autoFocus
              />
            </label>
            <p className="footnote" style={{ marginTop: 8 }}>기본 형식: 광고주명 · 보고서 유형 · 대상 기간 · 매체별 광고보고서 · 생성일(년월일)</p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setSaveNameModal(null)}>취소</button>
              <button className="btn primary" onClick={() => saveGenerated(saveNameModal.periodType, saveNameModal.name)} disabled={!saveNameModal.name.trim()}><Save size={15}/> 이 이름으로 저장</button>
            </div>
          </div>
        </div>
      )}

      {notice && <div className="daily-report-notice"><CheckCircle2 size={16}/>{notice}</div>}
      {sheetSyncStatus && <div className="daily-report-notice"><Upload size={16}/>{sheetSyncStatus}</div>}

      <section className="card daily-report-control-card">
        <div className="daily-report-control-grid">
          <label className="field-label">
            선택된 광고주
            <div className="daily-report-input-with-icon readonly" title="광고주를 바꾸려면 상단 검색창을 이용하세요">
              <Search size={16}/>
              <span className="daily-report-advertiser-readout">{advertiserName}</span>
            </div>
          </label>
          <label className="field-label">
            조회 연월
            <input type="month" value={month} onChange={(event) => { setSampleContext(false); setReportSource('manual'); setMonth(event.target.value); }} />
          </label>
          <label className="field-label">
            보고서 유형
            <button type="button" className="report-type-badge" onClick={()=>setTab('template')} title="유형을 바꾸려면 '3. 양식 설정' 탭에서 카드로 고르세요">
              {REPORT_TYPE_LABEL[profile.reportType]}<LayoutTemplate size={12}/>
            </button>
          </label>
          {profile.reportType === 'click' && (
            <label className="field-label">
              클릭형 표시 수준
              <select value={profile.clickMode ?? 'efficiency'} onChange={(event) => updateProfile({ clickMode: event.target.value as ClickMode, metrics: event.target.value === 'simple' ? ['clicks'] : ['impressions','clicks','ctr','spend','cpc'] })}>
                <option value="simple">클릭수 간편형</option>
                <option value="efficiency">클릭 효율형</option>
              </select>
            </label>
          )}
        </div>
        <div className="daily-report-api-strip">
          <span>일일데이터 입력 방식</span>
          <b>{apiSourceLabel}</b>
          <button type="button" className="btn secondary" onClick={syncApiData} disabled={syncingApi}><RefreshCw size={14} className={syncingApi ? 'is-spinning' : ''}/> 매체 API 데이터 수집</button>
        </div>
        <div className="report-simple-help">초보자용 기본 흐름: <b>보고서 조회</b>에서 확인 → 필요한 행은 바로 추가/삭제 → <b>양식 설정</b>에서 기본 항목 저장 → <b>생성된 보고서</b>에서 보관본 확인</div>
        <div className="daily-report-type-cards">
          {(['lead','revenue','click','reach','integrated','custom'] as ReportType[]).map(type => <ReportTypeCard key={type} type={type} active={profile.reportType === type} onClick={() => changeReportType(type)} />)}
        </div>
        <div className="report-current-template-strip">
          <b>현재 양식</b>
          <span>{profile.platforms.length}개 매체 · {profile.metrics.length}개 지표</span>
          <em>필요한 항목은 보고서 조회 화면에서도 바로 추가·삭제할 수 있습니다.</em>
        </div>
      </section>

      <section className="card report-workflow-card">
        <div className="workflow-step"><b>1</b><span>광고주 월 선택</span><small>상단에서 광고주, 월, 보고서 유형을 먼저 고릅니다.</small></div>
        <div className="workflow-step"><b>2</b><span>보고서 확인</span><small>조회 화면에서 바로 데이터 추가·수정·삭제가 가능합니다.</small></div>
        <div className="workflow-step"><b>3</b><span>양식 관리</span><small>매체와 지표의 추가·수정·삭제는 환경설정에서 관리합니다.</small></div>
        <div className="workflow-step"><b>4</b><span>저장 출력</span><small>일별, 주별, 월별 보고서를 따로 저장합니다.</small></div>
      </section>

      <div className="daily-report-tabs simplified">
        <button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}><CalendarDays size={15}/> 1. 보고서 조회</button>
        <button className={tab === 'data' || tab === 'api' || tab === 'input' || tab === 'upload' ? 'active' : ''} onClick={() => setTab('data')}><Upload size={15}/> 2. 데이터 입력/수집</button>
        <button className={tab === 'template' ? 'active' : ''} onClick={() => setTab('template')}><LayoutTemplate size={15}/> 3. 양식 설정</button>
        <button className={tab === 'savedTemplates' ? 'active' : ''} onClick={() => setTab('savedTemplates')}><Save size={15}/> 저장된 양식</button>
        <button className={tab === 'generated' ? 'active' : ''} onClick={() => setTab('generated')}><FileText size={15}/> 생성된 보고서</button>
        <button className={tab === 'media' ? 'active' : ''} onClick={() => setTab('media')}><BarChart3 size={15}/> 매체 성과</button>
      </div>

      <div className="daily-report-summary-grid">
        <div className="report-kpi-card"><span>선택 광고주</span><strong>{advertiserName}</strong><small>{REPORT_TYPE_LABEL[profile.reportType]}</small></div>
        {profile.reportType === 'integrated' ? (
          <>
            <div className="report-kpi-card"><span>총 광고비</span><strong>{formatCellForAdvertiser(summary.spend, 'currency', advertiserName)}</strong><small>{profile.platforms.length}개 매체 통합</small></div>
            <div className="report-kpi-card"><span>총 DB</span><strong>{Math.round(summary.leads).toLocaleString()}</strong><small>전체 매체 합산</small></div>
            <div className="report-kpi-card"><span>총 매출</span><strong>{formatCellForAdvertiser(summary.revenue, 'currency', advertiserName)}</strong><small>전체 데이터 통합</small></div>
          </>
        ) : profile.reportType === 'reach' ? (
          <>
            <div className="report-kpi-card"><span>총 노출수</span><strong>{Math.round(summary.impressions).toLocaleString()}</strong><small>{periodLabel ?? '월간 TOTAL'}</small></div>
            <div className="report-kpi-card"><span>총 도달</span><strong>{Math.round(summary.reach).toLocaleString()}</strong><small>매체 합산</small></div>
            <div className="report-kpi-card"><span>총 광고비</span><strong>{formatCellForAdvertiser(summary.spend, 'currency', advertiserName)}</strong><small>인지도 캠페인 비용</small></div>
          </>
        ) : (
          <>
            <div className="report-kpi-card"><span>총 클릭수</span><strong>{Math.round(summary.clicks).toLocaleString()}</strong><small>{periodLabel ?? '월간 TOTAL'}</small></div>
            <div className="report-kpi-card"><span>총 광고비</span><strong>{formatCellForAdvertiser(summary.spend, 'currency', advertiserName)}</strong><small>매체 합산</small></div>
            {profile.reportType === 'lead' && <div className="report-kpi-card"><span>총 DB</span><strong>{Math.round(summary.leads).toLocaleString()}</strong><small>평균 CPA {formatCellForAdvertiser(summary.cpa, 'currency', advertiserName)}</small></div>}
            {profile.reportType === 'revenue' && <div className="report-kpi-card"><span>총 매출</span><strong>{formatCellForAdvertiser(summary.revenue, 'currency', advertiserName)}</strong><small>전체 ROAS {formatCell(summary.roas, 'percent')}</small></div>}
            {profile.reportType === 'click' && <div className="report-kpi-card"><span>전체 CPC</span><strong>{formatCellForAdvertiser(summary.cpc, 'currency', advertiserName)}</strong><small>{profile.clickMode === 'simple' ? '클릭수 간편형' : '클릭 효율형'}</small></div>}
          </>
        )}
      </div>

      {tab === 'preview' && (
        <section className="card daily-report-grid-card">
          {currentIsSample && (
            <div style={{ background: '#111827', color: '#fbbf24', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 14, fontWeight: 700, textAlign: 'center' }}>
              🧪 테스트 샘플 데이터입니다 — 실제 운영 데이터가 아닙니다. 광고주에게 전달하지 마세요.
            </div>
          )}
          <div className="daily-report-section-head">
            <div><h3>{advertiserName} {periodLabel ?? `${Number(month.split('-')[1])}월`} 매체별 광고보고서</h3><p>왼쪽 지표명과 TOTAL 열은 고정되고 날짜 영역은 가로 스크롤로 확인합니다.</p></div>
            <button className="btn secondary" onClick={() => { setRowsOverride(prev => { const next = { ...prev }; delete next[storageKey]; return next; }); setReportSource(currentIsSample ? 'sample' : 'manual'); setApiSourceLabel(currentIsSample ? '테스트 데이터' : '입력 전'); }}><RefreshCw size={15}/> 기본 데이터 복원</button>
          </div>
          <div className="period-type-row">
            <div className="period-type-toggle">
              <button className={periodType==='daily'?'active':''} onClick={()=>setPeriodType('daily')}>일일 보고서</button>
              <button className={periodType==='weekly'?'active':''} onClick={()=>setPeriodType('weekly')}>주간 보고서</button>
              <button className={periodType==='monthly'?'active':''} onClick={()=>setPeriodType('monthly')}>월간 보고서</button>
            </div>
            <label className="period-anchor-field">일별/주별 저장 기준일 <input type="date" value={periodAnchor.startsWith(month) ? periodAnchor : `${month}-01`} min={`${month}-01`} max={allMonthDays[allMonthDays.length - 1]?.iso ?? `${month}-31`} onChange={e=>setPeriodAnchor(e.target.value)}/></label>
          </div>
          <div className="daily-report-period-save-row three">
            <span>기준일(위 날짜 선택) 기준으로 원하는 기간 단위를 저장하세요</span>
            <button className={`btn ${periodType==='daily'?'primary':'secondary'}`} onClick={() => requestGeneratedSave('daily')}><Save size={14}/> 일별 생성 저장<small>{resolvePeriodView('daily').periodLabel}</small></button>
            <button className={`btn ${periodType==='weekly'?'primary':'secondary'}`} onClick={() => requestGeneratedSave('weekly')}><Save size={14}/> 주별 생성 저장<small>{resolvePeriodView('weekly').periodLabel}</small></button>
            <button className={`btn ${periodType==='monthly'?'primary':'secondary'}`} onClick={() => requestGeneratedSave('monthly')}><Save size={14}/> 월별 생성 저장<small>{resolvePeriodView('monthly').periodLabel}</small></button>
          </div>
          <ReportGrid advertiserName={advertiserName} month={month} rows={displayRows} editable onCellChange={onCellChange} onDeleteRow={deleteReportRow} visibleDayIndexes={visibleDayIndexes} periodLabel={periodLabel}/>

          {channelBreakdown.length > 0 && (() => {
            // channelBreakdown 자체의 primary/efficiency 계산과 반드시 같은 기준을 써야
            // 합니다(전체 통합형은 매출 데이터가 있으면 매출/ROAS 기준으로 계산되므로, 여기서도
            // 그 판단을 그대로 따라야 화면 라벨과 실제 표시되는 숫자가 어긋나지 않습니다).
            const hasMeaningfulRevenue = (profile.reportType === 'integrated' || profile.reportType === 'custom') && rows.some(r => r.metric === 'revenue' && !r.derived && r.total > 0);
            const isRevenue = profile.reportType === 'revenue' || hasMeaningfulRevenue, isReach = !hasMeaningfulRevenue && profile.reportType === 'reach', isClick = !hasMeaningfulRevenue && profile.reportType === 'click';
            const primaryLabel = isRevenue ? '매출' : isReach ? '노출수' : isClick ? '클릭수' : 'DB';
            const effLabel = isRevenue ? 'ROAS' : isClick ? 'CPC' : isReach ? 'CPM' : 'CPA';
            const totalSpend = channelBreakdown.reduce((s, x) => s + x.spend, 0);
            const fmtPrimary = (v: number) => isRevenue ? formatCell(v, 'currency') : v.toLocaleString();
            const fmtEff = (v: number) => isRevenue ? `${v.toFixed(0)}%` : formatCell(v, 'currency');
            // 광고비 / 핵심지표(전환·매출·클릭·노출) / 효율지표(CPA·ROAS·CPC·CPM) 3개를 각각 막대그래프로 보여줍니다.
            // 효율지표는 ROAS만 높을수록 좋고 나머지는 낮을수록 좋아서, 정렬 방향을 다르게 줍니다.
            type ChartDef = { key: string; title: string; getValue: (c: typeof channelBreakdown[number]) => number; format: (v: number) => string; sortDesc: boolean };
            const charts: ChartDef[] =
              profile.reportType === 'integrated'
                ? ([
                    { key: 'spend', title: '광고비', getValue: c => c.spend, format: v => formatCell(v, 'currency'), sortDesc: true },
                    { key: 'impressions', title: '노출수', getValue: c => c.impressions, format: v => v.toLocaleString(), sortDesc: true },
                    { key: 'clicks', title: '클릭수', getValue: c => c.clicks, format: v => v.toLocaleString(), sortDesc: true },
                    { key: 'leads', title: 'DB', getValue: c => c.leads, format: v => `${v.toLocaleString()}건`, sortDesc: true },
                    { key: 'revenue', title: '매출', getValue: c => c.revenue, format: v => formatCell(v, 'currency'), sortDesc: true },
                  ] as ChartDef[]).filter(chart => channelBreakdown.some(c => chart.getValue(c) > 0))
                : [
                    { key: 'spend', title: '광고비', getValue: c => c.spend, format: v => formatCell(v, 'currency'), sortDesc: true },
                    { key: 'primary', title: primaryLabel, getValue: c => c.primary, format: fmtPrimary, sortDesc: true },
                    { key: 'efficiency', title: effLabel, getValue: c => c.efficiency, format: fmtEff, sortDesc: isRevenue },
                  ];
            return (
              <section className="card channel-viz-card">
                <div className="daily-report-section-head"><div><h3>매체별 시각화 — {periodLabel ?? `${Number(month.split('-')[1])}월 전체`}</h3><p>이 기간 매체별 광고비, {primaryLabel}, {effLabel}을 여러 형태의 그래프로 비교합니다.</p></div></div>
                <div className="channel-shape-grid">
                  {([
                    { key: 'spend', title: '매체별 광고비 비중', centerLabel: '광고비', total: totalSpend, getValue: (c: typeof channelBreakdown[number]) => c.spend, format: (v: number) => formatCell(v, 'currency') },
                    { key: 'leads', title: '매체별 DB 비중', centerLabel: 'DB', total: channelBreakdown.reduce((s, c) => s + c.leads, 0), getValue: (c: typeof channelBreakdown[number]) => c.leads, format: (v: number) => `${v.toLocaleString()}건` },
                    { key: 'revenue', title: '매체별 매출 비중', centerLabel: '매출', total: channelBreakdown.reduce((s, c) => s + c.revenue, 0), getValue: (c: typeof channelBreakdown[number]) => c.revenue, format: (v: number) => formatCell(v, 'currency') },
                  ]).map(donut => {
                    const r = 46, circumference = 2 * Math.PI * r;
                    let cursor = 0;
                    return (
                      <div className="channel-mini-chart" key={donut.key}>
                        <h4>{donut.title}</h4>
                        <div className="donut-chart-wrap">
                          <svg viewBox="0 0 120 120" className="donut-svg">
                            <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16"/>
                            {channelBreakdown.map(c => {
                              const share = donut.total > 0 ? donut.getValue(c) / donut.total : 0;
                              const seg = (
                                <circle key={c.platform} cx="60" cy="60" r={r} fill="none" stroke={getPlatformColor(c.platform)} strokeWidth="16"
                                  strokeDasharray={`${share * circumference} ${circumference}`} strokeDashoffset={-cursor * circumference} transform="rotate(-90 60 60)"/>
                              );
                              cursor += share;
                              return seg;
                            })}
                          </svg>
                          <div className="donut-center"><b>{donut.format(donut.total)}</b><span>총 {donut.centerLabel}</span></div>
                        </div>
                        <div className="donut-legend">
                          {channelBreakdown.filter(c => donut.getValue(c) > 0).slice(0, 6).map(c => (
                            <span key={c.platform}><i style={{ background: getPlatformColor(c.platform) }}/>{c.platform} {donut.total > 0 ? ((donut.getValue(c) / donut.total) * 100).toFixed(0) : 0}%</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const totalAdvertiserSpend = advertiserSpendBreakdown.reduce((s, item) => s + item.spend, 0);
                    if (totalAdvertiserSpend <= 0) return null;
                    const r = 46, circumference = 2 * Math.PI * r;
                    let cursor = 0;
                    return (
                      <div className="channel-mini-chart">
                        <h4>광고주별 광고비 비율</h4>
                        <div className="donut-chart-wrap">
                          <svg viewBox="0 0 120 120" className="donut-svg">
                            <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16"/>
                            {advertiserSpendBreakdown.map((item, index) => {
                              const share = item.spend / totalAdvertiserSpend;
                              const seg = (
                                <circle key={item.platform} cx="60" cy="60" r={r} fill="none" stroke={`hsl(${(index * 137.5) % 360},68%,52%)`} strokeWidth="16"
                                  strokeDasharray={`${share * circumference} ${circumference}`} strokeDashoffset={-cursor * circumference} transform="rotate(-90 60 60)"/>
                              );
                              cursor += share;
                              return seg;
                            })}
                          </svg>
                          <div className="donut-center"><b>{formatCell(totalAdvertiserSpend, 'currency')}</b><span>전체 광고비</span></div>
                        </div>
                        <div className="donut-legend">
                          {advertiserSpendBreakdown.slice(0, 6).map((item, index) => (
                            <span key={item.platform}><i style={{ background: `hsl(${(index * 137.5) % 360},68%,52%)` }}/>{item.platform} {((item.spend / totalAdvertiserSpend) * 100).toFixed(0)}%</span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="channel-chart-grid">
                  {charts.map(chart => {
                    const sorted = [...channelBreakdown].sort((a, b) => chart.sortDesc ? chart.getValue(b) - chart.getValue(a) : chart.getValue(a) - chart.getValue(b));
                    const maxVal = Math.max(...sorted.map(c => Math.abs(chart.getValue(c))), 1);
                    return (
                      <div className="channel-mini-chart" key={chart.key}>
                        <h4>{chart.title}</h4>
                        <div className="channel-bar-chart">
                          {sorted.map(c => {
                            const value = chart.getValue(c);
                            return (
                              <div className="channel-bar-row" key={c.platform}>
                                <span className="channel-bar-label">{c.platform}</span>
                                <div className="channel-bar-track"><div className="channel-bar-fill" style={{ width: `${Math.max(2, (Math.abs(value) / maxVal) * 100)}%`, background: getPlatformColor(c.platform) }} /></div>
                                <span className="channel-bar-value">{chart.format(value)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="table-scroll">
                  <table className="data-table channel-summary-table">
                    <thead><tr><th>매체</th><th className="num">광고비</th><th className="num">비중</th><th className="num">{primaryLabel}</th><th className="num">{effLabel}</th></tr></thead>
                    <tbody>
                      {channelBreakdown.map((c) => (
                        <tr key={c.platform}>
                          <td><span className="channel-dot" style={{ background: getPlatformColor(c.platform) }} />{c.platform}</td>
                          <td className="num">{formatCell(c.spend, 'currency')}</td>
                          <td className="num">{totalSpend > 0 ? `${((c.spend / totalSpend) * 100).toFixed(1)}%` : '-'}</td>
                          <td className="num">{fmtPrimary(c.primary)}</td>
                          <td className="num">{fmtEff(c.efficiency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })()}

          {(() => {
            const indexes = visibleDayIndexes ?? allMonthDays.map((_, i) => i);
            const dates = indexes.map(i => `${allMonthDays[i]?.day ?? i + 1}일`);
            const spendData = buildDailyTrendData(rows, indexes, [{ metric: 'spend', name: '광고비', color: '#2563eb', type: 'bar', format: 'currency' }], chartPlatform)[0]?.data ?? [];
            const totalSpend = spendData.reduce((s, v) => s + v, 0);
            const isRevenue = profile.reportType === 'revenue';
            const isReach = profile.reportType === 'reach';
            const isClick = profile.reportType === 'click';
            const isIntegrated = profile.reportType === 'integrated';

            return (
              <>
                <section className="chart-card">
                  <div className="daily-report-section-head"><div><h3>일자별 성과 추이</h3><p>날짜별 광고비와 핵심 지표를 막대+꺾은선 복합 차트로 비교합니다. 범례를 눌러 시리즈를 껐다 켤 수 있고, 하단 슬라이더로 구간을 좁혀 볼 수 있습니다.</p></div></div>
                  <div className="chart-section-toolbar">
                    <span style={{fontSize:12,fontWeight:700,color:'#64748b',marginRight:4}}>매체</span>
                    {['전체', ...profile.platforms].map(p => (
                      <button key={p} className={chartPlatform===p?'active':''} onClick={()=>setChartPlatform(p)}>{p}</button>
                    ))}
                  </div>
                  {isIntegrated ? (
                    <>
                      <TrendComboChart title="광고비 · 매출 추이" dates={dates} summary={[{ label: '기간 총 광고비', value: `₩${totalSpend.toLocaleString()}` }]} series={buildDailyTrendData(rows, indexes, [
                        { metric: 'spend', name: '광고비', color: '#2563eb', type: 'bar', format: 'currency' },
                        { metric: 'revenue', name: '매출', color: '#16a34a', type: 'line', format: 'currency' },
                      ], chartPlatform)} />
                      <TrendComboChart title="노출 · 도달 추이" dates={dates} series={buildDailyTrendData(rows, indexes, [
                        { metric: 'impressions', name: '노출수', color: '#f59e0b', type: 'bar', format: 'number' },
                        { metric: 'reach', name: '도달', color: '#0891b2', type: 'line', format: 'number' },
                      ], chartPlatform)} />
                      <TrendComboChart title="클릭 · DB 추이" dates={dates} series={buildDailyTrendData(rows, indexes, [
                        { metric: 'clicks', name: '클릭수', color: '#db2777', type: 'bar', format: 'number' },
                        { metric: 'leads', name: 'DB', color: '#16a34a', type: 'line', format: 'number' },
                      ], chartPlatform)} />
                      <TrendComboChart title="CTR CVR 추이" dates={dates} series={buildDailyTrendData(rows, indexes, [
                        { metric: 'ctr', name: 'CTR', color: '#7c3aed', type: 'bar', format: 'percent' },
                        { metric: 'conversionRate', name: 'CVR', color: '#0d9488', type: 'line', format: 'percent' },
                      ], chartPlatform)} />
                      <TrendComboChart title="CPC CPA 추이" dates={dates} series={buildDailyTrendData(rows, indexes, [
                        { metric: 'cpc', name: 'CPC', color: '#f97316', type: 'bar', format: 'currency' },
                        { metric: 'cpa', name: 'CPA', color: '#dc2626', type: 'line', format: 'currency' },
                      ], chartPlatform)} />
                      <TrendComboChart title="매출 · ROAS 추이" dates={dates} series={buildDailyTrendData(rows, indexes, [
                        { metric: 'revenue', name: '매출', color: '#16a34a', type: 'bar', format: 'currency' },
                        { metric: 'roas', name: 'ROAS', color: '#f59e0b', type: 'line', format: 'percent', yAxisIndex: 1 },
                      ], chartPlatform)} />
                      <TrendComboChart title="결제 · 환불 · 순매출 추이" dates={dates} series={buildDailyTrendData(rows, indexes, [
                        { metric: 'payments', name: '결제', color: '#0891b2', type: 'bar', format: 'currency' },
                        { metric: 'refunds', name: '환불', color: '#dc2626', type: 'line', format: 'currency' },
                        { metric: 'netRevenue', name: '순매출', color: '#16a34a', type: 'line', format: 'currency' },
                      ], chartPlatform)} />
                    </>
                  ) : (
                    <>
                      <TrendComboChart
                        title={isRevenue ? '광고비 · 매출 추이' : isReach ? '광고비 · 노출수 추이' : isClick ? '광고비 · 클릭수 추이' : '광고비 · DB 추이'}
                        dates={dates}
                        summary={[{ label: '기간 총 광고비', value: `₩${totalSpend.toLocaleString()}` }]}
                        series={buildDailyTrendData(rows, indexes, isRevenue ? [
                          { metric: 'spend', name: '광고비', color: '#2563eb', type: 'bar', format: 'currency' },
                          { metric: 'revenue', name: '매출', color: '#16a34a', type: 'line', format: 'currency' },
                        ] : isReach ? [
                          { metric: 'spend', name: '광고비', color: '#2563eb', type: 'bar', format: 'currency' },
                          { metric: 'impressions', name: '노출수', color: '#f59e0b', type: 'line', format: 'number', yAxisIndex: 1 },
                        ] : isClick ? [
                          { metric: 'spend', name: '광고비', color: '#2563eb', type: 'bar', format: 'currency' },
                          { metric: 'clicks', name: '클릭수', color: '#db2777', type: 'line', format: 'number', yAxisIndex: 1 },
                        ] : [
                          { metric: 'spend', name: '광고비', color: '#2563eb', type: 'bar', format: 'currency' },
                          { metric: 'leads', name: 'DB', color: '#16a34a', type: 'line', format: 'number', yAxisIndex: 1 },
                        ], chartPlatform)}
                      />
                      {isRevenue && <TrendComboChart title="매출 · ROAS 추이" dates={dates} series={buildDailyTrendData(rows, indexes, [
                        { metric: 'revenue', name: '매출', color: '#16a34a', type: 'bar', format: 'currency' },
                        { metric: 'roas', name: 'ROAS', color: '#f59e0b', type: 'line', format: 'percent', yAxisIndex: 1 },
                      ], chartPlatform)} />}
                      {isRevenue && <TrendComboChart title="결제 · 환불 추이" dates={dates} series={buildDailyTrendData(rows, indexes, [
                        { metric: 'payments', name: '결제', color: '#0891b2', type: 'bar', format: 'currency' },
                        { metric: 'refunds', name: '환불', color: '#dc2626', type: 'line', format: 'currency' },
                      ], chartPlatform)} />}
                      {!isRevenue && <TrendComboChart title="클릭 · 전환 추이" dates={dates} series={buildDailyTrendData(rows, indexes, [
                        { metric: 'clicks', name: '클릭수', color: '#db2777', type: 'bar', format: 'number' },
                        { metric: 'leads', name: 'DB', color: '#16a34a', type: 'line', format: 'number' },
                      ], chartPlatform)} />}
                    </>
                  )}
                </section>
              </>
            );
          })()}

          <section className="card report-insight-card">
            <div className="daily-report-section-head"><div><h3>분석 · 문제점 · 대응방안</h3><p>이 기간 실제 데이터를 기준으로 자동 생성된 인사이트입니다. 참고용이며 최종 판단은 담당자가 확인해 주세요.</p></div></div>


            <div className="report-insight-grid">
              <div className="report-insight-col analysis"><h4>📊 분석</h4>{reportInsights.analysis.map((t, i) => <p key={i}>{t}</p>)}</div>
              <div className="report-insight-col problems"><h4>⚠️ 문제점</h4>{reportInsights.problems.length ? reportInsights.problems.map((t, i) => <p key={i}>{t}</p>) : <p className="muted">특별한 문제점이 감지되지 않았습니다.</p>}</div>
              <div className="report-insight-col actions"><h4>💡 대응방안</h4>{reportInsights.actions.map((t, i) => <p key={i}>{t}</p>)}</div>
            </div>
          </section>
          <section className="report-thank-you-page" aria-label="보고서 마지막 페이지"><strong>감사합니다.</strong></section>
        </section>
      )}

      {tab === 'media' && <div className="daily-report-media-tab-shell"><MediaPerformancePage embedded defaultAdvertiser={advertiserName} /></div>}

      {tab === 'data' && (
        <div className="data-method-picker">
          <div className="data-step-heading"><h3>데이터 입력/수집</h3><p>세 가지 방법 중 하나를 골라 진행하세요. 나중에 언제든 다른 방법으로 바꿀 수 있습니다.</p></div>
          <div className="data-method-cards">
            <button type="button" className="data-method-card" onClick={()=>setTab('api')}>
              <RefreshCw size={22}/><b>1. API로 자동 입력</b><span>연결된 매체에서 실제 원본 데이터를 자동으로 가져옵니다. API가 연결되지 않은 경우 임의 데이터를 채우지 않습니다.</span>
            </button>
            <button type="button" className="data-method-card" onClick={()=>setTab('input')}>
              <Settings2 size={22}/><b>2. 표에 직접 입력</b><span>표의 각 셀에 숫자를 직접 입력하거나 수정합니다. 파생 지표는 자동으로 다시 계산됩니다.</span>
            </button>
            <button type="button" className="data-method-card" onClick={()=>setTab('upload')}>
              <Upload size={22}/><b>3. CSV/엑셀 업로드</b><span>매체에서 내려받은 CSV·엑셀 파일이나, 이 앱에서 내려받았던 파일을 그대로 올립니다.</span>
            </button>
          </div>
        </div>
      )}
      {(tab === 'api' || tab === 'input' || tab === 'upload') && (
        <button type="button" className="data-method-back" onClick={()=>setTab('data')}>← 다른 입력 방법 선택</button>
      )}

      {tab === 'api' && (
        <section className="card daily-report-upload-card daily-report-api-card">
          <div className="daily-report-section-head">
            <div>
              <h3>매체 API 자동수집</h3>
              <p>Meta, 네이버, Google Ads, 카카오, 당근, 틱톡 등 연결된 매체에서 일일 원본 데이터를 가져오고 CPA, CPC, CTR, 전환률, ROAS를 자동 계산합니다.</p>
            </div>
            <button className="btn primary" onClick={syncApiData} disabled={syncingApi}><RefreshCw size={15} className={syncingApi ? 'is-spinning' : ''}/>{syncingApi ? '수집 중' : '데이터 수집 실행'}</button>
          </div>
          <div className="api-sync-platform-grid">
            {profile.platforms.map(platform => (
              <div key={platform} className="api-sync-platform-card">
                <b>{platform}</b>
                <span>{syncingApi ? '수집 대기' : apiSourceLabel.includes('완료') ? 'API 수집 완료' : '연결 대기'}</span>
                <small>원본 지표: {profile.metrics.filter(metric => metric !== 'frequency').map(metric => getMetricLabel(metric)).join(', ')}</small>
              </div>
            ))}
          </div>
          <div className="api-sync-note">
            연결된 실제 광고 API가 없습니다. Meta, 네이버, Google Ads, 카카오, 당근, 틱톡 API를 연결하면 실데이터 수집이 시작됩니다.
          </div>
        </section>
      )}

      {tab === 'input' && (
        <section className="card daily-report-grid-card">
          <div className="daily-report-section-head"><div><h3>직접 입력</h3><p>자동계산 행과 합계 행을 제외한 원본 데이터 셀을 수정하거나, 행을 직접 추가·삭제할 수 있습니다.</p></div></div>
          <div className="custom-row-form">
            <input placeholder="새 매체/항목 이름 (예: 오늘의집)" value={newRowLabel} onChange={e=>setNewRowLabel(e.target.value)}/>
            <select value={newRowFormat} onChange={e=>setNewRowFormat(e.target.value as CellFormat)}>
              <option value="currency">금액(₩)</option>
              <option value="number">숫자</option>
              <option value="percent">퍼센트(%)</option>
            </select>
            <button className="btn secondary" onClick={()=>{
              if(!newRowLabel.trim()){setNotice('추가할 항목 이름을 입력하세요.');setTimeout(()=>setNotice(''),2000);return;}
              markManualEdit();
              const days=getMonthDays(month);
              const newRow:ReportRow={id:`custom-${Date.now()}`,group:'직접 추가한 항목',label:newRowLabel.trim(),metric:'spend',format:newRowFormat,values:days.map(()=>0),total:0};
              setRowsOverride(prev=>({...prev,[storageKey]:[...(prev[storageKey]??rows),newRow]}));
              updateProfileOnly({ customRows: [...(profile.customRows ?? []), newRow] });
              setNewRowLabel('');
              setNotice(`"${newRow.label}" 항목을 추가했습니다. 아래 표에서 바로 값을 입력할 수 있습니다.`);setTimeout(()=>setNotice(''),2800);
            }}><Plus size={14}/> 항목 추가</button>
          </div>
          <ReportGrid advertiserName={advertiserName} month={month} rows={displayRows} editable onCellChange={onCellChange} onDeleteRow={deleteReportRow} />
        </section>
      )}

      {tab === 'upload' && (
        <section className="card daily-report-upload-card">
          <h3>CSV 또는 엑셀 데이터 업로드</h3>
          <p>기본 형식은 <b>행 이름, TOTAL, 1일, 2일, 3일...</b> 입니다. CSV, TXT, XLSX 파일을 읽어 같은 표 엔진으로 미리보기를 생성합니다.</p>
          <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={(event) => handleFileUpload(event.target.files?.[0])} />
          <textarea value={uploadText} onChange={(event) => { setUploadText(event.target.value); setPendingExcelRows(null); }} placeholder="예시:&#10;메타 클릭수,22450,691,962,877&#10;네이버 클릭수,570,26,20,28" />
          <div className="action-row"><button className="btn primary" onClick={applyCsvUpload}><Upload size={15}/> 업로드 데이터 적용</button></div>
          <p className="footnote">광고주별로 쌓인 전체 업로드 이력은 <a href="/custom-data-upload">커스텀 데이터 업로드 이력</a>에서 확인할 수 있습니다.</p>
        </section>
      )}

      {tab === 'template' && (
        <section className="card daily-report-template-card">
          <div className="daily-report-section-head"><div><h3>보고서 양식 설정</h3><p>환경설정에서 등록한 매체와 지표 중 보고서에 표시할 항목만 선택한 뒤 양식을 저장합니다.</p></div><div className="inline-actions"><button className="btn secondary" onClick={() => changeReportType(profile.reportType)}><RefreshCw size={15}/> 추천 양식 적용</button><input className="template-name-input" value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="양식 이름 (예: 병원용, 원장님 보고용)" title="같은 이름으로 저장하면 그 양식이 갱신되고, 다른 이름이면 새 버전으로 추가됩니다."/><button className="btn primary" onClick={saveCurrentTemplate}><Save size={15}/> 양식 저장</button></div></div>
          <div className="template-simple-guide">
            <div><b>매체</b><span>보고서에 보여줄 광고 채널만 체크하세요.</span></div>
            <div><b>지표</b><span>필요한 데이터만 체크하세요. 기본 양식은 핵심 지표만 보여줍니다.</span></div>
            <div><b>저장</b><span>저장한 양식은 저장된 양식 탭에서 다시 불러올 수 있습니다.</span></div>
          </div>
          <div className="template-editor-grid">
            <div>
              <div className="template-section-head">
                <h4>매체 표시</h4>

              </div>
              <div className="daily-report-input-with-icon" style={{margin:'0 0 8px'}}>
                <Search size={14}/>
                <input value={platformSearch} onChange={e=>setPlatformSearch(e.target.value)} placeholder="매체 검색"/>
              </div>
              <div className="template-check-list">
                {checkboxPlatforms.filter(p => p.toLowerCase().includes(platformSearch.trim().toLowerCase())).map(platform => (
                  <label key={platform}><input type="checkbox" checked={profile.platforms.includes(platform)} onChange={(event) => {
                    const checked = event.target.checked;
                    updateProfile({ platforms: checked ? [...profile.platforms, platform] : profile.platforms.filter(item => item !== platform) });
                    if (checked && !availablePlatforms.includes(platform)) {
                      // 원본 데이터가 없는(환경설정에서 만든) 매체이므로, 빈 커스텀 행을 같이 만들어서 바로 값을 입력할 수 있게 합니다.
                      const days = getMonthDays(month);
                      const newRow: ReportRow = { id: `custom-${Date.now()}`, group: '직접 추가한 항목', platform, label: `${platform} 광고비`, metric: 'spend', format: 'currency', values: days.map(() => 0), total: 0 };
                      updateProfileOnly({ customRows: [...(profile.customRows ?? []), newRow] });
                    }
                  }}/>{platform}</label>
                ))}
                {checkboxPlatforms.filter(p => p.toLowerCase().includes(platformSearch.trim().toLowerCase())).length===0 && <p className="muted" style={{fontSize:12,padding:'6px 2px'}}>검색 결과가 없습니다.</p>}
              </div>
            </div>
            <div>
              <div className="template-section-head">
                <h4>지표 표시</h4>

              </div>
              <div className="daily-report-input-with-icon" style={{margin:'0 0 8px'}}>
                <Search size={14}/>
                <input value={metricSearch} onChange={e=>setMetricSearch(e.target.value)} placeholder="지표 검색"/>
              </div>
              <div className="template-check-list">
                {availableMetrics.filter(m => getMetricLabel(m).toLowerCase().includes(metricSearch.trim().toLowerCase())).map(metric => (
                  <label key={metric}><input type="checkbox" checked={profile.metrics.includes(metric)} onChange={(event) => updateProfile({ metrics: event.target.checked ? [...profile.metrics, metric] : profile.metrics.filter(item => item !== metric) })}/>{getMetricLabel(metric)}</label>
                ))}
                {availableMetrics.filter(m => getMetricLabel(m).toLowerCase().includes(metricSearch.trim().toLowerCase())).length===0 && <p className="muted" style={{fontSize:12,padding:'6px 2px'}}>검색 결과가 없습니다.</p>}
              </div>
              {customMetrics.length > 0 && (
                <div style={{marginTop:14}}>
                  <h4 style={{fontSize:12.5,color:'#64748b',margin:'0 0 8px'}}>커스텀 지표 (환경설정에서 등록)</h4>
                  <div className="template-check-list">
                    {customMetrics.map(metric => (
                      <label key={metric.id} title={metric.description || metric.formula}>
                        <input type="checkbox" checked={(profile.customMetricIds ?? []).includes(metric.id)} onChange={(event) => {
                          const current = profile.customMetricIds ?? [];
                          updateProfile({ customMetricIds: event.target.checked ? [...current, metric.id] : current.filter(id => id !== metric.id) });
                        }}/>{metric.name}<small style={{color:'#94a3b8',marginLeft:4}}>({metric.formula})</small>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === 'savedTemplates' && (
        <section className="card generated-report-card saved-template-card">
          <div className="daily-report-section-head">
            <div>
              <h3>저장된 양식</h3>
              <p>보고서 양식 탭에서 저장한 광고주별 매체·지표 구성입니다. 불러오면 해당 광고주의 기본 양식으로 적용됩니다.</p>
            </div>
            <div className="inline-actions">
              <button className="btn secondary" onClick={()=>setTab('template')}><LayoutTemplate size={14}/> 매체·지표부터 고르기</button>
              <input className="template-name-input" value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="양식 이름"/>
              <button className="btn primary" onClick={saveCurrentTemplate}><Save size={15}/> 현재 양식 저장</button>
            </div>
          </div>
          {visibleSavedTemplates.length === 0 ? <p className="muted">저장된 양식이 없습니다. 보고서 양식 탭에서 매체와 지표를 고른 뒤 양식 저장을 눌러 주세요.</p> : (
            <div className="generated-report-list">
              {visibleSavedTemplates.map(template => (
                <div key={template.id} className="generated-report-item">
                  <div><b>{template.name}</b><span>{REPORT_TYPE_LABEL[template.reportType]} · 매체 {template.profile.platforms.length}개 · 지표 {template.profile.metrics.length}개 · {new Date(template.createdAt).toLocaleString('ko-KR')}</span></div>
                  <div className="inline-actions">
                    <button className="btn secondary" onClick={() => openSavedTemplate(template)}><LayoutTemplate size={14}/> 불러오기</button>
                    <button className="icon-btn danger" onClick={() => deleteSavedTemplate(template.id)}><X size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'generated' && (
        <section className="card generated-report-card">
          <h3>생성된 보고서</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="이름, 광고주, 유형, 기간으로 검색"
              value={generatedSearch}
              onChange={e => setGeneratedSearch(e.target.value)}
              style={{ flex: '1 1 240px', minWidth: 200, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              {([['none', '전체'], ['advertiser', '광고주별'], ['type', '유형별'], ['period', '기간별']] as const).map(([key, label]) => (
                <button key={key} className={`btn sm ${generatedGroupBy === key ? 'primary' : 'secondary'}`} onClick={() => setGeneratedGroupBy(key)}>{label}</button>
              ))}
            </div>
            <select value={generatedSort} onChange={e => setGeneratedSort(e.target.value as typeof generatedSort)} style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5 }}>
              <option value="latest">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="name">이름순</option>
            </select>
          </div>
          {visibleGeneratedReports.length === 0 ? <p className="muted">선택한 광고주에 저장된 보고서가 없습니다.</p> : (
            <>
              {groupedGeneratedReports.map(group => generatedGroupBy === 'none' ? (
                <div key="all" className="generated-report-list">
                  {group.items.map(report => (
                    <div key={report.id} className="generated-report-item">
                      <div><b>{report.reportName || [report.advertiserName, report.periodLabel || `${report.month} 월간 보고서`].join(' ')}</b><span>{REPORT_TYPE_LABEL[report.reportType]} · {report.rowCount}개 행 · {report.source === 'api' ? 'API 수집본' : report.source === 'upload' ? '업로드본' : report.source === 'manual' ? '수정본' : report.source === 'sample' || report.isSample ? '테스트 샘플본' : '데모본'} · {formatDateForAdvertiser(report.createdAt, report.advertiserName)}</span></div>
                      <div className="inline-actions generated-export-actions">
                        <button className="btn secondary sm" onClick={() => openGeneratedReport(report)}><FileText size={13}/> 열기</button>
                        <button className="btn secondary sm" onClick={() => void exportGeneratedReport(report)}><Download size={13}/> PDF</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <details key={group.label} className="generated-folder">
                  <summary><span className="generated-folder-icon"><Folder size={18}/></span><strong>{group.label}</strong><span>{group.items.length}건</span></summary>
                  <div className="generated-folder-body generated-report-list">
                    {group.items.map(report => (
                      <div key={report.id} className="generated-report-item">
                        <div><b>{report.reportName || [report.advertiserName, report.periodLabel || `${report.month} 월간 보고서`].join(' ')}</b><span>{REPORT_TYPE_LABEL[report.reportType]} · {report.rowCount}개 행 · {report.source === 'api' ? 'API 수집본' : report.source === 'upload' ? '업로드본' : report.source === 'manual' ? '수정본' : report.source === 'sample' || report.isSample ? '테스트 샘플본' : '데모본'} · {formatDateForAdvertiser(report.createdAt, report.advertiserName)}</span></div>
                        <div className="inline-actions generated-export-actions">
                          <button className="btn secondary sm" onClick={() => openGeneratedReport(report)}><FileText size={13}/> 열기</button>
                          <button className="btn secondary sm" onClick={() => void exportGeneratedReport(report)}><Download size={13}/> PDF</button>
                            </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}
