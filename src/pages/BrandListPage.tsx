import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { BRAND_REPORTS } from '../data/brandReports';
import { sumFields } from '../types/brandReport';

function totalSpend(data: Record<string, Record<string, any>>): number {
  const all = Object.values(data).flatMap((byDate) => Object.values(byDate));
  return sumFields(all as any).spend ?? 0;
}

// 대시보드와 보고서 모두 "광고주 목록 → 광고주별 상세" 구조를 공유합니다.
// 광고주가 계속 늘어날 걸 감안해서 목록은 이름/광고비/버튼 3가지만 보여주고,
// 이름으로 바로 검색해서 찾아갈 수 있게 했습니다.
export function BrandListPage({ variant }: { variant: 'dashboard' | 'reports' }) {
  const [query, setQuery] = useState('');
  const linkPrefix = variant === 'dashboard' ? '/dashboard' : '/reports';
  const title = variant === 'dashboard' ? '전체 대시보드' : '보고서';
  const cta = variant === 'dashboard' ? '대시보드 보기' : '보고서 보기';

  const rows = useMemo(
    () =>
      BRAND_REPORTS.map(({ config, data }) => ({ config, spend: totalSpend(data) })).filter((r) =>
        r.config.brandName.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [query]
  );

  return (
    <div>
      <PageHeader title={title} description="광고주를 선택하면 해당 광고주의 데이터를 볼 수 있습니다." />

      <div className="search-input-wrap">
        <Search size={15} />
        <input
          className="search-input"
          placeholder="광고주명 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="brand-table">
          <thead>
            <tr>
              <th>광고주명</th>
              <th className="num">광고비</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ config, spend }) => (
              <tr key={config.brandId}>
                <td className="brand-name-cell">
                  {config.brandName}
                  {!config.hasRealData && <span className="sample-tag">(예시)</span>}
                </td>
                <td className="num">₩{spend.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link className="btn btn-primary" to={`${linkPrefix}/${config.brandId}`}>{cta}</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px 0' }}>
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
