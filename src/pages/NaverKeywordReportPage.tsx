import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Search, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

type KeywordChannel = '네이버' | '당근' | '구글' | '카카오';
type KeywordRow={id:string;level:number;kind:'campaign'|'group'|'keyword';name:string;meta:string;spend:number;impressions:number;clicks:number;conversions:number;revenue:number;bid?:number;quality?:'충분'|'제외 후보';children?:string[]};

const baseRows:KeywordRow[]=[
{id:'c1',level:0,kind:'campaign',name:'#스스_무한샤브',meta:'광고그룹 1 · 키워드 1',spend:75222,impressions:2083,clicks:30,conversions:15,revenue:732900,children:['g1']},
{id:'g1',level:1,kind:'group',name:'(캠페인 전체)',meta:'키워드 1',spend:75222,impressions:2083,clicks:30,conversions:15,revenue:732900,children:['k1']},
{id:'k1',level:2,kind:'keyword',name:'(키워드 외 확장 소재)',meta:'입찰 ₩0',spend:75222,impressions:2083,clicks:30,conversions:15,revenue:732900,quality:'충분'},
{id:'c2',level:0,kind:'campaign',name:'#월컴투바베큐',meta:'광고그룹 2 · 키워드 9',spend:52164,impressions:2379,clicks:90,conversions:0,revenue:0,children:['g2','g3']},
{id:'g2',level:1,kind:'group',name:'(캠페인 전체)',meta:'키워드 1',spend:28857,impressions:1763,clicks:54,conversions:0,revenue:0,children:['k2']},
{id:'k2',level:2,kind:'keyword',name:'(키워드 외 확장 소재)',meta:'입찰 ₩0',spend:28857,impressions:1763,clicks:54,conversions:0,revenue:0,quality:'제외 후보'},
{id:'g3',level:1,kind:'group',name:'#월컴투바베큐_광고그룹1',meta:'키워드 8',spend:23307,impressions:616,clicks:36,conversions:0,revenue:0,children:['k3','k4','k5','k6','k7','k8','k9','k10']},
{id:'k3',level:2,kind:'keyword',name:'광주캠핑식당',meta:'입찰 ₩1,130',spend:20083,impressions:354,clicks:27,conversions:0,revenue:0,quality:'제외 후보'},
{id:'k4',level:2,kind:'keyword',name:'광주바베큐장',meta:'입찰 ₩480',spend:2506,impressions:90,clicks:7,conversions:0,revenue:0},
{id:'k5',level:2,kind:'keyword',name:'광주캠핑식당추천',meta:'입찰 ₩410',spend:718,impressions:84,clicks:2,conversions:0,revenue:0},
{id:'k6',level:2,kind:'keyword',name:'광주야외식당',meta:'입찰 ₩200',spend:0,impressions:2,clicks:0,conversions:0,revenue:0},
{id:'k7',level:2,kind:'keyword',name:'수완지구맛집',meta:'입찰 ₩870',spend:0,impressions:75,clicks:0,conversions:0,revenue:0},
{id:'k8',level:2,kind:'keyword',name:'신가동맛집',meta:'입찰 ₩290',spend:0,impressions:1,clicks:0,conversions:0,revenue:0},
{id:'k9',level:2,kind:'keyword',name:'신창동맛집',meta:'입찰 ₩200',spend:0,impressions:8,clicks:0,conversions:0,revenue:0},
{id:'k10',level:2,kind:'keyword',name:'광주바베큐맛집',meta:'입찰 ₩350',spend:0,impressions:6,clicks:0,conversions:0,revenue:0},
{id:'c3',level:0,kind:'campaign',name:'#스스_무한바다식사',meta:'광고그룹 1 · 키워드 1',spend:45682,impressions:2375,clicks:16,conversions:1,revenue:34900,children:['g4']},
{id:'g4',level:1,kind:'group',name:'(캠페인 전체)',meta:'키워드 1',spend:45682,impressions:2375,clicks:16,conversions:1,revenue:34900,children:['k11']},
{id:'k11',level:2,kind:'keyword',name:'(키워드 외 확장 소재)',meta:'입찰 ₩0',spend:45682,impressions:2375,clicks:16,conversions:1,revenue:34900},
{id:'c4',level:0,kind:'campaign',name:'00_노멜_자사몰_자사명',meta:'광고그룹 3 · 키워드 9',spend:12153,impressions:1908,clicks:25,conversions:1,revenue:0,children:['g5','g6']},
{id:'g5',level:1,kind:'group',name:'(캠페인 전체)',meta:'키워드 1',spend:11261,impressions:1275,clicks:16,conversions:0,revenue:0,children:['k12']},
{id:'k12',level:2,kind:'keyword',name:'(키워드 외 확장 소재)',meta:'입찰 ₩0',spend:11261,impressions:1275,clicks:16,conversions:0,revenue:0},
{id:'g6',level:1,kind:'group',name:'00_노멜_자사몰_광고그룹1',meta:'키워드 6',spend:892,impressions:568,clicks:9,conversions:1,revenue:0,children:['k13','k14','k15','k16']},
{id:'k13',level:2,kind:'keyword',name:'노멜',meta:'입찰 ₩1,000',spend:572,impressions:547,clicks:8,conversions:1,revenue:0},
{id:'k14',level:2,kind:'keyword',name:'노멜바디워시',meta:'입찰 ₩1,000',spend:320,impressions:4,clicks:1,conversions:0,revenue:0},
{id:'k15',level:2,kind:'keyword',name:'노멜샴푸',meta:'입찰 ₩1,000',spend:0,impressions:12,clicks:0,conversions:0,revenue:0},
{id:'k16',level:2,kind:'keyword',name:'노멜화장품',meta:'입찰 ₩1,000',spend:0,impressions:1,clicks:0,conversions:0,revenue:0},
];

