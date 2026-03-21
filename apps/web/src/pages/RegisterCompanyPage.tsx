import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

const COMPANY_ONBOARDING_KEY = "uc_teklif_company_onboarding";

const DEFAULT_SECTORS = [
  "Baca Temizliği",
  "Gıda",
  "Lojistik ve Nakliye",
  "Yapı ve İnşaat",
  "Elektrik",
  "Temizlik Hizmetleri"
];

type SectorItem = {
  id: string;
  name: string;
};

export function RegisterCompanyPage() {
  const navigate = useNavigate();
  const { registerCompany } = useAuth();
  const [form, setForm] = useState({
    companyName: "",
    authorizedName: "",
    phone: "",
    email: "",
    password: "",
    taxNumber: "",
    city: "",
    companyType: "BUYER_SUPPLIER"
  });
  const [sectorOptions, setSectorOptions] = useState<string[]>(DEFAULT_SECTORS);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSectors, setIsLoadingSectors] = useState(true);

  useEffect(() => {
    const loadSectors = async () => {
      setIsLoadingSectors(true);
      try {
        const response = await apiRequest<{ items: SectorItem[] }>("/api/sectors");
        const names = response.items.map((item) => item.name.trim()).filter(Boolean);
        if (names.length > 0) {
          setSectorOptions(Array.from(new Set(names)));
          return;
        }
      } catch {
        // Fall back to temporary list while admin categories are being configured.
      } finally {
        setIsLoadingSectors(false);
      }
      setSectorOptions(DEFAULT_SECTORS);
    };

    loadSectors().catch(() => {
      setSectorOptions(DEFAULT_SECTORS);
      setIsLoadingSectors(false);
    });
  }, []);

  const toggleSector = (sectorName: string) => {
    setSelectedSectors((prev) =>
      prev.includes(sectorName) ? prev.filter((name) => name !== sectorName) : [...prev, sectorName]
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (selectedSectors.length === 0) {
      setError("En az bir sektör seçin.");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerCompany({
        companyName: form.companyName,
        email: form.email,
        password: form.password,
        taxNumber: form.taxNumber || undefined,
        city: form.city || undefined,
        sectors: selectedSectors
      });

      localStorage.setItem(
        COMPANY_ONBOARDING_KEY,
        JSON.stringify({
          companyName: form.companyName,
          authorizedName: form.authorizedName,
          email: form.email,
          phone: form.phone,
          taxNumber: form.taxNumber,
          city: form.city,
          companyType: form.companyType,
          sectors: selectedSectors,
          createdAt: new Date().toISOString()
        })
      );

      navigate("/dashboard/company?welcome=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="register-evolved-shell">
      <div className="register-evolved-layout">
        <aside className="register-evolved-visual" aria-hidden="true">
          <div className="register-visual-mask" />
          <div className="register-visual-orbit register-visual-orbit-1" />
          <div className="register-visual-orbit register-visual-orbit-2" />
          <div className="register-visual-orbit register-visual-orbit-3" />
          <div className="register-visual-content">
            <p>3teklif Pro</p>
            <h3>İş süreçlerini optimize et, tekliften iş takibine tek panelde ilerle.</h3>
            <span>Başvuru hızlı, operasyonlar dashboard içinde.</span>
          </div>
        </aside>

        <article className="register-evolved-form">
          <p className="auth-panel-kicker">Firma Başvurusu</p>
          <h2>Hızlı şirket kaydı</h2>
          <p className="auth-panel-subtext">
            Bu adımda sadece temel bilgileri alıyoruz. Evrak yükleme, mağaza/firma ayarları ve iş takibi kayıt sonrası panelde.
          </p>

          <form className="form-grid auth-form-grid" onSubmit={handleSubmit}>
            <label className="auth-field">
              Firma Adı
              <input
                value={form.companyName}
                onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
                placeholder="Örn: Teklifz Teknoloji A.Ş."
                autoComplete="organization"
                required
              />
            </label>

            <div className="auth-grid-two">
              <label className="auth-field">
                Yetkili Ad Soyad
                <input
                  value={form.authorizedName}
                  onChange={(e) => setForm((prev) => ({ ...prev, authorizedName: e.target.value }))}
                  placeholder="Örn: Ahmet Yılmaz"
                  autoComplete="name"
                  required
                />
              </label>
              <label className="auth-field">
                Yetkili Telefon
                <input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+90 5xx xxx xx xx"
                  autoComplete="tel"
                  required
                />
              </label>
            </div>

            <div className="auth-grid-two">
              <label className="auth-field">
                Yetkili E-posta
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  autoComplete="email"
                  required
                />
              </label>
              <label className="auth-field">
                Şifre
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="En az 8 karakter"
                  autoComplete="new-password"
                  required
                />
              </label>
            </div>

            <div className="auth-grid-two">
              <label className="auth-field">
                Vergi No
                <input
                  value={form.taxNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, taxNumber: e.target.value }))}
                  placeholder="10 haneli vergi numarası"
                />
              </label>
              <label className="auth-field">
                Şehir
                <input
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="İstanbul"
                  autoComplete="address-level2"
                />
              </label>
            </div>

            <label className="auth-field">
              Firma Tipi
              <div className="company-type-group">
                <button
                  type="button"
                  className={`company-type-btn ${form.companyType === "BUYER" ? "is-selected" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, companyType: "BUYER" }))}
                >
                  Alıcıyım
                </button>
                <button
                  type="button"
                  className={`company-type-btn ${form.companyType === "SUPPLIER" ? "is-selected" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, companyType: "SUPPLIER" }))}
                >
                  Tedarikçiyim
                </button>
                <button
                  type="button"
                  className={`company-type-btn ${form.companyType === "BUYER_SUPPLIER" ? "is-selected" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, companyType: "BUYER_SUPPLIER" }))}
                >
                  Alıcı + Tedarikçi
                </button>
              </div>
            </label>

            <label className="auth-field">
              Sektörler
              <span className="auth-field-help">
                Kategoriler admin tarafından yönetilir. {selectedSectors.length > 0 ? `${selectedSectors.length} sektör seçildi.` : ""}
              </span>
            </label>
            <div className="sector-selector-grid" aria-label="Sektör seçim listesi">
              {isLoadingSectors ? <p className="sector-selector-loading">Sektörler yükleniyor...</p> : null}
              {!isLoadingSectors
                ? sectorOptions.map((sector) => {
                    const isSelected = selectedSectors.includes(sector);
                    return (
                      <button
                        key={sector}
                        type="button"
                        className={`sector-chip-btn ${isSelected ? "is-selected" : ""}`}
                        onClick={() => toggleSector(sector)}
                        aria-pressed={isSelected}
                      >
                        {sector}
                      </button>
                    );
                  })
                : null}
            </div>

            {error ? <p className="error-text">{error}</p> : null}

            <button className="solid-btn auth-submit-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Başvuru gönderiliyor..." : "Başvuruyu Tamamla"}
            </button>
          </form>

          <div className="auth-panel-links register-links">
            <span>Zaten hesabın var mı?</span>
            <Link to="/login">Giriş yap</Link>
            <Link to="/register/customer">Müşteri olarak kayıt ol</Link>
          </div>
        </article>
      </div>
    </section>
  );
}
