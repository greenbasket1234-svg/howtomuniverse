import type { ReactNode } from 'react';

export function ControlKpi({label,value,sub}:{label:string;value:string|number;sub?:string}){
  return <article className="ctrl-kpi card"><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</article>;
}
export function ControlPanel({title,description,actions,children,className=''}:{title:string;description?:string;actions?:ReactNode;children:ReactNode;className?:string}){
  return <section className={`card ctrl-panel ${className}`}><header className="ctrl-panel-head"><div><h3>{title}</h3>{description&&<p>{description}</p>}</div>{actions&&<div className="ctrl-panel-actions">{actions}</div>}</header>{children}</section>;
}
export function ControlStatus({tone='neutral',children}:{tone?:'success'|'warning'|'danger'|'info'|'neutral';children:ReactNode}){
  return <span className={`ctrl-status ${tone}`}>{children}</span>;
}
export function ControlEmpty({children}:{children:ReactNode}){return <div className="ctrl-empty">{children}</div>}
export function BackendBadge(){return <span className="ctrl-backend-badge">백엔드 연결 후</span>}
export function DemoBadge(){return <span className="ctrl-demo-badge">프론트 데모</span>}
