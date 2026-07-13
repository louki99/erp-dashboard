import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ProtectedRoute } from '@/components/rbac';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import { Login } from '@/pages/Login';
import { PartnerManagementPage } from '@/pages/partners/PartnerManagementPage';
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
import { MagasinierDashboard } from '@/pages/magasinier/MagasinierDashboard';
import { MagasinierPreparationsPage } from '@/pages/magasinier/MagasinierPreparationsPage';
import { MagasinierStockPage } from '@/pages/magasinier/MagasinierStockPage';
import { MagasinierBatchPickingPage } from '@/pages/magasinier/MagasinierBatchPickingPage';
import { ProductsPage } from '@/pages/products/ProductsPage';
import { ProductMasterDataPage } from '@/pages/products/ProductMasterDataPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { ConfigurationSettingsPage } from '@/pages/settings/ConfigurationSettingsPage';
import { PromotionsPage } from '@/pages/promotions/PromotionsPage';
import { PromotionForm } from '@/pages/promotions/components/PromotionForm';
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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />

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

      {/* Settings Routes */}
      <Route path="/settings" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.SETTINGS.GENERAL}>
          <SettingsPage />
        </ProtectedRoute>
      } />
      <Route path="/settings/configuration" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.SETTINGS.GENERAL}>
          <ConfigurationSettingsPage />
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

      {/* Partner Families Routes */}
      <Route path="/promotions/partner-families" element={
        <ProtectedRoute>
          <PartnerFamiliesPage />
        </ProtectedRoute>
      } />
      <Route path="/promotions/partner-families/new" element={
        <ProtectedRoute>
          <PromotionForm />
        </ProtectedRoute>
      } />
      <Route path="/promotions/partner-families/:id/edit" element={
        <ProtectedRoute>
          <PromotionForm isEdit />
        </ProtectedRoute>
      } />

      {/* Product Families Routes */}
      <Route path="/promotions/product-families" element={
        <ProtectedRoute>
          <ProductFamiliesPage />
        </ProtectedRoute>
      } />
      <Route path="/promotions/product-families/new" element={
        <ProtectedRoute>
          <PromotionForm />
        </ProtectedRoute>
      } />
      <Route path="/promotions/product-families/:id/edit" element={
        <ProtectedRoute>
          <PromotionForm isEdit />
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
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_PARTNERS}>
          <ChannelsPage />
        </ProtectedRoute>
      } />
      <Route path="/pricing/chronologies" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DYNAMIC.MANAGE_PARTNERS}>
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

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
              <Toaster position="top-right" />
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
