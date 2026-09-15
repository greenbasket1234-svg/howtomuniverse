import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, CalendarClock, Database, RefreshCw, XCircle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { apiFetch } from '../hooks/useApi';
import { automationApi, ruleScheduleSummary, nextRunAt, type AutomationRule, type AutomationRun } from '../automation/automationApi';

function dayKey(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value); if (Number.isNaN(+d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const typeLabel: Record<string, string> = { report: '보고서 자동 생성', 'ad-copy': '광고 문구 자동 생성', notification: '알림 자동화', workflow: '작업 흐름', campaign: '캠페인·소재 ON/OFF' };
const statusLabel: Record<string, string> = { success: '성공', failed: '실패', running: '실행 중' };
const routeFor: Record<string, string> = { report: '/automation/report-generation', 'ad-copy': '/automation/ad-copy', notification: '/automation/notifications', workflow: '/automation/workflows', campaign: '/automation/scheduled-jobs' };
function fmtTime(d: Date) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function fmtDateTime(d: Date) { return `${d.getMonth() + 1}/${d.getDate()} ${fmtTime(d)}`; }

export function AutomationOverviewPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [autoSync, setAutoSync] = useState<{ enabled: boolean; hoursKst: number[]; lastRunAt: string | null; lastResult: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try {
      const [r, ru, sync] = await Promise.all([
        automationApi.rules.list().catch(() => []),
        automationApi.runs.list().catch(() => []),
        apiFetch<{ enabled: boolean; hoursKst: number[]; lastRunAt: string | null; lastResult: any }>('/integrations/auto-sync-status').catch(() => null),
      ]);
      setRules(r); setRuns(ru); setAutoSync(sync);
    } finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);

  const today = dayKey(new Date());
  const todayRuns = runs.filter(r => dayKey(r.started_at) === today);
  const active = rules.filter(r => r.enabled);
  const paused = rules.filter(r => !r.enabled);
  const failures = todayRuns.filter(r => r.status === 'failed');
  const successes = todayRuns.filter(r => r.status === 'success');
  const withNext = useMemo(() => active.map(r => ({ rule: r, at: nextRunAt(r) })).filter(x => x.at).sort((a, b) => +a.at! - +b.at!), [active]);
  const next = withNext[0];
  const health = todayRuns.length ? Math.round((successes.length / Math.max(1, todayRuns.length)) * 100) : null;

  const campaignRules = rules.filter(r => r.type === 'campaign');
  const notificationRules = rules.filter(r => r.type === 'notification');
  const reportRules = rules.filter(r => r.type === 'report');
  const adCopyRules = rules.filter(r => r.type === 'ad-copy');

  const upcomingToday = withNext.filter(x => dayKey(x.at!) === today).map(x => ({ kind: 'planned' as const, at: x.at!, rule: x.rule }));
  const runItems = todayRuns.map(r => ({ kind: 'run' as const, at: new Date(r.started_at), run: r }));
  const timeline = [...runItems, ...upcomingToday].sort((a, b) => +a.at - +b.at).slice(0, 20);
  const issues = failures.map(r => ({ title: r.rule_name || r.rule_type, detail: r.error || '실행 실패 기록을 확인해 주세요.', link: '/automation/execution-logs' })).slice(0, 5);

  return <div className="automation-engine-page">
    <PageHeader title="자동화 현황" description="서버에 저장된 자동화 규칙의 활성 상태, 오늘 실행 기록, 다음 실행과 확인 필요 항목을 한 화면에서 봅니다." action={<button className="btn secondary" onClick={reload} disabled={loading}><RefreshCw size={15} /> 새로고침</button>} />
    <div className="automation-pre-revenue-note"><b>서버 스케줄러 연동됨</b><span>여기 표시되는 실행 기록·다음 실행은 실제 서버에서 벌어진(또는 벌어질) 일입니다. 보고서·작업흐름은 아직 자동 실행 준비 중입니다.</span></div>
    <div className="auto-kpi-grid">
      <div className="auto-kpi-card"><span>활성 자동화</span><strong>{active.length}개</strong><small>전체 {rules.length}개 중</small></div>
      <div className="auto-kpi-card"><span>오늘 실행 기록</span><strong>{todayRuns.length}회</strong><small>서버에 실제 저장된 실행 기록</small></div>
      <div className="auto-kpi-card"><span>성공</span><strong className="text-success">{successes.length}회</strong><small>{todayRuns.length ? '오늘 기록 기준' : '기록 없음'}</small></div>
      <div className="auto-kpi-card"><span>실패</span><strong className={failures.length ? 'text-danger' : ''}>{failures.length}회</strong><small>확인 필요</small></div>
      <div className="auto-kpi-card"><span>다음 실행</span><strong>{next ? fmtDateTime(next.at!) : '없음'}</strong><small>{next?.rule.name || '예약 없음'}</small></div>
      <div className="auto-kpi-card"><span>일시중지</span><strong>{paused.length}개</strong><small>사용자 설정 기준</small></div>
    </div>

    <section className="auto-status-grid">
      <div className="auto-status-card"><div><Database size={18} /><b>데이터 자동 수집</b></div><strong>{autoSync?.enabled ? `매일 ${autoSync.hoursKst.join(', ')}시` : '미설정'}</strong><small>{autoSync?.lastRunAt ? `최근 실행: ${fmtDateTime(new Date(autoSync.lastRunAt))}` : '아직 실행 이력 없음'}</small></div>
      <Link to="/automation/scheduled-jobs" className="auto-status-card"><div><CalendarClock size={18} /><b>캠페인·소재 ON/OFF</b></div><strong>{campaignRules.length ? `${campaignRules.filter(r => r.enabled).length}개 예약` : '예약 없음'}</strong><small>캠페인·광고세트·소재·키워드</small></Link>
      <Link to="/automation/report-generation" className="auto-status-card"><div><Activity size={18} /><b>보고서 자동 생성</b></div><strong>{reportRules.length ? `${reportRules.filter(r => r.enabled).length}개 설정` : '설정 없음'}</strong><small>월간 보고서·다음달 제안서 초안</small></Link>
      <Link to="/automation/ad-copy" className="auto-status-card"><div><Activity size={18} /><b>광고 문구 자동 생성</b></div><strong>{adCopyRules.length ? `${adCopyRules.filter(r => r.enabled).length}개 설정` : '설정 없음'}</strong><small>실제 AI 생성 연동됨</small></Link>
      <Link to="/automation/notifications" className="auto-status-card"><div><AlertTriangle size={18} /><b>알림 자동화</b></div><strong>{notificationRules.length ? `${notificationRules.length}개 규칙` : '설정 없음'}</strong><small>예산 소진 감시(우선 지원)</small></Link>
    </section>

    <div className="auto-two-column">
      <section className="card auto-panel"><div className="auto-panel-head"><div><h3>오늘의 실행 타임라인</h3><p>실행 기록과 오늘 예정된 예약을 시간 순서로 표시합니다.</p></div></div>
        {timeline.length === 0 ? <div className="auto-empty">오늘 실행 기록 또는 예정된 예약이 없습니다.</div> : <div className="auto-timeline">{timeline.map((item, i) => item.kind === 'run'
          ? <div className="auto-timeline-row" key={`r-${item.run.id}-${i}`}><time>{fmtTime(item.at)}</time><span className={`auto-dot ${item.run.status}`} /><div><b>{item.run.rule_name || item.run.rule_type}</b><small>{statusLabel[item.run.status] || item.run.status}</small></div></div>
          : <div className="auto-timeline-row" key={`p-${item.rule.id}-${i}`}><time>{fmtTime(item.at)}</time><span className="auto-dot queued" /><div><b>{item.rule.name}</b><small>예정 · {typeLabel[item.rule.type] || item.rule.type}</small></div></div>
        )}</div>}
      </section>
      <section className="card auto-panel"><div className="auto-panel-head"><div><h3>자동화 건강도</h3><p>오늘 실행 기록의 성공률을 기준으로 계산합니다.</p></div>{health == null ? <span className="auto-health pending">평가 보류</span> : <span className={`auto-health ${health >= 90 ? 'good' : health >= 70 ? 'warning' : 'danger'}`}>{health} / 100</span>}</div>
        <div className="auto-health-lines"><div><span>정상 실행률</span><b>{todayRuns.length ? `${Math.round(successes.length / Math.max(1, todayRuns.length) * 100)}%` : '기록 없음'}</b></div><div><span>실패 실행</span><b>{failures.length}건</b></div><div><span>예약된 자동화</span><b>{active.length}개</b></div></div>
      </section>
    </div>

    {issues.length > 0 && <section className="card auto-panel auto-issue-panel"><div className="auto-panel-head"><div><h3>자동화 확인 필요 {issues.length}건</h3><p>오늘 실패한 실행 기록입니다.</p></div></div>{issues.map((issue, i) => <div className="auto-issue-row" key={`${issue.title}-${i}`}><XCircle size={17} /><div><b>{issue.title}</b><small>{issue.detail}</small></div><Link to={issue.link}>확인</Link></div>)}</section>}

    <section className="card auto-panel"><div className="auto-panel-head"><div><h3>자동화 전체</h3><p>자동화 현황에서는 설정을 중복 편집하지 않고 각 관리 화면으로 이동합니다.</p></div><span>{rules.length}개</span></div>
      <div className="table-scroll"><table className="data-table auto-table"><thead><tr><th>자동화</th><th>유형</th><th>광고주</th><th>주기</th><th>다음 실행</th><th>상태</th><th></th></tr></thead><tbody>
        {rules.length === 0 ? <tr><td colSpan={7} className="auto-table-empty">등록된 자동화가 없습니다.</td></tr> : rules.map(r => { const n = nextRunAt(r); return (
          <tr key={r.id}><td><b>{r.name}</b></td><td>{typeLabel[r.type] || r.type}</td><td>{r.config?.advertiserName || '전체'}</td><td>{ruleScheduleSummary(r)}</td><td>{n ? fmtDateTime(n) : '-'}</td><td><span className={`auto-state ${r.enabled ? 'active' : 'paused'}`}>{r.enabled ? 'ON' : '일시중지'}</span></td><td><Link to={routeFor[r.type]}>관리</Link></td></tr>
        ); })}
      </tbody></table></div>
    </section>
  </div>;
}
