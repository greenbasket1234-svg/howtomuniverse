import type { BlogProject, ComplianceIssue } from './blogTypes';

const MEDICAL_INDUSTRIES=['병원·의료기관','병원','의원','치과','한의원','한방병원'];
export function isMedicalIndustry(industry:string){return MEDICAL_INDUSTRIES.some(x=>industry.includes(x));}

const GENERIC_RULES=[
  {re:/(무조건|100%|확실(?:히)?|완벽(?:히)?|절대)/g,cat:'과장·단정',reason:'결과를 단정하거나 보장하는 표현은 사실관계와 업종 규정 확인이 필요합니다.',suggest:'조건과 근거를 명확히 하고 가능성 중심 표현으로 수정하세요.'},
  {re:/(최고|최초|유일|1위|업계\s*최고)/g,cat:'최상급 표현',reason:'객관적인 입증자료 없이 최상급·우월 표현을 사용하면 오인 소지가 있습니다.',suggest:'검증 가능한 객관적 사실로 바꾸거나 근거 자료를 연결하세요.'},
  {re:/(공짜|무료\s*치료|무조건\s*무료)/g,cat:'가격·혜택',reason:'가격·혜택 표현은 업종별 표시·광고 및 플랫폼 기준을 확인해야 합니다.',suggest:'적용 조건과 범위를 명확하게 표시하세요.'},
];
const MEDICAL_RULES=[
  {re:/(완치|치료효과\s*보장|반드시\s*(?:낫|좋아)|무조건\s*(?:낫|회복))/g,cat:'치료효과 단정',reason:'치료 효과를 보장하거나 오인하게 할 수 있는 표현은 의료광고에서 특히 주의가 필요합니다.',suggest:'개인별 상태에 따라 결과가 달라질 수 있음을 반영한 중립 표현을 사용하세요.'},
  {re:/(환자\s*후기|치료\s*후기|체험담|제가\s*직접\s*받아보니)/g,cat:'치료경험담',reason:'치료경험담은 소비자가 치료 효과를 오인하게 할 우려가 있어 의료광고 검토가 필요합니다.',suggest:'개별 경험담 대신 객관적인 의료정보 중심으로 작성하세요.'},
  {re:/(다른\s*병원보다|타\s*병원보다|타병원보다|타\s*의원보다)/g,cat:'비교·비방',reason:'다른 의료기관 또는 진료방법과의 비교·비방 표현은 의료광고상 위험할 수 있습니다.',suggest:'자체 의료기관의 확인 가능한 정보만 설명하세요.'},
  {re:/(전문병원|전문\s*병원)/g,cat:'자격·명칭',reason:'전문병원 표시는 법정 지정 여부와 지정 분야를 확인해야 합니다.',suggest:'공식 지정 근거가 확인된 경우에만 정확한 범위로 사용하세요.'},
  {re:/(이벤트\s*할인|진료비\s*할인|수술비\s*할인|반값\s*진료)/g,cat:'비급여·할인',reason:'의료비 할인·면제 표현은 환자 유인 및 비급여 표시 기준을 함께 확인해야 합니다.',suggest:'가격표현을 발행하기 전 의료광고 담당자의 별도 확인을 거치세요.'},
];

export function analyzeCompliance(project:BlogProject):ComplianceIssue[]{
  const issues:ComplianceIssue[]=[];
  const rules=[...GENERIC_RULES,...(isMedicalIndustry(project.industry)?MEDICAL_RULES:[])];
  for(const block of project.blocks){
    const text=`${block.title||''}\n${block.text||''}`;
    for(const rule of rules){
      rule.re.lastIndex=0; let match:RegExpExecArray|null;
      while((match=rule.re.exec(text))){
        issues.push({id:`${block.blockId}-${rule.cat}-${match.index}`,severity:rule.cat==='과장·단정'||rule.cat==='치료효과 단정'?'danger':'warning',category:rule.cat,phrase:match[0],reason:rule.reason,suggestion:rule.suggest,blockId:block.blockId});
        if(match[0].length===0)break;
      }
    }
  }
  if(isMedicalIndustry(project.industry)){
    issues.push({id:'medical-side-effect-check',severity:'info',category:'의료광고 필수 확인',phrase:'부작용·중요정보',reason:'진료방법이나 의료행위의 중요한 위험·부작용 정보가 누락되지 않았는지 사람의 검토가 필요합니다.',suggestion:'해당 콘텐츠가 진료방법·시술 정보를 포함하면 중요한 제한사항과 주의사항을 확인하세요.'});
    issues.push({id:'medical-pre-review-check',severity:'info',category:'사전심의 확인',phrase:'심의 대상 여부',reason:'매체와 광고 내용에 따라 의료광고 사전심의 대상 여부가 달라질 수 있습니다.',suggestion:'발행 전 담당 심의기구/매체 기준으로 대상 여부를 최종 확인하세요.'});
  }
  return issues;
}
