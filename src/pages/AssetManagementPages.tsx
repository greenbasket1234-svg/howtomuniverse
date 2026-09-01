import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Archive, BarChart3, Check, ChevronRight, Download, File, FileText, Film, Folder, FolderOpen,
  Grid2X2, Heart, Image as ImageIcon, List, MoreHorizontal, Plus, RotateCcw, Search, Star, Tag,
  Trash2, Upload, X, Copy, ExternalLink, Layers3, Clock3, HardDrive, Users, Play, FileImage
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAdvertisers } from '../hooks/useAdvertisers';
import {
  Asset, AssetFolder, AssetStatus, AssetType, assetVersions, createAssetFolder, createAssetsFromFiles, downloadAsset, duplicateAsset,
  ensureAdvertiserFolders, formatDuration, humanFileSize, loadAssets, loadFolders, moveAssetsToTrash,
  patchAsset, permanentlyDeleteAssets, restoreAssets, saveFolders, syncExistingAssets
} from '../utils/assetStore';
import { BrandProfile, loadBrandProfile, saveBrandProfile } from '../utils/brandProfileStore';

const TYPE_LABELS: Record<AssetType, string> = { image:'이미지', video:'영상', document:'문서', creative:'광고 소재', template:'템플릿', brand:'로고·브랜드', reference:'레퍼런스', other:'기타' };
const STATUS_LABELS: Record<AssetStatus, string> = { draft:'초안', review:'검토 중', approved:'승인', active:'사용 중', archived:'보관', expired:'만료' };
const SOURCE_LABELS: Record<string, string> = { upload:'직접 업로드', content:'콘텐츠 제작', 'creative-library':'소재 관리', 'monthly-report':'월간 보고서', 'next-month-proposal':'다음달 제안서', reference:'레퍼런스', external:'외부 가져오기' };
const typeIcon = (asset: Asset) => asset.assetType === 'image' ? <ImageIcon size={24}/> : asset.assetType === 'video' ? <Film size={24}/> : asset.assetType === 'document' ? <FileText size={24}/> : asset.assetType === 'creative' ? <Layers3 size={24}/> : <File size={24}/>;

function formatDate(value?: string){ if(!value)return '-'; const d=new Date(value); return Number.isNaN(d.getTime())?value:`${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.`; }
function ratioLabel(asset: Asset){ if(!asset.width||!asset.height)return '-'; const r=asset.width/asset.height; if(Math.abs(r-1)<.03)return '1:1'; if(Math.abs(r-.8)<.04)return '4:5'; if(Math.abs(r-9/16)<.04)return '9:16'; if(Math.abs(r-16/9)<.04)return '16:9'; return `${asset.width}:${asset.height}`; }

function useAssets(){
  const [assets,setAssets]=useState<Asset[]>([]);
  const refresh=()=>{ syncExistingAssets(); setAssets(loadAssets(true)); };
  useEffect(()=>{ refresh(); const fn=()=>refresh(); window.addEventListener('howtom:assets-changed',fn); return()=>window.removeEventListener('howtom:assets-changed',fn); },[]);
  return [assets,refresh] as const;
}

function AssetPreview({asset,large=false}:{asset:Asset;large?:boolean}){
  return <div className={`asset-preview ${large?'large':''} type-${asset.assetType}`}>
    {asset.thumbnailUrl?<img src={asset.thumbnailUrl} alt=""/>:<div className="asset-preview-placeholder">{typeIcon(asset)}<span>{asset.assetType==='video'?'영상':asset.assetType==='document'?(asset.documentType||'문서'):asset.assetType==='creative'?'광고 소재':TYPE_LABELS[asset.assetType]}</span></div>}
    {asset.assetType==='video'&&asset.duration!=null&&<span className="asset-duration">{formatDuration(asset.duration)}</span>}
  </div>
}

