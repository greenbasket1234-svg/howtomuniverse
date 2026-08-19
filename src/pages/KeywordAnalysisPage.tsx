import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { KEYWORD_PLATFORMS, type KeywordAnalysisGrade, type KeywordPlatform } from '../data/keywordAnalysisMock';
import { getPlatformColor } from '../utils/platformColors';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { useMetricRows } from '../hooks/useMetrics';
import type { KeywordMetricRow } from '../types/metrics';

type KeywordPlatformFilter = '전체' | KeywordPlatform;
const CHANNEL_TO_PLATFORM: Record<string, KeywordPlatform> = { naver: '네이버', google: '구글', kakao: '카카오', daangn: '당근' };
const PLATFORM_TO_CHANNEL: Record<KeywordPlatform, string> = { 네이버: 'naver', 구글: 'google', 카카오: 'kakao', 당근: 'daangn' };

function gradeOf(row: { impressions: number; clicks: number; spend: number; conversions: number }): KeywordAnalysisGrade {
  if (row.spend > 0 && row.conversions === 0 && row.clicks >= 10) return 'waste';
  if (row.impressions > 100 && row.clicks === 0) return 'exclude_candidate';
  const cvr = row.clicks ? row.conversions / row.clicks : 0;
  if (cvr >= 0.05 && row.conversions >= 2) return 'high_performance';
  const ctr = row.impressions ? row.clicks / row.impressions : 0;
  if (ctr >= 0.03 && row.clicks < 20) return 'expansion_candidate';
  return 'stable';
}
const gradeLabel: Record<KeywordAnalysisGrade, string> = {high_performance:'고성과',stable:'안정',waste:'비용 낭비',exclude_candidate:'제외 후보',expansion_candidate:'확장 후보'};
const gradeTone: Record<KeywordAnalysisGrade, 'success'|'neutral'|'danger'|'warning'|'accent'> = {high_performance:'success',stable:'neutral',waste:'danger',exclude_candidate:'warning',expansion_candidate:'accent'};
function pct(n:number,d:number){return d?`${(n/d*100).toFixed(2)}%`:'-'}
function currency(n:number){return `₩${Math.round(n).toLocaleString()}`}
function connectionLabel(status?:string){if(status==='connected')return '연동';if(status==='connector_unimplemented')return '커넥터 미구현';if(status==='error')return '동기화 오류';return '미연동'}

export function KeywordAnalysisBrandListPage(){
  const [query,setQuery]=useState('');
  const [advertisers]=useAdvertisers();
  const {rows:metricRows,meta,loading}=useMetricRows<KeywordMetricRow>('/metrics/keywords');
  const rows=useMemo(()=>advertisers.filter(a=>a.name.toLowerCase().includes(query.trim().toLowerCase())),[advertisers,query]);
  return <div>
    <PageHeader title="키워드 분석" description="매체 API에서 선택 기간에 수집된 실제 키워드 성과만 표시합니다."/>
    <MetricsDateBar/>
    <div className="search-input-wrap"><Search size={15}/><input className="search-input" placeholder="광고주 이름으로 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <div className="card" style={{padding:0}}><div className="table-scroll"><table className="brand-table"><thead><tr><th>광고주명</th><th>키워드 매체 연동</th><th className="num">실제 키워드 수</th><th></th></tr></thead><tbody>
      {rows.map(advertiser=>{const advRows=metricRows.filter(m=>m.advertiserId===advertiser.id);const conn=(meta?.connections||[]).filter(c=>c.advertiserId===advertiser.id&&['naver','google','kakao','daangn'].includes(c.channel));return <tr key={advertiser.id}><td className="brand-name-cell"><Link className="brand-name-link" to={`/keywords/${advertiser.id}/analysis`}>{advertiser.name}</Link></td><td><div className="keyword-platform-badges">{KEYWORD_PLATFORMS.map(platform=>{const channel=PLATFORM_TO_CHANNEL[platform];const c=conn.find(x=>x.channel===channel);return <Badge key={platform} tone={c?.status==='connected'?'success':c?.status==='error'?'danger':'neutral'}>{platform} · {connectionLabel(c?.status)}</Badge>})}</div></td><td className="num">{advRows.length.toLocaleString()}개</td><td style={{textAlign:'right'}}><Link className="btn btn-primary" to={`/keywords/${advertiser.id}/analysis`}>분석 보기</Link></td></tr>})}
      {!loading&&rows.length===0&&<tr><td colSpan={4} style={{textAlign:'center',padding:28,color:'var(--text-muted)'}}>광고주가 없습니다.</td></tr>}
    </tbody></table></div></div>
  </div>;
}

