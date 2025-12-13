import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/rbac';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import { Login } from '@/pages/Login';
import { PartnerPage } from '@/components/layout/PartnerPage';
import { OrdersPage } from '@/pages/OrdersPage';
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
import { MasterLayout } from '@/components/layout/MasterLayout';


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
          <PartnerPage />
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


      {/* Catch all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