function AssetDetailDrawer({asset,onClose,onRefresh}:{asset:Asset;onClose:()=>void;onRefresh:()=>void}){
  const [name,setName]=useState(asset.name); const [tags,setTags]=useState(asset.tags.join(', ')); const [folderId,setFolderId]=useState(asset.folderId||'');
  const compatibleFolders=loadFolders().filter(folder=>folder.folderType==='custom'&&(!folder.advertiserId||folder.advertiserId===asset.advertiserId)); const versions=assetVersions(asset);
  useEffect(()=>{setName(asset.name);setTags(asset.tags.join(', '));setFolderId(asset.folderId||'');},[asset.assetId]);
  const save=()=>{patchAsset(asset.assetId,{name:name.trim()||asset.name,tags:tags.split(',').map(x=>x.trim()).filter(Boolean),folderId:folderId||undefined});onRefresh();};
  return <div className="asset-drawer-backdrop" onClick={onClose}><aside className="asset-drawer" onClick={e=>e.stopPropagation()}>
    <div className="asset-drawer-head"><div><span className="asset-eyebrow">{TYPE_LABELS[asset.assetType]}</span><h3>{asset.name}</h3></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>
    <AssetPreview asset={asset} large/>
    <div className="asset-drawer-form"><label>이름<input value={name} onChange={e=>setName(e.target.value)}/></label><label>태그<input value={tags} onChange={e=>setTags(e.target.value)} placeholder="쉼표로 구분"/></label><label>사용자 폴더<select value={folderId} onChange={e=>setFolderId(e.target.value)}><option value="">폴더 없음</option>{compatibleFolders.map(folder=><option key={folder.folderId} value={folder.folderId}>{folder.name}</option>)}</select></label><button className="btn primary" onClick={save}><Check size={15}/> 변경 저장</button></div>
    <div className="asset-detail-list">
      <div><span>광고주</span><b>{asset.advertiserName||'공통 자산'}</b></div><div><span>상태</span><b>{STATUS_LABELS[asset.status]}</b></div><div><span>출처</span><b>{SOURCE_LABELS[asset.sourceType]||asset.sourceType}</b></div><div><span>파일 형식</span><b>{asset.mimeType||'-'}</b></div><div><span>파일 용량</span><b>{humanFileSize(asset.fileSize)}</b></div><div><span>해상도</span><b>{asset.width&&asset.height?`${asset.width} × ${asset.height}`:'-'}</b></div><div><span>영상 길이</span><b>{asset.assetType==='video'?formatDuration(asset.duration):'-'}</b></div><div><span>등록일</span><b>{formatDate(asset.createdAt)}</b></div><div><span>수정일</span><b>{formatDate(asset.updatedAt)}</b></div>
    </div>
    <section className="asset-relations"><h4>사용 위치</h4>{asset.relationLabels?.length?asset.relationLabels.map((x,i)=><div key={i}><ExternalLink size={14}/><span>{x}</span></div>):<p>아직 연결된 사용 위치가 없습니다.</p>}</section>
    {versions.length>1&&<section className="asset-relations"><h4>버전</h4>{versions.map((version,index)=><div key={version.assetId}><Layers3 size={14}/><span>v{version.version||1} · {formatDate(version.updatedAt)}{index===0?' · 최신':''}</span></div>)}</section>}
    {asset.assetType==='creative'&&<section className="asset-performance"><h4>광고 소재 요약</h4><div><span>광고비</span><b>{asset.spend!=null?`₩${asset.spend.toLocaleString()}`:'-'}</b></div><div><span>성과 상태</span><b>{asset.performanceState||'-'}</b></div><div><span>피로도</span><b>{asset.fatigueState||'-'}</b></div></section>}
    <div className="asset-drawer-actions"><button className="btn secondary" onClick={()=>downloadAsset(asset)}><Download size={15}/> {asset.sourceRoute&&!asset.originalFileName?'원본 위치 열기':'다운로드'}</button>{asset.assetType==='creative'&&asset.creativeId&&<Link className="btn secondary" to={`/insights/creatives?creative=${encodeURIComponent(asset.creativeId)}`}><BarChart3 size={15}/> 소재 분석</Link>}{(asset.assetType==='image'||asset.assetType==='video')&&<Link className="btn secondary" to={`/content/ad-creation?sourceAsset=${encodeURIComponent(asset.assetId)}`}><Copy size={15}/> 이 자산 기반 제작</Link>}<button className="btn secondary" onClick={async()=>{await duplicateAsset(asset.assetId);onRefresh();}}><Copy size={15}/> 복사 새 버전</button><button className="btn secondary" onClick={()=>{patchAsset(asset.assetId,{favorite:!asset.favorite});onRefresh();}}><Star size={15}/>{asset.favorite?'즐겨찾기 해제':'즐겨찾기'}</button><button className="btn danger" onClick={()=>{moveAssetsToTrash([asset.assetId]);onClose();onRefresh();}}><Trash2 size={15}/> 휴지통</button></div>
  </aside></div>;
}

