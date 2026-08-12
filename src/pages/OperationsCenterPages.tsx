import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Search, Plus, Download, Save, Upload, Link2, CheckCircle2, Clock3, AlertTriangle, Play, Pause, CalendarDays, Send, Trash2, PencilLine, X, FileText, Eye, Copy, BarChart3, ExternalLink, RotateCcw } from 'lucide-react';
import { METRIC_FORMULA_EVENT, loadMetricFormulas, type MetricFormula } from '../data/metricFormulas';
import { loadReportIntegrationSettings, REPORT_INTEGRATION_EVENT, type ReportIntegrationSettings } from '../data/reportIntegrations';
import { buildDailyReportDocument, downloadReportCsv, downloadReportXlsx, openReportPdfPrint, syncReportToGoogleSheets, syncReportToNotion, type DailyReportDocument } from '../utils/reportExports';
import { DateRangePicker, type DateRange } from '../components/DateRangePicker';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter, filterByAdvertiser } from '../utils/advertiserMatch';

const advertisers:string[] = [];

function AdvertiserToolbar({value,onChange}:{value:string;onChange:(v:string)=>void}){
  return <div className="ops-toolbar"><div className="ops-search"><Search size={17}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder="광고주 이름으로 검색"/></div><select><option>전체 매체</option><option>Meta</option><option>네이버</option><option>Google</option></select><button className="btn secondary"><Download size={15}/> 내보내기</button></div>
}

function Stat({label,value,sub}:{label:string;value:string;sub?:string}){return <div className="ops-stat"><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>}

type KpiRangeKey = 'today' | 'yesterday' | '7d' | '14d' | '30d' | '60d' | '90d';
type KpiGoalType = 'CPA' | 'ROAS';

type KpiDailyRow = {
  date: string;
  spend: number;
  conversions?: number;
  sales?: number;
};

type KpiBrandConfig = {
  id: string;
  name: string;
  color: string;
  goalType: KpiGoalType;
  goalLabel: string;
  goalTarget: number;
  monthlyTargetLabel: string;
  monthlyTargetValue: number;
  monthlyCurrentValue: number;
  periodPrimaryLabel: string;
  dailyAverageLabel: string;
  rows: KpiDailyRow[];
};

const KPI_RANGE_OPTIONS: { key: KpiRangeKey; label: string; limit: number; offset?: number }[] = [
  { key: 'today', label: '오늘', limit: 1 },
  { key: 'yesterday', label: '어제', limit: 1, offset: 1 },
  { key: '7d', label: '7일', limit: 7 },
  { key: '14d', label: '14일', limit: 14 },
  { key: '30d', label: '30일', limit: 30 },
  { key: '60d', label: '60일', limit: 60 },
  { key: '90d', label: '90일', limit: 90 },
];

const initialKpiBrands: KpiBrandConfig[] = [];

function formatWon(value: number) {
  return `₩${Math.round(value).toLocaleString()}`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getRowsForRange(rows: KpiDailyRow[], range: KpiRangeKey) {
  const option = KPI_RANGE_OPTIONS.find((item) => item.key === range) ?? KPI_RANGE_OPTIONS[2];
  const start = option.offset ?? 0;
  return rows.slice(start, start + option.limit);
}

function computeKpiSummary(config: KpiBrandConfig, range: KpiRangeKey) {
  const visibleRows = getRowsForRange(config.rows, range);
  const spend = visibleRows.reduce((acc, row) => acc + row.spend, 0);
  const totalConversions = visibleRows.reduce((acc, row) => acc + (row.conversions ?? 0), 0);
  const totalSales = visibleRows.reduce((acc, row) => acc + (row.sales ?? 0), 0);
  const dayCount = visibleRows.length || 1;

  if (config.goalType === 'CPA') {
    const actualMetric = totalConversions > 0 ? spend / totalConversions : 0;
    const attainment = actualMetric > 0 ? (config.goalTarget / actualMetric) * 100 : 0;
    return {
      rows: visibleRows,
      spend,
      primaryValue: totalConversions,
      actualMetric,
      attainment,
      dailyAverage: totalConversions / dayCount,
      monthlyProgress: config.monthlyTargetValue > 0 ? (config.monthlyCurrentValue / config.monthlyTargetValue) * 100 : 0,
      status: actualMetric > 0 && attainment >= 100 ? '목표 달성' : '추가 개선 필요',
    };
  }

  const actualMetric = spend > 0 ? (totalSales / spend) * 100 : 0;
  const attainment = config.goalTarget > 0 ? (actualMetric / config.goalTarget) * 100 : 0;
  return {
    rows: visibleRows,
    spend,
    primaryValue: totalSales,
    actualMetric,
    attainment,
    dailyAverage: totalSales / dayCount,
    monthlyProgress: config.monthlyTargetValue > 0 ? (config.monthlyCurrentValue / config.monthlyTargetValue) * 100 : 0,
    status: actualMetric >= config.goalTarget ? '목표 달성' : '추가 개선 필요',
  };
}

const KPI_BRANDS_STORAGE_KEY = 'adcc-kpi-brands-v1';
function loadKpiBrands(): KpiBrandConfig[] {
  try {
    const raw = localStorage.getItem(KPI_BRANDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveKpiBrands(brands: KpiBrandConfig[]) {
  try { localStorage.setItem(KPI_BRANDS_STORAGE_KEY, JSON.stringify(brands)); } catch { /* ignore */ }
}

function GoalEditModal({
  brand,
  onClose,
  onSave,
  onDelete,
}: {
  brand: KpiBrandConfig;
  onClose: () => void;
  onSave: (patch: Partial<KpiBrandConfig>) => void;
  onDelete: () => void;
}) {
  const [goalTarget, setGoalTarget] = useState(String(brand.goalTarget));
  const [monthlyTargetValue, setMonthlyTargetValue] = useState(String(brand.monthlyTargetValue));
  const [monthlyCurrentValue, setMonthlyCurrentValue] = useState(String(brand.monthlyCurrentValue));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card kpi-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{brand.name} 목표 수정</h3>
            <p>{brand.goalLabel} 기준을 수정하면 카드와 일별 달성률이 즉시 반영됩니다.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="form-grid">
          <label className="field-label">
            목표 유형
            <input value={brand.goalType} readOnly />
          </label>
          <label className="field-label">
            {brand.goalType === 'CPA' ? '목표 CPA (원)' : '목표 ROAS (%)'}
            <input value={goalTarget} onChange={(e) => setGoalTarget(e.target.value.replace(/[^0-9]/g, ''))} />
          </label>
          <label className="field-label">
            {brand.goalType === 'CPA' ? '월 목표 전환/예약 수' : '월 목표 매출 (원)'}
            <input value={monthlyTargetValue} onChange={(e) => setMonthlyTargetValue(e.target.value.replace(/[^0-9]/g, ''))} />
          </label>
          <label className="field-label">
            {brand.goalType === 'CPA' ? '이번 달 누적 전환/예약 수' : '이번 달 누적 매출 (원)'}
            <input value={monthlyCurrentValue} onChange={(e) => setMonthlyCurrentValue(e.target.value.replace(/[^0-9]/g, ''))} />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn danger" onClick={() => { if (window.confirm(`"${brand.name}"의 KPI 목표를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) onDelete(); }}><Trash2 size={15} /> 삭제</button>
          <button className="btn secondary" onClick={onClose}>취소</button>
          <button
            className="btn primary"
            onClick={() => {
              onSave({
                goalTarget: Number(goalTarget) || brand.goalTarget,
                monthlyTargetValue: Number(monthlyTargetValue) || brand.monthlyTargetValue,
                monthlyCurrentValue: Number(monthlyCurrentValue) || brand.monthlyCurrentValue,
              });
              onClose();
            }}
          >
            <Save size={15} /> 저장
          </button>
        </div>
      </div>
    </div>
  );
}

const KPI_GOAL_COLORS = ['#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f43f5e','#6366f1'];

function NewGoalModal({ onClose, onCreate, existingCount }: { onClose: () => void; onCreate: (brand: KpiBrandConfig) => void; existingCount: number }) {
  const [name, setName] = useState('');
  const [goalType, setGoalType] = useState<KpiGoalType>('CPA');
  const [goalTarget, setGoalTarget] = useState('');
  const [monthlyTargetValue, setMonthlyTargetValue] = useState('');
  const [monthlyCurrentValue, setMonthlyCurrentValue] = useState('0');

  const create = () => {
    if (!name.trim()) return;
    const color = KPI_GOAL_COLORS[existingCount % KPI_GOAL_COLORS.length];
    const brand: KpiBrandConfig = {
      id: `kpi-${Date.now()}`,
      name: name.trim(),
      color,
      goalType,
      goalLabel: goalType === 'CPA' ? '잠재고객 확보 (CPA)' : '매출성장 (ROAS)',
      goalTarget: Number(goalTarget) || (goalType === 'CPA' ? 20000 : 300),
      monthlyTargetLabel: goalType === 'CPA' ? '월 목표 전환률 (이번 달 누적)' : '월 목표 매출 (이번 달 누적)',
      monthlyTargetValue: Number(monthlyTargetValue) || 0,
      monthlyCurrentValue: Number(monthlyCurrentValue) || 0,
      periodPrimaryLabel: goalType === 'CPA' ? '기간 전환/예약' : '기간 매출',
      dailyAverageLabel: goalType === 'CPA' ? '일 평균 건수' : '일 평균 매출',
      rows: [],
    };
    onCreate(brand);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card kpi-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>새 KPI 목표 추가</h3>
            <p>광고주와 목표 유형을 고르고 목표값을 입력하세요. 일별 데이터는 이후 보고서 관리에서 쌓입니다.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기"><X size={18} /></button>
        </div>
        <div className="form-grid">
          <label className="field-label">광고주명<input value={name} onChange={(e) => setName(e.target.value)} placeholder="광고주명 입력" autoFocus/></label>
          <label className="field-label">목표 유형
            <select value={goalType} onChange={(e) => setGoalType(e.target.value as KpiGoalType)}>
              <option value="CPA">잠재고객 확보 (CPA)</option>
              <option value="ROAS">매출성장 (ROAS)</option>
            </select>
          </label>
          <label className="field-label">{goalType === 'CPA' ? '목표 CPA (원)' : '목표 ROAS (%)'}<input value={goalTarget} onChange={(e) => setGoalTarget(e.target.value.replace(/[^0-9]/g, ''))} placeholder={goalType === 'CPA' ? '예: 18000' : '예: 400'}/></label>
          <label className="field-label">{goalType === 'CPA' ? '월 목표 전환/예약 수' : '월 목표 매출 (원)'}<input value={monthlyTargetValue} onChange={(e) => setMonthlyTargetValue(e.target.value.replace(/[^0-9]/g, ''))}/></label>
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose}>취소</button>
          <button className="btn primary" onClick={create} disabled={!name.trim()}><Plus size={15} /> 추가</button>
        </div>
      </div>
    </div>
  );
}

function KpiBrandSection({
  brand,
  range,
  onEdit,
}: {
  brand: KpiBrandConfig;
  range: KpiRangeKey;
  onEdit: () => void;
}) {
  const summary = useMemo(() => computeKpiSummary(brand, range), [brand, range]);
  type DailySortKey='date'|'spend'|'primary'|'metric'|'attainment';
  const [sortKey,setSortKey]=useState<DailySortKey>('date');
  const [sortDir,setSortDir]=useState<'asc'|'desc'>('asc');
  const toggleSort=(key:DailySortKey)=>{if(sortKey===key)setSortDir(sortDir==='asc'?'desc':'asc');else{setSortKey(key);setSortDir('asc')}};
  const sortArrow=(key:DailySortKey)=>sortKey===key?(sortDir==='asc'?' ▲':' ▼'):'';
  const sortedRows = useMemo(() => [...summary.rows].sort((a, b) => {
    const valueOf = (row: typeof a) => {
      if (sortKey === 'date') return row.date;
      if (sortKey === 'spend') return row.spend;
      const primary = brand.goalType === 'CPA' ? row.conversions ?? 0 : row.sales ?? 0;
      if (sortKey === 'primary') return primary;
      const metric = brand.goalType === 'CPA' ? (primary > 0 ? row.spend / primary : 0) : (row.spend > 0 ? (primary / row.spend) * 100 : 0);
      if (sortKey === 'metric') return metric;
      return brand.goalType === 'CPA' ? (metric > 0 ? (brand.goalTarget / metric) * 100 : 0) : (brand.goalTarget > 0 ? (metric / brand.goalTarget) * 100 : 0);
    };
    const av = valueOf(a), bv = valueOf(b);
    if (typeof av === 'string' || typeof bv === 'string') return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  }), [summary.rows, sortKey, sortDir, brand.goalType, brand.goalTarget]);
  const metricLabel = brand.goalType === 'CPA' ? 'CPA 달성률 (낮을수록 좋음)' : '평균 ROAS 달성률';
  const actualMetricLabel = brand.goalType === 'CPA' ? '평균 CPA' : '평균 ROAS';
  const monthlyProgressLabel = brand.monthlyTargetLabel;
  const periodPrimaryValue = brand.goalType === 'CPA' ? `${summary.primaryValue}건` : formatWon(summary.primaryValue);
  const dailyAverageValue = brand.goalType === 'CPA' ? `${summary.dailyAverage.toFixed(1)}건` : formatWon(summary.dailyAverage);
  const actualMetricValue = brand.goalType === 'CPA' ? formatWon(summary.actualMetric) : formatPercent(summary.actualMetric);
  const goalTargetValue = brand.goalType === 'CPA' ? formatWon(brand.goalTarget) : formatPercent(brand.goalTarget);
  const monthlyCurrentValue = brand.goalType === 'CPA' ? `${Math.round(brand.monthlyCurrentValue)}건` : formatWon(brand.monthlyCurrentValue);
  const monthlyTargetValue = brand.goalType === 'CPA' ? `${Math.round(brand.monthlyTargetValue)}건` : formatWon(brand.monthlyTargetValue);

  return (
    <section className="card ops-card kpi-section-card">
      <div className="kpi-section-head">
        <div className="kpi-brand-title">
          <span className="kpi-brand-dot" style={{ background: brand.color }} />
          <b>{brand.name}</b>
          <span className="status-pill warning">{brand.goalLabel}</span>
        </div>
        <button className="btn secondary" onClick={onEdit}>
          <PencilLine size={15} /> 목표 수정
        </button>
      </div>

      <div className="kpi-summary-grid">
        <div className="kpi-highlight-card">
          <span>{metricLabel}</span>
          <strong className={summary.attainment >= 100 ? 'positive' : summary.attainment >= 80 ? 'warning-text' : 'negative'}>{formatPercent(summary.attainment)}</strong>
          <div className="kpi-progress-track">
            <div className="kpi-progress-fill positive" style={{ width: `${clampProgress(summary.attainment)}%` }} />
          </div>
          <small>{actualMetricLabel} {actualMetricValue} / 목표 {goalTargetValue}</small>
        </div>

        <div className="kpi-highlight-card">
          <span>{monthlyProgressLabel}</span>
          <strong className={summary.monthlyProgress >= 100 ? 'positive' : 'negative'}>{formatPercent(summary.monthlyProgress)}</strong>
          <div className="kpi-progress-track">
            <div className="kpi-progress-fill negative" style={{ width: `${clampProgress(summary.monthlyProgress)}%` }} />
          </div>
          <small>{monthlyCurrentValue} / {monthlyTargetValue}</small>
        </div>

        <div className="kpi-mini-grid">
          <div className="kpi-mini-card">
            <span>기간 광고비</span>
            <strong>{formatWon(summary.spend)}</strong>
          </div>
          <div className="kpi-mini-card">
            <span>{brand.periodPrimaryLabel}</span>
            <strong>{periodPrimaryValue}</strong>
          </div>
          <div className="kpi-mini-card">
            <span>{brand.dailyAverageLabel}</span>
            <strong>{dailyAverageValue}</strong>
          </div>
          <div className="kpi-mini-card">
            <span>상태</span>
            <strong className="kpi-status"><CheckCircle2 size={15} /> {summary.status}</strong>
          </div>
        </div>
      </div>

      <div className="table-scroll">
        <table className="ops-table kpi-daily-table">
          <thead>
            <tr>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('date')}>날짜{sortArrow('date')}</th>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('spend')}>광고비{sortArrow('spend')}</th>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('primary')}>{brand.goalType === 'CPA' ? '전환/예약' : '매출'}{sortArrow('primary')}</th>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('metric')}>{brand.goalType === 'CPA' ? 'CPA' : 'ROAS'}{sortArrow('metric')}</th>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('attainment')}>일 달성률{sortArrow('attainment')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const primary = brand.goalType === 'CPA' ? row.conversions ?? 0 : row.sales ?? 0;
              const metric = brand.goalType === 'CPA'
                ? primary > 0
                  ? row.spend / primary
                  : 0
                : row.spend > 0
                  ? (primary / row.spend) * 100
                  : 0;
              const attainment = brand.goalType === 'CPA'
                ? metric > 0
                  ? (brand.goalTarget / metric) * 100
                  : 0
                : brand.goalTarget > 0
                  ? (metric / brand.goalTarget) * 100
                  : 0;
              const toneClass = attainment >= 100 ? 'positive' : attainment >= 70 ? 'warning-bar' : 'negative';
              return (
                <tr key={`${brand.id}-${row.date}`}>
                  <td>{row.date}</td>
                  <td>{formatWon(row.spend)}</td>
                  <td>{brand.goalType === 'CPA' ? `${primary}건` : formatWon(primary)}</td>
                  <td>{brand.goalType === 'CPA' ? (primary > 0 ? formatWon(metric) : '-') : (row.spend > 0 ? formatPercent(metric) : '0%')}</td>
                  <td>
                    <div className="kpi-attainment-cell">
                      <div className="kpi-progress-track compact">
                        <div className={`kpi-progress-fill ${toneClass}`} style={{ width: `${clampProgress(attainment)}%` }} />
                      </div>
                      <b className={toneClass}>{formatPercent(attainment)}</b>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function KpiGoalsPage(){
 const [range,setRange]=useState<KpiRangeKey>('7d');
 const [brands,setBrands]=useState<KpiBrandConfig[]>(() => loadKpiBrands());
 const { filterValue } = useAdvertiserFilter();
 const visibleBrandsRaw = filterByAdvertiser(brands, filterValue, b => b.name);
 type SortKey='name'|'achievement'|'target';
 const [sortKey,setSortKey]=useState<SortKey>('name');
 const [sortDir,setSortDir]=useState<'asc'|'desc'>('asc');
 // 달성률(%) 범위 필터: 예를 들어 "80~100"으로 두면 목표에 근접했거나 달성한 광고주만 봅니다.
 const [achievementMin,setAchievementMin]=useState('');
 const [achievementMax,setAchievementMax]=useState('');
 const achievementOf=(brand:KpiBrandConfig)=>brand.monthlyTargetValue?(brand.monthlyCurrentValue/brand.monthlyTargetValue)*100:0;
 const visibleBrandsFiltered=(achievementMin||achievementMax)
   ? visibleBrandsRaw.filter(b=>{const v=achievementOf(b);const min=achievementMin?Number(achievementMin):-Infinity;const max=achievementMax?Number(achievementMax):Infinity;return v>=min&&v<=max;})
   : visibleBrandsRaw;
 const visibleBrands=[...visibleBrandsFiltered].sort((a,b)=>{
   const valueOf=(brand:typeof a)=>{
     if(sortKey==='name') return brand.name;
     if(sortKey==='target') return brand.monthlyTargetValue ?? 0;
     // achievement: 월간 목표 대비 실적 비율을 대표값으로 사용합니다.
     if(!brand.monthlyTargetValue) return 0;
     return brand.monthlyCurrentValue/brand.monthlyTargetValue;
   };
   const av=valueOf(a), bv=valueOf(b);
   if(typeof av==='string'||typeof bv==='string') return sortDir==='asc'?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));
   return sortDir==='asc'?(av as number)-(bv as number):(bv as number)-(av as number);
 });
 const [groupBy,setGroupBy]=useState<'none'|'kpi'>('none');
 const groupedBrands = useMemo(() => {
   if (groupBy === 'none') return null;
   const map = new Map<string, KpiBrandConfig[]>();
   visibleBrands.forEach(brand => {
     const key = brand.goalLabel;
     if (!map.has(key)) map.set(key, []);
     map.get(key)!.push(brand);
   });
   return Array.from(map.entries());
 }, [visibleBrands, groupBy]);
 const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
 const toggleFolder = (key: string) => setOpenFolders(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });

 const [editingId,setEditingId]=useState<string | null>(null);
 const [addingGoal,setAddingGoal]=useState(false);
 const [savedToast,setSavedToast]=useState('');
 const editingBrand = brands.find((brand)=>brand.id===editingId) ?? null;
 const updateBrands = (next: KpiBrandConfig[]) => { setBrands(next); saveKpiBrands(next); };

 return <>
   <PageHeader title="KPI 목표 달성" description="브랜드별 목표(매출성장 ROAS / 잠재고객 CPA)를 설정하고 일별 달성률을 추적합니다." action={<div style={{display:'flex',alignItems:'center',gap:12}}><div className="kpi-page-note">달성률 = 실적 ÷ 목표 · 100% 이상이면 목표 달성</div><button className="btn primary" onClick={()=>setAddingGoal(true)}><Plus size={15}/> 새 목표 추가</button></div>} />
   <div className="kpi-range-toolbar">
      <div className="kpi-range-group">
        {KPI_RANGE_OPTIONS.map(option => (
          <button key={option.key} className={`kpi-range-button ${range===option.key?'active':''}`} onClick={()=>setRange(option.key)}>{option.label}</button>
        ))}
      </div>
      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12.5,color:'#64748b',marginLeft:'auto'}}>정렬
        <select value={sortKey} onChange={e=>setSortKey(e.target.value as SortKey)}><option value="name">광고주명</option><option value="achievement">달성률</option><option value="target">목표값</option></select>
      </label>
      <button type="button" className="btn secondary sm" onClick={()=>setSortDir(sortDir==='asc'?'desc':'asc')}>{sortDir==='asc'?'오름차순':'내림차순'}</button>
      <span style={{display:'flex',alignItems:'center',gap:5,fontSize:12.5,color:'#64748b'}}>
        달성률(%):
        <input type="number" placeholder="최소" value={achievementMin} onChange={e=>setAchievementMin(e.target.value)} style={{width:66,padding:'3px 6px',border:'1px solid #e2e8f0',borderRadius:5,fontSize:12}}/>
        ~
        <input type="number" placeholder="최대" value={achievementMax} onChange={e=>setAchievementMax(e.target.value)} style={{width:66,padding:'3px 6px',border:'1px solid #e2e8f0',borderRadius:5,fontSize:12}}/>
        {(achievementMin||achievementMax) && <button type="button" className="btn sm secondary" onClick={()=>{setAchievementMin('');setAchievementMax('')}}>해제</button>}
      </span>
      <div style={{display:'flex',gap:4}}>
        {([['none','전체'],['kpi','KPI별']] as const).map(([key,label])=>(
          <button key={key} className={`btn sm ${groupBy===key?'primary':'secondary'}`} onClick={()=>setGroupBy(key)}>{label}</button>
        ))}
      </div>
   </div>
   {savedToast && <div className="save-toast"><CheckCircle2 size={16}/>{savedToast}</div>}
   <div className="kpi-sections-stack">
     {visibleBrands.length === 0 && <p className="muted" style={{padding:'20px 4px'}}>조건에 맞는 광고주가 없습니다. "새 목표 추가"로 만들어 보세요.</p>}
     {groupBy === 'none'
       ? visibleBrands.map((brand)=><KpiBrandSection key={brand.id} brand={brand} range={range} onEdit={()=>setEditingId(brand.id)} />)
       : groupedBrands?.map(([folderKey, folderBrands]) => {
           const isOpen = openFolders.has(folderKey);
           return (
             <div key={folderKey} className="card ops-card" style={{ padding: 0, overflow: 'hidden' }}>
               <button type="button" onClick={() => toggleFolder(folderKey)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#f8fafc', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                 <span>📁 {folderKey} ({folderBrands.length}개 광고주)</span>
                 <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12.5 }}>{isOpen ? '접기 ▲' : '펼치기 ▼'}</span>
               </button>
               {isOpen && <div style={{ padding: '4px 14px 14px' }}>{folderBrands.map(brand => <KpiBrandSection key={brand.id} brand={brand} range={range} onEdit={()=>setEditingId(brand.id)} />)}</div>}
             </div>
           );
         })}
   </div>
   {editingBrand && <GoalEditModal brand={editingBrand} onClose={()=>setEditingId(null)}
     onSave={(patch)=>{const next=brands.map(brand=>brand.id===editingBrand.id?{...brand,...patch}:brand);updateBrands(next); setSavedToast(`${editingBrand.name} 목표가 저장되었습니다.`); setTimeout(()=>setSavedToast(''),2500);}}
     onDelete={()=>{const next=brands.filter(brand=>brand.id!==editingBrand.id);updateBrands(next);setEditingId(null);setSavedToast(`${editingBrand.name} 목표를 삭제했습니다.`);setTimeout(()=>setSavedToast(''),2500);}} />}
   {addingGoal && <NewGoalModal existingCount={brands.length} onClose={()=>setAddingGoal(false)} onCreate={(brand)=>{updateBrands([...brands,brand]);setSavedToast(`${brand.name} 목표를 추가했습니다.`);setTimeout(()=>setSavedToast(''),2500);}} />}
 </>
}

