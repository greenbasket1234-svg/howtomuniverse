import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, List, Plus, Trash2, X, Clock3, Pause, Play } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { automationApi, ruleScheduleSummary, nextRunAt, type AutomationRule, type AutomationRuleType } from '../automation/automationApi';

const typeLabel: Record<AutomationRuleType, string> = { report: '보고서 자동 생성', 'ad-copy': '광고 문구 자동 생성', notification: '알림 자동화', workflow: '작업 흐름', campaign: '캠페인 ON/OFF' };
const managePath: Record<AutomationRuleType, string> = { report: '/automation/report-generation', 'ad-copy': '/automation/ad-copy', notification: '/automation/notifications', workflow: '/automation/workflows', campaign: '/automation/scheduled-jobs' };
const WEEKDAYS = [['일', 0], ['월', 1], ['화', 2], ['수', 3], ['목', 4], ['금', 5], ['토', 6]] as const;
function todayKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fmtDateTime(d: Date) { return `${d.getMonth() + 1}/${d.getDate()}(${['일', '월', '화', '수', '목', '금', '토'][d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

export function ScheduledJobsPage() {
  const [advs] = useAdvertisers();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const reload = async () => { try { setRules(await automationApi.rules.list()); } catch { setRules([]); } };
  useEffect(() => { void reload(); }, []);
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [scope, setScope] = useState<'today' | 'week' | 'all'>('week');
  const [typeFilter, setTypeFilter] = useState<'all' | AutomationRuleType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [advertiser, setAdvertiser] = useState('all');
  const [view, setView] = useState<'list' | 'calendar' | 'timeline'>('list');

  const now = new Date(); const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
  const withNext = useMemo(() => rules.map(r => ({ rule: r, next: nextRunAt(r) })), [rules]);
  const filtered = withNext.filter(({ rule, next }) => {
    if (typeFilter !== 'all' && rule.type !== typeFilter) return false;
    if (statusFilter !== 'all' && (rule.enabled ? 'active' : 'paused') !== statusFilter) return false;
    if (advertiser !== 'all' && rule.advertiser_id !== advertiser) return false;
    if (scope === 'all' || !next) return true;
    if (scope === 'today') return todayKey(next) === todayKey(now);
    return next <= weekEnd;
  });
  const occurrenceRows = withNext.filter(x => x.next).filter(x => scope === 'all' || (scope === 'today' ? todayKey(x.next!) === todayKey(now) : x.next! <= weekEnd)).sort((a, b) => +a.next! - +b.next!);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(now.getDate() + i); return d; });
  const toggle = async (rule: AutomationRule) => { await automationApi.rules.update(rule.id, { enabled: !rule.enabled }); void reload(); };
  const [runningId, setRunningId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const runNow = async (rule: AutomationRule) => {
    setRunningId(rule.id); setNotice('');
    try {
      await automationApi.rules.runNow(rule.id);
      setNotice(`"${rule.name}" 실행 성공 — 아래 실행 기록(전체 실행 기록 화면)에서도 바로 확인할 수 있습니다.`);
    } catch (e) {
      setNotice(`"${rule.name}" 실행 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setRunningId(null); void reload();
    }
  };

  return <div className="automation-engine-page">
    <PageHeader title="예약 작업" description="서버에 저장된 모든 자동화 규칙(보고서·광고문구·알림·작업흐름·캠페인)의 예약 현황을 한 곳에서 봅니다." action={<button className="btn primary" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={15} /> 캠페인 예약 추가</button>} />
    <div className="automation-pre-revenue-note"><b>서버 스케줄러 연동됨</b><span>여기 표시되는 예약은 실제로 서버가 정해진 시각에 자동 실행합니다(광고문구·캠페인·알림 감시). 보고서·작업흐름은 아직 자동 실행 준비 중입니다.</span></div>
    {notice && <div className="auto28-note"><span>{notice}</span></div>}
    <div className="card auto-filter-card"><div className="auto-filter-row">
      <div className="segmented"><button className={scope === 'today' ? 'active' : ''} onClick={() => setScope('today')}>오늘</button><button className={scope === 'week' ? 'active' : ''} onClick={() => setScope('week')}>이번 주</button><button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>전체</button></div>
      <select value={advertiser} onChange={e => setAdvertiser(e.target.value)}><option value="all">전체 광고주</option>{advs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}><option value="all">전체 유형</option>{Object.entries(typeLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}><option value="all">전체 상태</option><option value="active">ON</option><option value="paused">중지</option></select>
      <div className="auto-view-buttons"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={15} />목록</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={15} />캘린더</button><button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}><Clock3 size={15} />타임라인</button></div>
    </div></div>

    {view === 'list' && <section className="card auto-panel" style={{ padding: 0 }}><div className="table-scroll"><table className="data-table auto-table"><thead><tr><th>작업</th><th>광고주</th><th>유형</th><th>실행 주기</th><th>다음 실행</th><th>상태</th><th>작업</th></tr></thead><tbody>
      {filtered.length === 0 ? <tr><td colSpan={7} className="auto-table-empty">조건에 맞는 예약 작업이 없습니다.</td></tr> : filtered.map(({ rule, next }) => (
        <tr key={rule.id}><td><b>{rule.name}</b></td><td>{rule.config?.advertiserName || (rule.advertiser_id ? advs.find(a => a.id === rule.advertiser_id)?.name : '전체') || '-'}</td><td>{typeLabel[rule.type]}</td>
        <td>{ruleScheduleSummary(rule)}</td><td>{next ? fmtDateTime(next) : '-'}</td><td><span className={`auto-state ${rule.enabled ? 'active' : 'paused'}`}>{rule.enabled ? 'ON' : '중지'}</span></td>
        <td><div className="row-actions">{rule.type === 'campaign' ? <>
          <button className="btn secondary mini" disabled={runningId === rule.id} onClick={() => runNow(rule)}>{runningId === rule.id ? '실행 중...' : '지금 실행'}</button>
          <button className="icon-btn" title={rule.enabled ? '일시중지' : '활성화'} onClick={() => toggle(rule)}>{rule.enabled ? <Pause size={15} /> : <Play size={15} />}</button>
          <button className="btn secondary mini" onClick={() => { setEditing(rule); setShowForm(true); }}>수정</button>
          <button className="icon-btn danger" onClick={() => { if (confirm('예약 작업을 삭제할까요?')) automationApi.rules.remove(rule.id).then(reload); }}><Trash2 size={15} /></button>
        </> : <Link className="btn secondary mini" to={managePath[rule.type]}>관리 화면</Link>}</div></td></tr>
      ))}
    </tbody></table></div></section>}

    {view === 'calendar' && <section className="card auto-panel"><div className="auto-calendar-grid">{weekDays.map(day => <div className="auto-calendar-day" key={todayKey(day)}><header><b>{day.getMonth() + 1}/{day.getDate()}</b><span>{['일', '월', '화', '수', '목', '금', '토'][day.getDay()]}</span></header>
      {occurrenceRows.filter(x => todayKey(x.next!) === todayKey(day)).map((x, i) => <div className="auto-calendar-event" key={`${x.rule.id}-${i}`}><time>{String(x.next!.getHours()).padStart(2, '0')}:{String(x.next!.getMinutes()).padStart(2, '0')}</time><b>{x.rule.name}</b><small>{typeLabel[x.rule.type]}</small></div>)}
    </div>)}</div></section>}

    {view === 'timeline' && <section className="card auto-panel"><div className="auto-timeline">{occurrenceRows.length === 0 ? <div className="auto-empty">계산 가능한 다음 실행이 없습니다.</div> : occurrenceRows.map((x, i) => (
      <div className="auto-timeline-row" key={`${x.rule.id}-${i}`}><time>{fmtDateTime(x.next!)}</time><span className="auto-dot queued" /><div><b>{x.rule.name}</b><small>{typeLabel[x.rule.type]}</small></div></div>
    ))}</div></section>}

    {showForm && <CampaignScheduleModal initial={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); void reload(); }} />}
  </div>;
}

