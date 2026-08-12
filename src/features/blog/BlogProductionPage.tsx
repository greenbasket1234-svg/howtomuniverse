import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  AlertTriangle, Archive, CalendarDays, Check, ChevronLeft, ClipboardCopy, ExternalLink, FileDown, FileText,
  Image as ImageIcon, Link2, Lock, Plus, RefreshCw, Save, Search, Settings2, ShieldCheck, Sparkles, Trash2, Unlock, Wand2
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAdvertisers } from '../../hooks/useAdvertisers';
import { blogApi } from './blogApi';
import { analyzeBlogSeo } from './blogSeoEngine';
import { analyzeCompliance, isMedicalIndustry } from './complianceEngine';
import type { BlogAsset, BlogBlock, BlogBlockType, BlogProject, BlogStyleProfile } from './blogTypes';
import { frontendBlogProviderAdapter, getAdvertiserBlogIntegration, upsertBlogIntegration, type BlogIntegration, type BlogIntegrationMode } from '../../utils/blogIntegrationStore';

const INDUSTRIES=['일반 서비스업','병원·의료기관','치과','한의원','동물병원','세무사·세무법인','학원·교육','자동차·렌트·리스','식품·쇼핑몰','부동산','법률'];
const STATUS_LABEL:Record<string,string>={draft:'초안',writing:'작성 중',review:'검토 요청',revision:'수정 필요',approved:'승인 완료','publish-ready':'발행 대기',published:'발행 완료',archived:'보관'};
const REVIEW_LABEL:Record<string,string>={'not-reviewed':'검토 전','check-needed':'확인 필요',preparing:'심의 준비',submitted:'심의 중','revision-requested':'수정 요청',approved:'심의 완료','not-required':'심의 불필요 확인'};
const BLOCK_LABEL:Record<BlogBlockType,string>={paragraph:'본문',h2:'소제목',h3:'소제목 2',image:'사진',list:'목록',quote:'인용문',faq:'FAQ',cta:'CTA',divider:'구분선'};
const uid=(p:string)=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const emptyStyle=(advertiserId:string):BlogStyleProfile=>({advertiserId,tone:'',rules:[],preferredPhrases:[],prohibitedPhrases:[],cta:'',sourceTexts:[]});
const split=(value:string)=>value.split(/[,\n]/).map(x=>x.trim()).filter(Boolean);
const fmt=(value:string)=>new Date(value).toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

function statusTone(status:string){return status==='published'||status==='approved'?'success':status==='revision'?'danger':status==='review'||status==='publish-ready'?'warning':'neutral'}

