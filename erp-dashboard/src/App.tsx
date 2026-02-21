import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
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
import { DispatcherCreateBonChargementPage } from '@/pages/dispatcher/DispatcherCreateBonChargementPage';
import { DispatcherBonChargementsPage } from '@/pages/dispatcher/DispatcherBonChargementsPage';
import { DispatcherDechargesPage } from '@/pages/dispatcher/DispatcherDechargesPage';
import { MagasinierDashboard } from '@/pages/magasinier/MagasinierDashboard';
import { MagasinierPreparationsPage } from '@/pages/magasinier/MagasinierPreparationsPage';
import { MagasinierOrdersPage } from '@/pages/magasinier/MagasinierOrdersPage';
import { MagasinierStockPage } from '@/pages/magasinier/MagasinierStockPage';
import { MagasinierBatchPickingPage } from '@/pages/magasinier/MagasinierBatchPickingPage';
import { ProductsPage } from '@/pages/products/ProductsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { PromotionsPage } from '@/pages/promotions/PromotionsPage';
import { PromotionForm } from '@/pages/promotions/components/PromotionForm';
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
import { TaskDashboard } from '@/pages/tasks/TaskDashboard';
import { TaskDetailPage } from '@/pages/tasks/TaskDetailPage';
import { WorkflowTemplatesPage } from '@/pages/workflows/WorkflowTemplatesPage';
import { WorkflowDetailPage } from '@/pages/workflows/WorkflowDetailPage';
import { WorkflowCreatePage } from './pages/workflows/WorkflowCreatePage';
import { TaskTemplateDetailPage } from './pages/workflows/TaskTemplateDetailPage';
import { WorkflowMonitoringPage } from '@/pages/workflows/WorkflowMonitoringPage';
import { AdminMonitoringDashboard } from '@/pages/admin/AdminMonitoringDashboard';
import { StockManagementPage } from '@/pages/stock/StockManagementPage';
import { PricingManagementPage } from '@/pages/pricing/PricingManagementPage';
import { CustomFieldsPage } from '@/pages/custom-fields/CustomFieldsPage';


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

      {/* Dispatcher Module Routes */}
      <Route path="/dispatcher" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DISPATCHER.DASHBOARD}>
          <DispatcherDashboard />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/dashboard" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DISPATCHER.DASHBOARD}>
          <DispatcherDashboard />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/orders" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DISPATCHER.ORDERS_PENDING}>
          <DispatcherOrdersPage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/bon-livraisons/draft" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DISPATCHER.BON_LIVRAISONS_DRAFT}>
          <DispatcherBonLivraisonsPage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/bon-livraisons" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DISPATCHER.BON_LIVRAISONS_INDEX}>
          <DispatcherBonLivraisonsPage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/bon-chargements/create" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DISPATCHER.BON_CHARGEMENTS_CREATE}>
          <DispatcherCreateBonChargementPage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/bon-chargements" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DISPATCHER.BON_CHARGEMENTS_INDEX}>
          <DispatcherBonChargementsPage />
        </ProtectedRoute>
      } />

      <Route path="/dispatcher/decharges" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DISPATCHER.DECHARGES_INDEX}>
          <DispatcherDechargesPage />
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

      <Route path="/magasinier/orders" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.MAGASINIER.PREPARATIONS_PENDING}>
          <MagasinierOrdersPage />
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

      {/* Settings Routes */}
      <Route path="/settings" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.SETTINGS.GENERAL}>
          <SettingsPage />
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
          <PromotionForm />
        </ProtectedRoute>
      } />
      <Route path="/promotions/:id/edit" element={
        <ProtectedRoute>
          <PromotionForm isEdit />
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

      {/* Task Workflow Management Routes */}
      <Route path="/tasks" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.TASKS.DASHBOARD}>
          <TaskDashboard />
        </ProtectedRoute>
      } />
      <Route path="/tasks/:taskId" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.TASKS.SHOW}>
          <TaskDetailPage />
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
      <Route path="/workflows/:workflowId/templates/:templateId" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.WORKFLOW_TEMPLATES.TASKS_SHOW}>
          <TaskTemplateDetailPage />
        </ProtectedRoute>
      } />
      <Route path="/workflows/monitoring" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.WORKFLOW_TEMPLATES.INDEX}>
          <WorkflowMonitoringPage />
        </ProtectedRoute>
      } />

      {/* Stock Management Module */}
      <Route path="/stock-management" element={
        <ProtectedRoute>
          <StockManagementPage />
        </ProtectedRoute>
      } />

      {/* Pricing Management */}
      <Route path="/pricing" element={
        <ProtectedRoute>
          <PricingManagementPage />
        </ProtectedRoute>
      } />

      {/* Custom Fields Management */}
      <Route path="/custom-fields" element={
        <ProtectedRoute>
          <CustomFieldsPage />
        </ProtectedRoute>
      } />

      {/* Admin Monitoring Dashboard */}
      <Route path="/admin/monitoring" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.DASHBOARD.VIEW}>
          <AdminMonitoringDashboard />
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
            <AppRoutes />
            <Toaster position="top-right" />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