function UploadModal({onClose,onDone,defaultAdvertiserId}:{onClose:()=>void;onDone:()=>void;defaultAdvertiserId?:string}){
  const [advertisers]=useAdvertisers(); const [files,setFiles]=useState<File[]>([]); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const fileRef=useRef<HTMLInputElement>(null);
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault(); if(!files.length){setMessage('업로드할 파일을 선택하세요.');return;} const f=new FormData(e.currentTarget);setBusy(true);const before=loadAssets().length;const created=await createAssetsFromFiles(files,{advertiserId:String(f.get('advertiserId')||'')||undefined,tags:String(f.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean),status:String(f.get('status')||'draft') as AssetStatus,description:String(f.get('description')||'')});setBusy(false);if(!created.length){setMessage('동일한 파일이 이미 등록되어 있거나 새 파일이 없습니다.');return;}setMessage(`${created.length}개 파일을 등록했습니다. ${before===loadAssets().length?'':'자산 목록에 반영되었습니다.'}`);onDone();setTimeout(onClose,600);};
  return <div className="modal-backdrop"><div className="modal-card asset-upload-modal"><div className="modal-head"><div><h3>파일 업로드</h3><p>파일 본문은 브라우저 IndexedDB, 자산 정보는 공통 Asset 인덱스에 저장합니다.</p></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div><form onSubmit={submit} className="asset-upload-form"><div className="asset-dropzone" onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();setFiles(Array.from(e.dataTransfer.files));}}><Upload size={28}/><b>파일을 선택하거나 여기에 끌어다 놓으세요.</b><span>이미지·영상·PDF·문서·CSV 등 여러 파일을 한 번에 등록할 수 있습니다.</span><input ref={fileRef} hidden type="file" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))}/></div>{files.length>0&&<div className="asset-upload-files">{files.map(file=><span key={`${file.name}-${file.size}`}>{file.name}<small>{humanFileSize(file.size)}</small></span>)}</div>}<div className="asset-form-grid"><label>광고주<select name="advertiserId" defaultValue={defaultAdvertiserId||''}><option value="">공통 자산</option>{advertisers.filter(a=>a.id!=='default').map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label><label>상태<select name="status" defaultValue="draft"><option value="draft">초안</option><option value="review">검토 중</option><option value="approved">승인</option><option value="active">사용 중</option><option value="archived">보관</option></select></label><label className="wide">태그<input name="tags" placeholder="예: 테슬라, 가격, 2026여름프로모션"/></label><label className="wide">설명<textarea name="description" rows={2} placeholder="선택 사항"/></label></div>{message&&<div className="asset-upload-message">{message}</div>}<div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>취소</button><button className="btn primary" disabled={busy}>{busy?'등록 중...':'업로드'}</button></div></form></div></div>;
}

