import type { DbDataRow } from '../../utils/dbDataStore';

export type DataQualityIssue={rowId:string;type:string;message:string};
export function validateDbRows(rows:DbDataRow[]){
  const issues:DataQualityIssue[]=[]; const ids=new Set<string>();
  rows.forEach(row=>{
    if(ids.has(row.id))issues.push({rowId:row.id,type:'duplicate',message:'중복 ID'}); ids.add(row.id);
    if(!row.date||!row.advertiser||!row.media)issues.push({rowId:row.id,type:'required',message:'날짜·광고주·매체 필수값 누락'});
    if(row.db<0||row.validDb<0||row.contracts<0||(row.spend??0)<0)issues.push({rowId:row.id,type:'negative',message:'음수 값 확인 필요'});
    if(row.validDb>row.db)issues.push({rowId:row.id,type:'funnel',message:'유효DB가 DB보다 큼'});
    if(row.contracts>Math.max(row.validDb,row.db))issues.push({rowId:row.id,type:'funnel',message:'계약 수가 상위 퍼널보다 큼'});
  });
  return {issues,validCount:Math.max(0,rows.length-issues.length),quality:rows.length?Math.max(0,Math.round((1-issues.length/rows.length)*1000)/10):null};
}
