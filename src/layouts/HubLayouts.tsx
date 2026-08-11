import { Outlet, useParams } from 'react-router-dom';
import { SectionTabs } from '../components/SectionTabs';

function Shell({tabs}:{tabs:{label:string;to:string;end?:boolean}[]}){return <div><SectionTabs tabs={tabs}/><Outlet/></div>}
export function KeywordHubLayout(){const {brandId}=useParams(); if(!brandId)return <Outlet/>; return <Shell tabs={[{label:'키워드 성과',to:`/keywords/${brandId}/performance`},{label:'키워드 분석',to:`/keywords/${brandId}/analysis`}]}/>}
export function CreativeHubLayout(){return <Shell tabs={[{label:'소재 라이브러리',to:'/creatives/library'},{label:'소재 성과',to:'/creatives/performance'},{label:'소재 피로도',to:'/creatives/fatigue'},{label:'재등록 센터',to:'/creatives/reupload'}]}/>}
export function AutomationHubLayout(){return <Shell tabs={[{label:'자동화 현황',to:'/automation/overview'},{label:'예약 작업',to:'/automation/scheduled-jobs'},{label:'데이터 자동 수집',to:'/automation/data-collection'}]}/>}
export function CalendarHubLayout(){return <Shell tabs={[{label:'일정 이벤트',to:'/operations-calendar/schedule'},{label:'날씨 시즌',to:'/operations-calendar/weather'}]}/>}
export function AdAccountsHubLayout(){return <Shell tabs={[{label:'계정 연동',to:'/ad-accounts/connections'},{label:'데이터 수집 현황',to:'/ad-accounts/data-sync'}]}/>}
export function ReportsBrandLayout(){const {brandId}=useParams(); if(!brandId)return <Outlet/>; return <Shell tabs={[{label:'통합 보고서',to:`/reports/${brandId}`,end:true},{label:'일일 보고서',to:`/reports/${brandId}/daily`},{label:'월말 분석',to:`/reports/${brandId}/monthly`},{label:'차월 예산 계획',to:`/reports/${brandId}/planning`}]}/>}
