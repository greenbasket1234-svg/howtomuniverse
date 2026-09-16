import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, List, Clock3, Pause, Play, Trash2, ExternalLink } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ChannelTag } from '../components/ChannelTag';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { apiFetch } from '../hooks/useApi';
import { automationApi, ruleScheduleSummary, nextRunAt, occurrencesInRange, type AutomationRule, type AutomationRuleType } from '../automation/automationApi';
import type { CreativeMetricRow } from '../types/metrics';

const typeLabel: Record<AutomationRuleType, string> = { report: '보고서 자동 생성', 'ad-copy': '광고 문구 자동 생성', notification: '알림 자동화', workflow: '작업 흐름', campaign: '캠페인·소재·키워드 ON/OFF' };
const managePath: Record<AutomationRuleType, string> = { report: '/automation/report-generation', 'ad-copy': '/automation/ad-copy', notification: '/automation/notifications', workflow: '/automation/workflows', campaign: '/campaigns' };
const targetTypeLabel: Record<string, string> = { campaign: '캠페인', adset: '광고 세트', creative: '소재', keyword: '키워드' };
function todayKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fmtDateTime(d: Date) { return `${d.getMonth() + 1}/${d.getDate()}(${['일', '월', '화', '수', '목', '금', '토'][d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

export function ScheduledJobsPage() {
  const [advs] = useAdvertisers();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const reload = async () => { try { setRules(await automationApi.rules.list()); } catch { setRules([]); } };
  useEffect(() => { void reload(); }, []);
  // 소재(이미지·영상) 예약은 썸네일을 보여주기 위해 소재 성과 데이터와 매칭합니다.
  const [creativeRows, setCreativeRows] = useState<CreativeMetricRow[]>([]);
  useEffect(() => { apiFetch<{ rows: CreativeMetricRow[] }>('/metrics/creatives').then(r => setCreativeRows(r.rows || [])).catch(() => setCreativeRows([])); }, []);
  const creativeFor = (rule: AutomationRule) => {
    const cfg = rule.config || {};
    if (cfg.targetType !== 'creative') return null;
    return creativeRows.find(c => c.adId === cfg.targetId && c.channel === cfg.channel && String(c.advertiserId) === String(rule.advertiser_id)) || null;
  };

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
  // 캘린더 뷰 - "오늘부터 7일"이 아니라 실제 달력(월 단위 + 이전달/다음달 이동)입니다.
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const scopeIndependentRules = rules.filter(rule => {
    if (!rule.enabled) return false; // 중지된 예약은 실제로 실행되지 않으므로, 상태 필터와 무관하게 캘린더에서 항상 제외합니다.
    if (typeFilter !== 'all' && rule.type !== typeFilter) return false;
    if (statusFilter !== 'all' && (rule.enabled ? 'active' : 'paused') !== statusFilter) return false;
    if (advertiser !== 'all' && rule.advertiser_id !== advertiser) return false;
    return true;
  });
  const calendarGrid = useMemo(() => {
    const monthStart = new Date(calendarMonth); const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const gridStart = new Date(monthStart); gridStart.setDate(gridStart.getDate() - gridStart.getDay()); // 그 주의 일요일부터
    const gridEnd = new Date(monthEnd); gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay())); // 그 주의 토요일까지
    const days: { date: Date; inMonth: boolean; events: { rule: AutomationRule; at: Date }[] }[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      const dayEvents: { rule: AutomationRule; at: Date }[] = [];
      for (const rule of scopeIndependentRules) {
        for (const at of occurrencesInRange(rule, cursor, cursor)) dayEvents.push({ rule, at });
      }
      days.push({ date: new Date(cursor), inMonth: cursor.getMonth() === calendarMonth.getMonth(), events: dayEvents.sort((a, b) => +a.at - +b.at) });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [calendarMonth, scopeIndependentRules]);
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
    <PageHeader title="예약 작업" description="서버에 저장된 모든 자동화 규칙(보고서·광고문구·알림·작업흐름·캠페인)의 예약 현황을 한 곳에서 봅니다." />
    <div className="automation-pre-revenue-note"><b>서버 스케줄러 연동됨</b><span>여기 표시되는 예약은 실제로 서버가 정해진 시각에 자동 실행합니다(광고문구·캠페인·알림 감시). 보고서·작업흐름은 아직 자동 실행 준비 중입니다.</span></div>
    <div className="automation-pre-revenue-note"><b>새 캠페인·소재·키워드 예약은 각 관리 화면에서 만들어주세요</b>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <Link className="btn secondary mini" to="/campaigns">캠페인 관리에서 만들기 <ExternalLink size={13} /></Link>
        <Link className="btn secondary mini" to="/creatives/performance">소재 성과에서 만들기 <ExternalLink size={13} /></Link>
        <Link className="btn secondary mini" to="/keywords">키워드 분석에서 만들기 <ExternalLink size={13} /></Link>
      </div>
    </div>
    {notice && <div className="auto28-note"><span>{notice}</span></div>}
    <div className="card auto-filter-card"><div className="auto-filter-row">
      <div className="segmented"><button className={scope === 'today' ? 'active' : ''} onClick={() => setScope('today')}>오늘</button><button className={scope === 'week' ? 'active' : ''} onClick={() => setScope('week')}>이번 주</button><button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>전체</button></div>
      <select value={advertiser} onChange={e => setAdvertiser(e.target.value)}><option value="all">전체 광고주</option>{advs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}><option value="all">전체 유형</option>{Object.entries(typeLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}><option value="all">전체 상태</option><option value="active">ON</option><option value="paused">중지</option></select>
      <div className="auto-view-buttons"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={15} />목록</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={15} />캘린더</button><button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}><Clock3 size={15} />타임라인</button></div>
    </div></div>

    {view === 'list' && <section className="card auto-panel" style={{ padding: 0 }}><div className="table-scroll"><table className="data-table auto-table"><thead><tr><th>작업</th><th>매체</th><th>대상</th><th>광고주</th><th>유형</th><th>실행 주기</th><th>다음 실행</th><th>상태</th><th>작업</th></tr></thead><tbody>
      {filtered.length === 0 ? <tr><td colSpan={9} className="auto-table-empty">조건에 맞는 예약 작업이 없습니다.</td></tr> : filtered.map(({ rule, next }) => {
        const cfg = rule.config || {};
        const creative = creativeFor(rule);
        return <tr key={rule.id}>
        <td><b>{rule.name}</b></td>
        <td>{cfg.channel ? <ChannelTag channel={cfg.channel} /> : '-'}</td>
        <td>{rule.type === 'campaign' && cfg.targetType ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {creative && (creative.thumbnailUrl ? <img src={creative.thumbnailUrl} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} /> : <span style={{ width: 32, height: 32, borderRadius: 6, background: '#eef1f5', display: 'inline-block' }} />)}
            <div><span className="auto-target-type">{targetTypeLabel[cfg.targetType] || cfg.targetType}</span><br /><small>{cfg.targetName || cfg.targetId}</small></div>
            {cfg.targetType === 'creative' && <Link className="icon-btn" title="소재 관리에서 보기" to={`/creatives/library?q=${encodeURIComponent(cfg.targetName || cfg.targetId || '')}`}><ExternalLink size={14} /></Link>}
          </div>
        ) : '-'}</td>
        <td>{rule.config?.advertiserName || (rule.advertiser_id ? advs.find(a => a.id === rule.advertiser_id)?.name : '전체') || '-'}</td>
        <td>{typeLabel[rule.type]}</td>
        <td>{ruleScheduleSummary(rule)}</td><td>{next ? fmtDateTime(next) : '-'}</td><td><span className={`auto-state ${rule.enabled ? 'active' : 'paused'}`}>{rule.enabled ? 'ON' : '중지'}</span></td>
        <td><div className="row-actions">{rule.type === 'campaign' ? <>
          <button className="btn secondary mini" disabled={runningId === rule.id} onClick={() => runNow(rule)}>{runningId === rule.id ? '실행 중...' : '지금 실행'}</button>
          <button className="icon-btn" title={rule.enabled ? '일시중지' : '활성화'} onClick={() => toggle(rule)}>{rule.enabled ? <Pause size={15} /> : <Play size={15} />}</button>
          <button className="icon-btn danger" onClick={() => { if (confirm('예약 작업을 삭제할까요?')) automationApi.rules.remove(rule.id).then(reload); }}><Trash2 size={15} /></button>
        </> : <Link className="btn secondary mini" to={managePath[rule.type]}>관리 화면</Link>}</div></td></tr>;
      })}
    </tbody></table></div></section>}

    {view === 'calendar' && <section className="card auto-panel">
      <div className="auto-calendar-nav">
        <button className="btn secondary mini" onClick={() => setCalendarMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}>← 이전달</button>
        <b>{calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월</b>
        <button className="btn secondary mini" onClick={() => setCalendarMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}>다음달 →</button>
        <button className="btn secondary mini" onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setCalendarMonth(d); }}>오늘</button>
      </div>
      <div className="auto-calendar-weekdays">{['일', '월', '화', '수', '목', '금', '토'].map(w => <span key={w}>{w}</span>)}</div>
      <div className="auto-calendar-month-grid">{calendarGrid.map(day => <div className={`auto-calendar-day month ${day.inMonth ? '' : 'outside'} ${todayKey(day.date) === todayKey(now) ? 'is-today' : ''}`} key={todayKey(day.date)}>
        <header><b>{day.date.getDate()}</b></header>
        {day.events.slice(0, 3).map((ev, i) => <div className="auto-calendar-event" key={`${ev.rule.id}-${i}`}><time>{String(ev.at.getHours()).padStart(2, '0')}:{String(ev.at.getMinutes()).padStart(2, '0')}</time><b>{ev.rule.name}</b></div>)}
        {day.events.length > 3 && <small className="auto-calendar-more">외 {day.events.length - 3}건 · 마우스를 올려 전체보기</small>}
        {day.events.length > 0 && <div className="auto-calendar-popover">
          <b className="auto-calendar-popover-date">{day.date.getMonth() + 1}월 {day.date.getDate()}일 예약 {day.events.length}건</b>
          {day.events.map((ev, i) => <div className="auto-calendar-event" key={`popover-${ev.rule.id}-${i}`}><time>{String(ev.at.getHours()).padStart(2, '0')}:{String(ev.at.getMinutes()).padStart(2, '0')}</time><b>{ev.rule.name}</b></div>)}
        </div>}
      </div>)}</div>
    </section>}

    {view === 'timeline' && <section className="card auto-panel"><div className="auto-timeline">{occurrenceRows.length === 0 ? <div className="auto-empty">계산 가능한 다음 실행이 없습니다.</div> : occurrenceRows.map((x, i) => (
      <div className="auto-timeline-row" key={`${x.rule.id}-${i}`}><time>{fmtDateTime(x.next!)}</time><span className="auto-dot queued" /><div><b>{x.rule.name}</b><small>{typeLabel[x.rule.type]}</small></div></div>
    ))}</div></section>}
  </div>;
}
