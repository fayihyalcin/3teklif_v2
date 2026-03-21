import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const loginHighlights = [
  "Doğrulanmış firmalarla güvenli teklif akışı",
  "Fiyat, teslim ve puan odaklı akıllı karşılaştırma",
  "KVKK uyumlu altyapı ve raporlanabilir süreç"
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/redirect");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-shell">
      <div className="auth-gradient-orb auth-gradient-orb-left" aria-hidden="true" />
      <div className="auth-gradient-orb auth-gradient-orb-right" aria-hidden="true" />

      <div className="auth-layout">
        <aside className="auth-showcase">
          <p className="auth-showcase-kicker">3teklif Platform</p>
          <h1>Satın alma ve teklif süreçlerini tek oturumla yönetin.</h1>
          <p className="auth-showcase-text">
            Ekiplerinize hız kazandıran canlı teklif akışı, karşılaştırma motoru ve doğrulanmış tedarikçi ağına anında erişin.
          </p>

          <div className="auth-highlight-list">
            {loginHighlights.map((item) => (
              <span key={item} className="auth-highlight-chip">
                {item}
              </span>
            ))}
          </div>

          <div className="auth-showcase-metrics">
            <article>
              <p>Aylık aktif talep</p>
              <strong>12.000+</strong>
            </article>
            <article>
              <p>Doğrulanmış firma</p>
              <strong>2.400+</strong>
            </article>
            <article>
              <p>Ortalama dönüş</p>
              <strong>48 saat</strong>
            </article>
          </div>
        </aside>

        <article className="auth-panel">
          <p className="auth-panel-kicker">Giriş Yap</p>
          <h2>Hesabınla devam et</h2>
          <p className="auth-panel-subtext">Talep ve teklif ekranlarına erişmek için bilgilerini gir.</p>

          <form className="form-grid auth-form-grid" onSubmit={handleSubmit}>
            <label className="auth-field">
              E-posta
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="ornek@firma.com"
                autoComplete="email"
                required
              />
            </label>
            <label className="auth-field">
              Şifre
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Şifreni gir"
                autoComplete="current-password"
                required
              />
            </label>

            {error ? <p className="error-text">{error}</p> : null}

            <button className="solid-btn auth-submit-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Giriş yapılıyor..." : "Panele Giriş Yap"}
            </button>
          </form>

          <div className="auth-panel-links">
            <span>Hesabın yok mu?</span>
            <Link to="/register/customer">Müşteri kaydı oluştur</Link>
            <Link to="/register/company">Firma kaydı oluştur</Link>
          </div>
        </article>
      </div>
    </section>
  );
}
