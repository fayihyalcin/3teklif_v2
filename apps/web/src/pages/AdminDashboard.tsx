
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

type AdminView =
  | "overview"
  | "applications"
  | "companies"
  | "customers"
  | "listings"
  | "tenders"
  | "catalog"
  | "packages"
  | "support"
  | "cms";

type ListingStatus = "OPEN" | "CLOSED" | "CANCELED";
type TenderStatus = "DRAFT" | "OPEN" | "CLOSED" | "CANCELED";
type SupportStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED";

type Stats = {
  pendingCompanies: number;
  approvedCompanies: number;
  totalCompanies: number;
  totalCustomers: number;
  openListings: number;
  openTenders: number;
  totalBids: number;
  totalTenderBids: number;
  pendingSupportMessages: number;
};

const menuItems: Array<{ id: AdminView; title: string; subtitle: string }> = [
  { id: "overview", title: "Genel Bakış", subtitle: "Sistem özeti" },
  { id: "applications", title: "Firma Başvuruları", subtitle: "Onay ve evrak" },
  { id: "companies", title: "Firma Yönetimi", subtitle: "Üyelik ve trial" },
  { id: "customers", title: "Müşteri Yönetimi", subtitle: "Hesap yönetimi" },
  { id: "listings", title: "İlan Yönetimi", subtitle: "Tüm ilanlar" },
  { id: "tenders", title: "İhale Yönetimi", subtitle: "Tüm ihaleler" },
  { id: "catalog", title: "Kategori & Yetkinlik", subtitle: "Servis kataloğu" },
  { id: "packages", title: "Paket & Fiyat", subtitle: "Paket işlemleri" },
  { id: "support", title: "Destek", subtitle: "Mesaj kutusu" },
  { id: "cms", title: "Web İçerik", subtitle: "Dinamik ayarlar" }
];

const cmsStarterKeys = [
  "landing.hero.title",
  "landing.hero.subtitle",
  "landing.hero.helper",
  "landing.footer.heading",
  "landing.footer.description",
  "contact.email",
  "contact.phone"
];

function fmtDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR");
}

function fmtMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  }).format(num);
}

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function statusLabel(value: string) {
  const map: Record<string, string> = {
    PENDING: "Beklemede",
    APPROVED: "Onaylı",
    REJECTED: "Reddedildi",
    OPEN: "Açık",
    CLOSED: "Kapalı",
    CANCELED: "İptal",
    DRAFT: "Taslak",
    NEW: "Yeni",
    IN_PROGRESS: "İşlemde",
    RESOLVED: "Çözüldü",
    ARCHIVED: "Arşiv",
    TRIAL: "Trial",
    PLUS: "Plus"
  };
  return map[value] ?? value;
}

