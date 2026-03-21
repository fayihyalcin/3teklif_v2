import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { canAccessCustomerPanel, setPreferredPanel } from "../lib/panel-access";

const COMPANY_ONBOARDING_KEY = "uc_teklif_company_onboarding";
const COMPANY_OPERATIONS_KEY = "uc_teklif_company_operations";

interface CompanyProfile {
  id: string;
  name: string;
  city: string | null;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  membershipType: "TRIAL" | "PLUS";
  trialEndsAt: string | null;
  sectors: Array<{ id: string; name: string }>;
  competencies: Array<{ id: string; name: string }>;
}

interface SectorPreferenceOption {
  id: string;
  name: string;
  competencies: Array<{ id: string; name: string }>;
}

interface Opportunity {
  id: string;
  listing: {
    id: string;
    title: string;
    city: string;
    sector: { id: string; name: string };
    _count: { bids: number };
  };
}

interface BidItem {
  id: string;
  listing: { title: string; sector: { name: string } };
  price: string;
  status: string;
}

interface TenderOpportunity {
  id: string;
  status: "DRAFT" | "OPEN" | "CLOSED" | "CANCELED";
  startsAt: string;
  endsAt: string;
  listing: { id: string; title: string; sector: { name: string } };
  metrics: {
    bids: number;
    participants: number;
  };
  isJoined: boolean;
  participation: {
    id: string;
    status: "JOINED" | "WITHDRAWN";
    joinedAt: string;
  } | null;
  myBid: {
    id: string;
    price: number;
    deliveryDay: number | null;
    status: "ACTIVE" | "WITHDRAWN" | "WON" | "LOST";
    updatedAt: string;
  } | null;
}

interface TenderBidItem {
  id: string;
  tender: {
    id: string;
    status: "DRAFT" | "OPEN" | "CLOSED" | "CANCELED";
    listing: { title: string; sector: { name: string } };
  };
  price: string;
  deliveryDay: number | null;
  status: "ACTIVE" | "WITHDRAWN" | "WON" | "LOST";
  updatedAt: string;
}

interface SupportMessageItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED";
  createdAt: string;
  handledByUser: {
    id: string;
    email: string;
  } | null;
}

interface CompanyOnboardingDraft {
  companyName: string;
  authorizedName: string;
  email: string;
  phone?: string;
  taxNumber?: string;
  city?: string;
  companyType?: "BUYER" | "SUPPLIER" | "BUYER_SUPPLIER";
  sectors: string[];
  createdAt: string;
}

interface CompanyOperationsDraft {
  storeName: string;
  serviceArea: string;
  workingHours: string;
  operationNote: string;
}

type CompanyDashboardView =
  | "overview"
  | "operations"
  | "documents"
  | "preferences"
  | "offers"
  | "tenders"
  | "tracking"
  | "portfolio"
  | "support";

interface CompanyDashboardMenuItem {
  id: CompanyDashboardView;
  title: string;
  subtitle: string;
  value: string;
}

