import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Login } from '@/pages/Login';
import { PartnerPage } from '@/components/layout/PartnerPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { Dashboard } from '@/pages/Dashboard';
import { ProfilePage } from '@/pages/ProfilePage';
import { AdvDashboard } from '@/pages/adv/AdvDashboard';
import { AdvValidationPage } from '@/pages/adv/AdvValidationPage';
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
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/partners" element={<ProtectedRoute><PartnerPage /></ProtectedRoute>} />
      <Route path="/partners" element={<ProtectedRoute><PartnerPage /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/adv/dashboard" element={<ProtectedRoute><AdvDashboard /></ProtectedRoute>} />
      <Route path="/adv/validation" element={<ProtectedRoute><AdvValidationPage /></ProtectedRoute>} />

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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
