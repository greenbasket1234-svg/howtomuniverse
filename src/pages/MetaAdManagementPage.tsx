import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, ExternalLink } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { useMetricRows } from '../hooks/useMetrics';
import type { CreativeMetricRow } from '../types/metrics';

const META_ADS_MANAGER = 'https://adsmanager.facebook.com';

function won(v: number) { return `₩${Math.round(v).toLocaleString()}`; }
function pct(n: number, d: number) { return d ? `${(n / d * 100).toFixed(2)}%` : '-'; }
function roas(revenue: number, spend: number) { return spend ? `${(revenue / spend * 100).toFixed(1)}%` : '-'; }

function connectionText(status?: string) {
  if (status === 'connected') return '연동';
  if (status === 'error') return '동기화 오류';
  return '미연동';
}

function adGrade(row: CreativeMetricRow) {
  const conv = row.dbCount + (row.purchases || 0);
  if (row.spend > 0 && row.clicks >= 10 && conv === 0)
    return { label: '비용 낭비', tone: 'danger' as const };
  if (row.impressions >= 100 && row.clicks === 0)
    return { label: '노출 낭비', tone: 'warning' as const };
  if ((row.revenue || 0) > 0 && row.spend > 0 && (row.revenue || 0) / row.spend >= 2)
    return { label: '고성과', tone: 'success' as const };
  return { label: '안정', tone: 'neutral' as const };
}

// ── 광고주 목록 화면 ──────────────────────────────────────────
export function MetaAdBrandListPage() {
  const [query, setQuery] = useState('');
  const { filterValue } = useAdvertiserFilter();
  const [advertisers] = useAdvertisers();
  const metrics = useMetricRows<CreativeMetricRow>('/metrics/creatives', { channel: 'meta' });

  const connByAdv = useMemo(() =>
    new Map(
      (metrics.meta?.connections || [])
        .filter(c => c.channel === 'meta')
        .map(c => [c.advertiserId, c])
    ), [metrics.meta]);

  const rows = useMemo(() =>
    advertisers
      .filter(a =>
        a.name.toLowerCase().includes(query.toLowerCase()) &&
        matchesAdvertiserFilter(a.name, filterValue)
      )
      .map(a => {
        const part = metrics.rows.filter(r => r.advertiserId === a.id);
        const spend = part.reduce((s, r) => s + r.spend, 0);
        const revenue = part.reduce((s, r) => s + (r.revenue || 0), 0);
        const clicks = part.reduce((s, r) => s + r.clicks, 0);
        const impressions = part.reduce((s, r) => s + r.impressions, 0);
        const conversions = part.reduce((s, r) => s + r.dbCount + (r.purchases || 0), 0);
        return { advertiser: a, adCount: part.length, spend, revenue, clicks, impressions, conversions, connection: connByAdv.get(a.id) };
      }),
    [advertisers, query, filterValue, metrics.rows, connByAdv]);

  return (
    <div>
      <PageHeader
        title="메타 광고 관리"
        description="선택 기간에 Meta API에서 수집한 실제 소재·캠페인 성과만 표시합니다."
        action={<a className="btn secondary" href={META_ADS_MANAGER} target="_blank" rel="noreferrer">광고 관리자 <ExternalLink size={14} /></a>}
      />
      <MetricsDateBar />

      <div className="search-input-wrap">
        <Search size={15} />
        <input className="search-input" placeholder="광고주 이름으로 검색" value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table className="brand-table">
            <thead>
              <tr>
                <th>광고주명</th>
                <th>연동 상태</th>
                <th className="num">소재 수</th>
                <th className="num">노출</th>
                <th className="num">클릭</th>
                <th className="num">광고비</th>
                <th className="num">전환</th>
                <th className="num">ROAS</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.advertiser.id}>
                  <td><b>{r.advertiser.name}</b></td>
                  <td>
                    <Badge tone={r.connection?.status === 'connected' ? 'success' : r.connection?.status === 'error' ? 'danger' : 'neutral'}>
                      {connectionText(r.connection?.status)}
                    </Badge>
                  </td>
                  <td className="num">{r.adCount.toLocaleString()}</td>
                  <td className="num">{r.impressions.toLocaleString()}</td>
                  <td className="num">{r.clicks.toLocaleString()}</td>
                  <td className="num">{won(r.spend)}</td>
                  <td className="num">{r.conversions.toLocaleString()}</td>
                  <td className="num">{roas(r.revenue, r.spend)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link className="btn btn-primary" to={`/meta-ads/${r.advertiser.id}`}>보기</Link>
                  </td>
                </tr>
              ))}
              {!metrics.loading && !rows.length && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>광고주가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="footnote">미연동 광고주는 성과 데이터가 0으로 표시됩니다. Meta 연동은 광고 계정 관리에서 설정할 수 있습니다.</p>
    </div>
  );
}

