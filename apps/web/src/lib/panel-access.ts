type UserRole = "SUPER_ADMIN" | "COMPANY" | "CUSTOMER";

interface PanelUserLike {
  role: UserRole;
  customer: unknown | null;
  company: unknown | null;
}

type PreferredPanel = "customer" | "company" | "admin";

const PREFERRED_PANEL_KEY = "uc_teklif_preferred_panel";

export function canAccessCustomerPanel(user: PanelUserLike | null | undefined): boolean {
  if (!user) {
    return false;
  }
  return user.role === "CUSTOMER" || Boolean(user.customer);
}

export function canAccessCompanyPanel(user: PanelUserLike | null | undefined): boolean {
  if (!user) {
    return false;
  }
  return user.role === "COMPANY" || Boolean(user.company);
}

export function canAccessAdminPanel(user: PanelUserLike | null | undefined): boolean {
  if (!user) {
    return false;
  }
  return user.role === "SUPER_ADMIN";
}

function readPreferredPanel(): PreferredPanel | null {
  const raw = localStorage.getItem(PREFERRED_PANEL_KEY);
  if (raw === "customer" || raw === "company" || raw === "admin") {
    return raw;
  }
  return null;
}

export function setPreferredPanel(panel: PreferredPanel): void {
  localStorage.setItem(PREFERRED_PANEL_KEY, panel);
}

export function persistPreferredPanelByPath(pathname: string): void {
  if (pathname.startsWith("/dashboard/customer")) {
    setPreferredPanel("customer");
    return;
  }
  if (pathname.startsWith("/dashboard/company")) {
    setPreferredPanel("company");
    return;
  }
  if (pathname.startsWith("/dashboard/admin")) {
    setPreferredPanel("admin");
  }
}

export function getDefaultDashboardPath(user: PanelUserLike): string {
  if (canAccessAdminPanel(user)) {
    return "/dashboard/admin";
  }

  const canAccessCustomer = canAccessCustomerPanel(user);
  const canAccessCompany = canAccessCompanyPanel(user);

  if (canAccessCustomer && canAccessCompany) {
    const preferredPanel = readPreferredPanel();
    if (preferredPanel === "company") {
      return "/dashboard/company";
    }
    return "/dashboard/customer";
  }

  if (canAccessCustomer) {
    return "/dashboard/customer";
  }

  if (canAccessCompany) {
    return "/dashboard/company";
  }

  return "/";
}
