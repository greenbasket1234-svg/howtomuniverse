import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Search, Eye } from 'lucide-react';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';

type CreativeObjective='판매'|'트래픽'|'DB 수집'|'DA(Display Ads)'|'SA(Search Ads)';
type Fatigue={id:number;name:string;campaign:string;thumb:string;type:'이미지'|'영상';objective:CreativeObjective;score:number;cpm3:number|null;cpm7:number|null;ctr:number|null;cpc:number|null;frequency:number;days:number};
const seed:Fatigue[]=[
{id:1,name:'20260610_인스타4 삼겹살',campaign:'월컴투바베큐 · 라이브',thumb:'🍖',type:'이미지',objective:'판매',score:35,cpm3:-16,cpm7:-22,ctr:30,cpc:-13,frequency:1.0,days:27},
{id:2,name:'20260610_인스타2 퇴근캠핑',campaign:'월컴투바베큐 · 중지',thumb:'🏕️',type:'영상',objective:'DB 수집',score:20,cpm3:null,cpm7:null,ctr:100,cpc:-100,frequency:1.0,days:7},
{id:3,name:'20260610_인스타3 수영장',campaign:'월컴투바베큐 · 라이브',thumb:'🏊',type:'영상',objective:'트래픽',score:20,cpm3:8,cpm7:2,ctr:-30,cpc:-15,frequency:1.0,days:27},
{id:4,name:'20260610_인스타1 야장',campaign:'월컴투바베큐 · 라이브',thumb:'🌇',type:'이미지',objective:'DA(Display Ads)',score:20,cpm3:3,cpm7:1,ctr:-15,cpc:-13,frequency:1.1,days:21},
{id:5,name:'20260609_인스타2 퇴근캠핑',campaign:'월컴투바베큐 · 중지',thumb:'🌉',type:'영상',objective:'트래픽',score:10,cpm3:3,cpm7:0,ctr:-19,cpc:-10,frequency:1.0,days:15},
{id:6,name:'20260610_인스타1 야장',campaign:'월컴투바베큐 · 라이브',thumb:'🌆',type:'이미지',objective:'판매',score:5,cpm3:null,cpm7:null,ctr:null,cpc:null,frequency:1.0,days:6},
{id:7,name:'20260701_인스타5 소형견',campaign:'월컴투바베큐 · 라이브',thumb:'🐶',type:'영상',objective:'DB 수집',score:5,cpm3:null,cpm7:null,ctr:null,cpc:null,frequency:1.0,days:6},
{id:8,name:'수영장',campaign:'월컴투바베큐 · 라이브',thumb:'🏊‍♀️',type:'이미지',objective:'SA(Search Ads)',score:5,cpm3:null,cpm7:null,ctr:null,cpc:null,frequency:1.0,days:4},
];

type SortKey='score'|'ctr'|'cpc'|'cpm3'|'cpm7'|'days';
const SORT_LABEL:Record<SortKey,string>={score:'피로도',ctr:'CTR 하락',cpc:'CPC 상승',cpm3:'3일 CPM',cpm7:'7일 CPM',days:'사용기간'};

