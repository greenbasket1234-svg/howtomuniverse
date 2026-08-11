import { useMemo, useState } from 'react';
import { ExternalLink, Pause, Play, RefreshCw, Search, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

type Creative={id:string;name:string;campaign:string;thumb:string;spend:number;impressions:number;clicks:number;frequency:number;status:'라이브'|'보관됨';days:number;health:number;trend:number[]};
const creatives:Creative[]=[
{id:'m1',name:'20260618_인스타1 퇴근캠핑',campaign:'월컴투바베큐 · 20260609_트래픽',thumb:'linear-gradient(135deg,#275a91,#e5a94c)',spend:120587,impressions:20617,clicks:623,frequency:1.03,status:'라이브',days:14,health:5,trend:[45,62,55,72,61,83]},
{id:'m2',name:'20260610_인스타4 삼겹살',campaign:'월컴투바베큐 · 20260609_트래픽',thumb:'linear-gradient(135deg,#7d3a20,#d8a449)',spend:83041,impressions:20059,clicks:730,frequency:1.07,status:'라이브',days:26,health:20,trend:[37,55,42,66,80,73]},
{id:'m3',name:'20260616_인스타1 야장',campaign:'월컴투바베큐 · 20260609_트래픽',thumb:'linear-gradient(135deg,#d2782c,#f0bf55)',spend:60073,impressions:9367,clicks:314,frequency:1.04,status:'라이브',days:20,health:0,trend:[42,68,51,34,59,47]},
{id:'m4',name:'20260610_인스타3 수영장',campaign:'월컴투바베큐 · 20260609_트래픽',thumb:'linear-gradient(135deg,#28587f,#98c8d9)',spend:39051,impressions:5972,clicks:359,frequency:1.03,status:'라이브',days:26,health:0,trend:[80,56,46,27,21,18]},
{id:'m5',name:'20260630_인스타4 수완지구 캠핑',campaign:'월컴투바베큐 · 20260630_트래픽',thumb:'linear-gradient(135deg,#f0e1bd,#c5d5a7)',spend:27231,impressions:8042,clicks:278,frequency:1.02,status:'보관됨',days:0,health:0,trend:[44,65,51,75,32,12]},
{id:'m6',name:'20260630_인스타2 용기증기',campaign:'월컴투바베큐 · 20260630_트래픽',thumb:'linear-gradient(135deg,#2b271f,#c97c42)',spend:18247,impressions:2455,clicks:126,frequency:1.02,status:'보관됨',days:0,health:0,trend:[20,55,22,65,42,88]},
{id:'m7',name:'20260701_인스타6 반려동물',campaign:'월컴투바베큐 · 20260630_트래픽',thumb:'linear-gradient(135deg,#bd8f64,#eee0c1)',spend:16919,impressions:3389,clicks:135,frequency:1.04,status:'라이브',days:5,health:0,trend:[12,25,61,23,47,39]},
{id:'m8',name:'20260701_인스타8 강아지 포미',campaign:'월컴투바베큐 · 20260630_트래픽',thumb:'linear-gradient(135deg,#886c4f,#d8c5a7)',spend:16130,impressions:2446,clicks:123,frequency:1.05,status:'라이브',days:5,health:0,trend:[20,38,50,68,49,73]},
{id:'m9',name:'수영장',campaign:'월컴투바베큐 · 수영장',thumb:'linear-gradient(135deg,#3e7aa1,#a9d9e8)',spend:8388,impressions:1861,clicks:82,frequency:1.02,status:'라이브',days:3,health:0,trend:[25,44,53,62,77,71]},
{id:'m10',name:'드론',campaign:'월컴투바베큐 · 드론',thumb:'linear-gradient(135deg,#4f7748,#b8c98b)',spend:8387,impressions:1839,clicks:55,frequency:1.13,status:'라이브',days:3,health:0,trend:[12,35,65,74,50,88]},
];
const periods=['오늘','어제','7일','14일','30일','60일','90일']; const won=(n:number)=>`₩${Math.round(n).toLocaleString()}`;

export function MetaCreativeReportPage(){
 const [period,setPeriod]=useState('7일'); const [account,setAccount]=useState('전체 계정'); const [query,setQuery]=useState(''); const [rows,setRows]=useState(creatives); const [detail,setDetail]=useState<Creative|null>(null);
 type SortKey='spend'|'impressions'|'clicks'|'ctr'|'cpc';
 const [sortKey,setSortKey]=useState<SortKey>('spend');
 const [sortDir,setSortDir]=useState<'desc'|'asc'>('desc');
 const { filterValue } = useAdvertiserFilter();
 // 계정 select 옵션은 고정값이 아니라, 실제 소재 데이터의 캠페인명 앞부분(광고주명)에서 그때그때 추출합니다.
 const accountOptions=useMemo(()=>['전체 계정', ...Array.from(new Set(rows.map(r=>r.campaign.split(' · ')[0])))],[rows]);
 // campaign 필드가 '광고주명 · 캠페인명' 형태이므로 그 안에 필터어가 포함되는지로 판단합니다.
 const filtered=useMemo(()=>{
   const list=rows.filter(r=>r.name.toLowerCase().includes(query.toLowerCase())&&matchesAdvertiserFilter(r.campaign,filterValue)&&(account==='전체 계정'||r.campaign.startsWith(account)));
   return [...list].sort((a,b)=>{
     const valueOf=(r:typeof a)=>{
       if(sortKey==='ctr') return r.impressions?r.clicks/r.impressions:0;
       if(sortKey==='cpc') return r.clicks?r.spend/r.clicks:0;
       return r[sortKey];
     };
     const diff=valueOf(a)-valueOf(b);
     return sortDir==='desc'?-diff:diff;
   });
 },[rows,query,filterValue,account,sortKey,sortDir]);
 const toggleSort=(key:SortKey)=>{if(sortKey===key)setSortDir(sortDir==='desc'?'asc':'desc');else{setSortKey(key);setSortDir('desc')}};
 const sortArrow=(key:SortKey)=>sortKey===key?(sortDir==='desc'?' ▼':' ▲'):'';
 const toggle=(id:string)=>setRows(rows.map(r=>r.id===id?{...r,status:r.status==='라이브'?'보관됨':'라이브'}:r));
 return <>
 <PageHeader title="Meta 소재 보고서" description="광고 소재별 상세 지표와 라이브 상태, 건전성, 기간별 추이를 한 화면에서 관리합니다." action={<a className="btn secondary" href="https://adsmanager.facebook.com/adsmanager/manage/campaigns" target="_blank" rel="noreferrer">Meta 광고 관리자 <ExternalLink size={14}/></a>}/>
 {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경) · 캠페인명 기준 매칭</div>}
 <section className="card media-report-card"><div className="media-report-toolbar"><div><b>광고 소재 {filtered.length}개</b></div><div className="media-report-actions">{periods.map(p=><button key={p} className={`tiny-filter ${period===p?'active':''}`} onClick={()=>setPeriod(p)}>{p}</button>)}<select value={account} onChange={e=>setAccount(e.target.value)}>{accountOptions.map(a=><option key={a}>{a}</option>)}</select><div className="campaign-search-box"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="소재 검색"/></div></div></div>
 <div className="table-scroll"><table className="media-report-table creative-report-table"><thead><tr><th>소재</th><th>상태 / 라이브</th><th>건전성</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('spend')}>소진{sortArrow('spend')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('impressions')}>노출{sortArrow('impressions')}</th><th>CPM</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('clicks')}>클릭{sortArrow('clicks')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('ctr')}>CTR{sortArrow('ctr')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('cpc')}>CPC{sortArrow('cpc')}</th><th>전환</th><th>전환율</th><th>전환매출</th><th>CPA</th><th>ROAS</th><th>예약</th><th>추이</th></tr></thead><tbody>{filtered.length===0?<tr><td colSpan={16} style={{textAlign:'center',padding:'24px',color:'#9ca3af'}}>해당 광고주의 소재가 없습니다.</td></tr>:filtered.map(r=>{const cpm=r.impressions?r.spend/r.impressions*1000:0,ctr=r.impressions?r.clicks/r.impressions*100:0,cpc=r.clicks?r.spend/r.clicks:0;return <tr key={r.id}><td><button className="creative-name-cell" onClick={()=>setDetail(r)}><span className="creative-thumb" style={{background:r.thumb}}/><span><b>› {r.name} ↗</b><small>{r.campaign}</small></span></button></td><td><div className="status-action-cell"><span className={`live-pill ${r.status==='보관됨'?'archived':''}`}>● {r.status}{r.status==='라이브'?` D+${r.days}`:''}</span><button className="mini-danger" onClick={()=>toggle(r.id)}>{r.status==='라이브'?'끄기':'켜기'}</button><button className="mini-primary"><RefreshCw size={12}/> 재등록</button></div><small>2026-06-22 시작</small></td><td><span className="health-pill">● 건강 {r.health}</span><small className="health-trend">CPM ▼2% · CTR ▲9% · CPC ▼10%</small></td><td>{won(r.spend)}</td><td>{r.impressions.toLocaleString()}</td><td>{won(cpm)}</td><td>{r.clicks}</td><td>{ctr.toFixed(2)}%</td><td>{won(cpc)}</td><td>0</td><td>0.00%</td><td>-</td><td>-</td><td>-</td><td>0</td><td><div className="mini-bars blue">{r.trend.map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div></td></tr>})}</tbody></table></div></section>
 {detail&&<div className="modal-backdrop" onClick={()=>setDetail(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>{detail.name}</h3><p>{detail.campaign}</p></div><button className="icon-btn" onClick={()=>setDetail(null)}><X size={18}/></button></div><div className="creative-detail-preview" style={{background:detail.thumb}}/><div className="detail-kpi-grid"><div><span>광고비</span><b>{won(detail.spend)}</b></div><div><span>노출</span><b>{detail.impressions.toLocaleString()}</b></div><div><span>클릭</span><b>{detail.clicks}</b></div></div><div className="modal-actions"><button className="btn secondary" onClick={()=>toggle(detail.id)}>{detail.status==='라이브'?<Pause size={14}/>:<Play size={14}/>} {detail.status==='라이브'?'끄기':'켜기'}</button><button className="btn primary" onClick={()=>setDetail(null)}>확인</button></div></div></div>}
 </>
}