function readOnboardingDraft(): CompanyOnboardingDraft | null {
  const raw = localStorage.getItem(COMPANY_ONBOARDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CompanyOnboardingDraft;
    if (!parsed.companyName || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readOperationsDraft(): CompanyOperationsDraft | null {
  const raw = localStorage.getItem(COMPANY_OPERATIONS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CompanyOperationsDraft;
  } catch {
    return null;
  }
}

function getApprovalLabel(status: CompanyProfile["approvalStatus"] | undefined): string {
  if (status === "APPROVED") return "Onaylandı";
  if (status === "REJECTED") return "Revizyon Bekliyor";
  return "Onay Bekliyor";
}

function getCompanyTypeLabel(type: CompanyOnboardingDraft["companyType"] | undefined): string {
  if (type === "BUYER") return "Alıcı";
  if (type === "SUPPLIER") return "Tedarikçi";
  if (type === "BUYER_SUPPLIER") return "Alıcı + Tedarikçi";
  return "-";
}

function getTrialLabel(trialEndsAt: string | null | undefined): string {
  if (!trialEndsAt) return "-";
  const diff = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Süre doldu";
  return `${diff} gün kaldı`;
}

function getMembershipLabel(type: CompanyProfile["membershipType"] | undefined): string {
  if (type === "TRIAL") return "Deneme";
  if (type === "PLUS") return "Plus";
  return "-";
}

function getTenderStatusLabel(status: TenderOpportunity["status"] | TenderBidItem["tender"]["status"]): string {
  if (status === "OPEN") return "Açık";
  if (status === "CLOSED") return "Kapalı";
  if (status === "CANCELED") return "İptal";
  return "Taslak";
}

function getTenderBidStatusLabel(status: TenderBidItem["status"]): string {
  if (status === "WON") return "Kazandı";
  if (status === "LOST") return "Kaybetti";
  if (status === "WITHDRAWN") return "Geri çekildi";
  return "Aktif";
}

function getSupportStatusLabel(status: SupportMessageItem["status"]): string {
  if (status === "IN_PROGRESS") return "İşlemde";
  if (status === "RESOLVED") return "Çözüldü";
  if (status === "ARCHIVED") return "Arşiv";
  return "Yeni";
}

export function CompanyDashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [sectorOptions, setSectorOptions] = useState<SectorPreferenceOption[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [bids, setBids] = useState<BidItem[]>([]);
  const [tenderOpportunities, setTenderOpportunities] = useState<TenderOpportunity[]>([]);
  const [tenderBids, setTenderBids] = useState<TenderBidItem[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessageItem[]>([]);

  const [onboardingDraft, setOnboardingDraft] = useState<CompanyOnboardingDraft | null>(null);
  const [operationsNotice, setOperationsNotice] = useState("");
  const [preferenceNotice, setPreferenceNotice] = useState("");
  const [supportNotice, setSupportNotice] = useState("");
  const [error, setError] = useState("");

  const [operationsForm, setOperationsForm] = useState<CompanyOperationsDraft>({
    storeName: "",
    serviceArea: "",
    workingHours: "",
    operationNote: ""
  });
  const [documentForm, setDocumentForm] = useState({ docType: "", fileUrl: "", note: "" });
  const [bidForm, setBidForm] = useState({ listingId: "", price: "", deliveryDay: "", note: "" });
  const [tenderBidForm, setTenderBidForm] = useState({ tenderId: "", price: "", deliveryDay: "", note: "" });
  const [supportForm, setSupportForm] = useState({ subject: "", message: "", phone: "" });

  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [selectedCompetencyIds, setSelectedCompetencyIds] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<CompanyDashboardView>("overview");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [selectedTenderOpportunityId, setSelectedTenderOpportunityId] = useState("");

  const approvalLabel = getApprovalLabel(profile?.approvalStatus);
  const companyTypeLabel = getCompanyTypeLabel(onboardingDraft?.companyType);
  const trialLabel = getTrialLabel(profile?.trialEndsAt);
  const membershipLabel = getMembershipLabel(profile?.membershipType);

  const sectorTags = useMemo(() => {
    if (profile?.sectors?.length) return profile.sectors.map((item) => item.name);
    if (onboardingDraft?.sectors?.length) return onboardingDraft.sectors;
    return [];
  }, [profile?.sectors, onboardingDraft?.sectors]);

  const governanceChecklist = useMemo(
    () => [
      {
        label: "Mağaza/Firma ayarları tamamlandı",
        isDone: Boolean(operationsForm.storeName && operationsForm.serviceArea && operationsForm.workingHours)
      },
      { label: "Evrak onay süreci", isDone: profile?.approvalStatus === "APPROVED" },
      { label: "Aktif teklif operasyonu", isDone: bids.length > 0 }
    ],
    [operationsForm.storeName, operationsForm.serviceArea, operationsForm.workingHours, profile?.approvalStatus, bids.length]
  );

  const governanceCompletedCount = useMemo(() => governanceChecklist.filter((item) => item.isDone).length, [governanceChecklist]);
  const governanceProgress = useMemo(() => {
    if (governanceChecklist.length === 0) return 0;
    return Math.round((governanceCompletedCount / governanceChecklist.length) * 100);
  }, [governanceChecklist.length, governanceCompletedCount]);

  const featuredOpportunities = useMemo(() => opportunities.slice(0, 4), [opportunities]);
  const highlightedTenders = useMemo(() => tenderOpportunities.slice(0, 3), [tenderOpportunities]);
  const joinedTenderCount = useMemo(
    () => tenderOpportunities.filter((item) => item.isJoined).length,
    [tenderOpportunities]
  );
  const openSupportMessageCount = useMemo(
    () => supportMessages.filter((item) => item.status === "NEW" || item.status === "IN_PROGRESS").length,
    [supportMessages]
  );
  const selectedTenderOpportunity = useMemo(
    () =>
      tenderOpportunities.find((item) => item.id === selectedTenderOpportunityId) ??
      tenderOpportunities[0] ??
      null,
    [selectedTenderOpportunityId, tenderOpportunities]
  );

  const selectedSectorsForPanel = useMemo(
    () => sectorOptions.filter((item) => selectedSectorIds.includes(item.id)),
    [sectorOptions, selectedSectorIds]
  );

  const availableCompetencies = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const sector of selectedSectorsForPanel) {
      for (const competency of sector.competencies) {
        if (!map.has(competency.id)) map.set(competency.id, competency);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [selectedSectorsForPanel]);

  const dashboardMenuItems = useMemo<CompanyDashboardMenuItem[]>(
    () => [
      { id: "overview", title: "Genel Bakış", subtitle: "Özet durum", value: `%${governanceProgress}` },
      { id: "operations", title: "Mağaza/Firma", subtitle: "Operasyon ayarları", value: operationsForm.storeName ? "Hazır" : "Eksik" },
      { id: "documents", title: "Evrak Merkezi", subtitle: "Onay belgeleri", value: approvalLabel },
      { id: "preferences", title: "Kategori ve Yetkinlik", subtitle: "Hizmet alanları", value: `${selectedSectorIds.length} / ${selectedCompetencyIds.length}` },
      { id: "offers", title: "Teklif Merkezi", subtitle: "İlan teklifleri", value: `${opportunities.length} fırsat` },
      { id: "tenders", title: "İhale Merkezi", subtitle: "İhale teklifleri", value: `${joinedTenderCount} katılım` },
      { id: "tracking", title: "İş Takibi", subtitle: "Açık fırsatlar", value: `${opportunities.length} kayıt` },
      { id: "portfolio", title: "Portföy", subtitle: "Gönderilen teklifler", value: `${bids.length} teklif` },
      { id: "support", title: "Destek", subtitle: "Sistem sahibine yaz", value: `${openSupportMessageCount} açık` }
    ],
    [
      governanceProgress,
      operationsForm.storeName,
      approvalLabel,
      selectedSectorIds.length,
      selectedCompetencyIds.length,
      opportunities.length,
      joinedTenderCount,
      bids.length,
      openSupportMessageCount
    ]
  );

  const activeMenuItem = useMemo(() => dashboardMenuItems.find((item) => item.id === activeView), [dashboardMenuItems, activeView]);
  const canOpenCustomerPanel = canAccessCustomerPanel(user);

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) return;
      if (!options?.silent) {
        setError("");
      }

      try {
        const [
          profileResponse,
          opportunitiesResponse,
          bidsResponse,
          tenderOppResponse,
          tenderBidsResponse,
          optionsResponse,
          supportMessagesResponse
        ] = await Promise.all([
          apiRequest<{ item: CompanyProfile }>("/api/company/profile", { token }),
          apiRequest<{ items: Opportunity[] }>("/api/company/opportunities", { token }),
          apiRequest<{ items: BidItem[] }>("/api/company/bids", { token }),
          apiRequest<{ items: TenderOpportunity[] }>("/api/company/tenders/opportunities", { token }),
          apiRequest<{ items: TenderBidItem[] }>("/api/company/tenders/bids", { token }),
          apiRequest<{ items: SectorPreferenceOption[] }>("/api/company/preferences/options", { token }),
          apiRequest<{ items: SupportMessageItem[] }>("/api/company/support-messages", { token })
        ]);

        setProfile(profileResponse.item);
        setOpportunities(opportunitiesResponse.items);
        setBids(bidsResponse.items);
        setTenderOpportunities(tenderOppResponse.items);
        setTenderBids(tenderBidsResponse.items);
        setSectorOptions(optionsResponse.items);
        setSupportMessages(supportMessagesResponse.items);

        setSelectedSectorIds((prev) =>
          prev.length > 0 ? prev : profileResponse.item.sectors.map((item) => item.id)
        );
        setSelectedCompetencyIds((prev) =>
          prev.length > 0 ? prev : profileResponse.item.competencies.map((item) => item.id)
        );

        setBidForm((prev) => {
          const hasSelectedListing = opportunitiesResponse.items.some((item) => item.listing.id === prev.listingId);
          if (hasSelectedListing) {
            return prev;
          }
          return { ...prev, listingId: opportunitiesResponse.items[0]?.listing.id ?? "" };
        });

        setTenderBidForm((prev) => {
          const hasSelectedTender = tenderOppResponse.items.some((item) => item.id === prev.tenderId);
          if (hasSelectedTender) {
            return prev;
          }
          return { ...prev, tenderId: tenderOppResponse.items[0]?.id ?? "" };
        });

        setSelectedTenderOpportunityId((prev) => {
          const hasSelectedTender = tenderOppResponse.items.some((item) => item.id === prev);
          if (hasSelectedTender) {
            return prev;
          }
          return tenderOppResponse.items[0]?.id ?? "";
        });

        setLastSyncAt(new Date());
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : "Firma panel verileri yüklenemedi.");
        }
      }
    },
    [token]
  );

  useEffect(() => {
    loadData().catch(() => setError("Firma panel verileri yüklenemedi."));
  }, [loadData]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadData({ silent: true }).catch(() => undefined);
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadData, token]);

  useEffect(() => {
    const onboarding = readOnboardingDraft();
    setOnboardingDraft(onboarding);

    const operations = readOperationsDraft();
    if (operations) {
      setOperationsForm(operations);
    } else if (onboarding) {
      setOperationsForm((prev) => ({ ...prev, storeName: onboarding.companyName, serviceArea: onboarding.city || prev.serviceArea }));
    }
  }, []);

  const handleOperationsSubmit = (event: FormEvent) => {
    event.preventDefault();
    localStorage.setItem(COMPANY_OPERATIONS_KEY, JSON.stringify(operationsForm));
    setOperationsNotice("Mağaza/Firma ayarları kaydedildi.");
  };

  const handleDocumentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setError("");
    try {
      await apiRequest<{ message: string }>("/api/company/documents", {
        method: "POST",
        token,
        body: { docType: documentForm.docType, fileUrl: documentForm.fileUrl, note: documentForm.note || undefined }
      });
      setDocumentForm({ docType: "", fileUrl: "", note: "" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evrak yüklenemedi.");
    }
  };

  const handleBidSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setError("");
    try {
      await apiRequest<{ message: string }>("/api/company/bids", {
        method: "POST",
        token,
        body: {
          listingId: bidForm.listingId,
          price: Number(bidForm.price),
          deliveryDay: bidForm.deliveryDay ? Number(bidForm.deliveryDay) : undefined,
          note: bidForm.note || undefined
        }
      });
      setBidForm((prev) => ({ ...prev, price: "", deliveryDay: "", note: "" }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Teklif kaydedilemedi.");
    }
  };

  const handleTenderBidSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

    const selectedTender = tenderOpportunities.find((item) => item.id === tenderBidForm.tenderId);
    if (!selectedTender || !selectedTender.isJoined) {
      setError("İhale teklifinden önce ilgili ihaleye katılman gerekiyor.");
      return;
    }

    setError("");
    try {
      await apiRequest<{ message: string }>("/api/company/tenders/bids", {
        method: "POST",
        token,
        body: {
          tenderId: tenderBidForm.tenderId,
          price: Number(tenderBidForm.price),
          deliveryDay: tenderBidForm.deliveryDay ? Number(tenderBidForm.deliveryDay) : undefined,
          note: tenderBidForm.note || undefined
        }
      });
      setTenderBidForm((prev) => ({ ...prev, price: "", deliveryDay: "", note: "" }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İhale teklifi kaydedilemedi.");
    }
  };

  const handleJoinTender = async (tenderId: string) => {
    if (!token) return;

    setError("");
    try {
      await apiRequest<{ message: string }>(`/api/company/tenders/${tenderId}/join`, {
        method: "POST",
        token
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İhale katılımı kaydedilemedi.");
    }
  };

  const handleLeaveTender = async (tenderId: string) => {
    if (!token) return;

    setError("");
    try {
      await apiRequest<{ message: string }>(`/api/company/tenders/${tenderId}/join`, {
        method: "DELETE",
        token
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İhale katılımı geri çekilemedi.");
    }
  };

  const toggleSectorPreference = (sectorId: string) => {
    setSelectedSectorIds((prev) => {
      const next = prev.includes(sectorId) ? prev.filter((id) => id !== sectorId) : [...prev, sectorId];
      const allowedCompetencyIds = new Set(
        sectorOptions.filter((sector) => next.includes(sector.id)).flatMap((sector) => sector.competencies.map((competency) => competency.id))
      );
      setSelectedCompetencyIds((current) => current.filter((id) => allowedCompetencyIds.has(id)));
      return next;
    });
  };

  const toggleCompetencyPreference = (competencyId: string) => {
    setSelectedCompetencyIds((prev) => (prev.includes(competencyId) ? prev.filter((id) => id !== competencyId) : [...prev, competencyId]));
  };

  const handlePreferencesSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (selectedSectorIds.length === 0) {
      setError("En az bir kategori seçin.");
      return;
    }

    setError("");
    setPreferenceNotice("");
    try {
      await apiRequest<{ message: string }>("/api/company/preferences", {
        method: "PUT",
        token,
        body: { sectorIds: selectedSectorIds, competencyIds: selectedCompetencyIds }
      });
      setPreferenceNotice("Kategori ve yetkinlik tercihleri kaydedildi.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tercihler kaydedilemedi.");
    }
  };

  const handleSupportSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

    const message = supportForm.message.trim();
    if (message.length < 8) {
      setError("Destek mesajı en az 8 karakter olmalıdır.");
      return;
    }

    setError("");
    setSupportNotice("");
    setOperationsNotice("");
    setPreferenceNotice("");

    try {
      await apiRequest<{ message: string }>("/api/company/support-messages", {
        method: "POST",
        token,
        body: {
          subject: supportForm.subject.trim() || undefined,
          message,
          phone: supportForm.phone.trim() || undefined
        }
      });

      setSupportForm({ subject: "", message: "", phone: "" });
      setSupportNotice("Destek talebiniz sistem sahibine iletildi.");
      setActiveView("support");
      await loadData({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Destek talebi gönderilemedi.");
    }
  };

  const clearOnboarding = () => {
    localStorage.removeItem(COMPANY_ONBOARDING_KEY);
    setOnboardingDraft(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("welcome");
    setSearchParams(nextParams);
  };

  const hideWelcomeQuery = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("welcome");
    setSearchParams(nextParams);
  };

  const isWelcomeMode = searchParams.get("welcome") === "1";

  return (
    <div className="company-dashboard-shell">
      <section className="company-exec-hero">
        <div className="company-exec-copy">
          <p className="company-kicker">3teklif Company Suite</p>
          <h1>{profile?.name ?? onboardingDraft?.companyName ?? "Firma"} Kurumsal Kontrol Merkezi</h1>
          <p>
            Teklif operasyonu, evrak yönetimi ve iş takibini tek bir üst panelden yönet. Ekibini aynı ritimde tut,
            fırsat kaçırma.
          </p>
          <div className="company-badge-row">
            <span className={`company-badge ${profile?.approvalStatus === "APPROVED" ? "is-good" : "is-warn"}`}>
              Onay: {approvalLabel}
            </span>
            <span className="company-badge">Üyelik: {membershipLabel}</span>
            <span className="company-badge">Deneme: {trialLabel}</span>
            <span className="company-badge">Sektör: {sectorTags.length}</span>
          </div>
          <div className="company-exec-actions">
            <button className="solid-btn company-quick-action" type="button" onClick={() => setActiveView("offers")}>
              Teklif Merkezine Git
            </button>
            {canOpenCustomerPanel ? (
              <button
                className="ghost-btn company-quick-action"
                type="button"
                onClick={() => {
                  setPreferredPanel("customer");
                  navigate("/dashboard/customer");
                }}
              >
                Müşteri Paneline Geç
              </button>
            ) : null}
            <button className="ghost-btn company-quick-action" type="button" onClick={() => setActiveView("operations")}>
              Operasyon Ayarları
            </button>
            <button className="ghost-btn company-quick-action" type="button" onClick={() => setActiveView("preferences")}>
              Kategori ve Yetkinlik
            </button>
            <button className="ghost-btn company-quick-action" type="button" onClick={() => setActiveView("documents")}>
              Evrak Merkezi
            </button>
            <button className="ghost-btn company-quick-action" type="button" onClick={() => setActiveView("support")}>
              Destek
            </button>
          </div>
          <div className="company-progress-strip">
            <div className="company-progress-head">
              <span>Kurumsal uyum durumu</span>
              <strong>%{governanceProgress}</strong>
            </div>
            <div className="company-progress-track" aria-hidden="true">
              <span style={{ width: `${governanceProgress}%` }} />
            </div>
          </div>
          <p className="company-sync-note">
            Canlı senkron açık {lastSyncAt ? `- Son güncelleme: ${lastSyncAt.toLocaleTimeString("tr-TR")}` : ""}
          </p>
        </div>
        <div className="company-exec-metrics">
          <article className="company-metric-card">
            <p>Açık fırsat</p>
            <strong>{opportunities.length}</strong>
            <span>Paneline düşen ilan sayısı</span>
          </article>
          <article className="company-metric-card">
            <p>Aktif teklif</p>
            <strong>{bids.length}</strong>
            <span>Yönetilen teklif adedi</span>
          </article>
          <article className="company-metric-card">
            <p>Açık ihale</p>
            <strong>{tenderOpportunities.length}</strong>
            <span>İhale fırsatı sayısı</span>
          </article>
          <article className="company-metric-card">
            <p>Tamamlanan adım</p>
            <strong>
              {governanceCompletedCount}/{governanceChecklist.length}
            </strong>
            <span>Kurumsal checklist ilerlemesi</span>
          </article>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel-card company-dashboard-nav" aria-label="Firma dashboard menüsü">
        <div className="company-dashboard-nav-head">
          <h2>Panel Menüsü</h2>
          <p>
            Aktif bölüm: <strong>{activeMenuItem?.title ?? "Genel Bakış"}</strong> - {activeMenuItem?.subtitle}
          </p>
        </div>
        <div className="company-dashboard-nav-grid">
          {dashboardMenuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`company-dashboard-nav-item ${activeView === item.id ? "is-active" : ""}`}
              onClick={() => setActiveView(item.id)}
            >
              <span>{item.title}</span>
              <small>{item.subtitle}</small>
              <strong>{item.value}</strong>
            </button>
          ))}
        </div>
      </section>

      {(isWelcomeMode || onboardingDraft) && activeView === "overview" ? (
        <section className="panel-card company-onboarding-brief">
          <div className="company-onboarding-head">
            <div>
              <h2>Kurumsal Açılış Özeti</h2>
              <p>Başvuru tamamlandı. Aşağıdaki adımlarla operasyonunu hızla yayına alabilirsin.</p>
            </div>
            <div className="company-quick-actions">
              <button className="solid-btn company-quick-action" type="button" onClick={() => setActiveView("operations")}>
                Mağaza/Firma İşlemleri
              </button>
              <button className="ghost-btn company-quick-action" type="button" onClick={() => setActiveView("preferences")}>
                Kategori ve Yetkinlik
              </button>
              <button className="ghost-btn company-quick-action" type="button" onClick={() => setActiveView("documents")}>
                Evrak Yükleme
              </button>
              <button className="ghost-btn company-quick-action" type="button" onClick={() => setActiveView("tracking")}>
                İş Takibi
              </button>
              {onboardingDraft ? (
                <button className="tiny-btn" type="button" onClick={clearOnboarding}>
                  Özeti Gizle
                </button>
              ) : (
                <button className="tiny-btn" type="button" onClick={hideWelcomeQuery}>
                  Kapat
                </button>
              )}
            </div>
          </div>

          {onboardingDraft ? (
            <div className="company-intake-grid">
              <article className="company-intake-item">
                <h3>Başvuru Profili</h3>
                <p>Yetkili: {onboardingDraft.authorizedName}</p>
                <p>E-posta: {onboardingDraft.email}</p>
                <p>Telefon: {onboardingDraft.phone || "-"}</p>
                <p>Firma tipi: {companyTypeLabel}</p>
              </article>
              <article className="company-intake-item">
                <h3>Sektör Alanları</h3>
                <div className="company-chip-row">
                  {sectorTags.map((sector) => (
                    <span key={sector} className="company-chip">
                      {sector}
                    </span>
                  ))}
                </div>
                <p>Şehir: {onboardingDraft.city || "-"}</p>
                <p>Vergi no: {onboardingDraft.taxNumber || "-"}</p>
              </article>
              <article className="company-intake-item">
                <h3>Uygulama Planı</h3>
                {governanceChecklist.map((item) => (
                  <p key={item.label} className={`company-governance-item ${item.isDone ? "is-done" : "is-pending"}`}>
                    {item.label}
                  </p>
                ))}
              </article>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className={`company-workbench-grid ${activeView !== "overview" ? "is-focused" : ""}`}>
        {activeView === "operations" ? (
          <section className="panel-card company-module company-module-wide" id="company-operations">
            <h3>Mağaza/Firma İşlemleri</h3>
            <p className="company-module-subtitle">Kurumsal operasyon ayarlarını tek merkezden yönet.</p>
            <form className="form-grid" onSubmit={handleOperationsSubmit}>
              <div className="auth-grid-two">
                <label>
                  Mağaza / Marka Adı
                  <input value={operationsForm.storeName} onChange={(e) => setOperationsForm((prev) => ({ ...prev, storeName: e.target.value }))} placeholder="Örn: Teklifz Store" required />
                </label>
                <label>
                  Hizmet Bölgesi
                  <input value={operationsForm.serviceArea} onChange={(e) => setOperationsForm((prev) => ({ ...prev, serviceArea: e.target.value }))} placeholder="İstanbul, Kocaeli, Bursa" required />
                </label>
              </div>
              <div className="auth-grid-two">
                <label>
                  Çalışma Saatleri
                  <input value={operationsForm.workingHours} onChange={(e) => setOperationsForm((prev) => ({ ...prev, workingHours: e.target.value }))} placeholder="Hafta içi 09:00 - 18:00" required />
                </label>
                <label>
                  Operasyon Notu
                  <input value={operationsForm.operationNote} onChange={(e) => setOperationsForm((prev) => ({ ...prev, operationNote: e.target.value }))} placeholder="Teslimat, stok ve süreç notları" />
                </label>
              </div>
              {operationsNotice ? <p className="company-note-success">{operationsNotice}</p> : null}
              <button className="solid-btn" type="submit">Ayarları Kaydet</button>
            </form>
          </section>
        ) : null}

        {activeView === "documents" ? (
          <section className="panel-card company-module company-module-wide" id="company-documents">
            <h3>Evrak Yükleme Merkezi</h3>
            <p className="company-module-subtitle">Onay süreci için belgeleri standart formatta ilet.</p>
            <form className="form-grid" onSubmit={handleDocumentSubmit}>
              <label>
                Evrak Tipi
                <input value={documentForm.docType} onChange={(e) => setDocumentForm((prev) => ({ ...prev, docType: e.target.value }))} required />
              </label>
              <label>
                Dosya URL
                <input type="url" value={documentForm.fileUrl} onChange={(e) => setDocumentForm((prev) => ({ ...prev, fileUrl: e.target.value }))} required />
              </label>
              <label>
                Not
                <input value={documentForm.note} onChange={(e) => setDocumentForm((prev) => ({ ...prev, note: e.target.value }))} />
              </label>
              <button className="solid-btn" type="submit">Evrakı Gönder</button>
            </form>
          </section>
        ) : null}

        {activeView === "preferences" ? (
          <section className="panel-card company-module company-module-wide">
            <h3>Kategori ve Yetkinlik Seçimi</h3>
            <p className="company-module-subtitle">Adminin tanımladığı kategori ve yetkinliklerden hizmet alanını seç.</p>
            <form className="form-grid" onSubmit={handlePreferencesSubmit}>
              <div className="company-preference-group">
                <p className="company-preference-label">Kategoriler</p>
                <div className="sector-selector-grid">
                  {sectorOptions.map((sector) => {
                    const isSelected = selectedSectorIds.includes(sector.id);
                    return (
                      <button key={sector.id} type="button" className={`sector-chip-btn ${isSelected ? "is-selected" : ""}`} onClick={() => toggleSectorPreference(sector.id)} aria-pressed={isSelected}>
                        {sector.name}
                      </button>
                    );
                  })}
                </div>
                <p className="company-preference-help">{selectedSectorIds.length > 0 ? `${selectedSectorIds.length} kategori seçildi.` : "En az bir kategori seçmelisin."}</p>
              </div>

              <div className="company-preference-group">
                <p className="company-preference-label">Yetkinlikler</p>
                {availableCompetencies.length > 0 ? (
                  <div className="sector-selector-grid">
                    {availableCompetencies.map((competency) => {
                      const isSelected = selectedCompetencyIds.includes(competency.id);
                      return (
                        <button key={competency.id} type="button" className={`sector-chip-btn company-competency-chip ${isSelected ? "is-selected" : ""}`} onClick={() => toggleCompetencyPreference(competency.id)} aria-pressed={isSelected}>
                          {competency.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="company-empty-note">Seçili kategoriler için tanımlı yetkinlik yok.</p>
                )}
                <p className="company-preference-help">{selectedCompetencyIds.length > 0 ? `${selectedCompetencyIds.length} yetkinlik seçildi.` : "Yetkinlik seçimi opsiyoneldir."}</p>
              </div>

              {preferenceNotice ? <p className="company-note-success">{preferenceNotice}</p> : null}
              <button className="solid-btn" type="submit">Tercihleri Kaydet</button>
            </form>
          </section>
        ) : null}

        {activeView === "support" ? (
          <section className="panel-card company-module company-module-wide">
            <div className="customer-module-head">
              <div>
                <h3>Destek Merkezi</h3>
                <p className="company-module-subtitle">Panel, ihale ve teklif süreçleri için sistem sahibine yaz.</p>
              </div>
              <span className="status-badge status-neutral">{openSupportMessageCount} açık talep</span>
            </div>

            <div className="customer-settings-grid">
              <form className="form-grid customer-settings-form" onSubmit={handleSupportSubmit}>
                <label>
                  Konu
                  <input
                    value={supportForm.subject}
                    onChange={(event) => setSupportForm((prev) => ({ ...prev, subject: event.target.value }))}
                    placeholder="Örn: İhale katılımında hata alıyorum"
                  />
                </label>
                <label>
                  Telefon (opsiyonel)
                  <input
                    value={supportForm.phone}
                    onChange={(event) => setSupportForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="+90 5xx xxx xx xx"
                  />
                </label>
                <label>
                  Mesaj
                  <textarea
                    minLength={8}
                    value={supportForm.message}
                    onChange={(event) => setSupportForm((prev) => ({ ...prev, message: event.target.value }))}
                    placeholder="Detayları açıklayın, ekip hızlı geri dönüş yapsın."
                    required
                  />
                </label>
                <div className="customer-settings-actions">
                  <button className="solid-btn" type="submit">
                    Destek Talebi Gönder
                  </button>
                </div>
                {supportNotice ? <p className="company-note-success">{supportNotice}</p> : null}
              </form>

              <aside className="customer-settings-overview">
                <p className="customer-settings-kicker">Talep Geçmişi</p>
                {supportMessages.length > 0 ? (
                  <div className="customer-settings-list">
                    {supportMessages.slice(0, 6).map((item) => (
                      <p key={item.id}>
                        {getSupportStatusLabel(item.status)} - {item.subject || "Konu belirtilmedi"} ({new Date(item.createdAt).toLocaleString("tr-TR")})
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="company-empty-note">Henüz destek talebi yok.</p>
                )}
              </aside>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Konu</th>
                    <th>Mesaj</th>
                    <th>Durum</th>
                    <th>İşleyen</th>
                  </tr>
                </thead>
                <tbody>
                  {supportMessages.length > 0 ? (
                    supportMessages.map((item) => (
                      <tr key={item.id}>
                        <td>{new Date(item.createdAt).toLocaleString("tr-TR")}</td>
                        <td>{item.subject || "-"}</td>
                        <td>{item.message}</td>
                        <td>{getSupportStatusLabel(item.status)}</td>
                        <td>{item.handledByUser?.email || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="company-empty-row" colSpan={5}>
                        Görüntülenecek destek kaydı yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeView === "overview" || activeView === "documents" || activeView === "preferences" ? (
          <section className="panel-card company-module company-module-wide">
            <h3>Kurumsal Uyum Durumu</h3>
            <p className="company-module-subtitle">Başvuru ve operasyon adımlarının tamamlanma durumu.</p>
            <div className="company-governance-list">
              {governanceChecklist.map((item) => (
                <article key={item.label} className={`company-governance-row ${item.isDone ? "is-done" : "is-pending"}`}>
                  <span>{item.label}</span>
                  <strong>{item.isDone ? "Tamamlandı" : "Bekliyor"}</strong>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {activeView === "overview" || activeView === "offers" ? (
          <section className="panel-card company-module">
            <h3>Fırsat Önceliklendirme</h3>
            <p className="company-module-subtitle">Ekibinin ilk bakması gereken sıcak fırsatlar.</p>
            <div className="company-priority-list">
              {featuredOpportunities.length > 0 ? (
                featuredOpportunities.map((item) => (
                  <article key={item.id} className="company-priority-item">
                    <div className="company-priority-item-head">
                      <strong>{item.listing.title}</strong>
                      <span>{item.listing.city}</span>
                    </div>
                    <div className="company-priority-meta">
                      <span>{item.listing.sector.name}</span>
                      <span>{item.listing._count.bids} teklif</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="company-empty-note">Henüz paneline düşen yeni fırsat yok.</p>
              )}
            </div>
          </section>
        ) : null}

        {activeView === "offers" ? (
          <section className="panel-card company-module company-module-wide" id="offer-center">
            <h3>İlan Teklifi Ver</h3>
            <p className="company-module-subtitle">Açık ilanlara kurumsal fiyat teklifini hızlıca gönder.</p>
            <form className="form-grid" onSubmit={handleBidSubmit}>
              <label>
                İlan
                <select value={bidForm.listingId} onChange={(e) => setBidForm((prev) => ({ ...prev, listingId: e.target.value }))} required>
                  <option value="">İlan seçin</option>
                  {opportunities.map((item) => (
                    <option key={item.id} value={item.listing.id}>
                      {item.listing.title} ({item.listing.sector.name})
                    </option>
                  ))}
                </select>
              </label>
              <div className="auth-grid-two">
                <label>
                  Fiyat (TL)
                  <input type="number" value={bidForm.price} onChange={(e) => setBidForm((prev) => ({ ...prev, price: e.target.value }))} required />
                </label>
                <label>
                  Teslim Günü
                  <input type="number" value={bidForm.deliveryDay} onChange={(e) => setBidForm((prev) => ({ ...prev, deliveryDay: e.target.value }))} />
                </label>
              </div>
              <label>
                Not
                <input value={bidForm.note} onChange={(e) => setBidForm((prev) => ({ ...prev, note: e.target.value }))} />
              </label>
              <button className="solid-btn" type="submit">Teklif Kaydet</button>
            </form>
          </section>
        ) : null}

        {activeView === "tenders" ? (
          <section className="panel-card company-module company-module-wide">
            <h3>İhale Fırsatları ve Katılım</h3>
            <p className="company-module-subtitle">
              Önce ihaleye katıl, ardından teklifini gönderip güncelle. Katılım olmadan ihale teklifi verilemez.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>İhale</th>
                    <th>Durum</th>
                    <th>Bitiş</th>
                    <th>Katılımcı</th>
                    <th>Teklif</th>
                    <th>Katılım</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {tenderOpportunities.length > 0 ? (
                    tenderOpportunities.map((item) => (
                      <tr key={item.id}>
                        <td>{item.listing.title}</td>
                        <td>{getTenderStatusLabel(item.status)}</td>
                        <td>{new Date(item.endsAt).toLocaleString("tr-TR")}</td>
                        <td>{item.metrics.participants}</td>
                        <td>{item.metrics.bids}</td>
                        <td>{item.isJoined ? "Katıldı" : "Katılmadı"}</td>
                        <td>
                          <div className="company-tender-action-row">
                            <button
                              className={`tiny-btn ${selectedTenderOpportunityId === item.id ? "is-active" : ""}`}
                              type="button"
                              onClick={() => {
                                setSelectedTenderOpportunityId(item.id);
                                setTenderBidForm((prev) => ({ ...prev, tenderId: item.id }));
                              }}
                            >
                              Seç
                            </button>
                            {item.isJoined ? (
                              <button className="tiny-btn" type="button" onClick={() => handleLeaveTender(item.id).catch(() => undefined)}>
                                Çekil
                              </button>
                            ) : (
                              <button className="tiny-btn" type="button" onClick={() => handleJoinTender(item.id).catch(() => undefined)}>
                                Katıl
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="company-empty-row" colSpan={7}>
                        Uygun ihale fırsatı bulunmuyor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeView === "tenders" ? (
          <section className="panel-card company-module">
            <h3>İhale Teklifi Ver</h3>
            <p className="company-module-subtitle">
              Seçili ihale: <strong>{selectedTenderOpportunity?.listing.title ?? "-"}</strong>
            </p>
            <form className="form-grid" onSubmit={handleTenderBidSubmit}>
              <label>
                İhale
                <select
                  value={tenderBidForm.tenderId}
                  onChange={(e) => setTenderBidForm((prev) => ({ ...prev, tenderId: e.target.value }))}
                  required
                >
                  <option value="">İhale seçin</option>
                  {tenderOpportunities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.listing.title} - Bitiş: {new Date(item.endsAt).toLocaleString("tr-TR")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fiyat (TL)
                <input type="number" value={tenderBidForm.price} onChange={(e) => setTenderBidForm((prev) => ({ ...prev, price: e.target.value }))} required />
              </label>
              <label>
                Teslim Günü
                <input type="number" value={tenderBidForm.deliveryDay} onChange={(e) => setTenderBidForm((prev) => ({ ...prev, deliveryDay: e.target.value }))} />
              </label>
              <label>
                Not
                <input value={tenderBidForm.note} onChange={(e) => setTenderBidForm((prev) => ({ ...prev, note: e.target.value }))} />
              </label>
              <button
                className="solid-btn"
                type="submit"
                disabled={!selectedTenderOpportunity || !selectedTenderOpportunity.isJoined}
              >
                İhale Teklifi Kaydet
              </button>
            </form>
            {selectedTenderOpportunity && !selectedTenderOpportunity.isJoined ? (
              <p className="company-empty-note">Teklif vermek için önce ihaleye katıl butonunu kullan.</p>
            ) : null}
          </section>
        ) : null}

        {activeView === "tenders" ? (
          <section className="panel-card company-module">
            <h3>İhale Teklif Portföyü</h3>
            <p className="company-module-subtitle">Gönderdiğin ihale tekliflerinin güncel durumları.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>İhale</th>
                    <th>Sektör</th>
                    <th>Durum</th>
                    <th>Fiyat</th>
                    <th>Teslim</th>
                    <th>İhale Durumu</th>
                  </tr>
                </thead>
                <tbody>
                  {tenderBids.length > 0 ? (
                    tenderBids.map((item) => (
                      <tr key={item.id}>
                        <td>{item.tender.listing.title}</td>
                        <td>{item.tender.listing.sector.name}</td>
                        <td>{getTenderBidStatusLabel(item.status)}</td>
                        <td>{item.price}</td>
                        <td>{item.deliveryDay ? `${item.deliveryDay} gün` : "-"}</td>
                        <td>{getTenderStatusLabel(item.tender.status)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="company-empty-row" colSpan={6}>
                        Henüz ihale teklif kaydın yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeView === "overview" || activeView === "tenders" ? (
          <section className="panel-card company-module">
            <h3>İhale Ajandası</h3>
            <p className="company-module-subtitle">Yaklaşan ihaleleri kaçırmamak için hızlı görünüm.</p>
            <div className="company-priority-list">
              {highlightedTenders.length > 0 ? (
                highlightedTenders.map((item) => (
                  <article key={item.id} className="company-priority-item">
                    <div className="company-priority-item-head">
                      <strong>{item.listing.title}</strong>
                      <span>{new Date(item.endsAt).toLocaleDateString("tr-TR")}</span>
                    </div>
                    <div className="company-priority-meta">
                      <span>{item.listing.sector.name}</span>
                      <span>{item.metrics.bids} teklif</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="company-empty-note">Takipte aktif ihale görünmüyor.</p>
              )}
            </div>
          </section>
        ) : null}

        {activeView === "tracking" ? (
          <section className="panel-card company-module company-module-wide" id="work-tracking">
            <h3>İş Takibi - Açık Fırsatlar</h3>
            <p className="company-module-subtitle">Ekip gündemindeki ilanları tek tabloda takip et.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Başlık</th>
                    <th>Sektör</th>
                    <th>Şehir</th>
                    <th>Teklif</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.length > 0 ? (
                    opportunities.map((item) => (
                      <tr key={item.id}>
                        <td>{item.listing.title}</td>
                        <td>{item.listing.sector.name}</td>
                        <td>{item.listing.city}</td>
                        <td>{item.listing._count.bids}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="company-empty-row" colSpan={4}>
                        Şu anda iş takibine düşen açık fırsat bulunmuyor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeView === "portfolio" ? (
          <section className="panel-card company-module company-module-wide">
            <h3>Teklif Portföyü</h3>
            <p className="company-module-subtitle">Gönderdiğin tekliflerin güncel durum özeti.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>İlan</th>
                    <th>Sektör</th>
                    <th>Fiyat</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.length > 0 ? (
                    bids.map((item) => (
                      <tr key={item.id}>
                        <td>{item.listing.title}</td>
                        <td>{item.listing.sector.name}</td>
                        <td>{item.price}</td>
                        <td>{item.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="company-empty-row" colSpan={4}>
                        Henüz kayıtlı teklifin yok. İlk teklifini bu panelden oluşturabilirsin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}