type ReportSectionKey = string;

type GeneratedReport = {
  id: string;
  title: string;
  advertiser: string;
  period: string;
  createdAt: string;
  sections: ReportSectionKey[];
  status: '완료';
  data?: DailyReportDocument;
  sync?: { googleSheets?: string; notion?: string; pdf?: string };
};

type ReportSectionOption = { key: ReportSectionKey; label: string; group: string };

const REPORT_SECTION_OPTIONS: ReportSectionOption[] = [
  { key:'summary-overview', label:'전체 요약', group:'보고서 구성' },
  { key:'media-performance', label:'매체별 성과', group:'보고서 구성' },
  { key:'creative-top-worst', label:'소재 TOP·WORST', group:'보고서 구성' },
  { key:'creative-performance', label:'소재별 성과', group:'보고서 구성' },
  { key:'spend-trend', label:'광고비 추이', group:'보고서 구성' },
  { key:'sales-roas-trend', label:'매출/ROAS 추이', group:'보고서 구성' },
  { key:'automation-results', label:'자동화 규칙 실행 결과', group:'보고서 구성' },
  { key:'key-insights', label:'주요 인사이트', group:'보고서 구성' },
  { key:'next-actions', label:'다음 액션 제안', group:'보고서 구성' },
  { key:'meta-db', label:'META DB 개수', group:'DB 개수' },
  { key:'daangn-db', label:'당근 DB 개수', group:'DB 개수' },
  { key:'naver-db', label:'네이버 DB 개수', group:'DB 개수' },
  { key:'google-sa-db', label:'구글 SA DB 개수', group:'DB 개수' },
  { key:'youtube-ad-db', label:'YouTube AD DB 개수', group:'DB 개수' },
  { key:'tiktok-db', label:'틱톡 DB 개수', group:'DB 개수' },
  { key:'total-db', label:'총 DB 개수', group:'DB 개수' },

  { key:'meta-clicks', label:'META 클릭수', group:'클릭수' },
  { key:'daangn-clicks', label:'당근 클릭수', group:'클릭수' },
  { key:'naver-clicks', label:'네이버 클릭수', group:'클릭수' },
  { key:'google-sa-clicks', label:'구글 SA 클릭수', group:'클릭수' },
  { key:'youtube-ad-clicks', label:'YouTube AD 클릭수', group:'클릭수' },
  { key:'tiktok-clicks', label:'틱톡 클릭수', group:'클릭수' },
  { key:'kakao-keyword-clicks', label:'카카오키워드 클릭수', group:'클릭수' },
  { key:'kakao-moment-friend', label:'카카오모먼트 플러스친구', group:'클릭수' },
  { key:'total-clicks', label:'총 클릭수', group:'클릭수' },

  { key:'meta-impressions', label:'META 노출수', group:'노출수' },
  { key:'daangn-impressions', label:'당근 노출수', group:'노출수' },
  { key:'naver-impressions', label:'네이버 노출수', group:'노출수' },
  { key:'google-sa-impressions', label:'구글 SA 노출수', group:'노출수' },
  { key:'youtube-ad-impressions', label:'YouTube AD 노출수', group:'노출수' },
  { key:'tiktok-impressions', label:'틱톡 노출수', group:'노출수' },
  { key:'total-impressions', label:'총 노출수', group:'노출수' },

  { key:'meta-spend', label:'META 광고비', group:'광고비' },
  { key:'daangn-spend', label:'당근 광고비', group:'광고비' },
  { key:'naver-spend', label:'네이버 광고비', group:'광고비' },
  { key:'google-sa-spend', label:'구글 SA 광고비', group:'광고비' },
  { key:'youtube-ad-spend', label:'YouTube AD 광고비', group:'광고비' },
  { key:'tiktok-spend', label:'틱톡 광고비', group:'광고비' },
  { key:'kakao-keyword-spend', label:'카카오키워드 광고비', group:'광고비' },
  { key:'kakao-moment-channel-spend', label:'카카오모먼트 채널추가 광고비', group:'광고비' },
  { key:'facebook-spend', label:'메타 광고비', group:'광고비' },
  { key:'gfa-spend', label:'GFA 광고비', group:'광고비' },
  { key:'kakao-moment-conversion-spend', label:'카카오모먼트 전환 광고비', group:'광고비' },
  { key:'kakao-moment-message-spend', label:'카카오모먼트 메시지(도달) 광고비', group:'광고비' },
  { key:'mobion-spend', label:'모비온 광고비', group:'광고비' },
  { key:'adn-spend', label:'ADN 광고비', group:'광고비' },
  { key:'google-spend', label:'구글 광고비', group:'광고비' },
  { key:'total-spend', label:'총 광고비', group:'광고비' },

  { key:'meta-cpa', label:'META DB 1개당 비용', group:'DB 단가' },
  { key:'daangn-cpa', label:'당근 DB 1개당 비용', group:'DB 단가' },
  { key:'naver-cpa', label:'네이버 DB 1개당 비용', group:'DB 단가' },
  { key:'google-sa-cpa', label:'구글 SA DB 1개당 비용', group:'DB 단가' },
  { key:'youtube-ad-cpa', label:'YouTube AD DB 1개당 비용', group:'DB 단가' },
  { key:'tiktok-cpa', label:'틱톡 DB 1개당 비용', group:'DB 단가' },
  { key:'avg-cpa', label:'DB 1개당 평균단가', group:'DB 단가' },

  { key:'meta-cpc', label:'META CPC', group:'클릭당 비용' },
  { key:'daangn-cpc', label:'당근 CPC', group:'클릭당 비용' },
  { key:'naver-cpc', label:'네이버 CPC', group:'클릭당 비용' },
  { key:'google-sa-cpc', label:'구글 SA CPC', group:'클릭당 비용' },
  { key:'youtube-ad-cpc', label:'YouTube AD CPC', group:'클릭당 비용' },
  { key:'tiktok-cpc', label:'틱톡 CPC', group:'클릭당 비용' },
  { key:'kakao-keyword-cpc', label:'카카오키워드 클릭당비용', group:'클릭당 비용' },
  { key:'kakao-moment-friend-cpc', label:'카카오모먼트 채널추가당 비용', group:'클릭당 비용' },
  { key:'facebook-cpc', label:'메타 클릭당비용', group:'클릭당 비용' },
  { key:'google-cpc', label:'구글 클릭당비용', group:'클릭당 비용' },
  { key:'kakao-moment-cpc', label:'카카오모먼트 클릭당비용', group:'클릭당 비용' },
  { key:'gfa-cpc', label:'GFA 클릭당비용', group:'클릭당 비용' },
  { key:'overall-cpc', label:'전체 클릭당비용', group:'클릭당 비용' },

  { key:'meta-ctr', label:'META 클릭율', group:'클릭율' },
  { key:'daangn-ctr', label:'당근 클릭율', group:'클릭율' },
  { key:'naver-ctr', label:'네이버 클릭율', group:'클릭율' },
  { key:'google-sa-ctr', label:'구글 SA 클릭율', group:'클릭율' },
  { key:'youtube-ad-ctr', label:'YouTube AD 클릭율', group:'클릭율' },
  { key:'tiktok-ctr', label:'틱톡 클릭율', group:'클릭율' },
  { key:'total-ctr', label:'총 클릭율', group:'클릭율' },

  { key:'meta-cvr', label:'META 전환률', group:'전환률' },
  { key:'daangn-cvr', label:'당근 전환률', group:'전환률' },
  { key:'naver-cvr', label:'네이버 전환률', group:'전환률' },
  { key:'google-sa-cvr', label:'구글 SA 전환률', group:'전환률' },
  { key:'youtube-ad-cvr', label:'YouTube AD 전환률', group:'전환률' },
  { key:'tiktok-cvr', label:'틱톡 전환율', group:'전환률' },
  { key:'total-cvr', label:'총 전환률', group:'전환률' },

  { key:'facebook-sales', label:'메타 매출', group:'매출' },
  { key:'naver-sales', label:'네이버 매출', group:'매출' },
  { key:'gfa-sales', label:'GFA 매출', group:'매출' },
  { key:'kakao-keyword-sales', label:'카카오키워드 매출', group:'매출' },
  { key:'kakao-moment-sales', label:'카카오모먼트 전환매출', group:'매출' },
  { key:'kakao-moment-message-sales', label:'카카오모먼트 메시지(도달) 매출', group:'매출' },
  { key:'mobion-sales', label:'모비온 매출', group:'매출' },
  { key:'adn-sales', label:'ADN 매출', group:'매출' },
  { key:'daangn-sales', label:'당근 매출', group:'매출' },
  { key:'google-sales', label:'구글 매출', group:'매출' },
  { key:'assisted-sales', label:'간접전환 매출', group:'매출' },
  { key:'cafe24-sales', label:'카페24 매출액', group:'매출' },
  { key:'smartstore-sales', label:'스마트스토어 매출', group:'매출' },
  { key:'total-commerce-sales', label:'총 매출(카페24+스마트스토어)', group:'매출' },

  { key:'facebook-roas', label:'메타 ROAS', group:'ROAS' },
  { key:'naver-roas', label:'네이버 ROAS', group:'ROAS' },
  { key:'gfa-roas', label:'GFA ROAS', group:'ROAS' },
  { key:'kakao-keyword-roas', label:'카카오키워드 ROAS', group:'ROAS' },
  { key:'kakao-moment-roas', label:'카카오모먼트 ROAS', group:'ROAS' },
  { key:'kakao-moment-message-roas', label:'카카오모먼트 메시지(도달) ROAS', group:'ROAS' },
  { key:'mobion-roas', label:'모비온 ROAS', group:'ROAS' },
  { key:'adn-roas', label:'ADN ROAS', group:'ROAS' },
  { key:'daangn-roas', label:'당근 ROAS', group:'ROAS' },
  { key:'google-roas', label:'구글 ROAS', group:'ROAS' },
  { key:'overall-roas', label:'전체 ROAS', group:'ROAS' },
];

