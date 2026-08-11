import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Link2, Play, Settings, X } from 'lucide-react';

type ActionState={label:string;mode:'confirm'|'download'|'connect'|'detail'|'execute';done?:boolean}|null;

function classify(label:string):NonNullable<ActionState>['mode']|null{
  if(/CSV|PDF|Excel|엑셀|내보내기|다운로드/.test(label))return 'download';
  if(/연동|동기화|불러오기|API|키 등록/.test(label))return 'connect';
  if(/상세|보기|미리보기|로그|이력/.test(label))return 'detail';
  if(/실행|ON|OFF|중지|재등록|발송|업로드|생성|저장|승인|반려|삭제|복사/.test(label))return 'execute';
  return null; // 인식하지 못한 버튼(광고주 전환 같은 단순 선택 등)에는 확인 모달을 띄우지 않습니다.
}

export function GlobalActionModal(){
  const [action,setAction]=useState<ActionState>(null);
  useEffect(()=>{
    const listener=(event:MouseEvent)=>{
      const el=event.target as HTMLElement|null;
      const button=el?.closest('button') as HTMLButtonElement|null;
      if(!button||button.disabled||button.type==='submit')return;
      if(button.closest('.modal-backdrop')||button.closest('.global-action-modal'))return;
      if(button.classList.contains('modal-close')||button.classList.contains('toggle'))return;
      if(button.closest('.date-range')||button.closest('.section-tabs')||button.closest('.tabs')||button.closest('.data-method-card')||button.closest('.daily-report-type-card')||button.closest('.report-type-badge'))return;
      const label=(button.innerText||button.getAttribute('aria-label')||button.title||'기능 실행').trim();
      if(!label)return;
      const before=document.querySelectorAll('.modal-backdrop').length;
      window.setTimeout(()=>{
        const after=document.querySelectorAll('.modal-backdrop').length;
        if(after>before)return; // 해당 버튼이 자체 창을 열었다면 중복 창을 띄우지 않습니다.
        const mode=classify(label);
        if(!mode)return; // 알려진 동작 키워드가 아니면 모달을 띄우지 않습니다.
        setAction({label,mode});
      },90);
    };
    document.addEventListener('click',listener,true);
    return()=>document.removeEventListener('click',listener,true);
  },[]);
  const description=useMemo(()=>{
    if(!action)return '';
    if(action.mode==='download')return '파일 형식과 포함할 데이터를 확인한 뒤 다운로드를 시작합니다.';
    if(action.mode==='connect')return '계정 권한과 연결 정보를 확인한 뒤 연동 테스트를 진행합니다.';
    if(action.mode==='detail')return '선택한 항목의 상세 정보와 최근 변경 이력을 확인합니다.';
    if(action.mode==='execute')return '선택한 작업을 실행합니다. 실행 결과는 알림 로그와 운영 이력에 기록됩니다.';
    return '선택한 기능의 설정값을 확인하고 적용합니다.';
  },[action]);
  if(!action)return null;
  const Icon=action.mode==='download'?Download:action.mode==='connect'?Link2:action.mode==='execute'?Play:Settings;
  return <div className="modal-backdrop global-action-modal" onMouseDown={e=>{if(e.target===e.currentTarget)setAction(null)}}>
    <div className="modal-card action-dialog" role="dialog" aria-modal="true">
      <div className="modal-title-row"><div><h2>{action.label}</h2><p>{description}</p></div><button className="modal-close" onClick={()=>setAction(null)} aria-label="닫기"><X size={20}/></button></div>
      {action.done?<div className="action-complete"><CheckCircle2 size={34}/><b>정상적으로 처리되었습니다.</b><span>변경 내용은 현재 화면과 운영 이력에 반영됩니다.</span></div>:<>
        <div className="action-dialog-body">
          <div className="action-icon"><Icon size={23}/></div>
          <div><b>실행 전 확인</b><p>광고주, 기간, 매체와 대상 항목을 확인했습니다. 실제 API 연결이 필요한 작업은 연동된 계정에서만 적용됩니다.</p></div>
        </div>
        {action.mode==='download'&&<div className="dialog-options"><label><input type="radio" name="format" defaultChecked/> CSV</label><label><input type="radio" name="format"/> Excel</label><label><input type="radio" name="format"/> PDF</label></div>}
        {action.mode==='connect'&&<div className="dialog-fields"><label>광고계정<select><option>현재 선택된 광고계정</option><option>새 광고계정 연결</option></select></label><label>권한 범위<select><option>조회 및 데이터 수집</option><option>캠페인 관리 포함</option></select></label></div>}
        <div className="modal-actions"><button className="btn secondary" onClick={()=>setAction(null)}>취소</button><button className="btn primary" onClick={()=>setAction({...action,done:true})}>{action.mode==='download'?'다운로드':action.mode==='detail'?'확인':'실행'}</button></div>
      </>}
      {action.done&&<div className="modal-actions"><button className="btn primary" onClick={()=>setAction(null)}>확인</button></div>}
    </div>
  </div>;
}
