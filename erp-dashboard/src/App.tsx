import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { getDefaultRoute } from '@/lib/rbac/defaultRoute';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ProtectedRoute } from '@/components/rbac';
import { MaintenanceBanner } from '@/components/layout/MaintenanceBanner';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import { Login } from '@/pages/Login';
import { PartnerManagementPage } from '@/pages/partners/PartnerManagementPage';
import ClientGroupsPage from '@/pages/partners/ClientGroupsPage';
import DevisPage from '@/pages/gcom/DevisPage';
import ComptoirPage from '@/pages/gcom/ComptoirPage';
import FacturesPage from '@/pages/gcom/FacturesPage';
import BonCommandePage from '@/pages/gcom/BonCommandePage';
import BonLivraisonPage from '@/pages/gcom/BonLivraisonPage';
import ReglementPage from '@/pages/gcom/ReglementPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { PartnerBalancesPage } from '@/pages/partners/PartnerBalancesPage';
import { Dashboard } from '@/pages/Dashboard';
import { ProfilePage } from '@/pages/ProfilePage';
import { AdvDashboard } from '@/pages/adv/AdvDashboard';
import { AdvValidationPage } from '@/pages/adv/AdvValidationPage';
import { AdvPartnersPage } from '@/pages/adv/AdvPartnersPage';
import { AdvCreditPage } from '@/pages/adv/AdvCreditPage';
import { AdvEcheancesPage } from '@/pages/adv/AdvEcheancesPage';
import { AdvDerogationsPage } from '@/pages/adv/AdvDerogationsPage';
import { DispatcherDashboard } from '@/pages/dispatcher/DispatcherDashboard';
import { DispatcherOrdersPage } from '@/pages/dispatcher/DispatcherOrdersPage';
import { DispatcherBonLivraisonsPage } from '@/pages/dispatcher/DispatcherBonLivraisonsPage';
import { DispatcherShortageQueuePage } from '@/pages/dispatcher/DispatcherShortageQueuePage';
import { DispatcherDechargesPage } from '@/pages/dispatcher/DispatcherDechargesPage';
import { DispatcherMissionWorkspacePage } from '@/pages/dispatcher/DispatcherMissionWorkspacePage';
import { DispatcherMapWorkspacePage } from '@/pages/dispatcher/DispatcherMapWorkspacePage';
import { DispatcherMonitorPage } from '@/pages/dispatcher/DispatcherMonitorPage';
import { DispatcherWarehouseTransfersPage } from '@/pages/dispatcher/DispatcherWarehouseTransfersPage';
import { DispatcherFleetPage } from '@/pages/dispatcher/DispatcherFleetPage';
import { DispatcherMissionPlanningPage } from '@/pages/dispatcher/DispatcherMissionPlanningPage';
import { DispatcherRouteOptimizerPage } from '@/pages/dispatcher/DispatcherRouteOptimizerPage';
import { MagasinierDashboard } from '@/pages/magasinier/MagasinierDashboard';
import { MagasinierPreparationsPage } from '@/pages/magasinier/MagasinierPreparationsPage';
import { MagasinierStockPage } from '@/pages/magasinier/MagasinierStockPage';
import { MagasinierBatchPickingPage } from '@/pages/magasinier/MagasinierBatchPickingPage';
import { MagasinierConventionalLoadingPage } from '@/pages/magasinier/MagasinierConventionalLoadingPage';
import { MagasinierDechargeReconciliationPage } from '@/pages/magasinier/MagasinierDechargeReconciliationPage';
import { MagasinierDechargePage } from '@/pages/magasinier/MagasinierDechargePage';
import { MagasinierReturnsPage } from '@/pages/magasinier/MagasinierReturnsPage';
import { TelesalesSchedulesPage } from '@/pages/telesales/TelesalesSchedulesPage';
import { TelesalesAssignmentsPage } from '@/pages/telesales/TelesalesAssignmentsPage';
import { TelesalesMonitoringPage } from '@/pages/telesales/TelesalesMonitoringPage';
import { TelesalesAgentDashboardPage } from '@/pages/telesales/TelesalesAgentDashboardPage';
import { TelesalesPlanningPage } from '@/pages/telesales/TelesalesPlanningPage';
import { TelesalesVisitPage } from '@/pages/telesales/TelesalesVisitPage';
import { TelesalesCatalogPage } from '@/pages/telesales/TelesalesCatalogPage';
import { TelesalesOrderPage } from '@/pages/telesales/TelesalesOrderPage';
import { TelesalesCockpitPage } from '@/pages/telesales/TelesalesCockpitPage';
import { TelesalesOrdersListPage } from '@/pages/telesales/TelesalesOrdersListPage';
import { TelesalesDevisListPage } from '@/pages/telesales/TelesalesDevisListPage';
import { TelesalesDevisDetailPage } from '@/pages/telesales/TelesalesDevisDetailPage';
import { TelesalesPortfolioPage } from '@/pages/telesales/TelesalesPortfolioPage';
import { TelesalesReturnsPage } from '@/pages/telesales/TelesalesReturnsPage';
import { ProductsPage } from '@/pages/products/ProductsPage';
import { ProductMasterDataPage } from '@/pages/products/ProductMasterDataPage';
import { ProductLogisticsPage } from '@/pages/products/ProductLogisticsPage';
import { ProductPackagingsPage } from '@/pages/products/ProductPackagingsPage';
import { ConfigurationSettingsPage } from '@/pages/settings/ConfigurationSettingsPage';
import { PromotionsPage } from '@/pages/promotions/PromotionsPage';
import { PromotionFormRedesigned } from '@/pages/promotions/components/PromotionFormRedesigned';
import { PartnerFamiliesPage } from '@/pages/promotions/PartnerFamiliesPage';
import { ProductFamiliesPage } from '@/pages/promotions/ProductFamiliesPage';
import { BoostsPage } from '@/pages/promotions/BoostsPage';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ImportExportPage } from '@/pages/import-export/ImportExportPage';
import { ImportPage } from '@/pages/import-export/ImportPage';
import { ExportPage } from '@/pages/import-export/ExportPage';
import { BatchHistoryPage } from '@/pages/import-export/BatchHistoryPage';
import { TemplatesPage } from '@/pages/import-export/TemplatesPage';
import { TemplateDetailPage } from '@/pages/import-export/TemplateDetailPage';
import { WorkflowTemplatesPage } from '@/pages/workflows/WorkflowTemplatesPage';
import { WorkflowDetailPage } from '@/pages/workflows/WorkflowDetailPage';
import { WorkflowCreatePage } from './pages/workflows/WorkflowCreatePage';

