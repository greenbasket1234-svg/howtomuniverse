import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, TrendingUp, TrendingDown, Power, ExternalLink, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { MockNote } from '../components/MockNote';
import { BRAND_REPORTS } from '../data/brandReports';
import { getKeywordAnalysisRows, type KeywordAnalysisGrade, type KeywordAnalysisRow, type KeywordPlatform } from '../data/keywordAnalysisMock';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

const gradeLabel: Record<KeywordAnalysisGrade, string> = {
  high_performance: '고성과', stable: '안정', waste: '비용 낭비', exclude_candidate: '제외 후보', expansion_candidate: '확장 후보',
};
const gradeTone: Record<KeywordAnalysisGrade, 'success' | 'neutral' | 'danger' | 'warning' | 'accent'> = {
  high_performance: 'success', stable: 'neutral', waste: 'danger', exclude_candidate: 'warning', expansion_candidate: 'accent',
};
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(2)}%` : '-');
const won = (v: number) => `₩${Math.round(v).toLocaleString()}`;

type ChannelKey = 'naver' | 'google' | 'daangn' | 'kakao';
// 이 파일은 매체를 영문 키(naver/google/daangn/kakao)로 다루지만, 키워드 데이터 소스
// (keywordAnalysisMock.ts)는 한글 값(KeywordPlatform)을 기준으로 만들어져 있습니다.
// 이 맵으로 항상 변환해서 넘겨야, 두 타입이 서로 안 맞아 빌드가 실패하는 일이 없습니다.
const CHANNEL_LABEL: Record<ChannelKey, KeywordPlatform> = { naver: '네이버', google: '구글', daangn: '당근', kakao: '카카오' };
const CHANNEL_URL: Record<ChannelKey, string> = {
  naver: 'https://searchad.naver.com',
  google: 'https://ads.google.com',
  daangn: 'https://ads.daangn.com',
  kakao: 'https://keywordad.kakao.com',
};
const CHANNEL_AD_NAME: Record<ChannelKey, string> = { naver: '네이버 검색광고', google: '구글 검색광고', daangn: '당근 비즈프로필 키워드', kakao: '카카오 키워드광고' };

function storageKey(channel: ChannelKey, brandId: string) { return `adcc-search-ads-${channel}-${brandId}`; }

function loadRowState(channel: ChannelKey, brandId: string, base: KeywordAnalysisRow[]): (KeywordAnalysisRow & { budget: number; automations: string[] })[] {
  try {
    const raw = localStorage.getItem(storageKey(channel, brandId));
    if (raw) {
      const saved = JSON.parse(raw) as Record<string, { status: 'active' | 'paused'; budget: number; automation?: string; automations?: string[] }>;
      return base.map((r) => {
        const entry = saved[r.id];
        // 예전 버전은 규칙을 하나(automation: string)만 저장했습니다. 그 데이터도 배열
        // 형태로 자연스럽게 이어받습니다.
        const automations = entry?.automations ?? (entry?.automation && entry.automation !== '자동화 없음' ? [entry.automation] : []);
        return { ...r, status: entry?.status ?? r.status, budget: entry?.budget ?? Math.round(r.spend * 1.2), automations };
      });
    }
  } catch { /* 무시 */ }
  return base.map((r) => ({ ...r, budget: Math.round(r.spend * 1.2), automations: [] }));
}

// ============================================================
// 채널별 광고주 목록
// ============================================================
export function SearchAdBrandListPage({ channel }: { channel: ChannelKey }) {
  const [query, setQuery] = useState('');
  const { filterValue } = useAdvertiserFilter();
  const label = CHANNEL_LABEL[channel];
  const rows = useMemo(
    () => BRAND_REPORTS.filter(({ config }) => config.brandName.toLowerCase().includes(query.trim().toLowerCase()) && matchesAdvertiserFilter(config.brandName, filterValue))
      .map(({ config }) => {
        const keywordRows = loadRowState(channel, config.brandId, getKeywordAnalysisRows(config.brandId, config.brandName, CHANNEL_LABEL[channel]));
        return { config, keywordCount: keywordRows.length, totalBudget: keywordRows.reduce((s, r) => s + r.budget, 0), totalSpend: keywordRows.reduce((s, r) => s + r.spend, 0) };
      }),
    [query, filterValue, channel]
  );
  type SortKey = 'name' | 'keywordCount' | 'totalBudget' | 'totalSpend';
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // 값 범위 필터: "지금 정렬 기준으로 쓰는 항목"(예: 총 일예산, 소진 비용)의 최소·최대를
  // 지정해서 그 범위에 있는 광고주만 봅니다.
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
  const rangedRows = useMemo(() => {
    if (sortKey === 'name' || (!rangeMin && !rangeMax)) return rows;
    const min = rangeMin ? Number(rangeMin) : -Infinity;
    const max = rangeMax ? Number(rangeMax) : Infinity;
    return rows.filter(r => { const v = r[sortKey] as number; return v >= min && v <= max; });
  }, [rows, sortKey, rangeMin, rangeMax]);
  const sortedRows = useMemo(() => [...rangedRows].sort((a, b) => {
    const valueOf = (r: typeof a) => sortKey === 'name' ? r.config.brandName : r[sortKey];
    const av = valueOf(a), bv = valueOf(b);
    const diff = typeof av === 'string' ? av.localeCompare(String(bv)) : (av as number) - (bv as number);
    return sortDir === 'asc' ? diff : -diff;
  }), [rangedRows, sortKey, sortDir]);
  const toggleSort = (key: SortKey) => { if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc'); } };
  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <div>
      <PageHeader title={`${label} 키워드 보고서`} description={`${CHANNEL_AD_NAME[channel]} 키워드별 효율을 분석하고 예산 조정·ON/OFF를 관리합니다.`} />
      <div className="channel-switch-tabs">
        {(['naver', 'google', 'daangn', 'kakao'] as ChannelKey[]).map(c => (
          <Link key={c} to={`/search-ads/${c}`} className={c === channel ? 'active' : ''}>{CHANNEL_LABEL[c]}</Link>
        ))}
      </div>
      {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경)</div>}
      <div className="search-input-wrap"><Search size={15} /><input className="search-input" placeholder="광고주 이름으로 검색" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      {sortKey !== 'name' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#64748b', margin: '8px 0' }}>
          {sortKey === 'keywordCount' ? '키워드 수' : sortKey === 'totalBudget' ? '총 일예산' : '소진 비용'} 범위:
          <input type="number" placeholder="최소" value={rangeMin} onChange={e => setRangeMin(e.target.value)} style={{ width: 90, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 12 }} />
          ~
          <input type="number" placeholder="최대" value={rangeMax} onChange={e => setRangeMax(e.target.value)} style={{ width: 90, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 12 }} />
          {(rangeMin || rangeMax) && <button type="button" className="btn sm secondary" onClick={() => { setRangeMin(''); setRangeMax(''); }}>해제</button>}
        </div>
      )}
      <div className="card" style={{ padding: 0 }}>
        <table className="brand-table">
          <thead><tr><th style={{cursor:'pointer'}} onClick={()=>toggleSort('name')}>광고주명{sortArrow('name')}</th><th className="num" style={{cursor:'pointer'}} onClick={()=>toggleSort('keywordCount')}>키워드 수{sortArrow('keywordCount')}</th><th className="num" style={{cursor:'pointer'}} onClick={()=>toggleSort('totalBudget')}>총 일예산{sortArrow('totalBudget')}</th><th className="num" style={{cursor:'pointer'}} onClick={()=>toggleSort('totalSpend')}>현재 소진 비용{sortArrow('totalSpend')}</th><th></th></tr></thead>
          <tbody>
            {sortedRows.map(({ config, keywordCount, totalBudget, totalSpend }) => {
              return (
                <tr key={config.brandId}>
                  <td className="brand-name-cell">{config.brandName}</td>
                  <td className="num">{keywordCount}개</td>
                  <td className="num">{won(totalBudget)}</td>
                  <td className="num">{won(totalSpend)}</td>
                  <td style={{ textAlign: 'right' }}><Link className="btn btn-primary" to={`/search-ads/${channel}/${config.brandId}`}>관리하기</Link></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>해당 광고주가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      <MockNote>{`${label} API 연동 전 화면 검증용 mock 데이터입니다.`}</MockNote>
    </div>
  );
}

// ============================================================
// 채널별 키워드 관리 상세 (효율 분석 + 예산 증액/감액 + ON/OFF)
// ============================================================
export function SearchAdKeywordDetailPage({ channel }: { channel: ChannelKey }) {
  const { brandId } = useParams();
  const [query, setQuery] = useState('');
  const [grade, setGrade] = useState<'all' | KeywordAnalysisGrade>('all');
  type SortKey = 'impressions' | 'clicks' | 'ctr' | 'spend' | 'conversions' | 'cvr' | 'budget';
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const label = CHANNEL_LABEL[channel];
  const found = BRAND_REPORTS.find(({ config }) => config.brandId === brandId);
  const baseRows = useMemo(() => (found ? getKeywordAnalysisRows(found.config.brandId, found.config.brandName, CHANNEL_LABEL[channel]) : []), [found, channel]);
  const [rows, setRows] = useState(() => (found ? loadRowState(channel, found.config.brandId, baseRows) : []));
  const [editingAutomation, setEditingAutomation] = useState<typeof rows[number] | null>(null);

  if (!found) {
    return <div><Link className="breadcrumb-back" to={`/search-ads/${channel}`}>← 광고주 목록으로</Link><PageHeader title="광고주를 찾을 수 없습니다" description="관리 대상 광고주가 존재하지 않습니다." /></div>;
  }
  const { config } = found;

  const persist = (next: typeof rows) => {
    setRows(next);
    const toSave: Record<string, { status: 'active' | 'paused'; budget: number; automations: string[] }> = {};
    next.forEach((r) => { toSave[r.id] = { status: r.status, budget: r.budget, automations: r.automations }; });
    localStorage.setItem(storageKey(channel, config.brandId), JSON.stringify(toSave));
  };
  const adjustBudget = (id: string, pctChange: number) => persist(rows.map((r) => (r.id === id ? { ...r, budget: Math.max(0, Math.round(r.budget * (1 + pctChange / 100))) } : r)));
  const toggleStatus = (id: string) => persist(rows.map((r) => (r.id === id ? { ...r, status: r.status === 'active' ? 'paused' : 'active' } : r)));

  const filteredRows = [...rows.filter((row) => row.keyword.toLowerCase().includes(query.trim().toLowerCase()) && (grade === 'all' || row.grade === grade))].sort((a, b) => {
    const valueOf = (r: typeof a) => sortKey === 'ctr' ? (r.impressions > 0 ? r.clicks / r.impressions : 0)
      : sortKey === 'cvr' ? (r.clicks > 0 ? r.conversions / r.clicks : 0)
      : r[sortKey];
    const diff = valueOf(a) - valueOf(b);
    return sortDir === 'desc' ? -diff : diff;
  });
  const toggleSort = (key: SortKey) => { if (sortKey === key) setSortDir(sortDir === 'desc' ? 'asc' : 'desc'); else { setSortKey(key); setSortDir('desc'); } };
  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';
  const high = rows.filter((r) => r.grade === 'high_performance');
  const waste = rows.filter((r) => r.grade === 'waste');
  const exclude = rows.filter((r) => r.grade === 'exclude_candidate');
  const expansion = rows.filter((r) => r.grade === 'expansion_candidate');
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);

  return (
    <div>
      <Link className="breadcrumb-back" to={`/search-ads/${channel}`}>← 광고주 목록으로</Link>
      <PageHeader title={`${config.brandName} · ${label} 키워드 관리`} description={`${CHANNEL_AD_NAME[channel]} 키워드별 노출·클릭·광고비·전환 효율 분석과 예산 조정, ON/OFF를 관리합니다.`} action={<a className="btn primary" href={CHANNEL_URL[channel]} target="_blank" rel="noreferrer"><ExternalLink size={15}/> {label} 검색광고 바로가기</a>} />
      <div className="channel-switch-tabs">
        {(['naver', 'google', 'daangn', 'kakao'] as ChannelKey[]).map(c => (
          <Link key={c} to={`/search-ads/${c}/${config.brandId}`} className={c === channel ? 'active' : ''}>{CHANNEL_LABEL[c]}</Link>
        ))}
      </div>

      <div className="summary-grid">
        <div className="summary-card"><div className="summary-card-label">전체 키워드</div><div className="summary-card-value">{rows.length}개</div></div>
        <div className="summary-card"><div className="summary-card-label">고성과</div><div className="summary-card-value">{high.length}개</div></div>
        <div className="summary-card"><div className="summary-card-label">비용 낭비</div><div className="summary-card-value">{waste.length}개</div></div>
        <div className="summary-card"><div className="summary-card-label">제외 후보</div><div className="summary-card-value">{exclude.length}개</div></div>
        <div className="summary-card"><div className="summary-card-label">일 예산 합계</div><div className="summary-card-value">{won(totalBudget)}</div></div>
      </div>

      <div className="keyword-toolbar">
        <div className="search-input-wrap" style={{ marginBottom: 0 }}><Search size={15} /><input className="search-input" placeholder="키워드 검색" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <select className="form-select" value={grade} onChange={(e) => setGrade(e.target.value as any)}>
          <option value="all">전체 분석 등급</option>
          <option value="high_performance">고성과</option><option value="stable">안정</option><option value="waste">비용 낭비</option>
          <option value="exclude_candidate">제외 후보</option><option value="expansion_candidate">확장 후보</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table className="data-table keyword-analysis-table">
            <thead><tr><th>키워드</th><th>광고그룹</th><th className="num" style={{ cursor: 'pointer' }} onClick={() => toggleSort('impressions')}>노출{sortArrow('impressions')}</th><th className="num" style={{ cursor: 'pointer' }} onClick={() => toggleSort('clicks')}>클릭{sortArrow('clicks')}</th><th className="num" style={{ cursor: 'pointer' }} onClick={() => toggleSort('ctr')}>CTR{sortArrow('ctr')}</th><th className="num" style={{ cursor: 'pointer' }} onClick={() => toggleSort('spend')}>광고비{sortArrow('spend')}</th><th className="num" style={{ cursor: 'pointer' }} onClick={() => toggleSort('conversions')}>전환{sortArrow('conversions')}</th><th className="num" style={{ cursor: 'pointer' }} onClick={() => toggleSort('cvr')}>전환율{sortArrow('cvr')}</th><th>분석</th><th className="num" style={{ cursor: 'pointer' }} onClick={() => toggleSort('budget')}>일 예산{sortArrow('budget')}</th><th>예산 조정</th><th>ON/OFF</th><th>ON/OFF 자동화</th></tr></thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.keyword}</strong>{row.memo && <div className="table-cell-note">{row.memo}</div>}</td>
                  <td>{row.adGroup || '-'}</td>
                  <td className="num">{row.impressions.toLocaleString()}</td>
                  <td className="num">{row.clicks.toLocaleString()}</td>
                  <td className="num">{pct(row.clicks, row.impressions)}</td>
                  <td className="num">{won(row.spend)}</td>
                  <td className="num">{row.conversions.toLocaleString()}</td>
                  <td className="num">{pct(row.conversions, row.clicks)}</td>
                  <td><Badge tone={gradeTone[row.grade]}>{gradeLabel[row.grade]}</Badge></td>
                  <td className="num">{won(row.budget)}</td>
                  <td>
                    <div className="inline-actions">
                      <button className="icon-btn" title="예산 10% 증액" onClick={() => adjustBudget(row.id, 10)}><TrendingUp size={14} color="var(--accent)" /></button>
                      <button className="icon-btn" title="예산 10% 감액" onClick={() => adjustBudget(row.id, -10)}><TrendingDown size={14} color="var(--danger)" /></button>
                    </div>
                  </td>
                  <td><button className={`switch ${row.status === 'active' ? 'on' : ''}`} aria-pressed={row.status === 'active'} onClick={() => toggleStatus(row.id)} title={row.status === 'active' ? '끄기' : '켜기'}><i /></button></td>
                  <td><button type="button" className="btn secondary sm" onClick={() => setEditingAutomation(row)}>{row.automations.length > 0 ? `${row.automations.length}개 규칙` : '자동화 없음'}</button></td>
                </tr>
              ))}
              {filteredRows.length === 0 && <tr><td colSpan={13} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>조건에 맞는 키워드가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="keyword-analysis-cards">
        <div className="card"><div className="card-title">고성과 키워드</div>{high.map((r) => <p key={r.id} className="analysis-item"><Badge tone="success">{r.keyword}</Badge> 전환율 {pct(r.conversions, r.clicks)}</p>)}</div>
        <div className="card"><div className="card-title">비용 낭비 키워드</div>{waste.map((r) => <p key={r.id} className="analysis-item"><Badge tone="danger">{r.keyword}</Badge> {r.memo}</p>)}</div>
        <div className="card"><div className="card-title">제외 키워드 후보</div>{exclude.map((r) => <p key={r.id} className="analysis-item"><Badge tone="warning">{r.keyword}</Badge> {r.memo}</p>)}</div>
        <div className="card"><div className="card-title">확장 키워드 후보</div>{expansion.map((r) => <p key={r.id} className="analysis-item"><Badge tone="accent">{r.keyword}</Badge> {r.memo}</p>)}</div>
      </div>
      <div className="footnote">예산 증액/감액과 ON/OFF는 지금 이 화면·브라우저에 저장됩니다. 실제 매체에 반영되려면 각 채널의 광고계정 연동(쓰기 권한)이 필요합니다.</div>
      <MockNote>{`${label} API 연동 전 화면 검증용 mock 데이터입니다.`}</MockNote>
      {editingAutomation && (
        <AutomationEditor
          title={`${editingAutomation.keyword} ON/OFF 자동화`}
          value={editingAutomation.automations}
          onClose={() => setEditingAutomation(null)}
          onSave={(labels) => { persist(rows.map((r) => (r.id === editingAutomation.id ? { ...r, automations: labels } : r))); setEditingAutomation(null); }}
        />
      )}
    </div>
  );
}

export function AutomationModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card final-modal">
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

const WEEKDAY_NAMES_KR = ['일', '월', '화', '수', '목', '금', '토'];
// 특정 날짜/특정 요일/매주 평일/매주 주말/기간 직접 선택/시간대 직접 지정까지 다양한 방식으로
// ON/OFF 자동화 규칙을 설정할 수 있는 공용 편집 모달입니다.
export function AutomationEditor({ title, value, onSave, onClose }: { title: string; value: string[]; onSave: (labels: string[]) => void; onClose: () => void }) {
  type Kind = 'date' | 'weekday_pick' | 'weekday_all' | 'weekend' | 'range' | 'time_only';
  const [rules, setRules] = useState<string[]>(value.filter(v => v !== '자동화 없음'));
  const [kind, setKind] = useState<Kind>('date');
  const [date, setDate] = useState('2026-08-15');
  const [days, setDays] = useState<number[]>([5]); // 금요일 기본
  const [rangeFrom, setRangeFrom] = useState('2026-08-01');
  const [rangeTo, setRangeTo] = useState('2026-08-15');
  const [onTime, setOnTime] = useState('09:00');
  const [offTime, setOffTime] = useState('21:00');
  const toggleDay = (d: number) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  const buildLabel = (): string => {
    const timeRange = `${onTime}~${offTime} ON`;
    if (kind === 'date') return `${date} ${timeRange}`;
    if (kind === 'weekday_pick') return `매주 ${days.map(d => WEEKDAY_NAMES_KR[d]).join(',')}요일 ${timeRange}`;
    if (kind === 'weekday_all') return `매주 평일(월~금) ${timeRange}`;
    if (kind === 'weekend') return `매주 주말(토·일) ${timeRange}`;
    if (kind === 'range') return `${rangeFrom} ~ ${rangeTo} 기간 ${timeRange}`;
    return `매일 ${timeRange}`;
  };
  // 중복(완전히 같은 규칙 문구)이 아니면 계속 추가할 수 있습니다. 서로 다른 요일·시간대
  // 조합을 여러 개 등록해서, 예를 들어 "평일 오전 ON"과 "주말 오후 ON"을 함께 쓸 수 있습니다.
  const addRule = () => {
    const label = buildLabel();
    if (rules.includes(label)) return;
    setRules(prev => [...prev, label]);
  };
  const removeRule = (label: string) => setRules(prev => prev.filter(r => r !== label));
  return (
    <AutomationModal title={title} onClose={onClose}>
      <div className="final-form">
        {rules.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ marginBottom: 6, display: 'block' }}>등록된 규칙 ({rules.length}개)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rules.map(rule => (
                <div key={rule} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 6, padding: '6px 10px', fontSize: 12.5 }}>
                  <span>{rule}</span>
                  <button type="button" className="icon-btn danger" onClick={() => removeRule(rule)}><X size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
        <label>자동화 방식
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="date">특정 날짜 지정</option>
            <option value="weekday_pick">특정 요일 지정</option>
            <option value="weekday_all">매주 평일(월~금)</option>
            <option value="weekend">매주 주말(토·일)</option>
            <option value="range">특정 기간 직접 선택</option>
            <option value="time_only">시간대만 지정(매일)</option>
          </select>
        </label>
        {kind === 'date' && <label>날짜<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>}
        {kind === 'weekday_pick' && (
          <label>요일 선택
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {WEEKDAY_NAMES_KR.map((label, index) => (
                <button key={label} type="button" className={`btn sm ${days.includes(index) ? 'primary' : 'secondary'}`} onClick={() => toggleDay(index)}>{label}</button>
              ))}
            </div>
          </label>
        )}
        {kind === 'range' && <>
          <label>시작일<input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} /></label>
          <label>종료일<input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} /></label>
        </>}
        <label>ON 시각<input type="time" value={onTime} onChange={(e) => setOnTime(e.target.value)} /></label>
        <label>OFF 시각<input type="time" value={offTime} onChange={(e) => setOffTime(e.target.value)} /></label>
        <button className="btn secondary" type="button" onClick={addRule}>+ 이 규칙 목록에 추가</button>
        <button className="btn primary" type="button" onClick={() => onSave(rules)}>전체 저장</button>
      </div>
    </AutomationModal>
  );
}

export const NaverSearchAdBrandListPage = () => <SearchAdBrandListPage channel="naver" />;
export const NaverSearchAdDetailPage = () => <SearchAdKeywordDetailPage channel="naver" />;
export const GoogleSearchAdBrandListPage = () => <SearchAdBrandListPage channel="google" />;
export const GoogleSearchAdDetailPage = () => <SearchAdKeywordDetailPage channel="google" />;
export const DaangnSearchAdBrandListPage = () => <SearchAdBrandListPage channel="daangn" />;
export const DaangnSearchAdDetailPage = () => <SearchAdKeywordDetailPage channel="daangn" />;
export const KakaoSearchAdBrandListPage = () => <SearchAdBrandListPage channel="kakao" />;
export const KakaoSearchAdDetailPage = () => <SearchAdKeywordDetailPage channel="kakao" />;
