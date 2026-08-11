export type CreativeBrief = {
  sourceCreativeId: string;
  advertiserId?: string;
  advertiserName: string;
  campaignId?: string;
  campaignName?: string;
  creativeType: string;
  winningElements: string[];
  weakElements: string[];
  recommendedHook?: string;
  recommendedCta?: string;
  recommendedLength?: string;
  objectiveMetric: string;
  createdAt: string;
};

const KEY='howtom-creative-brief-v1';
export function saveCreativeBrief(brief:CreativeBrief){ sessionStorage.setItem(KEY,JSON.stringify(brief)); }
export function loadCreativeBrief(sourceCreativeId?:string):CreativeBrief|undefined{
  try{const parsed=JSON.parse(sessionStorage.getItem(KEY)||'null') as CreativeBrief|null;if(!parsed)return undefined;if(sourceCreativeId&&parsed.sourceCreativeId!==sourceCreativeId)return undefined;return parsed;}catch{return undefined;}
}
export function clearCreativeBrief(){ sessionStorage.removeItem(KEY); }