function CampaignScheduleModal({ initial, onClose, onSaved }: { initial: AutomationRule | null; onClose: () => void; onSaved: () => void }) {
  const [advs] = useAdvertisers();
  const c = initial?.config || {};
  const [advertiserId, setAdvertiserId] = useState(c.advertiserId || advs[0]?.id || '');
  const [targetType, setTargetType] = useState<'campaign' | 'adset' | 'creative' | 'keyword'>((['adset', 'creative', 'keyword'].includes(c.targetType) ? c.targetType : 'campaign'));
  const targetTypeLabel: Record<string, string> = { campaign: '캠페인', adset: '광고 세트', creative: '소재', keyword: '키워드' };
  const [targetId, setTargetId] = useState(c.targetId || c.campaignId || '');
  const [targetName, setTargetName] = useState(c.targetName || c.campaignName || '');
  const [channel, setChannel] = useState(c.channel || 'naver');
  const [action, setAction] = useState<'on' | 'off'>(c.action || 'on');
  const [cadence, setCadence] = useState(c.cadence || 'daily');
  const [weekdays, setWeekdays] = useState<number[]>(c.weekdays || (c.weekday !== undefined ? [c.weekday] : [1]));
  const [dayOfMonth, setDayOfMonth] = useState(c.dayOfMonth || 1);
  const [time, setTime] = useState(c.time || '09:00');
  const [enabled, setEnabled] = useState(initial?.enabled !== false);
  const toggleWeekday = (v: number) => setWeekdays(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v].sort());
  const save = async () => {
    if (!targetId) { alert(`${targetTypeLabel[targetType]} ID를 입력하세요.`); return; }
    if (cadence === 'weekly' && weekdays.length === 0) { alert('요일을 하나 이상 선택하세요.'); return; }
    const adv = advs.find(a => a.id === advertiserId);
    const config = { advertiserId, advertiserName: adv?.name, targetType, targetId, targetName, channel, action, cadence, weekdays, dayOfMonth, time };
    const name = `${adv?.name || ''} ${targetName || targetId} ${action === 'on' ? 'ON' : 'OFF'}`;
    if (initial) await automationApi.rules.update(initial.id, { name, config, enabled });
    else await automationApi.rules.create({ type: 'campaign', advertiserId, name, config, enabled });
    onSaved();
  };
  return <div className="modal-backdrop"><div className="modal-card auto-modal">
    <div className="modal-head"><div><h3>{initial ? '예약 수정' : '새 캠페인·소재 ON/OFF 예약'}</h3><p>정해진 요일·시각에 서버가 실제로 상태를 변경합니다.</p></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
    {channel === 'meta' && <div className="automation-pre-revenue-note"><b>Meta 권한 안내</b><span>현재 연결된 Meta 토큰이 조회 전용(ads_read)이면 예약 시각에 실행이 실패로 기록됩니다. ads_management 권한 토큰으로 재연결하면 별도 설정 없이 바로 작동합니다.</span></div>}
    <div className="auto-modal-grid">
      <label>광고주<select value={advertiserId} onChange={e => setAdvertiserId(e.target.value)}>{advs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label>매체<select value={channel} onChange={e => { setChannel(e.target.value); if (e.target.value === 'meta' && targetType === 'keyword') setTargetType('campaign'); }}><option value="naver">네이버</option><option value="meta">Meta</option></select></label>
      <label>대상 유형<select value={targetType} onChange={e => setTargetType(e.target.value as any)}><option value="campaign">캠페인</option><option value="adset">광고 세트</option><option value="creative">소재(개별 광고)</option>{channel === 'naver' && <option value="keyword">키워드</option>}</select></label>
      <label>{targetTypeLabel[targetType]} ID<input value={targetId} onChange={e => setTargetId(e.target.value)} placeholder={`${targetTypeLabel[targetType]} 관리 화면에서 확인`} /></label>
      <label className="span-2">{targetTypeLabel[targetType]} 이름(선택)<input value={targetName} onChange={e => setTargetName(e.target.value)} /></label>
      <label>도달 시 상태 변경<select value={action} onChange={e => setAction(e.target.value as any)}><option value="on">켜기(ON)로 변경</option><option value="off">끄기(OFF)로 변경</option></select><small className="field-help">예약 시각이 되면 대상을 이 상태로 바꿉니다.</small></label>
      <label>주기<select value={cadence} onChange={e => setCadence(e.target.value)}><option value="daily">매일</option><option value="weekly">매주(요일 지정)</option><option value="monthly">매월</option></select></label>
      {cadence === 'weekly' && <div className="span-2"><span className="auto-field-title">요일(복수 선택 가능)</span><div className="auto-weekday-buttons">{WEEKDAYS.map(([label, v]) => <button type="button" key={v} className={weekdays.includes(v) ? 'active' : ''} onClick={() => toggleWeekday(v)}>{label}</button>)}</div></div>}
      {cadence === 'monthly' && <label>매월 실행일<input type="number" min="1" max="28" value={dayOfMonth} onChange={e => setDayOfMonth(Math.max(1, Math.min(28, Number(e.target.value) || 1)))} /></label>}
      <label>실행 시각<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
      <label className="span-2"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> 이 예약 자체를 사용함<small className="field-help">체크를 끄면 위에서 정한 상태 변경은 실행되지 않고, 이 예약이 통째로 일시정지됩니다.</small></label>
    </div>
    <div className="modal-actions"><button className="btn secondary" onClick={onClose}>취소</button><button className="btn primary" onClick={save}>저장</button></div>
  </div></div>;
}
