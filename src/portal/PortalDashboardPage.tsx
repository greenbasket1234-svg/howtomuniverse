import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { portalApi, clearPortalToken, TierRestrictedError, type PortalAccount, type PortalDashboardTotals, type PortalCampaignRow } from './portalApi';

function money(v: number) { return `${Math.round(v).toLocaleString()}원`; }
function num(v: number) { return Math.round(v).toLocaleString(); }

export function PortalDashboardPage() {
  const [account, setAccount] = useState<PortalAccount | null>(null);
  const [totals, setTotals] = useState<PortalDashboardTotals | null>(null);
  const [campaigns, setCampaigns] = useState<PortalCampaignRow[] | null>(null);
  const [campaignsLocked, setCampaignsLocked] = useState<{ message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [me, dash] = await Promise.all([portalApi.me(), portalApi.dashboard()]);
        setAccount(me);
        setTotals(dash.totals);
        try {
          const camp = await portalApi.campaigns();
          setCampaigns(camp.rows);
        } catch (e) {
          if (e instanceof TierRestrictedError) setCampaignsLocked({ message: e.message });
          else throw e;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.');
        navigate('/portal/login', { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const logout = () => { clearPortalToken(); navigate('/portal/login', { replace: true }); };

  if (loading) return <div style={{ padding: 40, color: '#64748b' }}>불러오는 중...</div>;
  if (error) return <div style={{ padding: 40, color: '#b91c1c' }}>{error}</div>;

  const kpis = totals ? [
    { label: '광고비', value: money(totals.spend) },
    { label: '노출', value: num(totals.impressions) },
    { label: '클릭', value: num(totals.clicks) },
    { label: 'DB', value: num(totals.dbCount) },
    { label: '구매', value: num(totals.purchases) },
    { label: '매출', value: money(totals.revenue) },
    { label: 'ROAS', value: `${totals.roas.toFixed(0)}%` },
  ] : [];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <header style={{ background: '#0f1b35', color: '#fff', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 900, letterSpacing: '.03em' }}>HOWTOM <span style={{ color: '#60a5fa' }}>포털</span></div>
          <small style={{ color: '#94a3b8' }}>{account?.advertiserName}</small>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ background: account?.tier ? '#1e3a5f' : '#7f1d1d', color: '#dbeafe', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700 }}>{account?.tierLabel || '미설정'}</span>
          <button onClick={logout} style={{ background: 'transparent', border: '1px solid #334155', color: '#dbeafe', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>로그아웃</button>
        </div>
      </header>
      <main style={{ padding: '28px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 4px' }}>광고 성과 요약</h2>
        <p style={{ color: '#64748b', marginTop: 0 }}>{account?.name}님, 안녕하세요. {account?.advertiserName}의 전체 기간 누적 성과입니다.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14, marginTop: 20 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 3px rgba(15,23,42,.06)' }}>
              <div style={{ color: '#64748b', fontSize: 13 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{k.value}</div>
            </div>
          ))}
        </div>
        {(!totals || totals.impressions === 0) && (
          <div style={{ marginTop: 24, padding: 20, border: '1px dashed #cbd5e1', borderRadius: 12, background: '#fff', color: '#64748b', textAlign: 'center' }}>
            아직 집계된 광고 성과 데이터가 없습니다.
          </div>
        )}

        <h3 style={{ marginTop: 36 }}>캠페인별 분석</h3>
        {campaignsLocked ? (
          <div style={{ padding: 24, border: '1px dashed #93c5fd', borderRadius: 12, background: '#eff6ff', color: '#1d4ed8', textAlign: 'center' }}>
            <b>INSIGHT 등급부터 이용 가능합니다.</b>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#3b5bdb' }}>{campaignsLocked.message}</p>
          </div>
        ) : campaigns && campaigns.length > 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f8fafc', color: '#64748b' }}>
                <th style={{ padding: 10, textAlign: 'left' }}>매체</th><th style={{ padding: 10, textAlign: 'left' }}>캠페인</th>
                <th style={{ padding: 10, textAlign: 'right' }}>광고비</th><th style={{ padding: 10, textAlign: 'right' }}>클릭</th><th style={{ padding: 10, textAlign: 'right' }}>DB</th>
              </tr></thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #eef2f7' }}>
                    <td style={{ padding: 10 }}>{c.channel}</td><td style={{ padding: 10 }}>{c.campaignName || c.campaignId}</td>
                    <td style={{ padding: 10, textAlign: 'right' }}>{money(c.spend)}</td><td style={{ padding: 10, textAlign: 'right' }}>{num(c.clicks)}</td><td style={{ padding: 10, textAlign: 'right' }}>{num(c.dbCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 20, border: '1px dashed #cbd5e1', borderRadius: 12, background: '#fff', color: '#64748b', textAlign: 'center' }}>아직 캠페인 데이터가 없습니다.</div>
        )}
      </main>
    </div>
  );
}
