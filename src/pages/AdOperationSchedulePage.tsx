import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, PencilLine, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { BASE_ADVERTISERS, loadExtraAdvertisers } from '../features/reports/reportCore';
import { loadAdvertiserSettings } from '../utils/advertiserSettings';
import { loadCustomPlatforms } from '../utils/metricCatalog';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

export type BudgetAction = '증액' | '감액' | '유지' | '광고 중지';
export type ScheduleStatus = '예정' | '완료' | '실패';
export type RecurrenceType = 'once' | 'weekday' | 'weekend' | 'custom';
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
export type OperationScheduleItem = {
  id: number;
  advertiser: string;
  platform: string;
  campaign: string;
  targetType: '캠페인' | '광고세트' | '광고' | '예약 슬롯';
  date: string;
  time: string;
  onOff: 'ON' | 'OFF';
  budgetAction: BudgetAction;
  currentBudget: number;
  changePercent: number;
  proposedBudget: number;
  status: ScheduleStatus;
  enabled: boolean;
  note: string;
  owner?: string; // 이 스케줄을 담당하는 사람 — 광고주 설정에 등록된 담당자 중에서 고릅니다.
  // 실행일을 하루만이 아니라, 매주 평일/주말 또는 직접 고른 요일마다 반복하도록 설정할 수
  // 있습니다. 'once'면 date 하루만, 그 외에는 매주 해당 요일(들)에 반복 실행됩니다.
  recurrence?: RecurrenceType;
  recurrenceDays?: number[]; // recurrence==='custom'일 때 선택한 요일(0=일 ~ 6=토)
};

const STORAGE_KEY = 'adcc-unified-ad-operation-schedule-v1';
const MIGRATION_KEY = 'adcc-unified-ad-operation-schedule-migrated-v1';
const BASE_PLATFORMS = ['Meta', '네이버', 'Google', '카카오', '당근', '틱톡', 'YouTube'];

const initialRows: OperationScheduleItem[] = [];

function mapBudgetAction(value: string): BudgetAction {
  if (value.includes('증액')) return '증액';
  if (value.includes('감액')) return '감액';
  if (value.includes('중지')) return '광고 중지';
  return '유지';
}

function migrateLegacy(): OperationScheduleItem[] {
  let rows = [...initialRows];
  try {
    const oldSchedule = JSON.parse(localStorage.getItem('acc_ad_schedule') || '[]');
    if (Array.isArray(oldSchedule)) rows = [...rows, ...oldSchedule.map((item: any, index: number) => ({
      id: Number(item.id) || Date.now() + index,
      advertiser: item.brand || '미지정 광고주', platform: item.channel || 'Meta', campaign: item.campaign || '기존 광고 운영 스케줄', targetType: (['캠페인','광고세트','광고','예약 슬롯'].includes(item.kind) ? item.kind : '캠페인') as OperationScheduleItem['targetType'],
      date: item.date || '2026-08-01', time: item.time || '09:00', onOff: item.action === 'OFF' ? 'OFF' as const : 'ON' as const, budgetAction: '유지' as BudgetAction,
      currentBudget: 0, changePercent: 0, proposedBudget: 0, status: (['예정','완료','실패'].includes(item.status) ? item.status : '예정') as ScheduleStatus, enabled: item.enabled !== false, note: '기존 광고 운영 스케줄에서 이동',
    }))];
  } catch { /* 손상된 레거시 데이터는 가져오지 않습니다. */ }
  const unique = new Map<number, OperationScheduleItem>(); rows.forEach(row => unique.set(row.id, row));
  return Array.from(unique.values());
}

function loadRows(): OperationScheduleItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    const rows = migrateLegacy();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    localStorage.setItem(MIGRATION_KEY, '1');
    return rows;
  } catch { return initialRows; }
}

function proposalBudget(current: number, action: BudgetAction, change: number) {
  if (action === '광고 중지') return 0;
  if (action === '유지') return current;
  return Math.max(0, Math.round(current * (1 + change / 100)));
}

function localDateIso() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }

