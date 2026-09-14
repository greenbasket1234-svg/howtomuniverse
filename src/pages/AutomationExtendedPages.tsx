import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../hooks/useApi';
import { Link } from 'react-router-dom';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { automationApi, type AutomationRule, type AutomationRun, type AutomationNotification } from '../automation/automationApi';
import { checkReportReadiness, generateReportsNow, previousMonthKey } from '../automation/report/reportAutomation';

const fmt = (value?: string | null) => { if (!value) return '-'; const d = new Date(value); return Number.isNaN(+d) ? '-' : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const statusLabel: Record<string, string> = { success: '성공', failed: '실패', running: '실행 중' };

function useRules(type: AutomationRule['type']) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const reload = async () => { try { setRules(await automationApi.rules.list(type)); } catch { setRules([]); } };
  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return { rules, reload };
}
function useRuns(ruleType?: string) {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const reload = async () => { try { setRuns(await automationApi.runs.list()); } catch { setRuns([]); } };
  useEffect(() => { void reload(); }, []);
  return { runs: ruleType ? runs.filter(r => r.rule_type === ruleType) : runs, reload };
}

function Header({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return <><div className="auto28-head"><div><h1>{title}</h1><p>{desc}</p></div>{action}</div>
    <div className="auto28-note"><b>서버 자동화 적용됨</b><span>규칙은 서버 DB에 저장되어 팀 전체가 공유하고, 서버 스케줄러가 예약 시각에 자동으로 실행합니다.</span></div></>;
}
function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: string }) { return <span className={`auto28-pill ${tone}`}>{children}</span>; }
function Kpis({ items }: { items: { label: string; value: string | number; sub?: string }[] }) {
  return <div className="auto28-kpis">{items.map(x => <div className="auto28-kpi" key={x.label}><span>{x.label}</span><strong>{x.value}</strong>{x.sub && <small>{x.sub}</small>}</div>)}</div>;
}
function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop"><div className={`modal-card auto28-modal ${wide ? 'wide' : ''}`}><div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose}>×</button></div>{children}</div></div>;
}
function ModalActions({ onClose, onSave }: { onClose: () => void; onSave?: () => void }) {
  return <div className="modal-actions"><button className="btn secondary" onClick={onClose}>닫기</button>{onSave && <button className="btn primary" onClick={onSave}>저장</button>}</div>;
}
function RunRow({ run }: { run: AutomationRun }) {
  return <div className="auto28-listrow"><div><b>{run.rule_name || run.rule_type}</b><small>{fmt(run.started_at)} · {run.trigger === 'manual' ? '수동 실행' : '예약 실행'}</small></div><Pill tone={run.status === 'success' ? 'green' : run.status === 'failed' ? 'red' : 'gray'}>{statusLabel[run.status] || run.status}</Pill></div>;
}

