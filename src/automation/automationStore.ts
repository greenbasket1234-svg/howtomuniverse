import { ADVERTISERS, MOCK_CAMPAIGNS } from '../data/operationsMock';
import type { Campaign } from '../types/operations';
import type { AutomationJob, AutomationRun, DataCollectionConfig } from './automationTypes';
import { nextRunIso, scheduleSummary } from './scheduleEngine';

export const AUTOMATION_JOBS_KEY='howtom-automation-jobs-v1';
export const AUTOMATION_RUNS_KEY='howtom-automation-runs-v1';
export const COLLECTION_CONFIGS_KEY='howtom-data-collection-configs-v1';
export const AUTOMATION_EVENT='howtom-automation-updated';
const CAMPAIGN_STORAGE_KEY='howtom-campaign-management-v2';

function readArray<T>(key:string):T[]{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
function emit(){try{window.dispatchEvent(new CustomEvent(AUTOMATION_EVENT))}catch{}}
function advertiserName(id?:string){return ADVERTISERS.find(a=>a.id===id)?.name || id || '전체 광고주'}
function hash(input:string){let h=2166136261;for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)}return (h>>>0).toString(36)}

export function loadAutomationJobs(){return readArray<AutomationJob>(AUTOMATION_JOBS_KEY)}
export function saveAutomationJobs(jobs:AutomationJob[]){localStorage.setItem(AUTOMATION_JOBS_KEY,JSON.stringify(jobs));emit()}
export function loadAutomationRuns(){return readArray<AutomationRun>(AUTOMATION_RUNS_KEY)}
export function saveAutomationRuns(runs:AutomationRun[]){localStorage.setItem(AUTOMATION_RUNS_KEY,JSON.stringify(runs.slice(0,300)));emit()}
export function addAutomationRun(run:AutomationRun){saveAutomationRuns([run,...loadAutomationRuns()])}
export function loadCollectionConfigs(){return readArray<DataCollectionConfig>(COLLECTION_CONFIGS_KEY)}
export function saveCollectionConfigs(configs:DataCollectionConfig[]){localStorage.setItem(COLLECTION_CONFIGS_KEY,JSON.stringify(configs));emit()}

export function upsertAutomationJob(job:AutomationJob){
  const jobs=loadAutomationJobs(); const previous=jobs.find(x=>x.jobId===job.jobId);
  if (previous?.syncedCampaignRuleLabel && previous.targetId) removeCampaignRule(previous.targetId,previous.syncedCampaignRuleLabel);
  const normalized={...job,nextRunAt:nextRunIso(job.schedule),updatedAt:new Date().toISOString()};
  if ((normalized.jobType==='campaign_on'||normalized.jobType==='campaign_off') && normalized.targetId) {
    const label=`${scheduleSummary(normalized.schedule)} ${normalized.jobType==='campaign_on'?'ON':'OFF'}`;
    syncCampaignRule(normalized.targetId,label);
    normalized.syncedCampaignRuleLabel=label;
  }
  saveAutomationJobs(jobs.some(x=>x.jobId===normalized.jobId)?jobs.map(x=>x.jobId===normalized.jobId?normalized:x):[normalized,...jobs]);
  return normalized;
}

export function removeAutomationJob(jobId:string){
  const jobs=loadAutomationJobs(); const target=jobs.find(x=>x.jobId===jobId);
  if (target?.syncedCampaignRuleLabel && target.targetId) removeCampaignRule(target.targetId,target.syncedCampaignRuleLabel);
  saveAutomationJobs(jobs.filter(x=>x.jobId!==jobId));
}

function loadCampaigns():Campaign[]{try{const v=JSON.parse(localStorage.getItem(CAMPAIGN_STORAGE_KEY)||'null');return Array.isArray(v)&&v.length?v:MOCK_CAMPAIGNS}catch{return MOCK_CAMPAIGNS}}
function saveCampaigns(rows:Campaign[]){localStorage.setItem(CAMPAIGN_STORAGE_KEY,JSON.stringify(rows));emit()}
function syncCampaignRule(campaignId:string,label:string){
  const rows=loadCampaigns();
  const next=rows.map(r=>{if(r.id!==campaignId)return r;const rules=r.schedule?.rules?.length?[...r.schedule.rules]:(r.schedule?.repeat?[r.schedule.repeat]:[]);if(!rules.includes(label))rules.push(label);return {...r,status:'scheduled' as const,schedule:{...r.schedule,repeat:rules[0],rules}}});
  saveCampaigns(next);
}
function removeCampaignRule(campaignId:string,label:string){
  const rows=loadCampaigns();
  const next=rows.map(r=>{if(r.id!==campaignId)return r;const rules=(r.schedule?.rules?.length?[...r.schedule.rules]:(r.schedule?.repeat?[r.schedule.repeat]:[])).filter(x=>x!==label);return {...r,schedule:rules.length?{...r.schedule,repeat:rules[0],rules}:undefined}});
  saveCampaigns(next);
}

export function campaignAutomationJobs():AutomationJob[]{
  const syncedLabels=new Set(loadAutomationJobs().flatMap(j=>j.syncedCampaignRuleLabel&&j.targetId?[`${j.targetId}|${j.syncedCampaignRuleLabel}`]:[]));
  const now=new Date().toISOString();
  return loadCampaigns().flatMap(c=>{
    const rules=c.schedule?.rules?.length?c.schedule.rules:(c.schedule?.repeat?[c.schedule.repeat]:[]);
    return rules.filter(rule=>!syncedLabels.has(`${c.id}|${rule}`)).map(rule=>({
      jobId:`campaign-derived-${c.id}-${hash(rule)}`,name:`${c.name} ON/OFF 일정`,jobType:'campaign_schedule' as const,
      advertiserId:c.advertiserId,advertiserName:advertiserName(c.advertiserId),targetType:'campaign' as const,targetId:c.id,targetName:c.name,platform:c.platform,
      scheduleText:rule,status:'active' as const,implementationStatus:'mock' as const,source:'campaign' as const,readOnly:true,createdAt:now,updatedAt:now,
    }));
  });
}

export function ruleAutomationJobs():AutomationJob[]{
  const rules=readArray<any>('acc_rules'); const now=new Date().toISOString();
  return rules.map((r:any)=>({jobId:`rule-${r.id}`,name:r.name||'자동화 규칙',jobType:r.badge==='광고 OFF'?'campaign_off':'notification',advertiserName:r.scope||'전체 광고주',targetType:'other',scheduleText:r.cadence||'규칙 평가',status:r.enabled===false?'paused':'active',implementationStatus:r.mode==='자동'?'mock':'available',source:'rule',readOnly:true,createdAt:now,updatedAt:now} as AutomationJob));
}

export function getAllAutomationJobs(){return [...loadAutomationJobs(),...campaignAutomationJobs(),...ruleAutomationJobs()]}
