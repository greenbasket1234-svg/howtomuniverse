import { useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppErrorBoundary } from './layouts/AppErrorBoundary';
import { AppLayout } from './layouts/AppLayout';
import { AuthGate } from './gates/AuthGate';
import { KeywordHubLayout, CreativeHubLayout, AutomationHubLayout, CalendarHubLayout, AdAccountsHubLayout, ReportsBrandLayout } from './layouts/HubLayouts';
import { runAutoDbSyncIfDue } from './utils/googleSheetDbSync';

import { DashboardOverviewPage } from './pages/DashboardOverviewPage';
import { ReportsHubPage } from './pages/ReportsHubPage';
import { AdvertiserDailyReportPage } from './pages/AdvertiserDailyReportPage';
import { MonthlyReportManagementPage } from './pages/MonthlyReportManagementPage';
import { NextMonthProposalManagementPage } from './pages/NextMonthProposalManagementPage';
import { NaverKeywordReportPage } from './pages/NaverKeywordReportPage';
import { MetaCreativeReportPage } from './pages/MetaCreativeReportPage';
import { KeywordAnalysisBrandListPage, KeywordAnalysisPage } from './pages/KeywordAnalysisPage';
import { CreativeFatiguePage } from './pages/CreativeFatiguePage';
import { CreativeReuploadPage } from './pages/CreativeReuploadPage';
import { CreativeLibraryPage } from './pages/CreativeLibraryPage';
import { CreativeDetailPage } from './pages/CreativeDetailPage';
import { AutomationRulesPage } from './pages/AutomationRulesPage';
import { AutomationOverviewPage } from './pages/AutomationOverviewPage';
import { ScheduledJobsPage } from './pages/ScheduledJobsPage';
import { DataAutoCollectionPage } from './pages/DataAutoCollectionPage';
import { ReportAutomationPage, AdCopyAutomationPage, NotificationAutomationPage, WorkflowsPage, ExecutionLogsPage } from './pages/AutomationExtendedPages';
import { AdAccountsPage } from './pages/AdAccountsPage';
import { BrandsBudgetPage } from './pages/BrandsBudgetPage';
import { AlertsLogsPage } from './pages/AlertsLogsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CampaignManagementPage } from './pages/CampaignManagementPage';
import { SupportHubPage, SupportKnowledgePage, SupportSalesPage, SupportOpsPage, SupportNewsPage, SupportSecurityPage } from './pages/SupportCenterPages';
import { ConversionFunnelPage } from './pages/ConversionFunnelPage';
import { ScheduleSlotsPage } from './pages/ScheduleSlotsPage';
import { WeatherSeasonCalendarPage } from './pages/WeatherSeasonCalendarPage';
import { DataSyncPage } from './pages/DataSyncPage';
import { MediaPerformancePage } from './pages/MediaPerformancePage';
import { AdvertiserPerformancePage } from './pages/AdvertiserPerformancePage';
import { CampaignAnalysisPage } from './pages/CampaignAnalysisPage';
import { CreativeAnalysisPage } from './pages/CreativeAnalysisPage';
import { DbDataPage } from './pages/DbDataPage';
import { NaverSearchAdBrandListPage, NaverSearchAdDetailPage, GoogleSearchAdBrandListPage, GoogleSearchAdDetailPage, DaangnSearchAdBrandListPage, DaangnSearchAdDetailPage, KakaoSearchAdBrandListPage, KakaoSearchAdDetailPage } from './pages/SearchAdManagementPages';
import { SettingsDetailPage } from './pages/SettingsPage';
import { DailyReportPage, MonthlyAnalysisPage, NextMonthPlanPage } from './pages/ReportPlanningPages';
import { KpiGoalsPage, ReportBuilderPage, GoogleCreativeReportPage, AttributionLinksPage, CustomDataUploadPage, ProjectTasksPage, NotificationSendPage, DbManagementPage, CommissionSettlementPage } from './pages/OperationsCenterPages';
import { AdOperationSchedulePage } from './pages/AdOperationSchedulePage';
import { TodayOperationsPage, ReservationReportPage, CreativeRequestPage, ReservationAnalysisPage, BudgetRecommendationsPage, SeasonPlannerPage, PromotionSchedulePage, CustomerAnalyticsPage, ApprovalQueuePage, OperationsHistoryPage, AdvertiserManagementPage, KpiConversionSettingsPage, DataCollectionStatusPage, AdvertiserShareLinksPage } from './pages/FinalSystemPages';
import { UniverseHomePage } from './pages/UniverseHomePage';
import { IntegratedPerformanceAnalysisPage } from './pages/IntegratedPerformanceAnalysisPage';
import { AIRecommendationsPage } from './pages/AIRecommendationsPage';
import { AIRecommendationDetailPage } from './pages/AIRecommendationDetailPage';
import { CompetitorAnalysisPage, AdTrendsPage, HookCtaAnalysisPage } from './pages/ExternalIntelligencePages';
import { ContentHomePage, InsightsHomePage, UniversePlannedPage } from './pages/UniverseHubPages';
import { AssetsHomePage, AssetImagesPage, AssetVideosPage, AssetDocumentsPage, AssetCreativesPage, AdvertiserAssetFoldersPage, AssetTrashPage, BrandAssetsPage } from './pages/AssetManagementPages';
import { AdCreationPage, ProductionLibraryPage, ContentTemplatesPage, ContentTrashPage } from './pages/ContentSystemPages';
import { ContentReferencesPage } from './pages/ContentReferencesPage';
import { ImageCreationPage } from './pages/ImageCreationPage';
import { PromptLibraryPage } from './pages/PromptLibraryPage';
import { VideoScriptsPage, DocumentsWritingPage, AdvertiserSubscriptionsPage } from './pages/ProfessionalContentPages';
import { AdvertiserWorkspaceDashboardPage, AdvertiserContactsPage, AdvertiserPermissionsPage, AdvertiserApprovalsPage, AdvertiserSharedMaterialsPage, AdvertiserActivityPage, AdvertiserPortalPreviewPage } from './pages/AdvertiserControlPages';
import { PlatformSettingsHubPage, PlatformSettingsSectionPage } from './pages/SettingsControlPages';
import { AdminControlDashboardPage, AdminControlPage } from './pages/AdminControlPages';
import { AdminOnlyGate } from './gates/AdminOnlyGate';

