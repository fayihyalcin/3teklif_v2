import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const customerHighlights = [
  "Talebi dakikalar içinde yayınlama",
  "Doğrulanmış firmalardan rekabetçi teklif",
  "Fiyat, hız ve puan odaklı karşılaştırma"
];

const customerChecklist = [
  "İhtiyacını kategori ve şehir bazında aç",
  "Aynı iş için birden fazla teklif topla",
  "Uygun firmayı panelden güvenle seç"
];

export function RegisterCustomerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { registerCustomer } = useAuth();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    city: ""
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedType = useMemo(() => {
    const rawType = searchParams.get("type");
    if (rawType === "PRODUCT") {
      return "Ürün";
    }
    return "Hizmet";
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await registerCustomer(form);
      navigate("/dashboard/customer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-shell register-shell">
      <div className="auth-gradient-orb auth-gradient-orb-left" aria-hidden="true" />
      <div className="auth-gradient-orb auth-gradient-orb-right" aria-hidden="true" />

      <div className="auth-layout">
        <aside className="auth-showcase register-showcase">
          <p className="auth-showcase-kicker">Müşteri Kaydı</p>
          <h1>Doğru tedarikçiye daha hızlı ulaşmak için hesabını oluştur.</h1>
          <p className="auth-showcase-text">
            3teklif ile taleplerini tek panelde yönet, teklifleri karşılaştır ve satın alma kararlarını ekipçe netleştir.
          </p>

          <div className="register-intent-row">
            <span className="register-intent-chip">Talep Türü: {selectedType}</span>
            <span className="register-intent-chip">Ücretsiz Başlangıç</span>
          </div>

          <div className="auth-highlight-list">
            {customerHighlights.map((item) => (
              <span key={item} className="auth-highlight-chip">
                {item}
              </span>
            ))}
          </div>

          <div className="register-checklist">
            {customerChecklist.map((item) => (
              <p key={item} className="register-check-item">
                <span aria-hidden="true">✓</span>
                {item}
              </p>
            ))}
          </div>

          <div className="auth-showcase-metrics">
            <article>
              <p>Aktif müşteri hesabı</p>
              <strong>8.500+</strong>
            </article>
            <article>
              <p>Aylık talep</p>
              <strong>12.000+</strong>
            </article>
            <article>
              <p>Ortalama dönüş</p>
              <strong>48 saat</strong>
            </article>
          </div>
        </aside>

        <article className="auth-panel auth-panel-large">
          <p className="auth-panel-kicker">Yeni Hesap</p>
          <h2>Müşteri hesabını aç</h2>
          <p className="auth-panel-subtext">Talep yayınlamak ve teklif toplamak için temel bilgilerini gir.</p>

          <form className="form-grid auth-form-grid" onSubmit={handleSubmit}>
            <div className="auth-grid-two">
              <label className="auth-field">
                Ad Soyad
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  autoComplete="name"
                  required
                />
              </label>
              <label className="auth-field">
                E-posta
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  autoComplete="email"
                  required
                />
              </label>
            </div>

            <div className="auth-grid-two">
              <label className="auth-field">
                Şifre
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  autoComplete="new-password"
                  placeholder="En az 8 karakter"
                  required
                />
              </label>
              <label className="auth-field">
                Telefon
                <input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  autoComplete="tel"
                  placeholder="+90 5xx xxx xx xx"
                />
              </label>
            </div>

            <label className="auth-field">
              Şehir
              <input
                value={form.city}
                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                autoComplete="address-level2"
                placeholder="İstanbul"
              />
            </label>

            {error ? <p className="error-text">{error}</p> : null}

            <button className="solid-btn auth-submit-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Kayıt oluşturuluyor..." : "Müşteri Hesabı Oluştur"}
            </button>
          </form>

          <div className="auth-panel-links register-links">
            <span>Zaten hesabın var mı?</span>
            <Link to="/login">Giriş yap</Link>
            <Link to="/register/company">Firma olarak kayıt ol</Link>
          </div>
        </article>
      </div>
    </section>
  );
}
