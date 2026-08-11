import type { CreativeHookType } from '../../analytics/creativeAnalysis';

export const HOOK_TAXONOMY = ['문제 제기형','공감형','충격/반전형','가격형','혜택형','후기형','질문형','비교형','결과 선제시형','정보형','희소성/한정형','권위/전문가형','호기심형','숫자형','미분류'] as const;
export const CTA_TAXONOMY = ['더 알아보기','상담 신청','견적 받기','구매하기','예약하기','문의하기','다운로드','회원가입','프로필 방문','댓글/DM','행동유도 없음','미분류'] as const;

export type StandardHook = typeof HOOK_TAXONOMY[number];
export type StandardCta = typeof CTA_TAXONOMY[number];

export function standardizeHook(value:CreativeHookType|string):StandardHook{
  const map:Record<string,StandardHook>={
    가격:'가격형',할인:'가격형',한정:'희소성/한정형',희소성:'희소성/한정형',질문:'질문형',문제제기:'문제 제기형',후기:'후기형',공감:'공감형',정보:'정보형',비교:'비교형',결과:'결과 선제시형',숫자:'숫자형',혜택:'혜택형',불안:'문제 제기형',미분류:'미분류',
  };
  return map[String(value)]||((HOOK_TAXONOMY as readonly string[]).includes(String(value))?value as StandardHook:'미분류');
}
export function standardizeCta(value:string):StandardCta{
  const text=value.trim();
  if(!text||text==='미분류')return '미분류';
  if(/상담/.test(text))return '상담 신청';
  if(/견적/.test(text))return '견적 받기';
  if(/구매|주문/.test(text))return '구매하기';
  if(/예약/.test(text))return '예약하기';
  if(/문의/.test(text))return '문의하기';
  if(/다운|받기/.test(text))return '다운로드';
  if(/가입/.test(text))return '회원가입';
  if(/프로필/.test(text))return '프로필 방문';
  if(/댓글|DM|디엠/.test(text))return '댓글/DM';
  if(/더 알아|자세히/.test(text))return '더 알아보기';
  return ((CTA_TAXONOMY as readonly string[]).includes(text)?text:'행동유도 없음') as StandardCta;
}