export function AdminDashboard() {
  const { token, user } = useAuth();

  const [activeView, setActiveView] = useState<AdminView>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingCompanies, setPendingCompanies] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [tenders, setTenders] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [catalogSectors, setCatalogSectors] = useState<any[]>([]);
  const [catalogCompetencies, setCatalogCompetencies] = useState<any[]>([]);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [cmsItems, setCmsItems] = useState<any[]>([]);

  const [selectedListingId, setSelectedListingId] = useState("");
  const [selectedTenderId, setSelectedTenderId] = useState("");
  const [listingDetail, setListingDetail] = useState<any | null>(null);
  const [tenderDetail, setTenderDetail] = useState<any | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [docNotes, setDocNotes] = useState<Record<string, string>>({});
  const [trialDays, setTrialDays] = useState<Record<string, string>>({});

  const [packageForm, setPackageForm] = useState({
    code: "",
    name: "",
    price: "",
    durationDays: "",
    listingLimit: "",
    bidLimit: ""
  });

  const [packageEditForm, setPackageEditForm] = useState({
    packageId: "",
    name: "",
    price: "",
    durationDays: "",
    listingLimit: "",
    bidLimit: "",
    isActive: true
  });

  const [subscriptionForm, setSubscriptionForm] = useState({ companyId: "", packageId: "", paymentReference: "" });
  const [sectorForm, setSectorForm] = useState({ name: "" });
  const [competencyForm, setCompetencyForm] = useState({ name: "" });
  const [catalogForm, setCatalogForm] = useState({ sectorId: "", competencyIds: [] as string[] });
  const [cmsForm, setCmsForm] = useState({ key: "", valueText: "" });

  const loadAll = useCallback(
    async (silent?: boolean) => {
      if (!token) return;
      if (!silent) {
        setIsLoading(true);
        setError("");
      }
      try {
        const [
          statsRes,
          pendingRes,
          companiesRes,
          customersRes,
          listingsRes,
          tendersRes,
          packagesRes,
          catalogRes,
          supportRes,
          cmsRes
        ] = await Promise.all([
          apiRequest<Stats>("/api/admin/dashboard/stats", { token }),
          apiRequest<{ items: any[] }>("/api/admin/companies/pending", { token }),
          apiRequest<{ items: any[] }>("/api/admin/companies", { token }),
          apiRequest<{ items: any[] }>("/api/admin/customers", { token }),
          apiRequest<{ items: any[] }>("/api/admin/listings", { token }),
          apiRequest<{ items: any[] }>("/api/admin/tenders", { token }),
          apiRequest<{ items: any[] }>("/api/admin/packages", { token }),
          apiRequest<{ sectors: any[]; competencies: any[] }>("/api/admin/catalog", { token }),
          apiRequest<{ items: any[] }>("/api/admin/support-messages", { token }),
          apiRequest<{ items: any[] }>("/api/admin/site-content", { token })
        ]);

        setStats(statsRes);
        setPendingCompanies(pendingRes.items);
        setCompanies(companiesRes.items);
        setCustomers(customersRes.items);
        setListings(listingsRes.items);
        setTenders(tendersRes.items);
        setPackages(packagesRes.items);
        setCatalogSectors(catalogRes.sectors);
        setCatalogCompetencies(catalogRes.competencies);
        setSupportMessages(supportRes.items);
        setCmsItems(cmsRes.items);

        setSubscriptionForm((prev) => ({
          ...prev,
          companyId: prev.companyId && companiesRes.items.some((x) => x.id === prev.companyId) ? prev.companyId : companiesRes.items[0]?.id || "",
          packageId: prev.packageId && packagesRes.items.some((x) => x.id === prev.packageId) ? prev.packageId : packagesRes.items[0]?.id || ""
        }));

        setCatalogForm((prev) => {
          const sectorId = prev.sectorId && catalogRes.sectors.some((x) => x.id === prev.sectorId) ? prev.sectorId : catalogRes.sectors[0]?.id || "";
          return { ...prev, sectorId };
        });

        setSelectedListingId((prev) => (prev && listingsRes.items.some((x) => x.id === prev) ? prev : listingsRes.items[0]?.id || ""));
        setSelectedTenderId((prev) => (prev && tendersRes.items.some((x) => x.id === prev) ? prev : tendersRes.items[0]?.id || ""));
        setLastSyncAt(new Date());
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : "Admin verileri yüklenemedi.");
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [token]
  );
  const loadListingDetail = useCallback(
    async (listingId: string) => {
      if (!token || !listingId) return;
      try {
        const res = await apiRequest<{ item: any }>(`/api/admin/listings/${listingId}`, { token });
        setListingDetail(res.item);
      } catch {
        setListingDetail(null);
      }
    },
    [token]
  );

  const loadTenderDetail = useCallback(
    async (tenderId: string) => {
      if (!token || !tenderId) return;
      try {
        const res = await apiRequest<{ item: any }>(`/api/admin/tenders/${tenderId}`, { token });
        setTenderDetail(res.item);
      } catch {
        setTenderDetail(null);
      }
    },
    [token]
  );

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, [loadAll]);

  useEffect(() => {
    if (!selectedListingId) {
      setListingDetail(null);
      return;
    }
    loadListingDetail(selectedListingId).catch(() => undefined);
  }, [loadListingDetail, selectedListingId]);

  useEffect(() => {
    if (!selectedTenderId) {
      setTenderDetail(null);
      return;
    }
    loadTenderDetail(selectedTenderId).catch(() => undefined);
  }, [loadTenderDetail, selectedTenderId]);

  const refreshAll = async () => {
    setNotice("");
    await loadAll();
    if (selectedListingId) await loadListingDetail(selectedListingId);
    if (selectedTenderId) await loadTenderDetail(selectedTenderId);
  };

  const handleCompanyApproval = async (companyId: string, status: "APPROVED" | "REJECTED") => {
    if (!token) return;
    setError("");
    try {
      await apiRequest(`/api/admin/companies/${companyId}/approval`, {
        method: "PATCH",
        token,
        body: { status, note: approvalNotes[companyId] || undefined }
      });
      setNotice(status === "APPROVED" ? "Firma onaylandı." : "Firma reddedildi.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Firma onayı güncellenemedi.");
    }
  };

  const handleDocumentReview = async (documentId: string, status: "APPROVED" | "REJECTED") => {
    if (!token) return;
    setError("");
    try {
      await apiRequest(`/api/admin/documents/${documentId}/review`, {
        method: "PATCH",
        token,
        body: { status, note: docNotes[documentId] || undefined }
      });
      setNotice("Evrak durumu güncellendi.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evrak güncellenemedi.");
    }
  };

  const handleCompanyActive = async (companyId: string, isActive: boolean) => {
    if (!token) return;
    setError("");
    try {
      await apiRequest(`/api/admin/companies/${companyId}/active`, { method: "PATCH", token, body: { isActive } });
      setNotice(isActive ? "Firma aktifleştirildi." : "Firma pasife alındı.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Firma hesabı güncellenemedi.");
    }
  };

  const handleCustomerActive = async (customerId: string, isActive: boolean) => {
    if (!token) return;
    setError("");
    try {
      await apiRequest(`/api/admin/customers/${customerId}/active`, { method: "PATCH", token, body: { isActive } });
      setNotice(isActive ? "Müşteri aktifleştirildi." : "Müşteri pasife alındı.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Müşteri hesabı güncellenemedi.");
    }
  };

  const handleTrial = async (companyId: string) => {
    if (!token) return;
    const days = Number(trialDays[companyId] || "15");
    if (!days || days < 1 || days > 365) {
      setError("Trial süresi 1-365 gün aralığında olmalı.");
      return;
    }
    setError("");
    try {
      await apiRequest(`/api/admin/companies/${companyId}/free-trial`, { method: "POST", token, body: { days } });
      setNotice(`${days} gün ücretsiz kullanım tanımlandı.`);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trial tanımlanamadı.");
    }
  };

  const handleListingStatus = async (listingId: string, status: ListingStatus) => {
    if (!token) return;
    setError("");
    try {
      await apiRequest(`/api/admin/listings/${listingId}/status`, { method: "PATCH", token, body: { status } });
      setNotice("İlan durumu güncellendi.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İlan güncellenemedi.");
    }
  };

  const handleTenderStatus = async (tenderId: string, status: TenderStatus) => {
    if (!token) return;
    setError("");
    try {
      await apiRequest(`/api/admin/tenders/${tenderId}/status`, { method: "PATCH", token, body: { status } });
      setNotice("İhale durumu güncellendi.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İhale güncellenemedi.");
    }
  };

  const handleCreatePackage = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setError("");
    try {
      await apiRequest("/api/admin/packages", {
        method: "POST",
        token,
        body: {
          code: packageForm.code.trim(),
          name: packageForm.name.trim(),
          price: Number(packageForm.price),
          durationDays: Number(packageForm.durationDays),
          listingLimit: packageForm.listingLimit ? Number(packageForm.listingLimit) : undefined,
          bidLimit: packageForm.bidLimit ? Number(packageForm.bidLimit) : undefined,
          isActive: true
        }
      });
      setPackageForm({ code: "", name: "", price: "", durationDays: "", listingLimit: "", bidLimit: "" });
      setNotice("Paket oluşturuldu.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Paket oluşturulamadı.");
    }
  };

  const selectPackage = (item: any) => {
    setPackageEditForm({
      packageId: item.id,
      name: item.name,
      price: String(item.price),
      durationDays: String(item.durationDays),
      listingLimit: item.listingLimit == null ? "" : String(item.listingLimit),
      bidLimit: item.bidLimit == null ? "" : String(item.bidLimit),
      isActive: Boolean(item.isActive)
    });
  };

  const handleUpdatePackage = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !packageEditForm.packageId) return;
    setError("");
    try {
      await apiRequest(`/api/admin/packages/${packageEditForm.packageId}`, {
        method: "PATCH",
        token,
        body: {
          name: packageEditForm.name.trim(),
          price: Number(packageEditForm.price),
          durationDays: Number(packageEditForm.durationDays),
          listingLimit: packageEditForm.listingLimit === "" ? null : Number(packageEditForm.listingLimit),
          bidLimit: packageEditForm.bidLimit === "" ? null : Number(packageEditForm.bidLimit),
          isActive: packageEditForm.isActive
        }
      });
      setNotice("Paket güncellendi.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Paket güncellenemedi.");
    }
  };

  const handleAssignPackage = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !subscriptionForm.companyId || !subscriptionForm.packageId) return;
    setError("");
    try {
      await apiRequest("/api/admin/subscriptions", {
        method: "POST",
        token,
        body: {
          companyId: subscriptionForm.companyId,
          packageId: subscriptionForm.packageId,
          paymentReference: subscriptionForm.paymentReference || undefined
        }
      });
      setNotice("Firmaya paket atandı.");
      setSubscriptionForm((prev) => ({ ...prev, paymentReference: "" }));
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Paket atanamadı.");
    }
  };
  const handleCreateSector = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !sectorForm.name.trim()) return;
    setError("");
    try {
      await apiRequest("/api/sectors", { method: "POST", token, body: { name: sectorForm.name.trim() } });
      setSectorForm({ name: "" });
      setNotice("Kategori eklendi.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kategori eklenemedi.");
    }
  };

  const handleCreateCompetency = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !competencyForm.name.trim()) return;
    setError("");
    try {
      await apiRequest("/api/admin/competencies", { method: "POST", token, body: { name: competencyForm.name.trim() } });
      setCompetencyForm({ name: "" });
      setNotice("Yetkinlik eklendi.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yetkinlik eklenemedi.");
    }
  };

  const toggleCompetency = (id: string) => {
    setCatalogForm((prev) => ({
      ...prev,
      competencyIds: prev.competencyIds.includes(id) ? prev.competencyIds.filter((x) => x !== id) : [...prev.competencyIds, id]
    }));
  };

  const handleSaveMapping = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !catalogForm.sectorId) return;
    setError("");
    try {
      await apiRequest(`/api/admin/sectors/${catalogForm.sectorId}/competencies`, {
        method: "PUT",
        token,
        body: { competencyIds: catalogForm.competencyIds }
      });
      setNotice("Kategori-yetkinlik eşleştirmesi kaydedildi.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eşleştirme kaydedilemedi.");
    }
  };

  const handleSupportStatus = async (messageId: string, status: SupportStatus) => {
    if (!token) return;
    setError("");
    try {
      await apiRequest(`/api/admin/support-messages/${messageId}`, { method: "PATCH", token, body: { status } });
      setNotice("Destek mesajı güncellendi.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Destek mesajı güncellenemedi.");
    }
  };

  const handleCmsSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !cmsForm.key.trim()) return;
    setError("");
    try {
      let parsed: unknown = cmsForm.valueText;
      const raw = cmsForm.valueText.trim();
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
      }
      await apiRequest("/api/admin/site-content", {
        method: "PUT",
        token,
        body: { items: [{ key: cmsForm.key.trim(), value: parsed }] }
      });
      setNotice("Web içerik ayarı kaydedildi.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Web içerik ayarı kaydedilemedi.");
    }
  };

  const handleCmsDelete = async (key: string) => {
    if (!token) return;
    setError("");
    try {
      await apiRequest(`/api/admin/site-content/${encodeURIComponent(key)}`, { method: "DELETE", token });
      setNotice("Web içerik ayarı silindi.");
      if (cmsForm.key === key) setCmsForm({ key: "", valueText: "" });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Web içerik ayarı silinemedi.");
    }
  };

  const selectedSector = useMemo(
    () => catalogSectors.find((item) => item.id === catalogForm.sectorId),
    [catalogForm.sectorId, catalogSectors]
  );

  return (
    <div className="admin-dashboard-shell">
      <section className="admin-exec-hero">
        <div className="admin-exec-copy">
          <p className="admin-kicker">3teklif Super Admin Control Tower</p>
          <h1>Tam Yetkili Yönetim Paneli</h1>
          <p>Web sitesi, müşteri paneli ve firma paneli dahil tüm modülleri tek panelden yönet.</p>
          <div className="admin-badge-row">
            <span className="admin-badge">Kullanıcı: {user?.email}</span>
            <span className="admin-badge">Firma: {stats?.totalCompanies ?? 0}</span>
            <span className="admin-badge">Müşteri: {stats?.totalCustomers ?? 0}</span>
            <span className="admin-badge">Açık İlan: {stats?.openListings ?? 0}</span>
            <span className="admin-badge">Açık İhale: {stats?.openTenders ?? 0}</span>
          </div>
        </div>
        <div className="admin-exec-side">
          <article className="admin-mini-stat-card">
            <p>Bekleyen Başvuru</p>
            <strong>{stats?.pendingCompanies ?? 0}</strong>
          </article>
          <article className="admin-mini-stat-card">
            <p>Bekleyen Destek</p>
            <strong>{stats?.pendingSupportMessages ?? 0}</strong>
          </article>
          <button className="ghost-btn" onClick={() => refreshAll().catch(() => undefined)} disabled={isLoading}>
            {isLoading ? "Yükleniyor..." : "Paneli Yenile"}
          </button>
          <p className="admin-sync-note">Son senkron: {lastSyncAt ? lastSyncAt.toLocaleTimeString("tr-TR") : "-"}</p>
        </div>
      </section>

      <section className="panel-card admin-nav-card">
        <div className="admin-nav-grid">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-nav-item ${activeView === item.id ? "is-active" : ""}`}
              onClick={() => setActiveView(item.id)}
            >
              <span>{item.title}</span>
              <small>{item.subtitle}</small>
            </button>
          ))}
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}
      {notice ? <p className="admin-success-note">{notice}</p> : null}

      {activeView === "overview" ? (
        <section className="admin-content-grid">
          <article className="panel-card">
            <h3>Kritik KPI</h3>
            <div className="admin-stats-grid">
              <div className="admin-stat-box"><p>Toplam Firma</p><strong>{stats?.totalCompanies ?? 0}</strong></div>
              <div className="admin-stat-box"><p>Toplam Müşteri</p><strong>{stats?.totalCustomers ?? 0}</strong></div>
              <div className="admin-stat-box"><p>Açık İlan</p><strong>{stats?.openListings ?? 0}</strong></div>
              <div className="admin-stat-box"><p>Açık İhale</p><strong>{stats?.openTenders ?? 0}</strong></div>
              <div className="admin-stat-box"><p>İlan Teklifi</p><strong>{stats?.totalBids ?? 0}</strong></div>
              <div className="admin-stat-box"><p>İhale Teklifi</p><strong>{stats?.totalTenderBids ?? 0}</strong></div>
            </div>
          </article>
        </section>
      ) : null}
      {activeView === "applications" ? (
        <section className="admin-content-grid">
          <article className="panel-card">
            <h3>Firma Başvuruları ve Evraklar</h3>
            {pendingCompanies.length > 0 ? (
              <div className="admin-card-list">
                {pendingCompanies.map((company) => (
                  <article key={company.id} className="admin-entity-card">
                    <header>
                      <h4>{company.name}</h4>
                      <span className="status-badge status-warn">{statusLabel(company.approvalStatus)}</span>
                    </header>
                    <p><strong>E-posta:</strong> {company.user?.email}</p>
                    <p><strong>Şehir:</strong> {company.city || "-"}</p>
                    <p><strong>Kategori:</strong> {company.sectors?.map((x: any) => x.sector.name).join(", ") || "-"}</p>
                    <label>
                      Başvuru notu
                      <input
                        value={approvalNotes[company.id] || ""}
                        onChange={(e) => setApprovalNotes((prev) => ({ ...prev, [company.id]: e.target.value }))}
                      />
                    </label>
                    <div className="action-row">
                      <button className="solid-btn" type="button" onClick={() => handleCompanyApproval(company.id, "APPROVED")}>Onayla</button>
                      <button className="ghost-btn" type="button" onClick={() => handleCompanyApproval(company.id, "REJECTED")}>Reddet</button>
                    </div>
                    {company.documents?.length ? (
                      <div className="admin-inner-block">
                        <h5>Evraklar</h5>
                        {company.documents.map((doc: any) => (
                          <div key={doc.id} className="admin-doc-row">
                            <div>
                              <strong>{doc.docType}</strong>
                              <p>Durum: {doc.status}</p>
                              <a href={doc.fileUrl} target="_blank" rel="noreferrer">Dosya</a>
                            </div>
                            <div className="admin-doc-actions">
                              <input
                                value={docNotes[doc.id] || ""}
                                onChange={(e) => setDocNotes((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                                placeholder="Evrak notu"
                              />
                              <div className="action-row">
                                <button className="tiny-btn" type="button" onClick={() => handleDocumentReview(doc.id, "APPROVED")}>Onayla</button>
                                <button className="tiny-btn" type="button" onClick={() => handleDocumentReview(doc.id, "REJECTED")}>Reddet</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="admin-empty-note">Bekleyen başvuru yok.</p>
            )}
          </article>
        </section>
      ) : null}

      {activeView === "companies" ? (
        <section className="admin-content-grid">
          <article className="panel-card">
            <h3>Firma Hesapları</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Firma</th>
                    <th>Onay</th>
                    <th>Üyelik</th>
                    <th>Kategoriler</th>
                    <th>Hesap</th>
                    <th>Trial</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.length ? (
                    companies.map((company) => (
                      <tr key={company.id}>
                        <td><strong>{company.name}</strong><br /><small>{company.user?.email}</small></td>
                        <td>{statusLabel(company.approvalStatus)}</td>
                        <td>{statusLabel(company.membershipType)}</td>
                        <td>{company.sectors?.map((x: any) => x.sector.name).join(", ") || "-"}</td>
                        <td>{company.user?.isActive ? "Aktif" : "Pasif"}</td>
                        <td>{fmtDate(company.trialEndsAt)}</td>
                        <td>
                          <div className="admin-table-actions">
                            <button className="tiny-btn" type="button" onClick={() => handleCompanyActive(company.id, !company.user?.isActive)}>
                              {company.user?.isActive ? "Pasife Al" : "Aktif Et"}
                            </button>
                            <div className="admin-inline-input-group">
                              <input
                                type="number"
                                value={trialDays[company.id] ?? "15"}
                                onChange={(e) => setTrialDays((prev) => ({ ...prev, [company.id]: e.target.value }))}
                              />
                              <button className="tiny-btn" type="button" onClick={() => handleTrial(company.id)}>Trial Tanımla</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} className="admin-empty-row">Firma kaydı yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel-card">
            <h3>Firmaya Paket Ata</h3>
            <form className="form-grid" onSubmit={handleAssignPackage}>
              <label>
                Firma
                <select value={subscriptionForm.companyId} onChange={(e) => setSubscriptionForm((p) => ({ ...p, companyId: e.target.value }))}>
                  <option value="">Firma seçin</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>
                Paket
                <select value={subscriptionForm.packageId} onChange={(e) => setSubscriptionForm((p) => ({ ...p, packageId: e.target.value }))}>
                  <option value="">Paket seçin</option>
                  {packages.map((p) => <option key={p.id} value={p.id}>{p.name} ({fmtMoney(p.price)})</option>)}
                </select>
              </label>
              <label>
                Ödeme Referansı
                <input value={subscriptionForm.paymentReference} onChange={(e) => setSubscriptionForm((p) => ({ ...p, paymentReference: e.target.value }))} />
              </label>
              <button className="solid-btn" type="submit">Abonelik Tanımla</button>
            </form>
          </article>
        </section>
      ) : null}

      {activeView === "customers" ? (
        <section className="admin-content-grid">
          <article className="panel-card">
            <h3>Müşteri Hesapları</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Müşteri</th>
                    <th>E-posta</th>
                    <th>Şehir</th>
                    <th>İlan</th>
                    <th>İhale</th>
                    <th>Durum</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.length ? (
                    customers.map((customer) => (
                      <tr key={customer.id}>
                        <td>{customer.fullName}</td>
                        <td>{customer.user?.email}</td>
                        <td>{customer.city || "-"}</td>
                        <td>{customer._count?.listings ?? 0}</td>
                        <td>{customer._count?.tenders ?? 0}</td>
                        <td>{customer.user?.isActive ? "Aktif" : "Pasif"}</td>
                        <td>
                          <button className="tiny-btn" type="button" onClick={() => handleCustomerActive(customer.id, !customer.user?.isActive)}>
                            {customer.user?.isActive ? "Pasife Al" : "Aktif Et"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} className="admin-empty-row">Müşteri kaydı yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}
      {activeView === "listings" ? (
        <section className="admin-content-grid">
          <article className="panel-card">
            <h3>İlanlar</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Başlık</th>
                    <th>Sektör</th>
                    <th>Müşteri</th>
                    <th>Durum</th>
                    <th>Teklif</th>
                    <th>Eşleşme</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.length ? (
                    listings.map((item) => (
                      <tr key={item.id}>
                        <td>{item.title}</td>
                        <td>{item.sector?.name}</td>
                        <td>{item.customer?.fullName}</td>
                        <td>{statusLabel(item.status)}</td>
                        <td>{item._count?.bids ?? 0}</td>
                        <td>{item._count?.matches ?? 0}</td>
                        <td>
                          <div className="admin-table-actions">
                            <button className={`tiny-btn ${selectedListingId === item.id ? "is-active" : ""}`} type="button" onClick={() => setSelectedListingId(item.id)}>Detay</button>
                            <button className="tiny-btn" type="button" onClick={() => handleListingStatus(item.id, "OPEN")}>Açık</button>
                            <button className="tiny-btn" type="button" onClick={() => handleListingStatus(item.id, "CLOSED")}>Kapat</button>
                            <button className="tiny-btn" type="button" onClick={() => handleListingStatus(item.id, "CANCELED")}>İptal</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} className="admin-empty-row">İlan yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel-card">
            <h3>Seçili İlan Detayı</h3>
            {listingDetail ? (
              <div className="admin-detail-stack">
                <p><strong>{listingDetail.title}</strong></p>
                <p>{listingDetail.description}</p>
                <div className="admin-chip-row">
                  <span className="admin-chip">Durum: {statusLabel(listingDetail.status)}</span>
                  <span className="admin-chip">Sektör: {listingDetail.sector?.name}</span>
                  <span className="admin-chip">Şehir: {listingDetail.city}</span>
                  <span className="admin-chip">Bütçe: {fmtMoney(listingDetail.budgetMin)} - {fmtMoney(listingDetail.budgetMax)}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Firma</th><th>Fiyat</th><th>Teslim</th><th>Durum</th><th>Not</th></tr></thead>
                    <tbody>
                      {listingDetail.bids?.length ? (
                        listingDetail.bids.map((bid: any) => (
                          <tr key={bid.id}>
                            <td>{bid.company?.name}</td>
                            <td>{fmtMoney(bid.price)}</td>
                            <td>{bid.deliveryDay ? `${bid.deliveryDay} gün` : "-"}</td>
                            <td>{bid.status}</td>
                            <td>{bid.note || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={5} className="admin-empty-row">Teklif kaydı yok.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="admin-empty-note">Detay için bir ilan seçin.</p>
            )}
          </article>
        </section>
      ) : null}

      {activeView === "tenders" ? (
        <section className="admin-content-grid">
          <article className="panel-card">
            <h3>İhaleler</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>İhale</th><th>Sektör</th><th>Durum</th><th>Başlangıç</th><th>Bitiş</th><th>Katılımcı</th><th>Teklif</th><th>İşlem</th></tr>
                </thead>
                <tbody>
                  {tenders.length ? (
                    tenders.map((item) => (
                      <tr key={item.id}>
                        <td>{item.listing?.title}</td>
                        <td>{item.listing?.sector?.name}</td>
                        <td>{statusLabel(item.status)}</td>
                        <td>{fmtDate(item.startsAt)}</td>
                        <td>{fmtDate(item.endsAt)}</td>
                        <td>{item._count?.participants ?? 0}</td>
                        <td>{item._count?.bids ?? 0}</td>
                        <td>
                          <div className="admin-table-actions">
                            <button className={`tiny-btn ${selectedTenderId === item.id ? "is-active" : ""}`} type="button" onClick={() => setSelectedTenderId(item.id)}>Detay</button>
                            <button className="tiny-btn" type="button" onClick={() => handleTenderStatus(item.id, "OPEN")}>Açık</button>
                            <button className="tiny-btn" type="button" onClick={() => handleTenderStatus(item.id, "DRAFT")}>Taslak</button>
                            <button className="tiny-btn" type="button" onClick={() => handleTenderStatus(item.id, "CLOSED")}>Kapat</button>
                            <button className="tiny-btn" type="button" onClick={() => handleTenderStatus(item.id, "CANCELED")}>İptal</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={8} className="admin-empty-row">İhale yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel-card">
            <h3>Seçili İhale Detayı</h3>
            {tenderDetail ? (
              <div className="admin-detail-stack">
                <p><strong>{tenderDetail.listing?.title}</strong></p>
                <div className="admin-chip-row">
                  <span className="admin-chip">Durum: {statusLabel(tenderDetail.status)}</span>
                  <span className="admin-chip">Sektör: {tenderDetail.listing?.sector?.name}</span>
                  <span className="admin-chip">Başlangıç: {fmtDate(tenderDetail.startsAt)}</span>
                  <span className="admin-chip">Bitiş: {fmtDate(tenderDetail.endsAt)}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Firma</th><th>Fiyat</th><th>Teslim</th><th>Durum</th><th>Not</th></tr></thead>
                    <tbody>
                      {tenderDetail.bids?.length ? (
                        tenderDetail.bids.map((bid: any) => (
                          <tr key={bid.id}>
                            <td>{bid.company?.name}</td>
                            <td>{fmtMoney(bid.price)}</td>
                            <td>{bid.deliveryDay ? `${bid.deliveryDay} gün` : "-"}</td>
                            <td>{bid.status}</td>
                            <td>{bid.note || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={5} className="admin-empty-row">Teklif kaydı yok.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="admin-empty-note">Detay için bir ihale seçin.</p>
            )}
          </article>
        </section>
      ) : null}

      {activeView === "catalog" ? (
        <section className="admin-content-grid">
          <article className="panel-card">
            <h3>Kategori ve Yetkinlik</h3>
            <div className="admin-form-columns">
              <form className="form-grid" onSubmit={handleCreateSector}>
                <label>Yeni kategori<input value={sectorForm.name} onChange={(e) => setSectorForm({ name: e.target.value })} required /></label>
                <button className="solid-btn" type="submit">Kategori Ekle</button>
              </form>
              <form className="form-grid" onSubmit={handleCreateCompetency}>
                <label>Yeni yetkinlik<input value={competencyForm.name} onChange={(e) => setCompetencyForm({ name: e.target.value })} required /></label>
                <button className="solid-btn" type="submit">Yetkinlik Ekle</button>
              </form>
            </div>
          </article>

          <article className="panel-card">
            <h3>Eşleştirme</h3>
            <form className="form-grid" onSubmit={handleSaveMapping}>
              <label>
                Kategori seç
                <select value={catalogForm.sectorId} onChange={(e) => setCatalogForm((p) => ({ ...p, sectorId: e.target.value }))}>
                  <option value="">Kategori seçin</option>
                  {catalogSectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <div className="sector-selector-grid">
                {catalogCompetencies.map((c) => {
                  const selected = catalogForm.competencyIds.includes(c.id);
                  return (
                    <button key={c.id} type="button" className={`sector-chip-btn ${selected ? "is-selected" : ""}`} onClick={() => toggleCompetency(c.id)}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
              <button className="solid-btn" type="submit">Kaydet</button>
            </form>
            {selectedSector ? <p className="section-subtitle">Seçili kategori: <strong>{selectedSector.name}</strong></p> : null}
          </article>
        </section>
      ) : null}
      {activeView === "packages" ? (
        <section className="admin-content-grid">
          <article className="panel-card">
            <h3>Yeni Paket</h3>
            <form className="form-grid" onSubmit={handleCreatePackage}>
              <div className="auth-grid-two">
                <label>Kod<input value={packageForm.code} onChange={(e) => setPackageForm((p) => ({ ...p, code: e.target.value }))} required /></label>
                <label>Paket adı<input value={packageForm.name} onChange={(e) => setPackageForm((p) => ({ ...p, name: e.target.value }))} required /></label>
              </div>
              <div className="auth-grid-two">
                <label>Fiyat<input type="number" value={packageForm.price} onChange={(e) => setPackageForm((p) => ({ ...p, price: e.target.value }))} required /></label>
                <label>Süre (gün)<input type="number" value={packageForm.durationDays} onChange={(e) => setPackageForm((p) => ({ ...p, durationDays: e.target.value }))} required /></label>
              </div>
              <div className="auth-grid-two">
                <label>İlan limit<input type="number" value={packageForm.listingLimit} onChange={(e) => setPackageForm((p) => ({ ...p, listingLimit: e.target.value }))} /></label>
                <label>Teklif limit<input type="number" value={packageForm.bidLimit} onChange={(e) => setPackageForm((p) => ({ ...p, bidLimit: e.target.value }))} /></label>
              </div>
              <button className="solid-btn" type="submit">Paketi Kaydet</button>
            </form>
          </article>

          <article className="panel-card">
            <h3>Paketler</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Kod</th><th>Ad</th><th>Fiyat</th><th>Süre</th><th>Durum</th><th>İşlem</th></tr></thead>
                <tbody>
                  {packages.length ? (
                    packages.map((p) => (
                      <tr key={p.id}>
                        <td>{p.code}</td><td>{p.name}</td><td>{fmtMoney(p.price)}</td><td>{p.durationDays} gün</td><td>{p.isActive ? "Aktif" : "Pasif"}</td>
                        <td><button className="tiny-btn" type="button" onClick={() => selectPackage(p)}>Düzenle</button></td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="admin-empty-row">Paket yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel-card">
            <h3>Paket Güncelle</h3>
            {packageEditForm.packageId ? (
              <form className="form-grid" onSubmit={handleUpdatePackage}>
                <div className="auth-grid-two">
                  <label>Paket adı<input value={packageEditForm.name} onChange={(e) => setPackageEditForm((p) => ({ ...p, name: e.target.value }))} /></label>
                  <label>Fiyat<input type="number" value={packageEditForm.price} onChange={(e) => setPackageEditForm((p) => ({ ...p, price: e.target.value }))} /></label>
                </div>
                <div className="auth-grid-two">
                  <label>Süre<input type="number" value={packageEditForm.durationDays} onChange={(e) => setPackageEditForm((p) => ({ ...p, durationDays: e.target.value }))} /></label>
                  <label>Durum
                    <select value={packageEditForm.isActive ? "active" : "passive"} onChange={(e) => setPackageEditForm((p) => ({ ...p, isActive: e.target.value === "active" }))}>
                      <option value="active">Aktif</option>
                      <option value="passive">Pasif</option>
                    </select>
                  </label>
                </div>
                <button className="solid-btn" type="submit">Güncelle</button>
              </form>
            ) : <p className="admin-empty-note">Düzenlemek için paket seçin.</p>}
          </article>
        </section>
      ) : null}

      {activeView === "support" ? (
        <section className="admin-content-grid">
          <article className="panel-card">
            <h3>Destek Mesajları</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Gönderen</th><th>Konu</th><th>Mesaj</th><th>Durum</th><th>İşlem</th></tr></thead>
                <tbody>
                  {supportMessages.length ? (
                    supportMessages.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.name}</strong><br /><small>{item.email}</small></td>
                        <td>{item.subject || "-"}</td>
                        <td className="admin-message-cell">{item.message}</td>
                        <td>{statusLabel(item.status)}</td>
                        <td>
                          <div className="admin-table-actions">
                            <button className="tiny-btn" type="button" onClick={() => handleSupportStatus(item.id, "NEW")}>Yeni</button>
                            <button className="tiny-btn" type="button" onClick={() => handleSupportStatus(item.id, "IN_PROGRESS")}>İşlemde</button>
                            <button className="tiny-btn" type="button" onClick={() => handleSupportStatus(item.id, "RESOLVED")}>Çözüldü</button>
                            <button className="tiny-btn" type="button" onClick={() => handleSupportStatus(item.id, "ARCHIVED")}>Arşiv</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="admin-empty-row">Destek mesajı yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {activeView === "cms" ? (
        <section className="admin-content-grid">
          <article className="panel-card">
            <h3>Web İçerik Ayarları</h3>
            <p className="section-subtitle">Landing ve site alanlarını anahtar bazlı dinamik yönet.</p>
            <form className="form-grid" onSubmit={handleCmsSave}>
              <label>İçerik anahtarı<input value={cmsForm.key} onChange={(e) => setCmsForm((p) => ({ ...p, key: e.target.value }))} required /></label>
              <label>İçerik değeri (JSON / metin)
                <textarea rows={8} value={cmsForm.valueText} onChange={(e) => setCmsForm((p) => ({ ...p, valueText: e.target.value }))} />
              </label>
              <button className="solid-btn" type="submit">Kaydet</button>
            </form>
            <div className="admin-chip-row">
              {cmsStarterKeys.map((key) => (
                <button key={key} type="button" className="sector-chip-btn" onClick={() => setCmsForm((p) => ({ ...p, key }))}>{key}</button>
              ))}
            </div>
          </article>

          <article className="panel-card">
            <h3>Kayıtlı İçerikler</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Anahtar</th><th>Değer</th><th>Güncelleyen</th><th>İşlem</th></tr></thead>
                <tbody>
                  {cmsItems.length ? (
                    cmsItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.key}</td>
                        <td className="admin-message-cell">{pretty(item.value)}</td>
                        <td>{item.updatedByUser?.email || "-"}</td>
                        <td>
                          <div className="admin-table-actions">
                            <button className="tiny-btn" type="button" onClick={() => setCmsForm({ key: item.key, valueText: pretty(item.value) })}>Düzenle</button>
                            <button className="tiny-btn" type="button" onClick={() => handleCmsDelete(item.key)}>Sil</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} className="admin-empty-row">CMS kaydı yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}
