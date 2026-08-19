import fs from 'node:fs';import path from 'node:path';
const root=process.cwd();
const livePages=[
'UniverseHomePage.tsx','DashboardOverviewPage.tsx','IntegratedPerformanceAnalysisPage.tsx','MediaPerformancePage.tsx','AdvertiserPerformancePage.tsx','CampaignAnalysisPage.tsx','CreativeAnalysisPage.tsx','MetaCreativeReportPage.tsx','CreativeLibraryPage.tsx','CreativeDetailPage.tsx','CreativeFatiguePage.tsx','KeywordAnalysisPage.tsx','NaverKeywordReportPage.tsx','SearchAdManagementPages.tsx','ConversionFunnelPage.tsx','AIRecommendationsPage.tsx','AIRecommendationDetailPage.tsx','ReportsHubPage.tsx','DbDataPage.tsx'];
const forbidden=['loadPerformanceDataset','MOCK_CAMPAIGNS','CREATIVE_PERFORMANCE_SAMPLE','BRAND_REPORTS'];
const failures=[];
for(const file of livePages){const p=path.join(root,'src','pages',file);const s=fs.readFileSync(p,'utf8');for(const token of forbidden)if(s.includes(token))failures.push(`${file}: ${token}`);}
const repo=fs.readFileSync(path.join(root,'src','repositories','index.ts'),'utf8');
if(!repo.includes("import.meta.env.PROD ? 'api'"))failures.push('Production repository가 api로 강제되지 않았습니다.');
const metricsDate=fs.readFileSync(path.join(root,'src','utils','metricsDate.ts'),'utf8');
for(const label of ['오늘','어제','최근 7일','최근 14일','최근 30일','최근 60일','최근 90일','지난달','이번달','기간 직접 선택'])if(!metricsDate.includes(label))failures.push(`기간 preset 누락: ${label}`);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`DATA_SOURCE_AUDIT_OK pages=${livePages.length}`);
