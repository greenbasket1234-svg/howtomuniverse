import type { Competitor, ExternalCreativeObservation } from './externalTypes';

const COMPETITOR_KEY = 'howtom-competitors-v1';
const OBSERVATION_KEY = 'howtom-external-observations-v1';

const parse = <T,>(key:string, fallback:T):T => {
  try { const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
};
const id=(prefix:string)=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const now=()=>new Date().toISOString();
function emit(){ window.dispatchEvent(new CustomEvent('howtom:external-intelligence-changed')); }

export function loadCompetitors():Competitor[]{ const rows=parse<Competitor[]>(COMPETITOR_KEY,[]); return Array.isArray(rows)?rows:[]; }
export function saveCompetitors(rows:Competitor[]){ localStorage.setItem(COMPETITOR_KEY,JSON.stringify(rows)); emit(); }
export function createCompetitor(input:Omit<Competitor,'competitorId'|'createdAt'|'updatedAt'>){ const stamp=now(); const row:Competitor={...input,competitorId:id('competitor'),createdAt:stamp,updatedAt:stamp}; saveCompetitors([row,...loadCompetitors()]); return row; }
export function patchCompetitor(competitorId:string,patch:Partial<Competitor>){ const rows=loadCompetitors(); const current=rows.find(x=>x.competitorId===competitorId); if(!current)return null; const next={...current,...patch,updatedAt:now()}; saveCompetitors(rows.map(x=>x.competitorId===competitorId?next:x)); return next; }
export function deleteCompetitor(competitorId:string){ saveCompetitors(loadCompetitors().filter(x=>x.competitorId!==competitorId)); saveObservations(loadObservations().filter(x=>x.competitorId!==competitorId)); }

export function loadObservations():ExternalCreativeObservation[]{ const rows=parse<ExternalCreativeObservation[]>(OBSERVATION_KEY,[]); return Array.isArray(rows)?rows:[]; }
export function saveObservations(rows:ExternalCreativeObservation[]){ localStorage.setItem(OBSERVATION_KEY,JSON.stringify(rows)); emit(); }
export function createObservation(input:Omit<ExternalCreativeObservation,'observationId'|'createdAt'|'updatedAt'>){ const stamp=now(); const row:ExternalCreativeObservation={...input,observationId:id('observation'),createdAt:stamp,updatedAt:stamp}; saveObservations([row,...loadObservations()]); return row; }
export function patchObservation(observationId:string,patch:Partial<ExternalCreativeObservation>){ const rows=loadObservations(); const current=rows.find(x=>x.observationId===observationId); if(!current)return null; const next={...current,...patch,updatedAt:now()}; saveObservations(rows.map(x=>x.observationId===observationId?next:x)); return next; }
export function deleteObservation(observationId:string){ saveObservations(loadObservations().filter(x=>x.observationId!==observationId)); }