import { StockManagementPage } from '@/pages/stock/StockManagementPage';
import { WarehousesPage } from '@/pages/stock/WarehousesPage';
import { StockConsultationPage } from '@/pages/stock/StockConsultationPage';
import { PreparationBillsPage } from '@/pages/stock/PreparationBillsPage';
import { WmsStockMatrixPage } from '@/pages/stock/WmsStockMatrixPage';
import { WmsPickPackPage } from '@/pages/stock/WmsPickPackPage';
import { WmsBatchExpiryPage } from '@/pages/stock/WmsBatchExpiryPage';
import { WmsReceiptPage } from '@/pages/stock/WmsReceiptPage';
import { WmsTransferPage } from '@/pages/stock/WmsTransferPage';
import { WmsAdjustmentPage } from '@/pages/stock/WmsAdjustmentPage';
import { PricingHubPage } from '@/pages/pricing/PricingHubPage';
import { PriceListsPage } from '@/pages/pricing/PriceListsPage';
import { OverridesPage } from '@/pages/pricing/OverridesPage';
import { PackagingPricesPage } from '@/pages/pricing/PackagingPricesPage';
import { PricePreviewPage } from '@/pages/pricing/PricePreviewPage';
import { ChannelsPage } from '@/pages/pricing/ChannelsPage';
import { BusinessChronologiesPage } from '@/pages/pricing/BusinessChronologiesPage';
import { CustomFieldsPage } from '@/pages/custom-fields/CustomFieldsPage';
import ReportingPage from '@/pages/reporting/ReportingPage';
import ReportingAdminPage from '@/pages/reporting/ReportingAdminPage';
import DocumentStudioPage from '@/pages/document-studio/DocumentStudioPage';
import { DataRulesPage } from '@/pages/data-rules/DataRulesPage';
import { TokenSeriesPage } from '@/pages/token-series/TokenSeriesPage';
import { DeviceKeysPage } from '@/pages/device-keys/DeviceKeysPage';
import { JournalsPage } from '@/pages/finance/JournalsPage';
import { LedgerPage } from '@/pages/finance/LedgerPage';
import { TransfersPage } from '@/pages/finance/TransfersPage';
import { SettlementsPage } from '@/pages/finance/SettlementsPage';
import { GeoAreasPage } from '@/pages/routing/GeoAreasPage';
import { GeoGovernancePage } from '@/pages/routing/GeoGovernancePage';
import { ItineraryTypesPage } from '@/pages/routing/ItineraryTypesPage';
import { BusinessNaturesPage } from '@/pages/routing/BusinessNaturesPage';
import { ItinerariesPage } from '@/pages/routing/ItinerariesPage';
import { ItineraryDesignerPage } from '@/pages/routing/ItineraryDesignerPage';
import { PlanningPage } from '@/pages/routing/PlanningPage';
import { RolesListPage } from '@/pages/rbac/RolesListPage';
import { PermissionMatrixPage } from '@/pages/rbac/PermissionMatrixPage';
import { UsersAccessPage } from '@/pages/rbac/UsersAccessPage';
import { AccessProfilesPage } from '@/pages/rbac/AccessProfilesPage';
import { TranslationsPage } from '@/pages/translations/TranslationsPage';
import { AuditPage } from '@/pages/audit/AuditPage';
import { BackupPage } from '@/pages/backup/BackupPage';
import { DispatcherNewOrderAlert } from '@/components/dispatcher/DispatcherNewOrderAlert';
import SuperAdminPage from '@/pages/superadmin/SuperAdminPage';


