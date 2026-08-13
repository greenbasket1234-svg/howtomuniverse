import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { KEYWORD_PLATFORMS, type KeywordAnalysisGrade, type KeywordPlatform } from '../data/keywordAnalysisMock';
import { getPlatformColor } from '../utils/platformColors';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { apiFetch } from '../hooks/useApi';

type KeywordPlatformFilter = '전체' | KeywordPlatform;
type KeywordMetricRow = { advertiserId: string; channel: string; keyword: string; campaignName?: string; impressions: number; clicks: number; spend: number; dbCount: number };
const CHANNEL_TO_PLATFORM: Record<string, KeywordPlatform> = { naver: '네이버', google: '구글', kakao: '카카오', daangn: '당근' };
const PLATFORM_TO_CHANNEL: Record<KeywordPlatform, string> = { 네이버: 'naver', 구글: 'google', 카카오: 'kakao', 당근: 'daangn' };

/** 실제 성과로부터 간단한 운영 등급을 매깁니다 (가짜 데이터가 아니라 실제 노출·클릭·전환 기준). */
function gradeOf(row: { impressions: number; clicks: number; spend: number; conversions: number }): KeywordAnalysisGrade {
  if (row.spend > 0 && row.conversions === 0 && row.clicks >= 10) return 'waste';
  if (row.impressions > 100 && row.clicks === 0) return 'exclude_candidate';
  const cvr = row.clicks ? row.conversions / row.clicks : 0;
  if (cvr >= 0.05 && row.conversions >= 2) return 'high_performance';
  const ctr = row.impressions ? row.clicks / row.impressions : 0;
  if (ctr >= 0.03 && row.clicks < 20) return 'expansion_candidate';
  return 'stable';
}

const gradeLabel: Record<KeywordAnalysisGrade, string> = {
  high_performance: '고성과',
  stable: '안정',
  waste: '비용 낭비',
  exclude_candidate: '제외 후보',
  expansion_candidate: '확장 후보',
};

const gradeTone: Record<KeywordAnalysisGrade, 'success' | 'neutral' | 'danger' | 'warning' | 'accent'> = {
  high_performance: 'success',
  stable: 'neutral',
  waste: 'danger',
  exclude_candidate: 'warning',
  expansion_candidate: 'accent',
};

function pct(numerator: number, denominator: number): string {
  return denominator ? `${((numerator / denominator) * 100).toFixed(2)}%` : '-';
}

function currency(value: number): string {
  return `₩${Math.round(value).toLocaleString()}`;
}

