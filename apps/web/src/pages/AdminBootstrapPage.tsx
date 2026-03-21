import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AdminBootstrapPage() {
  const navigate = useNavigate();
  const { bootstrapAdmin } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
    bootstrapKey: ""
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await bootstrapAdmin(form);
      navigate("/dashboard/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin kurulum basarisiz.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="panel-card auth-card">
      <h2>Super Admin Ilk Kurulum</h2>
      <p>Bu ekran sadece ilk super admin hesabini olusturmak icindir.</p>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          E-posta
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
        </label>
        <label>
          Sifre
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            required
          />
        </label>
        <label>
          Bootstrap Key
          <input
            type="password"
            value={form.bootstrapKey}
            onChange={(e) => setForm((prev) => ({ ...prev, bootstrapKey: e.target.value }))}
            required
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="solid-btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Olusturuluyor..." : "Super Admin Olustur"}
        </button>
      </form>
    </section>
  );
}
