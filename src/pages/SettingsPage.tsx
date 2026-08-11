import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  BellRing,
  Calculator,
  ChevronLeft,
  Clock3,
  Database,
  Gauge,
  KeyRound,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  Workflow,
  Plus,
  Search,
  PencilLine,
  Trash2,
  RotateCcw,
  X,
  Eye,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { METRIC_FORMULA_CATALOG, METRIC_FORMULA_GROUPS, METRIC_FORMULA_CHANNELS, loadMetricFormulas, saveMetricFormulas, type MetricFormula } from '../data/metricFormulas';
import { DEFAULT_REPORT_INTEGRATION_SETTINGS, loadReportIntegrationSettings, saveReportIntegrationSettings, type ReportIntegrationSettings } from '../data/reportIntegrations';
import { loadCustomPlatforms, saveCustomPlatforms, loadMetricLabelOverrides, saveMetricLabelOverrides, loadCustomMetrics, saveCustomMetrics, type CustomMetricDefinition } from '../utils/metricCatalog';
import { universePermissionItems } from '../data/universeMenu';
import { BASE_ADVERTISERS, loadExtraAdvertisers } from '../features/reports/reportCore';
import { deleteAdvertiserSetting, loadAdvertiserSettings, saveAdvertiserSetting, AD_PLATFORM_OPTIONS, AD_PLACEMENT_OPTIONS, AD_TYPE_OPTIONS, type AdvertiserPreset, type AdvertiserSetting } from '../utils/advertiserSettings';
import { RAW_METRICS, loadProfiles, saveProfiles, inferReportType } from '../features/reports/reportCore';
import { loadCustomRoles, saveCustomRoles, type CustomRole, type MenuAccessLevel } from '../utils/customRoles';
import { generateSampleData, deleteSampleData, hasSampleData } from '../utils/testSeed';
import { loadProposalSettings, saveProposalSettings, detectPreset, PROPOSAL_SETTINGS_PRESETS, type ProposalCalculationSettings, type ProposalSettingsPreset } from '../utils/proposalSettings';
import { deleteDbRowsForConnection, loadDbConnections, saveDbConnections, type GoogleSheetDbConnection } from '../utils/dbDataStore';
import { syncDbConnection } from '../utils/googleSheetDbSync';

type SettingsSectionKey =
  | 'advertisers'
  | 'metrics'
  | 'funnel-events'
  | 'users-permissions'
  | 'notifications'
  | 'data-collection'
  | 'report-integrations'
  | 'db-integrations'
  | 'formulas-thresholds'
  | 'proposal-settings'
  | 'backup'
  | 'test-data';

type SettingsSection = {
  key: SettingsSectionKey;
  title: string;
  description: string;
  icon: typeof Users;
  status?: string;
};

const sections: SettingsSection[] = [
  { key: 'advertisers', title: '광고주 설정', description: '광고주 기본 정보, 업종, 기본 지표 프리셋과 담당자를 관리합니다.', icon: Users },
  { key: 'metrics', title: '지표 표시 설정', description: '대시보드, 퍼널, 보고서에서 기본으로 노출할 지표를 설정합니다.', icon: SlidersHorizontal },
  { key: 'funnel-events', title: '퍼널 이벤트 매핑', description: '매체별 이벤트를 DB, 회원가입, 장바구니, 구매 등 표준 이벤트로 연결합니다.', icon: Workflow },
  { key: 'users-permissions', title: '사용자 권한', description: '관리자, 운영자, 조회 전용 및 한정 전용 역할의 메뉴 권한을 관리합니다.', icon: UserCog },
  { key: 'notifications', title: '알림 설정', description: '수집 실패, 예산 초과, 성과 급락 알림 채널과 수신 대상을 설정합니다.', icon: BellRing },
  { key: 'data-collection', title: '데이터 수집 시간', description: '전일 데이터 수집과 오전 7시 완료 기준, 재수집 정책을 관리합니다.', icon: Clock3 },
  { key: 'report-integrations', title: '보고서 외부 연동', description: '생성 보고서를 Google Sheets, Notion, Excel, PDF 일일보고로 전송하고 저장합니다.', icon: Database },
  { key: 'db-integrations', title: 'DB·Google Sheets 연동', description: '광고주별 Google Sheets의 DB·유효 DB·계약 집계 데이터를 HOWTOM 유니버스로 가져옵니다.', icon: Database },
  { key: 'formulas-thresholds', title: '수식 및 임계값', description: 'CTR, CPA, ROAS, 피로도, 예산 경고 기준과 계산 방식을 관리합니다.', icon: Calculator },
  { key: 'proposal-settings', title: '제안 계산 기준', description: '다음달 제안서의 신규 매체 예산 비율, 증액·감액 폭 등 계산 기준값을 조정합니다.', icon: SlidersHorizontal },
  { key: 'backup', title: '데이터 백업·복원', description: '저장된 전체 데이터를 파일로 백업하고, 필요할 때 복원합니다.', icon: Database },
  { key: 'test-data', title: '테스트 샘플 데이터', description: '등록 광고주 전체에 5·6·7월 샘플 데이터를 만들어 월간 보고서 비교 기능을 미리 확인합니다. 앱을 처음 실행하면 자동으로 한 번 생성됩니다.', icon: RefreshCw },
];

export function SettingsPage() {
  return (
    <div className="settings-page">
      <PageHeader title="환경설정" description="HOWTOM 유니버스의 공통 운영 기준과 사용자 설정을 관리합니다." />
      <section className="settings-summary-bar">
        <div><Settings2 size={18}/><span><strong>{sections.length}개</strong> 설정 영역</span></div>
        <p>변경 사항은 각 설정 화면에서 저장한 뒤 적용됩니다.</p>
      </section>
      <div className="settings-grid settings-grid-refined">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.key} to={`/settings/${section.key}`} className="settings-card settings-card-link">
              <div className="settings-card-icon"><Icon size={20}/></div>
              <div className="settings-card-copy">
                <strong>{section.title}</strong>
                <span>{section.description}</span>
              </div>
              <em>설정 열기 <span>→</span></em>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsDetailPage() {
  const { sectionKey } = useParams<{ sectionKey: SettingsSectionKey }>();
  const section = sections.find((item) => item.key === sectionKey);
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState(0);
  const contentRef = useRef<HTMLElement | null>(null);
  const storageKey = `adcc-settings-${sectionKey ?? 'unknown'}`;
  if (!section) return <Navigate to="/settings" replace />;
  const Icon = section.icon;

  const readSnapshot = () => {
    const root = contentRef.current;
    if (!root) return {};
    const values: Record<string, string | boolean> = {};
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea').forEach((el, index) => {
      const key = el.getAttribute('data-setting-key') || `${el.tagName.toLowerCase()}-${index}`;
      values[key] = el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
    });
    root.querySelectorAll<HTMLButtonElement>('button.switch').forEach((el, index) => {
      values[`switch-${index}`] = el.getAttribute('aria-pressed') === 'true';
    });
    return values;
  };

  const applySnapshot = (snapshot: Record<string, string | boolean>) => {
    const root = contentRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea').forEach((el, index) => {
      const key = el.getAttribute('data-setting-key') || `${el.tagName.toLowerCase()}-${index}`;
      if (!(key in snapshot)) return;
      const value = snapshot[key];
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        if (el.checked !== Boolean(value)) el.click();
      } else {
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    root.querySelectorAll<HTMLButtonElement>('button.switch').forEach((el, index) => {
      const key = `switch-${index}`;
      if (key in snapshot && (el.getAttribute('aria-pressed') === 'true') !== Boolean(snapshot[key])) el.click();
    });
  };

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const timer = window.setTimeout(() => {
      try { applySnapshot(JSON.parse(raw)); } catch { /* ignore invalid legacy data */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey, version]);

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify(readSnapshot()));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  const handleCancel = () => {
    setVersion((value) => value + 1);
  };
  return (
    <div className="settings-detail-page">
      <div className="settings-detail-topline">
        <Link to={sectionKey === 'report-integrations' || sectionKey === 'proposal-settings' ? '/settings/control/reports' : '/settings/control/metrics'} className="settings-back"><ChevronLeft size={16}/> 설정으로 돌아가기</Link>
        {saved && <span className="settings-save-toast">설정이 저장되었습니다.</span>}
      </div>
      <div className="settings-detail-header">
        <div className="settings-detail-title-icon"><Icon size={22}/></div>
        <div>
          <h1>{section.title}</h1>
          <p>{section.description}</p>
        </div>
      </div>
      <div className="settings-detail-layout">
        <aside className="settings-detail-nav">
          <p>설정 항목</p>
          {getSubmenu(section.key).map((item, index) => <a key={item} href={`#setting-${index}`} className={index === 0 ? 'active' : ''}>{item}</a>)}
        </aside>
        <main className="settings-detail-content" ref={contentRef}>
          {renderSettingsContent(section.key)}
          <div className="settings-sticky-actions">
            <button className="btn btn-secondary" onClick={handleCancel}>변경 취소</button>
            <button className="btn btn-primary" onClick={handleSave}><Save size={14}/> 변경사항 저장</button>
          </div>
        </main>
      </div>
    </div>
  );
}

function getSubmenu(key: SettingsSectionKey): string[] {
  const map: Record<SettingsSectionKey, string[]> = {
    advertisers: ['기본 정보', '지표 프리셋', '담당자 배정'],
    metrics: ['기본 표시 지표', '지표 관리', '매체 관리'],
    'funnel-events': ['표준 이벤트', '매체 이벤트 매핑', '검증 규칙'],
    'users-permissions': ['사용자 목록', '역할 권한'],
    notifications: ['알림 채널', '알림 조건', '수신 대상'],
    'data-collection': ['수집 시간', '재시도 정책', '완료 기준'],
    'report-integrations': ['Google Sheets', 'Notion', 'PDF 및 파일'],
    'db-integrations': ['Google Sheets 연결', '동기화 정책', '데이터 기준'],
    'formulas-thresholds': ['지표 수식', '예산 임계값', '피로도 임계값'],
    'proposal-settings': ['예산 배분 비율', '증액·감액 기준'],
    backup: ['전체 백업', '복원', '저장 공간'],
    'test-data': ['샘플 생성·삭제'],
  };
  return map[key];
}