function LegacyKeywordRedirect(){const {brandId}=useParams();return <Navigate to={brandId?`/keywords/${brandId}/analysis`:'/keywords'} replace/>}
function LegacyCreativeDetail(){const {creativeId}=useParams();return <Navigate to={`/creatives/library/${creativeId??''}`} replace/>}
function LegacySettingsRedirect(){const {sectionKey}=useParams();return <Navigate to={`/settings/advanced/${sectionKey??''}`} replace/>}

export default function App(){
  useEffect(() => {
    let cancelled = false;
    const run = async () => { if (!cancelled) await runAutoDbSyncIfDue(); };
    void run();
    const timer = window.setInterval(() => { void run(); }, 15 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);
  return <AppErrorBoundary><AuthGate><Routes>
  <Route path="/" element={<Navigate to="/home" replace/>}/>
  <Route element={<AppLayout/>}>
    <Route path="home" element={<UniverseHomePage/>}/>
    <Route path="insights" element={<InsightsHomePage/>}/><Route path="insights/performance" element={<IntegratedPerformanceAnalysisPage/>}/><Route path="insights/media" element={<MediaPerformancePage/>}/><Route path="insights/advertisers" element={<AdvertiserPerformancePage/>}/><Route path="insights/campaigns" element={<CampaignAnalysisPage/>}/><Route path="insights/creatives" element={<CreativeAnalysisPage/>}/><Route path="insights/competitors" element={<CompetitorAnalysisPage/>}/><Route path="insights/trends" element={<AdTrendsPage/>}/><Route path="insights/hook-cta" element={<HookCtaAnalysisPage/>}/><Route path="insights/ai-recommendations" element={<AIRecommendationsPage/>}/><Route path="insights/ai-recommendations/:recommendationId" element={<AIRecommendationDetailPage/>}/>
    <Route path="content" element={<ContentHomePage/>}/><Route path="content/references" element={<ContentReferencesPage/>}/><Route path="content/ad-creation" element={<AdCreationPage/>}/><Route path="content/image-creation" element={<ImageCreationPage/>}/><Route path="content/video-scripts" element={<VideoScriptsPage/>}/><Route path="content/documents" element={<DocumentsWritingPage/>}/><Route path="content/productions" element={<ProductionLibraryPage/>}/><Route path="content/templates" element={<ContentTemplatesPage/>}/><Route path="content/trash" element={<ContentTrashPage/>}/>
    <Route path="assets" element={<AssetsHomePage/>}/><Route path="assets/images" element={<AssetImagesPage/>}/><Route path="assets/videos" element={<AssetVideosPage/>}/><Route path="assets/documents" element={<AssetDocumentsPage/>}/><Route path="assets/creatives" element={<AssetCreativesPage/>}/><Route path="assets/advertisers" element={<AdvertiserAssetFoldersPage/>}/><Route path="assets/brand" element={<BrandAssetsPage/>}/><Route path="assets/prompts" element={<PromptLibraryPage/>}/><Route path="assets/trash" element={<AssetTrashPage/>}/>
    <Route path="admin" element={<AdminOnlyGate><AdminControlDashboardPage/></AdminOnlyGate>}/><Route path="admin/:sectionKey" element={<AdminOnlyGate><AdminControlPage/></AdminOnlyGate>}/>
    <Route path="planned/:moduleKey" element={<UniversePlannedPage/>}/>
    <Route path="dashboard" element={<DashboardOverviewPage/>}/><Route path="dashboard/:brandId" element={<DashboardOverviewPage/>}/>
    <Route path="kpi-goals" element={<KpiGoalsPage/>}/><Route path="today-operations" element={<TodayOperationsPage/>}/>

    <Route path="reports" element={<AdvertiserDailyReportPage/>}/>
    <Route path="report-center" element={<ReportsHubPage/>}/>
    <Route path="monthly-reports" element={<MonthlyReportManagementPage/>}/>
    <Route path="next-month-proposal" element={<NextMonthProposalManagementPage/>}/>
    <Route path="advertiser-daily-report" element={<Navigate to="/reports" replace/>}/>
    <Route path="report-builder" element={<Navigate to="/reports" replace/>}/>
    <Route path="naver-keyword-report" element={<Navigate to="/reports" replace/>}/>
    <Route path="meta-creative-report" element={<Navigate to="/reports" replace/>}/>
    <Route path="google-creative-report" element={<Navigate to="/reports" replace/>}/><Route path="db-management" element={<DbDataPage/>}/><Route path="reservation-report" element={<Navigate to="/reports" replace/>}/><Route path="monthly-analysis" element={<Navigate to="/reports" replace/>}/>
    <Route path="reports/:brandId/*" element={<Navigate to="/reports" replace/>}/>

    <Route path="keywords" element={<KeywordAnalysisBrandListPage/>}/>
    <Route path="keywords/:brandId" element={<KeywordHubLayout/>}>
      <Route index element={<Navigate to="analysis" replace/>}/><Route path="analysis" element={<KeywordAnalysisPage/>}/><Route path="performance" element={<NaverKeywordReportPage/>}/>
    </Route>

    <Route path="creatives" element={<CreativeHubLayout/>}>
      <Route index element={<Navigate to="library" replace/>}/><Route path="library" element={<CreativeLibraryPage/>}/><Route path="library/:creativeId" element={<CreativeDetailPage/>}/><Route path="performance" element={<MetaCreativeReportPage/>}/><Route path="fatigue" element={<CreativeFatiguePage/>}/><Route path="reupload" element={<CreativeReuploadPage/>}/>
    </Route>

    <Route path="conversion-funnel" element={<ConversionFunnelPage/>}/><Route path="media-performance" element={<Navigate to="/insights/media" replace/>}/>
    <Route path="search-ads/naver" element={<NaverSearchAdBrandListPage/>}/><Route path="search-ads/naver/:brandId" element={<NaverSearchAdDetailPage/>}/>
    <Route path="search-ads/google" element={<GoogleSearchAdBrandListPage/>}/><Route path="search-ads/google/:brandId" element={<GoogleSearchAdDetailPage/>}/>
    <Route path="search-ads/daangn" element={<DaangnSearchAdBrandListPage/>}/><Route path="search-ads/daangn/:brandId" element={<DaangnSearchAdDetailPage/>}/>
    <Route path="search-ads/kakao" element={<KakaoSearchAdBrandListPage/>}/><Route path="search-ads/kakao/:brandId" element={<KakaoSearchAdDetailPage/>}/>
    <Route path="campaigns" element={<CampaignManagementPage/>}/><Route path="advertisers/subscription" element={<AdvertiserSubscriptionsPage/>}/><Route path="advertisers/dashboard" element={<AdvertiserWorkspaceDashboardPage/>}/><Route path="advertisers/contacts" element={<AdvertiserContactsPage/>}/><Route path="advertisers/permissions" element={<AdvertiserPermissionsPage/>}/><Route path="advertisers/approvals" element={<AdvertiserApprovalsPage/>}/><Route path="advertisers/shared-materials" element={<AdvertiserSharedMaterialsPage/>}/><Route path="advertisers/activity" element={<AdvertiserActivityPage/>}/><Route path="advertisers/portal-preview" element={<AdvertiserPortalPreviewPage/>}/>
    <Route path="support" element={<SupportHubPage/>}/>
    <Route path="support/knowledge" element={<SupportKnowledgePage/>}/>
    <Route path="support/sales" element={<SupportSalesPage/>}/>
    <Route path="support/ops" element={<SupportOpsPage/>}/>
    <Route path="support/news" element={<SupportNewsPage/>}/>
    <Route path="support/security" element={<SupportSecurityPage/>}/>
    <Route path="ad-schedule" element={<AdOperationSchedulePage/>}/><Route path="creative-requests" element={<AdCreationPage/>}/><Route path="reservation-slots" element={<Navigate to="/ad-schedule" replace/>}/><Route path="reservation-analysis" element={<ReservationAnalysisPage/>}/><Route path="budget-recommendations" element={<BudgetRecommendationsPage/>}/><Route path="season-planner" element={<SeasonPlannerPage/>}/><Route path="promotion-schedule" element={<PromotionSchedulePage/>}/><Route path="customer-analytics" element={<CustomerAnalyticsPage/>}/><Route path="approval-queue" element={<Navigate to="/advertisers/approvals" replace/>}/><Route path="operations-history" element={<Navigate to="/automation/execution-logs" replace/>}/><Route path="advertisers" element={<AdvertiserManagementPage/>}/><Route path="kpi-conversion-settings" element={<KpiConversionSettingsPage/>}/><Route path="data-collection-status" element={<DataCollectionStatusPage/>}/><Route path="shared-links" element={<Navigate to="/advertisers/shared-materials" replace/>}/>
    <Route path="attribution-links" element={<AttributionLinksPage/>}/>
    <Route path="custom-data-upload" element={<CustomDataUploadPage/>}/>
    <Route path="project-tasks" element={<ProjectTasksPage/>}/>
    <Route path="commission-settlement" element={<CommissionSettlementPage/>}/>
    <Route path="notification-send" element={<Navigate to="/automation/notifications" replace/>}/>
    <Route path="operations-calendar" element={<CalendarHubLayout/>}><Route index element={<Navigate to="schedule" replace/>}/><Route path="schedule" element={<ScheduleSlotsPage/>}/><Route path="weather" element={<WeatherSeasonCalendarPage/>}/></Route>
    <Route path="brands-budget" element={<BrandsBudgetPage/>}/>
    <Route path="automation" element={<AutomationHubLayout/>}><Route index element={<Navigate to="overview" replace/>}/><Route path="overview" element={<AutomationOverviewPage/>}/><Route path="scheduled-jobs" element={<ScheduledJobsPage/>}/><Route path="data-collection" element={<DataAutoCollectionPage/>}/><Route path="report-generation" element={<ReportAutomationPage/>}/><Route path="ad-copy" element={<AdCopyAutomationPage/>}/><Route path="notifications" element={<NotificationAutomationPage/>}/><Route path="workflows" element={<WorkflowsPage/>}/><Route path="execution-logs" element={<ExecutionLogsPage/>}/><Route path="rules" element={<AutomationRulesPage/>}/><Route path="alerts" element={<Navigate to="/automation/execution-logs" replace/>}/></Route>
    <Route path="ad-accounts" element={<AdAccountsHubLayout/>}><Route index element={<Navigate to="connections" replace/>}/><Route path="connections" element={<AdAccountsPage/>}/><Route path="data-sync" element={<DataSyncPage/>}/></Route>
    <Route path="settings" element={<PlatformSettingsHubPage/>}/><Route path="settings/control/:sectionKey" element={<PlatformSettingsSectionPage/>}/><Route path="settings/advanced/:sectionKey" element={<SettingsDetailPage/>}/><Route path="settings/:sectionKey" element={<LegacySettingsRedirect/>}/>

    <Route path="keyword-analysis" element={<LegacyKeywordRedirect/>}/><Route path="keyword-analysis/:brandId" element={<LegacyKeywordRedirect/>}/>
    <Route path="creative-library" element={<Navigate to="/creatives/library" replace/>}/><Route path="creative-library/:creativeId" element={<LegacyCreativeDetail/>}/>
    <Route path="creative-fatigue" element={<Navigate to="/creatives/fatigue" replace/>}/><Route path="creative-reupload" element={<Navigate to="/creatives/reupload" replace/>}/>
    <Route path="automation-rules" element={<Navigate to="/automation/overview" replace/>}/><Route path="alerts-logs" element={<Navigate to="/automation/execution-logs" replace/>}/>
    <Route path="schedule-slots" element={<Navigate to="/operations-calendar/schedule" replace/>}/><Route path="weather-season-calendar" element={<Navigate to="/operations-calendar/weather" replace/>}/>
    <Route path="*" element={<NotFoundPage/>}/>
  </Route>
</Routes></AuthGate></AppErrorBoundary>;
}