// ── 보고서 자동 생성 ──────────────────────────────────────────────────────
export function ReportAutomationPage() {
  const { rules, reload } = useRules('report');
  const { runs } = useRuns('report');
  const [editing, setEditing] = useState<AutomationRule | 'new' | null>(null);
  const month = previousMonthKey();
  const ready = rules.filter(r => checkReportReadiness(r.config.advertiserName, month, r.config.requireActualData).ready).length;
  return <div className="auto28-page">
    <Header title="보고서 자동 생성" desc="정해진 날짜·시각에 월간 보고서·다음달 제안서 초안을 자동으로 만듭니다." action={<button className="btn primary" onClick={() => setEditing('new')}>+ 자동화 추가</button>} />
    <Kpis items={[{ label: '활성 자동화', value: rules.filter(x => x.enabled).length }, { label: '데이터 준비 완료', value: ready }, { label: '최근 생성 성공', value: runs.filter(x => x.status === 'success').length }, { label: '보류/실패', value: runs.filter(x => x.status === 'failed').length }]} />
    <div className="auto28-note"><b>서버 자동 실행 준비 중</b><span>규칙은 서버에 저장되지만, 정해진 시각의 자동 생성은 아직 준비 중입니다 - 지금은 "지금 생성" 버튼으로 수동 생성해주세요.</span></div>
    <section className="card auto28-card"><div className="auto28-cardhead"><div><h3>광고주별 보고서 자동화</h3><p>자동화가 만든 결과도 기존 저장된 월간 보고서·다음달 제안서에 저장됩니다.</p></div></div>
      <div className="table-scroll"><table className="data-table auto28-table"><thead><tr><th>광고주</th><th>보고서</th><th>실행 일정</th><th>대상 월</th><th>데이터 준비</th><th>상태</th><th>작업</th></tr></thead><tbody>
        {rules.length === 0 ? <tr><td colSpan={7}>등록된 자동화가 없습니다.</td></tr> : rules.map(r => { const rd = checkReportReadiness(r.config.advertiserName, month, r.config.requireActualData); return (
          <tr key={r.id}><td><b>{r.config.advertiserName || '-'}</b></td><td>{(r.config.types || []).map((t: string) => t === 'monthly' ? '월간 보고서' : '다음달 제안서').join(' · ')}</td><td>매월 {r.config.dayOfMonth}일 {r.config.time}</td><td>{month}</td>
          <td>{rd.ready ? <Pill tone="green">준비 완료</Pill> : <Pill tone="amber">보류</Pill>}<small>{rd.ready ? rd.periodLabel : rd.reasons[0]}</small></td><td><Pill tone={r.enabled ? 'green' : 'gray'}>{r.enabled ? 'ON' : '중지'}</Pill></td>
          <td><div className="auto28-actions"><button className="btn secondary mini" onClick={() => { generateReportsNow({ configId: r.id, advertiserId: r.config.advertiserId, advertiserName: r.config.advertiserName, types: r.config.types, dayOfMonth: r.config.dayOfMonth, time: r.config.time, sourcePeriod: 'previous_month', requireActualData: r.config.requireActualData, draftOnly: r.config.draftOnly, notifyOnFailure: r.config.notifyOnFailure, enabled: r.enabled, createdAt: r.created_at, updatedAt: r.updated_at }, month); }}>지금 생성</button>
          <button className="btn secondary mini" onClick={() => setEditing(r)}>수정</button><button className="btn secondary mini" onClick={() => { if (confirm('삭제할까요?')) automationApi.rules.remove(r.id).then(reload); }}>삭제</button></div></td></tr>
        ); })}
      </tbody></table></div></section>
    <section className="card auto28-card"><div className="auto28-cardhead"><div><h3>최근 실행 결과</h3></div><Link to="/automation/execution-logs">전체 실행 기록</Link></div>{runs.slice(0, 5).map(r => <RunRow key={r.id} run={r} />)}</section>
    {editing && <ReportRuleModal value={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
  </div>;
}
function ReportRuleModal({ value, onClose, onSaved }: { value: AutomationRule | null; onClose: () => void; onSaved: () => void }) {
  const [advs] = useAdvertisers();
  const c = value?.config || {};
  const [advertiserId, setAdvertiserId] = useState(c.advertiserId || advs[0]?.id || '');
  const [types, setTypes] = useState<string[]>(c.types || ['monthly', 'proposal']);
  const [dayOfMonth, setDayOfMonth] = useState(c.dayOfMonth || 1);
  const [time, setTime] = useState(c.time || '08:00');
  const [requireActualData, setRequireActualData] = useState(c.requireActualData !== false);
  const [enabled, setEnabled] = useState(value?.enabled !== false);
  const save = async () => {
    if (!types.length) { alert('보고서 유형을 하나 이상 선택하세요.'); return; }
    const adv = advs.find(a => a.id === advertiserId);
    const config = { advertiserId, advertiserName: adv?.name || '', types, dayOfMonth, time, requireActualData, draftOnly: true, notifyOnFailure: true };
    if (value) await automationApi.rules.update(value.id, { name: `${adv?.name} 보고서 자동화`, config, enabled });
    else await automationApi.rules.create({ type: 'report', advertiserId, name: `${adv?.name} 보고서 자동화`, config, enabled });
    onSaved(); onClose();
  };
  return <Modal title="보고서 자동화 설정" onClose={onClose}><div className="auto28-form">
    <label>광고주<select value={advertiserId} onChange={e => setAdvertiserId(e.target.value)}>{advs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label>실행일<input type="number" min="1" max="28" value={dayOfMonth} onChange={e => setDayOfMonth(Math.max(1, Math.min(28, Number(e.target.value) || 1)))} /></label>
    <label>실행 시각<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
    <div><span className="auto28-label">보고서 유형</span><div className="auto28-checks">
      <label><input type="checkbox" checked={types.includes('monthly')} onChange={e => setTypes(e.target.checked ? [...types, 'monthly'] : types.filter(x => x !== 'monthly'))} />월간 보고서</label>
      <label><input type="checkbox" checked={types.includes('proposal')} onChange={e => setTypes(e.target.checked ? [...types, 'proposal'] : types.filter(x => x !== 'proposal'))} />다음달 제안서</label>
    </div></div>
    <label className="span-2"><input type="checkbox" checked={requireActualData} onChange={e => setRequireActualData(e.target.checked)} /> 실제 저장 데이터가 있을 때만 생성</label>
    <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> 자동화 ON</label>
  </div><ModalActions onClose={onClose} onSave={save} /></Modal>;
}

// ── 광고 문구 자동 생성 ────────────────────────────────────────────────────
export function AdCopyAutomationPage() {
  const { rules, reload } = useRules('ad-copy');
  const { runs, reload: reloadRuns } = useRuns('ad-copy');
  const [editing, setEditing] = useState<AutomationRule | 'new' | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; provider: string | null } | null>(null);
  useEffect(() => { apiFetch<{ configured: boolean; provider: string | null }>('/ad-copy/ai-status').then(setAiStatus).catch(() => setAiStatus({ configured: false, provider: null })); }, []);
  const runNow = async (r: AutomationRule) => {
    setRunning(r.id);
    try { await automationApi.rules.runNow(r.id); } catch (e) { alert(e instanceof Error ? e.message : '실행에 실패했습니다.'); }
    finally { setRunning(null); void reload(); void reloadRuns(); }
  };
  const cadenceLabel = (c: Record<string, any>) => c.cadence === 'manual' ? '수동' : c.cadence === 'weekly' ? `매주 ${['일', '월', '화', '수', '목', '금', '토'][c.weekday ?? 1]} ${c.time}` : `매월 ${c.dayOfMonth || 1}일 ${c.time}`;
  return <div className="auto28-page">
    <Header title="광고 문구 자동 생성" desc="정해진 주기마다 광고 문구 시안을 AI로 생성하고 알림으로 전달합니다." action={<button className="btn primary" onClick={() => setEditing('new')}>+ 생성 규칙 추가</button>} />
    <Kpis items={[{ label: '활성 규칙', value: rules.filter(x => x.enabled).length }, { label: 'AI API 연결', value: aiStatus == null ? '확인 중' : aiStatus.configured ? `연결됨(${aiStatus.provider})` : '미연동', sub: aiStatus?.configured ? undefined : 'AD_COPY_AI_PROVIDER 서버 설정 필요' }, { label: '최근 생성 성공', value: runs.filter(x => x.status === 'success').length }]} />
    <section className="card auto28-card"><div className="auto28-cardhead"><div><h3>광고 문구 생성 규칙</h3><p>생성 결과는 알림으로 전달됩니다 - 검토 후 광고 제작 화면에 직접 반영해주세요.</p></div><Link to="/automation/execution-logs">실행 기록</Link></div>
      <div className="table-scroll"><table className="data-table auto28-table"><thead><tr><th>광고주</th><th>매체</th><th>목적</th><th>주기</th><th>상태</th><th>작업</th></tr></thead><tbody>
        {rules.length === 0 ? <tr><td colSpan={6}>등록된 생성 규칙이 없습니다.</td></tr> : rules.map(r => (
          <tr key={r.id}><td><b>{r.config.advertiserName || '-'}</b><small>{r.config.productName}</small></td><td>{r.config.channel}</td><td>{r.config.objective}</td><td>{cadenceLabel(r.config)}</td><td><Pill tone={r.enabled ? 'green' : 'gray'}>{r.enabled ? 'ON' : '중지'}</Pill></td>
          <td><div className="auto28-actions"><button className="btn secondary mini" disabled={running === r.id} onClick={() => runNow(r)}>{running === r.id ? '생성 중...' : '지금 생성'}</button><button className="btn secondary mini" onClick={() => setEditing(r)}>수정</button><button className="btn secondary mini" onClick={() => { if (confirm('삭제할까요?')) automationApi.rules.remove(r.id).then(reload); }}>삭제</button></div></td></tr>
        ))}
      </tbody></table></div></section>
    <section className="card auto28-card"><div className="auto28-cardhead"><div><h3>최근 생성 기록</h3></div></div>{runs.slice(0, 5).map(r => <RunRow key={r.id} run={r} />)}</section>
    {editing && <AdCopyRuleModal value={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
  </div>;
}
function AdCopyRuleModal({ value, onClose, onSaved }: { value: AutomationRule | null; onClose: () => void; onSaved: () => void }) {
  const [advs] = useAdvertisers();
  const c = value?.config || {};
  const [advertiserId, setAdvertiserId] = useState(c.advertiserId || advs[0]?.id || '');
  const [channel, setChannel] = useState(c.channel || '메타');
  const [productName, setProductName] = useState(c.productName || '');
  const [objective, setObjective] = useState(c.objective || '전환');
  const [targetAudience, setTargetAudience] = useState(c.targetAudience || '');
  const [keyBenefit, setKeyBenefit] = useState(c.keyBenefit || '');
  const [hookType, setHookType] = useState(c.hookType || '');
  const [cta, setCta] = useState(c.cta || '더 알아보기');
  const [cadence, setCadence] = useState(c.cadence || 'manual');
  const [weekday, setWeekday] = useState(c.weekday ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState(c.dayOfMonth || 1);
  const [time, setTime] = useState(c.time || '09:00');
  const [enabled, setEnabled] = useState(value?.enabled !== false);
  const save = async () => {
    const adv = advs.find(a => a.id === advertiserId);
    const config = { advertiserId, advertiserName: adv?.name || '', channel, productName, objective, targetAudience, keyBenefit, hookType, cta, cadence, weekday, dayOfMonth, time };
    if (value) await automationApi.rules.update(value.id, { name: `${adv?.name} 광고문구 자동화`, config, enabled });
    else await automationApi.rules.create({ type: 'ad-copy', advertiserId, name: `${adv?.name} 광고문구 자동화`, config, enabled });
    onSaved(); onClose();
  };
  return <Modal title="광고 문구 자동 생성 설정" onClose={onClose}><div className="auto28-form">
    <label>광고주<select value={advertiserId} onChange={e => setAdvertiserId(e.target.value)}>{advs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label>매체<select value={channel} onChange={e => setChannel(e.target.value)}>{['메타', '네이버', '구글 검색', '유튜브', '당근', '카카오', '틱톡'].map(x => <option key={x}>{x}</option>)}</select></label>
    <label>상품/서비스<input value={productName} onChange={e => setProductName(e.target.value)} /></label>
    <label>캠페인 목적<input value={objective} onChange={e => setObjective(e.target.value)} /></label>
    <label>타겟<input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} /></label>
    <label>핵심 혜택<input value={keyBenefit} onChange={e => setKeyBenefit(e.target.value)} /></label>
    <label>후킹 유형<input value={hookType} onChange={e => setHookType(e.target.value)} /></label>
    <label>CTA<input value={cta} onChange={e => setCta(e.target.value)} /></label>
    <label>주기<select value={cadence} onChange={e => setCadence(e.target.value)}><option value="manual">수동</option><option value="weekly">매주</option><option value="monthly">매월</option></select></label>
    <label>실행 시각<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
    {cadence === 'weekly' && <label>요일<select value={weekday} onChange={e => setWeekday(Number(e.target.value))}>{['일', '월', '화', '수', '목', '금', '토'].map((x, i) => <option key={i} value={i}>{x}</option>)}</select></label>}
    {cadence === 'monthly' && <label>실행일<input type="number" min="1" max="28" value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value) || 1)} /></label>}
    <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> 규칙 ON</label>
  </div><ModalActions onClose={onClose} onSave={save} /></Modal>;
}

// ── 알림 자동화 ───────────────────────────────────────────────────────────
const triggerLabels: Record<string, string> = { performance_anomaly: '성과 이상', kpi_miss: 'KPI 미달', budget_pacing: '예산 소진', data_collection_failed: '데이터 수집 실패', automation_failed: '자동화 실패', review_required: '검토 요청', manual: '수동' };
export function NotificationAutomationPage() {
  const { rules, reload } = useRules('notification');
  const [notices, setNotices] = useState<AutomationNotification[]>([]);
  const reloadNotices = async () => { try { setNotices(await automationApi.notifications.list()); } catch { setNotices([]); } };
  useEffect(() => { void reloadNotices(); }, []);
  const [editing, setEditing] = useState<AutomationRule | 'new' | null>(null);
  return <div className="auto28-page">
    <Header title="알림 자동화" desc="성과 이상·예산 소진 등 조건이 발생했을 때 내부 담당자에게 알림을 생성합니다." action={<button className="btn primary" onClick={() => setEditing('new')}>+ 알림 규칙</button>} />
    <Kpis items={[{ label: '활성 규칙', value: rules.filter(x => x.enabled).length }, { label: '읽지 않은 알림', value: notices.filter(x => !x.read_at).length }, { label: '지원 트리거', value: '예산 소진(우선 지원)' }]} />
    <div className="auto28-two">
      <section className="card auto28-card"><div className="auto28-cardhead"><div><h3>알림 규칙</h3><p>지금은 "예산 소진(budget_pacing)" 트리거만 서버가 매시 정각에 실제로 확인합니다. 나머지 트리거는 준비 중입니다.</p></div></div>
        {rules.length === 0 ? <div className="auto28-empty">등록된 규칙이 없습니다.</div> : rules.map(r => (
          <div className="auto28-listrow" key={r.id}><div><b>{r.name}</b><small>{triggerLabels[r.config.triggerType] || r.config.triggerType} · {r.config.advertiserName || '전체 광고주'}</small></div>
          <div className="auto28-actions"><Pill tone={r.enabled ? 'green' : 'gray'}>{r.enabled ? 'ON' : '중지'}</Pill><button className="btn secondary mini" onClick={() => setEditing(r)}>수정</button><button className="btn secondary mini" onClick={() => { if (confirm('삭제할까요?')) automationApi.rules.remove(r.id).then(reload); }}>삭제</button></div></div>
        ))}
      </section>
      <section className="card auto28-card"><div className="auto28-cardhead"><div><h3>알림함</h3><p>네이버웍스·이메일은 서버 연동 전까지 실제 발송하지 않습니다.</p></div></div>
        {notices.length === 0 ? <div className="auto28-empty">생성된 알림이 없습니다.</div> : notices.slice(0, 8).map(n => (
          <div className={`auto28-notice ${n.read_at ? 'read' : ''}`} key={n.id}><div><b>{n.title}</b><small>{n.message}</small><time>{fmt(n.created_at)}</time></div>
          {!n.read_at && <button className="btn secondary mini" onClick={() => automationApi.notifications.markRead(n.id).then(reloadNotices)}>읽음</button>}</div>
        ))}
      </section>
    </div>
    {editing && <NotificationRuleModal value={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
  </div>;
}
function NotificationRuleModal({ value, onClose, onSaved }: { value: AutomationRule | null; onClose: () => void; onSaved: () => void }) {
  const [advs] = useAdvertisers();
  const c = value?.config || {};
  const [name, setName] = useState(value?.name || '예산 소진 경고');
  const [advertiserId, setAdvertiserId] = useState(c.advertiserId || '');
  const [triggerType, setTriggerType] = useState(c.triggerType || 'budget_pacing');
  const [threshold, setThreshold] = useState(c.threshold ?? 90);
  const [recipient, setRecipient] = useState(c.recipient || 'admin');
  const [enabled, setEnabled] = useState(value?.enabled !== false);
  const save = async () => {
    const adv = advs.find(a => a.id === advertiserId);
    const config = { advertiserId: advertiserId || undefined, advertiserName: adv?.name, triggerType, threshold, recipient, channels: ['internal'], dedupeHours: 24 };
    if (value) await automationApi.rules.update(value.id, { name, config, enabled });
    else await automationApi.rules.create({ type: 'notification', advertiserId: advertiserId || undefined, name, config, enabled });
    onSaved(); onClose();
  };
  return <Modal title="알림 자동화 규칙" onClose={onClose}><div className="auto28-form">
    <label className="span-2">규칙 이름<input value={name} onChange={e => setName(e.target.value)} /></label>
    <label>트리거<select value={triggerType} onChange={e => setTriggerType(e.target.value)}>{Object.entries(triggerLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
    <label>광고주<select value={advertiserId} onChange={e => setAdvertiserId(e.target.value)}><option value="">전체 광고주</option>{advs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    {triggerType === 'budget_pacing' && <label>예산 소진율 기준(%)<input type="number" min="1" max="200" value={threshold} onChange={e => setThreshold(Number(e.target.value) || 90)} /></label>}
    <label>수신 대상<select value={recipient} onChange={e => setRecipient(e.target.value)}><option value="advertiser_manager">광고주 담당자</option><option value="admin">관리자</option><option value="content_manager">콘텐츠 담당자</option><option value="all">전체</option></select></label>
    <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> 규칙 ON</label>
  </div><ModalActions onClose={onClose} onSave={save} /></Modal>;
}

// ── 작업 흐름(워크플로우) ───────────────────────────────────────────────
export function WorkflowsPage() {
  const { rules, reload } = useRules('workflow');
  const [editing, setEditing] = useState<AutomationRule | 'new' | null>(null);
  return <div className="auto28-page">
    <Header title="작업 흐름" desc="여러 자동화 작업을 순서대로 연결합니다." action={<button className="btn primary" onClick={() => setEditing('new')}>+ 작업 흐름</button>} />
    <Kpis items={[{ label: '작업 흐름', value: rules.length }, { label: '활성', value: rules.filter(x => x.enabled).length }]} />
    <div className="auto28-note"><b>서버 자동 실행 준비 중</b><span>규칙은 저장되지만, 단계별 자동 실행은 아직 준비 중입니다.</span></div>
    <section className="card auto28-card">{rules.length === 0 ? <div className="auto28-empty">등록된 작업 흐름이 없습니다.</div> : rules.map(w => (
      <div className="auto28-workflow" key={w.id}><div className="auto28-cardhead"><div><h3>{w.name}</h3><p>{w.config.advertiserName || '공통'} · {(w.config.steps || []).length}단계</p></div>
      <div className="auto28-actions"><Pill tone={w.enabled ? 'green' : 'gray'}>{w.enabled ? 'ON' : '중지'}</Pill><button className="btn secondary mini" onClick={() => setEditing(w)}>수정</button><button className="btn secondary mini" onClick={() => { if (confirm('삭제할까요?')) automationApi.rules.remove(w.id).then(reload); }}>삭제</button></div></div>
      <div className="auto28-steps">{(w.config.steps || []).map((s: any, i: number) => <div className="auto28-step" key={i}><i>{i + 1}</i><div><b>{s.name}</b></div>{i < w.config.steps.length - 1 && <span>↓</span>}</div>)}</div></div>
    ))}</section>
    {editing && <WorkflowRuleModal value={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
  </div>;
}
const stepLabels: Record<string, string> = { data_sync: '데이터 동기화', data_validation: '데이터 품질 검사', report_generation: '보고서 생성', ad_copy_generation: '광고 문구 생성', notification: '내부 알림', approval: '담당자 승인', wait: '대기' };
function WorkflowRuleModal({ value, onClose, onSaved }: { value: AutomationRule | null; onClose: () => void; onSaved: () => void }) {
  const [advs] = useAdvertisers();
  const c = value?.config || {};
  const [name, setName] = useState(value?.name || '월간 보고 업무');
  const [advertiserId, setAdvertiserId] = useState(c.advertiserId || '');
  const [steps, setSteps] = useState<{ type: string; name: string }[]>(c.steps || [{ type: 'data_sync', name: '광고 데이터 동기화' }]);
  const [enabled, setEnabled] = useState(value?.enabled !== false);
  const addStep = (type: string) => setSteps([...steps, { type, name: stepLabels[type] }]);
  const save = async () => {
    const adv = advs.find(a => a.id === advertiserId);
    const config = { advertiserId: advertiserId || undefined, advertiserName: adv?.name, steps };
    if (value) await automationApi.rules.update(value.id, { name, config, enabled });
    else await automationApi.rules.create({ type: 'workflow', advertiserId: advertiserId || undefined, name, config, enabled });
    onSaved(); onClose();
  };
  return <Modal title="작업 흐름 편집" onClose={onClose} wide><div className="auto28-form">
    <label className="span-2">이름<input value={name} onChange={e => setName(e.target.value)} /></label>
    <label>광고주<select value={advertiserId} onChange={e => setAdvertiserId(e.target.value)}><option value="">공통</option>{advs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
  </div>
    <div className="auto28-step-editor">{steps.map((s, i) => <div className="auto28-stepedit" key={i}><i>{i + 1}</i>
      <select value={s.type} onChange={e => setSteps(steps.map((x, j) => j === i ? { type: e.target.value, name: stepLabels[e.target.value] } : x))}>{Object.entries(stepLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <input value={s.name} onChange={e => setSteps(steps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
      <button className="btn secondary mini" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>삭제</button></div>)}</div>
    <div className="auto28-step-buttons">{Object.entries(stepLabels).map(([k, l]) => <button className="btn secondary mini" key={k} onClick={() => addStep(k)}>+ {l}</button>)}</div>
    <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> 작업 흐름 ON</label>
  <ModalActions onClose={onClose} onSave={save} /></Modal>;
}

// ── 실행 기록 ────────────────────────────────────────────────────────────
export function ExecutionLogsPage() {
  const { runs } = useRuns();
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<AutomationRun | null>(null);
  const filtered = runs.filter(r => (type === 'all' || r.rule_type === type) && (status === 'all' || r.status === status));
  return <div className="auto28-page">
    <Header title="실행 기록" desc="보고서·광고 문구·알림·작업 흐름 실행을 서버 기준으로 추적합니다." />
    <Kpis items={[{ label: '전체 실행', value: runs.length }, { label: '성공', value: runs.filter(x => x.status === 'success').length }, { label: '실패', value: runs.filter(x => x.status === 'failed').length }]} />
    <section className="card auto28-card"><div className="auto28-filters">
      <select value={type} onChange={e => setType(e.target.value)}><option value="all">전체 유형</option>{['report', 'ad-copy', 'notification', 'workflow'].map(x => <option key={x} value={x}>{x}</option>)}</select>
      <select value={status} onChange={e => setStatus(e.target.value)}><option value="all">전체 결과</option>{['success', 'failed', 'running'].map(x => <option key={x} value={x}>{statusLabel[x]}</option>)}</select>
    </div>
      <div className="table-scroll"><table className="data-table auto28-table"><thead><tr><th>실행 시각</th><th>규칙</th><th>유형</th><th>트리거</th><th>결과</th></tr></thead><tbody>
        {filtered.length === 0 ? <tr><td colSpan={5}>실행 기록이 없습니다.</td></tr> : filtered.map(r => (
          <tr key={r.id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}><td>{fmt(r.started_at)}</td><td><b>{r.rule_name || '-'}</b></td><td>{r.rule_type}</td><td>{r.trigger === 'manual' ? '수동' : '예약'}</td>
          <td><Pill tone={r.status === 'success' ? 'green' : r.status === 'failed' ? 'red' : 'gray'}>{statusLabel[r.status] || r.status}</Pill></td></tr>
        ))}
      </tbody></table></div></section>
    {selected && <Modal title="실행 상세" onClose={() => setSelected(null)} wide>
      <div className="auto28-detailgrid"><div><span>실행 ID</span><b>{selected.id}</b></div><div><span>결과</span><b>{statusLabel[selected.status] || selected.status}</b></div><div><span>시작</span><b>{fmt(selected.started_at)}</b></div><div><span>종료</span><b>{fmt(selected.finished_at)}</b></div></div>
      {selected.error && <div className="auto28-error"><span>{selected.error}</span></div>}
      {selected.result && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(selected.result, null, 2)}</pre>}
      <ModalActions onClose={() => setSelected(null)} /></Modal>}
  </div>;
}