function SectionCard({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return <section id={id} className="settings-form-card"><div className="settings-form-card-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div><div className="settings-form-body">{children}</div></section>;
}

function Toggle({ label, description, defaultChecked = false }: { label: string; description?: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return <label className="setting-toggle-row"><span><strong>{label}</strong>{description && <small>{description}</small>}</span><button type="button" className={`switch ${checked ? 'on' : ''}`} onClick={() => setChecked(!checked)} aria-pressed={checked}><i/></button></label>;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="settings-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function CheckboxGrid({ values }: { values: string[] }) {
  const [selected, setSelected] = useState(values.slice(0, Math.max(2, values.length - 2)));
  return <div className="settings-checkbox-grid">{values.map((value) => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => setSelected((prev) => prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value])}/><span>{value}</span></label>)}</div>;
}

function TestDataSettings() {
  const [hasData, setHasData] = useState(() => hasSampleData());
  const [status, setStatus] = useState('');
  const run = (label: string, fn: () => { ok: boolean; count?: number; error?: string }) => {
    const result = fn();
    setHasData(hasSampleData());
    if (!result.ok) { setStatus(`오류: ${result.error ?? '알 수 없는 문제가 발생했습니다.'}`); return; }
    setStatus(label + (result.count !== undefined ? ` (${result.count}건)` : ''));
    setTimeout(() => setStatus(''), 4000);
  };
  return (
    <SectionCard id="setting-testdata" title="테스트 샘플 데이터" description="등록된 광고주 전체(추가 광고주·저장된 프로필 포함)에 5·6·7월 샘플 데이터를 만들어, 월간 보고서의 전월 비교·자동 인사이트 기능을 데이터 입력 없이 미리 확인할 수 있습니다.">
      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 14 }}>
        샘플 데이터는 실제 보고서와 분리된 테스트 전용 저장소에 보관됩니다. 같은 광고주·월에 실제 데이터가 있으면 월간 보고서와 전체 통합형은 실제 데이터만 사용하며, 샘플은 실제 데이터가 없을 때만 테스트용으로 표시됩니다.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={() => run('샘플 데이터를 생성했습니다.', generateSampleData)}><RefreshCw size={15}/> 샘플 생성</button>
        <button className="btn secondary" onClick={() => run('샘플 데이터를 재생성했습니다.', generateSampleData)} disabled={!hasData}><RefreshCw size={15}/> 샘플 재생성</button>
        <button className="btn secondary" onClick={() => run('샘플 데이터를 삭제했습니다.', deleteSampleData)} disabled={!hasData}><Trash2 size={15}/> 샘플 삭제</button>
      </div>
      {status && <p style={{ fontSize: 12.5, color: status.startsWith('오류') ? '#dc2626' : '#16a34a', marginTop: 10 }}>{status}</p>}
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>현재 샘플 데이터: {hasData ? '있음' : '없음'}</p>
    </SectionCard>
  );
}

function renderSettingsContent(key: SettingsSectionKey) {
  if (key === 'advertisers') return <AdvertiserSettings/>;
  if (key === 'metrics') return <MetricSettings/>;
  if (key === 'funnel-events') return <FunnelEventSettings/>;
  if (key === 'users-permissions') return <PermissionSettings/>;
  if (key === 'notifications') return <NotificationSettings/>;
  if (key === 'data-collection') return <DataCollectionSettings/>;
  if (key === 'report-integrations') return <ReportIntegrationSettingsPanel/>;
  if (key === 'db-integrations') return <DbIntegrationSettingsPanel/>;
  if (key === 'proposal-settings') return <ProposalCalculationSettingsPanel/>;
  if (key === 'backup') return <BackupRestoreSettings/>;
  if (key === 'test-data') return <TestDataSettings/>;
  return <FormulaSettings/>;
}