type ViewMode='grid'|'list';
function AssetBrowser({fixedType,advertiserId,title,description,documentOnly=false}:{fixedType?:AssetType;advertiserId?:string;title:string;description:string;documentOnly?:boolean}){
  const [assets,refresh]=useAssets(); const [advertisers]=useAdvertisers(); const [params]=useSearchParams();
  const queryAdvertiser=advertiserId||params.get('advertiser')||''; const querySource=params.get('source')||''; const queryAsset=params.get('asset')||'';
  const [query,setQuery]=useState(''); const [adv,setAdv]=useState(queryAdvertiser); const [type,setType]=useState<AssetType|''>(fixedType||''); const [source,setSource]=useState(querySource); const [status,setStatus]=useState(''); const [tag,setTag]=useState(''); const [sort,setSort]=useState('updated-desc'); const [subFilter,setSubFilter]=useState(''); const [view,setView]=useState<ViewMode>(()=>fixedType==='document'?'list':(localStorage.getItem('howtom-assets-view') as ViewMode)||'grid'); const [selected,setSelected]=useState<string[]>([]); const [detail,setDetail]=useState<Asset|null>(null); const [upload,setUpload]=useState(false);
  useEffect(()=>{ if(queryAdvertiser)setAdv(queryAdvertiser); if(querySource)setSource(querySource); },[queryAdvertiser,querySource]);
  useEffect(()=>{ if(!queryAsset||detail)return; const found=assets.find(asset=>asset.assetId===queryAsset&&!asset.deletedAt); if(found)setDetail(found); },[queryAsset,assets,detail]);
  const active=assets.filter(a=>!a.deletedAt);
  const tags=Array.from(new Set(active.flatMap(a=>a.tags||[]))).sort();
  const filtered=useMemo(()=>active.filter(a=>{
    if(fixedType&&a.assetType!==fixedType)return false; if(documentOnly&&a.assetType!=='document')return false; if(adv&&a.advertiserId!==adv)return false; if(type&&a.assetType!==type)return false; if(source&&a.sourceType!==source)return false; if(status&&a.status!==status)return false; if(tag&&!a.tags.includes(tag))return false;
    if(subFilter){
      if(fixedType==='image'&&ratioLabel(a)!==subFilter)return false;
      if(fixedType==='video'){const d=a.duration||0;if(subFilter==='15초 이하'&&d>15)return false;if(subFilter==='16~30초'&&(d<16||d>30))return false;if(subFilter==='31~60초'&&(d<31||d>60))return false;if(subFilter==='1분 초과'&&d<=60)return false;}
      if(fixedType==='document'&&a.documentType!==subFilter)return false;
      if(fixedType==='creative'&&a.channel!==subFilter&&a.performanceState!==subFilter&&a.fatigueState!==subFilter)return false;
    }
    const q=query.trim().toLowerCase(); if(q&&!`${a.name} ${a.advertiserName||''} ${a.campaignName||''} ${(a.tags||[]).join(' ')} ${a.documentType||''}`.toLowerCase().includes(q))return false; return true;
  }).sort((a,b)=>{ if(sort==='name-asc')return a.name.localeCompare(b.name,'ko'); if(sort==='name-desc')return b.name.localeCompare(a.name,'ko'); if(sort==='size-desc')return (b.fileSize||0)-(a.fileSize||0); if(sort==='created-desc')return b.createdAt.localeCompare(a.createdAt); return b.updatedAt.localeCompare(a.updatedAt); }),[active,adv,type,source,status,tag,query,sort,fixedType,documentOnly,subFilter]);
  const counts={all:active.length,image:active.filter(a=>a.assetType==='image').length,video:active.filter(a=>a.assetType==='video').length,document:active.filter(a=>a.assetType==='document').length,creative:active.filter(a=>a.assetType==='creative').length,other:active.filter(a=>!['image','video','document','creative'].includes(a.assetType)).length};
  const toggle=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const setViewMode=(mode:ViewMode)=>{setView(mode);localStorage.setItem('howtom-assets-view',mode)};
  return <>
    <PageHeader title={title} description={description} action={<div className="action-row"><button className="btn secondary" onClick={()=>setUpload(true)}><Upload size={16}/> 파일 업로드</button></div>}/>
    {!fixedType&&!advertiserId&&<div className="asset-type-chips"><button className={!type?'active':''} onClick={()=>setType('')}>전체 <b>{counts.all}</b></button><button className={type==='image'?'active':''} onClick={()=>setType('image')}>이미지 <b>{counts.image}</b></button><button className={type==='video'?'active':''} onClick={()=>setType('video')}>영상 <b>{counts.video}</b></button><button className={type==='document'?'active':''} onClick={()=>setType('document')}>문서 <b>{counts.document}</b></button><button className={type==='creative'?'active':''} onClick={()=>setType('creative')}>광고 소재 <b>{counts.creative}</b></button><button className={type==='other'?'active':''} onClick={()=>setType('other')}>기타 <b>{counts.other}</b></button></div>}
    <section className="card asset-toolbar"><div className="asset-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="파일명·광고주·캠페인·태그 검색"/></div><select value={adv} onChange={e=>setAdv(e.target.value)} disabled={Boolean(advertiserId)}><option value="">전체 광고주</option>{advertisers.filter(a=>a.id!=='default').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>{!fixedType&&!documentOnly&&<select value={type} onChange={e=>setType(e.target.value as AssetType|'')}><option value="">전체 유형</option>{Object.entries(TYPE_LABELS).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select>}<select value={source} onChange={e=>setSource(e.target.value)}><option value="">전체 출처</option>{Object.entries(SOURCE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">전체 상태</option>{Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>{fixedType==='image'&&<select value={subFilter} onChange={e=>setSubFilter(e.target.value)}><option value="">전체 비율</option>{['1:1','4:5','9:16','16:9'].map(x=><option key={x}>{x}</option>)}</select>}{fixedType==='video'&&<select value={subFilter} onChange={e=>setSubFilter(e.target.value)}><option value="">전체 길이</option>{['15초 이하','16~30초','31~60초','1분 초과'].map(x=><option key={x}>{x}</option>)}</select>}{fixedType==='document'&&<select value={subFilter} onChange={e=>setSubFilter(e.target.value)}><option value="">전체 문서 유형</option>{Array.from(new Set(active.filter(a=>a.assetType==='document'&&a.documentType).map(a=>a.documentType!))).map(x=><option key={x}>{x}</option>)}</select>}{fixedType==='creative'&&<select value={subFilter} onChange={e=>setSubFilter(e.target.value)}><option value="">매체·성과·피로도</option>{Array.from(new Set(active.filter(a=>a.assetType==='creative').flatMap(a=>[a.channel,a.performanceState,a.fatigueState].filter(Boolean) as string[]))).map(x=><option key={x}>{x}</option>)}</select>}<select value={tag} onChange={e=>setTag(e.target.value)}><option value="">전체 태그</option>{tags.map(x=><option key={x}>{x}</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value)}><option value="updated-desc">최근 수정순</option><option value="created-desc">최근 등록순</option><option value="name-asc">이름 오름차순</option><option value="name-desc">이름 내림차순</option><option value="size-desc">용량 큰순</option></select><div className="asset-view-toggle"><button className={view==='grid'?'active':''} onClick={()=>setViewMode('grid')}><Grid2X2 size={17}/></button><button className={view==='list'?'active':''} onClick={()=>setViewMode('list')}><List size={17}/></button></div></section>
    {selected.length>0&&<div className="asset-bulkbar"><b>{selected.length}개 선택</b><button onClick={()=>{const value=prompt('추가할 태그를 입력하세요.');if(!value)return;selected.forEach(id=>{const row=loadAssets(true).find(a=>a.assetId===id);if(row)patchAsset(id,{tags:Array.from(new Set([...(row.tags||[]),value.trim()])).filter(Boolean)})});setSelected([]);refresh();}}><Tag size={15}/> 태그 추가</button><button onClick={()=>{selected.forEach(id=>patchAsset(id,{favorite:true}));setSelected([]);refresh();}}><Star size={15}/> 즐겨찾기</button><button onClick={()=>{selected.forEach(id=>{const row=loadAssets(true).find(a=>a.assetId===id);if(row)downloadAsset(row)});}}><Download size={15}/> 다운로드</button><button onClick={()=>{moveAssetsToTrash(selected);setSelected([]);refresh();}}><Trash2 size={15}/> 휴지통</button><button onClick={()=>setSelected([])}><X size={15}/> 선택 해제</button></div>}
    {filtered.length===0?<section className="card asset-empty"><FolderOpen size={42}/><h3>조건에 맞는 자산이 없습니다.</h3><p>파일을 업로드하거나 필터를 초기화해 보세요.</p><button className="btn primary" onClick={()=>setUpload(true)}><Upload size={16}/> 파일 업로드</button></section>:
    view==='grid'?<div className="asset-grid">{filtered.map(asset=><article className={`asset-card ${selected.includes(asset.assetId)?'selected':''}`} key={asset.assetId}><button className="asset-select" onClick={()=>toggle(asset.assetId)}>{selected.includes(asset.assetId)?<Check size={14}/>:''}</button><button className="asset-favorite" onClick={()=>{patchAsset(asset.assetId,{favorite:!asset.favorite});refresh();}}><Star size={17} fill={asset.favorite?'currentColor':'none'}/></button><button className="asset-card-main" onClick={()=>setDetail(asset)}><AssetPreview asset={asset}/><div className="asset-card-body"><strong>{asset.name}</strong><span>{TYPE_LABELS[asset.assetType]} · {asset.advertiserName||'공통 자산'}</span><small>{asset.width&&asset.height?`${asset.width} × ${asset.height} · ${ratioLabel(asset)}`:asset.documentType||SOURCE_LABELS[asset.sourceType]||asset.sourceType}</small><div className="asset-tag-row">{asset.tags.slice(0,3).map(x=><em key={x}>#{x}</em>)}</div><div className="asset-card-footer"><span>{formatDate(asset.updatedAt)}</span><b className={`asset-status ${asset.status}`}>{STATUS_LABELS[asset.status]}</b></div></div></button></article>)}</div>:
    <section className="card asset-list-wrap"><table className="ops-table asset-list-table"><thead><tr><th/><th>이름</th><th>광고주</th><th>유형</th><th>출처</th><th>용량</th><th>수정일</th><th>상태</th></tr></thead><tbody>{filtered.map(asset=><tr key={asset.assetId} onDoubleClick={()=>setDetail(asset)}><td><input type="checkbox" checked={selected.includes(asset.assetId)} onChange={()=>toggle(asset.assetId)}/></td><td><button className="asset-name-button" onClick={()=>setDetail(asset)}>{typeIcon(asset)}<span><b>{asset.name}</b><small>{asset.tags.slice(0,2).map(x=>`#${x}`).join(' ')}</small></span></button></td><td>{asset.advertiserName||'공통 자산'}</td><td>{TYPE_LABELS[asset.assetType]}{asset.documentType&&<small>{asset.documentType}</small>}</td><td>{SOURCE_LABELS[asset.sourceType]||asset.sourceType}</td><td>{humanFileSize(asset.fileSize)}</td><td>{formatDate(asset.updatedAt)}</td><td><span className={`asset-status ${asset.status}`}>{STATUS_LABELS[asset.status]}</span></td></tr>)}</tbody></table></section>}
    {detail&&<AssetDetailDrawer asset={loadAssets(true).find(x=>x.assetId===detail.assetId)||detail} onClose={()=>setDetail(null)} onRefresh={refresh}/>} {upload&&<UploadModal defaultAdvertiserId={advertiserId||adv||undefined} onClose={()=>setUpload(false)} onDone={refresh}/>} </>;
}

export function AssetsHomePage(){ return <AssetBrowser title="전체 자산" description="이미지·영상·문서·광고 소재를 한 번만 저장하고 모든 메뉴에서 같은 assetId로 참조합니다."/>; }
export function AssetImagesPage(){ return <AssetBrowser fixedType="image" title="이미지" description="이미지 자산을 비율·해상도·광고주·태그와 사용 여부 기준으로 관리합니다."/>; }
export function AssetVideosPage(){ return <AssetBrowser fixedType="video" title="영상" description="영상 자산의 길이·비율·사용 위치를 확인하고 콘텐츠·소재 분석으로 연결합니다."/>; }
export function AssetDocumentsPage(){ return <AssetBrowser fixedType="document" documentOnly title="문서" description="월간 보고서·다음달 제안서·업로드 문서를 광고주와 문서 유형별로 관리합니다."/>; }
export function AssetCreativesPage(){ return <AssetBrowser fixedType="creative" title="광고 소재" description="실제 광고에 사용된 creativeId와 원본 자산·캠페인·성과 분석을 연결합니다."/>; }

const SYSTEM_FOLDERS=[['전체','all'],['이미지','image'],['영상','video'],['광고 소재','creative'],['보고서','report'],['제안서','proposal'],['레퍼런스','reference'],['로고·브랜드','brand'],['문서','document'],['템플릿','template'],['기타','other']] as const;

export function AdvertiserAssetFoldersPage(){
  const [assets]=useAssets(); const [advertisers]=useAdvertisers(); const [params,setParams]=useSearchParams(); const selected=params.get('advertiser')||''; const [query,setQuery]=useState(''); const [folders,setFolders]=useState<AssetFolder[]>(()=>ensureAdvertiserFolders()); const [newFolder,setNewFolder]=useState('');
  useEffect(()=>{const fn=()=>setFolders(loadFolders());window.addEventListener('howtom:asset-folders-changed',fn);return()=>window.removeEventListener('howtom:asset-folders-changed',fn)},[]);
  const activeAssets=assets.filter(a=>!a.deletedAt);
  const advertiser=advertisers.find(a=>a.id===selected||a.name===selected);
  if(advertiser){ const rows=activeAssets.filter(a=>a.advertiserId===advertiser.id); const custom=folders.filter(f=>f.folderType==='custom'&&f.advertiserId===advertiser.id); return <><PageHeader title={advertiser.name} description="광고주의 모든 제작물·보고서·레퍼런스·광고 소재를 하나의 워크스페이스에서 확인합니다." action={<button className="btn secondary" onClick={()=>setParams({})}>광고주 목록</button>}/><div className="asset-advertiser-summary"><div><span>전체 자산</span><b>{rows.length}</b></div><div><span>이미지</span><b>{rows.filter(a=>a.assetType==='image').length}</b></div><div><span>영상</span><b>{rows.filter(a=>a.assetType==='video').length}</b></div><div><span>광고 소재</span><b>{rows.filter(a=>a.assetType==='creative').length}</b></div><div><span>문서</span><b>{rows.filter(a=>a.assetType==='document').length}</b></div><div><span>저장 공간</span><b>{humanFileSize(rows.reduce((s,a)=>s+(a.fileSize||0),0))}</b></div></div><section className="card advertiser-folder-nav"><div className="ops-card-head"><div><h3>시스템 폴더</h3><p>파일을 복제하지 않고 자산 속성으로 자동 분류합니다.</p></div></div><div className="system-folder-grid">{SYSTEM_FOLDERS.map(([label,key])=>{let count=rows.length;if(key==='image'||key==='video'||key==='creative'||key==='document'||key==='template'||key==='brand'||key==='reference'||key==='other')count=rows.filter(a=>a.assetType===key).length;if(key==='report')count=rows.filter(a=>a.documentType==='월간 보고서').length;if(key==='proposal')count=rows.filter(a=>a.documentType==='다음달 제안서').length;return <div className="system-folder-card" key={key}><Folder size={21}/><div><b>{label}</b><span>{count}개</span></div></div>})}</div></section><section className="card advertiser-folder-nav"><div className="ops-card-head"><div><h3>사용자 폴더</h3><p>프로모션·제품·시즌 등 광고주별 작업 분류를 추가할 수 있습니다.</p></div><div className="asset-folder-create"><input value={newFolder} onChange={e=>setNewFolder(e.target.value)} placeholder="새 폴더명"/><button className="btn primary" onClick={()=>{if(!newFolder.trim())return;createAssetFolder(newFolder.trim(),advertiser.id,`adv-root-${advertiser.id}`);setNewFolder('');setFolders(loadFolders());}}><Plus size={15}/> 추가</button></div></div><div className="custom-folder-list">{custom.length?custom.map(folder=><div key={folder.folderId}><FolderOpen size={20}/><b>{folder.name}</b><span>{rows.filter(a=>a.folderId===folder.folderId).length}개</span><button className="icon-btn danger" onClick={()=>{saveFolders(loadFolders().filter(f=>f.folderId!==folder.folderId));setFolders(loadFolders());}}><Trash2 size={14}/></button></div>):<p className="muted">사용자 폴더가 없습니다.</p>}</div></section><section className="card advertiser-recent-assets"><div className="ops-card-head"><div><h3>최근 자산</h3><p>이 광고주의 최근 등록·수정 파일입니다.</p></div><Link className="btn secondary" to={`/assets?advertiser=${encodeURIComponent(advertiser.id)}`}>전체 자산 보기 <ChevronRight size={15}/></Link></div><div className="advertiser-recent-grid">{rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,8).map(a=><div key={a.assetId}><AssetPreview asset={a}/><b>{a.name}</b><span>{TYPE_LABELS[a.assetType]}</span></div>)}</div></section></> }
  const cards=advertisers.filter(a=>a.id!=='default'&&a.name.toLowerCase().includes(query.toLowerCase())).map(advertiser=>{const rows=activeAssets.filter(a=>a.advertiserId===advertiser.id);return {advertiser,rows};});
  return <><PageHeader title="광고주별 폴더" description="광고주가 생성되면 자산 워크스페이스를 자동 구성하고 모든 제작물·보고서·소재를 광고주 단위로 묶습니다."/><div className="asset-folder-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="광고주 검색"/></div><div className="advertiser-folder-grid">{cards.map(({advertiser,rows})=><button key={advertiser.id} className="advertiser-folder-card" onClick={()=>setParams({advertiser:advertiser.id})}><div className="advertiser-folder-head"><span style={{background:advertiser.color}}>{advertiser.initial}</span><div><b>{advertiser.name}</b><small>최근 수정 {rows.length?formatDate(rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0].updatedAt):'-'}</small></div><ChevronRight size={18}/></div><div className="advertiser-folder-stats"><span>이미지 <b>{rows.filter(a=>a.assetType==='image').length}</b></span><span>영상 <b>{rows.filter(a=>a.assetType==='video').length}</b></span><span>광고 소재 <b>{rows.filter(a=>a.assetType==='creative').length}</b></span><span>문서 <b>{rows.filter(a=>a.assetType==='document').length}</b></span></div><div className="advertiser-folder-total"><FolderOpen size={16}/><span>전체 {rows.length}개</span></div></button>)}</div></>;
}

export function AssetTrashPage(){
  const [assets,refresh]=useAssets(); const deleted=assets.filter(a=>a.deletedAt).sort((a,b)=>(b.deletedAt||'').localeCompare(a.deletedAt||'')); const [selected,setSelected]=useState<string[]>([]); const toggle=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  return <><PageHeader title="휴지통" description="삭제한 자산을 복원하거나 영구 삭제합니다. 서버 단계에서는 30일 자동 정리 정책으로 연결할 예정입니다."/>{selected.length>0&&<div className="asset-bulkbar"><b>{selected.length}개 선택</b><button onClick={()=>{restoreAssets(selected);setSelected([]);refresh();}}><RotateCcw size={15}/> 복원</button><button onClick={async()=>{if(confirm('선택한 자산을 영구 삭제할까요?')){await permanentlyDeleteAssets(selected);setSelected([]);refresh();}}}><Trash2 size={15}/> 영구 삭제</button></div>}<section className="card asset-list-wrap">{deleted.length?<table className="ops-table asset-list-table"><thead><tr><th/><th>이름</th><th>광고주</th><th>유형</th><th>삭제일</th><th>관리</th></tr></thead><tbody>{deleted.map(asset=><tr key={asset.assetId}><td><input type="checkbox" checked={selected.includes(asset.assetId)} onChange={()=>toggle(asset.assetId)}/></td><td>{asset.name}</td><td>{asset.advertiserName||'공통 자산'}</td><td>{TYPE_LABELS[asset.assetType]}</td><td>{formatDate(asset.deletedAt)}</td><td><div className="action-row compact"><button className="btn secondary" onClick={()=>{restoreAssets([asset.assetId]);refresh();}}><RotateCcw size={14}/> 복원</button><button className="btn danger" onClick={async()=>{if(confirm('영구 삭제할까요?')){await permanentlyDeleteAssets([asset.assetId]);refresh();}}}><Trash2 size={14}/> 삭제</button></div></td></tr>)}</tbody></table>:<div className="asset-empty"><Trash2 size={38}/><h3>휴지통이 비어 있습니다.</h3></div>}</section></>;
}

/** 광고주별 로고·브랜드 컬러·톤·문구 규칙을 관리합니다. 파일(로고 등)은 기존 Asset 인덱스를
 * assetType='brand'로 그대로 재사용하고(AssetBrowser 재사용), 색상·톤·문구 같은 구조화된
 * 규칙만 별도의 작은 브랜드 프로필 저장소에 둡니다. */
export function BrandAssetsPage(){
  const [advertisers]=useAdvertisers();
  const [params,setParams]=useSearchParams();
  const advertiserId=params.get('advertiser')||'';
  const advertiser=advertisers.find(a=>a.id===advertiserId);
  const [profile,setProfile]=useState<BrandProfile>(()=>advertiserId?loadBrandProfile(advertiserId):{advertiserId:'',keyPhrases:[],prohibitedPhrases:[],updatedAt:''});
  const [saved,setSaved]=useState(false);
  useEffect(()=>{ setProfile(advertiserId?loadBrandProfile(advertiserId):{advertiserId:'',keyPhrases:[],prohibitedPhrases:[],updatedAt:''}); setSaved(false); },[advertiserId]);

  if(!advertiserId){
    return <><PageHeader title="브랜드·로고 자료" description="광고주별 로고, 브랜드 컬러, 톤앤매너, 문구 규칙을 관리합니다."/>
      <div className="asset-folder-grid">{advertisers.filter(a=>a.id!=='default').map(a=>{const p=loadBrandProfile(a.id);return <button key={a.id} className="advertiser-folder-card" onClick={()=>setParams({advertiser:a.id})}>
        <div className="advertiser-folder-head"><span style={{background:a.color}}>{a.initial}</span><div><b>{a.name}</b><small>{p.updatedAt?`브랜드 규칙 등록됨 · ${formatDate(p.updatedAt)}`:'브랜드 규칙 미등록'}</small></div><ChevronRight size={18}/></div>
      </button>;})}</div>
    </>;
  }

  function save(){ setProfile(saveBrandProfile(profile)); setSaved(true); setTimeout(()=>setSaved(false),2000); }
  function patch<K extends keyof BrandProfile>(key:K,value:BrandProfile[K]){ setProfile(prev=>({...prev,[key]:value})); }

  return <><PageHeader title={`${advertiser?.name||''} · 브랜드 자료`} description="로고·브랜드 컬러·톤앤매너·문구 규칙을 등록하면 콘텐츠 제작 시 참고 자료로 활용할 수 있습니다." action={<button className="btn secondary" onClick={()=>setParams({})}>광고주 목록</button>}/>
    <section className="card content-section">
      <div className="content-section-head"><div><span>01</span><h3>브랜드 규칙</h3></div><small>광고 문구·블로그 작성 시 참고 기준이 됩니다.</small></div>
      <div className="content-form-grid">
        <label>대표 컬러<input type="text" value={profile.primaryColor||''} onChange={e=>patch('primaryColor',e.target.value)} placeholder="#1D4ED8 또는 색상명"/></label>
        <label>보조 컬러<input type="text" value={profile.secondaryColor||''} onChange={e=>patch('secondaryColor',e.target.value)} placeholder="#F59E0B 또는 색상명"/></label>
        <label>브랜드 폰트<input value={profile.fontName||''} onChange={e=>patch('fontName',e.target.value)} placeholder="예: Pretendard"/></label>
        <label>브랜드 태그라인<input value={profile.tagline||''} onChange={e=>patch('tagline',e.target.value)}/></label>
        <label className="span2">톤앤매너<textarea rows={2} value={profile.toneDescription||''} onChange={e=>patch('toneDescription',e.target.value)} placeholder="예: 신뢰감 있고 담백한 정보 전달형, 과장 표현 지양"/></label>
        <label className="span2">필수·선호 문구(쉼표로 구분)<input value={profile.keyPhrases.join(', ')} onChange={e=>patch('keyPhrases',e.target.value.split(',').map(x=>x.trim()).filter(Boolean))}/></label>
        <label className="span2">금지 문구(쉼표로 구분)<input value={profile.prohibitedPhrases.join(', ')} onChange={e=>patch('prohibitedPhrases',e.target.value.split(',').map(x=>x.trim()).filter(Boolean))}/></label>
      </div>
      <div className="content-final-actions">{saved&&<span className="content-status good" style={{marginRight:'auto'}}>저장됨</span>}<button className="btn primary" onClick={save}><Check size={15}/> 브랜드 규칙 저장</button></div>
    </section>
    <section className="card content-section">
      <div className="content-section-head"><div><span>02</span><h3>로고·브랜드 파일</h3></div><small>로고, 브랜드 가이드 PDF 등을 업로드하면 이 광고주의 브랜드 자료로 분류됩니다.</small></div>
      <BrandFileBrowser advertiserId={advertiserId}/>
    </section>
  </>;
}

/** AssetBrowser는 업로드 시 파일 MIME 기준으로 assetType을 자동 분류하므로, 여기서는
 * 업로드 직후 방금 등록된 파일들을 assetType='brand'로 재지정해 "브랜드 자료" 전용
 * 목록에 정확히 모이게 합니다(여러 파일을 한 번에 올려도 전부 반영됩니다). */
function BrandFileBrowser({advertiserId}:{advertiserId:string}){
  const [,refresh]=useAssets();
  const [upload,setUpload]=useState(false);
  function reclassifyRecentUploads(){
    const cutoff=Date.now()-10_000; // 방금 업로드 흐름에서 막 생성된 것만(10초 이내) 대상으로 합니다.
    const justUploaded=loadAssets(true).filter(a=>a.advertiserId===advertiserId&&a.assetType!=='brand'&&new Date(a.createdAt).getTime()>=cutoff);
    justUploaded.forEach(a=>patchAsset(a.assetId,{assetType:'brand'}));
    refresh();
  }
  return <>
    <div className="content-final-actions" style={{justifyContent:'flex-start',marginTop:0,marginBottom:14}}><button className="btn secondary" onClick={()=>setUpload(true)}><Upload size={15}/> 브랜드 파일 업로드</button></div>
    <AssetBrowser fixedType="brand" advertiserId={advertiserId} title="" description=""/>
    {upload&&<UploadModal defaultAdvertiserId={advertiserId} onClose={()=>setUpload(false)} onDone={reclassifyRecentUploads}/>}
  </>;
}
