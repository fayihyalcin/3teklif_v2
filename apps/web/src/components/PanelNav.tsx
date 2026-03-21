import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  canAccessAdminPanel,
  canAccessCompanyPanel,
  canAccessCustomerPanel,
  setPreferredPanel
} from "../lib/panel-access";

export function PanelNav() {
  const { user, logout } = useAuth();
  const canOpenCustomerPanel = canAccessCustomerPanel(user);
  const canOpenCompanyPanel = canAccessCompanyPanel(user);
  const canOpenAdminPanel = canAccessAdminPanel(user);

  return (
    <header className="top-nav">
      <Link className="brand-logo" to="/" aria-label="3teklif Ana Sayfa">
        <img src="/images/header-logo.jpg" alt="3teklif" />
      </Link>

      {!user ? (
        <nav className="top-nav-menu">
          <a href="/#nasil-calisir">Nasıl Çalışır?</a>
          <a href="/#hakkimizda">Hakkımızda</a>
          <a href="/#iletisim">İletişim</a>
        </nav>
      ) : (
        <nav className="top-nav-menu">
          {canOpenCustomerPanel ? (
            <Link
              to="/dashboard/customer"
              onClick={() => {
                setPreferredPanel("customer");
              }}
            >
              Müşteri Paneli
            </Link>
          ) : null}
          {canOpenCompanyPanel ? (
            <Link
              to="/dashboard/company"
              onClick={() => {
                setPreferredPanel("company");
              }}
            >
              Firma Paneli
            </Link>
          ) : null}
          {canOpenAdminPanel ? (
            <Link
              to="/dashboard/admin"
              onClick={() => {
                setPreferredPanel("admin");
              }}
            >
              Süper Admin Paneli
            </Link>
          ) : null}
        </nav>
      )}

      <div className="top-nav-actions">
        {!user ? (
          <>
            <Link className="text-link" to="/login">
              Giriş Yap
            </Link>
            <Link className="solid-btn nav-register-btn" to="/register/customer">
              Kayıt Ol
            </Link>
          </>
        ) : (
          <button className="ghost-btn" onClick={logout}>
            Çıkış
          </button>
        )}
      </div>
    </header>
  );
}
