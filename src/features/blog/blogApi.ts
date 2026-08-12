import { apiFetch } from '../../hooks/useApi';
import type { BlogAsset, BlogProject, BlogStyleProfile } from './blogTypes';

export const blogApi={
  projects:()=>apiFetch<BlogProject[]>('/blog/projects'),
  getProject:(id:string)=>apiFetch<BlogProject>(`/blog/projects/${encodeURIComponent(id)}`),
  createProject:(body:Partial<BlogProject>)=>apiFetch<BlogProject>('/blog/projects',{method:'POST',body:JSON.stringify(body)}),
  patchProject:(id:string,body:Partial<BlogProject>&{unlockForRevision?:boolean})=>apiFetch<BlogProject>(`/blog/projects/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)}),
  deleteProject:(id:string)=>apiFetch(`/blog/projects/${encodeURIComponent(id)}`,{method:'DELETE'}),
  generate:(body:Partial<BlogProject>)=>apiFetch<{generator:string;aiError?:string;titles:string[];blocks:BlogProject['blocks']}>('/blog/generate',{method:'POST',body:JSON.stringify(body)}),
  aiStatus:()=>apiFetch<{configured:boolean;provider:string|null}>('/blog/ai-status'),
  style:(advertiserId:string)=>apiFetch<BlogStyleProfile>(`/blog/styles/${encodeURIComponent(advertiserId)}`),
  saveStyle:(advertiserId:string,body:BlogStyleProfile)=>apiFetch<BlogStyleProfile>(`/blog/styles/${encodeURIComponent(advertiserId)}`,{method:'PUT',body:JSON.stringify(body)}),
  assets:()=>apiFetch<BlogAsset[]>('/blog/assets'),
  addAsset:(body:Partial<BlogAsset>)=>apiFetch<BlogAsset>('/blog/assets',{method:'POST',body:JSON.stringify(body)}),
};
