import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { canAccessCompanyPanel, setPreferredPanel } from "../lib/panel-access";

interface Sector {
  id: string;
  name: string;
}

interface Listing {
  id: string;
  title: string;
  description: string;
  listingType: "SERVICE" | "PRODUCT";
  city: string;
  status: "OPEN" | "CLOSED" | "CANCELED";
  createdAt: string;
  expiresAt: string | null;
  budgetMin: number | string | null;
  budgetMax: number | string | null;
  sector: Sector;
  _count: {
    bids: number;
    matches: number;
  };
}

interface Tender {
  id: string;
  status: "DRAFT" | "OPEN" | "CLOSED" | "CANCELED";
  startsAt: string;
  endsAt: string;
  listing: {
    id: string;
    title: string;
    sector: Sector;
  };
  _count: {
    bids: number;
    participants: number;
  };
}

interface RankedListingBid {
  bidId: string;
  listingId: string;
  company: {
    id: string;
    name: string;
    city: string | null;
    rating: number;
    approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
    membershipType: "TRIAL" | "PLUS";
  };
  price: number;
  deliveryDay: number | null;
  note: string | null;
  score: number;
  rank: number;
  isTop3: boolean;
}

interface ListingBidBoard {
  listing: {
    id: string;
    title: string;
    description: string;
    listingType: "SERVICE" | "PRODUCT";
    city: string;
    status: "OPEN" | "CLOSED" | "CANCELED";
    createdAt: string;
    expiresAt: string | null;
    sector: Sector;
    metrics: {
      bids: number;
      matchedCompanies: number;
    };
  };
  top3: RankedListingBid[];
  items: RankedListingBid[];
}

interface RankedTenderBid {
  tenderBidId: string;
  tenderId: string;
  company: {
    id: string;
    name: string;
    city: string | null;
    rating: number;
    approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
    membershipType: "TRIAL" | "PLUS";
  };
  price: number;
  deliveryDay: number | null;
  note: string | null;
  status: "ACTIVE" | "WON" | "LOST" | "WITHDRAWN";
  score: number;
  rank: number;
  isTop3: boolean;
}

interface TenderBoard {
  tender: {
    id: string;
    status: "DRAFT" | "OPEN" | "CLOSED" | "CANCELED";
    startsAt: string;
    endsAt: string;
    listing: {
      id: string;
      title: string;
      sector: Sector;
    };
    metrics: {
      bids: number;
      participants: number;
    };
  };
  participants: Array<{
    id: string;
    status: "JOINED" | "WITHDRAWN";
    joinedAt: string;
    company: {
      id: string;
      name: string;
      city: string | null;
      rating: number;
      approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
      membershipType: "TRIAL" | "PLUS";
    };
    hasBid: boolean;
    bidStatus: "ACTIVE" | "WON" | "LOST" | "WITHDRAWN" | null;
  }>;
  winner: {
    tenderBidId: string;
    company: {
      id: string;
      name: string;
      city: string | null;
      rating: number;
      approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
      membershipType: "TRIAL" | "PLUS";
    };
    price: number;
    deliveryDay: number | null;
  } | null;
  top3: RankedTenderBid[];
  items: RankedTenderBid[];
}

type CustomerDashboardView = "overview" | "quick-create" | "listings" | "bid-inbox" | "tenders" | "settings" | "support";

interface CustomerSettingsDraft {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  emailUpdates: boolean;
  smsUpdates: boolean;
}

const CUSTOMER_SETTINGS_KEY = "uc_teklif_customer_settings";

interface CustomerDashboardMenuItem {
  id: CustomerDashboardView;
  title: string;
  subtitle: string;
  value: string;
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

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(numericValue)) {
    return "-";
  }

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  }).format(numericValue);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("tr-TR");
}

function getTenderStatusLabel(status: Tender["status"]): string {
  if (status === "OPEN") return "Açık";
  if (status === "CLOSED") return "Kapandı";
  if (status === "CANCELED") return "İptal";
  return "Taslak";
}

function getMembershipLabel(type: "TRIAL" | "PLUS"): string {
  return type === "TRIAL" ? "Deneme" : "Plus";
}

function getTenderBidStatusLabel(status: "ACTIVE" | "WON" | "LOST" | "WITHDRAWN"): string {
  if (status === "WON") return "Kazandı";
  if (status === "LOST") return "Kaybetti";
  if (status === "WITHDRAWN") return "Geri Çekildi";
  return "Aktif";
}

function getSupportStatusLabel(status: SupportMessageItem["status"]): string {
  if (status === "IN_PROGRESS") return "İşlemde";
  if (status === "RESOLVED") return "Çözüldü";
  if (status === "ARCHIVED") return "Arşiv";
  return "Yeni";
}

function toDateTimeLocalValue(isoValue: string): string {
  const date = new Date(isoValue);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return offsetDate.toISOString().slice(0, 16);
}

