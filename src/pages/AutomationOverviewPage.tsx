import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, Database, PauseCircle, RefreshCw, XCircle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { AUTOMATION_EVENT, getAllAutomationJobs, loadAutomationRuns } from '../automation/automationStore';
import { findScheduleConflicts } from '../automation/scheduleConflict';
import { formatKoreanDateTime, nextOccurrences, nextRunIso } from '../automation/scheduleEngine';
import type { AutomationJob, AutomationRun } from '../automation/automationTypes';

function dayKey(value: string | Date) {
  const d=value instanceof Date?value:new Date(value); if(Number.isNaN(+d))return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const typeLabel:Record<string,string>={campaign_on:'캠페인 ON',campaign_off:'캠페인 OFF',campaign_schedule:'캠페인 예약',data_sync:'데이터 동기화',notification:'알림',report_generation:'보고서 생성',ai_analysis:'AI 분석',content_generation:'콘텐츠 생성'};
const statusLabel:Record<string,string>={active:'ON',paused:'일시중지',disabled:'OFF',success:'성공',failed:'실패',running:'실행 중',queued:'대기',skipped:'건너뜀'};

export function AutomationOverviewPage(){
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const refresh=()=>setRevision(x=>x+1);window.addEventListener(AUTOMATION_EVENT,refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener(AUTOMATION_EVENT,refresh);window.removeEventListener('storage',refresh)}},[]);
  const jobs=useMemo(()=>getAllAutomationJobs(),[revision]);
  const runs=useMemo(()=>loadAutomationRuns(),[revision]);
  const conflicts=useMemo(()=>findScheduleConflicts(jobs),[jobs]);
  const today=dayKey(new Date());
  const todayRuns=runs.filter(r=>dayKey(r.startedAt||r.createdAt)===today);
  const active=jobs.filter(j=>j.status==='active');
  const paused=jobs.filter(j=>j.status==='paused');
  const failures=todayRuns.filter(r=>r.status==='failed');
  const successes=todayRuns.filter(r=>r.status==='success');
  const next=active.map(j=>({job:j,at:j.nextRunAt||nextRunIso(j.schedule)})).filter(x=>x.at).sort((a,b)=>String(a.at).localeCompare(String(b.at)))[0];
  const health=todayRuns.length?Math.max(0,Math.round((successes.length/Math.max(1,todayRuns.length))*100 - conflicts.length*5)):null;
  const dataJobs=jobs.filter(j=>j.jobType==='data_sync');
  const campaignJobs=jobs.filter(j=>['campaign_on','campaign_off','campaign_schedule'].includes(j.jobType));
  const notificationJobs=jobs.filter(j=>j.jobType==='notification');
  const reportJobs=jobs.filter(j=>j.jobType==='report_generation');
  const contentJobs=jobs.filter(j=>j.jobType==='content_generation');
  const upcomingToday=active.flatMap(j=>nextOccurrences(j.schedule,8).filter(d=>dayKey(d)===today).map(d=>({kind:'planned' as const,at:d,job:j}))).sort((a,b)=>+a.at-+b.at);
  const runItems=todayRuns.map(r=>({kind:'run' as const,at:new Date(r.startedAt||r.createdAt),run:r}));
  const timeline=[...runItems,...upcomingToday].sort((a,b)=>+a.at-+b.at).slice(0,20);
  const issues=[...failures.map(r=>({title:r.jobName,detail:r.errorMessage||'실행 실패 기록을 확인해 주세요.',link:'/automation/execution-logs'})),...conflicts.map(c=>({title:c.title,detail:c.detail,link:'/automation/scheduled-jobs'}))].slice(0,5);
  const routeFor=(j:AutomationJob)=>j.jobType==='data_sync'?'/automation/data-collection':['campaign_on','campaign_off','campaign_schedule'].includes(j.jobType)?'/automation/scheduled-jobs':j.jobType==='report_generation'?'/automation/report-generation':j.jobType==='content_generation'?'/automation/ad-copy':j.jobType==='notification'?'/automation/notifications':'/automation/scheduled-jobs';
  return <div className="automation-engine-page">
    <PageHeader title="자동화 현황" description="HOWTOM 자동화의 활성 상태, 오늘 실행 기록, 다음 실행과 확인 필요 항목을 한 화면에서 봅니다." action={<button className="btn secondary" onClick={()=>setRevision(x=>x+1)}><RefreshCw size={15}/> 새로고침</button>}/>
    <div className="automation-pre-revenue-note"><b>Pre-Revenue 운영 모드</b><span>현재는 브라우저에서 설정·다음 실행 계산·기록 관제를 수행합니다. 실제 24시간 백그라운드 실행은 서버 Executor 연결 후 활성화됩니다.</span></div>
    <div className="auto-kpi-grid">
      <div className="auto-kpi-card"><span>활성 자동화</span><strong>{active.length}개</strong><small>예약·규칙 포함</small></div>
      <div className="auto-kpi-card"><span>오늘 실행 기록</span><strong>{todayRuns.length}회</strong><small>실제 저장된 실행 기록</small></div>
      <div className="auto-kpi-card"><span>성공</span><strong className="text-success">{successes.length}회</strong><small>{todayRuns.length?'오늘 기록 기준':'기록 없음'}</small></div>
      <div className="auto-kpi-card"><span>실패</span><strong className={failures.length?'text-danger':''}>{failures.length}회</strong><small>확인 필요</small></div>
      <div className="auto-kpi-card"><span>다음 실행</span><strong>{next?formatKoreanDateTime(next.at):'없음'}</strong><small>{next?.job.name||'예약 없음'}</small></div>
      <div className="auto-kpi-card"><span>일시중지</span><strong>{paused.length}개</strong><small>사용자 설정 기준</small></div>
    </div>

    <section className="auto-status-grid">
      <Link to="/automation/data-collection" className="auto-status-card"><div><Database size={18}/><b>데이터 자동 수집</b></div><strong>{dataJobs.length?`${dataJobs.filter(j=>j.status==='active').length}개 설정`:'설정 없음'}</strong><small>Google Sheet·향후 광고 API 수집</small></Link>
      <Link to="/automation/scheduled-jobs" className="auto-status-card"><div><CalendarClock size={18}/><b>캠페인 예약</b></div><strong>{campaignJobs.length?`${campaignJobs.length}개 일정`:'예약 없음'}</strong><small>캠페인 관리의 일정도 함께 표시</small></Link>
      <Link to="/automation/report-generation" className="auto-status-card"><div><Activity size={18}/><b>보고서 자동 생성</b></div><strong>{reportJobs.length?`${reportJobs.filter(j=>j.status==='active').length}개 설정`:'설정 없음'}</strong><small>월간 보고서·다음달 제안서 초안 자동화</small></Link>
      <Link to="/automation/ad-copy" className="auto-status-card"><div><Activity size={18}/><b>광고 문구 자동 생성</b></div><strong>{contentJobs.length?`${contentJobs.filter(j=>j.status==='active').length}개 설정`:'설정 없음'}</strong><small>현재 템플릿 기반 · AI API 후순위</small></Link>
      <Link to="/automation/notifications" className="auto-status-card"><div><AlertTriangle size={18}/><b>알림 자동화</b></div><strong>{notificationJobs.length?`${notificationJobs.length}개 규칙`:'설정 없음'}</strong><small>내부 알림 · 외부 채널 후순위</small></Link>
    </section>

    <div className="auto-two-column">
      <section className="card auto-panel"><div className="auto-panel-head"><div><h3>오늘의 실행 타임라인</h3><p>실행 기록과 오늘 예정된 구조화 예약을 시간 순서로 표시합니다.</p></div></div>
        {timeline.length===0?<div className="auto-empty">오늘 실행 기록 또는 구조화된 예약이 없습니다.</div>:<div className="auto-timeline">{timeline.map((item,i)=>item.kind==='run'?<div className="auto-timeline-row" key={`r-${item.run.runId}-${i}`}><time>{formatKoreanDateTime(item.at).split(' ')[1]}</time><span className={`auto-dot ${item.run.status}`}/><div><b>{item.run.jobName}</b><small>{statusLabel[item.run.status]||item.run.status}{item.run.recordsProcessed!=null?` · ${item.run.recordsProcessed.toLocaleString()}건`:''}</small></div></div>:<div className="auto-timeline-row" key={`p-${item.job.jobId}-${i}`}><time>{formatKoreanDateTime(item.at).split(' ')[1]}</time><span className="auto-dot queued"/><div><b>{item.job.name}</b><small>예정 · {typeLabel[item.job.jobType]||item.job.jobType}</small></div></div>)}</div>}
      </section>
      <section className="card auto-panel"><div className="auto-panel-head"><div><h3>자동화 건강도</h3><p>실제 실행 기록과 예약 충돌을 기준으로 계산합니다.</p></div>{health==null?<span className="auto-health pending">평가 보류</span>:<span className={`auto-health ${health>=90?'good':health>=70?'warning':'danger'}`}>{health} / 100</span>}</div>
        <div className="auto-health-lines"><div><span>정상 실행률</span><b>{todayRuns.length?`${Math.round(successes.length/Math.max(1,todayRuns.length)*100)}%`:'기록 없음'}</b></div><div><span>실패 실행</span><b>{failures.length}건</b></div><div><span>예약 충돌</span><b>{conflicts.length}건</b></div><div><span>구조화 예약</span><b>{jobs.filter(j=>j.schedule).length}개</b></div></div>
      </section>
    </div>

    {issues.length>0&&<section className="card auto-panel auto-issue-panel"><div className="auto-panel-head"><div><h3>자동화 확인 필요 {issues.length}건</h3><p>실패 기록 또는 충돌이 있는 항목입니다.</p></div></div>{issues.map((issue,i)=><div className="auto-issue-row" key={`${issue.title}-${i}`}><XCircle size={17}/><div><b>{issue.title}</b><small>{issue.detail}</small></div><Link to={issue.link}>확인</Link></div>)}</section>}

    <section className="card auto-panel"><div className="auto-panel-head"><div><h3>자동화 전체</h3><p>자동화 현황에서는 설정을 중복 편집하지 않고 각 관리 화면으로 이동합니다.</p></div><span>{jobs.length}개</span></div>
      <div className="table-scroll"><table className="data-table auto-table"><thead><tr><th>자동화</th><th>유형</th><th>광고주</th><th>주기</th><th>다음 실행</th><th>상태</th><th>실행 방식</th><th></th></tr></thead><tbody>{jobs.length===0?<tr><td colSpan={8} className="auto-table-empty">등록된 자동화가 없습니다.</td></tr>:jobs.map(j=><tr key={j.jobId}><td><b>{j.name}</b>{j.targetName&&<small>{j.targetName}</small>}</td><td>{typeLabel[j.jobType]||j.jobType}</td><td>{j.advertiserName||'전체'}</td><td>{j.scheduleText|| (j.schedule?`${j.schedule.scheduleType} · ${j.schedule.time}`:'조건 기반')}</td><td>{j.nextRunAt||j.schedule?formatKoreanDateTime(j.nextRunAt||nextRunIso(j.schedule)):'-'}</td><td><span className={`auto-state ${j.status}`}>{statusLabel[j.status]||j.status}</span></td><td>{j.implementationStatus==='available'?'프론트 사용 가능':j.implementationStatus==='mock'?'서버 실행 미연동':'(미구현)'}</td><td><Link to={routeFor(j)}>관리</Link></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
