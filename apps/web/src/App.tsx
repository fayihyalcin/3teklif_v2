import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PanelNav } from "./components/PanelNav";
import { RoleGuard } from "./components/RoleGuard";
import { useAuth } from "./context/AuthContext";
import { getDefaultDashboardPath, persistPreferredPanelByPath } from "./lib/panel-access";
import { AdminBootstrapPage } from "./pages/AdminBootstrapPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { CompanyDashboard } from "./pages/CompanyDashboard";
import { CustomerDashboard } from "./pages/CustomerDashboard";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterCompanyPage } from "./pages/RegisterCompanyPage";
import { RegisterCustomerPage } from "./pages/RegisterCustomerPage";

function RedirectByRole() {
  const { user, isHydrating } = useAuth();

  if (isHydrating) {
    return <div className="panel-card">Yönlendirme yapılıyor...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={getDefaultDashboardPath(user)} replace />;
}

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

export function App() {
  const location = useLocation();
  const isLandingRoute = location.pathname === "/";
  const isDashboardRoute = location.pathname.startsWith("/dashboard/");

  useEffect(() => {
    persistPreferredPanelByPath(location.pathname);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <PanelNav />

      <main
        className={`main-content ${isLandingRoute ? "landing-main-content" : ""} ${
          isDashboardRoute ? "dashboard-main-content" : ""
        }`}
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register/customer" element={<RegisterCustomerPage />} />
          <Route path="/register/company" element={<RegisterCompanyPage />} />
          <Route path="/admin/setup" element={<AdminBootstrapPage />} />
          <Route path="/redirect" element={<RedirectByRole />} />

          <Route
            path="/dashboard/customer"
            element={
              <RoleGuard roles={["CUSTOMER"]}>
                <CustomerDashboard />
              </RoleGuard>
            }
          />
          <Route
            path="/dashboard/company"
            element={
              <RoleGuard roles={["COMPANY"]}>
                <CompanyDashboard />
              </RoleGuard>
            }
          />
          <Route
            path="/dashboard/admin"
            element={
              <RoleGuard roles={["SUPER_ADMIN"]}>
                <AdminDashboard />
              </RoleGuard>
            }
          />

          <Route path="/giris" element={<LegacyRedirect to="/login" />} />
          <Route path="/kayit/musteri" element={<LegacyRedirect to="/register/customer" />} />
          <Route path="/kayit/firma" element={<LegacyRedirect to="/register/company" />} />
          <Route path="/admin-kurulum" element={<LegacyRedirect to="/admin/setup" />} />
          <Route path="/yonlendir" element={<LegacyRedirect to="/redirect" />} />
          <Route path="/panel/musteri" element={<LegacyRedirect to="/dashboard/customer" />} />
          <Route path="/panel/firma" element={<LegacyRedirect to="/dashboard/company" />} />
          <Route path="/panel/admin" element={<LegacyRedirect to="/dashboard/admin" />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