const emptyItem = (): OperationScheduleItem => ({ id: Date.now(), advertiser: BASE_ADVERTISERS[0] ?? '', platform: 'Meta', campaign: '', targetType: '캠페인', date: localDateIso(), time: '09:00', onOff: 'ON', budgetAction: '유지', currentBudget: 0, changePercent: 0, proposedBudget: 0, status: '예정', enabled: true, note: '', recurrence: 'once', recurrenceDays: [], owner: BASE_ADVERTISERS[0] ? loadAdvertiserSettings()[BASE_ADVERTISERS[0]]?.owners?.[0] : undefined });

export function AdOperationSchedulePage() {
  const advertisers = Array.from(new Set([...BASE_ADVERTISERS, ...loadExtraAdvertisers(), ...Object.keys(loadAdvertiserSettings())]));
  const platformOptions = Array.from(new Set([...BASE_PLATFORMS, ...loadCustomPlatforms()]));
  const { filterValue } = useAdvertiserFilter();
  const [rows, setRows] = useState<OperationScheduleItem[]>(loadRows);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('전체');
  const [budgetFilter, setBudgetFilter] = useState<'전체' | BudgetAction>('전체');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [editing, setEditing] = useState<OperationScheduleItem | null>(null);
  const persist = (next: OperationScheduleItem[]) => { setRows(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); };

  // 활성 상태(enabled)이고, 실행 예정 시각이 이미 지난 "예정" 항목은 완료로 자동 전환합니다.
  // 실제 매체 API 연동 전까지는 이 화면을 열 때마다 한 번씩 확인하는 수준의 시뮬레이션입니다.
  // 반복 일정(매주 평일·주말·요일 지정)은 시작일이 지났어도 계속 미래에 다시 실행되므로,
  // "완료"로 바꾸면 안 됩니다 — 일회성 일정만 자동완료 대상입니다.
  useEffect(() => {
    const now = new Date();
    setRows(prev => {
      let changed = false;
      const next = prev.map(row => {
        const isRecurring = row.recurrence && row.recurrence !== 'once';
        if (!row.enabled || row.status !== '예정' || isRecurring) return row;
        const scheduled = new Date(`${row.date}T${row.time}:00`);
        if (Number.isNaN(scheduled.getTime()) || scheduled > now) return row;
        changed = true;
        return { ...row, status: '완료' as ScheduleStatus };
      });
      if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const filtered = useMemo(() => rows.filter(row => {
    const q = query.trim().toLowerCase();
    return (!filterValue || matchesAdvertiserFilter(row.advertiser, filterValue)) && (!q || `${row.advertiser} ${row.platform} ${row.campaign} ${row.note}`.toLowerCase().includes(q)) && (platform === '전체' || row.platform === platform) && (budgetFilter === '전체' || row.budgetAction === budgetFilter);
  }), [rows, query, platform, budgetFilter, filterValue]);
  // 통계(전체·ON·증액·중지 건수)와 달력 발생은 비활성화한 일정을 빼고 계산합니다. 목록(표)에는
  // 비활성 행도 계속 보여야(회색으로 표시) 사용자가 존재를 알고 다시 켤 수 있으므로, filtered
  // 자체는 그대로 두고 이 값만 따로 만듭니다.
  const activeFiltered = useMemo(() => filtered.filter(row => row.enabled), [filtered]);
  const stats = {
    total: activeFiltered.length,
    on: activeFiltered.filter(row => row.onOff === 'ON').length,
    increase: activeFiltered.filter(row => row.budgetAction === '증액').length,
    stop: activeFiltered.filter(row => row.budgetAction === '광고 중지' || row.onOff === 'OFF').length,
  };
  const save = (item: OperationScheduleItem) => {
    const normalized = { ...item, proposedBudget: proposalBudget(item.currentBudget, item.budgetAction, item.changePercent), onOff: item.budgetAction === '광고 중지' ? 'OFF' as const : item.onOff };
    persist(rows.some(row => row.id === item.id) ? rows.map(row => row.id === item.id ? normalized : row) : [normalized, ...rows]);
    setEditing(null);
  };
  return <>
    <PageHeader title="광고 운영 스케줄" description="기존 예약 슬롯을 통합해 광고주·매체별 ON/OFF 일정과 광고비 증액·감액·유지·중지를 한 화면에서 관리합니다." action={<button className="btn primary" onClick={() => setEditing(emptyItem())}><Plus size={15}/> 운영 스케줄 추가</button>} />
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, margin: '0 0 14px' }}>
      ℹ 등록한 스케줄은 "활성" 토글이 켜진 동안 실행 예정으로 유지되며, 삭제하거나 비활성화하기 전까지 계속 적용됩니다. 일회성 일정은 실행 예정 시각이 지나면 이 화면을 열 때 자동으로 "완료" 상태로 바뀝니다. 매주 반복되는 일정은 계속 미래에도 실행되므로 "예정" 상태를 유지합니다. 다만 이 화면은 실제 매체 API와 아직 연동되지 않은 데모 환경이라, 지금은 상태 전환 시뮬레이션까지만 제공합니다 — 실제 매체에 ON/OFF·예산 변경을 반영하는 연동은 백엔드 작업이 필요합니다.
    </div>
    <div className="ops-stat-grid unified-schedule-stats"><div className="ops-stat"><span>전체 일정</span><strong>{stats.total}건</strong></div><div className="ops-stat"><span>광고 ON</span><strong>{stats.on}건</strong></div><div className="ops-stat"><span>예산 증액</span><strong>{stats.increase}건</strong></div><div className="ops-stat"><span>중지 OFF</span><strong>{stats.stop}건</strong></div></div>
    <section className="card ops-card">
      <div className="ops-toolbar"><div className="ops-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="광고주·매체·캠페인 검색"/></div><select value={platform} onChange={event => setPlatform(event.target.value)}><option>전체</option>{platformOptions.map(item => <option key={item}>{item}</option>)}</select><select value={budgetFilter} onChange={event => setBudgetFilter(event.target.value as typeof budgetFilter)}><option>전체</option><option>증액</option><option>감액</option><option>유지</option><option>광고 중지</option></select><div className="view-tabs"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>목록</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={13}/> 달력</button></div></div>
      {view === 'list' ? <div className="table-scroll"><table className="ops-table"><thead><tr><th>광고주</th><th>담당자</th><th>매체</th><th>대상</th><th>실행 일시</th><th>ON/OFF</th><th>예산 운영</th><th>현재 일예산</th><th>제안 일예산</th><th>상태</th><th>활성</th><th></th></tr></thead><tbody>{filtered.map(row => <tr key={row.id} style={row.enabled ? undefined : { opacity: 0.5 }}><td><b>{row.advertiser}</b></td><td>{row.owner || <span style={{ color: '#94a3b8' }}>미지정</span>}</td><td>{row.platform}</td><td><b>{row.campaign}</b><small style={{ display: 'block', color: '#94a3b8' }}>{row.targetType} · {row.note}</small></td><td>{row.date}<br/>{row.time}{row.recurrence && row.recurrence !== 'once' && <><br/><span className="status-pill" style={{ fontSize: 10 }}>{row.recurrence === 'weekday' ? '매주 평일' : row.recurrence === 'weekend' ? '매주 주말' : `매주 ${(row.recurrenceDays ?? []).map(d => WEEKDAY_LABELS[d]).join(',')}`}</span></>}</td><td><span className={`status-pill ${row.onOff === 'ON' ? 'success' : 'danger'}`}>{row.onOff}</span></td><td><span className={`budget-action ${row.budgetAction === '증액' ? 'up' : row.budgetAction === '감액' ? 'down' : row.budgetAction === '광고 중지' ? 'stop' : 'keep'}`}>{row.budgetAction}{row.changePercent && row.budgetAction !== '광고 중지' ? ` ${row.changePercent > 0 ? '+' : ''}${row.changePercent}%` : ''}</span></td><td>₩{row.currentBudget.toLocaleString()}</td><td><b>₩{row.proposedBudget.toLocaleString()}</b></td><td>{row.status}</td><td><button type="button" className={'toggle ' + (row.enabled ? 'on' : '')} title={row.enabled ? '활성 — 삭제·비활성화 전까지 실행 예정' : '비활성 — 실행하지 않음'} onClick={() => persist(rows.map(item => item.id === row.id ? { ...item, enabled: !item.enabled } : item))}><span/></button></td><td><div className="inline-actions"><button className="icon-btn" onClick={() => setEditing(row)}><PencilLine size={14}/></button><button className="icon-btn danger" onClick={() => window.confirm('이 운영 스케줄을 삭제할까요?') && persist(rows.filter(item => item.id !== row.id))}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div> : <ScheduleCalendar rows={activeFiltered} onEdit={setEditing}/>} 
    </section>
    {editing && <ScheduleEditor item={editing} advertisers={advertisers} platformOptions={platformOptions} onClose={() => setEditing(null)} onSave={save}/>} 
  </>;
}

function ScheduleCalendar({ rows, onEdit }: { rows: OperationScheduleItem[]; onEdit: (row: OperationScheduleItem) => void }) {
  const [month, setMonth] = useState(rows[0]?.date.slice(0, 7) || new Date().toISOString().slice(0, 7));
  const [year, monthNumber] = month.split('-').map(Number);
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const first = new Date(year, monthNumber - 1, 1).getDay();
  // 이 달의 각 날짜(1~dayCount)에 실제로 발생하는 스케줄을 구합니다. recurrence가 없으면
  // 시작일(row.date)에만 1번 표시되고, 있으면 시작일 이후로 해당 요일마다 매주 반복해서
  // 나타나야 하므로, 달의 날짜를 하나씩 돌며 조건에 맞는 스케줄을 찾습니다.
  const occursOn = (row: OperationScheduleItem, dateStr: string): boolean => {
    if (dateStr < row.date) return false;
    if (!row.recurrence || row.recurrence === 'once') return dateStr === row.date;
    const weekday = new Date(`${dateStr}T00:00:00`).getDay();
    const targetDays = row.recurrence === 'weekday' ? [1,2,3,4,5] : row.recurrence === 'weekend' ? [0,6] : (row.recurrenceDays ?? []);
    return targetDays.includes(weekday);
  };
  return <div className="unified-schedule-calendar"><div className="calendar-head"><b>{year}년 {monthNumber}월</b><input type="month" value={month} onChange={event => setMonth(event.target.value)} aria-label="달력 표시 월"/></div><div className="mini-calendar-grid">{['일','월','화','수','목','금','토'].map(day => <strong key={day}>{day}</strong>)}{Array.from({ length: first }).map((_, index) => <div key={`blank-${index}`} className="calendar-cell muted"/>)}{Array.from({ length: dayCount }, (_, index) => index + 1).map(day => {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    const dayRows = rows.filter(row => occursOn(row, dateStr));
    return <div key={day} className="calendar-cell"><span>{day}</span>{dayRows.map(row => <button key={`${row.id}-${dateStr}`} className={`calendar-event ${row.onOff === 'ON' ? 'on' : 'off'}`} onClick={() => onEdit(row)}>{row.time} {row.platform} · {row.budgetAction}</button>)}</div>;
  })}</div></div>;
}

function ScheduleEditor({ item, advertisers, platformOptions, onClose, onSave }: { item: OperationScheduleItem; advertisers: string[]; platformOptions: string[]; onClose: () => void; onSave: (item: OperationScheduleItem) => void }) {
  const [form, setForm] = useState(item);
  const update = <K extends keyof OperationScheduleItem,>(key: K, value: OperationScheduleItem[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const actionChanged = (action: BudgetAction) => {
    const change = action === '증액' ? Math.max(10, Math.abs(form.changePercent) || 20) : action === '감액' ? -Math.max(10, Math.abs(form.changePercent) || 20) : action === '광고 중지' ? -100 : 0;
    setForm(prev => ({ ...prev, budgetAction: action, changePercent: change, onOff: action === '광고 중지' ? 'OFF' : prev.onOff, proposedBudget: proposalBudget(prev.currentBudget, action, change) }));
  };
  return <div className="modal-backdrop" onClick={onClose}><div className="modal-card wide" onClick={event => event.stopPropagation()}><div className="modal-head"><div><h3>광고 운영 스케줄 설정</h3><p>광고 ON/OFF와 예산 운영 방향을 같은 일정으로 저장합니다.</p></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div><div className="form-grid"><label className="field-label">광고주<select value={form.advertiser} onChange={event => { const nextAdvertiser = event.target.value; const owners = loadAdvertiserSettings()[nextAdvertiser]?.owners; setForm(prev => ({ ...prev, advertiser: nextAdvertiser, owner: owners?.[0] ?? prev.owner })); }}>{advertisers.map(name => <option key={name}>{name}</option>)}</select>{(() => { const owners = loadAdvertiserSettings()[form.advertiser]?.owners; return owners?.length ? <small style={{ display: 'block', color: '#64748b', marginTop: 4 }}>환경설정에 등록된 담당자: {owners.join(', ')}</small> : null; })()}</label><label className="field-label">담당자<select value={form.owner ?? ''} onChange={event => update('owner', event.target.value)}><option value="">지정 안 함</option>{(loadAdvertiserSettings()[form.advertiser]?.owners ?? ['관리자','김마케터','이운영','박분석']).map(name => <option key={name}>{name}</option>)}</select></label><label className="field-label">매체<select value={form.platform} onChange={event => update('platform', event.target.value)}>{platformOptions.map(name => <option key={name}>{name}</option>)}</select></label><label className="field-label">대상 유형<select value={form.targetType} onChange={event => update('targetType', event.target.value as OperationScheduleItem['targetType'])}><option>캠페인</option><option>광고세트</option><option>광고</option><option>예약 슬롯</option></select></label><label className="field-label">광고 ON/OFF<select value={form.onOff} onChange={event => update('onOff', event.target.value as 'ON'|'OFF')}><option>ON</option><option>OFF</option></select></label><label className="field-label">예산 운영<select value={form.budgetAction} onChange={event => actionChanged(event.target.value as BudgetAction)}><option>증액</option><option>감액</option><option>유지</option><option>광고 중지</option></select></label><label className="field-label">조정률 (%)<input type="number" value={form.changePercent} disabled={form.budgetAction === '유지' || form.budgetAction === '광고 중지'} onChange={event => update('changePercent', Number(event.target.value))}/></label><label className="field-label">현재 일예산<input type="number" value={form.currentBudget} onChange={event => { const current = Number(event.target.value); setForm(prev => ({ ...prev, currentBudget: current, proposedBudget: proposalBudget(current, prev.budgetAction, prev.changePercent) })); }}/></label><label className="field-label">제안 일예산<input value={`₩${proposalBudget(form.currentBudget, form.budgetAction, form.changePercent).toLocaleString()}`} readOnly/></label><label className="field-label">실행일<input type="date" value={form.date} onChange={event => update('date', event.target.value)}/></label><label className="field-label">반복<select value={form.recurrence ?? 'once'} onChange={event => { const recurrence = event.target.value as RecurrenceType; setForm(prev => ({ ...prev, recurrence, recurrenceDays: recurrence === 'weekday' ? [1,2,3,4,5] : recurrence === 'weekend' ? [0,6] : recurrence === 'custom' ? (prev.recurrenceDays ?? []) : [] })); }}><option value="once">이 날짜만 실행</option><option value="weekday">매주 평일(월~금) 반복</option><option value="weekend">매주 주말(토·일) 반복</option><option value="custom">자동화 요일 직접 지정</option></select></label>{form.recurrence === 'custom' && <div className="field-label" style={{ gridColumn: '1 / -1' }}>반복 요일<div style={{ display: 'flex', gap: 6, marginTop: 4 }}>{WEEKDAY_LABELS.map((label, dayIndex) => { const active = (form.recurrenceDays ?? []).includes(dayIndex); return <button key={dayIndex} type="button" className={`btn sm ${active ? 'primary' : 'secondary'}`} onClick={() => setForm(prev => { const days = prev.recurrenceDays ?? []; return { ...prev, recurrenceDays: days.includes(dayIndex) ? days.filter(d => d !== dayIndex) : [...days, dayIndex].sort() }; })}>{label}</button>; })}</div></div>}<label className="field-label">시간<input type="time" value={form.time} onChange={event => update('time', event.target.value)}/></label><label className="field-label">상태<select value={form.status} onChange={event => update('status', event.target.value as ScheduleStatus)}><option>예정</option><option>완료</option><option>실패</option></select></label></div><label className="field-label">캠페인·광고명<input value={form.campaign} onChange={event => update('campaign', event.target.value)} placeholder="운영 대상을 입력하세요"/></label><label className="field-label">운영 메모<textarea rows={3} value={form.note} onChange={event => update('note', event.target.value)} placeholder="증액·감액 근거, 예약률, 성과 조건 등을 기록하세요"/></label><div className="modal-actions"><button className="btn secondary" onClick={onClose}>취소</button><button className="btn primary" onClick={() => form.campaign.trim() && onSave({ ...form, proposedBudget: proposalBudget(form.currentBudget, form.budgetAction, form.changePercent) })}><Save size={15}/> 저장</button></div></div></div>;
}
