import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, ExternalLink, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { MetricsDateBar } from '../components/MetricsDateBar';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { useMetricRows } from '../hooks/useMetrics';
import type { KeywordMetricRow } from '../types/metrics';

type ChannelKey='naver'|'google'|'daangn'|'kakao';
const CHANNEL_LABEL:Record<ChannelKey,string>={naver:'네이버',google:'구글',daangn:'당근',kakao:'카카오'};
const CHANNEL_URL:Record<ChannelKey,string>={naver:'https://searchad.naver.com',google:'https://ads.google.com',daangn:'https://ads.daangn.com',kakao:'https://keywordad.kakao.com'};
function won(v:number){return `₩${Math.round(v).toLocaleString()}`}
function pct(n:number,d:number){return d?`${(n/d*100).toFixed(2)}%`:'-'}
function connectionText(status?:string){if(status==='connected')return '연동';if(status==='connector_unimplemented')return '커넥터 미구현';if(status==='error')return '동기화 오류';return '미연동'}
function grade(row:KeywordMetricRow){const conv=row.dbCount+(row.purchases||0)+(row.unconfirmed||0);if(row.spend>0&&row.clicks>=10&&conv===0)return{label:'비용 낭비',tone:'danger' as const};if(row.impressions>=100&&row.clicks===0)return{label:'제외 후보',tone:'warning' as const};if((row.cvr||0)>=5&&conv>=2)return{label:'고성과',tone:'success' as const};return{label:'안정',tone:'neutral' as const}}

export function SearchAdBrandListPage({channel}:{channel:ChannelKey}){
  const [query,setQuery]=useState('');const {filterValue}=useAdvertiserFilter();const [advertisers]=useAdvertisers();
  const metrics=useMetricRows<KeywordMetricRow>('/metrics/keywords',{channel});
  const connByAdv=useMemo(()=>new Map((metrics.meta?.connections||[]).filter(c=>c.channel===channel).map(c=>[c.advertiserId,c])),[metrics.meta,channel]);
  const rows=useMemo(()=>advertisers.filter(a=>a.name.toLowerCase().includes(query.toLowerCase())&&matchesAdvertiserFilter(a.name,filterValue)).map(a=>{const part=metrics.rows.filter(r=>r.advertiserId===a.id);return{advertiser:a,keywordCount:part.length,spend:part.reduce((s,r)=>s+r.spend,0),clicks:part.reduce((s,r)=>s+r.clicks,0),conversions:part.reduce((s,r)=>s+r.dbCount+(r.purchases||0)+(r.unconfirmed||0),0),connection:connByAdv.get(a.id)}}),[advertisers,query,filterValue,metrics.rows,connByAdv]);
  return <div><PageHeader title={`${CHANNEL_LABEL[channel]} 검색광고 관리`} description="선택 기간에 매체 API에서 수집한 실제 키워드 성과만 표시합니다." action={<a className="btn secondary" href={CHANNEL_URL[channel]} target="_blank" rel="noreferrer">광고센터 <ExternalLink size={14}/></a>}/><MetricsDateBar/>
    <div className="channel-switch-tabs">{(['naver','google','daangn','kakao'] as ChannelKey[]).map(c=><Link key={c} to={`/search-ads/${c}`} className={c===channel?'active':''}>{CHANNEL_LABEL[c]}</Link>)}</div>
    <div className="search-input-wrap"><Search size={15}/><input className="search-input" placeholder="광고주 이름으로 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <div className="card" style={{padding:0}}><div className="table-scroll"><table className="brand-table"><thead><tr><th>광고주명</th><th>연동 상태</th><th className="num">키워드 수</th><th className="num">광고비</th><th className="num">클릭</th><th className="num">전환</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.advertiser.id}><td><b>{r.advertiser.name}</b></td><td><Badge tone={r.connection?.status==='connected'?'success':r.connection?.status==='error'?'danger':'neutral'}>{connectionText(r.connection?.status)}</Badge></td><td className="num">{r.keywordCount}</td><td className="num">{won(r.spend)}</td><td className="num">{r.clicks.toLocaleString()}</td><td className="num">{r.conversions.toLocaleString()}</td><td style={{textAlign:'right'}}><Link className="btn btn-primary" to={`/search-ads/${channel}/${r.advertiser.id}`}>보기</Link></td></tr>)}{!metrics.loading&&!rows.length&&<tr><td colSpan={7} style={{textAlign:'center',padding:30,color:'var(--text-muted)'}}>광고주가 없습니다.</td></tr>}</tbody></table></div></div>
    <p className="footnote">미연동·커넥터 미구현 매체는 0 성과를 생성하지 않습니다. 현재 실제 키워드 수집 커넥터는 구현된 매체에서만 데이터가 표시됩니다.</p>
  </div>;
}

