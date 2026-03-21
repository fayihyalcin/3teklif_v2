import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  canAccessAdminPanel,
  canAccessCompanyPanel,
  canAccessCustomerPanel
} from "../lib/panel-access";

type UserRole = "SUPER_ADMIN" | "COMPANY" | "CUSTOMER";

export function RoleGuard({
  roles,
  children
}: {
  roles: UserRole[];
  children: ReactNode;
}) {
  const { isHydrating, isAuthenticated, user } = useAuth();

  if (isHydrating) {
    return <div className="panel-card">Oturum kontrol ediliyor...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const hasAccess = roles.some((role) => {
    if (role === "SUPER_ADMIN") {
      return canAccessAdminPanel(user);
    }
    if (role === "COMPANY") {
      return canAccessCompanyPanel(user);
    }
    return canAccessCustomerPanel(user);
  });

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