const channelConfig: Record<KeywordChannel, { color:string; light:string; link:string; multiplier:number }> = {
  네이버: { color:'#03c75a', light:'#eafbf1', link:'https://manage.searchad.naver.com/', multiplier:1 },
  당근: { color:'#ff6f0f', light:'#fff2e9', link:'https://business.daangn.com/', multiplier:.86 },
  구글: { color:'#6b7280', light:'#f1f2f4', link:'https://ads.google.com/', multiplier:1.12 },
  카카오: { color:'#f5c400', light:'#fff9dc', link:'https://moment.kakao.com/', multiplier:.94 },
};
const channels = Object.keys(channelConfig) as KeywordChannel[];
const periods=['오늘','어제','7일','14일','30일','60일','90일'];
// baseRows는 "7일" 기준 누적치입니다. 다른 기간을 선택하면 그 기간의 일수 비율만큼
// 값을 조정해서, 기간 버튼이 실제로 화면 숫자에 반영되도록 합니다.
const PERIOD_DAYS: Record<string, number> = { '오늘': 1, '어제': 1, '7일': 7, '14일': 14, '30일': 30, '60일': 60, '90일': 90 };
const won=(n:number)=>`₩${Math.round(n).toLocaleString()}`;
const pct=(n:number)=>`${n.toFixed(2)}%`;

function rowsForChannel(channel: KeywordChannel, period: string): KeywordRow[] {
  const factor = channelConfig[channel].multiplier;
  const periodFactor = (PERIOD_DAYS[period] ?? 7) / 7;
  return baseRows.map((row, index) => ({
    ...row,
    id: `${channel}-${row.id}`,
    children: row.children?.map(id => `${channel}-${id}`),
    spend: Math.round(row.spend * factor * periodFactor * (1 + (index % 3) * .025)),
    impressions: Math.round(row.impressions * factor * periodFactor * (1 + (index % 4) * .018)),
    clicks: Math.round(row.clicks * factor * periodFactor * (1 + (index % 2) * .035)),
    conversions: Math.round(row.conversions * factor * periodFactor),
    revenue: Math.round(row.revenue * factor * periodFactor * (channel === '구글' ? 1.06 : channel === '당근' ? .91 : 1)),
  }));
}

