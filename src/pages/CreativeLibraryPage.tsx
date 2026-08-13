import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Search, Grid3X3, List, X, Copy, Download } from 'lucide-react';
import { CREATIVE_LIBRARY, type Creative } from '../data/creativeLibrary';
import { useAdvertiserFilter } from '../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { apiFetch } from '../hooks/useApi';

type CreativeMetricRow = { advertiserId: string; channel: string; adId: string; adName: string; campaignName?: string; impressions: number; clicks: number; spend: number; dbCount: number; revenue?: number; thumbnailUrl?: string|null; mediaType?: 'image'|'video'|null };

type GroupBy = 'brand' | 'type' | 'objective';
const GROUP_LABEL: Record<GroupBy, string> = { brand: '광고주별', type: '소재 종류별', objective: '광고 목표별' };
// 대소문자·공백 차이 없이 검색되도록 정규화합니다.
const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, '');

export function CreativeLibraryPage(){
  const [q,setQ]=useState('');
  const [platform,setPlatform]=useState('전체');
  const [view,setView]=useState<'grid'|'list'>('grid');
  const [selected,setSelected]=useState<Creative|null>(null);
  const [groupBy,setGroupBy]=useState<GroupBy>('brand');
  const [selectedValue,setSelectedValue]=useState<Record<GroupBy,string>>({ brand: '전체', type: '전체', objective: '전체' });
  const { filterValue } = useAdvertiserFilter();
  const navigate = useNavigate();
  const [advertisers]=useAdvertisers();
  const [creativeMetrics,setCreativeMetrics]=useState<CreativeMetricRow[]>([]);
  const [selectedMetric,setSelectedMetric]=useState<CreativeMetricRow|null>(null);
  const [mediaFilter,setMediaFilter]=useState<'전체'|'이미지'|'영상'>('전체');
  useEffect(()=>{apiFetch<{rows:CreativeMetricRow[]}>('/creative-metrics').then(r=>setCreativeMetrics(r.rows||[])).catch(()=>setCreativeMetrics([]));},[]);
  const advertiserName=(id:string)=>advertisers.find(a=>a.id===id)?.name??id;
  const rows=useMemo(()=>{
    const nq = normalize(q);
    return CREATIVE_LIBRARY.filter(x=>
      normalize(x.name+x.copy+x.objective+x.type+x.brand+x.platform).includes(nq)
      && (platform==='전체'||x.platform===platform)
      && matchesAdvertiserFilter(x.brand,filterValue)
    );
  },[q,platform,filterValue]);

  const keyOf = (c: Creative, g: GroupBy) => g === 'brand' ? c.brand : g === 'type' ? c.type : c.objective;
  const valueOptions = useMemo(() => ['전체', ...Array.from(new Set(rows.map(c => keyOf(c, groupBy))))], [rows, groupBy]);
  const currentValue = selectedValue[groupBy];
  const filteredRows = useMemo(() => currentValue === '전체' ? rows : rows.filter(c => keyOf(c, groupBy) === currentValue), [rows, groupBy, currentValue]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Creative[]>();
    filteredRows.forEach(c => { const k = keyOf(c, groupBy); if (!map.has(k)) { map.set(k, []); order.push(k); } map.get(k)!.push(c); });
    return order.map(key => ({ key, items: map.get(key)! }));
  }, [filteredRows, groupBy]);

  const renderCard = (item: Creative) => (
    <article className="library-card" key={item.id} onClick={()=>setSelected(item)}>
      <div className="library-thumb"><span>{item.thumb}</span><em>{item.type}</em></div>
      <div className="library-body">
        <div className="library-meta"><span>● {item.brand}</span><b className={item.status==='성과 좋음'?'positive':item.status==='피로'?'negative':''}>{item.status}</b></div>
        <h3>{item.name}</h3>
        <div className="creative-identity-row"><span className="creative-kind-badge">{item.type}</span><span className="creative-objective-badge">{item.objective}</span></div>
        <p>{item.copy}</p><hr/>
        <small>매체: {item.platform}</small>
        <small>최초: {item.date} · 사용 이력 {item.uses}회</small>
        <small>총 광고비: ₩{item.spend.toLocaleString()}</small>
      </div>
    </article>
  );
  const renderListRow = (item: Creative) => (
    <button type="button" className="library-row" key={item.id} onClick={()=>setSelected(item)}>
      <span className="library-row-thumb">{item.thumb}</span>
      <span className="library-row-main"><b>{item.name}</b><small>{item.copy}</small></span>
      <span className="library-row-tag">{item.brand}</span>
      <span className="library-row-tag">{item.platform}</span>
      <span className="library-row-tag">{item.type}</span>
      <span className="library-row-tag">{item.objective}</span>
      <b className={item.status==='성과 좋음'?'positive':item.status==='피로'?'negative':''}>{item.status}</b>
      <span className="library-row-spend">₩{item.spend.toLocaleString()}</span>
    </button>
  );
  return (
    <div>
      <PageHeader title="소재 라이브러리" description="여러 매체의 광고 소재를 검색하고 성과와 사용 이력을 함께 관리합니다." action={
        <div className="library-actions">
          <div className="ops-search compact"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="소재명·종류·광고 목표 검색"/></div>
          <select value={platform} onChange={e=>setPlatform(e.target.value)}><option>전체</option><option>메타</option><option>네이버</option><option>구글</option></select>
          <button className={view==='grid'?'icon-btn active':''} onClick={()=>setView('grid')}><Grid3X3/></button>
          <button className={view==='list'?'icon-btn active':''} onClick={()=>setView('list')}><List/></button>
        </div>
      }/>
      {!!creativeMetrics.length && (
        <section className="card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 4px' }}>매체 연동 실제 소재 성과</h3>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>설정 &gt; 매체 계정 연동으로 연결된 계정에서 자동으로 가져온 실제 광고 단위 데이터입니다. 썸네일을 누르면 크게 볼 수 있습니다.</p>
          <div className="media-type-toggle">
            {(['전체','이미지','영상'] as const).map(t=><button key={t} className={mediaFilter===t?'active':''} onClick={()=>setMediaFilter(t)}>{t} {t!=='전체'&&`(${creativeMetrics.filter(m=>t==='이미지'?m.mediaType!=='video':m.mediaType==='video').length})`}</button>)}
          </div>
          <div className="library-grid">
            {creativeMetrics.filter(m=>mediaFilter==='전체'||(mediaFilter==='이미지'?m.mediaType!=='video':m.mediaType==='video')).map(m => (
              <article className="library-card" key={`${m.channel}-${m.adId}`} onClick={()=>setSelectedMetric(m)} style={{cursor:'pointer'}}>
                <div className="library-thumb-square">
                  {m.thumbnailUrl
                    ? <img src={m.thumbnailUrl} alt={m.adName} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : <span style={{fontSize:28}}>🖼️</span>}
                  <span style={{position:'absolute',top:8,right:8,background:'rgba(0,0,0,.6)',color:'#fff',fontSize:11,padding:'2px 7px',borderRadius:999}}>{m.mediaType==='video'?'▶ 영상':'🖼 이미지'}</span>
                </div>
                <div className="library-body">
                  <div className="library-meta"><span>● {advertiserName(m.advertiserId)}</span></div>
                  <h3 style={{fontSize:14}}>{m.adName}</h3>
                  <p style={{fontSize:12,color:'#64748b'}}>{m.campaignName || '캠페인 정보 없음'}</p><hr/>
                  <small>노출 {m.impressions.toLocaleString()} · 클릭 {m.clicks.toLocaleString()}</small>
                  <small>광고비 ₩{Math.round(m.spend).toLocaleString()} · 전환 {m.dbCount.toLocaleString()}</small>
                  {!!m.revenue && <small>매출 ₩{Math.round(m.revenue).toLocaleString()}</small>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {selectedMetric && (
        <div className="modal-backdrop" onClick={()=>setSelectedMetric(null)}>
          <div className="modal-card wide creative-detail-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <div><h3>{selectedMetric.adName}</h3><p>{advertiserName(selectedMetric.advertiserId)} · {selectedMetric.campaignName || '캠페인 정보 없음'}</p></div>
              <button className="icon-btn" onClick={()=>setSelectedMetric(null)}><X/></button>
            </div>
            <div className="creative-detail-preview-lib">
              <div className="library-thumb-square" style={{width:240}}>
                {selectedMetric.thumbnailUrl ? <img src={selectedMetric.thumbnailUrl} alt={selectedMetric.adName} style={{width:'100%',height:'100%',objectFit:'contain'}}/> : '🖼️'}
              </div>
              <div>
                <div className="detail-grid">
                  <div>노출수<strong>{selectedMetric.impressions.toLocaleString()}</strong></div>
                  <div>클릭수<strong>{selectedMetric.clicks.toLocaleString()}</strong></div>
                  <div>광고비<strong>₩{Math.round(selectedMetric.spend).toLocaleString()}</strong></div>
                  <div>전환(DB)<strong>{selectedMetric.dbCount.toLocaleString()}</strong></div>
                  <div>매출<strong>{selectedMetric.revenue?`₩${Math.round(selectedMetric.revenue).toLocaleString()}`:'-'}</strong></div>
                  <div>매체<strong>{selectedMetric.channel==='meta'?'Meta':selectedMetric.channel}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="library-group-toggle">
        <span>보기 기준</span>
        {(['brand','type','objective'] as GroupBy[]).map(g => (
          <button key={g} className={groupBy===g?'active':''} onClick={()=>setGroupBy(g)}>{GROUP_LABEL[g]}</button>
        ))}
      </div>
      <div className="library-value-toggle">
        {valueOptions.map(v => (
          <button key={v} className={currentValue===v?'active':''} onClick={()=>setSelectedValue(prev=>({...prev,[groupBy]:v}))}>{v}</button>
        ))}
      </div>
      {groups.map(group => (
        <section className="library-group-section" key={group.key}>
          <h3 className="library-group-heading">{group.key} <span>{group.items.length}개</span></h3>
          {view==='grid'
            ? <div className="library-grid">{group.items.map(renderCard)}</div>
            : <div className="library-list">{group.items.map(renderListRow)}</div>}
        </section>
      ))}
      {filteredRows.length === 0 && <p className="muted" style={{padding:'20px'}}>조건에 맞는 소재가 없습니다.</p>}
      {selected&&(
        <div className="modal-backdrop" onClick={()=>setSelected(null)}>
          <div className="modal-card wide creative-detail-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>{selected.name}</h3>
                <p>{selected.brand} · {selected.platform}</p>
                <div className="creative-identity-row"><span className="creative-kind-badge">{selected.type}</span><span className="creative-objective-badge">{selected.objective}</span></div>
              </div>
              <button className="icon-btn" onClick={()=>setSelected(null)}><X/></button>
            </div>
            <div className="creative-detail-preview-lib">
              <div className="large-thumb">{selected.thumb}</div>
              <div>
                <p>{selected.copy}</p>
                <div className="detail-grid">
                  <div>소재 종류<strong>{selected.type}</strong></div>
                  <div>광고 목표<strong>{selected.objective}</strong></div>
                  <div>총 광고비<strong>₩{selected.spend.toLocaleString()}</strong></div>
                  <div>사용 이력<strong>{selected.uses}회</strong></div>
                  <div>상태<strong>{selected.status}</strong></div>
                  <div>최초 등록<strong>{selected.date}</strong></div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={()=>navigate(`/creatives/library/${selected.id}`)}>전체 화면으로 보기</button>
              <button className="btn secondary" onClick={()=>navigator.clipboard?.writeText(selected.copy)}><Copy size={15}/> 문구 복사</button>
              <button className="btn secondary" onClick={()=>alert('데모 모드입니다. 실제 소재 파일 연동 후 다운로드됩니다.')}><Download size={15}/> 데모 다운로드</button>
              <button className="btn primary" onClick={()=>alert('재등록 후보로 추가했습니다. (데모)')}>재등록 후보 추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