export function KeywordAnalysisPage(){
  const {brandId}=useParams();
  const [searchParams]=useSearchParams();
  const [query,setQuery]=useState('');
  const [grade,setGrade]=useState<'all'|KeywordAnalysisGrade>('all');
  const requested=searchParams.get('platform');
  const [platform,setPlatform]=useState<KeywordPlatformFilter>(requested&&(KEYWORD_PLATFORMS as string[]).includes(requested)?requested as KeywordPlatform:'전체');
  const [advertisers]=useAdvertisers();
  const found=advertisers.find(a=>a.id===brandId);
  const {rows:metricRows,meta,loading,error}=useMetricRows<KeywordMetricRow>('/metrics/keywords',{advertiserId:brandId});

  if(!found)return <div><Link className="breadcrumb-back" to="/keywords">← 광고주 목록으로</Link><PageHeader title="광고주를 찾을 수 없습니다" description="키워드 분석 대상 광고주가 존재하지 않습니다."/></div>;

  const allRows=metricRows.filter(m=>platform==='전체'||CHANNEL_TO_PLATFORM[m.channel]===platform).map((m,i)=>({
    id:`${m.channel}-${m.keywordId||m.keyword}-${i}`,platform:CHANNEL_TO_PLATFORM[m.channel]??m.channel,keyword:m.keyword,campaign:m.campaignName||'-',adGroup:m.adgroupId||'-',
    impressions:m.impressions,clicks:m.clicks,spend:m.spend,conversions:m.dbCount,revenue:m.revenue||0,status:'active' as const,
    grade:gradeOf({impressions:m.impressions,clicks:m.clicks,spend:m.spend,conversions:m.dbCount})
  }));
  const filteredRows=allRows.filter(r=>(!query||r.keyword.toLowerCase().includes(query.toLowerCase()))&&(grade==='all'||r.grade===grade));
  const high=allRows.filter(r=>r.grade==='high_performance'),waste=allRows.filter(r=>r.grade==='waste'),exclude=allRows.filter(r=>r.grade==='exclude_candidate'),expansion=allRows.filter(r=>r.grade==='expansion_candidate');
  const connections=(meta?.connections||[]).filter(c=>c.advertiserId===brandId&&['naver','google','kakao','daangn'].includes(c.channel));

  return <div>
    <Link className="breadcrumb-back" to="/keywords">← 광고주 목록으로</Link>
    <PageHeader title={`${found.name} 키워드 분석`} description="선택한 기간의 실제 keyword_daily_metrics로 노출·클릭·광고비·전환 효율을 분석합니다."/>
    <MetricsDateBar/>
    <div className="keyword-platform-badges" style={{marginBottom:14}}>{KEYWORD_PLATFORMS.map(item=>{const c=connections.find(x=>x.channel===PLATFORM_TO_CHANNEL[item]);return <Badge key={item} tone={c?.status==='connected'?'success':c?.status==='error'?'danger':'neutral'}>{item} · {connectionLabel(c?.status)}</Badge>})}</div>
    {error&&<div className="card" style={{color:'#b91c1c',borderColor:'#fecaca'}}>{error}</div>}
    <div className="summary-grid">
      <div className="summary-card"><div className="summary-card-label">전체 키워드</div><div className="summary-card-value">{allRows.length}개</div></div>
      <div className="summary-card"><div className="summary-card-label">고성과</div><div className="summary-card-value">{high.length}개</div></div>
      <div className="summary-card"><div className="summary-card-label">비용 낭비</div><div className="summary-card-value">{waste.length}개</div></div>
      <div className="summary-card"><div className="summary-card-label">제외 후보</div><div className="summary-card-value">{exclude.length}개</div></div>
      <div className="summary-card"><div className="summary-card-label">확장 후보</div><div className="summary-card-value">{expansion.length}개</div></div>
    </div>
    <div className="keyword-toolbar"><select className="form-select keyword-platform-select" value={platform} onChange={e=>setPlatform(e.target.value as KeywordPlatformFilter)}><option value="전체">전체</option>{KEYWORD_PLATFORMS.map(item=><option key={item}>{item}</option>)}</select><div className="search-input-wrap" style={{marginBottom:0}}><Search size={15}/><input className="search-input" placeholder="키워드 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div><select className="form-select" value={grade} onChange={e=>setGrade(e.target.value as typeof grade)}><option value="all">전체 분석 등급</option><option value="high_performance">고성과</option><option value="stable">안정</option><option value="waste">비용 낭비</option><option value="exclude_candidate">제외 후보</option><option value="expansion_candidate">확장 후보</option></select></div>
    <div className="card" style={{padding:0}}><div className="table-scroll"><table className="data-table keyword-analysis-table"><thead><tr><th>매체</th><th>키워드</th><th>캠페인</th><th>광고그룹</th><th className="num">노출</th><th className="num">클릭</th><th className="num">CTR</th><th className="num">CPC</th><th className="num">CPM</th><th className="num">광고비</th><th className="num">전환</th><th className="num">전환율</th><th className="num">CPA</th><th className="num">전환매출</th><th className="num">ROAS</th><th>분석</th></tr></thead><tbody>
      {filteredRows.map(row=>{const cpm=row.impressions?row.spend/row.impressions*1000:0;const roas=row.spend?row.revenue/row.spend*100:0;return <tr key={row.id}><td><Badge tone="accent" style={{background:`${getPlatformColor(row.platform)}1a`,color:getPlatformColor(row.platform),border:`1px solid ${getPlatformColor(row.platform)}55`}}>{row.platform}</Badge></td><td><strong>{row.keyword}</strong></td><td>{row.campaign}</td><td>{row.adGroup}</td><td className="num">{row.impressions.toLocaleString()}</td><td className="num">{row.clicks.toLocaleString()}</td><td className="num">{pct(row.clicks,row.impressions)}</td><td className="num">{row.clicks?currency(row.spend/row.clicks):'-'}</td><td className="num">{row.impressions?currency(cpm):'-'}</td><td className="num">{currency(row.spend)}</td><td className="num">{row.conversions.toLocaleString()}</td><td className="num">{pct(row.conversions,row.clicks)}</td><td className="num">{row.conversions?currency(row.spend/row.conversions):'-'}</td><td className="num">{row.revenue?currency(row.revenue):'-'}</td><td className="num">{row.revenue?`${roas.toFixed(1)}%`:'-'}</td><td><Badge tone={gradeTone[row.grade]}>{gradeLabel[row.grade]}</Badge></td></tr>})}
      {!loading&&filteredRows.length===0&&<tr><td colSpan={16} style={{textAlign:'center',padding:30,color:'var(--text-muted)'}}>선택한 기간에 수집된 실제 키워드 데이터가 없습니다. 미연동 매체는 0으로 생성하지 않습니다.</td></tr>}
    </tbody></table></div></div>
    <div className="keyword-analysis-cards"><div className="card"><div className="card-title">고성과 키워드</div>{high.map(r=><p key={r.id} className="analysis-item"><Badge tone="success">{r.keyword}</Badge> 전환율 {pct(r.conversions,r.clicks)}</p>)}</div><div className="card"><div className="card-title">비용 낭비 키워드</div>{waste.map(r=><p key={r.id} className="analysis-item"><Badge tone="danger">{r.keyword}</Badge> 클릭 대비 전환 0건</p>)}</div><div className="card"><div className="card-title">제외 키워드 후보</div>{exclude.map(r=><p key={r.id} className="analysis-item"><Badge tone="warning">{r.keyword}</Badge> 노출 대비 클릭 0건</p>)}</div><div className="card"><div className="card-title">확장 키워드 후보</div>{expansion.map(r=><p key={r.id} className="analysis-item"><Badge tone="accent">{r.keyword}</Badge> CTR {pct(r.clicks,r.impressions)}</p>)}</div></div>
  </div>;
}