// ── 광고주별 소재 상세 화면 ───────────────────────────────────
export function MetaAdDetailPage() {
  const { brandId } = useParams();
  const [query, setQuery] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [advertisers] = useAdvertisers();
  const found = advertisers.find(a => a.id === brandId);
  const metrics = useMetricRows<CreativeMetricRow>('/metrics/creatives', { advertiserId: brandId, channel: 'meta' });

  const campaigns = useMemo(() =>
    [...new Set(metrics.rows.map(r => r.campaignName).filter(Boolean))].sort(),
    [metrics.rows]);

  const rows = useMemo(() =>
    metrics.rows.filter(r => {
      const matchQ = !query || r.adName.toLowerCase().includes(query.toLowerCase()) || (r.campaignName || '').toLowerCase().includes(query.toLowerCase());
      const matchC = !campaignFilter || r.campaignName === campaignFilter;
      return matchQ && matchC;
    }),
    [metrics.rows, query, campaignFilter]);

  if (!found) return (
    <div>
      <Link className="breadcrumb-back" to="/meta-ads">← 광고주 목록으로</Link>
      <PageHeader title="광고주를 찾을 수 없습니다" />
    </div>
  );

  const connection = (metrics.meta?.connections || []).find(c => c.advertiserId === brandId && c.channel === 'meta');

  return (
    <div>
      <Link className="breadcrumb-back" to="/meta-ads">← 광고주 목록으로</Link>
      <PageHeader
        title={`${found.name} · 메타 광고`}
        description="실제 creative_daily_metrics를 조회하는 읽기 전용 성과 화면입니다."
        action={<a className="btn secondary" href={META_ADS_MANAGER} target="_blank" rel="noreferrer">광고 관리자 <ExternalLink size={14} /></a>}
      />
      <MetricsDateBar />

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge tone={connection?.status === 'connected' ? 'success' : connection?.status === 'error' ? 'danger' : 'neutral'}>
          Meta · {connectionText(connection?.status)}
        </Badge>

        {campaigns.length > 0 && (
          <select
            className="select-control"
            style={{ height: 32, fontSize: 13 }}
            value={campaignFilter}
            onChange={e => setCampaignFilter(e.target.value)}
          >
            <option value="">전체 캠페인</option>
            {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <div className="search-input-wrap" style={{ margin: 0, marginLeft: 'auto' }}>
          <Search size={15} />
          <input className="search-input" placeholder="소재명·캠페인 검색" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>소재명</th>
                <th>캠페인</th>
                <th>광고세트</th>
                <th>유형</th>
                <th className="num">노출</th>
                <th className="num">클릭</th>
                <th className="num">CTR</th>
                <th className="num">CPC</th>
                <th className="num">광고비</th>
                <th className="num">DB</th>
                <th className="num">구매</th>
                <th className="num">CPA</th>
                <th className="num">전환매출</th>
                <th className="num">ROAS</th>
                <th>분석</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const totalConv = r.dbCount + (r.purchases || 0);
                const g = adGrade(r);
                return (
                  <tr key={`${r.adId}-${i}`}>
                    <td><b>{r.adName || r.adId}</b>{r.title && <><br /><small className="table-cell-note">{r.title}</small></>}</td>
                    <td>{r.campaignName || '-'}</td>
                    <td>{r.adgroupName || r.adgroupId || '-'}</td>
                    <td>{r.mediaType || '-'}</td>
                    <td className="num">{r.impressions.toLocaleString()}</td>
                    <td className="num">{r.clicks.toLocaleString()}</td>
                    <td className="num">{pct(r.clicks, r.impressions)}</td>
                    <td className="num">{r.clicks ? won(r.spend / r.clicks) : '-'}</td>
                    <td className="num">{won(r.spend)}</td>
                    <td className="num">{r.dbCount.toLocaleString()}</td>
                    <td className="num">{(r.purchases || 0).toLocaleString()}</td>
                    <td className="num">{totalConv ? won(r.spend / totalConv) : '-'}</td>
                    <td className="num">{r.revenue ? won(r.revenue) : '-'}</td>
                    <td className="num">{roas(r.revenue || 0, r.spend)}</td>
                    <td><Badge tone={g.tone}>{g.label}</Badge></td>
                  </tr>
                );
              })}
              {!metrics.loading && !rows.length && (
                <tr><td colSpan={15} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>선택 기간에 Meta 소재 데이터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="footnote">예산 변경·ON/OFF 쓰기 기능은 Meta API 쓰기 권한 토큰 연결 후 제공됩니다. 현재는 읽기 전용 성과 화면입니다.</p>
    </div>
  );
}
