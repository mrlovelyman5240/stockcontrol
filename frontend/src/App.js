import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Layout from "./components/Layout";
import "@/App.css";

// Pages
import Login from "./pages/Login";

// Boss Pages
import BossDashboard from "./pages/boss/Dashboard";
import BossOrders from "./pages/boss/Orders";
import BossSettings from "./pages/boss/Settings";
import AuditLog from "./pages/boss/AuditLog";
import BossLedger from "./pages/boss/Ledger";

// Customer Service Pages
import ServiceDashboard from "./pages/service/Dashboard";
import NewOrder from "./pages/service/NewOrder";
import ServiceOrders from "./pages/service/Orders";
import ServiceProfile from "./pages/service/Profile";

// Shared Pages
import Inventory from "./pages/shared/Inventory";
import Staff from "./pages/shared/Staff";

// Driver Pages
import DriverDashboard from "./pages/driver/Dashboard";
import DriverOrders from "./pages/driver/Orders";
import DriverEarnings from "./pages/driver/Earnings";
import DriverProfile from "./pages/driver/Profile";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to appropriate dashboard based on role
    switch (user?.role) {
      case 'boss':
        return <Navigate to="/boss" replace />;
      case 'customer_service':
        return <Navigate to="/service" replace />;
      case 'driver':
        return <Navigate to="/driver" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return children;
};

// Home redirect based on role
const HomeRedirect = () => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  switch (user?.role) {
    case 'boss':
      return <Navigate to="/boss" replace />;
    case 'customer_service':
      return <Navigate to="/service" replace />;
    case 'driver':
      return <Navigate to="/driver" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        {/* Home redirect */}
        <Route path="/" element={<HomeRedirect />} />
        
        {/* Auth */}
        <Route path="/login" element={<Login />} />

        {/* Boss Routes */}
        <Route
          path="/boss"
          element={
            <ProtectedRoute allowedRoles={['boss']}>
              <BossDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/boss/orders"
          element={
            <ProtectedRoute allowedRoles={['boss']}>
              <BossOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/boss/inventory"
          element={
            <ProtectedRoute allowedRoles={['boss']}>
              <Inventory role="boss" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/boss/settings"
          element={
            <ProtectedRoute allowedRoles={['boss']}>
              <BossSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/boss/audit-log"
          element={
            <ProtectedRoute allowedRoles={['boss']}>
              <AuditLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/boss/staff"
          element={
            <ProtectedRoute allowedRoles={['boss']}>
              <Staff role="boss" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/boss/ledger"
          element={
            <ProtectedRoute allowedRoles={['boss']}>
              <BossLedger />
            </ProtectedRoute>
          }
        />

        {/* Customer Service Routes */}
        <Route
          path="/service"
          element={
            <ProtectedRoute allowedRoles={['customer_service']}>
              <ServiceDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/service/new-order"
          element={
            <ProtectedRoute allowedRoles={['customer_service']}>
              <NewOrder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/service/inventory"
          element={
            <ProtectedRoute allowedRoles={['customer_service']}>
              <Inventory role="service" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/service/orders"
          element={
            <ProtectedRoute allowedRoles={['customer_service']}>
              <ServiceOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/service/profile"
          element={
            <ProtectedRoute allowedRoles={['customer_service']}>
              <ServiceProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/service/staff"
          element={
            <ProtectedRoute allowedRoles={['customer_service']}>
              <Staff role="service" />
            </ProtectedRoute>
          }
        />

        {/* Driver Routes */}
        <Route
          path="/driver"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/orders"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/earnings"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverEarnings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/profile"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverProfile />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster 
            position="top-center" 
            richColors 
            closeButton
            toastOptions={{
              duration: 3000,
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
