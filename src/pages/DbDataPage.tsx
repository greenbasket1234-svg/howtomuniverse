import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Download, Link2, RefreshCw, Search, Settings2, Target, TrendingUp, UsersRound, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { loadPerformanceDataset } from '../analytics/integratedPerformance';
import { useDbDataRevision } from '../hooks/useDbDataRevision';
import { loadDbConnections, loadDbRows, summarizeDbRows, type DbDataRow } from '../utils/dbDataStore';
import { syncAllDbConnections } from '../utils/googleSheetDbSync';

const MEDIA_ORDER=['메타','네이버','구글 검색','유튜브','당근','카카오','틱톡'] as const;
const MEDIA_COLOR:Record<string,string>={'메타':'#4776ff','네이버':'#03c75a','구글 검색':'#6b7280','유튜브':'#ef4444','당근':'#ff6f0f','카카오':'#f5c400','틱톡':'#111827'};

type RangeMode='최근 7일'|'최근 30일'|'이번 달'|'전체';
function iso(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function addDays(date:string,n:number){const d=new Date(`${date}T00:00:00`);d.setDate(d.getDate()+n);return iso(d)}
function money(value:number){return value?`₩${Math.round(value).toLocaleString()}`:'-'}
function pct(a:number,b:number){return b?`${(a/b*100).toFixed(1)}%`:'-'}
function points(values:number[]){const max=Math.max(...values,1);const denom=Math.max(1,values.length-1);return values.map((v,i)=>`${6+(i/denom)*88},${70-(v/max)*54}`).join(' ')}

function downloadCsv(rows:DbDataRow[]){
  const headers=['날짜','광고주','매체','캠페인ID','캠페인명','creativeId','소재명','DB','유효DB','계약','광고비','매출','플랫폼전환','연동원본'];
  const lines=[headers,...rows.map(r=>[r.date,r.advertiser,r.media,r.campaignId??'',r.campaignName??'',r.creativeId??'',r.creativeName??'',r.db,r.validDb,r.contracts,r.spend??'',r.revenue??'',r.platformConversions??'',r.sourceName])]
    .map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
  const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`HOWTOM_DB_Data_${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function DbDataPage(){
  const revision=useDbDataRevision();
  const rows=useMemo(()=>loadDbRows(),[revision]);
  const connections=useMemo(()=>loadDbConnections(),[revision]);
  const performance=useMemo(()=>loadPerformanceDataset(),[revision]);
  const [range,setRange]=useState<RangeMode>('최근 30일');
  const [advertiser,setAdvertiser]=useState(''); const [media,setMedia]=useState(''); const [campaign,setCampaign]=useState(''); const [query,setQuery]=useState('');
  const [syncing,setSyncing]=useState(false); const [syncMessage,setSyncMessage]=useState('');
  const latestDates=rows.map(r=>r.date).sort();
  const latest=latestDates[latestDates.length-1]??'';
  const rangeStart=range==='전체'||!latest?'':range==='최근 7일'?addDays(latest,-6):range==='최근 30일'?addDays(latest,-29):`${latest.slice(0,7)}-01`;
  const advertisers=useMemo(()=>[...new Set(rows.map(r=>r.advertiser))].sort((a,b)=>a.localeCompare(b,'ko')),[rows]);
  const medias=useMemo(()=>MEDIA_ORDER.filter(name=>rows.some(r=>(!advertiser||r.advertiser===advertiser)&&r.media===name)),[rows,advertiser]);
  const campaigns=useMemo(()=>[...new Set(rows.filter(r=>(!advertiser||r.advertiser===advertiser)&&(!media||r.media===media)).map(r=>r.campaignName||r.campaignId||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko')),[rows,advertiser,media]);
  const filtered=useMemo(()=>rows.filter(r=>(!rangeStart||r.date>=rangeStart)&&(!latest||r.date<=latest)&&(!advertiser||r.advertiser===advertiser)&&(!media||r.media===media)&&(!campaign||(r.campaignName||r.campaignId)===campaign)&&(`${r.advertiser} ${r.media} ${r.campaignName??''} ${r.creativeName??''} ${r.sourceName}`.toLowerCase().includes(query.toLowerCase()))),[rows,rangeStart,latest,advertiser,media,campaign,query]);

  const performanceSpendMap=useMemo(()=>{
    const map=new Map<string,number>();
    performance.media.forEach(r=>{const key=`${r.date}|${r.advertiser}|${r.media}`;map.set(key,(map.get(key)??0)+r.spend)});return map;
  },[performance]);
  const enriched=useMemo(()=>filtered.map(r=>({...r,resolvedSpend:r.spend??performanceSpendMap.get(`${r.date}|${r.advertiser}|${r.media}`)??0})),[filtered,performanceSpendMap]);
  const summary=useMemo(()=>enriched.reduce((a,r)=>({db:a.db+r.db,validDb:a.validDb+r.validDb,contracts:a.contracts+r.contracts,spend:a.spend+r.resolvedSpend,revenue:a.revenue+(r.revenue??0),platformConversions:a.platformConversions+(r.platformConversions??0)}),{db:0,validDb:0,contracts:0,spend:0,revenue:0,platformConversions:0}),[enriched]);
  const mediaRows=useMemo(()=>MEDIA_ORDER.map(name=>{const part=enriched.filter(r=>r.media===name);const s=part.reduce((a,r)=>({db:a.db+r.db,validDb:a.validDb+r.validDb,contracts:a.contracts+r.contracts,spend:a.spend+r.resolvedSpend}),{db:0,validDb:0,contracts:0,spend:0});return {name,...s};}).filter(r=>r.db||r.validDb||r.contracts),[enriched]);
  const daily=useMemo(()=>[...new Set(enriched.map(r=>r.date))].sort().map(date=>{const s=summarizeDbRows(enriched.filter(r=>r.date===date));return {date,...s}}),[enriched]);
  const maxMedia=Math.max(...mediaRows.map(r=>r.db),1);
  const hasPlatformCompare=enriched.some(r=>Number(r.platformConversions)>0);
  const platformMatch=summary.platformConversions?summary.db/summary.platformConversions*100:0;
  const syncDates=connections.map(c=>c.lastSyncAt??'').filter(Boolean).sort();
  const lastSync=syncDates[syncDates.length-1];

  const syncNow=async()=>{setSyncing(true);setSyncMessage('');const results=await syncAllDbConnections();const ok=results.filter(r=>r.ok).length;setSyncMessage(results.length?`${ok}/${results.length}개 연결 동기화 완료`:'활성화된 Google Sheets 연결이 없습니다.');setSyncing(false)};

  return <div className="dbx-page">
    <PageHeader title="DB 데이터" description="Google Sheets에서 실제 DB·유효 DB·계약 집계 데이터를 가져와 매체·광고주·캠페인·소재 성과에 연결합니다." action={<div className="action-row"><button className="btn secondary" onClick={()=>downloadCsv(filtered)} disabled={!filtered.length}><Download size={15}/> CSV 저장</button><button className="btn primary" onClick={syncNow} disabled={syncing}><RefreshCw size={15} className={syncing?'spin':''}/>{syncing?'동기화 중':'지금 동기화'}</button></div>}/>

    <section className="dbx-syncbar">
      <div><Link2 size={17}/><span>Google Sheets 연결 <b>{connections.filter(c=>c.enabled).length}개</b></span><i className={connections.some(c=>c.lastSyncOk)?'ok':'idle'}>{lastSync?`마지막 동기화 ${new Date(lastSync).toLocaleString('ko-KR')}`:'아직 동기화하지 않음'}</i></div>
      <Link to="/settings/db-integrations"><Settings2 size={15}/> 연동 설정</Link>
    </section>
    {syncMessage&&<div className="dbx-notice"><CheckCircle2 size={16}/>{syncMessage}</div>}
    {!rows.length&&<section className="dbx-empty"><Database size={34}/><h2>연동된 DB 데이터가 없습니다.</h2><p>설정에서 Google Apps Script 웹앱 URL을 등록한 뒤 동기화하세요. 개인정보 원문이 아니라 날짜·광고주·매체·DB 수 같은 집계값만 가져옵니다.</p><Link className="btn primary" to="/settings/db-integrations">Google Sheets DB 연동 설정</Link></section>}

    <section className="dbx-filterbar">
      <div className="dbx-range">{(['최근 7일','최근 30일','이번 달','전체'] as RangeMode[]).map(v=><button key={v} className={range===v?'active':''} onClick={()=>setRange(v)}>{v}</button>)}</div>
      <select value={advertiser} onChange={e=>{setAdvertiser(e.target.value);setMedia('');setCampaign('')}}><option value="">전체 광고주</option>{advertisers.map(v=><option key={v}>{v}</option>)}</select>
      <select value={media} onChange={e=>{setMedia(e.target.value);setCampaign('')}}><option value="">전체 매체</option>{medias.map(v=><option key={v}>{v}</option>)}</select>
      <select value={campaign} onChange={e=>setCampaign(e.target.value)}><option value="">전체 캠페인</option>{campaigns.map(v=><option key={v}>{v}</option>)}</select>
    </section>

    <section className="dbx-kpis">
      <Kpi icon={<Database/>} label="전체 DB" value={summary.db.toLocaleString()} sub={`${filtered.length.toLocaleString()}개 집계 행`}/>
      <Kpi icon={<CheckCircle2/>} label="유효 DB" value={summary.validDb.toLocaleString()} sub={`유효율 ${pct(summary.validDb,summary.db)}`}/>
      <Kpi icon={<Target/>} label="계약" value={summary.contracts.toLocaleString()} sub={`DB→계약 ${pct(summary.contracts,summary.db)}`}/>
      <Kpi icon={<WalletCards/>} label="DB당 비용" value={summary.db?money(summary.spend/summary.db):'-'} sub={`광고비 ${money(summary.spend)}`}/>
      <Kpi icon={<UsersRound/>} label="유효 DB당 비용" value={summary.validDb?money(summary.spend/summary.validDb):'-'} sub={summary.validDb?`${summary.validDb.toLocaleString()}건 기준`:'유효 DB 없음'}/>
      <Kpi icon={<TrendingUp/>} label="계약당 비용" value={summary.contracts?money(summary.spend/summary.contracts):'-'} sub={summary.contracts?`${summary.contracts.toLocaleString()}건 기준`:'계약 없음'}/>
    </section>

    <section className="dbx-two-col">
      <article className="card dbx-panel"><div className="dbx-panel-head"><div><h2>DB 추이</h2><p>{rangeStart&&latest?`${rangeStart} ~ ${latest}`:'전체 기간'} · 실제 Google Sheets DB 기준</p></div></div>{daily.length?<><svg className="dbx-line" viewBox="0 0 100 78" preserveAspectRatio="none"><line x1="6" y1="70" x2="94" y2="70"/><polyline points={points(daily.map(d=>d.db))}/></svg><div className="dbx-axis"><span>{daily[0]?.date.slice(5)}</span><span>{daily[daily.length-1]?.date.slice(5)}</span></div></>:<p className="dbx-muted">표시할 DB 추이 데이터가 없습니다.</p>}</article>
      <article className="card dbx-panel"><div className="dbx-panel-head"><div><h2>매체별 DB</h2><p>DB 규모와 유효율·계약률을 함께 비교합니다.</p></div></div><div className="dbx-media-bars">{mediaRows.map(r=><div key={r.name}><div><b>{r.name}</b><span>DB {r.db.toLocaleString()} · 유효 {pct(r.validDb,r.db)} · 계약 {pct(r.contracts,r.db)}</span></div><i><u style={{width:`${Math.max(4,r.db/maxMedia*100)}%`,background:MEDIA_COLOR[r.name]}}/></i></div>)}{!mediaRows.length&&<p className="dbx-muted">매체별 데이터가 없습니다.</p>}</div></article>
    </section>

    {hasPlatformCompare&&<section className="card dbx-compare"><div><h2>광고 플랫폼 전환 vs 실제 DB</h2><p>광고 매체가 기록한 전환 수와 Google Sheets의 실제 DB를 분리해서 봅니다.</p></div><div className="dbx-compare-values"><span>플랫폼 전환 <b>{summary.platformConversions.toLocaleString()}</b></span><span>실제 DB <b>{summary.db.toLocaleString()}</b></span><span>차이 <b>{(summary.platformConversions-summary.db).toLocaleString()}</b></span><span>일치율 <b>{platformMatch.toFixed(1)}%</b></span></div></section>}

    <section className="card dbx-panel dbx-table-panel">
      <div className="dbx-panel-head"><div><h2>DB 상세 데이터</h2><p>개인 이름·전화번호·이메일은 저장하지 않고 집계 데이터만 표시합니다.</p></div><label className="dbx-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="광고주·매체·캠페인·소재·연동원본 검색"/></label></div>
      <div className="table-scroll"><table className="ops-table"><thead><tr><th>날짜</th><th>광고주</th><th>매체</th><th>캠페인</th><th>소재</th><th>DB</th><th>유효 DB</th><th>계약</th><th>광고비</th><th>DB 단가</th><th>유효율</th><th>계약률</th><th>연동 원본</th></tr></thead><tbody>{enriched.map(row=><tr key={row.id}><td>{row.date}</td><td><b>{row.advertiser}</b></td><td><span className="dbx-media-dot"><i style={{background:MEDIA_COLOR[row.media]??'#94a3b8'}}/>{row.media}</span></td><td>{row.campaignName||row.campaignId||'-'}</td><td>{row.creativeName||row.creativeId||'-'}</td><td><b>{row.db.toLocaleString()}</b></td><td>{row.validDb.toLocaleString()}</td><td>{row.contracts.toLocaleString()}</td><td>{money(row.resolvedSpend)}</td><td>{row.db?money(row.resolvedSpend/row.db):'-'}</td><td>{pct(row.validDb,row.db)}</td><td>{pct(row.contracts,row.db)}</td><td><small>{row.sourceName}</small></td></tr>)}{!enriched.length&&<tr><td colSpan={13}><div className="dbx-table-empty"><AlertTriangle size={17}/>현재 필터에 해당하는 DB 데이터가 없습니다.</div></td></tr>}</tbody></table></div>
    </section>
  </div>
}

function Kpi({icon,label,value,sub}:{icon:React.ReactNode;label:string;value:string;sub:string}){return <article className="dbx-kpi"><span>{icon}{label}</span><strong>{value}</strong><small>{sub}</small></article>}