export function KeywordAnalysisBrandListPage() {
  const [query, setQuery] = useState('');
  const [advertisers] = useAdvertisers();
  const [metricRows, setMetricRows] = useState<KeywordMetricRow[]>([]);
  useEffect(() => { apiFetch<{ rows: KeywordMetricRow[] }>('/keyword-metrics').then(r => setMetricRows(r.rows || [])).catch(() => setMetricRows([])); }, []);
  const rows = useMemo(
    () => advertisers.filter(a => a.name.toLowerCase().includes(query.trim().toLowerCase())),
    [advertisers, query]
  );

  return (
    <div>
      <PageHeader
        title="키워드 분석"
        description="광고주를 선택하면 해당 광고주의 키워드 목록과 성과 분석 데이터를 확인할 수 있습니다."
      />

      <div className="search-input-wrap">
        <Search size={15} />
        <input
          className="search-input"
          placeholder="광고주 이름으로 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="brand-table">
          <thead>
            <tr>
              <th>광고주명</th>
              <th>분석 채널</th>
              <th className="num">키워드 수</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((advertiser) => {
              const count = metricRows.filter(m => m.advertiserId === advertiser.id).length;
              return (
                <tr key={advertiser.id}>
                  <td className="brand-name-cell">
                    <Link className="brand-name-link" to={`/keywords/${advertiser.id}/analysis`}>
                      {advertiser.name}
                    </Link>
                    </td>
                  <td>
                    <div className="keyword-platform-badges">
                      {KEYWORD_PLATFORMS.map(platform => (
                        <Link key={platform} to={`/keywords/${advertiser.id}/analysis?platform=${encodeURIComponent(platform)}`} className="keyword-platform-badge-link">
                          <Badge tone="accent" style={{ background: `${getPlatformColor(platform)}1a`, color: getPlatformColor(platform), border: `1px solid ${getPlatformColor(platform)}55` }}>{platform}</Badge>
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="num">{count.toLocaleString()}개</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link className="btn btn-primary" to={`/keywords/${advertiser.id}/analysis`}>분석 보기</Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px 0' }}>
                  &quot;{query}&quot;와 일치하는 광고주가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function KeywordAnalysisPage() {
  const { brandId } = useParams();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [grade, setGrade] = useState<'all' | KeywordAnalysisGrade>('all');
  const initialPlatform = (() => {
    const requested = searchParams.get('platform');
    if (requested === '전체') return '전체';
    return requested && (KEYWORD_PLATFORMS as string[]).includes(requested) ? requested as KeywordPlatform : '전체';
  })();
  const [platform, setPlatform] = useState<KeywordPlatformFilter>(initialPlatform);
  const [advertisers] = useAdvertisers();
  const found = advertisers.find(a => a.id === brandId);
  const [metricRows, setMetricRows] = useState<KeywordMetricRow[]>([]);
  const [connectedChannels, setConnectedChannels] = useState<string[]>([]);
  useEffect(() => {
    if (!brandId) return;
    apiFetch<{ rows: KeywordMetricRow[]; connectedKeywordChannels: string[] }>(`/keyword-metrics?advertiserId=${encodeURIComponent(brandId)}`)
      .then(r => { setMetricRows(r.rows || []); setConnectedChannels(r.connectedKeywordChannels || []); })
      .catch(() => { setMetricRows([]); setConnectedChannels([]); });
  }, [brandId]);

  if (!found) {
    return (
      <div>
        <Link className="breadcrumb-back" to="/keywords">← 광고주 목록으로</Link>
        <PageHeader title="광고주를 찾을 수 없습니다" description="키워드 분석 대상 광고주가 존재하지 않습니다." />
      </div>
    );
  }

  const allRows = metricRows
    .filter(m => platform === '전체' || CHANNEL_TO_PLATFORM[m.channel] === platform)
    .map((m, i) => {
      const platformLabel = CHANNEL_TO_PLATFORM[m.channel] ?? m.channel;
      return {
        id: `${m.channel}-${m.keyword}-${i}`, platform: platformLabel, keyword: m.keyword, campaign: m.campaignName || '-', adGroup: '-',
        impressions: m.impressions, clicks: m.clicks, spend: m.spend, conversions: m.dbCount, status: 'active' as const,
        grade: gradeOf({ impressions: m.impressions, clicks: m.clicks, spend: m.spend, conversions: m.dbCount }),
        memo: undefined as string | undefined,
      };
    });
  const filteredRows = allRows.filter((row) => {
    const matchesQuery = row.keyword.toLowerCase().includes(query.trim().toLowerCase());
    const matchesGrade = grade === 'all' || row.grade === grade;
    return matchesQuery && matchesGrade;
  });

  const high = allRows.filter((row) => row.grade === 'high_performance');
  const waste = allRows.filter((row) => row.grade === 'waste');
  const exclude = allRows.filter((row) => row.grade === 'exclude_candidate');
  const expansion = allRows.filter((row) => row.grade === 'expansion_candidate');

  return (
    <div>
      <Link className="breadcrumb-back" to="/keywords">← 광고주 목록으로</Link>
      <PageHeader
        title={`${found.name} 키워드 분석`}
        description="네이버·당근·구글·카카오 키워드별 노출·클릭·광고비·전환 효율과 운영 후보를 분석합니다."
      />

      {connectedChannels.length === 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 16, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <b>네이버·구글·카카오 검색광고 계정이 아직 연결되지 않았습니다.</b>
          <p className="muted" style={{ margin: '6px 0 10px' }}>키워드는 검색광고 매체에서만 제공되는 개념이라, Meta 계정만으로는 데이터가 채워지지 않습니다. 설정 &gt; 매체 계정 연동에서 해당 매체를 연결하면 이 화면이 자동으로 채워집니다.</p>
          <Link className="btn primary" to="/ad-accounts/connections">매체 계정 연동으로 이동</Link>
        </div>
      )}

      <div className="summary-grid">
        <div className="summary-card"><div className="summary-card-label">전체 키워드</div><div className="summary-card-value">{allRows.length}개</div></div>
        <div className="summary-card"><div className="summary-card-label">고성과</div><div className="summary-card-value">{high.length}개</div></div>
        <div className="summary-card"><div className="summary-card-label">비용 낭비</div><div className="summary-card-value">{waste.length}개</div></div>
        <div className="summary-card"><div className="summary-card-label">제외 후보</div><div className="summary-card-value">{exclude.length}개</div></div>
        <div className="summary-card"><div className="summary-card-label">확장 후보</div><div className="summary-card-value">{expansion.length}개</div></div>
      </div>

      <div className="keyword-toolbar">
        <select className="form-select keyword-platform-select" value={platform} onChange={(e) => setPlatform(e.target.value as KeywordPlatformFilter)}>
          <option value="전체">전체</option>
          {KEYWORD_PLATFORMS.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <div className="search-input-wrap" style={{ marginBottom: 0 }}>
          <Search size={15} />
          <input className="search-input" placeholder="키워드 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="form-select" value={grade} onChange={(e) => setGrade(e.target.value as 'all' | KeywordAnalysisGrade)}>
          <option value="all">전체 분석 등급</option>
          <option value="high_performance">고성과</option>
          <option value="stable">안정</option>
          <option value="waste">비용 낭비</option>
          <option value="exclude_candidate">제외 후보</option>
          <option value="expansion_candidate">확장 후보</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table className="data-table keyword-analysis-table">
            <thead>
              <tr>
                <th>매체</th><th>키워드</th><th>캠페인</th><th>광고그룹</th>
                <th className="num">노출</th><th className="num">클릭</th><th className="num">CTR</th>
                <th className="num">CPC</th><th className="num">광고비</th><th className="num">전환</th>
                <th className="num">전환율</th><th className="num">CPA</th><th>분석</th><th>상태</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td><Badge tone="accent" style={{ background: `${getPlatformColor(row.platform)}1a`, color: getPlatformColor(row.platform), border: `1px solid ${getPlatformColor(row.platform)}55` }}>{row.platform}</Badge></td>
                  <td><strong>{row.keyword}</strong>{row.memo && <div className="table-cell-note">{row.memo}</div>}</td>
                  <td>{row.campaign || '-'}</td><td>{row.adGroup || '-'}</td>
                  <td className="num">{row.impressions.toLocaleString()}</td>
                  <td className="num">{row.clicks.toLocaleString()}</td>
                  <td className="num">{pct(row.clicks, row.impressions)}</td>
                  <td className="num">{row.clicks ? currency(row.spend / row.clicks) : '-'}</td>
                  <td className="num">{currency(row.spend)}</td>
                  <td className="num">{row.conversions.toLocaleString()}</td>
                  <td className="num">{pct(row.conversions, row.clicks)}</td>
                  <td className="num">{row.conversions ? currency(row.spend / row.conversions) : '-'}</td>
                  <td><Badge tone={gradeTone[row.grade]}>{gradeLabel[row.grade]}</Badge></td>
                  <td><Badge tone={row.status === 'active' ? 'success' : 'neutral'}>{row.status === 'active' ? '운영 중' : '중지'}</Badge></td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={14} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>조건에 맞는 키워드가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="keyword-analysis-cards">
        <div className="card"><div className="card-title">고성과 키워드</div>{high.map((r) => <p key={r.id} className="analysis-item"><Badge tone="success">{r.keyword}</Badge> 전환율 {pct(r.conversions, r.clicks)}, CPA {r.conversions ? currency(r.spend / r.conversions) : '-'}</p>)}</div>
        <div className="card"><div className="card-title">비용 낭비 키워드</div>{waste.map((r) => <p key={r.id} className="analysis-item"><Badge tone="danger">{r.keyword}</Badge> 클릭 대비 전환 0건</p>)}</div>
        <div className="card"><div className="card-title">제외 키워드 후보</div>{exclude.map((r) => <p key={r.id} className="analysis-item"><Badge tone="warning">{r.keyword}</Badge> 노출 대비 클릭 0건</p>)}</div>
        <div className="card"><div className="card-title">확장 키워드 후보</div>{expansion.map((r) => <p key={r.id} className="analysis-item"><Badge tone="accent">{r.keyword}</Badge> CTR {pct(r.clicks, r.impressions)}로 양호</p>)}</div>
      </div>

      <div className="footnote" style={{ marginBottom: 12 }}>
        CPM·전환매출·ROAS는 검색광고 키워드 분석에서 활용도가 낮거나 키워드 단위 매출 귀속이 불확실해 기본 지표에서 제외했습니다.
      </div>
    </div>
  );
}