export function NaverKeywordReportPage(){
 const [channel,setChannel]=useState<KeywordChannel>('네이버');
 const [period,setPeriod]=useState('7일'); const [account,setAccount]=useState('전체 계정'); const [query,setQuery]=useState(''); const [expanded,setExpanded]=useState(new Set<string>()); const [detail,setDetail]=useState<KeywordRow|null>(null);
 const { filterValue } = useAdvertiserFilter();
 const rows=useMemo(()=>rowsForChannel(channel,period),[channel,period]);
 const ensureDefaultExpanded=()=>new Set(rows.filter(r=>r.children).map(r=>r.id));
 const activeExpanded=expanded.size?expanded:ensureDefaultExpanded();
 const rootIdOf=(row:KeywordRow):string=>{ if(row.level===0)return row.id; const parent=rows.find(p=>p.children?.includes(row.id)); if(!parent)return row.id; return parent.level===0?parent.id:rootIdOf(parent); };
 const visibleRootIds=useMemo(()=>new Set(rows.filter(r=>r.level===0&&matchesAdvertiserFilter(r.name,filterValue)&&(account==='전체 계정'||r.name.includes(account))).map(r=>r.id)),[rows,filterValue,account]);
 const visible=useMemo(()=>rows.filter(r=>{if(!visibleRootIds.has(rootIdOf(r)))return false; if(query&&!r.name.toLowerCase().includes(query.toLowerCase()))return false; return true;}),[rows,query,visibleRootIds]);
 const shown=visible.filter(r=>{if(r.level===0)return true; const parent=rows.find(p=>p.children?.includes(r.id)); if(!parent||!activeExpanded.has(parent.id))return false; if(r.level===2){const grand=rows.find(p=>p.children?.includes(parent.id)); if(grand&&!activeExpanded.has(grand.id))return false;} return true;});
 const totals=visible.filter(r=>r.level===0).reduce((a,r)=>({spend:a.spend+r.spend,clicks:a.clicks+r.clicks,conv:a.conv+r.conversions}),{spend:0,clicks:0,conv:0});
 const toggle=(id:string)=>setExpanded(prev=>{const source=prev.size?prev:ensureDefaultExpanded(); const n=new Set(source);n.has(id)?n.delete(id):n.add(id);return n});
 const style=channelConfig[channel];
 return <>
  <PageHeader title={`${channel} 키워드 보고서`} description={`${channel} 검색·키워드 광고의 소진·노출·CPM·클릭·CTR·CPC·전환·전환율·CPA를 계층형으로 확인합니다.`} action={<a className="btn secondary" href={style.link} target="_blank" rel="noreferrer">{channel} 광고센터 <ExternalLink size={14}/></a>}/>
  <div className="keyword-performance-channel-tabs" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
    {channels.map(item=>{const cfg=channelConfig[item];const active=item===channel;return <button key={item} type="button" onClick={()=>{setChannel(item);setExpanded(new Set());setDetail(null)}} style={{border:`1px solid ${active?cfg.color:'#d8dee9'}`,background:active?cfg.light:'#fff',color:active?cfg.color:'#5d6879',borderRadius:8,padding:'9px 14px',fontWeight:800,cursor:'pointer'}}>{item} 키워드 보고서</button>})}
  </div>
  {filterValue&&<div className="footnote" style={{marginBottom:8}}>광고주 필터: <b>{filterValue}</b> (상단 검색에서 변경) · 캠페인명 기준 매칭</div>}
  <section className="card media-report-card" style={{borderTop:`3px solid ${style.color}`}}>
   <div className="media-report-toolbar"><div><b>{channel} 키워드 {visible.filter(r=>r.kind==='keyword').length}개</b><span> · 소진 {won(totals.spend)} · 클릭 {totals.clicks} · 전환 {totals.conv}</span></div><div className="media-report-actions"><button className="btn secondary" onClick={()=>setExpanded(ensureDefaultExpanded())}>모두 펼치기</button>{periods.map(p=><button key={p} className={`tiny-filter ${period===p?'active':''}`} onClick={()=>setPeriod(p)} style={period===p?{background:style.color,borderColor:style.color,color:'#fff'}:undefined}>{p}</button>)}<select value={account} onChange={e=>setAccount(e.target.value)}><option>전체 계정</option><option>월컴투바베큐</option><option>노멜</option></select><div className="inline-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="키워드 검색"/></div></div></div>
   <div className="table-scroll"><table className="media-report-table naver-tree-table"><thead><tr><th>캠페인 / 광고그룹 / 키워드</th><th>소진</th><th>노출</th><th>CPM</th><th>클릭</th><th>CTR</th><th>CPC</th><th>전환</th><th>전환율</th><th>CPA</th><th>전환매출</th><th>ROAS</th><th>추이</th></tr></thead><tbody>{shown.length===0?<tr><td colSpan={13} style={{textAlign:'center',padding:'24px',color:'#9ca3af'}}>해당 광고주의 캠페인이 없습니다.</td></tr>:shown.map(r=>{const cpm=r.impressions?r.spend/r.impressions*1000:0,ctr=r.impressions?r.clicks/r.impressions*100:0,cpc=r.clicks?r.spend/r.clicks:0,cr=r.clicks?r.conversions/r.clicks*100:0,cpa=r.conversions?r.spend/r.conversions:0,roas=r.spend?r.revenue/r.spend*100:0;return <tr key={r.id} className={`tree-level-${r.level} ${r.kind!=='keyword'?'group-row':''}`} onDoubleClick={()=>setDetail(r)}><td><div className="tree-name" style={{paddingLeft:r.level*22}}>{r.children?<button className="tree-toggle" onClick={()=>toggle(r.id)}>{activeExpanded.has(r.id)?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>:<span className="tree-spacer"/>}<span className="folder-dot" style={{color:style.color}}>●</span><div><b>{r.name}</b><small>{r.meta}</small></div>{r.quality&&<em className={`quality-badge ${r.quality==='제외 후보'?'danger':''}`}>{r.quality}</em>}</div></td><td><b>{won(r.spend)}</b></td><td>{r.impressions.toLocaleString()}</td><td>{won(cpm)}</td><td>{r.clicks}</td><td>{pct(ctr)}</td><td>{won(cpc)}</td><td>{r.conversions}</td><td>{pct(cr)}</td><td>{r.conversions?won(cpa):'-'}</td><td>{r.revenue?won(r.revenue):'-'}</td><td>{r.revenue?pct(roas):'-'}</td><td><div className="mini-bars green" style={{color:style.color}}>{[35,55,28,67,48,76].map((h,i)=><i key={i} style={{height:`${h}%`,background:style.color}}/>)}</div></td></tr>})}</tbody></table></div>
   <div className="footnote">캠페인 → 광고그룹 → 키워드 순으로 펼쳐 볼 수 있습니다. 행을 더블클릭하면 상세 분석 창이 열립니다.</div>
  </section>
  {detail&&<div className="modal-backdrop" onClick={()=>setDetail(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>{detail.name}</h3><p>{channel} · {detail.meta}</p></div><button className="icon-btn" onClick={()=>setDetail(null)}><X size={18}/></button></div><div className="detail-kpi-grid"><div><span>소진</span><b>{won(detail.spend)}</b></div><div><span>노출</span><b>{detail.impressions.toLocaleString()}</b></div><div><span>클릭</span><b>{detail.clicks}</b></div><div><span>전환</span><b>{detail.conversions}</b></div></div><button className="btn primary" style={{background:style.color,borderColor:style.color}} onClick={()=>setDetail(null)}>확인</button></div></div>}
 </>;
}