// Simple Navigation Wrapper to show active route in DevSwitcher style (optional, but let's stick to MegaMenu for now)
// Actually, let's remove the floating dev switcher and rely on the Mega Menu or URL.
// But wait, the Mega Menu doesn't navigate yet?
// We should probably assume the MegaMenu will handle navigation.
// For now, let's just setup the routes.

// Dashboard Layout Wrapper
const DashboardPage = () => {
  return (
    <MasterLayout
      leftContent={<div className="bg-white h-full p-4 border-r border-gray-100"><p className="text-xs text-gray-400">Quick Widgets</p></div>}
      mainContent={<div className="h-full overflow-y-auto"><Dashboard /></div>}
      className=""
    />
  );
};

// Role-aware landing for "/" and any unmatched route — most roles land on the
// generic /dashboard, but roles without PERMISSIONS.DASHBOARD.VIEW (e.g. télévendeur)
// need their own home or they hit "Accès Refusé" every time they land here.
function DefaultRedirect() {
  const { user } = useAuth();
  return <Navigate to={getDefaultRoute(user)} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      <Route path="/" element={<ProtectedRoute><DefaultRedirect /></ProtectedRoute>} />

      <Route path="/dashboard" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DASHBOARD.VIEW}>
          <DashboardPage />
        </ProtectedRoute>
      } />

      <Route path="/partners" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.PARTNERS.INDEX}>
          <PartnerManagementPage />
        </ProtectedRoute>
      } />

      <Route path="/partners/balances" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.PARTNERS.INDEX}>
          <PartnerBalancesPage />
        </ProtectedRoute>
      } />

      <Route path="/partners/client-groups" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.PARTNERS.INDEX}>
          <ClientGroupsPage />
        </ProtectedRoute>
      } />

      <Route path="/gcom/devis" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_GCOM}>
          <DevisPage />
        </ProtectedRoute>
      } />

      <Route path="/gcom/comptoir" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_GCOM}>
          <ComptoirPage />
        </ProtectedRoute>
      } />

      <Route path="/gcom/factures" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_GCOM}>
          <FacturesPage />
        </ProtectedRoute>
      } />

      <Route path="/gcom/bons-commande" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_GCOM}>
          <BonCommandePage />
        </ProtectedRoute>
      } />

      <Route path="/gcom/bons-livraison" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_GCOM}>
          <BonLivraisonPage />
        </ProtectedRoute>
      } />

      <Route path="/gcom/reglement" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_GCOM}>
          <ReglementPage />
        </ProtectedRoute>
      } />

      <Route path="/orders" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.BON_COMMANDES.INDEX}>
          <OrdersPage />
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      } />

      {/* ADV Module Routes */}
      <Route path="/adv" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.ADV.DASHBOARD}>
          <AdvDashboard />
        </ProtectedRoute>
      } />

      <Route path="/adv/dashboard" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.ADV.DASHBOARD}>
          <AdvDashboard />
        </ProtectedRoute>
      } />

      <Route path="/adv/validation" element={
        <ProtectedRoute requiredPermission={[PERMISSIONS.ADV.BC_INDEX, PERMISSIONS.ADV.BC_PENDING]}>
          <AdvValidationPage />
        </ProtectedRoute>
      } />

      <Route path="/adv/partners" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.ADV.PARTNERS_INDEX}>
          <AdvPartnersPage />
        </ProtectedRoute>
      } />

      <Route path="/adv/credit" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.ADV.CREDIT_INDEX}>
          <AdvCreditPage />
        </ProtectedRoute>
      } />

      <Route path="/adv/echeances" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.ADV.ECHEANCES_INDEX}>
          <AdvEcheancesPage />
        </ProtectedRoute>
      } />

      <Route path="/adv/derogations" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.ADV.BC_INDEX}>
          <AdvDerogationsPage />
        </ProtectedRoute>
      } />

      {/* Dispatcher Module Routes — gated by role, not permission slugs. Confirmed by backend
          2026-06-17: /dispatcher/* auth is role-based only (auth:sanctum + role
          dispatcher/root/admin); none of the PERMISSIONS.DISPATCHER.* slugs below actually exist
          on the backend's permission table, so requiredPermission silently blocked every
          non-admin dispatcher user (hasAny() only auto-passes for admin role). */}
      <Route path="/dispatcher" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherDashboard />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/dashboard" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherDashboard />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/orders" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherOrdersPage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/bons-livraisons" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherBonLivraisonsPage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/shortage-queue" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherShortageQueuePage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/workspace/missions" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherMissionWorkspacePage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/workspace/map" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherMapWorkspacePage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/monitor" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherMonitorPage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/decharges" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherDechargesPage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/warehouse-transfers" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherWarehouseTransfersPage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/fleet" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherFleetPage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/mission-planning" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherMissionPlanningPage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/route-optimizer" element={
        <ProtectedRoute requiredRole={['dispatcher', 'root', 'admin']}>
          <DispatcherRouteOptimizerPage />
        </ProtectedRoute>
      } />

      {/* Magasinier Module Routes */}
      <Route path="/magasinier" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.MAGASINIER.DASHBOARD}>
          <MagasinierDashboard />
        </ProtectedRoute>
      } />

      <Route path="/magasinier/dashboard" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.MAGASINIER.DASHBOARD}>
          <MagasinierDashboard />
        </ProtectedRoute>
      } />

      <Route path="/magasinier/preparations" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.MAGASINIER.PREPARATIONS_PENDING}>
          <MagasinierPreparationsPage />
        </ProtectedRoute>
      } />

      <Route path="/magasinier/stock" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.MAGASINIER.STOCK_INDEX}>
          <MagasinierStockPage />
        </ProtectedRoute>
      } />

      <Route path="/magasinier/batch-picking" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.MAGASINIER.PREPARATIONS_PENDING}>
          <MagasinierBatchPickingPage />
        </ProtectedRoute>
      } />

      <Route path="/magasinier/conventional-loading" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'magasinier']}>
          <MagasinierConventionalLoadingPage />
        </ProtectedRoute>
      } />

      <Route path="/magasinier/decharge-reconciliation" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'magasinier']}>
          <MagasinierDechargeReconciliationPage />
        </ProtectedRoute>
      } />

      <Route path="/magasinier/decharges" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'magasinier', 'dispatcher']}>
          <MagasinierDechargePage />
        </ProtectedRoute>
      } />

      <Route path="/magasinier/returns" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'magasinier']}>
          <MagasinierReturnsPage />
        </ProtectedRoute>
      } />

      {/* Télévendeur — Admin/Superviseur (Lot 1). Base URL /api/backend/admin/telesales/...,
          role admin|root ONLY — never granted to `televendeur` (confirmed 403 in spec §7). */}
      <Route path="/telesales/admin/schedules" element={
        <ProtectedRoute requiredRole={['admin', 'root']}>
          <TelesalesSchedulesPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/admin/assignments" element={
        <ProtectedRoute requiredRole={['admin', 'root']}>
          <TelesalesAssignmentsPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/admin/monitoring" element={
        <ProtectedRoute requiredRole={['admin', 'root']}>
          <TelesalesMonitoringPage />
        </ProtectedRoute>
      } />

      {/* Télévendeur — Agent (Lot 2). Base URL /api/backend/telesales/...,
          role televendeur|admin|root — distinct from the admin-only routes above. */}
      <Route path="/telesales/dashboard" element={
        <ProtectedRoute requiredRole={['televendeur', 'admin', 'root']}>
          <TelesalesAgentDashboardPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/planning" element={
        <ProtectedRoute requiredRole={['televendeur', 'admin', 'root']}>
          <TelesalesPlanningPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/visits/:id" element={
        <ProtectedRoute requiredRole={['televendeur', 'admin', 'root']}>
          <TelesalesVisitPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/cockpit" element={
        <ProtectedRoute requiredRole={['televendeur', 'admin', 'root']}>
          <TelesalesCockpitPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/catalog" element={
        <ProtectedRoute requiredRole={['televendeur', 'admin', 'root']}>
          <TelesalesCatalogPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/orders" element={
        <ProtectedRoute requiredRole={['televendeur', 'admin', 'root']}>
          <TelesalesOrdersListPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/orders/new" element={
        <ProtectedRoute requiredRole={['televendeur', 'admin', 'root']}>
          <TelesalesOrderPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/orders/:id" element={
        <ProtectedRoute requiredRole={['televendeur', 'admin', 'root']}>
          <TelesalesOrderPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/devis" element={
        <ProtectedRoute requiredRole={['televendeur', 'admin', 'root']}>
          <TelesalesDevisListPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/devis/:id" element={
        <ProtectedRoute requiredRole={['televendeur', 'admin', 'root']}>
          <TelesalesDevisDetailPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/portfolio" element={
        <ProtectedRoute requiredRole={['televendeur', 'admin', 'root']}>
          <TelesalesPortfolioPage />
        </ProtectedRoute>
      } />

      <Route path="/telesales/returns" element={
        <ProtectedRoute requiredRole={['televendeur', 'admin', 'root']}>
          <TelesalesReturnsPage />
        </ProtectedRoute>
      } />

      {/* Products Module Routes */}
      <Route path="/products" element={
        <ProtectedRoute>
          <ProductsPage />
        </ProtectedRoute>
      } />

      <Route path="/products/master-data" element={
        <ProtectedRoute>
          <ProductMasterDataPage />
        </ProtectedRoute>
      } />

      <Route path="/products/logistics" element={
        <ProtectedRoute>
          <ProductLogisticsPage />
        </ProtectedRoute>
      } />
      <Route path="/products/packagings" element={
        <ProtectedRoute>
          <ProductPackagingsPage />
        </ProtectedRoute>
      } />

      {/* Settings Routes */}
      <Route path="/settings" element={<Navigate to="/settings/configuration" replace />} />
      <Route path="/settings/configuration" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.SETTINGS.GENERAL}>
          <ConfigurationSettingsPage />
        </ProtectedRoute>
      } />

      {/* Audit Trail */}
      <Route path="/audit" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.AUDIT.VIEW}>
          <AuditPage />
        </ProtectedRoute>
      } />

      {/* Backup & Restore */}
      <Route path="/backup" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.BACKUP.BROWSE}>
          <BackupPage />
        </ProtectedRoute>
      } />

      {/* Promotion Routes */}
      <Route path="/promotions" element={
        <ProtectedRoute>
          <PromotionsPage />
        </ProtectedRoute>
      } />
      <Route path="/promotions/new" element={
        <ProtectedRoute>
          <PromotionFormRedesigned />
        </ProtectedRoute>
      } />
      <Route path="/promotions/:id/edit" element={
        <ProtectedRoute>
          <PromotionFormRedesigned />
        </ProtectedRoute>
      } />

      {/* Partner Families Routes — création/édition gérées dans la page */}
      <Route path="/promotions/partner-families" element={
        <ProtectedRoute>
          <PartnerFamiliesPage />
        </ProtectedRoute>
      } />

      {/* Product Families Routes — création/édition gérées dans la page */}
      <Route path="/promotions/product-families" element={
        <ProtectedRoute>
          <ProductFamiliesPage />
        </ProtectedRoute>
      } />

      {/* Boosts Routes */}
      <Route path="/promotions/boosts" element={
        <ProtectedRoute>
          <BoostsPage />
        </ProtectedRoute>
      } />

      {/* Import/Export Module Routes */}
      <Route path="/import-export" element={
        <ProtectedRoute>
          <ImportExportPage />
        </ProtectedRoute>
      } />
      <Route path="/import-export/import" element={
        <ProtectedRoute>
          <ImportPage />
        </ProtectedRoute>
      } />
      <Route path="/import-export/export" element={
        <ProtectedRoute>
          <ExportPage />
        </ProtectedRoute>
      } />
      <Route path="/import-export/batches" element={
        <ProtectedRoute>
          <BatchHistoryPage />
        </ProtectedRoute>
      } />
      <Route path="/import-export/templates" element={
        <ProtectedRoute>
          <TemplatesPage />
        </ProtectedRoute>
      } />
      <Route path="/import-export/templates/:id" element={
        <ProtectedRoute>
          <TemplateDetailPage />
        </ProtectedRoute>
      } />

      {/* Workflow Template Management Routes */}
      <Route path="/workflows" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.WORKFLOW_TEMPLATES.INDEX}>
          <WorkflowTemplatesPage />
        </ProtectedRoute>
      } />
      <Route path="/workflows/create" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.WORKFLOW_TEMPLATES.CREATE}>
          <WorkflowCreatePage />
        </ProtectedRoute>
      } />
      <Route path="/workflows/:id" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.WORKFLOW_TEMPLATES.SHOW}>
          <WorkflowDetailPage />
        </ProtectedRoute>
      } />


      {/* Stock Management Module (legacy) */}
      <Route path="/stock-management" element={
        <ProtectedRoute>
          <StockManagementPage />
        </ProtectedRoute>
      } />

      {/* Stock / Warehouse Module */}
      <Route path="/stock" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'dispatcher', 'magasinier']}>
          <Navigate to="/stock/warehouses" replace />
        </ProtectedRoute>
      } />
      <Route path="/stock/warehouses" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'dispatcher', 'magasinier']}>
          <WarehousesPage />
        </ProtectedRoute>
      } />
      <Route path="/stock/consultation" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'dispatcher', 'magasinier']}>
          <StockConsultationPage />
        </ProtectedRoute>
      } />
      <Route path="/stock/preparation-bills" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'dispatcher', 'magasinier']}>
          <PreparationBillsPage />
        </ProtectedRoute>
      } />

      {/* WMS Tier 2/3 — Matrice stocks, Pick & Pack, Lots & Péremption */}
      <Route path="/stock/wms-matrix" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'dispatcher', 'magasinier']}>
          <WmsStockMatrixPage />
        </ProtectedRoute>
      } />
      <Route path="/stock/wms-pick-pack" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'dispatcher', 'magasinier']}>
          <WmsPickPackPage />
        </ProtectedRoute>
      } />
      <Route path="/stock/wms-batches" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'dispatcher', 'magasinier']}>
          <WmsBatchExpiryPage />
        </ProtectedRoute>
      } />

      {/* WMS Actions — Réception, Transfert, Ajustement */}
      <Route path="/stock/wms-receipt" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'dispatcher', 'magasinier']}>
          <WmsReceiptPage />
        </ProtectedRoute>
      } />
      <Route path="/stock/wms-transfer" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'dispatcher', 'magasinier']}>
          <WmsTransferPage />
        </ProtectedRoute>
      } />
      <Route path="/stock/wms-adjustment" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'dispatcher', 'magasinier']}>
          <WmsAdjustmentPage />
        </ProtectedRoute>
      } />

      {/* Pricing Hub & Sub-pages */}
      <Route path="/pricing" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_PRICING}>
          <PricingHubPage />
        </ProtectedRoute>
      } />
      <Route path="/pricing/price-lists" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_PRICING}>
          <PriceListsPage />
        </ProtectedRoute>
      } />
      <Route path="/pricing/overrides" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_PRICING}>
          <OverridesPage />
        </ProtectedRoute>
      } />
      <Route path="/pricing/packaging-prices" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_PRICING}>
          <PackagingPricesPage />
        </ProtectedRoute>
      } />
      <Route path="/pricing/preview" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_PRICING}>
          <PricePreviewPage />
        </ProtectedRoute>
      } />
      <Route path="/pricing/channels" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_CHANNELS}>
          <ChannelsPage />
        </ProtectedRoute>
      } />
      <Route path="/pricing/chronologies" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_CHRONOLOGIES}>
          <BusinessChronologiesPage />
        </ProtectedRoute>
      } />

      {/* Custom Fields Management */}
      <Route path="/custom-fields" element={
        <ProtectedRoute>
          <CustomFieldsPage />
        </ProtectedRoute>
      } />


      {/* Reporting Module */}
      <Route path="/reporting" element={
        <ProtectedRoute>
          <ReportingPage />
        </ProtectedRoute>
      } />
      <Route path="/reporting/admin" element={
        <ProtectedRoute requiredRole={['admin', 'root']}>
          <ReportingAdminPage />
        </ProtectedRoute>
      } />

      {/* Document Studio Module */}
      <Route path="/document-studio" element={
        <ProtectedRoute>
          <DocumentStudioPage />
        </ProtectedRoute>
      } />

      {/* Data Rules Module */}
      <Route path="/data-rules" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DATA_RULES.MANAGE}>
          <DataRulesPage />
        </ProtectedRoute>
      } />

      {/* Token Series & Device Keys Module */}
      <Route path="/token-series" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.TOKEN_SERIES.MANAGE}>
          <TokenSeriesPage />
        </ProtectedRoute>
      } />
      <Route path="/device-keys" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DEVICE_KEYS.MANAGE}>
          <DeviceKeysPage />
        </ProtectedRoute>
      } />

      {/* Routing / Sectorisation / Tournées — role-based access (admin | root | routing) */}
      <Route path="/routing" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'routing']}>
          <Navigate to="/routing/geo-governance" replace />
        </ProtectedRoute>
      } />
      <Route path="/routing/geo-governance" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'routing']}>
          <GeoGovernancePage />
        </ProtectedRoute>
      } />
      <Route path="/routing/geo-areas" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'routing']}>
          <GeoAreasPage />
        </ProtectedRoute>
      } />
      <Route path="/routing/itinerary-types" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'routing']}>
          <ItineraryTypesPage />
        </ProtectedRoute>
      } />
      <Route path="/routing/business-natures" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'routing']}>
          <BusinessNaturesPage />
        </ProtectedRoute>
      } />
      <Route path="/routing/itineraries" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'routing']}>
          <ItinerariesPage />
        </ProtectedRoute>
      } />
      <Route path="/routing/designer" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'routing']}>
          <ItineraryDesignerPage />
        </ProtectedRoute>
      } />
      <Route path="/routing/planning" element={
        <ProtectedRoute requiredRole={['admin', 'root', 'routing']}>
          <PlanningPage />
        </ProtectedRoute>
      } />

      {/* Finance Module Routes */}
      <Route path="/finance/journals" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.FINANCE.JOURNALS}>
          <JournalsPage />
        </ProtectedRoute>
      } />
      <Route path="/finance/ledger" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.FINANCE.LEDGER}>
          <LedgerPage />
        </ProtectedRoute>
      } />
      <Route path="/finance/transfers" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.FINANCE.TRANSFERS}>
          <TransfersPage />
        </ProtectedRoute>
      } />
      <Route path="/finance/settlements" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.FINANCE.SETTLEMENTS}>
          <SettlementsPage />
        </ProtectedRoute>
      } />

      {/* RBAC Module Routes */}
      <Route path="/rbac/roles" element={
        <ProtectedRoute requiredPermission="manage-rbac">
          <RolesListPage />
        </ProtectedRoute>
      } />
      <Route path="/rbac/matrix" element={
        <ProtectedRoute requiredPermission="manage-rbac">
          <PermissionMatrixPage />
        </ProtectedRoute>
      } />
      <Route path="/rbac/users" element={
        <ProtectedRoute requiredPermission="manage-rbac">
          <UsersAccessPage />
        </ProtectedRoute>
      } />
      <Route path="/rbac/access-profiles" element={
        <ProtectedRoute requiredPermission="manage-rbac">
          <AccessProfilesPage />
        </ProtectedRoute>
      } />

      {/* Translations Module */}
      <Route path="/translations" element={
        <ProtectedRoute requiredPermission="manage-master-data">
          <TranslationsPage />
        </ProtectedRoute>
      } />

      {/* Super Admin — restricted to root / super_admin */}
      <Route path="/super-admin" element={
        <ProtectedRoute requiredRole={['root', 'super_admin', 'superadmin']}>
          <SuperAdminPage />
        </ProtectedRoute>
      } />

      {/* Catch all */}
      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <AppRoutes />
              <DispatcherNewOrderAlert />
              <Toaster position="top-right" />
              <MaintenanceBanner />
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
