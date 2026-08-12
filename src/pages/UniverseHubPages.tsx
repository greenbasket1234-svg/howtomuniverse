import { ArrowUpRight, BarChart3, Bot, Clapperboard, Eye, FileText, FolderOpen, Lightbulb, PenLine, Settings2, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

const plannedModules: Record<string, { title: string; description: string; group: string }> = {
  'competitor-analysis': { title: '경쟁사 분석', description: '경쟁사 광고와 콘텐츠를 수집하고 성과 구조를 비교하는 기능입니다.', group: '인사이트' },
  'ad-trends': { title: '광고 트렌드', description: '업종별 광고 흐름과 인기 소재 유형을 정리하는 기능입니다.', group: '인사이트' },
  'hook-cta': { title: '후킹·CTA 분석', description: '광고 문구의 후킹 방식과 행동 유도 문구를 비교 분석하는 기능입니다.', group: '인사이트' },
  'ai-recommendations': { title: 'AI 추천', description: '성과 데이터와 콘텐츠 데이터를 연결해 실행 가능한 제안을 만드는 기능입니다.', group: '인사이트' },
  references: { title: '레퍼런스', description: 'SNS와 웹에서 이미지·영상·글 레퍼런스를 수집하고 보관하는 기능입니다.', group: '콘텐츠' },
  'image-creation': { title: '이미지 제작', description: '광고 기획과 브랜드 정보를 바탕으로 이미지 제작을 지원하는 기능입니다.', group: '콘텐츠' },
  'content-trash': { title: '콘텐츠 휴지통', description: '삭제한 제작물을 일정 기간 보관하고 복원하는 기능입니다.', group: '콘텐츠' },
  'reference-automation': { title: '레퍼런스 자동 수집', description: '등록 키워드와 계정을 기준으로 신규 레퍼런스를 주기적으로 수집하는 기능입니다.', group: 'AI 자동화' },
  'blog-automation': { title: '블로그 자동 생성', description: '예약된 주제와 키워드로 블로그 초안을 자동 생성하는 기능입니다.', group: 'AI 자동화' },
  'copy-automation': { title: '광고 문구 자동 생성', description: '성과와 시즌 정보를 기준으로 광고 문구를 자동 생성하는 기능입니다.', group: 'AI 자동화' },
  'brand-assets': { title: '로고·브랜드 자료', description: '광고주별 로고, 브랜드 색상, 문구 규칙을 관리하는 기능입니다.', group: '자산관리' },
  prompts: { title: '프롬프트', description: '업무별 AI 프롬프트를 저장하고 공유하는 기능입니다.', group: '자산관리' },
  'advertiser-folders': { title: '광고주별 폴더', description: '광고주 단위로 이미지·영상·문서·보고서를 정리하는 기능입니다.', group: '자산관리' },
  'asset-trash': { title: '자산 휴지통', description: '삭제한 파일을 일정 기간 보관하고 복원하는 기능입니다.', group: '자산관리' },
  'advertiser-subscription': { title: '계약·구독', description: '광고주별 계약, 사용 기능, 월 구독료와 사용량을 관리하는 기능입니다.', group: '광고주' },
  'admin-billing': { title: '구독·결제 관리', description: '상품, 결제 내역, 미납과 갱신 상태를 관리하는 기능입니다.', group: '관리자' },
  'admin-ai-usage': { title: 'AI 사용량', description: '광고주와 사용자별 토큰·크레딧 사용량과 비용 상한을 관리하는 기능입니다.', group: '관리자' },
  'admin-storage': { title: '저장 공간', description: '파일 저장량, 보관 기간, 자동 삭제 정책을 관리하는 기능입니다.', group: '관리자' },
};

const hubCards = {
  insights: [
    ['통합 성과 분석', '성과 변화의 원인과 개선 우선순위를 분석합니다.', '/insights/performance', Lightbulb],
    ['매체별 분석', '메타·네이버·구글 검색·유튜브·당근·카카오·틱톡의 효율과 예산 기여도를 비교합니다.', '/insights/media', BarChart3],
    ['광고주별 분석', '광고주별 KPI 달성률과 예산·매체 기여도, 관리 우선순위를 분석합니다.', '/insights/advertisers', Users],
    ['캠페인 분석', '캠페인별 성과 증감, KPI 효율, 예산 소진과 변화 원인을 분석합니다.', '/insights/campaigns', BarChart3],
    ['키워드 분석', '검색광고 키워드 효율과 순위를 확인합니다.', '/keywords', Sparkles],
    ['소재 분석', '이미지·영상·카피의 성과, 실제 DB 품질, 피로도와 성공 패턴을 분석합니다.', '/insights/creatives', FileText],
    ['후킹·CTA 분석', '실제 CTR·DB·유효DB·계약을 후킹과 CTA 패턴별로 비교합니다.', '/insights/hook-cta', Sparkles],
    ['경쟁사 분석', '저장한 경쟁사 소재와 내부 고성과 패턴을 비교합니다.', '/insights/competitors', Eye],
    ['광고 트렌드', '경쟁사·업계 관찰 데이터의 증가·감소 패턴을 분석합니다.', '/insights/trends', BarChart3],
    ['예산 추천', '소진율과 성과를 기준으로 예산을 조정합니다.', '/budget-recommendations', Bot],
  ],
  content: [
    ['광고 제작', '브리프·후킹·카피·CTA·소재 기획을 한 화면에서 제작합니다.', '/content/ad-creation', Sparkles],
    ['블로그 제작', '광고주 문체·자산·SEO·업종별 규정 검수와 의료광고 심의 관리를 한곳에서 진행합니다.', '/content/blog', PenLine],
    ['영상 대본', '릴스·쇼츠·광고 영상 대본과 장면 구성을 작성합니다.', '/content/video-scripts', Clapperboard],
    ['문서 작성', '기획서·제안 초안·전략서 등 업무 문서를 블록 단위로 작성합니다.', '/content/documents', FileText],
    ['제작물 보관함', '제작 프로젝트와 결과 자산을 광고주·캠페인 기준으로 확인합니다.', '/content/productions', FolderOpen],
    ['레퍼런스', '광고 참고 소재를 수집·태그·분류하고 제작에 바로 활용합니다.', '/content/references', Lightbulb],
    ['템플릿', '광고·블로그·보고서·제안서 제작 구조와 규칙을 표준화합니다.', '/content/templates', Settings2],
  ],
  assets: [
    ['전체 자산', '이미지·영상·문서·광고 소재를 하나의 Asset 인덱스로 관리합니다.', '/assets', FolderOpen],
    ['광고주별 폴더', '광고주 단위로 제작물·보고서·소재를 자동 분류합니다.', '/assets/advertisers', Users],
    ['광고 소재', '실제 광고 creativeId와 원본 자산·성과를 연결합니다.', '/assets/creatives', BarChart3],
    ['브랜드 자료', '로고와 브랜드 규칙을 광고주별로 관리합니다.', '/planned/brand-assets', Settings2],
  ],
  admin: [
    ['사용자·권한', '역할별 메뉴 접근 권한을 관리합니다.', '/settings/users-permissions', ShieldCheck],
    ['광고주 관리', '광고주 등록과 기본 정보를 관리합니다.', '/advertisers', Users],
    ['데이터 수집 현황', '매체별 수집 상태와 오류를 확인합니다.', '/data-collection-status', Bot],
    ['시스템 설정', '유니버스의 공통 운영 기준을 관리합니다.', '/settings', Settings2],
  ],
} as const;

function HubPage({ type, title, description }: { type: keyof typeof hubCards; title: string; description: string }) {
  return <div className="universe-hub-page"><header className="universe-module-hero"><span>HOWTOM 유니버스</span><h1>{title}</h1><p>{description}</p></header><div className="universe-module-grid">{hubCards[type].map(([name, copy, path, Icon]) => <Link to={path} key={name} className="universe-module-card"><div className="module-icon"><Icon size={24}/></div><div><strong>{name}</strong><p>{copy}</p></div><ArrowUpRight size={19}/></Link>)}</div></div>;
}

export function InsightsHomePage(){ return <HubPage type="insights" title="인사이트" description="광고 성과와 콘텐츠 데이터를 분석해 다음 행동을 결정합니다."/>; }
export function ContentHomePage(){ return <HubPage type="content" title="콘텐츠" description="레퍼런스부터 제작, 검수, 보관까지 콘텐츠 업무를 한곳에서 관리합니다."/>; }
export function AdminHomePage(){ return <HubPage type="admin" title="관리자" description="사용자, 권한, 사용량과 시스템 운영 상태를 관리합니다."/>; }

export function UniversePlannedPage(){
  const { moduleKey = '' } = useParams();
  const item = plannedModules[moduleKey] ?? { title: '준비 중인 기능', description: '하우투엠 유니버스 확장 계획에 포함된 기능입니다.', group: '유니버스' };
  return <div className="universe-planned-page"><div className="planned-orbit"><span/><i/></div><span className="universe-eyebrow">{item.group}</span><h1>{item.title}</h1><p>{item.description}</p><div className="planned-notice"><strong>기획과 메뉴 배치는 완료되었습니다.</strong><span>현재 단계에서는 기존 기능을 안정적으로 통합한 뒤 순서대로 실제 기능을 구현합니다.</span></div><Link className="btn btn-primary universe-large-button" to="/home">홈으로 돌아가기</Link></div>;
}
