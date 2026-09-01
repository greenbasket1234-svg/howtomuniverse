import { loadAdvertisers } from '../data/advertisers';
import { CREATIVE_LIBRARY } from '../data/creativeLibrary';

export type ReferenceType = 'image' | 'video' | 'copy' | 'landing' | 'competitor' | 'other';
export type ReferenceItem = {
  referenceId: string;
  title: string;
  referenceType: ReferenceType;
  advertiserId?: string;
  advertiserName?: string;
  channel?: string;
  industry?: string;
  url?: string;
  assetId?: string;
  thumbnailUrl?: string;
  copyText?: string;
  hookTypes: string[];
  cta?: string;
  tags: string[];
  memo?: string;
  collectionIds?: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReferenceCollection = {
  collectionId: string;
  name: string;
  advertiserId?: string;
  createdAt: string;
  updatedAt: string;
};

export type TemplateType = 'ad-copy' | 'image-brief' | 'video-script' | 'blog' | 'document' | 'monthly-report' | 'proposal';
export type TemplateBlock = {
  blockId: string;
  label: string;
  blockType: 'text' | 'textarea' | 'select' | 'image' | 'metric' | 'section';
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
};
export type TemplateRule = {
  field: string;
  type: 'maxLength' | 'required' | 'recommended';
  value: string | number | boolean;
  message?: string;
};
export type ContentTemplate = {
  templateId: string;
  name: string;
  templateType: TemplateType;
  advertiserId?: string;
  advertiserName?: string;
  channel?: string;
  description?: string;
  blocks: TemplateBlock[];
  rules: TemplateRule[];
  tags: string[];
  version: number;
  parentTemplateId?: string;
  isFavorite: boolean;
  useCount: number;
  lastUsedAt?: string;
  sourceProjectId?: string;
  sourceCreativeId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CopyVariant = {
  variantId: string;
  label: string;
  angle?: string;
  headline: string;
  description: string;
  body: string;
  cta: string;
};

export type ContentProjectStatus = 'draft' | 'in-progress' | 'review' | 'revision' | 'approved' | 'completed' | 'live' | 'archived';
export type ContentProjectType = 'ad' | 'blog' | 'video-script' | 'document';
export type BlogBlockType = 'paragraph' | 'h2' | 'h3' | 'image' | 'quote' | 'list' | 'table' | 'faq' | 'cta' | 'divider';
export type BlogBlock = { blockId:string; type:BlogBlockType; title?:string; text?:string; assetId?:string; };
export type VideoScriptScene = { sceneId:string; order:number; startSecond:number; endSecond:number; purpose:'hook'|'problem'|'solution'|'benefit'|'proof'|'cta'|'other'; visual?:string; narration?:string; caption?:string; shot?:string; assetIds?:string[]; };
export type DocumentBlockType = 'paragraph'|'h1'|'h2'|'table'|'image'|'metric'|'checklist'|'quote'|'callout'|'divider';
export type DocumentBlock = { blockId:string; type:DocumentBlockType; title?:string; text?:string; metricKey?:string; dataMode?:'live'|'snapshot'; snapshotValue?:string; };
export type ContentProject = {
  projectType?: ContentProjectType;
  projectId: string;
  title: string;
  advertiserId: string;
  advertiserName: string;
  campaignId?: string;
  campaignName?: string;
  channel: string;
  objective: string;
  creativeType: string;
  representativeKpi?: string;
  target?: string;
  keyBenefit?: string;
  price?: string;
  mandatoryText?: string;
  prohibitedText?: string;
  landingUrl?: string;
  format?: string;
  templateId?: string;
  referenceIds: string[];
  sourceCreativeId?: string;
  sourceAssetId?: string;
  hookType?: string;
  hooks: string[];
  copyVariants: CopyVariant[];
  imagePlan?: {
    visualType?: string;
    subject?: string;
    background?: string;
    mainText?: string;
    subText?: string;
    ratio?: string;
    textRatio?: string;
  };
  videoPlan?: {
    length?: string;
    style?: string;
    hook3s?: string;
    scenes?: string;
    endingCta?: string;
  };
  blogData?: {
    purpose?: string;
    primaryKeyword?: string;
    secondaryKeywords?: string[];
    searchIntent?: string;
    region?: string;
    targetLength?: number;
    titleOptions?: string[];
    selectedTitle?: string;
    blocks?: BlogBlock[];
    seoScore?: number;
    publishStatus?: string;
    publishedUrl?: string;
    externalPublishId?: string;
  };
  videoScriptData?: {
    videoType?: string;
    targetSeconds?: number;
    ratio?: string;
    targetAudience?: string;
    keyMessage?: string;
    cta?: string;
    scenes?: VideoScriptScene[];
  };
  documentData?: {
    documentType?: string;
    blocks?: DocumentBlock[];
  };
  resultAssetIds: string[];
  status: ContentProjectStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

const REF_KEY = 'howtom-content-references-v1';
const COLLECTION_KEY = 'howtom-content-reference-collections-v1';
const TEMPLATE_KEY = 'howtom-content-templates-v1';
const PROJECT_KEY = 'howtom-content-projects-v1';
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function parse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function emit(name: string, detail: unknown) { window.dispatchEvent(new CustomEvent(name, { detail })); }

export function loadReferences() { const rows = parse<ReferenceItem[]>(REF_KEY, []); return Array.isArray(rows) ? rows : []; }
export function saveReferences(rows: ReferenceItem[]) { localStorage.setItem(REF_KEY, JSON.stringify(rows)); emit('howtom:content-references-changed', rows); }
export function upsertReference(row: ReferenceItem) {
  const rows = loadReferences();
  saveReferences(rows.some(x => x.referenceId === row.referenceId) ? rows.map(x => x.referenceId === row.referenceId ? row : x) : [row, ...rows]);
  return row;
}
export function createReference(input: Omit<ReferenceItem, 'referenceId' | 'favorite' | 'createdAt' | 'updatedAt'> & { favorite?: boolean }) {
  const stamp = now();
  return upsertReference({ ...input, referenceId: id('ref'), favorite: input.favorite ?? false, createdAt: stamp, updatedAt: stamp });
}
export function patchReference(referenceId: string, patch: Partial<ReferenceItem>) {
  const rows = loadReferences();
  const current = rows.find(x => x.referenceId === referenceId); if (!current) return null;
  const next = { ...current, ...patch, updatedAt: now() };
  saveReferences(rows.map(x => x.referenceId === referenceId ? next : x)); return next;
}
export function deleteReference(referenceId: string) { saveReferences(loadReferences().filter(x => x.referenceId !== referenceId)); }

export function loadReferenceCollections() { const rows = parse<ReferenceCollection[]>(COLLECTION_KEY, []); return Array.isArray(rows) ? rows : []; }
export function saveReferenceCollections(rows: ReferenceCollection[]) { localStorage.setItem(COLLECTION_KEY, JSON.stringify(rows)); emit('howtom:reference-collections-changed', rows); }
export function createReferenceCollection(name: string, advertiserId?: string) {
  const stamp = now(); const row: ReferenceCollection = { collectionId: id('refcol'), name, advertiserId, createdAt: stamp, updatedAt: stamp };
  saveReferenceCollections([row, ...loadReferenceCollections()]); return row;
}

function seedTemplates(): ContentTemplate[] { return []; }

export function loadTemplates() {
  const rows = parse<ContentTemplate[]>(TEMPLATE_KEY, []);
  return Array.isArray(rows) ? rows : [];
}
export function saveTemplates(rows: ContentTemplate[]) { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(rows)); emit('howtom:content-templates-changed', rows); }
export function createTemplate(input: Omit<ContentTemplate, 'templateId' | 'version' | 'isFavorite' | 'useCount' | 'createdAt' | 'updatedAt'> & Partial<Pick<ContentTemplate,'version'|'isFavorite'|'useCount'>>) {
  const stamp = now(); const row: ContentTemplate = { ...input, templateId:id('tpl'), version:input.version ?? 1, isFavorite:input.isFavorite ?? false, useCount:input.useCount ?? 0, createdAt:stamp, updatedAt:stamp };
  saveTemplates([row, ...loadTemplates()]); return row;
}
export function patchTemplate(templateId: string, patch: Partial<ContentTemplate>) {
  const rows=loadTemplates(); const current=rows.find(x=>x.templateId===templateId); if(!current)return null; const next={...current,...patch,updatedAt:now()}; saveTemplates(rows.map(x=>x.templateId===templateId?next:x)); return next;
}
export function useTemplate(templateId: string) {
  const t=loadTemplates().find(x=>x.templateId===templateId); if(!t)return null; return patchTemplate(templateId,{useCount:(t.useCount||0)+1,lastUsedAt:now()});
}
export function createTemplateVersion(templateId: string) {
  const rows=loadTemplates(); const current=rows.find(x=>x.templateId===templateId); if(!current)return null;
  const root=current.parentTemplateId||current.templateId; const related=rows.filter(x=>x.templateId===root||x.parentTemplateId===root); const version=Math.max(...related.map(x=>x.version||1))+1;
  return createTemplate({name:current.name,templateType:current.templateType,advertiserId:current.advertiserId,advertiserName:current.advertiserName,channel:current.channel,description:current.description,blocks:current.blocks.map(b=>({...b,blockId:id('block')})),rules:[...current.rules],tags:[...current.tags],parentTemplateId:root,version,isFavorite:current.isFavorite,useCount:0,sourceProjectId:current.sourceProjectId,sourceCreativeId:current.sourceCreativeId});
}
export function duplicateTemplate(templateId: string) {
  const current=loadTemplates().find(x=>x.templateId===templateId); if(!current)return null;
  return createTemplate({name:`${current.name} 복사본`,templateType:current.templateType,advertiserId:current.advertiserId,advertiserName:current.advertiserName,channel:current.channel,description:current.description,blocks:current.blocks.map(b=>({...b,blockId:id('block')})),rules:[...current.rules],tags:[...current.tags],sourceProjectId:current.sourceProjectId,sourceCreativeId:current.sourceCreativeId});
}
export function deleteTemplate(templateId: string) { saveTemplates(loadTemplates().filter(x=>x.templateId!==templateId)); }

export function loadProjects(includeDeleted = false) { const rows=parse<ContentProject[]>(PROJECT_KEY,[]); const all=Array.isArray(rows)?rows:[]; return includeDeleted?all:all.filter(x=>!x.deletedAt); }
export function saveProjects(rows: ContentProject[]) { localStorage.setItem(PROJECT_KEY,JSON.stringify(rows)); emit('howtom:content-projects-changed', rows); }
export function upsertProject(row: ContentProject) { const rows=loadProjects(true); saveProjects(rows.some(x=>x.projectId===row.projectId)?rows.map(x=>x.projectId===row.projectId?row:x):[row,...rows]); return row; }
export function createProject(input: Omit<ContentProject,'projectId'|'createdAt'|'updatedAt'>) { const stamp=now(); return upsertProject({...input,projectId:id('project'),createdAt:stamp,updatedAt:stamp}); }
export function patchProject(projectId:string,patch:Partial<ContentProject>){const rows=loadProjects(true);const current=rows.find(x=>x.projectId===projectId);if(!current)return null;const next={...current,...patch,updatedAt:now()};saveProjects(rows.map(x=>x.projectId===projectId?next:x));return next;}
export function cloneProject(projectId:string){const current=loadProjects(true).find(x=>x.projectId===projectId);if(!current)return null;const {projectId:_projectId,createdAt:_createdAt,updatedAt:_updatedAt,deletedAt:_deletedAt,...rest}=current;return createProject({...rest,title:`${current.title} 복제`,status:'draft',resultAssetIds:[]});}
// 예전엔 즉시 영구 삭제였습니다. 실수로 지운 제작물을 되살릴 방법이 없어서, 이제는
// 휴지통으로 보내고(deletedAt 표시) 복원하거나(restoreProject) 휴지통에서 영구
// 삭제(permanentlyDeleteProject)할 수 있게 분리했습니다.
export function deleteProject(projectId:string){const rows=loadProjects(true);saveProjects(rows.map(x=>x.projectId===projectId?{...x,deletedAt:now(),updatedAt:now()}:x));}
export function restoreProject(projectId:string){const rows=loadProjects(true);saveProjects(rows.map(x=>x.projectId===projectId?{...x,deletedAt:undefined,updatedAt:now()}:x));}
export function permanentlyDeleteProject(projectId:string){saveProjects(loadProjects(true).filter(x=>x.projectId!==projectId));}

export function projectToTemplate(project: ContentProject) {
  let blocks: TemplateBlock[];
  if (project.projectType === 'blog') {
    blocks = (project.blogData?.blocks ?? []).filter(block => block.type !== 'divider').map(block => ({
      blockId:id('block'), label:block.title || (block.type === 'paragraph' ? '본문' : block.type.toUpperCase()), blockType:block.type === 'image' ? 'image' : block.type === 'h2' || block.type === 'h3' ? 'section' : 'textarea', defaultValue:block.text || '',
    }));
  } else if (project.projectType === 'video-script') {
    blocks = (project.videoScriptData?.scenes ?? []).map(scene => ({ blockId:id('block'), label:`${scene.startSecond}~${scene.endSecond}초 · ${scene.purpose}`, blockType:'textarea', defaultValue:scene.narration || scene.caption || '' }));
  } else if (project.projectType === 'document') {
    blocks = (project.documentData?.blocks ?? []).map(block => ({ blockId:id('block'), label:block.title || block.type.toUpperCase(), blockType:block.type === 'metric' ? 'metric' : block.type === 'image' ? 'image' : block.type === 'h1' || block.type === 'h2' ? 'section' : 'textarea', defaultValue:block.text || block.snapshotValue || '' }));
  } else {
    blocks = [
      { blockId:id('block'), label:'후킹', blockType:'textarea', defaultValue:project.hooks[0]||'' },
      { blockId:id('block'), label:'제목', blockType:'text', defaultValue:project.copyVariants[0]?.headline||'' },
      { blockId:id('block'), label:'본문', blockType:'textarea', defaultValue:project.copyVariants[0]?.body||'' },
      { blockId:id('block'), label:'CTA', blockType:'text', defaultValue:project.copyVariants[0]?.cta||'' },
    ];
  }
  if (!blocks.length) blocks = [{ blockId:id('block'), label:'내용', blockType:'textarea', defaultValue:'' }];
  const templateType:TemplateType = project.projectType==='blog'?'blog':project.projectType==='document'?'document':project.projectType==='video-script'?'video-script':project.creativeType.includes('영상')?'video-script':project.creativeType.includes('이미지')?'image-brief':'ad-copy';
  return createTemplate({name:`${project.title} 템플릿`,templateType,advertiserId:project.advertiserId,advertiserName:project.advertiserName,channel:project.channel,description:'제작물에서 생성한 템플릿',blocks,rules:[],tags:[project.creativeType,project.objective,project.projectType||'ad'],sourceProjectId:project.projectId});
}

export function createTemplateFromCreative(creativeId: string) {
  const creative = CREATIVE_LIBRARY.find(x => x.id === creativeId); if (!creative) return null;
  const advertiser = loadAdvertisers().find(x => x.name === creative.brand);
  const hook = creative.tags?.[0] || creative.objective;
  const blocks: TemplateBlock[] = [
    {blockId:id('block'),label:'후킹',blockType:'textarea',defaultValue:hook},
    {blockId:id('block'),label:'유지할 핵심 요소',blockType:'textarea',defaultValue:(creative.tags||[]).join(', ')},
    {blockId:id('block'),label:'CTA',blockType:'text',defaultValue:''},
  ];
  return createTemplate({name:`${creative.name} 기반 템플릿`,templateType:creative.type==='영상'?'video-script':creative.type==='이미지'?'image-brief':'ad-copy',advertiserId:advertiser?.id,advertiserName:creative.brand,channel:creative.platform,description:'소재 분석/라이브러리 소재를 기준으로 생성한 템플릿',blocks,rules:[],tags:[creative.type,...(creative.tags||[])],sourceCreativeId:creative.id});
}