export function BlogProductionPage(){
  const [advertisers]=useAdvertisers();
  const [params,setParams]=useSearchParams();
  const projectId=params.get('project')||'';
  const [projects,setProjects]=useState<BlogProject[]>([]);
  const [project,setProject]=useState<BlogProject|null>(null);
  const [loading,setLoading]=useState(true);
  const [notice,setNotice]=useState('');
  const [query,setQuery]=useState('');
  const [selectedAdvertiser,setSelectedAdvertiser]=useState('');
  const [style,setStyle]=useState<BlogStyleProfile|null>(null);
  const [assets,setAssets]=useState<BlogAsset[]>([]);
  const [activeSide,setActiveSide]=useState<'seo'|'compliance'|'photos'|'advertiser'>('seo');
  const [styleOpen,setStyleOpen]=useState(false);
  const [assetOpen,setAssetOpen]=useState(false);
  const [integrationOpen,setIntegrationOpen]=useState(false);
  const [apiSendOpen,setApiSendOpen]=useState(false);
  const [aiStatus,setAiStatus]=useState<{configured:boolean;provider:string|null}|null>(null);
  const integration=project?getAdvertiserBlogIntegration(project.advertiserId):undefined;
  const buildHtml=(p:BlogProject)=>`<!doctype html><html lang="ko"><meta charset="utf-8"><title>${p.selectedTitle}</title><body><h1>${p.selectedTitle}</h1>${p.blocks.map(b=>b.type==='h2'?`<h2>${b.title||''}</h2><p>${b.text||''}</p>`:b.type==='h3'?`<h3>${b.title||''}</h3><p>${b.text||''}</p>`:b.type==='divider'?'<hr>':`<section><strong>${b.title||''}</strong><p>${(b.text||'').replace(/\n/g,'<br>')}</p></section>`).join('')}</body></html>`;
  const sendExternal=async(credentials?:{username:string;appPassword:string})=>{
    if(!project||!integration)return;
    if(integration.mode==='api'&&!credentials){setApiSendOpen(true);return;}
    const result=await frontendBlogProviderAdapter.createDraft(project.projectId,integration,{title:project.selectedTitle||project.primaryKeyword,contentHtml:buildHtml(project)},credentials);
    setNotice(result.message);setApiSendOpen(false);
    if(result.url){await patch({publishedUrl:result.url,status:'publish-ready'});window.open(result.url,'_blank','noopener,noreferrer');}
    if((integration.mode==='external-link'||integration.mode==='sso')&&integration.externalSiteUrl)window.open(integration.externalSiteUrl,'_blank','noopener,noreferrer');
  };

  const reload=async()=>{
    setLoading(true);
    try{
      const [ps,assetRows]=await Promise.all([blogApi.projects(),blogApi.assets()]); setProjects(ps);setAssets(assetRows);
      if(projectId){const p=ps.find(x=>x.projectId===projectId)||await blogApi.getProject(projectId);setProject(p);setSelectedAdvertiser(p.advertiserId);}else setProject(null);
    }catch(e){setNotice(e instanceof Error?e.message:'블로그 데이터를 불러오지 못했습니다.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void reload();},[projectId]);
  useEffect(()=>{void blogApi.aiStatus().then(setAiStatus).catch(()=>setAiStatus({configured:false,provider:null}));},[]);
  useEffect(()=>{if(!selectedAdvertiser)return;void blogApi.style(selectedAdvertiser).then(setStyle).catch(()=>setStyle(emptyStyle(selectedAdvertiser)));},[selectedAdvertiser]);

  const filtered=useMemo(()=>projects.filter(p=>(!query||`${p.selectedTitle} ${p.primaryKeyword} ${p.advertiserName}`.toLowerCase().includes(query.toLowerCase()))&&(!selectedAdvertiser||p.advertiserId===selectedAdvertiser)),[projects,query,selectedAdvertiser]);
  const seo=useMemo(()=>project?analyzeBlogSeo(project):null,[project]);
  const compliance=useMemo(()=>project?analyzeCompliance(project):[],[project]);
  const advertiserAssets=useMemo(()=>assets.filter(a=>a.advertiserId===(project?.advertiserId||selectedAdvertiser)),[assets,project?.advertiserId,selectedAdvertiser]);
  const advertiserInfo=useMemo(()=>advertisers.find(a=>a.id===(project?.advertiserId||selectedAdvertiser))||null,[advertisers,project?.advertiserId,selectedAdvertiser]);
  const suggestedAssets=useMemo(()=>{
    if(!project)return [];
    const keys=[project.primaryKeyword,...project.secondaryKeywords].filter(Boolean);
    return advertiserAssets.map(a=>({a,score:a.tags.reduce((n,t)=>n+(keys.some(k=>k.includes(t)||t.includes(k))?1:0),0)})).sort((x,y)=>y.score-x.score).slice(0,6).map(x=>x.a);
  },[advertiserAssets,project]);

  const create=async()=>{
    if(!selectedAdvertiser){setNotice('먼저 광고주를 등록하고 선택하세요.');return;}
    const adv=advertisers.find(a=>a.id===selectedAdvertiser); if(!adv)return;
    try{const row=await blogApi.createProject({advertiserId:adv.id,advertiserName:adv.name,industry:adv.industry||'일반 서비스업'});setParams({project:row.projectId});}
    catch(e){setNotice(e instanceof Error?e.message:'새 글을 만들지 못했습니다.');}
  };
  const patch=async(changes:Partial<BlogProject>&{unlockForRevision?:boolean})=>{
    if(!project)return;
    try{const next=await blogApi.patchProject(project.projectId,changes);setProject(next);setProjects(rows=>rows.map(x=>x.projectId===next.projectId?next:x));}
    catch(e){setNotice(e instanceof Error?e.message:'저장하지 못했습니다.');}
  };
  const patchLocal=(changes:Partial<BlogProject>)=>project&&setProject({...project,...changes});
  const save=async()=>{if(!project)return;const body=project.medicalReview.locked?{status:project.status,publishStatus:project.publishStatus,medicalReview:project.medicalReview,seoScore:project.seoScore,complianceStatus:project.complianceStatus,complianceIssues:project.complianceIssues}:project;await patch(body);setNotice('서버에 저장했습니다.');};
  const generate=async()=>{
    if(!project?.primaryKeyword){setNotice('메인 키워드를 먼저 입력하세요.');return;}
    try{
      const result=await blogApi.generate(project);const next={...project,titleOptions:result.titles,selectedTitle:result.titles[0]||'',blocks:result.blocks,status:'writing' as const};setProject(next);await blogApi.patchProject(project.projectId,next);
      const message=
        result.generator==='rule-based-fallback'?`외부 AI 호출에 실패해 규칙 기반 초안으로 대체했습니다. (${result.aiError||'알 수 없는 오류'})`
        :result.generator==='rule-based-backend'?'백엔드 규칙 기반 초안을 생성했습니다. BLOG_AI_PROVIDER를 설정하면 외부 AI가 대신 작성합니다.'
        :'외부 AI가 초안을 생성했습니다.';
      setNotice(message);
    }
    catch(e){setNotice(e instanceof Error?e.message:'초안 생성에 실패했습니다.');}
  };
  const runReview=async()=>{if(!project)return;const issues=analyzeCompliance(project);const score=analyzeBlogSeo(project).score;await patch({complianceIssues:issues,complianceStatus:issues.some(x=>x.severity==='danger')?'revision':'reviewed',seoScore:score,status:issues.some(x=>x.severity==='danger')?'revision':'review'});setNotice(`사전점검 완료: ${issues.length}개 확인 항목이 있습니다.`);};
  const addBlock=(type:BlogBlockType)=>patchLocal({blocks:[...project!.blocks,{blockId:uid('block'),type,title:type==='h2'?'새 소제목':type==='faq'?'자주 묻는 질문':type==='cta'?'안내':'',text:''}]});
  const updateBlock=(id:string,change:Partial<BlogBlock>)=>patchLocal({blocks:project!.blocks.map(b=>b.blockId===id?{...b,...change}:b)});
  const removeBlock=(id:string)=>patchLocal({blocks:project!.blocks.filter(b=>b.blockId!==id)});
  const attachAsset=(blockId:string,assetId:string)=>{updateBlock(blockId,{assetId});setActiveSide('photos');};
  const unlock=async()=>{if(!project)return;await patch({unlockForRevision:true,medicalReview:{...project.medicalReview,locked:false,status:'revision-requested'},status:'revision'});setNotice('문안 잠금을 해제하고 재검토 상태로 전환했습니다.');};
  const lockApproved=async()=>{if(!project)return;await patch({medicalReview:{...project.medicalReview,status:'approved',locked:true,reviewedAt:project.medicalReview.reviewedAt||new Date().toISOString()},status:'approved'});setNotice('심의 완료 문안을 잠갔습니다.');};
  const deleteProject=async(id:string)=>{const target=projects.find(x=>x.projectId===id);if(!window.confirm(`“${target?.selectedTitle||target?.primaryKeyword||'제목 미정'}” 글을 삭제할까요?`))return;try{await blogApi.deleteProject(id);setProjects(rows=>rows.filter(x=>x.projectId!==id));if(project?.projectId===id)setParams({});setNotice('블로그 글을 삭제했습니다.');}catch(e){setNotice(e instanceof Error?e.message:'삭제하지 못했습니다.');}};
  const exportFile=(kind:'html'|'txt')=>{if(!project)return;const body=project.blocks.map(b=>`${b.title||''}\n${b.text||''}`).join('\n\n');const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><title>${project.selectedTitle}</title><body><h1>${project.selectedTitle}</h1>${project.blocks.map(b=>b.type==='h2'?`<h2>${b.title}</h2><p>${b.text||''}</p>`:b.type==='h3'?`<h3>${b.title}</h3><p>${b.text||''}</p>`:b.type==='divider'?'<hr>':`<section><strong>${b.title||''}</strong><p>${(b.text||'').replace(/\n/g,'<br>')}</p></section>`).join('')}</body></html>`;const value=kind==='html'?html:`${project.selectedTitle}\n\n${body}`;const blob=new Blob([value],{type:kind==='html'?'text/html;charset=utf-8':'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${project.selectedTitle||'blog'}.${kind}`;a.click();URL.revokeObjectURL(url);};

  if(loading)return <div className="blog26-page"><PageHeader title="블로그 제작" description="서버 데이터를 불러오는 중입니다."/><div className="blog26-loading">불러오는 중…</div></div>;
  if(!project)return <BlogDashboard advertisers={advertisers} projects={filtered} allProjects={projects} selectedAdvertiser={selectedAdvertiser} setSelectedAdvertiser={setSelectedAdvertiser} query={query} setQuery={setQuery} onCreate={create} onOpen={id=>setParams({project:id})} onDelete={deleteProject} notice={notice}/>;

  const medical=isMedicalIndustry(project.industry);
  return <div className="blog26-page">
    <PageHeader title="블로그 제작" description="광고주 정보·문체·자산·SEO·업종별 규정 검수를 한 워크스페이스에서 관리합니다." action={<div className="blog26-head-actions"><button className="btn secondary" onClick={()=>setParams({})}><ChevronLeft size={15}/> 목록</button><button className="btn secondary" onClick={()=>exportFile('txt')}><FileDown size={15}/> TXT</button><button className="btn secondary" onClick={()=>exportFile('html')}><FileDown size={15}/> HTML</button><button className="btn secondary" onClick={()=>setIntegrationOpen(true)}><Link2 size={15}/> 외부 연동</button>{integration&&<button className="btn secondary" onClick={()=>void sendExternal()}><ExternalLink size={15}/> 외부 업체로 보내기</button>}<button className="btn primary" onClick={()=>void save()}><Save size={15}/> 서버 저장</button></div>}/>
    {notice&&<div className="blog26-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
    {project.medicalReview.locked&&<div className="blog26-lockbar"><Lock size={16}/><b>심의 완료 문안 잠금</b><span>제목과 본문이 잠겨 있습니다. 수정하려면 재검토 상태로 전환하세요.</span><button className="btn secondary" onClick={()=>void unlock()}><Unlock size={14}/> 재검토로 전환</button></div>}
    <div className="blog26-workspace">
      <aside className="blog26-setup card">
        <div className="blog26-panel-title"><div><small>STEP 1</small><h3>제작 설정</h3></div><button className="icon-btn" onClick={()=>setStyleOpen(true)} title="문체 설정"><Wand2 size={16}/></button></div>
        <label>광고주<select value={project.advertiserId} disabled><option>{project.advertiserName}</option></select></label>
        <label>플랫폼<select value={project.platform} onChange={e=>patchLocal({platform:e.target.value})} disabled={project.medicalReview.locked}><option>네이버 블로그</option><option>자사 블로그</option><option>기타</option></select></label>
        <label>업종<select value={project.industry} onChange={e=>patchLocal({industry:e.target.value,options:{...project.options,medical:isMedicalIndustry(e.target.value)}})} disabled={project.medicalReview.locked}>{INDUSTRIES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>콘텐츠 유형<select value={project.contentType} onChange={e=>patchLocal({contentType:e.target.value})} disabled={project.medicalReview.locked}>{['정보형 블로그','검색 유입형','상담 유도형','브랜드형','FAQ형'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>메인 키워드<input value={project.primaryKeyword} onChange={e=>patchLocal({primaryKeyword:e.target.value})} placeholder="핵심 키워드" disabled={project.medicalReview.locked}/></label>
        <label>서브 키워드<input value={project.secondaryKeywords.join(', ')} onChange={e=>patchLocal({secondaryKeywords:split(e.target.value)})} placeholder="쉼표로 구분" disabled={project.medicalReview.locked}/></label>
        <label>지역<input value={project.region} onChange={e=>patchLocal({region:e.target.value})} placeholder="선택 사항" disabled={project.medicalReview.locked}/></label>
        <div className="blog26-label">글 목적</div><div className="blog26-choice-row">{['정보 제공','검색 유입','상담 유도'].map(x=><button type="button" key={x} className={project.purpose===x?'active':''} onClick={()=>patchLocal({purpose:x})} disabled={project.medicalReview.locked}>{x}</button>)}</div>
        <label>목표 글자수<select value={project.targetLength} onChange={e=>patchLocal({targetLength:Number(e.target.value)})} disabled={project.medicalReview.locked}><option value={1200}>짧게 · 1,200자</option><option value={2000}>일반 · 2,000자</option><option value={3000}>상세 · 3,000자</option></select></label>
        <label>발행 예정일<input type="date" value={project.scheduledAt?.slice(0,10)||''} onChange={e=>patchLocal({scheduledAt:e.target.value})}/></label>
        <label>톤앤매너<select value={project.tone} onChange={e=>patchLocal({tone:e.target.value})} disabled={project.medicalReview.locked}><option>광고주 문체 자동 적용</option><option>친절한 전문가형</option><option>정보 중심형</option><option>부드러운 상담형</option><option>간결한 실무형</option></select></label>
        <label>참고자료<textarea rows={4} value={project.referenceText} onChange={e=>patchLocal({referenceText:e.target.value})} placeholder="광고주가 제공한 핵심 정보나 반드시 반영할 내용을 입력하세요." disabled={project.medicalReview.locked}/></label>
        <div className="blog26-options">
          <label><input type="checkbox" checked={project.options.style} onChange={e=>patchLocal({options:{...project.options,style:e.target.checked}})}/> 기존 문체 반영</label>
          <label><input type="checkbox" checked={project.options.advertiserInfo} onChange={e=>patchLocal({options:{...project.options,advertiserInfo:e.target.checked}})}/> 광고주 정보 반영</label>
          <label><input type="checkbox" checked={project.options.photos} onChange={e=>patchLocal({options:{...project.options,photos:e.target.checked}})}/> 사진 추천 포함</label>
          <label><input type="checkbox" checked={project.options.compliance} onChange={e=>patchLocal({options:{...project.options,compliance:e.target.checked}})}/> 업종별 규정 검수</label>
          <label><input type="checkbox" checked={project.options.seo} onChange={e=>patchLocal({options:{...project.options,seo:e.target.checked}})}/> SEO 사전점검</label>
          {medical&&<label className="medical"><input type="checkbox" checked={project.options.medical} onChange={e=>patchLocal({options:{...project.options,medical:e.target.checked}})}/> 의료광고 사전점검</label>}
        </div>
        <button className="btn primary wide" onClick={()=>void generate()} disabled={project.medicalReview.locked}><Sparkles size={16}/> 초안 만들기</button>
        <small className="blog26-help">{aiStatus?.configured?`외부 AI(${aiStatus.provider})가 초안을 작성합니다.`:'외부 AI가 아직 연결되지 않아 서버 규칙 기반 초안을 생성합니다. BLOG_AI_PROVIDER 환경변수를 설정하면 화면 변경 없이 외부 AI로 교체됩니다.'}</small>
      </aside>

      <main className="blog26-editor card">
        <div className="blog26-panel-title"><div><small>STEP 2</small><h3>초안·편집</h3></div><div className={`blog26-status ${statusTone(project.status)}`}>{STATUS_LABEL[project.status]||project.status}</div></div>
        <div className="blog26-workflow-row"><label>콘텐츠 상태<select value={project.status} onChange={e=>patchLocal({status:e.target.value as BlogProject['status']})}>{Object.entries(STATUS_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>발행 URL<input value={project.publishedUrl||''} onChange={e=>patchLocal({publishedUrl:e.target.value})} placeholder="발행 후 URL 입력 (선택)"/></label></div>
        <section className="blog26-title-section"><label>최종 제목<input value={project.selectedTitle} onChange={e=>patchLocal({selectedTitle:e.target.value})} placeholder="제목을 입력하거나 초안을 생성하세요." disabled={project.medicalReview.locked}/></label>{project.titleOptions.length>0&&<div className="blog26-title-options">{project.titleOptions.map((title,i)=><button key={`${title}-${i}`} type="button" className={project.selectedTitle===title?'active':''} onClick={()=>patchLocal({selectedTitle:title})} disabled={project.medicalReview.locked}>{title}</button>)}</div>}</section>
        <div className="blog26-editor-toolbar"><b>본문 블록</b><div>{(['paragraph','h2','h3','image','list','quote','faq','cta','divider'] as BlogBlockType[]).map(type=><button key={type} type="button" onClick={()=>addBlock(type)} disabled={project.medicalReview.locked}>+ {BLOCK_LABEL[type]}</button>)}</div></div>
        <div className="blog26-blocks">{project.blocks.length===0&&<div className="blog26-editor-empty"><FileText size={28}/><b>아직 본문이 없습니다.</b><span>왼쪽에서 키워드를 입력하고 초안을 만들거나 블록을 직접 추가하세요.</span></div>}{project.blocks.map(block=><article key={block.blockId} id={`blog-block-${block.blockId}`} className={`blog26-block type-${block.type}`}>
          <header><span>{BLOCK_LABEL[block.type]}</span>{!project.medicalReview.locked&&<button className="icon-btn danger" onClick={()=>removeBlock(block.blockId)}><Trash2 size={14}/></button>}</header>
          {block.type==='divider'?<hr/>:<>{block.type==='image'&&<div className="blog26-image-block">{block.assetId?(()=>{const a=assets.find(x=>x.assetId===block.assetId);return <><ImageIcon size={24}/><b>{a?.name||block.assetId}</b><span>{a?.url||'서버 자산'}</span></>})():<><ImageIcon size={24}/><span>사진을 연결하세요.</span></>}<button className="btn secondary" onClick={()=>{setActiveSide('photos');setAssetOpen(true)}} disabled={project.medicalReview.locked}>사진 선택</button></div>}<input value={block.title||''} onChange={e=>updateBlock(block.blockId,{title:e.target.value})} placeholder="블록 제목" disabled={project.medicalReview.locked}/>{block.type!=='image'&&<textarea rows={block.type==='paragraph'?7:4} value={block.text||''} onChange={e=>updateBlock(block.blockId,{text:e.target.value})} placeholder="내용을 입력하세요." disabled={project.medicalReview.locked}/>}</>}
        </article>)}</div>
        <div className="blog26-editor-actions"><button className="btn secondary" onClick={()=>navigator.clipboard.writeText(`${project.selectedTitle}\n\n${project.blocks.map(b=>`${b.title||''}\n${b.text||''}`).join('\n\n')}`)}><ClipboardCopy size={15}/> 전체 복사</button><button className="btn secondary" onClick={()=>void runReview()}><ShieldCheck size={15}/> 사전점검 실행</button><button className="btn primary" onClick={()=>void save()}><Save size={15}/> 저장</button></div>
      </main>

      <aside className="blog26-review card">
        <div className="blog26-side-tabs"><button className={activeSide==='seo'?'active':''} onClick={()=>setActiveSide('seo')}>SEO</button><button className={activeSide==='compliance'?'active':''} onClick={()=>setActiveSide('compliance')}>규정검수</button><button className={activeSide==='photos'?'active':''} onClick={()=>setActiveSide('photos')}>사진</button><button className={activeSide==='advertiser'?'active':''} onClick={()=>setActiveSide('advertiser')}>광고주</button></div>
        {activeSide==='seo'&&<SeoPanel seo={seo}/>} 
        {activeSide==='compliance'&&<CompliancePanel project={project} issues={compliance} onPatch={patch} onLock={lockApproved} onUnlock={unlock}/>} 
        {activeSide==='photos'&&<PhotoPanel assets={suggestedAssets} project={project} onAttach={attachAsset} onRegister={()=>setAssetOpen(true)}/>} 
        {activeSide==='advertiser'&&<AdvertiserPanel style={style} onEdit={()=>setStyleOpen(true)} project={project} advertiser={advertiserInfo}/>} 
      </aside>
    </div>
    {styleOpen&&style&&<StyleModal profile={style} onClose={()=>setStyleOpen(false)} onSave={async next=>{const saved=await blogApi.saveStyle(project.advertiserId,next);setStyle(saved);setStyleOpen(false);setNotice('광고주 문체 프로필을 서버에 저장했습니다.');}}/>}
    {assetOpen&&<AssetModal advertiserId={project.advertiserId} assets={advertiserAssets} imageBlocks={project.blocks.filter(b=>b.type==='image')} onClose={()=>setAssetOpen(false)} onAttach={(blockId,assetId)=>{attachAsset(blockId,assetId);setAssetOpen(false)}} onAdded={a=>setAssets(rows=>[a,...rows])}/>}
    {integrationOpen&&<BlogIntegrationModal advertiserId={project.advertiserId} onClose={()=>setIntegrationOpen(false)} onSaved={()=>{setIntegrationOpen(false);setNotice('블로그 연동 설정을 저장했습니다.');}}/>}
    {apiSendOpen&&integration&&<BlogApiSendModal integration={integration} onClose={()=>setApiSendOpen(false)} onSend={c=>void sendExternal(c)}/>}
  </div>;
}

function BlogDashboard({advertisers,projects,allProjects,selectedAdvertiser,setSelectedAdvertiser,query,setQuery,onCreate,onOpen,onDelete,notice}:{advertisers:ReturnType<typeof useAdvertisers>[0];projects:BlogProject[];allProjects:BlogProject[];selectedAdvertiser:string;setSelectedAdvertiser:(v:string)=>void;query:string;setQuery:(v:string)=>void;onCreate:()=>void;onOpen:(id:string)=>void;onDelete:(id:string)=>void;notice:string}){
  const counts={month:allProjects.filter(p=>new Date(p.createdAt).getMonth()===new Date().getMonth()).length,writing:allProjects.filter(p=>['draft','writing'].includes(p.status)).length,review:allProjects.filter(p=>p.status==='review'||p.status==='revision').length,published:allProjects.filter(p=>p.status==='published').length,warnings:allProjects.reduce((n,p)=>n+(p.complianceIssues?.filter(x=>x.severity!=='info').length||0),0)};
  return <div className="blog26-page"><PageHeader title="블로그 제작" description="광고주별 콘텐츠 제작부터 SEO·업종별 규정 검수·의료광고 심의 관리까지 한곳에서 진행합니다." action={<button className="btn primary" onClick={onCreate} disabled={!advertisers.length}><Plus size={15}/> 새 블로그 제작</button>}/>{notice&&<div className="blog26-notice">{notice}</div>}
    {!advertisers.length?<section className="card blog26-zero"><Sparkles size={36}/><h2>아직 등록된 광고주가 없습니다.</h2><p>HOWTOM 유니버스는 샘플 데이터 없이 시작합니다. 광고주를 먼저 등록하면 블로그 제작 워크스페이스를 사용할 수 있습니다.</p><Link className="btn primary" to="/advertisers"><Plus size={15}/> 첫 광고주 등록</Link></section>:<>
    <section className="blog26-kpis">{[['이번 달 제작',counts.month],['작성 중',counts.writing],['검토 필요',counts.review],['발행 완료',counts.published],['규정 경고',counts.warnings]].map(([label,value])=><article className="card" key={String(label)}><span>{label}</span><b>{value}</b></article>)}</section>
    <section className="card blog26-dashboard-toolbar"><div className="blog26-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="제목·키워드 검색"/></div><select value={selectedAdvertiser} onChange={e=>setSelectedAdvertiser(e.target.value)}><option value="">전체 광고주</option>{advertisers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><button className="btn primary" onClick={onCreate} disabled={!selectedAdvertiser}><Plus size={15}/> 새 글</button></section>
    <section className="card blog26-project-table"><div className="blog26-panel-title"><div><h3>저장한 글</h3><small>서버에 저장된 블로그 프로젝트</small></div></div>{projects.length?<div className="table-scroll"><table><thead><tr><th>제목</th><th>광고주</th><th>업종</th><th>키워드</th><th>검수</th><th>상태</th><th>수정일</th><th/></tr></thead><tbody>{projects.map(p=><tr key={p.projectId}><td><b>{p.selectedTitle||'제목 미정'}</b></td><td>{p.advertiserName}</td><td>{p.industry}</td><td>{p.primaryKeyword||'-'}</td><td><span className={`blog26-pill ${p.complianceIssues?.some(x=>x.severity==='danger')?'danger':p.complianceStatus==='reviewed'?'success':'neutral'}`}>{p.complianceStatus==='reviewed'?'검토완료':p.complianceIssues?.some(x=>x.severity==='danger')?'수정필요':'검토 전'}</span></td><td><span className={`blog26-pill ${statusTone(p.status)}`}>{STATUS_LABEL[p.status]||p.status}</span></td><td>{fmt(p.updatedAt)}</td><td><div className="action-row compact"><button className="btn secondary" onClick={()=>onOpen(p.projectId)}>열기</button><button className="icon-btn danger" title="삭제" onClick={()=>onDelete(p.projectId)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>:<div className="blog26-list-empty"><FileText size={30}/><b>아직 작성한 글이 없습니다.</b><span>새 블로그 제작을 눌러 첫 콘텐츠를 만들어보세요.</span></div>}</section>
    <section className="blog26-bottom-grid"><article className="card"><div className="blog26-panel-title"><div><h3>콘텐츠 캘린더</h3><small>발행 예정일 우선 · 미설정 시 생성일</small></div><CalendarDays size={18}/></div><BlogCalendar projects={allProjects} onOpen={onOpen}/></article><article className="card"><div className="blog26-panel-title"><div><h3>문체·자료</h3><small>광고주별 설정</small></div><Wand2 size={18}/></div><p className="blog26-muted">블로그 글을 연 뒤 광고주 문체 프로필, 선호 표현, 금지 표현, CTA, 참고 원문을 서버에 저장할 수 있습니다.</p><div className="blog26-resource-summary"><span>등록 광고주 <b>{advertisers.length}</b></span><span>저장 콘텐츠 <b>{allProjects.length}</b></span><span>의료 심의 관리 <b>{allProjects.filter(p=>isMedicalIndustry(p.industry)).length}</b></span></div></article></section></>}</div>;
}


function BlogCalendar({projects,onOpen}:{projects:BlogProject[];onOpen:(id:string)=>void}){
  const now=new Date(); const year=now.getFullYear(); const month=now.getMonth();
  const first=new Date(year,month,1).getDay(); const days=new Date(year,month+1,0).getDate();
  const byDay=new Map<number,BlogProject[]>();
  projects.forEach(p=>{const raw=p.scheduledAt||p.createdAt;if(!raw)return;const d=new Date(raw);if(Number.isNaN(d.getTime())||d.getFullYear()!==year||d.getMonth()!==month)return;const day=d.getDate();byDay.set(day,[...(byDay.get(day)||[]),p]);});
  const cells=[...Array(first).fill(null),...Array.from({length:days},(_,i)=>i+1)];
  return <div className="blog26-mini-calendar"><div className="blog26-calendar-head"><b>{year}년 {month+1}월</b><span>일 월 화 수 목 금 토</span></div><div className="blog26-calendar-grid">{cells.map((day,i)=>day===null?<div key={`blank-${i}`} className="blank"/>:<div key={day} className="day"><strong>{day}</strong><div>{(byDay.get(day)||[]).slice(0,3).map(p=><button key={p.projectId} onClick={()=>onOpen(p.projectId)} title={p.selectedTitle||p.primaryKeyword||'제목 미정'}>{p.advertiserName} · {p.selectedTitle||p.primaryKeyword||'제목 미정'}</button>)}</div></div>)}</div>{projects.length===0&&<div className="blog26-calendar-empty">표시할 콘텐츠 일정이 없습니다.</div>}</div>;
}

function SeoPanel({seo}:{seo:ReturnType<typeof analyzeBlogSeo>|null}){return <section className="blog26-side-section"><div className="blog26-score"><strong>{seo?.score||0}</strong><span>/100</span></div><p className="blog26-muted">검색 순위 예측이 아닌 HOWTOM 내부 작성 기준 충족도입니다.</p><div className="blog26-check-list">{seo?.checks.map(c=><div key={c.label} className={c.ok?'ok':''}><span>{c.ok?'✓':'○'}</span><b>{c.label}</b></div>)}</div><div className="blog26-mini-stat"><span>본문 길이</span><b>{seo?.length.toLocaleString()||0}자</b></div><div className="blog26-mini-stat"><span>키워드 반복</span><b>{seo?.keywordCount||0}회</b></div></section>}
function CompliancePanel({project,issues,onPatch,onLock,onUnlock}:{project:BlogProject;issues:ReturnType<typeof analyzeCompliance>;onPatch:(p:Partial<BlogProject>&{unlockForRevision?:boolean})=>Promise<void>;onLock:()=>Promise<void>;onUnlock:()=>Promise<void>}){
  const medical=isMedicalIndustry(project.industry);
  return <section className="blog26-side-section"><div className="blog26-compliance-summary"><ShieldCheck size={22}/><div><b>업종별 사전점검</b><span>{issues.filter(x=>x.severity==='danger').length}개 위험 · {issues.filter(x=>x.severity==='warning').length}개 주의 · {issues.filter(x=>x.severity==='info').length}개 확인</span></div></div><p className="blog26-muted">법률 자문이나 공식 심의를 대체하지 않는 내부 사전점검입니다.</p><div className="blog26-issue-list">{issues.map(issue=><button key={issue.id} className={`blog26-issue ${issue.severity}`} onClick={()=>issue.blockId&&document.getElementById(`blog-block-${issue.blockId}`)?.scrollIntoView({behavior:'smooth',block:'center'})}><span>{issue.category}</span><b>{issue.phrase}</b><small>{issue.reason}</small><em>{issue.suggestion}</em></button>)}{!issues.length&&<div className="blog26-clean"><Check size={18}/> 현재 규칙에서 감지된 위험 표현이 없습니다.</div>}</div>{medical&&<div className="blog26-medical-box"><h4>의료광고 심의 관리</h4><label>사전심의 대상 여부<select value={project.medicalReview.required===true?'yes':project.medicalReview.required===false?'no':'unknown'} onChange={e=>onPatch({medicalReview:{...project.medicalReview,required:e.target.value==='yes'?true:e.target.value==='no'?false:null,status:e.target.value==='no'?'not-required':'check-needed'}})}><option value="unknown">담당자 확인 필요</option><option value="yes">심의 대상 확인</option><option value="no">심의 불필요 확인</option></select></label><label>심의 상태<select value={project.medicalReview.status} onChange={e=>onPatch({medicalReview:{...project.medicalReview,status:e.target.value as BlogProject['medicalReview']['status']}})}>{Object.entries(REVIEW_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>심의필번호<input value={project.medicalReview.reviewNumber} onChange={e=>onPatch({medicalReview:{...project.medicalReview,reviewNumber:e.target.value}})} placeholder="심의 완료 후 입력"/></label><label>심의 완료일<input type="date" value={project.medicalReview.reviewedAt?.slice(0,10)||''} onChange={e=>onPatch({medicalReview:{...project.medicalReview,reviewedAt:e.target.value}})}/></label>{project.medicalReview.locked?<button className="btn secondary wide" onClick={()=>void onUnlock()}><Unlock size={14}/> 문안 잠금 해제·재검토</button>:<button className="btn primary wide" disabled={project.medicalReview.status!=='approved'||!project.medicalReview.reviewNumber} onClick={()=>void onLock()}><Lock size={14}/> 심의 완료 문안 잠금</button>}<small>심의받은 문안의 무단 변경을 막기 위한 내부 관리 기능입니다.</small></div>}</section>
}
function PhotoPanel({assets,project,onAttach,onRegister}:{assets:BlogAsset[];project:BlogProject;onAttach:(blockId:string,assetId:string)=>void;onRegister:()=>void}){const imageBlocks=project.blocks.filter(b=>b.type==='image');return <section className="blog26-side-section"><div className="blog26-side-head"><div><b>추천 사진</b><span>광고주 자산 태그와 키워드 기준</span></div><button className="btn secondary mini" onClick={onRegister}><Plus size={13}/> 자산 등록</button></div>{!imageBlocks.length&&<div className="blog26-clean">본문에 사진 블록을 먼저 추가하세요.</div>}<div className="blog26-photo-list">{assets.map(a=><article key={a.assetId}><div className="blog26-photo-thumb">{a.url?<img src={a.url} alt=""/>:<ImageIcon size={22}/>}</div><div><b>{a.name}</b><small>{a.tags.join(', ')||'태그 없음'}</small></div>{imageBlocks.length>0&&<select defaultValue="" onChange={e=>e.target.value&&onAttach(e.target.value,a.assetId)}><option value="">사진 위치 선택</option>{imageBlocks.map((b,i)=><option key={b.blockId} value={b.blockId}>사진 위치 {i+1}</option>)}</select>}</article>)}{!assets.length&&<div className="blog26-list-empty small"><ImageIcon size={24}/><b>등록된 사진 자산이 없습니다.</b><span>실제 광고주 사진을 등록하면 여기에서 추천합니다.</span></div>}</div></section>}
function AdvertiserPanel({style,onEdit,project,advertiser}:{style:BlogStyleProfile|null;onEdit:()=>void;project:BlogProject;advertiser:ReturnType<typeof useAdvertisers>[0][number]|null}){return <section className="blog26-side-section"><div className="blog26-side-head"><div><b>광고주 정보·문체</b><span>{project.advertiserName}</span></div><button className="btn secondary mini" onClick={onEdit}>문체 편집</button></div><div className="blog26-info-list"><div><span>업종</span><b>{advertiser?.industry||project.industry||'미설정'}</b></div><div><span>전화번호</span><b>{advertiser?.phone||'미설정'}</b></div><div><span>주소</span><b>{advertiser?.address||'미설정'}</b></div><div><span>홈페이지</span><b>{advertiser?.website||'미설정'}</b></div><div><span>톤앤매너</span><b>{style?.tone||'미설정'}</b></div><div><span>문체 규칙</span><b>{style?.rules.length||0}개</b></div><div><span>선호 표현</span><b>{style?.preferredPhrases.length||0}개</b></div><div><span>금지 표현</span><b>{style?.prohibitedPhrases.length||0}개</b></div><div><span>기본 CTA</span><b>{style?.cta||'미설정'}</b></div><div><span>학습 참고 원문</span><b>{style?.sourceTexts.length||0}개</b></div></div><p className="blog26-muted">광고주 기본 정보와 문체 프로필을 콘텐츠 생성·검수의 컨텍스트로 사용합니다.</p></section>}

function StyleModal({profile,onClose,onSave}:{profile:BlogStyleProfile;onClose:()=>void;onSave:(p:BlogStyleProfile)=>Promise<void>}){const [form,setForm]=useState(profile);return <div className="modal-backdrop" onClick={onClose}><div className="modal-card blog26-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>광고주 문체·자료</h3><p>광고주별 글쓰기 기준을 백엔드에 저장합니다.</p></div><button className="icon-btn" onClick={onClose}>×</button></div><div className="blog26-modal-form"><label>톤앤매너<input value={form.tone} onChange={e=>setForm({...form,tone:e.target.value})} placeholder="예: 친절한 전문가형"/></label><label>문체 규칙<textarea rows={4} value={form.rules.join('\n')} onChange={e=>setForm({...form,rules:split(e.target.value)})} placeholder="한 줄에 하나씩"/></label><label>선호 표현<textarea rows={3} value={form.preferredPhrases.join('\n')} onChange={e=>setForm({...form,preferredPhrases:split(e.target.value)})}/></label><label>사용하지 않을 표현<textarea rows={3} value={form.prohibitedPhrases.join('\n')} onChange={e=>setForm({...form,prohibitedPhrases:split(e.target.value)})}/></label><label>기본 CTA<input value={form.cta} onChange={e=>setForm({...form,cta:e.target.value})}/></label><label>기존 글/참고 원문<textarea rows={6} value={form.sourceTexts.join('\n\n---\n\n')} onChange={e=>setForm({...form,sourceTexts:e.target.value.split(/\n\s*---\s*\n/).map(x=>x.trim()).filter(Boolean)})} placeholder="기존 글을 붙여 넣고 글 사이를 --- 로 구분하세요."/></label></div><div className="modal-actions"><button className="btn secondary" onClick={onClose}>취소</button><button className="btn primary" onClick={()=>void onSave(form)}><Save size={14}/> 저장</button></div></div></div>}
function AssetModal({advertiserId,assets,imageBlocks,onClose,onAttach,onAdded}:{advertiserId:string;assets:BlogAsset[];imageBlocks:BlogBlock[];onClose:()=>void;onAttach:(blockId:string,assetId:string)=>void;onAdded:(a:BlogAsset)=>void}){const [name,setName]=useState('');const [url,setUrl]=useState('');const [tags,setTags]=useState('');const add=async(e:FormEvent)=>{e.preventDefault();const row=await blogApi.addAsset({advertiserId,name,url,tags:split(tags)});onAdded(row);setName('');setUrl('');setTags('')};return <div className="modal-backdrop" onClick={onClose}><div className="modal-card blog26-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>광고주 사진 자산</h3><p>현재 버전은 이미지 URL/이름/태그를 서버에 저장합니다.</p></div><button className="icon-btn" onClick={onClose}>×</button></div><form className="blog26-asset-form" onSubmit={add}><input value={name} onChange={e=>setName(e.target.value)} placeholder="파일/사진 이름" required/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="이미지 URL (선택)"/><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="태그: 진료실, 상담, 외관"/><button className="btn primary"><Plus size={14}/> 등록</button></form><div className="blog26-asset-picker">{assets.map(a=><article key={a.assetId}><div>{a.url?<img src={a.url} alt=""/>:<ImageIcon size={22}/>}</div><b>{a.name}</b><small>{a.tags.join(', ')}</small>{imageBlocks.length>0&&<select defaultValue="" onChange={e=>e.target.value&&onAttach(e.target.value,a.assetId)}><option value="">본문에 연결</option>{imageBlocks.map((b,i)=><option key={b.blockId} value={b.blockId}>사진 위치 {i+1}</option>)}</select>}</article>)}</div><div className="modal-actions"><button className="btn secondary" onClick={onClose}>닫기</button></div></div></div>}

function BlogIntegrationModal({advertiserId,onClose,onSaved}:{advertiserId:string;onClose:()=>void;onSaved:()=>void}){
  const current=getAdvertiserBlogIntegration(advertiserId); const [message,setMessage]=useState('');
  const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const row=upsertBlogIntegration({integrationId:current?.integrationId,advertiserId,provider:String(f.get('provider')||'external'),displayName:String(f.get('displayName')||'외부 블로그 업체'),connectionStatus:'not_connected',mode:String(f.get('mode')||'external-link') as BlogIntegrationMode,externalSiteUrl:String(f.get('externalSiteUrl')||'')||undefined,apiBaseUrl:String(f.get('apiBaseUrl')||'')||undefined,accountLabel:String(f.get('accountLabel')||'')||undefined,note:'Secret/API 키는 프론트에 저장하지 않음'});const test=await frontendBlogProviderAdapter.testConnection(row);upsertBlogIntegration({...row,connectionStatus:test.ok?'connected':'error',lastSyncAt:test.ok?new Date().toISOString():row.lastSyncAt});setMessage(test.message);setTimeout(onSaved,650);};
  return <div className="modal-backdrop" onClick={onClose}><form className="modal-card blog26-modal" onSubmit={submit} onClick={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h3>블로그 외부 업체 연동</h3><p>업체가 제공하는 방식에 맞게 연결 모드만 설정합니다. ID/PW·API Secret은 브라우저에 저장하지 않습니다.</p></div><button type="button" className="icon-btn" onClick={onClose}>×</button></div>
    <div className="blog26-modal-form">
      <label>표시 이름<input name="displayName" defaultValue={current?.displayName||''} required/></label>
      <label>업체 식별자<input name="provider" defaultValue={current?.provider||'wordpress'}/></label>
      <label>연동 방식<select name="mode" defaultValue={current?.mode||'external-link'}><option value="api">API (워드프레스)</option><option value="sso">SSO/로그인 연동</option><option value="external-link">외부 사이트 이동</option><option value="manual">수동 내보내기</option></select></label>
      <label>계정 표시명<input name="accountLabel" defaultValue={current?.accountLabel||''}/></label>
      <label>외부 사이트 URL<input name="externalSiteUrl" type="url" defaultValue={current?.externalSiteUrl||''} placeholder="https://..."/></label>
      <label>API 기본 URL<input name="apiBaseUrl" type="url" defaultValue={current?.apiBaseUrl||''} placeholder="워드프레스 사이트 주소"/></label>
    </div>
    <p className="blog26-muted">API 모드는 워드프레스 REST API 기준입니다. 사이트에서 Application Password 인증을 켜두어야 하고, 아이디·비밀번호는 실제 전송하는 순간에만 따로 입력받습니다(저장하지 않음).</p>
    {message&&<div className="blog26-notice">{message}</div>}
    <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>취소</button><button className="btn primary"><Save size={14}/> 저장 연동 확인</button></div>
  </form></div>;
}

function BlogApiSendModal({integration,onClose,onSend}:{integration:BlogIntegration;onClose:()=>void;onSend:(credentials:{username:string;appPassword:string})=>void}){
  const [username,setUsername]=useState(''); const [appPassword,setAppPassword]=useState(''); const [sending,setSending]=useState(false);
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!username.trim()||!appPassword.trim())return;setSending(true);onSend({username:username.trim(),appPassword:appPassword.trim()});};
  return <div className="modal-backdrop" onClick={onClose}><form className="modal-card blog26-modal" onSubmit={submit} onClick={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h3>{integration.displayName}로 전송</h3><p>워드프레스 REST API 기준입니다. 아이디와 Application Password는 이번 전송에만 사용되고 저장되지 않습니다.</p></div><button type="button" className="icon-btn" onClick={onClose}>×</button></div>
    <div className="blog26-modal-form">
      <label>워드프레스 사용자명<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="off" required/></label>
      <label>Application Password<input type="password" value={appPassword} onChange={e=>setAppPassword(e.target.value)} autoComplete="off" placeholder="워드프레스 프로필 > Application Passwords에서 발급" required/></label>
    </div>
    <div className="blog26-notice">전송 대상: {integration.apiBaseUrl || '(API 기본 URL 미설정)'}</div>
    <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>취소</button><button className="btn primary" disabled={sending}><ExternalLink size={15}/> {sending?'전송 중...':'전송'}</button></div>
  </form></div>;
}