export function CreativeFatiguePage(){
  const [q,setQ]=useState('');
  const [selected,setSelected]=useState<Fatigue|null>(null);
  const [typeFilter,setTypeFilter]=useState<'전체'|Fatigue['type']>('전체');
  const [objectiveFilter,setObjectiveFilter]=useState<'전체'|CreativeObjective>('전체');
  const [sortKey,setSortKey]=useState<SortKey>('score');
  const [sortDir,setSortDir]=useState<'desc'|'asc'>('desc');
  const { filterValue }=useAdvertiserFilter();
  const rows=useMemo(()=>{
    const filtered=seed.filter(x=>
      (x.name+x.type+x.objective+x.campaign).includes(q)
      && matchesAdvertiserFilter(x.campaign,filterValue)
      && (typeFilter==='전체'||x.type===typeFilter)
      && (objectiveFilter==='전체'||x.objective===objectiveFilter)
    );
    // null(값 없음)은 항상 맨 뒤로 보내고, 나머지는 선택한 기준·방향으로 정렬합니다.
    return [...filtered].sort((a,b)=>{
      const av=a[sortKey], bv=b[sortKey];
      if(av==null&&bv==null)return 0;
      if(av==null)return 1;
      if(bv==null)return -1;
      return sortDir==='desc'?bv-av:av-bv;
    });
  },[q,filterValue,typeFilter,objectiveFilter,sortKey,sortDir]);
  const danger=rows.filter(x=>x.score>=85).length, warn=rows.filter(x=>x.score>=70&&x.score<85).length, normal=rows.filter(x=>x.score<70).length;
  const toggleSort=(key:SortKey)=>{ if(sortKey===key){setSortDir(sortDir==='desc'?'asc':'desc');}else{setSortKey(key);setSortDir('desc');} };
  const sortArrow=(key:SortKey)=>sortKey===key?(sortDir==='desc'?' ▼':' ▲'):'';
  return (
    <div>
      <PageHeader title="소재 피로도 관리" description="3일/7일 CPM 상승 · CTR 하락 · CPC 상승 · 빈도 · 사용기간 · 전환감소를 종합해 0~100점으로 평가합니다." action={<div className="ops-search compact"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="소재명·종류·광고 목표 검색"/></div>}/>
      <div className="fatigue-stat-grid"><div><span>🔴 위험 (85+)</span><strong>{danger}건</strong></div><div><span>🟡 주의 (70+)</span><strong>{warn}건</strong></div><div><span>🟢 정상</span><strong>{normal}건</strong></div></div>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',margin:'0 0 14px'}}>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12.5,color:'#64748b'}}>종류
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value as typeof typeFilter)}><option>전체</option><option>이미지</option><option>영상</option></select>
        </label>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12.5,color:'#64748b'}}>광고 목표
          <select value={objectiveFilter} onChange={e=>setObjectiveFilter(e.target.value as typeof objectiveFilter)}>
            <option>전체</option><option>판매</option><option>트래픽</option><option>DB 수집</option><option>DA(Display Ads)</option><option>SA(Search Ads)</option>
          </select>
        </label>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12.5,color:'#64748b'}}>정렬 기준
          <select value={sortKey} onChange={e=>setSortKey(e.target.value as SortKey)}>
            {(Object.keys(SORT_LABEL) as SortKey[]).map(k=><option key={k} value={k}>{SORT_LABEL[k]}</option>)}
          </select>
        </label>
        <button type="button" className="btn secondary" onClick={()=>setSortDir(sortDir==='desc'?'asc':'desc')}>{sortDir==='desc'?'내림차순':'오름차순'}</button>
      </div>
      <section className="card ops-card">
        <div className="table-scroll">
          <table className="ops-table fatigue-table">
            <thead><tr>
              <th>소재 / 광고</th><th>종류</th><th>광고 목표</th>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('score')}>피로도{sortArrow('score')}</th>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('cpm3')}>3일 CPM{sortArrow('cpm3')}</th>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('cpm7')}>7일 CPM{sortArrow('cpm7')}</th>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('ctr')}>CTR 하락{sortArrow('ctr')}</th>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('cpc')}>CPC 상승{sortArrow('cpc')}</th>
              <th>빈도</th>
              <th style={{cursor:'pointer'}} onClick={()=>toggleSort('days')}>사용기간{sortArrow('days')}</th>
              <th></th>
            </tr></thead>
            <tbody>
              {rows.map(r=>
                <tr key={r.id}>
                  <td><div className="creative-name-cell"><span className="mini-thumb">{r.thumb}</span><div><b>{r.name}</b><small>{r.campaign}</small></div></div></td>
                  <td><span className="creative-kind-badge">{r.type}</span></td>
                  <td><span className="creative-objective-badge">{r.objective}</span></td>
                  <td><div className="score-cell"><b>{r.score}</b><i><span style={{width:`${r.score}%`}}/></i><em>{r.score>=85?'위험':r.score>=70?'주의':'정상'}</em></div></td>
                  {[r.cpm3,r.cpm7,r.ctr,r.cpc].map((v,i)=><td key={i} className={v!=null&&v>0?'metric-up':'metric-down'}>{v==null?'-':`${v>0?'+':''}${v}%${i>=2?'↓':''}`}</td>)}
                  <td>{r.frequency.toFixed(1)}</td>
                  <td className={r.days>=21?'warning-text':''}>{r.days}일</td>
                  <td><button className="icon-btn" onClick={()=>setSelected(r)}><Eye size={15}/></button></td>
                </tr>
              )}
              {rows.length===0&&<tr><td colSpan={10} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>조건에 맞는 소재가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="footnote">점수 기준: 3일 CPM +50% / 7일 CPM +30% / CTR -20% / CPC +30% / 빈도 3+ / 전환 감소 / 사용 21일+. 85점 이상은 소재 자동화 규칙과 연결할 수 있습니다.</div>
      </section>
      {selected&&<div className="modal-backdrop"><div className="modal-card"><div className="modal-head"><div><h3>{selected.name}</h3><div className="creative-identity-row"><span className="creative-kind-badge">{selected.type}</span><span className="creative-objective-badge">{selected.objective}</span></div></div><button className="icon-btn" onClick={()=>setSelected(null)}>×</button></div><div className="detail-grid"><div>소재 종류<strong>{selected.type}</strong></div><div>광고 목표<strong>{selected.objective}</strong></div><div>피로도 점수<strong>{selected.score}점</strong></div><div>사용 기간<strong>{selected.days}일</strong></div><div>빈도<strong>{selected.frequency}</strong></div><div>상태<strong>{selected.score>=85?'교체 권장':'정상'}</strong></div></div><div className="modal-actions"><button className="btn secondary" onClick={()=>alert('소재 상세 화면으로 이동합니다.')}>상세 보기</button><button className="btn primary" onClick={()=>alert('소재 재등록 센터에 후보로 추가했습니다.')}>재등록 후보 추가</button></div></div></div>}
    </div>
  );
}