const BASE_REPORT_SECTION_OPTIONS = REPORT_SECTION_OPTIONS.slice(0, 9);

const REPORT_STORAGE_KEY = 'adcc-generated-reports-v1';
const REPORT_TEMPLATE_STORAGE_KEY = 'adcc-report-templates-v1';

type ReportTemplate = {
  id: string;
  title: string;
  advertiser: string;
  periodMode: '어제'|'오늘'|'최근 7일'|'최근 14일'|'최근 30일'|'최근 60일'|'최근 90일'|'직접 선택';
  startDate: string;
  endDate: string;
  sections: ReportSectionKey[];
  sheetId: string;
  sheetName: string;
  createdAt: string;
};

function loadStoredReportTemplates(): ReportTemplate[] {
  try {
    const raw = localStorage.getItem(REPORT_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}


function reportSectionLabel(key: ReportSectionKey) {
  const base = BASE_REPORT_SECTION_OPTIONS.find((item) => item.key === key)?.label;
  if (base) return base;
  const formula = loadMetricFormulas().find((item) => item.id === key)?.label;
  return formula ?? REPORT_SECTION_OPTIONS.find((item) => item.key === key)?.label ?? key;
}

function loadStoredReports(): GeneratedReport[] {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ReportDetailModal({ report, onClose, onUpdate }: { report: GeneratedReport; onClose: () => void; onUpdate: (report: GeneratedReport) => void }) {
  const [working,setWorking]=useState('');
  const [message,setMessage]=useState('');
  const integrationSettings=loadReportIntegrationSettings();
  const document = report.data ?? buildDailyReportDocument({ id: report.id, title: report.title, advertiser: report.advertiser, period: report.period, createdAt: report.createdAt, sectionLabels: report.sections.map(reportSectionLabel) });
  const run = async (type:'google'|'notion'|'pdf'|'xlsx'|'csv') => {
    setWorking(type); setMessage('');
    try {
      if(type==='google') await syncReportToGoogleSheets(document,integrationSettings);
      if(type==='notion') await syncReportToNotion(document,integrationSettings);
      if(type==='pdf') openReportPdfPrint(document,integrationSettings.pdf);
      if(type==='xlsx') downloadReportXlsx(document);
      if(type==='csv') downloadReportCsv(document);
      const label={google:'Google Sheets',notion:'Notion',pdf:'PDF',xlsx:'Excel',csv:'CSV'}[type];
      const next={...report,data:document,sync:{...(report.sync||{}),...(type==='google'?{googleSheets:new Date().toLocaleString('ko-KR')}:type==='notion'?{notion:new Date().toLocaleString('ko-KR')}:type==='pdf'?{pdf:new Date().toLocaleString('ko-KR')}:{})}};
      onUpdate(next);
      setMessage(`${label} 작업이 완료되었습니다.`);
    } catch(error){setMessage(error instanceof Error?error.message:'작업에 실패했습니다.');}
    finally{setWorking('');}
  };
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-card report-detail-modal integration-report-modal" onClick={(event)=>event.stopPropagation()}>
      <div className="modal-head">
        <div><h3>{report.title}</h3><p>{report.advertiser} · {report.period} · {report.createdAt}</p></div>
        <button className="icon-btn" onClick={onClose}><X size={18}/></button>
      </div>
      <div className="report-export-toolbar">
        <button className="btn secondary" disabled={!!working} onClick={()=>run('google')}>Google Sheets 전송</button>
        <button className="btn secondary" disabled={!!working} onClick={()=>run('notion')}>Notion 전송</button>
        <button className="btn secondary" disabled={!!working} onClick={()=>run('xlsx')}><Download size={14}/> Excel</button>
        <button className="btn secondary" disabled={!!working} onClick={()=>run('csv')}><Download size={14}/> CSV</button>
        <button className="btn primary" disabled={!!working} onClick={()=>run('pdf')}><Download size={14}/> PDF 생성</button>
      </div>
      {message&&<div className="save-toast">{message}</div>}
      <div className="report-detail-sheet daily-report-sheet">
        <div className="report-detail-cover"><span>AD CONTROL CENTER</span><h2>{report.title}</h2><p>{report.advertiser} · {report.period}</p></div>
        <div className="daily-report-kpis">
          <div><span>총 광고비</span><strong>₩{Math.round(document.summary.spend).toLocaleString()}</strong></div>
          <div><span>총 DB</span><strong>{document.summary.db.toLocaleString()}개</strong></div>
          <div><span>총 클릭</span><strong>{document.summary.clicks.toLocaleString()}</strong></div>
          <div><span>총 매출</span><strong>₩{Math.round(document.summary.sales).toLocaleString()}</strong></div>
          <div><span>전체 ROAS</span><strong>{Math.round(document.summary.roas)}%</strong></div>
        </div>
        <section className="report-detail-section"><div className="report-detail-section-head"><span>01</span><h4>매체별 성과</h4></div><div className="table-scroll"><table className="ops-table daily-report-table"><thead><tr><th>매체</th><th>노출</th><th>클릭</th><th>CTR</th><th>CPC</th><th>광고비</th><th>DB</th><th>CPA</th><th>매출</th><th>ROAS</th></tr></thead><tbody>{document.channelRows.map(row=><tr key={row.channel}><td><b>{row.channel}</b></td><td>{row.impressions.toLocaleString()}</td><td>{row.clicks.toLocaleString()}</td><td>{row.ctr.toFixed(2)}%</td><td>₩{Math.round(row.cpc).toLocaleString()}</td><td>₩{row.spend.toLocaleString()}</td><td>{row.db}</td><td>₩{Math.round(row.cpa).toLocaleString()}</td><td>₩{row.sales.toLocaleString()}</td><td>{Math.round(row.roas)}%</td></tr>)}</tbody></table></div></section>
        <section className="report-detail-section"><div className="report-detail-section-head"><span>02</span><h4>선택 지표</h4></div><div className="table-scroll"><table className="ops-table daily-report-table"><thead><tr><th>분류</th><th>지표</th><th>값</th><th>증감</th><th>비고</th></tr></thead><tbody>{document.metricRows.map((row,index)=><tr key={`${row.metric}-${index}`}><td>{row.category}</td><td><b>{row.metric}</b></td><td>{row.value}</td><td className={String(row.change).startsWith('-')?'negative':'positive'}>{row.change}</td><td>{row.note}</td></tr>)}</tbody></table></div></section>
        <div className="daily-report-two-col"><section><h4>주요 인사이트</h4><ol>{document.insights.map(item=><li key={item}>{item}</li>)}</ol></section><section><h4>다음 액션</h4><ol>{document.actions.map(item=><li key={item}>{item}</li>)}</ol></section></div>
      </div>
      <div className="modal-actions"><button className="btn secondary" onClick={onClose}>닫기</button></div>
    </div>
  </div>
}

export function ReportBuilderPage(){
 const [activeTab,setActiveTab]=useState<'builder'|'templates'|'generated'>('generated');
 const [showBuilder,setShowBuilder]=useState(false);
 const [name,setName]=useState('성과 보고서');
 const [advertiser,setAdvertiser]=useState('');
 const [periodMode,setPeriodMode]=useState<'어제'|'오늘'|'최근 7일'|'최근 14일'|'최근 30일'|'최근 60일'|'최근 90일'|'직접 선택'>('어제');
 const [startDate,setStartDate]=useState(()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10)});
 const [endDate,setEndDate]=useState(()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10)});
 const [sectionQuery,setSectionQuery]=useState('');
 const [selectedSections,setSelectedSections]=useState<ReportSectionKey[]>([]);
 const [reports,setReports]=useState<GeneratedReport[]>(()=>loadStoredReports());
 const [templates,setTemplates]=useState<ReportTemplate[]>(()=>loadStoredReportTemplates());
 const [selectedReport,setSelectedReport]=useState<GeneratedReport|null>(null);
 const [toast,setToast]=useState('');
 const [sheetId,setSheetId]=useState('');
 const [sheetName,setSheetName]=useState('일일보고');
 const [metricFormulas,setMetricFormulas]=useState<MetricFormula[]>(()=>loadMetricFormulas());
 const [integrationSettings,setIntegrationSettings]=useState<ReportIntegrationSettings>(()=>loadReportIntegrationSettings());
 useEffect(()=>{
   const sync=()=>setMetricFormulas(loadMetricFormulas());
   const syncIntegrations=()=>setIntegrationSettings(loadReportIntegrationSettings());
   window.addEventListener(METRIC_FORMULA_EVENT,sync);
   window.addEventListener(REPORT_INTEGRATION_EVENT,syncIntegrations);
   window.addEventListener('storage',sync);
   window.addEventListener('storage',syncIntegrations);
   return ()=>{window.removeEventListener(METRIC_FORMULA_EVENT,sync);window.removeEventListener(REPORT_INTEGRATION_EVENT,syncIntegrations);window.removeEventListener('storage',sync);window.removeEventListener('storage',syncIntegrations)};
 },[]);
 const availableReportSections=useMemo<ReportSectionOption[]>(()=>[
   ...BASE_REPORT_SECTION_OPTIONS,
   ...metricFormulas.filter(item=>item.enabled).map(item=>({key:item.id,label:item.label,group:item.group}))
 ],[metricFormulas]);

 const persistReports=(next:GeneratedReport[])=>{setReports(next);localStorage.setItem(REPORT_STORAGE_KEY,JSON.stringify(next));};
 const persistTemplates=(next:ReportTemplate[])=>{setTemplates(next);localStorage.setItem(REPORT_TEMPLATE_STORAGE_KEY,JSON.stringify(next));};
 const toggleSection=(key:ReportSectionKey)=>setSelectedSections(current=>current.includes(key)?current.filter(item=>item!==key):[...current,key]);
 const resolvePeriod=()=>periodMode==='직접 선택'?`${startDate} ~ ${endDate}`:periodMode;
 const applyPeriodMode=(mode:typeof periodMode)=>{
   setPeriodMode(mode);
   const today=new Date();
   const toISO=(d:Date)=>d.toISOString().slice(0,10);
   if(mode==='오늘'){const y=toISO(today);setStartDate(y);setEndDate(y);return;}
   if(mode==='어제'){const d=new Date(today);d.setDate(d.getDate()-1);const y=toISO(d);setStartDate(y);setEndDate(y);return;}
   const match=mode.match(/최근 (\d+)일/);
   if(match){const days=Number(match[1]);const start=new Date(today);start.setDate(start.getDate()-(days-1));setStartDate(toISO(start));setEndDate(toISO(today));}
 };
 const openBuilder=()=>{setActiveTab('builder');setShowBuilder(true);setName('성과 보고서');setAdvertiser('');applyPeriodMode('어제');setSelectedSections([]);setSectionQuery('');setSheetId(integrationSettings.googleSheets.spreadsheetId||'');setSheetName(integrationSettings.googleSheets.sheetName||'일일보고');};
 const loadTemplate=(template:ReportTemplate)=>{setActiveTab('builder');setShowBuilder(true);setName(template.title);setAdvertiser(template.advertiser);setPeriodMode(template.periodMode);setStartDate(template.startDate);setEndDate(template.endDate);setSelectedSections(template.sections);setSheetId(template.sheetId);setSheetName(template.sheetName);setToast('저장된 광고주 보고서 양식을 불러왔습니다.');setTimeout(()=>setToast(''),2200);};
 const saveTemplate=()=>{
   if(!name.trim()){setToast('양식명을 입력하세요.');return;}
   if(selectedSections.length===0){setToast('포함할 섹션을 한 개 이상 선택하세요.');return;}
   const template:ReportTemplate={id:String(Date.now()),title:name.trim(),advertiser,periodMode,startDate,endDate,sections:selectedSections,sheetId,sheetName,createdAt:new Date().toLocaleString('ko-KR')};
   persistTemplates([template,...templates]);
   setToast(`“${template.title}” 양식이 광고주 보고서 양식에 저장되었습니다.`);
   setActiveTab('templates');setShowBuilder(false);setTimeout(()=>setToast(''),2800);
 };
 const buildCurrentReport=(): GeneratedReport=>{
   const createdAt=new Date().toLocaleString('ko-KR');
   const id=String(Date.now());
   const data=buildDailyReportDocument({id,title:name.trim(),advertiser,period:resolvePeriod(),createdAt,sectionLabels:selectedSections.map(reportSectionLabel)});
   return {id,title:name.trim(),advertiser,period:resolvePeriod(),createdAt,sections:selectedSections,status:'완료',data,sync:{}};
 };
 const generateReport=async()=>{
   if(!name.trim()){setToast('보고서명을 입력하세요.');return;}
   if(periodMode==='직접 선택'&&(!startDate||!endDate||startDate>endDate)){setToast('직접 선택 기간을 확인하세요.');return;}
   if(selectedSections.length===0){setToast('포함할 섹션을 한 개 이상 선택하세요.');return;}
   let report=buildCurrentReport();
   const data=report.data!;
   const notices:string[]=[];
   const sheetSettings={...integrationSettings,googleSheets:{...integrationSettings.googleSheets,enabled:integrationSettings.googleSheets.enabled||!!sheetId,spreadsheetId:sheetId||integrationSettings.googleSheets.spreadsheetId,sheetName:sheetName||integrationSettings.googleSheets.sheetName}};
   if(sheetSettings.googleSheets.enabled){try{await syncReportToGoogleSheets(data,sheetSettings);report={...report,sync:{...report.sync,googleSheets:new Date().toLocaleString('ko-KR')}};notices.push('Google Sheets 표 생성');}catch(error){notices.push('Google Sheets 전송 실패');}}
   if(integrationSettings.notion.enabled&&integrationSettings.notion.autoSync){try{await syncReportToNotion(data,integrationSettings);report={...report,sync:{...report.sync,notion:new Date().toLocaleString('ko-KR')}};notices.push('Notion');}catch(error){notices.push('Notion 실패');}}
   if(integrationSettings.pdf.enabled&&integrationSettings.pdf.autoGenerate){try{openReportPdfPrint(data,integrationSettings.pdf);report={...report,sync:{...report.sync,pdf:new Date().toLocaleString('ko-KR')}};notices.push('PDF');}catch(error){notices.push('PDF 실패');}}
   persistReports([report,...reports]);
   setToast(`“${report.title}” 일일보고가 생성되었습니다.${notices.length?` · ${notices.join(', ')}`:''}`);
   setShowBuilder(false);setActiveTab('generated');setTimeout(()=>setToast(''),3800);
 };
 const duplicateReport=(report:GeneratedReport)=>{const copy={...report,id:String(Date.now()),title:`${report.title} 복사본`,createdAt:new Date().toLocaleString('ko-KR')};persistReports([copy,...reports]);setToast('보고서 복사본이 추가되었습니다.');setTimeout(()=>setToast(''),2200);};
 const deleteReport=(id:string)=>{if(confirm('이 보고서를 삭제할까요?'))persistReports(reports.filter(report=>report.id!==id));};
 const deleteTemplate=(id:string)=>{if(confirm('이 보고서 양식을 삭제할까요?'))persistTemplates(templates.filter(template=>template.id!==id));};
 const updateReport=(next:GeneratedReport)=>{const updated=reports.map(item=>item.id===next.id?next:item);persistReports(updated);setSelectedReport(next);};
 const filteredOptions=availableReportSections.filter(option=>option.label.toLowerCase().includes(sectionQuery.toLowerCase()));
 const groups=[...new Set(filteredOptions.map(option=>option.group))];

 return <>
   <PageHeader title="보고서 만들기" description="광고주별 보고서 양식을 저장하고, 생성된 보고서는 Google Sheets·Notion·PDF로 연동합니다." />
   <div className="report-builder-tabs report-builder-top-menu">
     <button className={activeTab==='builder'?'active':''} onClick={openBuilder}><Plus size={15}/> 새 보고서 만들기</button>
     <button className={activeTab==='templates'?'active':''} onClick={()=>{setActiveTab('templates');setShowBuilder(false)}}><FileText size={15}/> 광고주 보고서 양식 <span>{templates.length}</span></button>
     <button className={activeTab==='generated'?'active':''} onClick={()=>{setActiveTab('generated');setShowBuilder(false)}}><FileText size={15}/> 생성된 보고서 <span>{reports.length}</span></button>
   </div>
   {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}

   {activeTab==='builder'&&showBuilder&&<section className="card report-builder-form-card">
     <div className="ops-card-head"><div><h3>새 보고서 만들기</h3><p>생성할 데이터, 기간, Google Sheets 연동 위치를 선택하세요.</p></div><button className="icon-btn" onClick={()=>{setShowBuilder(false);setActiveTab('generated')}}><X size={18}/></button></div>
     <div className="report-builder-form-grid">
       <label className="field-label">보고서명<input value={name} onChange={e=>setName(e.target.value)} placeholder="성과 보고서"/></label>
       <label className="field-label">광고주<select value={advertiser} onChange={e=>setAdvertiser(e.target.value)}><option value="">광고주 선택</option>{advertisers.map(a=><option key={a}>{a}</option>)}</select></label>
       <label className="field-label">Google 스프레드시트 ID<input value={sheetId} onChange={e=>setSheetId(e.target.value)} placeholder="연동할 시트 ID 입력"/></label>
       <label className="field-label">새 시트명<input value={sheetName} onChange={e=>setSheetName(e.target.value)} placeholder="예: 일일보고"/></label>
     </div>
     <div className="report-period-block">
       <b>기간 선택</b>
       <div className="report-period-buttons">{(['어제','오늘','최근 7일','최근 14일','최근 30일','최근 60일','최근 90일','직접 선택'] as const).map(mode=><button key={mode} className={periodMode===mode?'active':''} onClick={()=>applyPeriodMode(mode)}>{mode}</button>)}</div>
       {periodMode==='직접 선택'&&<div className="report-custom-range"><label className="field-label">시작일<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><span>~</span><label className="field-label">종료일<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></div>}
     </div>
     <div className="report-section-selector large">
       <div className="report-section-selector-head"><div><b>포함할 섹션</b><span>기본 보고서 구성 9개와 환경설정에 등록된 지표 {Math.max(0,availableReportSections.length-9)}개</span></div><div className="inline-actions"><button className="btn secondary" onClick={()=>setSelectedSections(availableReportSections.map(x=>x.key))}>전체 선택</button><button className="btn secondary" onClick={()=>setSelectedSections([])}>선택 해제</button></div></div>
       <div className="ops-search report-section-search"><Search size={16}/><input value={sectionQuery} onChange={e=>setSectionQuery(e.target.value)} placeholder="섹션 또는 지표 검색"/></div>
       <div className="report-section-groups">{groups.map(group=><div className={`report-section-group ${group==='보고서 구성'?'featured':''}`} key={group}><h4>{group}</h4><div className="report-section-chips">{filteredOptions.filter(option=>option.group===group).map(option=><button type="button" key={option.key} className={selectedSections.includes(option.key)?'selected':''} onClick={()=>toggleSection(option.key)}>{selectedSections.includes(option.key)?'✓ ':''}{option.label}</button>)}</div></div>)}</div>
     </div>
     <div className="report-live-preview"><strong>{name||'보고서 제목'}</strong><span>{advertiser} · {resolvePeriod()} · 선택 섹션 {selectedSections.length}개 · 시트명 {sheetName||'미지정'}</span><div>{selectedSections.slice(0,8).map(section=><i key={section}>{reportSectionLabel(section)}</i>)}{selectedSections.length>8&&<i>+{selectedSections.length-8}개</i>}</div></div>
     <div className="report-builder-actions"><button className="btn secondary" onClick={saveTemplate}><Save size={15}/> 양식 저장</button><button className="btn primary" onClick={generateReport}>생성</button><button className="btn secondary" onClick={()=>{setShowBuilder(false);setActiveTab('generated')}}>취소</button></div>
   </section>}

   {activeTab==='templates'&&<section className="card report-list-card">
     <div className="ops-card-head"><div><h3>광고주 보고서 양식</h3><p>저장된 양식을 불러와 같은 구성으로 일일보고를 빠르게 생성합니다.</p></div><button className="btn primary" onClick={openBuilder}><Plus size={15}/> 새 양식</button></div>
     {templates.length===0 ? <div className="report-list-empty"><FileText size={36}/><b>저장된 보고서 양식이 없습니다.</b><span>새 보고서 만들기에서 양식 저장을 눌러 추가하세요.</span></div> : <div className="report-generated-list">{templates.map(template=><article key={template.id} className="report-generated-item">
       <div className="report-generated-icon"><FileText size={20}/></div>
       <div className="report-generated-main"><div><b>{template.title}</b><span className="status-pill warning">양식</span></div><p>{template.advertiser} · {template.periodMode} · 섹션 {template.sections.length}개 · {template.sheetName||'시트 미지정'}</p><small>{template.createdAt}</small></div>
       <div className="report-generated-actions"><button className="btn primary" onClick={()=>loadTemplate(template)}>불러오기</button><button className="icon-btn danger" onClick={()=>deleteTemplate(template.id)} title="삭제"><Trash2 size={16}/></button></div>
     </article>)}</div>}
   </section>}

   {activeTab==='generated'&&<section className="card report-list-card">
     <div className="ops-card-head"><div><h3>생성된 보고서</h3><p>생성한 보고서가 최신순으로 계속 누적됩니다.</p></div><button className="btn primary" onClick={openBuilder}><Plus size={15}/> 새 보고서</button></div>
     {reports.length===0 ? <div className="report-list-empty"><FileText size={36}/><b>생성된 보고서가 없습니다.</b><span>새 보고서 만들기 메뉴를 눌러 첫 보고서를 생성하세요.</span></div> : <div className="report-generated-list">{reports.map(report=><article key={report.id} className="report-generated-item">
       <div className="report-generated-icon"><FileText size={20}/></div>
       <div className="report-generated-main"><div><b>{report.title}</b><span className="status-pill success">{report.status}</span></div><p>{report.advertiser} · {report.period} · 섹션 {report.sections.length}개</p><small>{report.createdAt}{report.sync?.googleSheets?` · Sheets ${report.sync.googleSheets}`:''}</small></div>
       <div className="report-generated-actions"><button className="btn secondary" onClick={()=>setSelectedReport(report)}><Eye size={15}/> 일일보고</button><button className="btn secondary compact-export" onClick={()=>downloadReportXlsx(report.data??buildDailyReportDocument({id:report.id,title:report.title,advertiser:report.advertiser,period:report.period,createdAt:report.createdAt,sectionLabels:report.sections.map(reportSectionLabel)}))}><Download size={14}/> Excel</button><button className="icon-btn" onClick={()=>duplicateReport(report)} title="복사"><Copy size={16}/></button><button className="icon-btn danger" onClick={()=>deleteReport(report.id)} title="삭제"><Trash2 size={16}/></button></div>
     </article>)}</div>}
   </section>}
   {selectedReport&&<ReportDetailModal report={selectedReport} onClose={()=>setSelectedReport(null)} onUpdate={updateReport}/>} 
 </>
}