function readCustomerSettingsDraft(): CustomerSettingsDraft | null {
  const raw = localStorage.getItem(CUSTOMER_SETTINGS_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CustomerSettingsDraft;
    if (!parsed.email || !parsed.fullName) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function CustomerDashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [listingBidBoards, setListingBidBoards] = useState<Record<string, ListingBidBoard>>({});
  const [tenderBoards, setTenderBoards] = useState<Record<string, TenderBoard>>({});

  const [activeView, setActiveView] = useState<CustomerDashboardView>("overview");
  const [selectedListingId, setSelectedListingId] = useState("");
  const [selectedTenderId, setSelectedTenderId] = useState("");
  const [isBidBoardLoading, setIsBidBoardLoading] = useState(false);
  const [isTenderBoardLoading, setIsTenderBoardLoading] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [supportMessages, setSupportMessages] = useState<SupportMessageItem[]>([]);
  const [supportForm, setSupportForm] = useState({
    subject: "",
    message: "",
    phone: ""
  });

  const [listingForm, setListingForm] = useState({
    title: "",
    description: "",
    listingType: "SERVICE" as "SERVICE" | "PRODUCT",
    sectorId: "",
    city: "",
    budgetMin: "",
    budgetMax: "",
    expiresAt: ""
  });

  const [tenderForm, setTenderForm] = useState({
    listingId: "",
    startsAt: "",
    endsAt: ""
  });
  const [tenderUpdateForm, setTenderUpdateForm] = useState({
    startsAt: "",
    endsAt: ""
  });
  const [tenderCreateMode, setTenderCreateMode] = useState<"new" | "from-listing">("new");
  const [newTenderForm, setNewTenderForm] = useState({
    title: "",
    description: "",
    listingType: "SERVICE" as "SERVICE" | "PRODUCT",
    sectorId: "",
    city: "",
    budgetMin: "",
    budgetMax: "",
    startsAt: "",
    endsAt: ""
  });
  const [settingsForm, setSettingsForm] = useState<CustomerSettingsDraft>({
    fullName: user?.customer?.fullName ?? "",
    email: user?.email ?? "",
    phone: "",
    city: user?.customer?.city ?? "",
    emailUpdates: true,
    smsUpdates: false
  });
  const [settingsNotice, setSettingsNotice] = useState("");

  const selectedListing = useMemo(
    () => listings.find((item) => item.id === selectedListingId) ?? null,
    [listings, selectedListingId]
  );

  const selectedListingBoard = selectedListingId ? listingBidBoards[selectedListingId] : undefined;
  const highlightedTopBids = selectedListingBoard?.top3 ?? [];
  const rankedBids = selectedListingBoard?.items ?? [];
  const selectedTender = useMemo(() => tenders.find((item) => item.id === selectedTenderId) ?? null, [tenders, selectedTenderId]);
  const selectedTenderBoard = selectedTenderId ? tenderBoards[selectedTenderId] : undefined;

  const openListingCount = useMemo(
    () => listings.filter((item) => item.status === "OPEN").length,
    [listings]
  );
  const totalReceivedBidCount = useMemo(
    () => listings.reduce((total, item) => total + item._count.bids, 0),
    [listings]
  );
  const openTenderCount = useMemo(
    () => tenders.filter((item) => item.status === "OPEN").length,
    [tenders]
  );
  const openSupportMessageCount = useMemo(
    () => supportMessages.filter((item) => item.status === "NEW" || item.status === "IN_PROGRESS").length,
    [supportMessages]
  );
  const tenderEligibleListings = useMemo(() => {
    const listingIdsWithTender = new Set(tenders.map((item) => item.listing.id));
    return listings.filter((listing) => !listingIdsWithTender.has(listing.id));
  }, [listings, tenders]);

  const dashboardMenuItems = useMemo<CustomerDashboardMenuItem[]>(
    () => [
      { id: "overview", title: "Genel Bakış", subtitle: "Panel özeti", value: `${openListingCount} aktif ilan` },
      {
        id: "quick-create",
        title: "Hızlı İlan",
        subtitle: "3 adımda yayınla",
        value: `${sectors.length} kategori`
      },
      {
        id: "listings",
        title: "İlan Yönetimi",
        subtitle: "İlan detay ve teklif",
        value: `${listings.length} ilan`
      },
      {
        id: "bid-inbox",
        title: "Teklif Kutusu",
        subtitle: "Tüm gelen teklifler",
        value: `${rankedBids.length} teklif`
      },
      {
        id: "tenders",
        title: "İhale Yönetimi",
        subtitle: "İhaleye dönüştür",
        value: `${tenders.length} ihale`
      },
      {
        id: "settings",
        title: "Ayarlar",
        subtitle: "Hesap ve bildirim",
        value: settingsForm.city.trim() || "Profil"
      },
      {
        id: "support",
        title: "Destek",
        subtitle: "Sistem sahibine yaz",
        value: `${openSupportMessageCount} açık`
      }
    ],
    [
      openListingCount,
      sectors.length,
      listings.length,
      rankedBids.length,
      tenders.length,
      settingsForm.city,
      openSupportMessageCount
    ]
  );

  const activeMenuItem = useMemo(
    () => dashboardMenuItems.find((item) => item.id === activeView),
    [activeView, dashboardMenuItems]
  );

  const budgetMinValue = listingForm.budgetMin ? Number(listingForm.budgetMin) : null;
  const budgetMaxValue = listingForm.budgetMax ? Number(listingForm.budgetMax) : null;
  const hasInvalidBudgetRange =
    budgetMinValue !== null &&
    budgetMaxValue !== null &&
    Number.isFinite(budgetMinValue) &&
    Number.isFinite(budgetMaxValue) &&
    budgetMinValue > budgetMaxValue;
  const listingDescriptionLength = listingForm.description.trim().length;
  const selectedSectorName = useMemo(
    () => sectors.find((item) => item.id === listingForm.sectorId)?.name ?? "Seçilmedi",
    [listingForm.sectorId, sectors]
  );
  const isListingBasicsReady =
    listingForm.title.trim().length >= 3 && listingForm.city.trim().length >= 2 && listingDescriptionLength >= 10;
  const isCategoryReady = Boolean(listingForm.sectorId);
  const isListingReady =
    isListingBasicsReady &&
    isCategoryReady &&
    !hasInvalidBudgetRange;
  const budgetSummaryLabel = useMemo(() => {
    if (budgetMinValue === null && budgetMaxValue === null) {
      return "Esnek";
    }
    if (budgetMinValue !== null && budgetMaxValue !== null) {
      return `${formatCurrency(budgetMinValue)} - ${formatCurrency(budgetMaxValue)}`;
    }
    if (budgetMinValue !== null) {
      return `${formatCurrency(budgetMinValue)}+`;
    }
    return `${formatCurrency(budgetMaxValue)} altı`;
  }, [budgetMaxValue, budgetMinValue]);
  const newTenderBudgetMinValue = newTenderForm.budgetMin ? Number(newTenderForm.budgetMin) : null;
  const newTenderBudgetMaxValue = newTenderForm.budgetMax ? Number(newTenderForm.budgetMax) : null;
  const selectedNewTenderSectorName = useMemo(
    () => sectors.find((item) => item.id === newTenderForm.sectorId)?.name ?? "Seçilmedi",
    [newTenderForm.sectorId, sectors]
  );
  const newTenderBudgetSummary = useMemo(() => {
    if (newTenderBudgetMinValue === null && newTenderBudgetMaxValue === null) {
      return "Esnek";
    }
    if (newTenderBudgetMinValue !== null && newTenderBudgetMaxValue !== null) {
      return `${formatCurrency(newTenderBudgetMinValue)} - ${formatCurrency(newTenderBudgetMaxValue)}`;
    }
    if (newTenderBudgetMinValue !== null) {
      return `${formatCurrency(newTenderBudgetMinValue)}+`;
    }
    return `${formatCurrency(newTenderBudgetMaxValue)} altı`;
  }, [newTenderBudgetMaxValue, newTenderBudgetMinValue]);
  const hasInvalidNewTenderBudgetRange =
    newTenderBudgetMinValue !== null &&
    newTenderBudgetMaxValue !== null &&
    Number.isFinite(newTenderBudgetMinValue) &&
    Number.isFinite(newTenderBudgetMaxValue) &&
    newTenderBudgetMinValue > newTenderBudgetMaxValue;
  const newTenderDescriptionLength = newTenderForm.description.trim().length;
  const isNewTenderScheduleValid = useMemo(() => {
    if (!newTenderForm.startsAt || !newTenderForm.endsAt) {
      return false;
    }

    const startsAtDate = new Date(newTenderForm.startsAt);
    const endsAtDate = new Date(newTenderForm.endsAt);
    if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
      return false;
    }

    return endsAtDate > startsAtDate;
  }, [newTenderForm.endsAt, newTenderForm.startsAt]);
  const isNewTenderReady =
    newTenderForm.title.trim().length >= 3 &&
    newTenderDescriptionLength >= 10 &&
    newTenderForm.city.trim().length >= 2 &&
    Boolean(newTenderForm.sectorId) &&
    isNewTenderScheduleValid &&
    !hasInvalidNewTenderBudgetRange;

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) {
        return;
      }

      if (!options?.silent) {
        setError("");
      }

      try {
        const [sectorsResponse, listingsResponse, tendersResponse, supportMessagesResponse] = await Promise.all([
          apiRequest<{ items: Sector[] }>("/api/sectors", { token }),
          apiRequest<{ items: Listing[] }>("/api/customer/listings", { token }),
          apiRequest<{ items: Tender[] }>("/api/customer/tenders", { token }),
          apiRequest<{ items: SupportMessageItem[] }>("/api/customer/support-messages", { token })
        ]);

        setSectors(sectorsResponse.items);
        setListings(listingsResponse.items);
        setTenders(tendersResponse.items);
        setSupportMessages(supportMessagesResponse.items);
        const listingIdsWithTender = new Set(tendersResponse.items.map((item) => item.listing.id));
        const tenderEligibleListings = listingsResponse.items.filter((item) => !listingIdsWithTender.has(item.id));

        setListingForm((prev) => {
          const hasSelectedSector = sectorsResponse.items.some((item) => item.id === prev.sectorId);
          if (hasSelectedSector) {
            return prev;
          }
          return {
            ...prev,
            sectorId: sectorsResponse.items[0]?.id ?? ""
          };
        });
        setNewTenderForm((prev) => {
          const hasSelectedSector = sectorsResponse.items.some((item) => item.id === prev.sectorId);
          if (hasSelectedSector) {
            return prev;
          }
          return {
            ...prev,
            sectorId: sectorsResponse.items[0]?.id ?? ""
          };
        });

        setTenderForm((prev) => {
          const hasSelectedListing = tenderEligibleListings.some((item) => item.id === prev.listingId);
          if (hasSelectedListing) {
            return prev;
          }
          return {
            ...prev,
            listingId: tenderEligibleListings[0]?.id ?? ""
          };
        });

        setSelectedListingId((prev) => {
          const hasSelectedListing = listingsResponse.items.some((item) => item.id === prev);
          if (hasSelectedListing) {
            return prev;
          }
          return listingsResponse.items[0]?.id ?? "";
        });

        setSelectedTenderId((prev) => {
          const hasSelectedTender = tendersResponse.items.some((item) => item.id === prev);
          if (hasSelectedTender) {
            return prev;
          }
          return tendersResponse.items[0]?.id ?? "";
        });

        setLastSyncAt(new Date());
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : "Müşteri panel verileri yüklenemedi.");
        }
      }
    },
    [token]
  );

  const loadListingBidBoard = useCallback(
    async (listingId: string, options?: { silent?: boolean }) => {
      if (!token || !listingId) {
        return;
      }

      if (!options?.silent) {
        setIsBidBoardLoading(true);
        setError("");
      }

      try {
        const response = await apiRequest<{ item: ListingBidBoard }>(`/api/customer/listings/${listingId}/bids`, {
          token
        });
        setListingBidBoards((prev) => ({ ...prev, [listingId]: response.item }));
        setLastSyncAt(new Date());
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : "İlan teklif detayları alınamadı.");
        }
      } finally {
        if (!options?.silent) {
          setIsBidBoardLoading(false);
        }
      }
    },
    [token]
  );

  const loadTenderBoard = useCallback(
    async (tenderId: string, options?: { silent?: boolean }) => {
      if (!token || !tenderId) {
        return;
      }

      if (!options?.silent) {
        setIsTenderBoardLoading(true);
        setError("");
      }

      try {
        const response = await apiRequest<{ item: TenderBoard }>(`/api/customer/tenders/${tenderId}/bids`, { token });
        setTenderBoards((prev) => ({ ...prev, [tenderId]: response.item }));
        setTenderUpdateForm({
          startsAt: toDateTimeLocalValue(response.item.tender.startsAt),
          endsAt: toDateTimeLocalValue(response.item.tender.endsAt)
        });
        setLastSyncAt(new Date());
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : "İhale detayları alınamadı.");
        }
      } finally {
        if (!options?.silent) {
          setIsTenderBoardLoading(false);
        }
      }
    },
    [token]
  );

  useEffect(() => {
    loadData().catch(() => {
      setError("Müşteri panel verileri yüklenemedi.");
    });
  }, [loadData]);

  useEffect(() => {
    if (!selectedListingId) {
      return;
    }

    if (listingBidBoards[selectedListingId]) {
      return;
    }

    loadListingBidBoard(selectedListingId).catch(() => {
      setError("İlan teklif detayları alınamadı.");
    });
  }, [listingBidBoards, loadListingBidBoard, selectedListingId]);

  useEffect(() => {
    if (!selectedTenderId) {
      return;
    }

    if (tenderBoards[selectedTenderId]) {
      return;
    }

    loadTenderBoard(selectedTenderId).catch(() => {
      setError("İhale detayları alınamadı.");
    });
  }, [loadTenderBoard, selectedTenderId, tenderBoards]);

  useEffect(() => {
    if (!selectedTenderId) {
      return;
    }

    const board = tenderBoards[selectedTenderId];
    if (!board) {
      return;
    }

    setTenderUpdateForm({
      startsAt: toDateTimeLocalValue(board.tender.startsAt),
      endsAt: toDateTimeLocalValue(board.tender.endsAt)
    });
  }, [selectedTenderId, tenderBoards]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadData({ silent: true }).catch(() => undefined);
      if (selectedListingId) {
        loadListingBidBoard(selectedListingId, { silent: true }).catch(() => undefined);
      }
      if (selectedTenderId) {
        loadTenderBoard(selectedTenderId, { silent: true }).catch(() => undefined);
      }
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadData, loadListingBidBoard, loadTenderBoard, selectedListingId, selectedTenderId, token]);

  useEffect(() => {
    const draft = readCustomerSettingsDraft();
    if (draft) {
      setSettingsForm(draft);
      return;
    }

    setSettingsForm({
      fullName: user?.customer?.fullName ?? "",
      email: user?.email ?? "",
      phone: "",
      city: user?.customer?.city ?? "",
      emailUpdates: true,
      smsUpdates: false
    });
  }, [user?.customer?.city, user?.customer?.fullName, user?.email]);

  const handleCreateListing = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    setError("");
    setNotice("");

    const title = listingForm.title.trim();
    const description = listingForm.description.trim();
    const city = listingForm.city.trim();
    const budgetMin = listingForm.budgetMin ? Number(listingForm.budgetMin) : undefined;
    const budgetMax = listingForm.budgetMax ? Number(listingForm.budgetMax) : undefined;

    if (title.length < 3) {
      setError("İlan başlığı en az 3 karakter olmalıdır.");
      return;
    }

    if (description.length < 10) {
      setError("İlan açıklaması en az 10 karakter olmalıdır.");
      return;
    }

    if (city.length < 2) {
      setError("Şehir bilgisi en az 2 karakter olmalıdır.");
      return;
    }

    if (!listingForm.sectorId) {
      setError("Kategori seçimi zorunludur.");
      return;
    }

    if (budgetMin !== undefined && (!Number.isFinite(budgetMin) || budgetMin <= 0)) {
      setError("Minimum bütçe pozitif bir sayı olmalıdır.");
      return;
    }

    if (budgetMax !== undefined && (!Number.isFinite(budgetMax) || budgetMax <= 0)) {
      setError("Maksimum bütçe pozitif bir sayı olmalıdır.");
      return;
    }

    if (budgetMin !== undefined && budgetMax !== undefined && budgetMin > budgetMax) {
      setError("Minimum bütçe, maksimum bütçeden büyük olamaz.");
      return;
    }

    if (listingForm.expiresAt) {
      const expiresAtDate = new Date(listingForm.expiresAt);
      if (Number.isNaN(expiresAtDate.getTime())) {
        setError("Son teklif tarihi geçerli bir tarih olmalıdır.");
        return;
      }
    }

    try {
      const response = await apiRequest<{ message: string; matchedCompanyCount: number; listing: { id: string } }>(
        "/api/customer/listings",
        {
          method: "POST",
          token,
          body: {
            title,
            description,
            listingType: listingForm.listingType,
            sectorId: listingForm.sectorId,
            city,
            budgetMin,
            budgetMax,
            expiresAt: listingForm.expiresAt ? new Date(listingForm.expiresAt).toISOString() : undefined
          }
        }
      );

      setListingForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        city: "",
        budgetMin: "",
        budgetMax: "",
        expiresAt: ""
      }));

      setNotice(`İlan yayınlandı. ${response.matchedCompanyCount} uygun firmaya otomatik dağıtıldı.`);
      setActiveView("listings");

      await loadData();
      setSelectedListingId(response.listing.id);
      await loadListingBidBoard(response.listing.id, { silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "İlan oluşturulamadı.");
    }
  };

  const handleCreateTenderFromListing = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    setError("");
    setNotice("");

    if (!tenderForm.listingId) {
      setError("İhale için önce bir ilan seçin.");
      return;
    }

    const startsAtDate = new Date(tenderForm.startsAt);
    const endsAtDate = new Date(tenderForm.endsAt);
    if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
      setError("İhale tarihleri geçerli olmalıdır.");
      return;
    }
    if (endsAtDate <= startsAtDate) {
      setError("İhale bitiş tarihi başlangıç tarihinden sonra olmalıdır.");
      return;
    }

    try {
      const response = await apiRequest<{ message: string; item: { id: string } }>("/api/customer/tenders", {
        method: "POST",
        token,
        body: {
          listingId: tenderForm.listingId,
          startsAt: startsAtDate.toISOString(),
          endsAt: endsAtDate.toISOString()
        }
      });

      setTenderForm((prev) => ({
        ...prev,
        startsAt: "",
        endsAt: ""
      }));

      setNotice("İlan ihaleye dönüştürüldü. Tedarikçiler ihale ekranından teklif verebilir.");
      setActiveView("tenders");
      await loadData();
      setSelectedTenderId(response.item.id);
      await loadTenderBoard(response.item.id, { silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "İhale oluşturulamadı.");
    }
  };

  const handleCreateNewTender = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    setError("");
    setNotice("");

    const title = newTenderForm.title.trim();
    const description = newTenderForm.description.trim();
    const city = newTenderForm.city.trim();
    const budgetMin = newTenderForm.budgetMin ? Number(newTenderForm.budgetMin) : undefined;
    const budgetMax = newTenderForm.budgetMax ? Number(newTenderForm.budgetMax) : undefined;
    const startsAtDate = new Date(newTenderForm.startsAt);
    const endsAtDate = new Date(newTenderForm.endsAt);

    if (title.length < 3) {
      setError("İhale başlığı en az 3 karakter olmalıdır.");
      return;
    }
    if (description.length < 10) {
      setError("İhale açıklaması en az 10 karakter olmalıdır.");
      return;
    }
    if (city.length < 2) {
      setError("Şehir bilgisi en az 2 karakter olmalıdır.");
      return;
    }
    if (!newTenderForm.sectorId) {
      setError("Kategori seçimi zorunludur.");
      return;
    }
    if (budgetMin !== undefined && (!Number.isFinite(budgetMin) || budgetMin <= 0)) {
      setError("Minimum bütçe pozitif bir sayı olmalıdır.");
      return;
    }
    if (budgetMax !== undefined && (!Number.isFinite(budgetMax) || budgetMax <= 0)) {
      setError("Maksimum bütçe pozitif bir sayı olmalıdır.");
      return;
    }
    if (budgetMin !== undefined && budgetMax !== undefined && budgetMin > budgetMax) {
      setError("Minimum bütçe, maksimum bütçeden büyük olamaz.");
      return;
    }
    if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
      setError("İhale tarihleri geçerli olmalıdır.");
      return;
    }
    if (endsAtDate <= startsAtDate) {
      setError("İhale bitiş tarihi başlangıç tarihinden sonra olmalıdır.");
      return;
    }

    try {
      const listingResponse = await apiRequest<{ message: string; matchedCompanyCount: number; listing: { id: string } }>(
        "/api/customer/listings",
        {
          method: "POST",
          token,
          body: {
            title,
            description,
            listingType: newTenderForm.listingType,
            sectorId: newTenderForm.sectorId,
            city,
            budgetMin,
            budgetMax,
            expiresAt: endsAtDate.toISOString()
          }
        }
      );

      const tenderResponse = await apiRequest<{ message: string; item: { id: string } }>("/api/customer/tenders", {
        method: "POST",
        token,
        body: {
          listingId: listingResponse.listing.id,
          startsAt: startsAtDate.toISOString(),
          endsAt: endsAtDate.toISOString()
        }
      });

      setNewTenderForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        city: "",
        budgetMin: "",
        budgetMax: "",
        startsAt: "",
        endsAt: ""
      }));

      setNotice(
        `Yeni ihale açıldı. ${listingResponse.matchedCompanyCount} uygun firmaya dağıtım yapıldı.`
      );
      setActiveView("tenders");
      await loadData();
      setSelectedListingId(listingResponse.listing.id);
      setSelectedTenderId(tenderResponse.item.id);
      await loadTenderBoard(tenderResponse.item.id, { silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yeni ihale oluşturulamadı.");
    }
  };

  const handleSelectListing = (listingId: string) => {
    setSelectedListingId(listingId);
    setActiveView("bid-inbox");
    loadListingBidBoard(listingId).catch(() => {
      setError("İlan teklif detayları alınamadı.");
    });
  };

  const handleSelectTender = (tenderId: string) => {
    setSelectedTenderId(tenderId);
    setActiveView("tenders");
    loadTenderBoard(tenderId).catch(() => {
      setError("İhale detayları alınamadı.");
    });
  };

  const handleTenderScheduleUpdate = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !selectedTenderId) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await apiRequest<{ message: string }>(`/api/customer/tenders/${selectedTenderId}`, {
        method: "PATCH",
        token,
        body: {
          startsAt: new Date(tenderUpdateForm.startsAt).toISOString(),
          endsAt: new Date(tenderUpdateForm.endsAt).toISOString()
        }
      });

      setNotice("İhale takvimi güncellendi.");
      await loadData();
      await loadTenderBoard(selectedTenderId, { silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "İhale takvimi güncellenemedi.");
    }
  };

  const handleTenderStatusUpdate = async (status: "DRAFT" | "OPEN" | "CLOSED" | "CANCELED") => {
    if (!token || !selectedTenderId) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await apiRequest<{ message: string }>(`/api/customer/tenders/${selectedTenderId}`, {
        method: "PATCH",
        token,
        body: { status }
      });

      setNotice("İhale durumu güncellendi.");
      await loadData();
      await loadTenderBoard(selectedTenderId, { silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "İhale durumu güncellenemedi.");
    }
  };

  const handleAwardTender = async (tenderBidId: string) => {
    if (!token || !selectedTenderId) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await apiRequest<{ message: string }>(`/api/customer/tenders/${selectedTenderId}/award`, {
        method: "POST",
        token,
        body: { tenderBidId }
      });

      setNotice("Kazanan firma seçildi ve ihale kapatıldı.");
      await loadData();
      await loadTenderBoard(selectedTenderId, { silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kazanan seçilemedi.");
    }
  };

  const handleManualRefresh = async () => {
    setNotice("");
    await loadData();
    if (selectedListingId) {
      await loadListingBidBoard(selectedListingId, { silent: true });
    }
    if (selectedTenderId) {
      await loadTenderBoard(selectedTenderId, { silent: true });
    }
  };

  const handleSupportSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    setError("");
    setNotice("");

    const message = supportForm.message.trim();
    if (message.length < 8) {
      setError("Destek mesajı en az 8 karakter olmalıdır.");
      return;
    }

    try {
      await apiRequest<{ message: string }>("/api/customer/support-messages", {
        method: "POST",
        token,
        body: {
          subject: supportForm.subject.trim() || undefined,
          message,
          phone: supportForm.phone.trim() || undefined
        }
      });

      setSupportForm({
        subject: "",
        message: "",
        phone: ""
      });
      setNotice("Destek talebiniz sistem sahibine iletildi.");
      setActiveView("support");
      await loadData({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Destek talebi gönderilemedi.");
    }
  };

  const handleSaveSettings = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    localStorage.setItem(CUSTOMER_SETTINGS_KEY, JSON.stringify(settingsForm));
    setSettingsNotice("Ayarlar kaydedildi.");
  };

  const customerName = user?.customer?.fullName ?? user?.email ?? "Müşteri";
  const canOpenCompanyPanel = canAccessCompanyPanel(user);

  return (
    <div className="customer-dashboard-shell">
      <section className="customer-exec-hero">
        <div className="customer-exec-copy">
          <p className="customer-kicker">3teklif Customer Suite</p>
          <h1>Hızlı İlan Akışı ve Akıllı Teklif Karşılaştırma</h1>
          <p>
            İlanını birkaç dakikada yayınla, firmalardan gelen teklifleri canlı olarak tek ekranda izle ve en uygun 3
            teklifi üstte vurgulu şekilde değerlendir.
          </p>
          <div className="customer-badge-row">
            <span className="customer-badge">Hesap: {customerName}</span>
            <span className="customer-badge">Aktif ilan: {openListingCount}</span>
            <span className="customer-badge">Toplam teklif: {totalReceivedBidCount}</span>
            <span className="customer-badge is-live">Canlı senkron: Açık</span>
          </div>
          <div className="customer-exec-actions">
            <button className="solid-btn" type="button" onClick={() => setActiveView("quick-create")}>
              Hızlı İlan Aç
            </button>
            {canOpenCompanyPanel ? (
              <button
                className="ghost-btn"
                type="button"
                onClick={() => {
                  setPreferredPanel("company");
                  navigate("/dashboard/company");
                }}
              >
                Firma Paneline Geç
              </button>
            ) : null}
            <button className="ghost-btn" type="button" onClick={() => setActiveView("listings")}>
              İlan ve Teklif Detayı
            </button>
            <button className="ghost-btn" type="button" onClick={() => setActiveView("tenders")}>
              İhale Yönetimi
            </button>
            <button className="ghost-btn" type="button" onClick={() => setActiveView("settings")}>
              Ayarlar
            </button>
            <button className="ghost-btn" type="button" onClick={() => setActiveView("support")}>
              Destek
            </button>
            <button className="tiny-btn" type="button" onClick={() => handleManualRefresh().catch(() => undefined)}>
              Şimdi Yenile
            </button>
          </div>
          <p className="customer-sync-note">
            Son senkron: {lastSyncAt ? lastSyncAt.toLocaleTimeString("tr-TR") : "Henüz güncellenmedi"}
          </p>
        </div>

        <div className="customer-exec-metrics">
          <article className="customer-metric-card">
            <p>Aktif ilan</p>
            <strong>{openListingCount}</strong>
            <span>Yayındaki talep sayısı</span>
          </article>
          <article className="customer-metric-card">
            <p>Gelen teklif</p>
            <strong>{totalReceivedBidCount}</strong>
            <span>Tüm ilanlardan toplanan teklif</span>
          </article>
          <article className="customer-metric-card">
            <p>Öne çıkan 3</p>
            <strong>{highlightedTopBids.length}</strong>
            <span>Seçili ilanın en iyi teklifi</span>
          </article>
          <article className="customer-metric-card">
            <p>Açık ihale</p>
            <strong>{openTenderCount}</strong>
            <span>Teklif bekleyen ihale</span>
          </article>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}
      {notice ? <p className="customer-note-success">{notice}</p> : null}

      <section className="panel-card customer-dashboard-nav" aria-label="Müşteri dashboard menüsü">
        <div className="customer-dashboard-nav-head">
          <h2>Panel Menüsü</h2>
          <p>
            Aktif bölüm: <strong>{activeMenuItem?.title ?? "Genel Bakış"}</strong> - {activeMenuItem?.subtitle}
          </p>
        </div>
        <div className="customer-dashboard-nav-grid">
          {dashboardMenuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`customer-dashboard-nav-item ${activeView === item.id ? "is-active" : ""}`}
              onClick={() => setActiveView(item.id)}
            >
              <span>{item.title}</span>
              <small>{item.subtitle}</small>
              <strong>{item.value}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className={`customer-workbench-grid ${activeView !== "overview" ? "is-focused" : ""}`}>
        {(activeView === "overview" || activeView === "quick-create") && (
          <section className="panel-card customer-module customer-module-wide customer-create-module">
            <div className="customer-create-head">
              <div>
                <p className="customer-create-kicker">Hızlı İlan Akışı</p>
                <h3>Profesyonel İlan Formu</h3>
                <p className="customer-module-subtitle">
                  Minimum bilgiyle ilanı yayınla. Sistem ilanı seçtiğin kategoriye göre uygun firmalara otomatik
                  dağıtır.
                </p>
              </div>
              <aside className="customer-create-status-card">
                <span className={`status-badge ${isListingReady ? "status-success" : "status-neutral"}`}>
                  {isListingReady ? "Yayına Hazır" : "Eksik Alan Var"}
                </span>
                <strong>{isListingReady ? "Form tamamlandı" : "Formu tamamlayın"}</strong>
                <p>
                  Seçili kategori: <b>{selectedSectorName}</b>
                </p>
                <div className="customer-create-status-metrics">
                  <span>Açıklama: {listingDescriptionLength} karakter</span>
                  <span>{listingForm.city.trim() ? `Şehir: ${listingForm.city.trim()}` : "Şehir bilgisi bekleniyor"}</span>
                </div>
              </aside>
            </div>

            <div className="customer-create-layout">
              <aside className="customer-journey-panel" aria-label="İlan hazırlık adımları">
                <p className="customer-journey-title">Yayın Akışı</p>
                <ol className="customer-journey-list">
                  <li className={isListingBasicsReady ? "is-done" : ""}>
                    <span>01</span>
                    <div>
                      <strong>İhtiyacı Netleştir</strong>
                      <p>Başlık, açıklama ve şehir ile talebi netleştir.</p>
                    </div>
                  </li>
                  <li className={isCategoryReady ? "is-done" : ""}>
                    <span>02</span>
                    <div>
                      <strong>Kategoriyi Seç</strong>
                      <p>Adminin tanımladığı sektörden doğru hizmet alanını belirle.</p>
                    </div>
                  </li>
                  <li className={isListingReady ? "is-done" : ""}>
                    <span>03</span>
                    <div>
                      <strong>Yayınla ve Topla</strong>
                      <p>Yayın sonrası teklifleri tek ekranda toplayıp en iyi 3 öneriyi gör.</p>
                    </div>
                  </li>
                </ol>
                <div className="customer-journey-focus">
                  <p>Yayın sonrası otomatik süreç</p>
                  <ul>
                    <li>Uygun firmalara anlık eşleşme gider</li>
                    <li>Teklifler ilan detay kartında toplanır</li>
                    <li>En uygun 3 teklif üstte vurgulu görünür</li>
                  </ul>
                </div>
              </aside>

              <form className="form-grid customer-create-form" onSubmit={handleCreateListing}>
                <section className="customer-form-block">
                  <div className="customer-form-block-head">
                    <h4>Temel Bilgiler</h4>
                    <p>İlanın ne için açıldığını net anlat.</p>
                  </div>
                  <div className="auth-grid-two">
                    <label>
                      İlan Başlığı
                      <input
                        minLength={3}
                        value={listingForm.title}
                        onChange={(event) => setListingForm((prev) => ({ ...prev, title: event.target.value }))}
                        placeholder="Örn: Ofis için haftalık temizlik hizmeti"
                        required
                      />
                    </label>
                    <label>
                      Şehir
                      <input
                        minLength={2}
                        value={listingForm.city}
                        onChange={(event) => setListingForm((prev) => ({ ...prev, city: event.target.value }))}
                        placeholder="İstanbul"
                        required
                      />
                    </label>
                  </div>

                  <label>
                    İlan Açıklaması
                    <textarea
                      minLength={10}
                      value={listingForm.description}
                      onChange={(event) => setListingForm((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="İş kapsamını, beklentini ve önceliklerini yaz."
                      required
                    />
                  </label>
                </section>

                <section className="customer-form-block">
                  <div className="customer-form-block-head">
                    <h4>Kapsam</h4>
                    <p>Hizmet veya ürün tipini ve kategoriyi seç.</p>
                  </div>
                  <div className="auth-grid-two">
                    <label>
                      İlan Tipi
                      <select
                        value={listingForm.listingType}
                        onChange={(event) =>
                          setListingForm((prev) => ({
                            ...prev,
                            listingType: event.target.value as "SERVICE" | "PRODUCT"
                          }))
                        }
                      >
                        <option value="SERVICE">Hizmet</option>
                        <option value="PRODUCT">Ürün</option>
                      </select>
                    </label>
                    <label>
                      Kategori
                      <select
                        value={listingForm.sectorId}
                        onChange={(event) => setListingForm((prev) => ({ ...prev, sectorId: event.target.value }))}
                        required
                      >
                        <option value="">Kategori seçin</option>
                        {sectors.map((sector) => (
                          <option key={sector.id} value={sector.id}>
                            {sector.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="customer-form-block">
                  <div className="customer-form-block-head">
                    <h4>Bütçe ve Süre</h4>
                    <p>İstersen bütçe aralığı ve son teklif tarihini ekle.</p>
                  </div>
                  <div className="auth-grid-two">
                    <label>
                      Minimum Bütçe (TL)
                      <input
                        type="number"
                        min={1}
                        value={listingForm.budgetMin}
                        onChange={(event) => setListingForm((prev) => ({ ...prev, budgetMin: event.target.value }))}
                        placeholder="Opsiyonel"
                      />
                    </label>
                    <label>
                      Maksimum Bütçe (TL)
                      <input
                        type="number"
                        min={1}
                        value={listingForm.budgetMax}
                        onChange={(event) => setListingForm((prev) => ({ ...prev, budgetMax: event.target.value }))}
                        placeholder="Opsiyonel"
                      />
                    </label>
                  </div>
                  {hasInvalidBudgetRange ? (
                    <p className="error-text customer-budget-error">Minimum bütçe, maksimum bütçeden büyük olamaz.</p>
                  ) : null}

                  <label>
                    Son Teklif Tarihi
                    <input
                      type="datetime-local"
                      value={listingForm.expiresAt}
                      onChange={(event) => setListingForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                    />
                  </label>
                </section>

                <div className="customer-create-footer">
                  <div className="customer-create-summary">
                    <span>Tür: {listingForm.listingType === "SERVICE" ? "Hizmet" : "Ürün"}</span>
                    <span>Kategori: {selectedSectorName}</span>
                    <span>Bütçe: {budgetSummaryLabel}</span>
                  </div>
                  <button className="solid-btn customer-create-submit" type="submit" disabled={!isListingReady}>
                    İlanı Yayınla
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {activeView === "settings" ? (
          <section className="panel-card customer-module customer-module-wide customer-settings-module">
            <div className="customer-module-head">
              <div>
                <h3>Hesap Ayarları</h3>
                <p className="customer-module-subtitle">
                  Profil ve bildirim tercihlerini tek noktadan yönet.
                </p>
              </div>
              <span className="status-badge status-neutral">Müşteri Hesabı</span>
            </div>

            <div className="customer-settings-grid">
              <aside className="customer-settings-overview">
                <p className="customer-settings-kicker">Ayar Durumu</p>
                <strong>{settingsForm.fullName || customerName}</strong>
                <span>{settingsForm.email || user?.email || "-"}</span>
                <div className="customer-settings-list">
                  <p>Şehir: {settingsForm.city || "-"}</p>
                  <p>Telefon: {settingsForm.phone || "-"}</p>
                  <p>E-posta bildirimi: {settingsForm.emailUpdates ? "Açık" : "Kapalı"}</p>
                  <p>SMS bildirimi: {settingsForm.smsUpdates ? "Açık" : "Kapalı"}</p>
                </div>
              </aside>

              <form className="form-grid customer-settings-form" onSubmit={handleSaveSettings}>
                <div className="auth-grid-two">
                  <label>
                    Ad Soyad
                    <input
                      value={settingsForm.fullName}
                      onChange={(event) => {
                        setSettingsNotice("");
                        setSettingsForm((prev) => ({ ...prev, fullName: event.target.value }));
                      }}
                      placeholder="Ad Soyad"
                      required
                    />
                  </label>
                  <label>
                    E-posta
                    <input
                      type="email"
                      value={settingsForm.email}
                      onChange={(event) => {
                        setSettingsNotice("");
                        setSettingsForm((prev) => ({ ...prev, email: event.target.value }));
                      }}
                      placeholder="mail@ornek.com"
                      required
                    />
                  </label>
                </div>

                <div className="auth-grid-two">
                  <label>
                    Telefon
                    <input
                      value={settingsForm.phone}
                      onChange={(event) => {
                        setSettingsNotice("");
                        setSettingsForm((prev) => ({ ...prev, phone: event.target.value }));
                      }}
                      placeholder="+90 5xx xxx xx xx"
                    />
                  </label>
                  <label>
                    Şehir
                    <input
                      value={settingsForm.city}
                      onChange={(event) => {
                        setSettingsNotice("");
                        setSettingsForm((prev) => ({ ...prev, city: event.target.value }));
                      }}
                      placeholder="İstanbul"
                    />
                  </label>
                </div>

                <div className="customer-settings-checkboxes">
                  <label className="customer-settings-checkbox">
                    <input
                      type="checkbox"
                      checked={settingsForm.emailUpdates}
                      onChange={(event) => {
                        setSettingsNotice("");
                        setSettingsForm((prev) => ({ ...prev, emailUpdates: event.target.checked }));
                      }}
                    />
                    <span>E-posta bildirimlerini al</span>
                  </label>
                  <label className="customer-settings-checkbox">
                    <input
                      type="checkbox"
                      checked={settingsForm.smsUpdates}
                      onChange={(event) => {
                        setSettingsNotice("");
                        setSettingsForm((prev) => ({ ...prev, smsUpdates: event.target.checked }));
                      }}
                    />
                    <span>SMS bildirimlerini al</span>
                  </label>
                </div>

                <div className="customer-settings-actions">
                  <button className="solid-btn" type="submit">
                    Ayarları Kaydet
                  </button>
                  <button className="ghost-btn" type="button" onClick={() => setActiveView("overview")}>
                    Panele Dön
                  </button>
                </div>
                {settingsNotice ? <p className="customer-note-success">{settingsNotice}</p> : null}
              </form>
            </div>
          </section>
        ) : null}

        {activeView === "support" ? (
          <section className="panel-card customer-module customer-module-wide">
            <div className="customer-module-head">
              <div>
                <h3>Destek Merkezi</h3>
                <p className="customer-module-subtitle">
                  Teknik veya operasyonel bir konuda sistem sahibine doğrudan mesaj gönder.
                </p>
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
                    placeholder="Örn: İlan yayında görünmüyor"
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
                    placeholder="Sorununuzu detaylı yazın."
                    required
                  />
                </label>
                <div className="customer-settings-actions">
                  <button className="solid-btn" type="submit">
                    Destek Talebi Gönder
                  </button>
                </div>
              </form>

              <aside className="customer-settings-overview">
                <p className="customer-settings-kicker">Talep Geçmişi</p>
                {supportMessages.length > 0 ? (
                  <div className="customer-settings-list">
                    {supportMessages.slice(0, 6).map((item) => (
                      <p key={item.id}>
                        {getSupportStatusLabel(item.status)} - {item.subject || "Konu belirtilmedi"} ({formatDate(item.createdAt)})
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="customer-empty-note">Henüz destek talebin yok.</p>
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
                        <td>{formatDate(item.createdAt)}</td>
                        <td>{item.subject || "-"}</td>
                        <td>{item.message}</td>
                        <td>{getSupportStatusLabel(item.status)}</td>
                        <td>{item.handledByUser?.email || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="customer-empty-row" colSpan={5}>
                        Görüntülenecek destek kaydı yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {(activeView === "overview" || activeView === "listings") && (
          <section className="panel-card customer-module">
            <h3>İlanlarım</h3>
            <p className="customer-module-subtitle">İlanı seçerek gelen teklif detaylarını anında görüntüle.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Başlık</th>
                    <th>Sektör</th>
                    <th>Durum</th>
                    <th>Teklif</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.length > 0 ? (
                    listings.map((listing) => (
                      <tr key={listing.id}>
                        <td>{listing.title}</td>
                        <td>{listing.sector.name}</td>
                        <td>{listing.status}</td>
                        <td>{listing._count.bids}</td>
                        <td>
                          <button
                            className={`tiny-btn customer-select-btn ${selectedListingId === listing.id ? "is-active" : ""}`}
                            onClick={() => handleSelectListing(listing.id)}
                            type="button"
                          >
                            Detay
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="customer-empty-row" colSpan={5}>
                        Henüz ilan oluşturulmadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(activeView === "overview" || activeView === "listings" || activeView === "bid-inbox") && (
          <section className="panel-card customer-module customer-module-wide">
            <div className="customer-module-head">
              <div>
                <h3>İlan Teklif Detayı</h3>
                <p className="customer-module-subtitle">
                  Seçili ilan: <strong>{selectedListing?.title ?? "-"}</strong>
                </p>
              </div>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => {
                  if (selectedListingId) {
                    loadListingBidBoard(selectedListingId).catch(() => {
                      setError("İlan teklif detayları alınamadı.");
                    });
                  }
                }}
                disabled={!selectedListingId || isBidBoardLoading}
              >
                {isBidBoardLoading ? "Yenileniyor..." : "Teklifleri Yenile"}
              </button>
            </div>

            {selectedListing ? (
              <>
                <div className="customer-detail-meta">
                  <span>{selectedListing.sector.name}</span>
                  <span>{selectedListing.city}</span>
                  <span>{selectedListing.listingType === "SERVICE" ? "Hizmet" : "Ürün"}</span>
                  <span>Min: {formatCurrency(selectedListing.budgetMin)}</span>
                  <span>Max: {formatCurrency(selectedListing.budgetMax)}</span>
                  <span>Son tarih: {formatDate(selectedListing.expiresAt)}</span>
                </div>

                {highlightedTopBids.length > 0 ? (
                  <div className="customer-top3-grid">
                    {highlightedTopBids.map((item) => (
                      <article
                        key={item.bidId}
                        className={`customer-top3-card ${item.rank === 1 ? "is-best" : ""}`}
                      >
                        <span className="customer-top3-rank">#{item.rank}</span>
                        <strong>{item.company.name}</strong>
                        <p>{formatCurrency(item.price)}</p>
                        <div className="customer-top3-meta">
                          <span>Skor: {item.score}</span>
                          <span>Teslim: {item.deliveryDay ? `${item.deliveryDay} gün` : "Belirtilmedi"}</span>
                          <span>{item.company.city || "Şehir yok"}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="customer-empty-note">Bu ilana henüz aktif teklif gelmedi.</p>
                )}

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Sıra</th>
                        <th>Firma</th>
                        <th>Şehir</th>
                        <th>Fiyat</th>
                        <th>Teslim</th>
                        <th>Skor</th>
                        <th>Üyelik</th>
                        <th>Not</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedBids.length > 0 ? (
                        rankedBids.map((item) => (
                          <tr key={item.bidId}>
                            <td>{item.rank}</td>
                            <td>{item.company.name}</td>
                            <td>{item.company.city || "-"}</td>
                            <td>{formatCurrency(item.price)}</td>
                            <td>{item.deliveryDay ? `${item.deliveryDay} gün` : "-"}</td>
                            <td>{item.score}</td>
                            <td>{getMembershipLabel(item.company.membershipType)}</td>
                            <td>{item.note || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="customer-empty-row" colSpan={8}>
                            Henüz listelenecek teklif yok.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="customer-empty-note">Teklif detayını görüntülemek için bir ilan seçin.</p>
            )}
          </section>
        )}

        {(activeView === "overview" || activeView === "tenders") && (
          <section className="panel-card customer-module customer-module-wide customer-tender-create-module">
            <div className="customer-module-head">
              <div>
                <h3>Yeni İhale Aç</h3>
                <p className="customer-module-subtitle">
                  İstersen sıfırdan ihale başlat, istersen mevcut ilanı tek tıkla ihaleye dönüştür.
                </p>
              </div>
              <span className={`status-badge ${tenderCreateMode === "new" ? "status-success" : "status-neutral"}`}>
                {tenderCreateMode === "new" ? "Sıfırdan İhale Modu" : "Dönüştürme Modu"}
              </span>
            </div>

            <div className="customer-tender-mode-switch" role="tablist" aria-label="İhale oluşturma modu">
              <button
                className={`customer-tender-mode-btn ${tenderCreateMode === "new" ? "is-active" : ""}`}
                type="button"
                onClick={() => setTenderCreateMode("new")}
                aria-pressed={tenderCreateMode === "new"}
              >
                Sıfırdan İhale Aç
              </button>
              <button
                className={`customer-tender-mode-btn ${tenderCreateMode === "from-listing" ? "is-active" : ""}`}
                type="button"
                onClick={() => setTenderCreateMode("from-listing")}
                aria-pressed={tenderCreateMode === "from-listing"}
              >
                Mevcut İlanı Dönüştür
              </button>
            </div>

            {tenderCreateMode === "new" ? (
              <div className="customer-tender-create-layout">
                <aside className="customer-journey-panel" aria-label="Yeni ihale adımları">
                  <p className="customer-journey-title">Yeni İhale Akışı</p>
                  <ol className="customer-journey-list">
                    <li className={newTenderForm.title.trim().length >= 3 ? "is-done" : ""}>
                      <span>01</span>
                      <div>
                        <strong>İşin Kapsamını Tanımla</strong>
                        <p>Başlık, açıklama ve şehir bilgisiyle ihtiyacı netleştir.</p>
                      </div>
                    </li>
                    <li className={Boolean(newTenderForm.sectorId) ? "is-done" : ""}>
                      <span>02</span>
                      <div>
                        <strong>Kategori ve Bütçe Seç</strong>
                        <p>Uygun firmalara doğru dağıtım için kategori ve bütçe aralığını belirle.</p>
                      </div>
                    </li>
                    <li className={isNewTenderScheduleValid ? "is-done" : ""}>
                      <span>03</span>
                      <div>
                        <strong>Takvimle Yayına Al</strong>
                        <p>Başlangıç-bitiş takvimini gir, ihale anında teklif toplamaya başlasın.</p>
                      </div>
                    </li>
                  </ol>
                </aside>

                <form className="form-grid customer-create-form" onSubmit={handleCreateNewTender}>
                  <section className="customer-form-block">
                    <div className="customer-form-block-head">
                      <h4>İhale Temel Bilgileri</h4>
                      <p>İşi anlaşılır ve ölçülebilir şekilde yaz.</p>
                    </div>
                    <div className="auth-grid-two">
                      <label>
                        İhale Başlığı
                        <input
                          minLength={3}
                          value={newTenderForm.title}
                          onChange={(event) => setNewTenderForm((prev) => ({ ...prev, title: event.target.value }))}
                          placeholder="Örn: Fabrika için aylık baca temizliği ihalesi"
                          required
                        />
                      </label>
                      <label>
                        Şehir
                        <input
                          minLength={2}
                          value={newTenderForm.city}
                          onChange={(event) => setNewTenderForm((prev) => ({ ...prev, city: event.target.value }))}
                          placeholder="İstanbul"
                          required
                        />
                      </label>
                    </div>
                    <label>
                      İhale Açıklaması
                      <textarea
                        minLength={10}
                        value={newTenderForm.description}
                        onChange={(event) =>
                          setNewTenderForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        placeholder="Teknik kapsam, teslim beklentisi ve kalite kriterlerini yazın."
                        required
                      />
                    </label>
                  </section>

                  <section className="customer-form-block">
                    <div className="customer-form-block-head">
                      <h4>Kategori ve Bütçe</h4>
                      <p>İhalenin doğru firmalara düşmesi için kapsamını netleştir.</p>
                    </div>
                    <div className="auth-grid-two">
                      <label>
                        Talep Tipi
                        <select
                          value={newTenderForm.listingType}
                          onChange={(event) =>
                            setNewTenderForm((prev) => ({
                              ...prev,
                              listingType: event.target.value as "SERVICE" | "PRODUCT"
                            }))
                          }
                        >
                          <option value="SERVICE">Hizmet</option>
                          <option value="PRODUCT">Ürün</option>
                        </select>
                      </label>
                      <label>
                        Kategori
                        <select
                          value={newTenderForm.sectorId}
                          onChange={(event) =>
                            setNewTenderForm((prev) => ({ ...prev, sectorId: event.target.value }))
                          }
                          required
                        >
                          <option value="">Kategori seçin</option>
                          {sectors.map((sector) => (
                            <option key={sector.id} value={sector.id}>
                              {sector.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="auth-grid-two">
                      <label>
                        Minimum Bütçe (TL)
                        <input
                          type="number"
                          min={1}
                          value={newTenderForm.budgetMin}
                          onChange={(event) =>
                            setNewTenderForm((prev) => ({ ...prev, budgetMin: event.target.value }))
                          }
                          placeholder="Opsiyonel"
                        />
                      </label>
                      <label>
                        Maksimum Bütçe (TL)
                        <input
                          type="number"
                          min={1}
                          value={newTenderForm.budgetMax}
                          onChange={(event) =>
                            setNewTenderForm((prev) => ({ ...prev, budgetMax: event.target.value }))
                          }
                          placeholder="Opsiyonel"
                        />
                      </label>
                    </div>
                    {hasInvalidNewTenderBudgetRange ? (
                      <p className="error-text customer-budget-error">Minimum bütçe, maksimum bütçeden büyük olamaz.</p>
                    ) : null}
                  </section>

                  <section className="customer-form-block">
                    <div className="customer-form-block-head">
                      <h4>İhale Takvimi</h4>
                      <p>Teklif toplanacak zaman aralığını belirle.</p>
                    </div>
                    <div className="auth-grid-two">
                      <label>
                        Başlangıç
                        <input
                          type="datetime-local"
                          value={newTenderForm.startsAt}
                          onChange={(event) =>
                            setNewTenderForm((prev) => ({ ...prev, startsAt: event.target.value }))
                          }
                          required
                        />
                      </label>
                      <label>
                        Bitiş
                        <input
                          type="datetime-local"
                          value={newTenderForm.endsAt}
                          onChange={(event) =>
                            setNewTenderForm((prev) => ({ ...prev, endsAt: event.target.value }))
                          }
                          required
                        />
                      </label>
                    </div>
                    {!isNewTenderScheduleValid && newTenderForm.startsAt && newTenderForm.endsAt ? (
                      <p className="error-text customer-budget-error">
                        Bitiş tarihi başlangıç tarihinden sonra olmalıdır.
                      </p>
                    ) : null}
                  </section>

                  <div className="customer-create-footer">
                    <div className="customer-create-summary">
                      <span>Tip: {newTenderForm.listingType === "SERVICE" ? "Hizmet" : "Ürün"}</span>
                      <span>Kategori: {selectedNewTenderSectorName}</span>
                      <span>Bütçe: {newTenderBudgetSummary}</span>
                      <span>Açıklama: {newTenderDescriptionLength} karakter</span>
                    </div>
                    <button className="solid-btn customer-create-submit" type="submit" disabled={!isNewTenderReady}>
                      İhaleyi Sıfırdan Aç
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="customer-tender-convert-wrap">
                <p className="customer-tender-convert-note">
                  Zaten açılmış bir ilanın varsa, aşağıdaki hızlı akış ile doğrudan ihaleye dönüştürebilirsin.
                </p>
                <form className="form-grid customer-tender-convert-form" onSubmit={handleCreateTenderFromListing}>
                  <div className="auth-grid-two">
                    <label>
                      İlan
                      <select
                        value={tenderForm.listingId}
                        onChange={(event) => setTenderForm((prev) => ({ ...prev, listingId: event.target.value }))}
                        required
                        disabled={tenderEligibleListings.length === 0}
                      >
                        <option value="">İlan seçin</option>
                        {tenderEligibleListings.map((listing) => (
                          <option key={listing.id} value={listing.id}>
                            {listing.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="customer-tender-convert-tip" aria-hidden="true">
                      <strong>Hızlı Dönüştürme</strong>
                      <p>Seçili ilanın teklif toplama ekranı ihale yapısına anında taşınır.</p>
                    </div>
                  </div>
                  <div className="auth-grid-two">
                    <label>
                      Başlangıç
                      <input
                        type="datetime-local"
                        value={tenderForm.startsAt}
                        onChange={(event) => setTenderForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Bitiş
                      <input
                        type="datetime-local"
                        value={tenderForm.endsAt}
                        onChange={(event) => setTenderForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                        required
                      />
                    </label>
                  </div>
                  <div className="customer-settings-actions">
                    <button className="solid-btn" type="submit" disabled={tenderEligibleListings.length === 0}>
                      İlana Dayalı İhale Aç
                    </button>
                  </div>
                </form>
                {tenderEligibleListings.length === 0 ? (
                  <p className="customer-empty-note">İhaleye dönüştürülebilecek açık ilan bulunmuyor.</p>
                ) : null}
              </div>
            )}
          </section>
        )}

        {(activeView === "overview" || activeView === "tenders") && (
          <section className="panel-card customer-module customer-module-wide">
            <div className="customer-module-head">
              <div>
                <h3>İhale Yönetim Detayı</h3>
                <p className="customer-module-subtitle">
                  Seçili ihale: <strong>{selectedTenderBoard?.tender.listing.title ?? selectedTender?.listing.title ?? "-"}</strong>
                </p>
              </div>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => {
                  if (selectedTenderId) {
                    loadTenderBoard(selectedTenderId).catch(() => {
                      setError("İhale detayları alınamadı.");
                    });
                  }
                }}
                disabled={!selectedTenderId || isTenderBoardLoading}
              >
                {isTenderBoardLoading ? "Yenileniyor..." : "İhaleyi Yenile"}
              </button>
            </div>

            {selectedTenderBoard ? (
              <>
                <div className="customer-detail-meta">
                  <span>Durum: {getTenderStatusLabel(selectedTenderBoard.tender.status)}</span>
                  <span>Sektör: {selectedTenderBoard.tender.listing.sector.name}</span>
                  <span>Katılan Firma: {selectedTenderBoard.tender.metrics.participants}</span>
                  <span>Toplam Teklif: {selectedTenderBoard.tender.metrics.bids}</span>
                  <span>Başlangıç: {formatDate(selectedTenderBoard.tender.startsAt)}</span>
                  <span>Bitiş: {formatDate(selectedTenderBoard.tender.endsAt)}</span>
                </div>

                <div className="customer-tender-action-row">
                  <button className="tiny-btn" type="button" onClick={() => handleTenderStatusUpdate("OPEN").catch(() => undefined)}>
                    Açık Yap
                  </button>
                  <button className="tiny-btn" type="button" onClick={() => handleTenderStatusUpdate("DRAFT").catch(() => undefined)}>
                    Taslak Yap
                  </button>
                  <button className="tiny-btn" type="button" onClick={() => handleTenderStatusUpdate("CLOSED").catch(() => undefined)}>
                    Kapat
                  </button>
                  <button className="tiny-btn" type="button" onClick={() => handleTenderStatusUpdate("CANCELED").catch(() => undefined)}>
                    İptal Et
                  </button>
                </div>

                <form className="form-grid customer-tender-edit-form" onSubmit={handleTenderScheduleUpdate}>
                  <div className="auth-grid-two">
                    <label>
                      Başlangıç
                      <input
                        type="datetime-local"
                        value={tenderUpdateForm.startsAt}
                        onChange={(event) =>
                          setTenderUpdateForm((prev) => ({ ...prev, startsAt: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      Bitiş
                      <input
                        type="datetime-local"
                        value={tenderUpdateForm.endsAt}
                        onChange={(event) => setTenderUpdateForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                        required
                      />
                    </label>
                  </div>
                  <button className="ghost-btn" type="submit">
                    Takvimi Güncelle
                  </button>
                </form>

                {selectedTenderBoard.winner ? (
                  <div className="customer-tender-winner-banner">
                    Kazanan: <strong>{selectedTenderBoard.winner.company.name}</strong> -{" "}
                    {formatCurrency(selectedTenderBoard.winner.price)}
                  </div>
                ) : null}

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Firma</th>
                        <th>Katılım</th>
                        <th>Şehir</th>
                        <th>Üyelik</th>
                        <th>Teklif Durumu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTenderBoard.participants.length > 0 ? (
                        selectedTenderBoard.participants.map((participant) => (
                          <tr key={participant.id}>
                            <td>{participant.company.name}</td>
                            <td>{participant.status}</td>
                            <td>{participant.company.city || "-"}</td>
                            <td>{getMembershipLabel(participant.company.membershipType)}</td>
                            <td>{participant.bidStatus ? getTenderBidStatusLabel(participant.bidStatus) : "Teklif yok"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="customer-empty-row" colSpan={5}>
                            Bu ihaleye henüz firma katılımı yok.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedTenderBoard.top3.length > 0 ? (
                  <div className="customer-top3-grid">
                    {selectedTenderBoard.top3.map((item) => (
                      <article key={item.tenderBidId} className={`customer-top3-card ${item.rank === 1 ? "is-best" : ""}`}>
                        <span className="customer-top3-rank">#{item.rank}</span>
                        <strong>{item.company.name}</strong>
                        <p>{formatCurrency(item.price)}</p>
                        <div className="customer-top3-meta">
                          <span>Skor: {item.score}</span>
                          <span>{item.deliveryDay ? `${item.deliveryDay} gün` : "Teslim belirtilmedi"}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Sıra</th>
                        <th>Firma</th>
                        <th>Fiyat</th>
                        <th>Teslim</th>
                        <th>Skor</th>
                        <th>Durum</th>
                        <th>Not</th>
                        <th>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTenderBoard.items.length > 0 ? (
                        selectedTenderBoard.items.map((item) => (
                          <tr key={item.tenderBidId}>
                            <td>{item.rank}</td>
                            <td>{item.company.name}</td>
                            <td>{formatCurrency(item.price)}</td>
                            <td>{item.deliveryDay ? `${item.deliveryDay} gün` : "-"}</td>
                            <td>{item.score}</td>
                            <td>{getTenderBidStatusLabel(item.status)}</td>
                            <td>{item.note || "-"}</td>
                            <td>
                              <button
                                className="tiny-btn"
                                type="button"
                                disabled={selectedTenderBoard.tender.status === "CANCELED"}
                                onClick={() => handleAwardTender(item.tenderBidId).catch(() => undefined)}
                              >
                                Kazanan Seç
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="customer-empty-row" colSpan={8}>
                            Bu ihaleye henüz teklif gelmedi.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="customer-empty-note">Detay görmek için ihale tablosundan bir kayıt seçin.</p>
            )}
          </section>
        )}

        {(activeView === "overview" || activeView === "tenders") && (
          <section className="panel-card customer-module">
            <h3>İhale Takibi</h3>
            <p className="customer-module-subtitle">Açık, kapalı ve taslak ihaleleri tek tablodan takip et ve yönet.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>İlan</th>
                    <th>Sektör</th>
                    <th>Durum</th>
                    <th>Başlangıç</th>
                    <th>Bitiş</th>
                    <th>Katılım</th>
                    <th>Teklif</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {tenders.length > 0 ? (
                    tenders.map((tender) => (
                      <tr key={tender.id}>
                        <td>{tender.listing.title}</td>
                        <td>{tender.listing.sector.name}</td>
                        <td>{getTenderStatusLabel(tender.status)}</td>
                        <td>{formatDate(tender.startsAt)}</td>
                        <td>{formatDate(tender.endsAt)}</td>
                        <td>{tender._count.participants}</td>
                        <td>{tender._count.bids}</td>
                        <td>
                          <button
                            className={`tiny-btn customer-select-btn ${selectedTenderId === tender.id ? "is-active" : ""}`}
                            type="button"
                            onClick={() => handleSelectTender(tender.id)}
                          >
                            Yönet
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="customer-empty-row" colSpan={8}>
                        Henüz ihale kaydı yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}