export function SearchAdKeywordDetailPage({channel}:{channel:ChannelKey}){
  const {brandId}=useParams();const [query,setQuery]=useState('');const [advertisers]=useAdvertisers();const found=advertisers.find(a=>a.id===brandId);
  const metrics=useMetricRows<KeywordMetricRow>('/metrics/keywords',{advertiserId:brandId,channel});
  const rows=useMemo(()=>metrics.rows.filter(r=>!query||r.keyword.toLowerCase().includes(query.toLowerCase())),[metrics.rows,query]);
  const connection=(metrics.meta?.connections||[]).find(c=>c.advertiserId===brandId&&c.channel===channel);
  if(!found)return <div><Link className="breadcrumb-back" to={`/search-ads/${channel}`}>← 광고주 목록으로</Link><PageHeader title="광고주를 찾을 수 없습니다"/></div>;
  return <div><Link className="breadcrumb-back" to={`/search-ads/${channel}`}>← 광고주 목록으로</Link><PageHeader title={`${found.name} · ${CHANNEL_LABEL[channel]} 검색광고`} description="실제 keyword_daily_metrics를 조회하는 읽기 전용 성과 화면입니다." action={<a className="btn secondary" href={CHANNEL_URL[channel]} target="_blank" rel="noreferrer">광고센터 <ExternalLink size={14}/></a>}/><MetricsDateBar/>
    <div className="card" style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><Badge tone={connection?.status==='connected'?'success':connection?.status==='error'?'danger':'neutral'}>{CHANNEL_LABEL[channel]} · {connectionText(connection?.status)}</Badge><div className="search-input-wrap" style={{margin:0,marginLeft:'auto'}}><Search size={15}/><input className="search-input" placeholder="키워드 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
    <div className="card" style={{padding:0}}><div className="table-scroll"><table className="data-table"><thead><tr><th>키워드</th><th>캠페인</th><th>광고그룹</th><th className="num">노출</th><th className="num">클릭</th><th className="num">CTR</th><th className="num">CPC</th><th className="num">CPM</th><th className="num">광고비</th><th className="num">전환</th><th className="num">전환율</th><th className="num">CPA</th><th className="num">전환매출</th><th className="num">ROAS</th><th>분석</th></tr></thead><tbody>{rows.map((r,i)=>{const g=grade(r);return <tr key={`${r.keywordId||r.keyword}-${i}`}><td><b>{r.keyword}</b></td><td>{r.campaignName||'-'}</td><td>{r.adgroupId||'-'}</td><td className="num">{r.impressions.toLocaleString()}</td><td className="num">{r.clicks.toLocaleString()}</td><td className="num">{pct(r.clicks,r.impressions)}</td><td className="num">{r.clicks?won(r.spend/r.clicks):'-'}</td><td className="num">{r.impressions?won(r.spend/r.impressions*1000):'-'}</td><td className="num">{won(r.spend)}</td><td className="num">{(r.dbCount+(r.purchases||0)+(r.unconfirmed||0)).toLocaleString()}{(r.dbCount>0||(r.purchases||0)>0||(r.unconfirmed||0)>0)&&<><br/><small className="table-cell-note">{r.dbCount>0&&`DB ${r.dbCount.toLocaleString()}`}{r.dbCount>0&&(r.purchases||0)>0&&' · '}{(r.purchases||0)>0&&`구매 ${(r.purchases||0).toLocaleString()}`}{(r.dbCount>0||(r.purchases||0)>0)&&(r.unconfirmed||0)>0&&' · '}{(r.unconfirmed||0)>0&&`미확인 ${(r.unconfirmed||0).toLocaleString()}`}</small></>}</td><td className="num">{pct(r.dbCount+(r.purchases||0)+(r.unconfirmed||0),r.clicks)}</td><td className="num">{(r.dbCount+(r.purchases||0)+(r.unconfirmed||0))?won(r.spend/(r.dbCount+(r.purchases||0)+(r.unconfirmed||0))):'-'}</td><td className="num">{r.revenue?won(r.revenue):'-'}</td><td className="num">{r.revenue?`${(r.roas||0).toFixed(1)}%`:'-'}</td><td><Badge tone={g.tone}>{g.label}</Badge></td></tr>})}{!metrics.loading&&!rows.length&&<tr><td colSpan={15} style={{textAlign:'center',padding:30,color:'var(--text-muted)'}}>선택 기간에 실제 키워드 데이터가 없습니다.</td></tr>}</tbody></table></div></div>
    <p className="footnote">예산 변경·ON/OFF 쓰기 기능은 해당 매체의 쓰기 권한과 서버 API가 구현되기 전까지 제공하지 않습니다. 화면에서 가짜로 상태를 변경하지 않습니다.</p>
  </div>;
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