type DbChannel = '메타'|'당근마켓'|'틱톡'|'카카오'|'구글'|'네이버';
type DbLeadRow = { id:number; advertiser:string; channel:DbChannel; date:string; db:number; validDb:number; cost:number; owner:string; status:'정상'|'확인 필요'|'중복 점검' };
const initialDbLeadRows:DbLeadRow[]=[];

export function DbManagementPage(){
 const [rows,setRows]=useState<DbLeadRow[]>(()=>JSON.parse(localStorage.getItem('adcc-db-leads')||'null')||initialDbLeadRows);
 const { filterValue } = useAdvertiserFilter();
 const [query,setQuery]=useState(''); const [channel,setChannel]=useState<'전체'|DbChannel>('전체'); const [showForm,setShowForm]=useState(false);
 const [form,setForm]=useState<DbLeadRow>({id:Date.now(),advertiser:'',channel:'메타',date:new Date().toISOString().slice(0,10),db:0,validDb:0,cost:0,owner:'',status:'정상'});
 const persist=(next:DbLeadRow[])=>{setRows(next);localStorage.setItem('adcc-db-leads',JSON.stringify(next));};
 const filtered=rows.filter(row=>(row.advertiser+row.channel+row.owner).toLowerCase().includes(query.toLowerCase())&&(channel==='전체'||row.channel===channel)&&matchesAdvertiserFilter(row.advertiser,filterValue));
 const totalDb=filtered.reduce((sum,row)=>sum+row.db,0), validDb=filtered.reduce((sum,row)=>sum+row.validDb,0), totalCost=filtered.reduce((sum,row)=>sum+row.cost,0);
 const channels:DbChannel[]=['메타','당근마켓','틱톡','카카오','구글','네이버'];
 const update=(key:keyof DbLeadRow,value:any)=>setForm({...form,[key]:key==='db'||key==='validDb'||key==='cost'?Number(value):value});
 const save=()=>{persist([{...form,id:Date.now()},...rows]);setShowForm(false);setForm({...form,id:Date.now(),db:0,validDb:0,cost:0});};
 return <>
  <PageHeader title="DB 데이터 관리" description="광고주별 DB 수집 데이터를 매체별로 관리하고 일일보고용 보고서로 연결합니다." action={<button className="btn primary" onClick={()=>setShowForm(true)}><Plus size={15}/> DB 데이터 추가</button>}/>
  {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경) · 전체 {filterByAdvertiser(rows,filterValue,r=>r.advertiser).length}건 중 표시</div>}
  <div className="ops-toolbar"><div className="ops-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="매체·담당자로 추가 검색"/></div><select value={channel} onChange={e=>setChannel(e.target.value as '전체'|DbChannel)}><option>전체</option>{channels.map(item=><option key={item}>{item}</option>)}</select><button className="btn secondary" onClick={()=>downloadReportCsv(buildDailyReportDocument({id:'db',title:'DB 연동 보고서',advertiser:filterValue||'전체 광고주',period:'오늘',createdAt:new Date().toLocaleString('ko-KR'),sectionLabels:['DB 연동 및 관리']}))}><Download size={15}/> DB 보고서 CSV</button></div>
  <div className="ops-stat-grid"><Stat label="총 DB" value={`${totalDb.toLocaleString()}개`}/><Stat label="유효 DB" value={`${validDb.toLocaleString()}개`} sub={`${totalDb?Math.round(validDb/totalDb*100):0}%`}/><Stat label="총 수집비" value={`₩${totalCost.toLocaleString()}`}/><Stat label="DB 평균단가" value={`₩${Math.round(totalDb?totalCost/totalDb:0).toLocaleString()}`}/></div>
  {showForm&&<section className="card ops-card"><div className="ops-card-head"><h3>DB 데이터 추가</h3><button className="icon-btn" onClick={()=>setShowForm(false)}><X size={18}/></button></div><div className="form-grid"><label className="field-label">광고주<input value={form.advertiser} onChange={e=>update('advertiser',e.target.value)}/></label><label className="field-label">매체<select value={form.channel} onChange={e=>update('channel',e.target.value)}>{channels.map(item=><option key={item}>{item}</option>)}</select></label><label className="field-label">날짜<input type="date" value={form.date} onChange={e=>update('date',e.target.value)}/></label><label className="field-label">담당자<input value={form.owner} onChange={e=>update('owner',e.target.value)}/></label><label className="field-label">DB 수<input type="number" value={form.db} onChange={e=>update('db',e.target.value)}/></label><label className="field-label">유효 DB<input type="number" value={form.validDb} onChange={e=>update('validDb',e.target.value)}/></label><label className="field-label">광고비<input type="number" value={form.cost} onChange={e=>update('cost',e.target.value)}/></label><label className="field-label">상태<select value={form.status} onChange={e=>update('status',e.target.value)}><option>정상</option><option>확인 필요</option><option>중복 점검</option></select></label></div><div className="modal-actions"><button className="btn secondary" onClick={()=>setShowForm(false)}>취소</button><button className="btn primary" onClick={save}>저장</button></div></section>}
  <section className="card ops-card"><div className="ops-card-head"><div><h3>매체별 DB 수집 현황</h3><p>메타·당근마켓·틱톡·카카오·구글·네이버 DB를 통합 관리합니다.</p></div></div><div className="table-scroll"><table className="ops-table"><thead><tr><th>광고주</th><th>매체</th><th>날짜</th><th>DB</th><th>유효 DB</th><th>광고비</th><th>DB 단가</th><th>담당자</th><th>상태</th><th></th></tr></thead><tbody>{filtered.map(row=><tr key={row.id}><td><b>{row.advertiser}</b></td><td>{row.channel}</td><td>{row.date}</td><td>{row.db}</td><td>{row.validDb}</td><td>₩{row.cost.toLocaleString()}</td><td>₩{Math.round(row.db?row.cost/row.db:0).toLocaleString()}</td><td>{row.owner}</td><td><span className={`status-pill ${row.status==='정상'?'success':'warning'}`}>{row.status}</span></td><td><button className="icon-btn danger" onClick={()=>persist(rows.filter(item=>item.id!==row.id))}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div></section>
 </>
}

type CommissionRow={id:number;date:string;month:string;advertiser:string;platform:string;owner:string;sales:number;adSpend:number;rate:number;fixedBonus:number;memo:string};
type AllowanceRule={id:number;category:'매체별 수당'|'기타 수당';name:string;platform:string;method:'정률'|'정액';value:number;condition:string;memo:string};
const initialAllowanceRules:AllowanceRule[]=[];
const initialCommissions:CommissionRow[]=[];
export function CommissionSettlementPage(){
 const STORAGE_KEY='adcc-commission-rows';
 const emptyForm=(baseMonth=new Date().toISOString().slice(0,7), advertiser='') : CommissionRow => ({id:Date.now(),date:`${baseMonth}-01`,month:baseMonth,advertiser,platform:'Meta',owner:'',sales:0,adSpend:0,rate:0,fixedBonus:0,memo:''});
 const [rows,setRows]=useState<CommissionRow[]>(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||initialCommissions}catch{return initialCommissions}});
 const RULES_KEY='adcc-allowance-rules';
 const [allowanceRules,setAllowanceRules]=useState<AllowanceRule[]>(()=>{try{return JSON.parse(localStorage.getItem(RULES_KEY)||'null')||initialAllowanceRules}catch{return initialAllowanceRules}});
 const [ruleCategory,setRuleCategory]=useState<'매체별 수당'|'기타 수당'>('매체별 수당');
 const [ruleForm,setRuleForm]=useState<AllowanceRule|null>(null);
 const persistRules=(next:AllowanceRule[])=>{setAllowanceRules(next);localStorage.setItem(RULES_KEY,JSON.stringify(next));};
 // '정산 항목 추가'의 매체 선택 목록입니다. 기본 매체 뒤에, 수당 책정 기준의 '매체별 수당'에 등록한
 // 매체와 '기타 수당'에 등록한 항목을 자동으로 이어붙여서, 새 기준을 추가하면 바로 선택할 수 있게 합니다.
 const platformSelectOptions=useMemo(()=>{
   const base=['Meta','네이버','Google','당근','틱톡','카카오'];
   const fromRules=Array.from(new Set(allowanceRules.filter(r=>r.category==='매체별 수당').map(r=>r.platform).filter(Boolean)));
   const etcFromRules=Array.from(new Set(allowanceRules.filter(r=>r.category==='기타 수당').map(r=>r.platform).filter(Boolean)));
   const merged=Array.from(new Set([...base,...fromRules]));
   return [...merged, '기타', ...etcFromRules.filter(v=>!merged.includes(v))];
 },[allowanceRules]);
 const openNewRule=(category:'매체별 수당'|'기타 수당')=>setRuleForm({id:Date.now(),category,name:'',platform:category==='매체별 수당'?'Meta':'',method:'정액',value:0,condition:'',memo:''});
 const saveRule=()=>{if(!ruleForm?.name.trim())return;const exists=allowanceRules.some(r=>r.id===ruleForm.id);persistRules(exists?allowanceRules.map(r=>r.id===ruleForm.id?ruleForm:r):[...allowanceRules,ruleForm]);setRuleForm(null);notify('수당 책정 기준을 저장했습니다.');};
 const { filterValue } = useAdvertiserFilter();
 const [advertiserQuery,setAdvertiserQuery]=useState(filterValue||'');
 const [ownerQuery,setOwnerQuery]=useState('');
 useEffect(()=>{setAdvertiserQuery(filterValue||'')},[filterValue]);
 const [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7));
 const [periodType,setPeriodType]=useState<'month'|'week'|'day'|'year'|'custom'>('month');
 const [year,setYear]=useState('2026');
 const [weekStart,setWeekStart]=useState(()=>new Date().toISOString().slice(0,10));
 const [day,setDay]=useState(()=>new Date().toISOString().slice(0,10));
 const [customRange,setCustomRange]=useState<DateRange>(()=>{const d=new Date().toISOString().slice(0,10);return {from:d,to:d}});
 const [showForm,setShowForm]=useState(false);
 const formSectionRef=useRef<HTMLElement>(null);
 // '정산 항목 추가/수정'을 누르면 폼이 화면 아래쪽에 나타나는데, 스크롤을 안 하면 아무 반응이 없는 것처럼 보였습니다.
 // 폼이 열릴 때 그 위치로 자동 스크롤해서 바로 보이게 합니다.
 useEffect(()=>{ if(showForm) formSectionRef.current?.scrollIntoView({behavior:'smooth',block:'start'}); },[showForm]);
 const [editingId,setEditingId]=useState<number|null>(null);
 const [form,setForm]=useState<CommissionRow>(()=>emptyForm(month, filterValue));
 const [toast,setToast]=useState('');
 const notify=(message:string)=>{setToast(message);setTimeout(()=>setToast(''),2200)};
 const persist=(next:CommissionRow[])=>{setRows(next);localStorage.setItem(STORAGE_KEY,JSON.stringify(next));};
 const daysInMonth=(m:string)=>new Date(Number(m.split('-')[0]),Number(m.split('-')[1]),0).getDate();
 const addDays=(iso:string,n:number)=>{const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
 const weekEnd=addDays(weekStart,6);
 // 실제 정산일(date) 기준으로 걸러냅니다. 더 이상 "월 합계를 일수 비율로 환산"하지 않고,
 // 그 기간에 실제로 등록된 정산 항목만 그대로 더합니다.
 const filtered=rows.filter(row=>{
   const inPeriod = periodType==='month' ? row.date.startsWith(month)
     : periodType==='day' ? row.date===day
     : periodType==='week' ? row.date>=weekStart && row.date<=weekEnd
     : periodType==='year' ? row.date.startsWith(year)
     : row.date>=customRange.from && row.date<=customRange.to;
   return inPeriod && matchesAdvertiserFilter(row.advertiser,advertiserQuery) && row.owner.toLowerCase().includes(ownerQuery.toLowerCase());
 });
 const totalSales=filtered.reduce((sum,row)=>sum+row.sales,0);
 const totalSpend=filtered.reduce((sum,row)=>sum+row.adSpend,0);
 const totalFee=filtered.reduce((sum,row)=>sum+Math.round(row.sales*row.rate/100)+row.fixedBonus,0);
 const update=(key:keyof CommissionRow,value:any)=>setForm(prev=>({...prev,[key]:['sales','adSpend','rate','fixedBonus'].includes(key)?Number(value):value}));
 const openNew=()=>{setEditingId(null);setForm(emptyForm(month,filterValue));setShowForm(true)};
 const openEdit=(row:CommissionRow)=>{setEditingId(row.id);setForm({...row});setShowForm(true)};
 const save=()=>{
   if(!form.advertiser.trim()||!form.owner.trim()){notify('광고주와 담당자를 입력하세요.');return;}
   if(!form.date){notify('정산일을 선택하세요.');return;}
   const cleaned={...form,advertiser:form.advertiser.trim(),owner:form.owner.trim(),date:form.date,month:form.date.slice(0,7),id:editingId??Date.now()};
   const next=editingId?rows.map(row=>row.id===editingId?cleaned:row):[cleaned,...rows];
   persist(next);setShowForm(false);setEditingId(null);setForm(emptyForm(month,filterValue));notify(editingId?'정산 항목을 수정했습니다.':'정산 항목을 추가했습니다.');
 };
 const remove=(id:number)=>{if(confirm('정산 항목을 삭제할까요?')){persist(rows.filter(row=>row.id!==id));notify('정산 항목을 삭제했습니다.')}};
 const periodLabel=periodType==='month'?`${month} 전체`:periodType==='day'?`${day} 실제 등록된 정산 항목`:periodType==='week'?`${weekStart} ~ ${weekEnd} 실제 등록된 정산 항목`:periodType==='year'?`${year}년 전체`:`${customRange.from} ~ ${customRange.to} 실제 등록된 정산 항목`;
 const groupedByAdvertiser=Array.from(filtered.reduce((map,row)=>{const current=map.get(row.advertiser)||{name:row.advertiser,count:0,sales:0,spend:0,fee:0};current.count+=1;current.sales+=row.sales;current.spend+=row.adSpend;current.fee+=Math.round(row.sales*row.rate/100)+row.fixedBonus;map.set(row.advertiser,current);return map},new Map<string,{name:string;count:number;sales:number;spend:number;fee:number}>()).values());
 const groupedByOwner=Array.from(filtered.reduce((map,row)=>{const current=map.get(row.owner)||{name:row.owner,count:0,sales:0,spend:0,fee:0};current.count+=1;current.sales+=row.sales;current.spend+=row.adSpend;current.fee+=Math.round(row.sales*row.rate/100)+row.fixedBonus;map.set(row.owner,current);return map},new Map<string,{name:string;count:number;sales:number;spend:number;fee:number}>()).values());
 const downloadCsv=()=>{const header=['정산일','정산월','광고주','매체','담당자','매출','광고비','수수료율','영업수수료','고정수당','정산액','메모'];const body=filtered.map(row=>{const variable=Math.round(row.sales*row.rate/100);return [row.date,row.month,row.advertiser,row.platform,row.owner,row.sales,row.adSpend,row.rate,variable,row.fixedBonus,variable+row.fixedBonus,row.memo]});const csv=[header,...body].map(line=>line.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));a.download=`수당_수수료_정산_${month}.csv`;a.click();URL.revokeObjectURL(a.href)};
 return <>
  <PageHeader title="수당 및 수수료 정산" description="광고주별·담당자별 수당, 영업수수료, 고정 보너스를 등록·수정·삭제하고 기간별 정산액을 확인합니다." action={<button className="btn primary" onClick={openNew}><Plus size={15}/> 정산 항목 추가</button>}/>
  {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}
  <section className="card ops-card commission-control-card">
    <div className="period-type-row">
      <div className="period-type-toggle">
        <button className={periodType==='day'?'active':''} onClick={()=>setPeriodType('day')}>일별 정산</button>
        <button className={periodType==='week'?'active':''} onClick={()=>setPeriodType('week')}>주별 정산</button>
        <button className={periodType==='month'?'active':''} onClick={()=>setPeriodType('month')}>월별 정산</button>
        <button className={periodType==='year'?'active':''} onClick={()=>setPeriodType('year')}>년별 정산</button>
        <button className={periodType==='custom'?'active':''} onClick={()=>setPeriodType('custom')}>날짜 직접 선택</button>
      </div>
      {periodType==='month'&&<input className="native-date-input" type="month" value={month} onChange={e=>setMonth(e.target.value)}/>} 
      {periodType==='day'&&<input type="date" value={day} min={`${month}-01`} onChange={e=>{setDay(e.target.value);setMonth(e.target.value.slice(0,7))}}/>}
      {periodType==='week'&&<input type="date" value={weekStart} onChange={e=>{setWeekStart(e.target.value);setMonth(e.target.value.slice(0,7))}}/>}
      {periodType==='year'&&<input type="number" className="native-date-input" value={year} min={2020} max={2099} onChange={e=>setYear(e.target.value)}/>}
      {periodType==='custom'&&<DateRangePicker value={customRange} onChange={setCustomRange}/>} 
    </div>
    <div className="footnote">기준 기간: {periodLabel}</div>
    <div className="ops-toolbar">
      <div className="ops-search"><Search size={17}/><input value={advertiserQuery} onChange={e=>setAdvertiserQuery(e.target.value)} placeholder="광고주 이름으로 검색"/></div>
      <div className="ops-search"><Search size={17}/><input value={ownerQuery} onChange={e=>setOwnerQuery(e.target.value)} placeholder="담당자 이름으로 검색"/></div>
      <button className="btn secondary" onClick={downloadCsv}><Download size={15}/> 정산표 다운로드</button>
    </div>
  </section>
  <div className="ops-stat-grid"><Stat label="매출" value={`₩${Math.round(totalSales).toLocaleString()}`}/><Stat label="광고비" value={`₩${Math.round(totalSpend).toLocaleString()}`}/><Stat label="정산 대상" value={`${filtered.length}건`}/><Stat label="총 수당·수수료" value={`₩${Math.round(totalFee).toLocaleString()}`}/></div>

  <section className="card ops-card allowance-rule-card">
    <div className="ops-card-head"><div><h3>수당 책정 기준</h3><p>매체별 수당과 기타 수당이 각각 어떤 조건과 금액으로 책정되는지 관리합니다.</p></div><button className="btn primary" onClick={()=>openNewRule(ruleCategory)}><Plus size={15}/> {ruleCategory} 추가</button></div>
    <div className="period-type-toggle" style={{marginBottom:12}}><button className={ruleCategory==='매체별 수당'?'active':''} onClick={()=>setRuleCategory('매체별 수당')}>매체별 수당</button><button className={ruleCategory==='기타 수당'?'active':''} onClick={()=>setRuleCategory('기타 수당')}>기타 수당</button></div>
    <div className="table-scroll"><table className="ops-table"><thead><tr><th>수당명</th><th>{ruleCategory==='매체별 수당'?'매체':'구분'}</th><th>책정 방식</th><th>금액/비율</th><th>적용 조건</th><th>설명</th><th></th></tr></thead><tbody>{allowanceRules.filter(r=>r.category===ruleCategory).map(rule=><tr key={rule.id}><td><b>{rule.name}</b></td><td>{rule.platform}</td><td>{rule.method}</td><td>{rule.method==='정률'?`${rule.value}%`:`₩${rule.value.toLocaleString()}`}</td><td>{rule.condition}</td><td>{rule.memo}</td><td><div className="inline-actions"><button className="icon-btn" onClick={()=>setRuleForm({...rule})}><PencilLine size={15}/></button><button className="icon-btn danger" onClick={()=>{if(window.confirm('이 수당 기준을 삭제할까요?'))persistRules(allowanceRules.filter(r=>r.id!==rule.id))}}><Trash2 size={15}/></button></div></td></tr>)}{allowanceRules.filter(r=>r.category===ruleCategory).length===0&&<tr><td colSpan={7} className="muted">등록된 수당 기준이 없습니다.</td></tr>}</tbody></table></div>
  </section>
  {ruleForm&&<div className="modal-backdrop" onClick={()=>setRuleForm(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>{allowanceRules.some(r=>r.id===ruleForm.id)?'수당 기준 수정':'수당 기준 추가'}</h3><p>{ruleForm.category}의 책정 조건을 입력하세요.</p></div><button className="icon-btn" onClick={()=>setRuleForm(null)}><X size={18}/></button></div><div className="form-grid"><label className="field-label">수당명<input value={ruleForm.name} onChange={e=>setRuleForm({...ruleForm,name:e.target.value})}/></label><label className="field-label">{ruleForm.category==='기타 수당'?'구분':'매체'}<input value={ruleForm.platform} onChange={e=>setRuleForm({...ruleForm,platform:e.target.value})} placeholder={ruleForm.category==='기타 수당'?'예: 신규 광고주 세팅, 콘텐츠 제작':undefined}/></label><label className="field-label">책정 방식<select value={ruleForm.method} onChange={e=>setRuleForm({...ruleForm,method:e.target.value as '정률'|'정액'})}><option>정액</option><option>정률</option></select></label><label className="field-label">{ruleForm.method==='정률'?'비율(%)':'금액(원)'}<input type="number" value={ruleForm.value} onChange={e=>setRuleForm({...ruleForm,value:Number(e.target.value)})}/></label></div><label className="field-label">적용 조건<input value={ruleForm.condition} onChange={e=>setRuleForm({...ruleForm,condition:e.target.value})} placeholder="예: 월 정상 운영, 매출 발생 시"/></label><label className="field-label">설명<input value={ruleForm.memo} onChange={e=>setRuleForm({...ruleForm,memo:e.target.value})}/></label><div className="modal-actions"><button className="btn secondary" onClick={()=>setRuleForm(null)}>취소</button><button className="btn primary" onClick={saveRule}><Save size={15}/> 저장</button></div></div></div>}
  {showForm&&<section ref={formSectionRef} className="card ops-card commission-form-card"><div className="ops-card-head"><div><h3>{editingId?'정산 항목 수정':'정산 항목 추가'}</h3><p>등록 후에도 표에서 수정·삭제할 수 있습니다.</p></div><button className="icon-btn" onClick={()=>setShowForm(false)}><X size={18}/></button></div><div className="form-grid"><label className="field-label">정산일<input type="date" value={form.date} onChange={e=>update('date',e.target.value)}/></label><label className="field-label">광고주<input value={form.advertiser} onChange={e=>update('advertiser',e.target.value)} placeholder="광고주명"/></label><label className="field-label">매체<select value={form.platform} onChange={e=>update('platform',e.target.value)}>{platformSelectOptions.map(p=><option key={p}>{p}</option>)}</select></label><label className="field-label">담당자<input value={form.owner} onChange={e=>update('owner',e.target.value)} placeholder="담당자명"/></label><label className="field-label">매출<input type="number" value={form.sales} onChange={e=>update('sales',e.target.value)}/></label><label className="field-label">광고비<input type="number" value={form.adSpend} onChange={e=>update('adSpend',e.target.value)}/></label><label className="field-label">수수료율 %<input type="number" value={form.rate} onChange={e=>update('rate',e.target.value)}/></label><label className="field-label">고정 수당<input type="number" value={form.fixedBonus} onChange={e=>update('fixedBonus',e.target.value)}/></label></div><label className="field-label">메모<input value={form.memo} onChange={e=>update('memo',e.target.value)} placeholder="정산 메모"/></label><div className="modal-actions"><button className="btn secondary" onClick={()=>setShowForm(false)}>취소</button><button className="btn primary" onClick={save}><Save size={15}/> {editingId?'수정 저장':'등록'}</button></div></section>}
  <div className="commission-summary-columns">
    <section className="card ops-card"><div className="ops-card-head"><h3>광고주별 정산</h3></div><div className="mini-settlement-list">{groupedByAdvertiser.map(item=><div key={item.name}><b>{item.name}</b><span>{item.count}건 · 매출 ₩{Math.round(item.sales).toLocaleString()} · 정산 ₩{Math.round(item.fee).toLocaleString()}</span></div>)}{groupedByAdvertiser.length===0&&<p className="muted">광고주별 정산 내역이 없습니다.</p>}</div></section>
    <section className="card ops-card"><div className="ops-card-head"><h3>담당자별 정산</h3></div><div className="mini-settlement-list">{groupedByOwner.map(item=><div key={item.name}><b>{item.name||'미지정'}</b><span>{item.count}건 · 광고비 ₩{Math.round(item.spend).toLocaleString()} · 정산 ₩{Math.round(item.fee).toLocaleString()}</span></div>)}{groupedByOwner.length===0&&<p className="muted">담당자별 정산 내역이 없습니다.</p>}</div></section>
  </div>
  <section className="card ops-card"><div className="ops-card-head"><div><h3>정산 상세 내역</h3><p>등록한 수당 내역을 표에서 바로 수정하거나 삭제할 수 있습니다.</p></div></div><div className="table-scroll"><table className="ops-table"><thead><tr><th>정산일</th><th>광고주</th><th>매체</th><th>담당자</th><th>매출</th><th>광고비</th><th>수수료율</th><th>영업수수료</th><th>고정 수당</th><th>정산액</th><th>메모</th><th></th></tr></thead><tbody>{filtered.map(row=>{const variable=Math.round(row.sales*row.rate/100), total=variable+row.fixedBonus; return <tr key={row.id}><td>{row.date}</td><td><b>{row.advertiser}</b></td><td>{row.platform}</td><td>{row.owner}</td><td>₩{row.sales.toLocaleString()}</td><td>₩{row.adSpend.toLocaleString()}</td><td>{row.rate}%</td><td>₩{variable.toLocaleString()}</td><td>₩{row.fixedBonus.toLocaleString()}</td><td><b>₩{total.toLocaleString()}</b></td><td>{row.memo}</td><td><div className="inline-actions"><button className="icon-btn" onClick={()=>openEdit(row)}><PencilLine size={15}/></button><button className="icon-btn danger" onClick={()=>remove(row.id)}><Trash2 size={15}/></button></div></td></tr>})}{filtered.length===0&&<tr><td colSpan={12} className="muted">조건에 맞는 정산 내역이 없습니다.</td></tr>}</tbody></table></div></section>
 </>
}

type GoogleCreativeRow = {id:string;name:string;campaign:string;thumb:string;spend:number;impressions:number;clicks:number;status:'라이브'|'캠페인 중지';days:number;health:number;trend:number[]};
const googleCreativeRows:GoogleCreativeRow[]=[];

export function GoogleCreativeReportPage(){
 const [period,setPeriod]=useState('7일'); const [query,setQuery]=useState(''); const [rows,setRows]=useState(googleCreativeRows); const [detail,setDetail]=useState<GoogleCreativeRow|null>(null);
 const { filterValue } = useAdvertiserFilter();
 const periods=['오늘','어제','7일','14일','30일','60일','90일']; const won=(n:number)=>`₩${Math.round(n).toLocaleString()}`;
 const filtered=rows.filter(r=>r.name.toLowerCase().includes(query.toLowerCase())&&matchesAdvertiserFilter(`${r.name} ${r.campaign}`,filterValue));
 const toggle=(id:string)=>setRows(rows.map(r=>r.id===id?{...r,status:r.status==='라이브'?'캠페인 중지':'라이브',days:r.status==='라이브'?0:1}:r));
 return <>
  <PageHeader title="구글 소재 보고서" description="유튜브(Demand Gen) 광고별 성과, 썸네일, 라이브 상태, 건전성과 기간별 추이를 관리합니다." action={<a className="btn secondary" href="https://ads.google.com/aw/overview" target="_blank" rel="noreferrer">Google Ads <ExternalLink size={14}/></a>}/>
  {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경) · 소재명·캠페인명 기준 매칭</div>}
  <section className="card media-report-card">
   <div className="media-report-toolbar"><div><b>유튜브 광고 {filtered.length}개</b><span> · 썸네일 클릭 시 상세 열기</span></div><div className="media-report-actions">{periods.map(p=><button key={p} className={`tiny-filter ${period===p?'active':''}`} onClick={()=>setPeriod(p)}>{p}</button>)}<div className="inline-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="소재 검색"/></div></div></div>
   <div className="table-scroll"><table className="media-report-table creative-report-table"><thead><tr><th>소재 (유튜브)</th><th>상태 / 라이브</th><th>건전성</th><th>소진</th><th>노출</th><th>CPM</th><th>클릭</th><th>CTR</th><th>CPC</th><th>전환</th><th>전환율</th><th>전환매출</th><th>CPA</th><th>ROAS</th><th>추이</th></tr></thead><tbody>{filtered.length===0?<tr><td colSpan={15} style={{textAlign:'center',padding:'24px',color:'#9ca3af'}}>해당 광고주의 소재가 없습니다.</td></tr>:filtered.map(r=>{const cpm=r.impressions?r.spend/r.impressions*1000:0,ctr=r.impressions?r.clicks/r.impressions*100:0,cpc=r.clicks?r.spend/r.clicks:0;return <tr key={r.id}><td><button className="creative-name-cell" onClick={()=>setDetail(r)}><span className="creative-thumb video" style={{background:r.thumb}}/><span><b>› {r.name} ↗</b><small>{r.campaign}</small></span></button></td><td><div className="status-action-cell"><span className={`live-pill ${r.status!=='라이브'?'paused':''}`}>{r.status==='라이브'?'● 라이브 D+'+r.days:'Ⅱ 캠페인 중지'}</span><button className="mini-danger" onClick={()=>toggle(r.id)}>{r.status==='라이브'?'끄기':'켜기'}</button></div><small>{r.status==='라이브'?'2026-06-19 시작':'이 기간 소진 없음'}</small></td><td>{r.status==='라이브'?<><span className="health-pill">● 건강 {r.health}</span><small className="health-trend">CPM ▼8% · CTR ▼4% · CPC ▼4%</small></>:<small>데이터 부족</small>}</td><td>{won(r.spend)}</td><td>{r.impressions.toLocaleString()}</td><td>{won(cpm)}</td><td>{r.clicks.toLocaleString()}</td><td>{ctr.toFixed(2)}%</td><td>{won(cpc)}</td><td>0</td><td>0.00%</td><td>-</td><td>-</td><td>-</td><td><div className="mini-bars orange">{r.trend.map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div></td></tr>})}</tbody></table></div>
   <div className="footnote">끄기/켜기는 실제 구글 API 연동 시 반영됩니다. 현재는 데모 상태 변경으로 동작합니다.</div>
  </section>
  {detail&&<div className="modal-backdrop" onClick={()=>setDetail(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>{detail.name}</h3><p>{detail.campaign}</p></div><button className="icon-btn" onClick={()=>setDetail(null)}><X size={18}/></button></div><div className="creative-detail-preview video" style={{background:detail.thumb}}/><div className="detail-kpi-grid"><div><span>광고비</span><b>{won(detail.spend)}</b></div><div><span>노출</span><b>{detail.impressions.toLocaleString()}</b></div><div><span>클릭</span><b>{detail.clicks}</b></div><div><span>상태</span><b>{detail.status}</b></div></div><div className="modal-actions"><button className="btn secondary" onClick={()=>toggle(detail.id)}>{detail.status==='라이브'?<Pause size={14}/>:<Play size={14}/>} {detail.status==='라이브'?'끄기':'켜기'}</button><button className="btn primary" onClick={()=>setDetail(null)}>확인</button></div></div></div>}
 </>
}

type AdScheduleItem={id:number;brand:string;channel:string;campaign:string;kind:string;date:string;time:string;action:'ON'|'OFF';status:'예정'|'완료'|'실패';enabled:boolean};
const initialScheduleItems:AdScheduleItem[]=[];
export function AdSchedulePage(){
 const [items,setItems]=useState<AdScheduleItem[]>(()=>JSON.parse(localStorage.getItem('acc_ad_schedule')||'null')||initialScheduleItems);
 const [selectedIds,setSelectedIds]=useState<number[]>([]); const [showModal,setShowModal]=useState(false); const [editing,setEditing]=useState<AdScheduleItem|null>(null); const [query,setQuery]=useState(''); const [tab,setTab]=useState<'list'|'calendar'>('list');
 const { filterValue } = useAdvertiserFilter();
 const persist=(next:AdScheduleItem[])=>{setItems(next);localStorage.setItem('acc_ad_schedule',JSON.stringify(next));};
 const filtered=items.filter(x=>(x.brand+x.campaign+x.channel).toLowerCase().includes(query.toLowerCase())&&matchesAdvertiserFilter(x.brand,filterValue));
 const toggle=(id:number)=>setSelectedIds(selectedIds.includes(id)?selectedIds.filter(x=>x!==id):[...selectedIds,id]);
 const bulk=(action:'ON'|'OFF')=>{persist(items.map(x=>selectedIds.includes(x.id)?{...x,action,status:'예정'}:x));setSelectedIds([]);alert(`선택한 광고 ${selectedIds.length}건을 ${action} 예약으로 변경했습니다.`)};
 return <><PageHeader title="광고 ON OFF 스케줄" description="광고주별 캠페인·광고의 ON/OFF 예약을 등록하고 일괄 변경 및 실행 이력을 관리합니다." action={<button className="btn primary" onClick={()=>{setEditing(null);setShowModal(true)}}><Plus size={15}/> 스케줄 추가</button>}/>
 {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
 <div className="schedule-toolbar"><div className="schedule-tabs"><button className={tab==='list'?'active':''} onClick={()=>setTab('list')}>목록 보기</button><button className={tab==='calendar'?'active':''} onClick={()=>setTab('calendar')}>캘린더 보기</button></div><div className="ops-search compact"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="광고주·캠페인 검색"/></div><div className="action-row"><button className="btn secondary" disabled={!selectedIds.length} onClick={()=>bulk('ON')}>선택 ON</button><button className="btn secondary" disabled={!selectedIds.length} onClick={()=>bulk('OFF')}>선택 OFF</button></div></div>
 {tab==='list'?<section className="card ops-card"><div className="schedule-summary"><span>전체 <b>{items.length}</b></span><span>예정 <b>{items.filter(x=>x.status==='예정').length}</b></span><span>완료 <b>{items.filter(x=>x.status==='완료').length}</b></span><span>실패 <b>{items.filter(x=>x.status==='실패').length}</b></span></div><div className="table-scroll"><table className="ops-table schedule-table"><thead><tr><th><input type="checkbox" checked={selectedIds.length===filtered.length&&filtered.length>0} onChange={e=>setSelectedIds(e.target.checked?filtered.map(x=>x.id):[])}/></th><th>광고주</th><th>매체</th><th>캠페인 / 광고</th><th>대상</th><th>실행일</th><th>시간</th><th>동작</th><th>상태</th><th>활성</th><th></th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={()=>toggle(item.id)}/></td><td><b>{item.brand}</b></td><td><span className={`platform-pill ${item.channel.toLowerCase()}`}>{item.channel}</span></td><td>{item.campaign}</td><td>{item.kind}</td><td>{item.date}</td><td>{item.time}</td><td><span className={`status-pill ${item.action==='ON'?'success':'danger'}`}>{item.action}</span></td><td><span className={`status-pill ${item.status==='완료'?'success':item.status==='실패'?'danger':'warning'}`}>{item.status}</span></td><td><button className={'toggle '+(item.enabled?'on':'')} onClick={()=>persist(items.map(x=>x.id===item.id?{...x,enabled:!x.enabled}:x))}><span/></button></td><td><div className="inline-actions"><button className="icon-btn" onClick={()=>{setEditing(item);setShowModal(true)}}><PencilLine size={15}/></button><button className="icon-btn danger" onClick={()=>confirm('스케줄을 삭제할까요?')&&persist(items.filter(x=>x.id!==item.id))}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div></section>:<ScheduleCalendar items={filtered} onSelect={(item)=>{setEditing(item);setShowModal(true)}}/>}
 {showModal&&<ScheduleModal initial={editing} onClose={()=>setShowModal(false)} onSave={(item)=>{persist(items.some(x=>x.id===item.id)?items.map(x=>x.id===item.id?item:x):[item,...items]);setShowModal(false)}}/>}</>
}
function ScheduleCalendar({items,onSelect}:{items:AdScheduleItem[];onSelect:(item:AdScheduleItem)=>void}){const days=Array.from({length:31},(_,i)=>i+1);return <section className="card ops-card"><div className="calendar-head"><button>‹</button><b>2026년 7월</b><button>›</button></div><div className="mini-calendar-grid">{['일','월','화','수','목','금','토'].map(x=><strong key={x}>{x}</strong>)}{days.map(day=><div className="calendar-cell" key={day}><span>{day}</span>{items.filter(x=>Number(x.date.slice(-2))===day).map(x=><button key={x.id} className={x.action==='ON'?'calendar-event on':'calendar-event off'} onClick={()=>onSelect(x)}>{x.time} {x.channel} {x.action}</button>)}</div>)}</div></section>}
function ScheduleModal({initial,onClose,onSave}:{initial:AdScheduleItem|null;onClose:()=>void;onSave:(item:AdScheduleItem)=>void}){const [form,setForm]=useState<AdScheduleItem>(initial||{id:Date.now(),brand:'',channel:'Meta',campaign:'',kind:'캠페인',date:new Date().toISOString().slice(0,10),time:'09:00',action:'ON',status:'예정',enabled:true});const update=(k:keyof AdScheduleItem,v:any)=>setForm({...form,[k]:v});return <div className="modal-backdrop"><div className="modal-card wide"><div className="modal-head"><div><h3>{initial?'스케줄 수정':'새 스케줄 등록'}</h3><p>광고주와 매체, 대상 광고, 실행일시를 설정합니다.</p></div><button className="icon-btn" onClick={onClose}><X/></button></div><div className="form-grid"><label className="field-label">광고주<select value={form.brand} onChange={e=>update('brand',e.target.value)}><option value="">광고주 선택</option>{advertisers.map(a=><option key={a}>{a}</option>)}</select></label><label className="field-label">매체<select value={form.channel} onChange={e=>update('channel',e.target.value)}><option>Meta</option><option>네이버</option><option>Google</option><option>카카오</option></select></label><label className="field-label">대상<select value={form.kind} onChange={e=>update('kind',e.target.value)}><option>캠페인</option><option>광고세트</option><option>광고</option></select></label><label className="field-label">동작<select value={form.action} onChange={e=>update('action',e.target.value as 'ON'|'OFF')}><option>ON</option><option>OFF</option></select></label><label className="field-label">실행일<input type="date" value={form.date} onChange={e=>update('date',e.target.value)}/></label><label className="field-label">시간<input type="time" value={form.time} onChange={e=>update('time',e.target.value)}/></label></div><label className="field-label">캠페인 또는 광고명<input value={form.campaign} onChange={e=>update('campaign',e.target.value)} placeholder="실행할 대상을 입력"/></label><div className="modal-actions"><button className="btn secondary" onClick={onClose}>취소</button><button className="btn primary" onClick={()=>form.campaign&&onSave(form)}><Save size={15}/> 저장</button></div></div></div>}

type AttributionLinkItem = {
  id: number;
  name: string;
  url: string;
  platform: string;
  campaign: string;
  memo: string;
  source: string;
  medium: string;
  content: string;
  term: string;
  clicks: number;
  conversions: number;
  createdAt: string;
};

const initialAttributionLinks: AttributionLinkItem[] = [];

function buildAttributionUrl(item: Omit<AttributionLinkItem,'id'|'clicks'|'conversions'|'createdAt'>) {
  const params = new URLSearchParams();
  if (item.source) params.set('utm_source', item.source);
  if (item.medium) params.set('utm_medium', item.medium);
  if (item.campaign) params.set('utm_campaign', item.campaign);
  if (item.content) params.set('utm_content', item.content);
  if (item.term) params.set('utm_term', item.term);
  return `${item.url}${item.url.includes('?')?'&':'?'}${params.toString()}`;
}

export function AttributionLinksPage(){
 const [links,setLinks]=useState<AttributionLinkItem[]>(()=>JSON.parse(localStorage.getItem('acc_attribution_links')||'null')||initialAttributionLinks);
 const [form,setForm]=useState({name:'',url:'',platform:'Meta',campaign:'',memo:'',source:'facebook',medium:'cpc',content:'',term:''});
 const [activeTab,setActiveTab]=useState<'create'|'list'>('list');
 const [detail,setDetail]=useState<AttributionLinkItem|null>(null);
 const [toast,setToast]=useState('');
 const persist=(next:AttributionLinkItem[])=>{setLinks(next);localStorage.setItem('acc_attribution_links',JSON.stringify(next));};
 const copyLink=async(url:string)=>{
   try{
     if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url)}
     else{const textarea=document.createElement('textarea');textarea.value=url;textarea.style.position='fixed';textarea.style.opacity='0';document.body.appendChild(textarea);textarea.select();document.execCommand('copy');textarea.remove()}
     setToast('URL을 클립보드에 복사했습니다.');setTimeout(()=>setToast(''),2200);
   }catch{setToast('URL 복사에 실패했습니다. 주소를 직접 선택해 복사해주세요.');setTimeout(()=>setToast(''),2600)}
 };
 const createLink=()=>{
   if(!form.name.trim()||!form.url.trim()||!form.source.trim()||!form.medium.trim()||!form.campaign.trim()) return alert('필수 항목을 입력하세요.');
   const item:AttributionLinkItem={...form,id:Date.now(),clicks:0,conversions:0,createdAt:new Date().toLocaleString('ko-KR')};
   persist([item,...links]); setForm({name:'',url:'',platform:'Meta',campaign:'',memo:'',source:'facebook',medium:'cpc',content:'',term:''}); setActiveTab('list'); setToast('새 어트리뷰션 링크를 생성했습니다.'); setTimeout(()=>setToast(''),2200);
 };
 const downloadCsv=()=>{
   const rows=[['링크명','매체','캠페인','추적 URL','클릭','전환','생성일'],...links.map(l=>[l.name,l.platform,l.campaign,buildAttributionUrl(l),l.clicks,l.conversions,l.createdAt])];
   const blob=new Blob([rows.map(r=>r.map(v=>`\"${String(v).replace(/\"/g,'\"\"')}\"`).join(',')).join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='attribution-links.csv'; a.click(); URL.revokeObjectURL(a.href);
 };
 return <>
  <PageHeader title="어트리뷰션 링크" description="광고 콘텐츠별 성과 추적을 위한 UTM 링크를 생성하고 관리합니다." action={<div className="action-row"><button className="btn secondary" onClick={downloadCsv}><Download size={15}/> 링크 다운로드(CSV)</button><button className="btn primary" onClick={()=>setActiveTab('create')}><Plus size={15}/> 새 링크 만들기</button></div>}/>
  <div className="section-tabs compact-tabs"><button className={activeTab==='create'?'active':''} onClick={()=>setActiveTab('create')}>새 링크 만들기</button><button className={activeTab==='list'?'active':''} onClick={()=>setActiveTab('list')}>생성된 링크 <span>{links.length}</span></button></div>
  {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}
  {activeTab==='create'?<section className="card ops-card attribution-create-card"><h3>새 링크 만들기</h3><div className="form-grid three-col"><label className="field-label">링크명 *<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="예: 7월 수영장 릴스"/></label><label className="field-label span-2">원본 랜딩 URL *<input value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://..."/></label><label className="field-label">매체<select value={form.platform} onChange={e=>{const platform=e.target.value; const source=platform==='Meta'?'facebook':platform==='네이버'?'naver':platform==='Google'?'google':platform.toLowerCase();setForm({...form,platform,source})}}><option>Meta</option><option>네이버</option><option>Google</option><option>카카오</option><option>당근</option><option>TikTok</option></select></label><label className="field-label">캠페인명(관리용)<input value={form.campaign} onChange={e=>setForm({...form,campaign:e.target.value})}/></label><label className="field-label">메모<input value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})}/></label><label className="field-label">utm_source *<input value={form.source} onChange={e=>setForm({...form,source:e.target.value})}/></label><label className="field-label">utm_medium *<input value={form.medium} onChange={e=>setForm({...form,medium:e.target.value})}/></label><label className="field-label">utm_campaign *<input value={form.campaign} onChange={e=>setForm({...form,campaign:e.target.value})} placeholder="예: pool_july"/></label><label className="field-label">utm_content<input value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder="예: reels_v1"/></label><label className="field-label">utm_term<input value={form.term} onChange={e=>setForm({...form,term:e.target.value})}/></label></div><div className="tracking-preview"><span>생성될 URL</span><code>{form.url?buildAttributionUrl({...form}):'필수 항목을 입력하면 추적 URL이 미리보기로 표시됩니다.'}</code></div><div className="action-row left"><button className="btn primary" onClick={createLink}>생성하기</button><button className="btn secondary" onClick={()=>setForm({name:'',url:'',platform:'Meta',campaign:'',memo:'',source:'facebook',medium:'cpc',content:'',term:''})}>취소</button></div></section>:<section className="card ops-card attribution-list-card"><div className="ops-card-head"><div><h3>생성된 링크</h3><p>클릭·전환 성과와 추적 URL을 확인합니다.</p></div></div>{links.length===0?<div className="empty-state large"><Link2 size={42}/><b>아직 생성된 링크가 없습니다.</b><span>새 링크 만들기로 첫 추적 링크를 생성하세요.</span></div>:<div className="table-scroll"><table className="ops-table"><thead><tr><th>링크명</th><th>매체</th><th>캠페인</th><th>추적 URL</th><th>클릭</th><th>전환</th><th>전환율</th><th>관리</th></tr></thead><tbody>{links.map(l=><tr key={l.id}><td><b>{l.name}</b><small className="cell-sub">{l.createdAt}</small></td><td><span className="platform-pill">{l.platform}</span></td><td>{l.campaign}</td><td><code className="truncate-code">{buildAttributionUrl(l)}</code></td><td>{l.clicks.toLocaleString()}</td><td>{l.conversions}</td><td>{l.clicks?(l.conversions/l.clicks*100).toFixed(2):'0.00'}%</td><td><div className="inline-actions"><button className="btn secondary mini" onClick={()=>copyLink(buildAttributionUrl(l))}><Copy size={13}/> 복사</button><button className="icon-btn" onClick={()=>setDetail(l)}><Eye size={15}/></button><button className="icon-btn danger" onClick={()=>confirm('링크를 삭제할까요?')&&persist(links.filter(x=>x.id!==l.id))}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>}</section>}
  {detail&&<div className="modal-backdrop" onClick={()=>setDetail(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>{detail.name}</h3><p>{detail.platform} · {detail.campaign}</p></div><button className="icon-btn" onClick={()=>setDetail(null)}><X size={18}/></button></div><div className="detail-kpi-grid"><div><span>클릭</span><b>{detail.clicks.toLocaleString()}</b></div><div><span>전환</span><b>{detail.conversions}</b></div><div><span>전환율</span><b>{detail.clicks?(detail.conversions/detail.clicks*100).toFixed(2):'0.00'}%</b></div><div><span>생성일</span><b>{detail.createdAt}</b></div></div><div className="tracking-preview"><span>추적 URL</span><code>{buildAttributionUrl(detail)}</code></div><div className="modal-actions"><button className="btn secondary" onClick={()=>copyLink(buildAttributionUrl(detail))}><Copy size={14}/> 링크 복사</button><button className="btn primary" onClick={()=>setDetail(null)}>확인</button></div></div></div>}
 </>
}

type UploadedDataItem={id:number;brand:string;source:string;period:string;days:number;reservations:number;conversions:number;revenue:number;uploadedAt:string;status:'완료'|'오류'};
const initialUploadedData:UploadedDataItem[]=[];

function parseCsvPreview(csv:string){
 const lines=csv.trim().split(/\r?\n/).filter(Boolean); if(lines.length<2) return {rows:0,reservations:0,conversions:0,revenue:0};
 const headers=lines[0].split(',').map(x=>x.trim().toLowerCase()); const idx=(keys:string[])=>headers.findIndex(h=>keys.includes(h));
 const rIdx=idx(['reservations','reservation','예약']); const cIdx=idx(['conversions','conversion','전환']); const revIdx=idx(['revenue','sales','매출']);
 let reservations=0,conversions=0,revenue=0; lines.slice(1).forEach(line=>{const cols=line.split(',');reservations+=Number(cols[rIdx]||0);conversions+=Number(cols[cIdx]||0);revenue+=Number(cols[revIdx]||0)});
 return {rows:lines.length-1,reservations,conversions,revenue};
}

export function CustomDataUploadPage(){
 const [brand,setBrand]=useState(''); const [channel,setChannel]=useState('직접입력 (기타)'); const [label,setLabel]=useState(''); const [csv,setCsv]=useState('');
 const [items,setItems]=useState<UploadedDataItem[]>(()=>JSON.parse(localStorage.getItem('acc_custom_uploads')||'null')||initialUploadedData); const [preview,setPreview]=useState<ReturnType<typeof parseCsvPreview>|null>(null); const [toast,setToast]=useState('');
 const { filterValue } = useAdvertiserFilter();
 const visibleItems = filterByAdvertiser(items, filterValue, i => i.brand);
 const persist=(next:UploadedDataItem[])=>{setItems(next);localStorage.setItem('acc_custom_uploads',JSON.stringify(next));};
 const fileInput=(file:File|null)=>{if(!file)return; const reader=new FileReader(); reader.onload=()=>setCsv(String(reader.result||'')); reader.readAsText(file)};
 const save=()=>{const p=parseCsvPreview(csv); if(!p.rows)return alert('CSV 데이터를 확인하세요.'); const item:UploadedDataItem={id:Date.now(),brand,source:label||channel,period:'업로드 기준',days:p.rows,reservations:p.reservations,conversions:p.conversions,revenue:p.revenue,uploadedAt:new Date().toLocaleString('ko-KR'),status:'완료'}; persist([item,...items]); setPreview(p); setToast(`${p.rows}개 행을 저장했습니다.`);setTimeout(()=>setToast(''),2200)};
 return <>
  <PageHeader title="커스텀 데이터 업로드" description="매체 API로 얻기 어려운 실적을 CSV로 올려 KPI·대시보드·보고서에 반영합니다."/>
  {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
  <section className="card sync-banner"><div><h3>외부 데이터 연동</h3><p>연결된 외부 데이터가 없습니다. 실제 연동을 설정하면 수집 상태가 여기에 표시됩니다.</p></div></section>
  {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}
  <section className="card ops-card custom-upload-panel"><h3>새 데이터 업로드</h3><div className="form-grid three-col"><label className="field-label">브랜드<select value={brand} onChange={e=>setBrand(e.target.value)}><option value="">광고주 선택</option>{advertisers.map(a=><option key={a}>{a}</option>)}</select></label><label className="field-label">매체<select value={channel} onChange={e=>setChannel(e.target.value)}><option>직접입력 (기타)</option><option>네이버</option><option>Meta</option><option>Google</option></select></label><label className="field-label">출처 라벨<input value={label} onChange={e=>setLabel(e.target.value)} placeholder="예: 네이버예약"/></label></div><div className="csv-guide"><b>CSV 형식</b><span>첫 행은 헤더, date 컬럼 필수 + reservations, conversions, revenue 등의 영문 또는 한글 헤더를 지원합니다.</span><button className="btn secondary mini" onClick={()=>setCsv('date,reservations,conversions,revenue\n')}>템플릿 넣기</button></div><div className="file-inline-row"><label className="btn secondary">파일 선택<input type="file" accept=".csv" hidden onChange={e=>fileInput(e.target.files?.[0]||null)}/></label><span>또는 아래에 직접 붙여넣기</span></div><textarea className="csv-textarea" value={csv} onChange={e=>setCsv(e.target.value)} rows={7}/><div className="action-row left"><button className="btn secondary" onClick={()=>setPreview(parseCsvPreview(csv))}>미리보기</button><button className="btn primary" onClick={save}>저장(반영)</button></div>{preview&&<div className="upload-preview-grid"><div><span>행 수</span><b>{preview.rows}</b></div><div><span>예약</span><b>{preview.reservations}</b></div><div><span>전환</span><b>{preview.conversions}</b></div><div><span>매출</span><b>₩{preview.revenue.toLocaleString()}</b></div></div>}</section>
  <section className="card ops-card"><div className="ops-card-head"><div><h3>업로드된 데이터 ({visibleItems.length})</h3><p>업로드 즉시 KPI 목표·달성, 대시보드, 보고서에 반영됩니다.</p></div></div><div className="table-scroll"><table className="ops-table"><thead><tr><th>브랜드 · 출처</th><th>기간</th><th>일수</th><th>예약</th><th>전환</th><th>매출</th><th>업로드 시각</th><th></th></tr></thead><tbody>{visibleItems.map(item=><tr key={item.id}><td><b>{item.brand} · {item.source}</b></td><td>{item.period}</td><td>{item.days}</td><td>{item.reservations}</td><td>{item.conversions}</td><td>₩{item.revenue.toLocaleString()}</td><td>{item.uploadedAt}</td><td><button className="icon-btn danger" onClick={()=>confirm('업로드 데이터를 삭제할까요?')&&persist(items.filter(x=>x.id!==item.id))}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div></section>
 </>
}

type ProjectTask={id:number;title:string;brand:string;owner:string;campaign:string;priority:'높음'|'보통'|'낮음';due:string;description:string;status:'대기'|'진행중'|'검토'|'완료'};
const initialProjectTasks:ProjectTask[]=[];

export function ProjectTasksPage(){
 const [tasks,setTasks]=useState<ProjectTask[]>(()=>{try{return JSON.parse(localStorage.getItem('acc_project_tasks_v2')||'null')||initialProjectTasks}catch{return initialProjectTasks}});
 const [formOpen,setFormOpen]=useState(false); const [toast,setToast]=useState('');
 const { filterValue } = useAdvertiserFilter();
 const visibleTasks = filterByAdvertiser(tasks, filterValue, t => t.brand);
 const persist=(next:ProjectTask[])=>{setTasks(next);localStorage.setItem('acc_project_tasks_v2',JSON.stringify(next))};
 const add=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const task:ProjectTask={id:Date.now(),title:String(f.get('title')),brand:String(f.get('brand')),owner:String(f.get('owner')),campaign:String(f.get('campaign')||''),priority:String(f.get('priority')) as ProjectTask['priority'],due:String(f.get('due')),description:String(f.get('description')||''),status:'대기'};persist([task,...tasks]);e.currentTarget.reset();setToast('새 작업을 저장했습니다.');setTimeout(()=>setToast(''),2200)};
 const statuses:ProjectTask['status'][]=['대기','진행중','검토','완료'];
 const move=(task:ProjectTask,dir:number)=>{const idx=statuses.indexOf(task.status);const next=statuses[Math.max(0,Math.min(statuses.length-1,idx+dir))];persist(tasks.map(x=>x.id===task.id?{...x,status:next}:x))};
 return <>
  <PageHeader title="프로젝트" description="광고 운영 업무를 태스크로 관리 — 대기 → 진행중 → 검토 → 완료 칸반" action={<button className="btn primary" onClick={()=>setFormOpen(!formOpen)}><Plus size={15}/> 새 작업</button>}/>
  <p className="project-auto-note">총 {visibleTasks.length}개 · 자동화 규칙/피로도 감지가 “새 광고 세팅 필요” 태스크를 자동 생성합니다.</p>
  {toast&&<div className="save-toast"><CheckCircle2 size={16}/>{toast}</div>}
  {formOpen&&<section className="card ops-card project-create-panel"><h3>새 작업</h3><form onSubmit={add}><div className="form-grid"><label className="field-label">제목 *<input name="title" required/></label><label className="field-label">담당자<input name="owner" required/></label><label className="field-label">브랜드<select name="brand"><option value="">광고주 선택</option>{advertisers.map(a=><option key={a}>{a}</option>)}</select></label><label className="field-label">관련 캠페인/소재<input name="campaign"/></label><label className="field-label">우선순위<select name="priority"><option>보통</option><option>높음</option><option>낮음</option></select></label><label className="field-label">마감일<input name="due" type="date" required/></label></div><label className="field-label">설명<textarea name="description" rows={4}/></label><div className="action-row left"><button className="btn primary" type="submit"><Save size={15}/> 저장</button><button className="btn secondary" type="button" onClick={()=>setFormOpen(false)}>취소</button></div></form></section>}
  <div className="project-kanban">{statuses.map(status=><section className="project-column" key={status}><div className="project-column-head"><b>{status==='대기'?'📥':status==='진행중'?'🖊️':status==='검토'?'👀':'✅'} {status}</b><span>{visibleTasks.filter(t=>t.status===status).length}</span></div><div className="project-column-body">{visibleTasks.filter(t=>t.status===status).map(task=><article className="project-task-card" key={task.id}><span className={`priority-badge priority-${task.priority}`}>{task.priority}</span><h4>{task.title}</h4><p>{task.brand} · {task.owner}</p>{task.description&&<small>{task.description}</small>}<div className="task-meta"><span>마감 {task.due}</span><button className="icon-btn danger" onClick={()=>confirm('작업을 삭제할까요?')&&persist(tasks.filter(x=>x.id!==task.id))}><Trash2 size={14}/></button></div><div className="task-move-actions"><button disabled={status==='대기'} onClick={()=>move(task,-1)}>◀</button><button disabled={status==='완료'} onClick={()=>move(task,1)}>▶</button></div></article>)}{visibleTasks.filter(t=>t.status===status).length===0&&<div className="project-empty">비어 있음</div>}</div></section>)}</div>
 </>
}

export function NotificationSendPage(){
 const [token,setToken]=useState(''); const [chatId,setChatId]=useState(''); const [time,setTime]=useState('09:00'); const [enabled,setEnabled]=useState(false); const [toast,setToast]=useState(''); const [preview,setPreview]=useState(false);
 const [lastSentAt,setLastSentAt]=useState('없음');
 const { filterValue } = useAdvertiserFilter();
 const notify=(message:string)=>{setToast(message);setTimeout(()=>setToast(''),3200)};
 const nowStamp=()=>new Date().toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
 return <>
  <PageHeader title="알림 발송" description="매일 아침 성과 요약과 위험 신호를 텔레그램으로 받아봅니다."/>
  <div className="footnote demo-banner">🔔 데모 모드입니다. 아래 버튼을 눌러도 실제 텔레그램으로 메시지가 전송되지는 않고, 화면 안에서만 발송 과정을 확인할 수 있습니다. 실제로 받아보려면 봇 토큰을 실제 값으로 바꾸고 서버에 텔레그램 API 연동이 필요합니다.</div>
  {filterValue&&<div className="footnote" style={{marginBottom:8}}>참고: 텔레그램 브리핑 발송 설정은 계정 전체 기준이며, 상단 광고주 필터(<b>{filterValue}</b>)의 영향을 받지 않습니다.</div>}
  {toast&&<div className="save-toast prominent"><CheckCircle2 size={18}/>{toast}</div>}
  <section className="card ops-card telegram-guide"><h3>처음 설정하기 (3분)</h3><ol><li>휴대폰에 텔레그램 앱 설치 후 가입</li><li>텔레그램 검색창에서 <code>@BotFather</code> 검색 → 대화 시작 → <code>/newbot</code> 입력</li><li>봇 이름과 사용자명을 정하면 토큰이 발급됩니다.</li><li>방금 만든 봇과 대화를 열고 아무 메시지나 전송합니다.</li><li>아래 Chat ID 자동 감지를 눌러 테스트 발송으로 확인합니다.</li></ol></section>
  <section className="card ops-card"><h3>연결 설정</h3><div className="telegram-token-row"><label className="field-label">봇 토큰 (BotFather 발급)<input value={token} onChange={e=>setToken(e.target.value)} placeholder="봇 토큰 입력"/></label><button className="btn primary" onClick={()=>{notify('실제 Telegram API 연결 후 Chat ID 자동 감지를 사용할 수 있습니다.')}}>Chat ID 자동 감지</button></div><div className="telegram-settings-row"><label className="field-label">Chat ID<input value={chatId} onChange={e=>setChatId(e.target.value)}/></label><label className="field-label">매일 발송 시각 (KST)<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><button className="btn success" onClick={()=>{setEnabled(true);notify(`자동 발송을 저장했습니다. 매일 ${time}`)}}>저장 + 자동 발송 켜기</button><button className="btn secondary" onClick={()=>{setEnabled(false);notify('자동 발송을 중지했습니다.')}}>자동 발송 끄기</button></div><p className="telegram-status">상태: <span className={`status-pill ${enabled?'success':'warning'}`}>● {enabled?`자동 발송 켜짐 · 매일 ${time}`:'자동 발송 꺼짐'}</span> 마지막 발송: <b>{lastSentAt}</b></p></section>
  <section className="card ops-card"><h3>테스트</h3><div className="action-row left"><button className="btn primary" onClick={()=>{setLastSentAt(nowStamp()+' (테스트)');notify('테스트 메시지를 발송했습니다.')}}><Send size={15}/> 테스트 발송</button><button className="btn secondary" onClick={()=>{setLastSentAt(nowStamp());notify('현재 브리핑을 발송했습니다.')}}>지금 브리핑 발송</button><button className="btn secondary" onClick={()=>setPreview(true)}>브리핑 미리보기</button></div></section>
  <section className="card ops-card"><h3>성과 데이터 영구 축적</h3><p><span className="status-pill neutral">대기</span> <b>0행</b> 저장됨 · 연결된 성과 데이터 없음</p><small>매 동기화마다 일별 성과를 DB에 저장해 장기 비교가 가능합니다.</small></section>
  {preview&&<div className="modal-backdrop" onClick={()=>setPreview(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>텔레그램 브리핑 미리보기</h3><p>오늘 발송될 메시지 예시입니다.</p></div><button className="icon-btn" onClick={()=>setPreview(false)}>×</button></div><div className="telegram-preview"><b>[HOWTOM 유니버스] 일일 성과 브리핑</b><p>연결된 성과 데이터가 없습니다.</p><p>실제 광고 데이터가 수집되면 브리핑 내용이 여기에 표시됩니다.</p></div><div className="modal-actions"><button className="btn primary" onClick={()=>setPreview(false)}>확인</button></div></div></div>}
 </>
}