function AdvertiserSettings() {
  const ownerOptions = ['관리자', '김마케터', '이운영', '박분석'];
  const [saved, setSaved] = useState<Record<string, AdvertiserSetting>>(() => loadAdvertiserSettings());
  const advertisers = Array.from(new Set([...BASE_ADVERTISERS, ...loadExtraAdvertisers(), ...Object.keys(saved)]));
  const [selected, setSelected] = useState(advertisers[0] ?? '');
  const [viewMode, setViewMode] = useState<'edit' | 'view'>('edit');
  const [notice, setNotice] = useState('');
  const defaultSetting = (name: string): AdvertiserSetting => ({ advertiserName: name, industry: '서비스', currency: 'KRW 대한민국 원', timezone: 'Asia/Seoul', preset: '상담형', owners: ['관리자'], platforms: [], placements: [], adTypes: [], updatedAt: '' });
  const [draft, setDraft] = useState<AdvertiserSetting>(() => saved[selected] ?? defaultSetting(selected));
  useEffect(() => { setDraft(saved[selected] ?? defaultSetting(selected)); }, [selected, saved]);
  const current = draft;
  const update = <K extends keyof AdvertiserSetting,>(key: K, value: AdvertiserSetting[K]) => {
    setDraft(prev => ({ ...prev, [key]: value, advertiserName: selected }));
  };
  const save = () => {
    const next = { ...draft, advertiserName: selected, updatedAt: new Date().toISOString() };
    if (!saveAdvertiserSetting(next)) { setNotice('브라우저 저장 공간이 부족해 저장하지 못했습니다.'); return; }
    // 이미 이 광고주의 보고서 프로필이 저장돼 있으면, 예전 프리셋 기준 reportType이 남아있어
    // 설정을 바꿔도 보고서가 그대로인 것처럼 보일 수 있습니다. 프로필 자체(매체·지표 구성 등)는
    // 그대로 두고 reportType만 새 프리셋에 맞게 함께 갱신합니다.
    const profiles = loadProfiles();
    if (profiles[selected]) {
      saveProfiles({ ...profiles, [selected]: { ...profiles[selected], reportType: inferReportType(selected) } });
    }
    setSaved(loadAdvertiserSettings());
    setNotice('광고주 설정을 저장했습니다. 아래 “저장 내용 확인”에서 언제든 확인할 수 있습니다.');
    setTimeout(() => setNotice(''), 3200);
  };
  const remove = (name: string) => {
    if (!window.confirm(`“${name}”의 저장된 설정을 삭제할까요?`)) return;
    deleteAdvertiserSetting(name); setSaved(loadAdvertiserSettings());
  };
  const savedRows = Object.values(saved).sort((a, b) => a.advertiserName.localeCompare(b.advertiserName, 'ko'));
  return <>
    <div className="settings-view-tabs">
      <button className={viewMode === 'edit' ? 'active' : ''} onClick={() => setViewMode('edit')}><Settings2 size={15}/> 설정 입력</button>
      <button className={viewMode === 'view' ? 'active' : ''} onClick={() => setViewMode('view')}><Eye size={15}/> 저장 내용 확인 <span>{savedRows.length}</span></button>
    </div>
    {viewMode === 'edit' ? <>
      <SectionCard id="setting-0" title="광고주 기본 정보" description="광고주 선택 후 업종과 운영 기준을 설정합니다."><div className="settings-form-grid cols-2"><Field label="광고주"><select value={selected} onChange={event => setSelected(event.target.value)}>{advertisers.map(name => <option key={name}>{name}</option>)}</select></Field><Field label="업종"><select value={current.industry} onChange={event => update('industry', event.target.value)}><option>부동산</option><option>쇼핑몰</option><option>병원</option><option>서비스</option><option>교육</option><option>관광</option><option>외식</option></select></Field><Field label="기본 통화"><select value={current.currency} onChange={event => update('currency', event.target.value)}><option>KRW 대한민국 원</option><option>USD 미국 달러</option></select></Field><Field label="기준 시간대"><select value={current.timezone} onChange={event => update('timezone', event.target.value)}><option>Asia/Seoul</option><option>UTC</option></select></Field></div></SectionCard>
      <SectionCard id="setting-1" title="기본 지표 프리셋" description="광고주에 접속했을 때 우선 표시할 지표 구성을 선택합니다."><div className="preset-choice-grid">{(['상담형','커머스형','혼합형','클릭 성과형','노출 도달형'] as AdvertiserPreset[]).map(preset => <label key={preset}><input type="radio" name="advertiser-preset" checked={current.preset === preset} onChange={() => update('preset', preset)}/><span><strong>{preset}</strong><small>{preset === '상담형' ? 'DB, 유효 DB, 계약 중심' : preset === '커머스형' ? '장바구니, 구매, ROAS 중심' : preset === '혼합형' ? '전체 통합형 — 여러 지표를 함께 사용' : preset === '클릭 성과형' ? '클릭, CTR, CPC 중심' : '노출, 도달, 빈도, CPM 중심'}</small></span></label>)}</div></SectionCard>
      <SectionCard id="setting-3" title="플랫폼·지면·유형" description="이 광고주가 주로 사용하는 매체, 광고 지면, 광고 유형을 선택해 두면 다른 화면에서 참고할 수 있습니다.">
        <div className="settings-form-grid cols-1">
          <label className="field-label">플랫폼 선택
            <div className="checkbox-grid">{AD_PLATFORM_OPTIONS.map(name => <label key={name}><input type="checkbox" checked={current.platforms?.includes(name) ?? false} onChange={e => update('platforms', e.target.checked ? [...(current.platforms ?? []), name] : (current.platforms ?? []).filter(p => p !== name))}/>{name}</label>)}</div>
          </label>
          <label className="field-label">광고 지면
            <div className="checkbox-grid">{AD_PLACEMENT_OPTIONS.map(name => <label key={name}><input type="checkbox" checked={current.placements?.includes(name) ?? false} onChange={e => update('placements', e.target.checked ? [...(current.placements ?? []), name] : (current.placements ?? []).filter(p => p !== name))}/>{name}</label>)}</div>
          </label>
          <label className="field-label">광고 유형
            <div className="checkbox-grid">{AD_TYPE_OPTIONS.map(name => <label key={name}><input type="checkbox" checked={current.adTypes?.includes(name) ?? false} onChange={e => update('adTypes', e.target.checked ? [...(current.adTypes ?? []), name] : (current.adTypes ?? []).filter(p => p !== name))}/>{name}</label>)}</div>
          </label>
        </div>
      </SectionCard>
      <SectionCard id="setting-2" title="담당자 배정" description="이 광고주의 보고서·캠페인·알림을 담당할 사용자를 선택합니다."><div className="checkbox-grid">{ownerOptions.map(owner => <label key={owner}><input type="checkbox" checked={current.owners.includes(owner)} onChange={event => update('owners', event.target.checked ? Array.from(new Set([...current.owners, owner])) : current.owners.filter(item => item !== owner))}/><span>{owner}</span></label>)}</div><div className="settings-save-row"><button className="btn primary" onClick={save}><Save size={15}/> 광고주 설정 저장</button>{notice && <span className="settings-save-notice">{notice}</span>}</div></SectionCard>
    </> : <SectionCard id="setting-advertiser-summary" title="저장된 광고주 설정" description="환경설정에서 저장한 기본 정보·지표 프리셋·담당자를 한 화면에서 확인하고 다시 편집할 수 있습니다.">
      {savedRows.length === 0 ? <p className="muted">아직 저장된 광고주 설정이 없습니다.</p> : <div className="table-scroll"><table className="ops-table advertiser-settings-table"><thead><tr><th>광고주</th><th>업종</th><th>통화</th><th>시간대</th><th>기본 지표 프리셋</th><th>플랫폼</th><th>광고 지면</th><th>광고 유형</th><th>담당자</th><th>최종 저장</th><th></th></tr></thead><tbody>{savedRows.map(row => <tr key={row.advertiserName}><td><b>{row.advertiserName}</b></td><td>{row.industry}</td><td>{row.currency.split(' ')[0]}</td><td>{row.timezone}</td><td><span className="settings-status ok">{row.preset}</span></td><td style={{ maxWidth: 160, whiteSpace: 'normal' }}>{(row.platforms ?? []).join(', ') || '미선택'}</td><td style={{ maxWidth: 140, whiteSpace: 'normal' }}>{(row.placements ?? []).join(', ') || '미선택'}</td><td style={{ maxWidth: 120, whiteSpace: 'normal' }}>{(row.adTypes ?? []).join(', ') || '미선택'}</td><td>{row.owners.join(', ') || '미배정'}</td><td>{row.updatedAt ? new Date(row.updatedAt).toLocaleString('ko-KR') : '-'}</td><td><div className="inline-actions"><button className="btn secondary sm" onClick={() => { setSelected(row.advertiserName); setViewMode('edit'); }}><PencilLine size={13}/> 편집</button><button className="icon-btn danger" onClick={() => remove(row.advertiserName)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>}
    </SectionCard>}
  </>;
}

const BASE_PLATFORM_LIST = ['메타','네이버','구글','구글 SA','당근','틱톡','카카오키워드','카카오모먼트','GFA','모비온','ADN','YouTube AD','카페24','스마트스토어'];
const BASE_METRIC_LIST: { key:string; defaultLabel:string }[] = [
  { key:'leads', defaultLabel:'DB 개수' },
  { key:'clicks', defaultLabel:'클릭수' },
  { key:'impressions', defaultLabel:'노출수' },
  { key:'reach', defaultLabel:'도달' },
  { key:'spend', defaultLabel:'광고비' },
  { key:'revenue', defaultLabel:'매출' },
  { key:'payments', defaultLabel:'결제' },
  { key:'refunds', defaultLabel:'환불' },
];

function MetricSettings() {
  const [tab, setTab] = useState('dashboard');
  const metrics = useMemo(() => tab === 'dashboard' ? ['광고비','노출','CPM','클릭','CTR','CPC','전환','전환율','전환매출','CPA','ROAS'] : tab === 'funnel' ? ['클릭','DB','유효 DB','계약','회원가입','장바구니','결제 시작','구매','구매 전환값','ROAS'] : ['광고비','클릭','전환','CPA','전환매출','ROAS','전월 대비','목표 대비'], [tab]);

  const [customPlatforms, setCustomPlatforms] = useState<string[]>(() => loadCustomPlatforms());
  const [newPlatform, setNewPlatform] = useState('');
  const [editingPlatform, setEditingPlatform] = useState<{ original:string; value:string } | null>(null);
  const allPlatforms = [...BASE_PLATFORM_LIST, ...customPlatforms];

  const addPlatform = () => {
    const name = newPlatform.trim();
    if (!name) return;
    if (allPlatforms.includes(name)) { window.alert('이미 있는 매체명입니다.'); return; }
    const next = [...customPlatforms, name];
    setCustomPlatforms(next);
    saveCustomPlatforms(next);
    setNewPlatform('');
  };
  const renamePlatform = (original: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === original) { setEditingPlatform(null); return; }
    const next = customPlatforms.map(p => p === original ? trimmed : p);
    setCustomPlatforms(next);
    saveCustomPlatforms(next);
    setEditingPlatform(null);
  };
  const deletePlatform = (name: string) => {
    if (!window.confirm(`"${name}" 매체를 목록에서 삭제할까요? 이미 보고서에 추가된 데이터는 남아 있습니다.`)) return;
    const next = customPlatforms.filter(p => p !== name);
    setCustomPlatforms(next);
    saveCustomPlatforms(next);
  };

  const [customMetrics, setCustomMetrics] = useState<CustomMetricDefinition[]>(() => loadCustomMetrics());
  const [metricModal, setMetricModal] = useState(false);
  const [metricForm, setMetricForm] = useState<CustomMetricDefinition>({id:'',name:'',formula:'',unit:'원',description:'',direction:'up',aggregationType:'ratio'});
  const openNewMetric = () => { setMetricForm({id:'',name:'',formula:'',unit:'원',description:'',direction:'up',aggregationType:'ratio'}); setMetricModal(true); };
  const openEditCustomMetric = (metric: CustomMetricDefinition) => { setMetricForm({...metric}); setMetricModal(true); };
  const saveCustomMetric = () => {
    const name=metricForm.name.trim(), formula=metricForm.formula.trim();
    if (!name || !formula) { window.alert('지표명과 수식을 입력하세요.'); return; }
    // 수식에서 변수처럼 보이는 토큰(알파벳으로 시작하는 단어)을 뽑아서, 실제로 계산 가능한
    // 8개 변수(RAW_METRICS)에 없는 게 섞여 있으면 저장을 막습니다. 이걸 막지 않으면 수식은
    // 저장되지만 계산 결과가 항상 0으로 나와서, 사용자가 원인을 알기 어렵습니다.
    const usedTokens = formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
    const unknownVars = Array.from(new Set(usedTokens.filter(t => !(RAW_METRICS as readonly string[]).includes(t))));
    if (unknownVars.length > 0) {
      window.alert(`수식에 사용할 수 없는 변수가 있습니다: ${unknownVars.join(', ')}\n\n사용 가능한 변수: ${RAW_METRICS.join(', ')}`);
      return;
    }
    const item={...metricForm,id:metricForm.id||`custom-${Date.now()}`,name,formula};
    const next=metricForm.id ? customMetrics.map(m=>m.id===metricForm.id?item:m) : [...customMetrics,item];
    setCustomMetrics(next); saveCustomMetrics(next); setMetricModal(false);
  };
  const deleteCustomMetric = (id:string) => { if(!window.confirm('이 지표를 삭제할까요?')) return; const next=customMetrics.filter(m=>m.id!==id);setCustomMetrics(next);saveCustomMetrics(next); };

  const [labelOverrides, setLabelOverrides] = useState<Record<string,string>>(() => loadMetricLabelOverrides());
  const [editingMetric, setEditingMetric] = useState<string | null>(null);
  const [editingMetricValue, setEditingMetricValue] = useState('');
  const startEditMetric = (key: string, current: string) => { setEditingMetric(key); setEditingMetricValue(current); };
  const saveMetricLabel = (key: string) => {
    const trimmed = editingMetricValue.trim();
    if (!trimmed) { setEditingMetric(null); return; }
    const next = { ...labelOverrides, [key]: trimmed };
    setLabelOverrides(next);
    saveMetricLabelOverrides(next);
    setEditingMetric(null);
  };
  const resetMetricLabel = (key: string) => {
    const next = { ...labelOverrides };
    delete next[key];
    setLabelOverrides(next);
    saveMetricLabelOverrides(next);
  };

  return <>
    <SectionCard id="setting-0" title="기본 표시 지표" description="화면별로 기본 노출할 지표를 선택합니다."><div className="settings-segmented"><button className={tab==='dashboard'?'active':''} onClick={()=>setTab('dashboard')}>대시보드</button><button className={tab==='funnel'?'active':''} onClick={()=>setTab('funnel')}>퍼널</button><button className={tab==='report'?'active':''} onClick={()=>setTab('report')}>보고서</button></div><CheckboxGrid values={metrics}/></SectionCard>

    <SectionCard id="setting-1" title="지표 관리" description="기본 지표의 표시명을 수정하거나 새 계산 지표를 직접 추가합니다. 새 지표에는 지표명, 수식, 단위와 설명을 저장할 수 있습니다.">
      <div className="settings-form-card-head" style={{padding:0,marginBottom:10}}><div></div><button className="btn btn-secondary" onClick={openNewMetric}><Plus size={14}/> 지표 추가</button></div>
      <div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>지표명</th><th>수식/키</th><th>단위</th><th>구분</th><th></th></tr></thead><tbody>
        {BASE_METRIC_LIST.map(({key,defaultLabel})=>{const current=labelOverrides[key]??defaultLabel;const isEditing=editingMetric===key;return <tr key={key}><td>{isEditing?<input autoFocus value={editingMetricValue} onChange={e=>setEditingMetricValue(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveMetricLabel(key)}/>:current}</td><td><code>{key}</code></td><td>-</td><td><span className="settings-status ok">기본</span></td><td>{isEditing?<button className="icon-btn" onClick={()=>saveMetricLabel(key)}><Save size={15}/></button>:<button className="icon-btn" onClick={()=>startEditMetric(key,current)}><PencilLine size={15}/></button>}{labelOverrides[key]&&<button className="icon-btn" onClick={()=>resetMetricLabel(key)}><RotateCcw size={15}/></button>}</td></tr>})}
        {customMetrics.map(metric=><tr key={metric.id}><td><b>{metric.name}</b><small style={{display:'block',color:'#64748b'}}>{metric.description||'설명 없음'}</small></td><td><code>{metric.formula}</code></td><td>{metric.unit||'-'}</td><td><span className="settings-status">직접 추가</span></td><td><button className="icon-btn" onClick={()=>openEditCustomMetric(metric)}><PencilLine size={15}/></button><button className="icon-btn danger" onClick={()=>deleteCustomMetric(metric.id)}><Trash2 size={15}/></button></td></tr>)}
      </tbody></table></div>
      {metricModal&&<div className="modal-backdrop" onClick={()=>setMetricModal(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>{metricForm.id?'지표 수정':'지표 추가'}</h3><p>사용 가능한 변수: leads, clicks, impressions, reach, spend, revenue, payments, refunds (이 8개만 계산됩니다)</p></div><button className="icon-btn" onClick={()=>setMetricModal(false)}><X size={18}/></button></div><div className="form-grid"><label className="field-label">지표명<input value={metricForm.name} onChange={e=>setMetricForm({...metricForm,name:e.target.value})} placeholder="예: 유효 DB율"/></label><label className="field-label">단위<select value={metricForm.unit} onChange={e=>setMetricForm({...metricForm,unit:e.target.value})}><option>원</option><option>%</option><option>건</option><option>회</option><option>배</option><option>기타</option></select></label></div><label className="field-label">판정 방향<select value={metricForm.direction ?? 'up'} onChange={e=>setMetricForm({...metricForm,direction:e.target.value as 'up'|'down'|'neutral'})}><option value="up">높을수록 좋음</option><option value="down">낮을수록 좋음 (예: 환불률·이탈률)</option><option value="neutral">중립 (색상 표시 안 함)</option></select></label><label className="field-label">기간 집계 방식<select value={metricForm.aggregationType ?? 'ratio'} onChange={e=>setMetricForm({...metricForm,aggregationType:e.target.value as 'sum'|'ratio'|'average'|'last'})}><option value="ratio">비율형 — 기간 원본 합계로 수식 재계산 (CVR% 등 비율 지표에 적합)</option><option value="sum">합계형 — 일별 값을 그대로 더함 (절대 금액·건수에 적합)</option><option value="average">평균형 — 일별 값의 평균</option><option value="last">최종값형 — 기간의 마지막 유효 값</option></select></label><label className="field-label">수식<input value={metricForm.formula} onChange={e=>setMetricForm({...metricForm,formula:e.target.value})} placeholder="예: revenue / spend * 100"/></label><label className="field-label">설명<textarea value={metricForm.description} onChange={e=>setMetricForm({...metricForm,description:e.target.value})} placeholder="지표의 계산 기준과 사용 목적"/></label><div className="modal-actions"><button className="btn secondary" onClick={()=>setMetricModal(false)}>취소</button><button className="btn primary" onClick={saveCustomMetric}><Save size={15}/> 저장</button></div></div></div>}
    </SectionCard>

    <SectionCard id="setting-2" title="매체 관리" description="보고서 관리의 '매체 추가'에서 선택할 수 있는 매체 목록입니다. 기본 매체는 삭제할 수 없고, 직접 추가한 매체만 수정·삭제할 수 있습니다.">
      <div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>매체</th><th>구분</th><th></th></tr></thead><tbody>
        {BASE_PLATFORM_LIST.map(name=><tr key={name}><td>{name}</td><td><span className="settings-status ok">기본</span></td><td></td></tr>)}
        {customPlatforms.map(name=>{
          const isEditing = editingPlatform?.original===name;
          return <tr key={name}>
            <td>{isEditing
              ? <input autoFocus value={editingPlatform!.value} onChange={e=>setEditingPlatform({original:name,value:e.target.value})} onKeyDown={e=>e.key==='Enter'&&renamePlatform(name,editingPlatform!.value)}/>
              : name}
            </td>
            <td><span className="settings-status">직접 추가</span></td>
            <td>
              {isEditing
                ? <button className="icon-btn" title="저장" onClick={()=>renamePlatform(name,editingPlatform!.value)}><Save size={15}/></button>
                : <button className="icon-btn" title="이름 수정" onClick={()=>setEditingPlatform({original:name,value:name})}><PencilLine size={15}/></button>}
              <button className="icon-btn danger" title="삭제" onClick={()=>deletePlatform(name)}><Trash2 size={15}/></button>
            </td>
          </tr>;
        })}
      </tbody></table></div>
      <div className="settings-inline-field" style={{marginTop:10}}><input value={newPlatform} onChange={e=>setNewPlatform(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addPlatform()} placeholder="새 매체 이름 (예: 오늘의집)"/><button className="btn btn-secondary" onClick={addPlatform}><Plus size={14}/> 매체 추가</button></div>
    </SectionCard>

    <SectionCard id="setting-3" title="표시 형식"><div className="settings-form-grid cols-2"><Field label="금액 표시"><select><option>₩1,234,567</option><option>123만원</option></select></Field><Field label="비율 소수점"><select><option>소수점 2자리</option><option>소수점 1자리</option></select></Field></div></SectionCard>
    <SectionCard id="setting-4" title="표 기본 동작"><Toggle label="마지막 지표 선택 기억" description="광고주와 화면별 마지막 선택값을 유지합니다." defaultChecked/><Toggle label="가로 스크롤 시 매체명 고정" defaultChecked/></SectionCard>
  </>;
}

function FunnelEventSettings() {
  const [rows, setRows] = useState([
    ['Meta','Lead','LEAD_CREATED'],
    ['Google','generate_lead','LEAD_CREATED'],
    ['GA4','sign_up','SIGN_UP'],
    ['GA4','add_to_cart','ADD_TO_CART'],
    ['GA4','purchase','PURCHASE'],
  ]);
  const addRow = () => setRows((current) => [...current, ['직접입력', 'custom_event', 'LEAD_CREATED']]);
  return <>
    <SectionCard id="setting-0" title="표준 퍼널 이벤트"><div className="event-chip-list">{['IMPRESSION','CLICK','LANDING_PAGE_VIEW','LEAD_CREATED','VALID_LEAD','CONTRACT','SIGN_UP','ADD_TO_CART','BEGIN_CHECKOUT','PURCHASE','PURCHASE_VALUE'].map((v)=><span key={v}>{v}</span>)}</div></SectionCard>
    <SectionCard id="setting-1" title="매체 이벤트 매핑" description="외부 플랫폼 이벤트를 HOWTOM 유니버스 표준 이벤트로 변환합니다."><div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>소스</th><th>원본 이벤트</th><th>표준 이벤트</th><th>상태</th><th></th></tr></thead><tbody>{rows.map((row,index)=><tr key={`${row[0]}-${index}`}><td><input value={row[0]} onChange={(e)=>setRows(rows.map((item,i)=>i===index?[e.target.value,item[1],item[2]]:item))}/></td><td><input value={row[1]} onChange={(e)=>setRows(rows.map((item,i)=>i===index?[item[0],e.target.value,item[2]]:item))}/></td><td><select value={row[2]} onChange={(e)=>setRows(rows.map((item,i)=>i===index?[item[0],item[1],e.target.value]:item))}><option>LEAD_CREATED</option><option>VALID_LEAD</option><option>CONTRACT</option><option>SIGN_UP</option><option>ADD_TO_CART</option><option>BEGIN_CHECKOUT</option><option>PURCHASE</option><option>PURCHASE_VALUE</option></select></td><td><span className="settings-status ok">정상</span></td><td><button className="icon-btn danger" onClick={()=>setRows(rows.filter((_,i)=>i!==index))}>삭제</button></td></tr>)}</tbody></table></div><button className="btn btn-secondary settings-add-row" onClick={addRow}>+ 이벤트 매핑 추가</button></SectionCard>
    <SectionCard id="setting-2" title="검증 규칙"><Toggle label="구매 전환값 누락 감지" defaultChecked/><Toggle label="중복 전환 이벤트 제외" defaultChecked/><Toggle label="CRM 확정 전환 우선" description="월말 보고서에서 매체 전환보다 CRM 확정값을 우선합니다."/></SectionCard>
  </>;
}

function PermissionSettings() {
  const [customRoles, setCustomRoles] = useState<CustomRole[]>(() => loadCustomRoles());
  const [users, setUsers] = useState([
    {name:'관리자',email:'admin@example.com',role:'관리자',active:true},
    {name:'김마케터',email:'marketer@example.com',role:'운영자',active:true},
  ]);
  const inviteUser = () => {
    const email = window.prompt('초대할 이메일을 입력하세요.');
    if (!email) return;
    const name = window.prompt('사용자 이름을 입력하세요.') || email.split('@')[0];
    setUsers((current)=>[...current,{name,email,role:'조회 전용',active:true}]);
  };

  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleError, setRoleError] = useState('');
  const openNewRole = () => { setRoleError(''); setEditingRole({ id: `role-${Date.now()}`, name: '', menuAccess: {} }); };
  const saveRole = () => {
    if (!editingRole) return;
    if (!editingRole.name.trim()) { setRoleError('역할 이름을 입력해 주세요.'); return; }
    if (Object.keys(editingRole.menuAccess).length === 0) { setRoleError('접근할 메뉴를 하나 이상 선택해 주세요.'); return; }
    const exists = customRoles.some(r => r.id === editingRole.id);
    const next = exists ? customRoles.map(r => r.id === editingRole.id ? editingRole : r) : [...customRoles, editingRole];
    const ok = saveCustomRoles(next);
    if (!ok) { setRoleError('브라우저 저장 공간이 부족해 저장하지 못했습니다.'); return; }
    setCustomRoles(next);
    setEditingRole(null);
    setRoleError('');
  };
  const deleteRole = (id: string) => {
    if (!window.confirm('이 한정 전용 역할을 삭제할까요? 이 역할을 쓰는 사용자는 "조회 전용"으로 바뀝니다.')) return;
    const next = customRoles.filter(r => r.id !== id);
    setCustomRoles(next);
    saveCustomRoles(next);
    setUsers(users.map(u => u.role === id ? { ...u, role: '조회 전용' } : u));
  };
  const toggleMenu = (menuKey: string, checked: boolean) => {
    if (!editingRole) return;
    const next = { ...editingRole.menuAccess };
    if (checked) next[menuKey] = next[menuKey] ?? 'view';
    else delete next[menuKey];
    setEditingRole({ ...editingRole, menuAccess: next });
  };
  const setMenuLevel = (menuKey: string, level: MenuAccessLevel) => {
    if (!editingRole) return;
    setEditingRole({ ...editingRole, menuAccess: { ...editingRole.menuAccess, [menuKey]: level } });
  };

  const roleOptions = ['관리자', '운영자', '조회 전용', ...customRoles.map(r => r.id)];
  const roleLabel = (roleValue: string) => customRoles.find(r => r.id === roleValue)?.name ?? roleValue;

  return <>
    <SectionCard id="setting-0" title="사용자 목록"><div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>사용자</th><th>이메일</th><th>역할</th><th>상태</th><th></th></tr></thead><tbody>{users.map((user,index)=><tr key={user.email}><td>{user.name}</td><td>{user.email}</td><td><select value={user.role} onChange={(e)=>setUsers(users.map((item,i)=>i===index?{...item,role:e.target.value}:item))}>{roleOptions.map(r=><option key={r} value={r}>{roleLabel(r)}</option>)}</select></td><td><button className={`settings-status ${user.active?'ok':'off'}`} onClick={()=>setUsers(users.map((item,i)=>i===index?{...item,active:!item.active}:item))}>{user.active?'활성':'비활성'}</button></td><td><button className="icon-btn danger" onClick={()=>setUsers(users.filter((_,i)=>i!==index))}>삭제</button></td></tr>)}</tbody></table></div><button className="btn btn-secondary settings-add-row" onClick={inviteUser}>+ 사용자 초대</button></SectionCard>

    <SectionCard id="setting-1" title="역할별 권한" description="한정 전용 역할을 만들면, 전체 메뉴 중 선택한 메뉴만 조회하거나 관리할 수 있도록 제한할 수 있습니다.">
      <div className="permission-matrix"><div><strong>관리자</strong><span>전체 설정, 계정 연동, 삭제 가능</span></div><div><strong>운영자</strong><span>캠페인, 일정, 보고서 수정 가능</span></div><div><strong>조회 전용</strong><span>대시보드와 보고서 조회만 가능</span></div></div>
      <div className="settings-table-wrap" style={{marginTop:14}}>
        {customRoles.length===0 && <p className="muted" style={{padding:'10px 2px'}}>아직 만든 한정 전용 역할이 없습니다.</p>}
        {customRoles.map(role=>(
          <div key={role.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',border:'1px solid #eef1f5',borderRadius:8,marginBottom:8}}>
            <div><b style={{fontSize:13}}>{role.name}</b><span style={{fontSize:12,color:'#64748b',marginLeft:8}}>{Object.keys(role.menuAccess).length}개 메뉴 접근 가능</span></div>
            <div style={{display:'flex',gap:6}}>
              <button className="btn secondary sm" onClick={()=>setEditingRole(role)}>수정</button>
              <button className="icon-btn danger" onClick={()=>deleteRole(role.id)}><Trash2 size={15}/></button>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-secondary settings-add-row" onClick={openNewRole}>+ 한정 전용 역할 추가</button>
    </SectionCard>

    {editingRole && (
      <div className="modal-backdrop" onClick={()=>setEditingRole(null)}>
        <div className="modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:640}}>
          <div className="modal-head"><div><h3>한정 전용 역할 설정</h3><p>역할 이름을 정하고, 이 역할이 접근할 수 있는 메뉴와 권한 수준(조회/관리)을 고르세요.</p></div><button className="icon-btn" onClick={()=>setEditingRole(null)}><X size={18}/></button></div>
          <label className="field-label">역할 이름<input value={editingRole.name} onChange={e=>setEditingRole({...editingRole,name:e.target.value})} placeholder="예: 보고서 전용 담당자" autoFocus/></label>
          <div style={{maxHeight:360,overflowY:'auto',border:'1px solid #eef1f5',borderRadius:8,marginTop:10}}>
            {universePermissionItems.map(item=>{
              const level = editingRole.menuAccess[item.key];
              return (
                <div key={item.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderBottom:'1px solid #f4f6f9'}}>
                  <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                    <input type="checkbox" checked={!!level} onChange={e=>toggleMenu(item.key,e.target.checked)}/>{item.label}
                  </label>
                  {level && (
                    <div style={{display:'flex',gap:10,fontSize:12}}>
                      <label style={{display:'flex',alignItems:'center',gap:4}}><input type="radio" name={`level-${item.key}`} checked={level==='view'} onChange={()=>setMenuLevel(item.key,'view')}/>조회</label>
                      <label style={{display:'flex',alignItems:'center',gap:4}}><input type="radio" name={`level-${item.key}`} checked={level==='manage'} onChange={()=>setMenuLevel(item.key,'manage')}/>관리</label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="modal-actions">{roleError && <span style={{ color: '#dc2626', fontSize: 12.5, marginRight: 'auto' }}>{roleError}</span>}<button className="btn secondary" onClick={()=>setEditingRole(null)}>취소</button><button className="btn primary" onClick={saveRole}><Save size={15}/> 저장</button></div>
        </div>
      </div>
    )}

  </>;
}

function NotificationSettings() {
  const [testResult,setTestResult]=useState('');
  // 환경설정 > 광고주 설정에 등록된 담당자 이름을, 여기 수신 대상 선택지에도 그대로 가져옵니다.
  // 그래야 "김마케터"를 어떤 광고주 담당자로 지정했을 때, 이 화면에서 실제로 그 이름을 골라
  // 알림을 받게 설정할 수 있습니다.
  const namedOwners = Array.from(new Set(Object.values(loadAdvertiserSettings()).flatMap(setting => setting.owners))).filter(Boolean);
  return <>
    <SectionCard id="setting-0" title="알림 채널"><Toggle label="웹 알림" defaultChecked/><Toggle label="이메일 알림" defaultChecked/><Toggle label="카카오워크 또는 슬랙 웹훅"/><div className="settings-inline-field"><input placeholder="Webhook URL"/><button className="btn btn-secondary" onClick={()=>{setTestResult('테스트 알림을 발송했습니다.');setTimeout(()=>setTestResult(''),2000)}}>테스트</button></div>{testResult&&<div className="save-toast">{testResult}</div>}</SectionCard>
    <SectionCard id="setting-1" title="알림 조건"><Toggle label="데이터 수집 실패" defaultChecked/><Toggle label="오전 7시까지 전일 데이터 미완료" defaultChecked/><Toggle label="예산 초과 예상" defaultChecked/><Toggle label="CPA 급등 또는 ROAS 급락" defaultChecked/><Toggle label="API 토큰 만료" defaultChecked/></SectionCard>
    <SectionCard id="setting-2" title="수신 대상" description={namedOwners.length ? '역할별 수신 대상과, 환경설정 > 광고주 설정에 등록된 담당자를 함께 고를 수 있습니다.' : undefined}><CheckboxGrid values={['관리자', '브랜드 담당자', '캠페인 담당자', '광고주 담당자', ...namedOwners]}/></SectionCard>
  </>;
}

function DataCollectionSettings() {
  return <>
    <SectionCard id="setting-0" title="일일 수집 시간" description="일일 보고 전까지 전일 데이터가 모두 반영되도록 설정합니다."><div className="settings-form-grid cols-3"><Field label="1차 수집"><input type="time" defaultValue="05:30"/></Field><Field label="2차 검증"><input type="time" defaultValue="06:30"/></Field><Field label="완료 마감"><input type="time" defaultValue="07:00"/></Field></div><div className="collection-timeline"><span className="done">05:30 1차 수집</span><i/><span className="done">06:30 재검증</span><i/><span>07:00 완료 확인</span></div></SectionCard>
    <SectionCard id="setting-1" title="재시도 정책"><div className="settings-form-grid cols-2"><Field label="최대 재시도 횟수"><input type="number" defaultValue="3"/></Field><Field label="재시도 간격"><select><option>10분, 30분, 60분</option><option>5분, 15분, 30분</option></select></Field></div><Toggle label="최종 실패 시 즉시 알림" defaultChecked/></SectionCard>
    <SectionCard id="setting-2" title="월말 데이터 확정"><Toggle label="매월 2일 전월 전체 데이터 재수집" defaultChecked/><Toggle label="전환 지연분 자동 보정" defaultChecked/><Toggle label="확정 후 보고서 잠금"/></SectionCard>
  </>;
}


function ReportIntegrationSettingsPanel() {
  const [settings, setSettings] = useState<ReportIntegrationSettings>(() => loadReportIntegrationSettings());
  const [message, setMessage] = useState('');
  const update = <K extends keyof ReportIntegrationSettings,>(section: K, patch: Partial<ReportIntegrationSettings[K]>) => {
    setSettings((current) => ({ ...current, [section]: { ...current[section], ...patch } }));
  };
  const saveAll = () => {
    saveReportIntegrationSettings(settings);
    setMessage('보고서 연동 설정이 저장되었습니다.');
    window.setTimeout(() => setMessage(''), 2200);
  };
  const restore = () => {
    setSettings(DEFAULT_REPORT_INTEGRATION_SETTINGS);
    saveReportIntegrationSettings(DEFAULT_REPORT_INTEGRATION_SETTINGS);
    setMessage('기본 연동 설정으로 복원했습니다.');
    window.setTimeout(() => setMessage(''), 2200);
  };
  const testWebhook = async (kind: 'googleSheets' | 'notion') => {
    const endpoint = kind === 'googleSheets' ? settings.googleSheets.webhookUrl.trim() : settings.notion.webhookUrl.trim();
    if (!endpoint) {
      setMessage(kind === 'googleSheets' ? 'Google Apps Script 웹앱 URL을 입력하세요.' : 'Notion Webhook URL을 입력하거나 서버 환경변수를 설정하세요.');
      return;
    }
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'ad-control-center', test: true, sentAt: new Date().toISOString() }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setMessage(`${kind === 'googleSheets' ? 'Google Sheets' : 'Notion'} 테스트 전송에 성공했습니다.`);
    } catch (error) {
      setMessage(`테스트 실패: ${error instanceof Error ? error.message : '연결을 확인하세요.'}`);
    }
    window.setTimeout(() => setMessage(''), 3200);
  };
  return <>
    {message && <div className="save-toast">{message}</div>}
    <SectionCard id="setting-0" title="Google Sheets 연동" description="보고서 생성 후 매체별 성과와 선택 지표를 시트 표로 추가합니다.">
      <label className="setting-toggle-row"><span><strong>Google Sheets 사용</strong><small>생성된 보고서의 Google Sheets 전송 버튼을 활성화합니다.</small></span><button type="button" className={`switch ${settings.googleSheets.enabled?'on':''}`} aria-pressed={settings.googleSheets.enabled} onClick={()=>update('googleSheets',{enabled:!settings.googleSheets.enabled})}><i/></button></label>
      <div className="settings-form-grid cols-2">
        <Field label="Apps Script 웹앱 URL" hint="Google Apps Script를 Web App으로 배포한 /exec 주소"><input value={settings.googleSheets.webhookUrl} onChange={(e)=>update('googleSheets',{webhookUrl:e.target.value})} placeholder="https://script.google.com/macros/s/.../exec"/></Field>
        <Field label="스프레드시트 ID" hint="Apps Script 또는 서버 연동에서 사용할 대상 시트 ID"><input value={settings.googleSheets.spreadsheetId} onChange={(e)=>update('googleSheets',{spreadsheetId:e.target.value})} placeholder="1AbC..."/></Field>
        <Field label="시트명"><input value={settings.googleSheets.sheetName} onChange={(e)=>update('googleSheets',{sheetName:e.target.value})}/></Field>
        <Field label="생성 시 자동 전송"><select value={settings.googleSheets.autoSync?'사용':'사용 안 함'} onChange={(e)=>update('googleSheets',{autoSync:e.target.value==='사용'})}><option>사용 안 함</option><option>사용</option></select></Field>
      </div>
      <div className="inline-actions"><button className="btn btn-secondary" onClick={()=>testWebhook('googleSheets')}>연동 테스트</button><a className="btn btn-secondary" href="https://script.google.com/" target="_blank" rel="noreferrer">Apps Script 열기</a></div>
    </SectionCard>
    <SectionCard id="setting-1" title="Notion 연동" description="일일보고를 Notion 페이지 또는 데이터 소스에 생성합니다.">
      <label className="setting-toggle-row"><span><strong>Notion 사용</strong><small>토큰은 브라우저에 저장하지 않고 서버 환경변수 또는 안전한 Webhook에서 관리하세요.</small></span><button type="button" className={`switch ${settings.notion.enabled?'on':''}`} aria-pressed={settings.notion.enabled} onClick={()=>update('notion',{enabled:!settings.notion.enabled})}><i/></button></label>
      <div className="settings-form-grid cols-2">
        <Field label="Notion Webhook URL" hint="Make, Zapier, n8n 또는 자체 서버 Webhook URL"><input value={settings.notion.webhookUrl} onChange={(e)=>update('notion',{webhookUrl:e.target.value})} placeholder="https://.../notion-report"/></Field>
        <Field label="데이터 소스 또는 페이지 ID"><input value={settings.notion.dataSourceId} onChange={(e)=>update('notion',{dataSourceId:e.target.value})} placeholder="Notion 대상 ID"/></Field>
        <Field label="생성 시 자동 전송"><select value={settings.notion.autoSync?'사용':'사용 안 함'} onChange={(e)=>update('notion',{autoSync:e.target.value==='사용'})}><option>사용 안 함</option><option>사용</option></select></Field>
      </div>
      <div className="inline-actions"><button className="btn btn-secondary" onClick={()=>testWebhook('notion')}>연동 테스트</button><a className="btn btn-secondary" href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">Notion 연동 관리</a></div>
    </SectionCard>
    <SectionCard id="setting-2" title="PDF 및 파일 출력" description="Excel, CSV, PDF 일일보고의 기본 출력 방식을 관리합니다.">
      <div className="settings-form-grid cols-2">
        <Field label="PDF 방향"><select value={settings.pdf.landscape?'가로':'세로'} onChange={(e)=>update('pdf',{landscape:e.target.value==='가로'})}><option>가로</option><option>세로</option></select></Field>
        <Field label="파일명 템플릿"><input value={settings.pdf.fileNameTemplate} onChange={(e)=>update('pdf',{fileNameTemplate:e.target.value})}/></Field>
      </div>
      <label className="setting-toggle-row"><span><strong>표지 포함</strong></span><button type="button" className={`switch ${settings.pdf.includeCover?'on':''}`} aria-pressed={settings.pdf.includeCover} onClick={()=>update('pdf',{includeCover:!settings.pdf.includeCover})}><i/></button></label>
      <label className="setting-toggle-row"><span><strong>생성 시 PDF 자동 열기</strong></span><button type="button" className={`switch ${settings.pdf.autoGenerate?'on':''}`} aria-pressed={settings.pdf.autoGenerate} onClick={()=>update('pdf',{autoGenerate:!settings.pdf.autoGenerate})}><i/></button></label>
      <div className="integration-format-list"><span>Excel(.xlsx)</span><span>CSV(.csv)</span><span>PDF 인쇄</span><span>Google Sheets</span><span>Notion</span></div>
      <div className="inline-actions"><button className="btn btn-primary" onClick={saveAll}><Save size={14}/> 연동 설정 저장</button><button className="btn btn-secondary" onClick={restore}><RotateCcw size={14}/> 기본값 복원</button></div>
    </SectionCard>
  </>;
}

function FormulaSettings() {
  const [formulas, setFormulas] = useState<MetricFormula[]>(() => loadMetricFormulas());
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('전체');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [draft, setDraft] = useState({ label: '', group: '기타', channel: '전체', formula: '' });
  const [message, setMessage] = useState('');

  const groups = ['전체', ...Array.from(new Set(formulas.map((item) => item.group)))];
  // 예전엔 이미 등록된 지표를 카탈로그에서 제외해서, 기본값이 전체 카탈로그와 동일한
  // 첫 화면에서는 고를 게 하나도 없이 항상 빈 목록으로 보이는 문제가 있었습니다.
  // 카탈로그는 '참고용 전체 목록'이므로 등록 여부와 관계없이 항상 전부 보여줍니다.
  const availableCatalog = METRIC_FORMULA_CATALOG;
  const filtered = formulas.filter((item) => {
    const matchesQuery = `${item.label} ${item.formula} ${item.group}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (group === '전체' || item.group === group);
  });

  const persist = (next: MetricFormula[], notice: string) => {
    setFormulas(next);
    saveMetricFormulas(next);
    setMessage(notice);
    window.setTimeout(() => setMessage(''), 2200);
  };

  const openAdd = () => {
    setEditingId(null);
    setSelectedCatalogId('');
    setDraft({ label: '', group: '기타', channel: '전체', formula: '' });
    setShowAdd(true);
  };

  const selectCatalog = (id: string) => {
    setSelectedCatalogId(id);
    const item = METRIC_FORMULA_CATALOG.find((formula) => formula.id === id);
    if (item) setDraft({ label: item.label, group: item.group, channel: item.channel ?? '전체', formula: item.formula });
  };

  const openEdit = (item: MetricFormula) => {
    setEditingId(item.id);
    setSelectedCatalogId('');
    setDraft({ label: item.label, group: item.group, channel: item.channel ?? '전체', formula: item.formula });
    setShowAdd(true);
  };

  const saveDraft = () => {
    if (!draft.label.trim() || !draft.formula.trim()) {
      setMessage('지표명과 수식을 입력하세요.');
      return;
    }
    if (editingId) {
      persist(formulas.map((item) => item.id === editingId ? { ...item, ...draft } : item), '지표 수식이 수정되었습니다.');
    } else {
      const duplicated = formulas.some((item) => item.label.trim() === draft.label.trim());
      if (duplicated) {
        setMessage('이미 등록된 지표입니다.');
        return;
      }
      const id = `custom-${Date.now()}`;
      persist([{ id, ...draft, enabled: true }, ...formulas], '지표 수식이 추가되었습니다.');
    }
    setShowAdd(false);
  };

  return <>
    <SectionCard id="setting-0" title="광고 지표 수식" description="등록한 지표 수식은 보고서 만들기의 포함할 섹션에 자동 반영됩니다.">
      <div className="formula-manager-toolbar">
        <div className="ops-search"><Search size={16}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="지표명 또는 수식 검색"/></div>
        <select value={group} onChange={(e)=>setGroup(e.target.value)}>{groups.map((item)=><option key={item}>{item}</option>)}</select>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={14}/> 지표 수식 추가</button>
        <button className="btn btn-secondary" onClick={()=>persist(METRIC_FORMULA_CATALOG, '기본 지표 수식으로 복원되었습니다.')}><RotateCcw size={14}/> 기본값 복원</button>
      </div>
      {message && <div className="save-toast">{message}</div>}
      <div className="formula-summary-row"><span>등록 수식 <b>{formulas.length}</b>개</span><span>현재 표시 <b>{filtered.length}</b>개</span><span>보고서 연동 <b>{formulas.filter((item)=>item.enabled).length}</b>개</span></div>
      <div className="settings-table-wrap formula-table-wrap">
        <table className="settings-table formula-manager-table">
          <thead><tr><th>지표명</th><th>분류</th><th>매체</th><th>수식</th><th>보고서 반영</th><th>관리</th></tr></thead>
          <tbody>{filtered.map((item)=><tr key={item.id}>
            <td><strong>{item.label}</strong></td>
            <td><span className="settings-status ok">{item.group}</span></td>
            <td>{item.channel??'전체'}</td>
            <td><code>{item.formula}</code></td>
            <td><button type="button" className={`switch ${item.enabled?'on':''}`} aria-pressed={item.enabled} onClick={()=>persist(formulas.map((formula)=>formula.id===item.id?{...formula,enabled:!formula.enabled}:formula), item.enabled?'보고서 반영에서 제외했습니다.':'보고서 포함 지표에 반영했습니다.')}><i/></button></td>
            <td><div className="inline-actions"><button className="icon-btn visible-action" onClick={()=>openEdit(item)} title="수정"><PencilLine size={15}/></button><button className="icon-btn danger visible-action" onClick={()=>{if(window.confirm(`${item.label} 수식을 삭제할까요?`))persist(formulas.filter((formula)=>formula.id!==item.id),'지표 수식이 삭제되었습니다.')}} title="삭제"><Trash2 size={15}/></button></div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {filtered.length===0 && <div className="settings-empty-state">검색 조건에 맞는 지표 수식이 없습니다.</div>}
    </SectionCard>
    <SectionCard id="setting-1" title="예산 임계값"><div className="threshold-list"><Field label="저소진 주의"><div className="unit-input"><input type="number" defaultValue="90"/><span>% 미만</span></div></Field><Field label="초과 위험 주의"><div className="unit-input"><input type="number" defaultValue="100"/><span>% 초과</span></div></Field><Field label="초과 예상"><div className="unit-input"><input type="number" defaultValue="110"/><span>% 초과</span></div></Field></div></SectionCard>
    <SectionCard id="setting-2" title="소재 피로도 임계값" description="최근 7일과 직전 7일을 비교합니다."><div className="threshold-list"><Field label="CTR 하락 위험"><div className="unit-input"><input type="number" defaultValue="20"/><span>% 이상</span></div></Field><Field label="CPC 상승 위험"><div className="unit-input"><input type="number" defaultValue="20"/><span>% 이상</span></div></Field><Field label="교체 권장"><div className="unit-input"><input type="number" defaultValue="35"/><span>% 이상</span></div></Field></div></SectionCard>
    {showAdd && <div className="modal-backdrop" onClick={()=>setShowAdd(false)}><div className="modal-card wide formula-editor-modal" onClick={(e)=>e.stopPropagation()}>
      <div className="modal-head"><div><h3>{editingId?'지표 수식 수정':'지표 수식 추가'}</h3><p>목록에서 광고 지표를 선택하거나 사용자 정의 수식을 입력합니다.</p></div><button className="icon-btn visible-action" onClick={()=>setShowAdd(false)}><X size={18}/></button></div>
      {!editingId && <label className="field-label">광고 지표 수식 종류<select value={selectedCatalogId} onChange={(e)=>selectCatalog(e.target.value)}><option value="">목록에서 선택</option>{availableCatalog.map((item)=><option key={item.id} value={item.id}>{item.group} · {item.label}</option>)}</select></label>}
      <div className="form-grid"><label className="field-label">지표명<input value={draft.label} onChange={(e)=>setDraft({...draft,label:e.target.value})}/></label><label className="field-label">분류<select value={draft.group} onChange={(e)=>setDraft({...draft,group:e.target.value})}>{METRIC_FORMULA_GROUPS.map((g)=><option key={g} value={g}>{g}</option>)}</select></label></div>
      <label className="field-label">매체<select value={draft.channel} onChange={(e)=>setDraft({...draft,channel:e.target.value})}>{METRIC_FORMULA_CHANNELS.map((c)=><option key={c} value={c}>{c}</option>)}</select></label>
      <label className="field-label">계산 수식<textarea rows={4} value={draft.formula} onChange={(e)=>setDraft({...draft,formula:e.target.value})} placeholder="예: 총 광고비 ÷ 총 DB 개수"/></label>
      <div className="formula-help"><b>사용 가능한 표기 예시</b><span>사칙연산(+, −, ×, ÷), 백분율(× 100), 합계(SUM), 원천 데이터 필드명을 사용할 수 있습니다.</span></div>
      <div className="modal-actions"><button className="btn secondary" onClick={()=>setShowAdd(false)}>취소</button><button className="btn primary" onClick={saveDraft}><Save size={14}/> 저장</button></div>
    </div></div>}
  </>;
}

function ProposalCalculationSettingsPanel() {
  const [settings, setSettings] = useState<ProposalCalculationSettings>(() => loadProposalSettings());
  const [saved, setSaved] = useState('');
  const preset = detectPreset(settings);
  const update = (key: keyof ProposalCalculationSettings, value: number) => setSettings(prev => ({ ...prev, [key]: value }));
  const applyPreset = (name: Exclude<ProposalSettingsPreset, 'custom'>) => setSettings(PROPOSAL_SETTINGS_PRESETS[name]);
  const save = () => {
    const ok = saveProposalSettings(settings);
    setSaved(ok ? '저장했습니다. 다음 제안서 생성부터 반영됩니다.' : '저장에 실패했습니다.');
    setTimeout(() => setSaved(''), 2600);
  };
  return (
    <>
      <SectionCard id="proposal-1" title="예산 배분 프리셋" description="보수형·기본형·공격형 중 하나를 고르면 아래 세부 값이 한 번에 바뀝니다. 값을 직접 조정하면 '직접 설정'으로 표시됩니다.">
        <div className="preset-choice-grid">
          {(['conservative', 'standard', 'aggressive'] as const).map(name => (
            <label key={name}><input type="radio" name="proposal-preset" checked={preset === name} onChange={() => applyPreset(name)} /><span><strong>{name === 'conservative' ? '보수형' : name === 'standard' ? '기본형' : '공격형'}</strong><small>{name === 'conservative' ? '신규 매체 예산 6%, 증액·감액 폭 12%' : name === 'standard' ? '신규 매체 예산 10%, 증액·감액 폭 20%' : '신규 매체 예산 16%, 증액 30% · 감액 15%'}</small></span></label>
          ))}
          <label><input type="radio" name="proposal-preset" checked={preset === 'custom'} readOnly /><span><strong>직접 설정</strong><small>아래 값을 직접 조정 중</small></span></label>
        </div>
      </SectionCard>
      <SectionCard id="proposal-2" title="세부 계산 기준값" description="다음달 제안서를 만들 때 사용하는 계산 기준입니다.">
        <div className="settings-form-grid">
          <label className="field-label">신규 매체 시범 예산 비율 (%)
            <input type="number" min={0} max={30} value={Math.round(settings.newPlatformBudgetRatio * 100)} onChange={e => update('newPlatformBudgetRatio', Number(e.target.value) / 100)} />
          </label>
          <label className="field-label">신규 매체 매출 증분 반영 비율 (%)
            <input type="number" min={0} max={100} value={Math.round(settings.newPlatformRevenueContributionRatio * 100)} onChange={e => update('newPlatformRevenueContributionRatio', Number(e.target.value) / 100)} />
          </label>
          <label className="field-label">효율 우수 매체 증액 폭 (%)
            <input type="number" min={0} max={100} value={settings.increasePercent} onChange={e => update('increasePercent', Number(e.target.value))} />
          </label>
          <label className="field-label">효율 저조 매체 감액 폭 (%)
            <input type="number" min={0} max={100} value={settings.decreasePercent} onChange={e => update('decreasePercent', Number(e.target.value))} />
          </label>
          <label className="field-label">'낮을수록 좋음' 지표 목표 개선폭 (%)
            <input type="number" min={0} max={20} value={settings.lowerIsBetterImprovementPercent} onChange={e => update('lowerIsBetterImprovementPercent', Number(e.target.value))} />
          </label>
          <label className="field-label">신규 매체 초기 CPA 추정 기본값 (원)
            <input type="number" min={0} step={1000} value={settings.defaultInitialCpa} onChange={e => update('defaultInitialCpa', Number(e.target.value))} />
          </label>
        </div>
        <div className="modal-actions" style={{ marginTop: 14 }}>
          {saved && <span style={{ color: '#15803d', fontSize: 12.5, marginRight: 'auto' }}>{saved}</span>}
          <button className="btn primary" onClick={save}><Save size={15} /> 저장</button>
        </div>
      </SectionCard>
    </>
  );
}

// 이 앱의 localStorage 키는 시기별로 여러 접두사를 써왔습니다. "전체 데이터 백업"이
// 실제로 전체를 담으려면 이 접두사를 쓰는 키를 모두 포함해야 합니다.
const BACKUP_PREFIXES = ['adcc-', 'acc-', 'acc_', 'ad-control-center-'];
// 로그인 토큰·사용자 식별 정보는 보안상 백업 파일에 남기지 않습니다.
const BACKUP_EXCLUDE_KEYS = new Set(['acc_token', 'acc_user']);

function BackupRestoreSettings() {
  const [status, setStatus] = useState('');
  const [lastBackupAt, setLastBackupAt] = useState(() => { try { return localStorage.getItem('adcc-last-backup-at') ?? ''; } catch { return ''; } });
  const usageKb = useMemo(() => {
    try {
      let total = 0;
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) total += (localStorage.getItem(key)?.length ?? 0) + key.length;
      }
      return Math.round((total * 2) / 1024); // UTF-16 문자 2바이트 근사치
    } catch { return 0; }
  }, [status]);
  const backup = () => {
    try {
      // 이 앱은 여러 화면이 서로 다른 시기에 만들어지면서 localStorage 키 접두사가
      // 통일되지 않았습니다(adcc-, acc-, acc_, ad-control-center- 등). "전체 데이터
      // 백업"이라는 이름에 맞게 이 접두사를 쓰는 키를 전부 포함하되, 로그인 토큰처럼
      // 보안에 민감한 키는 백업 파일에 남기지 않습니다.
      const data: Record<string, string> = {};
      for (const key in localStorage) {
        if (!Object.prototype.hasOwnProperty.call(localStorage, key)) continue;
        if (BACKUP_EXCLUDE_KEYS.has(key)) continue;
        if (BACKUP_PREFIXES.some(prefix => key.startsWith(prefix))) {
          data[key] = localStorage.getItem(key) ?? '';
        }
      }
      const payload = JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), data }, null, 0);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HOWTOM_유니버스_백업_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const now = new Date().toLocaleString('ko-KR');
      localStorage.setItem('adcc-last-backup-at', now);
      setLastBackupAt(now);
      setStatus(`백업 파일을 저장했습니다 (${Object.keys(data).length}개 항목).`);
    } catch {
      setStatus('백업에 실패했습니다.');
    }
    setTimeout(() => setStatus(''), 3000);
  };
  const restore = (file: File, mode: 'merge' | 'replace') => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const data = parsed.data ?? parsed; // 예전 형식(schemaVersion 없음) 호환
        if (!data || typeof data !== 'object') throw new Error('형식 오류');
        const confirmMessage = mode === 'replace'
          ? '현재 저장된 데이터를 모두 지우고 백업 파일 내용으로 완전히 교체합니다. 백업 파일에 없는 데이터(예: 그 사이 새로 만든 일정)는 사라집니다. 계속할까요?'
          : '백업 파일의 내용을 현재 데이터 위에 덮어씁니다(백업에 없는 기존 데이터는 유지됩니다). 계속할까요?';
        if (!window.confirm(confirmMessage)) return;
        if (mode === 'replace') {
          // 전체 교체: 먼저 백업 대상 접두사에 해당하는 기존 키를 전부 지운 뒤 복원합니다.
          // 그래야 백업 이후 삭제됐던 일정·보고서가 복원 후에도 유령처럼 남지 않습니다.
          const keysToRemove: string[] = [];
          for (const key in localStorage) {
            if (Object.prototype.hasOwnProperty.call(localStorage, key) && BACKUP_PREFIXES.some(prefix => key.startsWith(prefix)) && !BACKUP_EXCLUDE_KEYS.has(key)) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
        }
        Object.entries(data).forEach(([key, value]) => {
          if (typeof value === 'string') localStorage.setItem(key, value);
        });
        setStatus('복원을 완료했습니다. 화면을 새로고침합니다.');
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        setStatus('올바른 백업 파일이 아닙니다.');
        setTimeout(() => setStatus(''), 3000);
      }
    };
    reader.readAsText(file);
  };
  return (
    <>
      <SectionCard id="backup-1" title="전체 데이터 백업" description="광고주 설정, 저장된 보고서, 월간 보고서, 제안서, 일정 등 이 브라우저에 저장된 모든 데이터를 하나의 파일로 내려받습니다.">
        <div className="modal-actions">
          <button className="btn primary" onClick={backup}><Download size={15} /> 지금 백업하기</button>
          {lastBackupAt && <span className="footnote" style={{ margin: 0 }}>마지막 백업: {lastBackupAt}</span>}
        </div>
      </SectionCard>
      <SectionCard id="backup-2" title="백업 파일로 복원" description="병합 복원은 백업에 없는 기존 데이터를 그대로 두고, 전체 교체 복원은 백업 시점 상태로 완전히 되돌립니다(백업 이후 만든 데이터는 사라집니다). 복원 전에 먼저 현재 상태를 백업해 두는 것을 권장합니다.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="field-label">병합 복원 (백업에 없는 기존 데이터는 유지)
            <input type="file" accept="application/json" onChange={e => { const file = e.target.files?.[0]; if (file) restore(file, 'merge'); e.target.value = ''; }} />
          </label>
          <label className="field-label">전체 교체 복원 (백업 시점 상태로 완전히 되돌리기)
            <input type="file" accept="application/json" onChange={e => { const file = e.target.files?.[0]; if (file) restore(file, 'replace'); e.target.value = ''; }} />
          </label>
        </div>
      </SectionCard>
      <SectionCard id="backup-3" title="저장 공간 사용량" description="브라우저 localStorage는 보통 5~10MB까지 저장할 수 있습니다. 한도에 가까워지면 오래된 샘플 데이터나 저장된 보고서를 정리해 주세요.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (usageKb / 5120) * 100)}%`, height: '100%', background: usageKb > 4000 ? '#dc2626' : usageKb > 2500 ? '#f59e0b' : '#16a34a' }} />
          </div>
          <b style={{ fontSize: 13 }}>{usageKb.toLocaleString()} KB</b>
        </div>
      </SectionCard>
      {status && <div className="save-toast"><CheckCircle2 size={16} />{status}</div>}
    </>
  );
}

function DbIntegrationSettingsPanel() {
  const makeConnection = (): GoogleSheetDbConnection => ({
    id: `db-sheet-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    name: 'Google Sheets DB', endpointUrl: '', sheetName: '', advertiserFallback: '', enabled: true, autoSync: false, syncIntervalMinutes: 60,
  });
  const [connections, setConnections] = useState<GoogleSheetDbConnection[]>(() => loadDbConnections());
  const [draft, setDraft] = useState<GoogleSheetDbConnection>(() => connections[0] ?? makeConnection());
  const [selectedId, setSelectedId] = useState(() => connections[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [testing, setTesting] = useState(false);
  const selected = connections.find(item => item.id === selectedId);
  useEffect(() => { if (selected) setDraft(selected); }, [selectedId]);
  const persist = (next: GoogleSheetDbConnection[]) => { setConnections(next); saveDbConnections(next); };
  const saveCurrent = () => {
    if (!draft.name.trim()) { setMessage('연결 이름을 입력해 주세요.'); return; }
    if (!draft.endpointUrl.trim()) { setMessage('Apps Script 웹앱 URL을 입력해 주세요.'); return; }
    const exists = connections.some(item => item.id === draft.id);
    const next = exists ? connections.map(item => item.id === draft.id ? draft : item) : [draft, ...connections];
    persist(next); setSelectedId(draft.id); setMessage('DB 연동 설정을 저장했습니다.'); setTimeout(()=>setMessage(''),2600);
  };
  const add = () => { const next=makeConnection(); setDraft(next); setSelectedId(''); setMessage('새 연결 정보를 입력하세요.'); };
  const remove = (id: string) => {
    if (!window.confirm('이 Google Sheets 연결과 이 연결에서 가져온 DB 집계 데이터를 삭제할까요?')) return;
    deleteDbRowsForConnection(id); const next=connections.filter(item=>item.id!==id); persist(next); setSelectedId(next[0]?.id??''); setDraft(next[0]??makeConnection());
  };
  const test = async () => {
    if (!draft.endpointUrl.trim()) { setMessage('Apps Script 웹앱 URL을 입력해 주세요.'); return; }
    const exists=connections.some(item=>item.id===draft.id); if(!exists) persist([draft,...connections]); else persist(connections.map(item=>item.id===draft.id?draft:item));
    setTesting(true); const result=await syncDbConnection(draft); setTesting(false); setMessage(result.ok?`연동 성공 · ${result.rows.length}개 집계 행을 가져왔습니다.`:`연동 실패 · ${result.message}`); setConnections(loadDbConnections()); if(result.ok)setDraft(result.connection);
  };
  const update = <K extends keyof GoogleSheetDbConnection,>(key: K, value: GoogleSheetDbConnection[K]) => setDraft(prev=>({...prev,[key]:value}));
  return <>
    <SectionCard id="setting-0" title="Google Sheets DB 연결" description="Google Apps Script 웹앱 URL을 등록합니다. 한 연결에서 여러 광고주를 읽거나 광고주별로 연결을 나눌 수 있습니다.">
      <div className="db-settings-layout">
        <aside className="db-settings-list">
          <div className="db-settings-list-head"><b>연결 목록</b><button type="button" className="btn secondary" onClick={add}><Plus size={14}/> 추가</button></div>
          {connections.map(item=><button type="button" key={item.id} className={selectedId===item.id?'active':''} onClick={()=>setSelectedId(item.id)}><span><i className={item.lastSyncOk?'ok':item.lastSyncOk===false?'bad':'idle'}/><b>{item.name}</b></span><small>{item.lastSyncAt?new Date(item.lastSyncAt).toLocaleString('ko-KR'):'동기화 전'}</small></button>)}
          {!connections.length&&<p>등록된 연결이 없습니다.</p>}
        </aside>
        <div className="db-settings-form">
          <div className="settings-form-grid cols-2">
            <Field label="연결 이름"><input value={draft.name} onChange={e=>update('name',e.target.value)} placeholder="예: 스마트렌트카 DB 시트"/></Field>
            <Field label="시트 탭 이름" hint="비워두면 Apps Script의 기본 시트를 사용합니다."><input value={draft.sheetName??''} onChange={e=>update('sheetName',e.target.value)} placeholder="예: DB집계"/></Field>
            <Field label="Apps Script 웹앱 URL" hint="배포된 /exec URL을 입력합니다."><input value={draft.endpointUrl} onChange={e=>update('endpointUrl',e.target.value)} placeholder="https://script.google.com/macros/s/.../exec"/></Field>
            <Field label="광고주 기본값" hint="시트에 광고주 컬럼이 없을 때만 사용합니다."><input value={draft.advertiserFallback??''} onChange={e=>update('advertiserFallback',e.target.value)} placeholder="예: 스마트렌트카"/></Field>
          </div>
          <div className="db-settings-switches">
            <label><span><b>연결 사용</b><small>끄면 전체 동기화에서 제외됩니다.</small></span><input type="checkbox" checked={draft.enabled} onChange={e=>update('enabled',e.target.checked)}/></label>
            <label><span><b>앱 실행 중 자동 동기화</b><small>브라우저가 열려 있을 때 설정 간격으로 최신 데이터를 가져옵니다.</small></span><input type="checkbox" checked={draft.autoSync} onChange={e=>update('autoSync',e.target.checked)}/></label>
            <Field label="자동 동기화 간격"><select value={draft.syncIntervalMinutes} onChange={e=>update('syncIntervalMinutes',Number(e.target.value))}><option value={30}>30분</option><option value={60}>1시간</option><option value={180}>3시간</option><option value={360}>6시간</option><option value={720}>12시간</option><option value={1440}>1일</option></select></Field>
          </div>
          <div className="inline-actions"><button type="button" className="btn primary" onClick={saveCurrent}><Save size={14}/> 연결 저장</button><button type="button" className="btn secondary" disabled={testing} onClick={test}><RefreshCw size={14}/>{testing?'연동 중':'연동 테스트·동기화'}</button>{connections.some(item=>item.id===draft.id)&&<button type="button" className="btn secondary danger" onClick={()=>remove(draft.id)}><Trash2 size={14}/> 연결 삭제</button>}</div>
          {message&&<p className={`db-settings-message ${message.includes('실패')||message.includes('입력')?'bad':'ok'}`}>{message}</p>}
          {draft.lastMessage&&<p className="db-settings-last"><b>마지막 결과</b> {draft.lastMessage}{draft.lastSyncAt&&` · ${new Date(draft.lastSyncAt).toLocaleString('ko-KR')}`}</p>}
        </div>
      </div>
    </SectionCard>
    <SectionCard id="setting-1" title="권장 시트 컬럼" description="컬럼명은 한글/영문 별칭을 자동 인식합니다. 개인정보 원문은 가져오지 않습니다.">
      <div className="db-schema-grid"><span>날짜 <b>필수</b></span><span>광고주 <b>필수*</b></span><span>매체 <b>필수</b></span><span>campaignId</span><span>캠페인명</span><span>creativeId</span><span>소재명</span><span>DB <b>필수</b></span><span>유효DB</span><span>계약</span><span>광고비</span><span>매출</span><span>플랫폼전환</span></div>
      <p className="settings-hint">* 연결 설정에서 광고주 기본값을 지정하면 시트의 광고주 컬럼은 생략할 수 있습니다. 이름·전화번호·이메일 같은 고객 개인정보 컬럼은 HOWTOM이 읽지 않습니다.</p>
    </SectionCard>
    <SectionCard id="setting-2" title="데이터 연결 기준" description="DB는 광고 플랫폼 전환과 분리해서 저장하며, 실제 DB가 있으면 분석 화면의 DB/리드 수를 우선 적용합니다.">
      <div className="db-rule-list"><p><b>매체별 분석</b><span>날짜 + 광고주 + 매체가 일치하면 실제 DB로 리드 수를 교체합니다.</span></p><p><b>캠페인 분석</b><span>campaignId/캠페인명이 있으면 캠페인 DB 상세에 연결할 수 있습니다. 광고비를 임의 분할하지 않습니다.</span></p><p><b>소재 분석</b><span>creativeId/소재명이 있으면 소재별 실제 DB·유효DB·계약 품질 분석에 연결합니다. 식별값이 없으면 매체/캠페인 DB를 소재에 임의 분배하지 않습니다.</span></p><p><b>통합 홈·전환 퍼널</b><span>연동된 실제 DB·유효DB·계약을 우선 집계합니다.</span></p><p><b>광고 플랫폼 전환</b><span>시트에 플랫폼전환 컬럼이 있으면 실제 DB와 일치율을 별도로 비교합니다.</span></p></div>
    </SectionCard>
  </>;
}
