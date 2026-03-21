import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";

type RequestType = "SERVICE" | "PRODUCT";
type ComparePriority = "PRICE" | "SPEED" | "RATING";

type CompareSupplier = {
  id: string;
  columnTitle: string;
  company: string;
  city: string;
  rating: number;
  responseTime: string;
  deliveryDays: number;
  cashUnitPrice: number;
  cardTotalPrice: number | null;
  projectTotal: number;
  isVerified: boolean;
};

const formatTry = (value: number) =>
  `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} TL`;
const formatScore = (value: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

const comparisonSuppliers: CompareSupplier[] = [
  {
    id: "supplier-1",
    columnTitle: "Tedarikçi 1",
    company: "Ares Yapı",
    city: "İstanbul",
    rating: 4.7,
    responseTime: "43 dk",
    deliveryDays: 2,
    cashUnitPrice: 852,
    cardTotalPrice: 1752,
    projectTotal: 1704,
    isVerified: true
  },
  {
    id: "supplier-2",
    columnTitle: "Tedarikçi 2",
    company: "Marmara İnşaat",
    city: "Kocaeli",
    rating: 4.4,
    responseTime: "1 sa 20 dk",
    deliveryDays: 3,
    cashUnitPrice: 2400,
    cardTotalPrice: 4950,
    projectTotal: 4800,
    isVerified: true
  },
  {
    id: "supplier-3",
    columnTitle: "Tedarikçi 3",
    company: "Delta Lojistik",
    city: "Bursa",
    rating: 4.8,
    responseTime: "35 dk",
    deliveryDays: 1,
    cashUnitPrice: 780,
    cardTotalPrice: null,
    projectTotal: 1560,
    isVerified: true
  }
];

const categoryItems = [
  "Ambalaj Malzemeleri",
  "Baca Temizliği",
  "Boya ve Yapıştırıcılar",
  "Gıda",
  "Mobilya Hırdavat",
  "Yapı ve İnşaat Malzemeleri",
  "Lojistik ve Nakliye",
  "Taşımacılık ve Depolama",
  "Arıtma Sistemleri",
  "Mimarlık ve Proje"
];

const testimonialItems = [
  {
    name: "Mehmet Yılmaz",
    role: "İnşaat Firması Sahibi",
    comment: "Doğru firmaya hızlı ulaştık. Süreç şeffaf ve net ilerliyor."
  },
  {
    name: "Ayşe Demir",
    role: "Proje Yöneticisi",
    comment: "En iyi 3 teklifi tek ekranda görmek teklif süremizi yarıya indirdi."
  },
  {
    name: "Ali Kaya",
    role: "Lojistik Şirketi Müdürü",
    comment: "Belge doğrulama ve paket sistemi karar sürecimizi ciddi şekilde kolaylaştırdı."
  }
];

const referenceItems = ["Koçtaş Tedarik", "Marmara İnşaat", "Özkan Lojistik", "Delta Proje", "Atlas Yapı"];

const securityItems = ["SSL 256-bit", "KVKK Uyumlu", "Güvenli Ödeme", "Evrak Doğrulama"];

const processSteps = [
  {
    id: "01",
    title: "Talep Aç",
    description: "Hizmet veya ürün ihtiyacını birkaç adımda yayınla.",
    tag: "Hızlı Başlangıç",
    detail: "2 dakikada ilan oluştur"
  },
  {
    id: "02",
    title: "Teklif Topla",
    description: "Doğrulanmış firmalar aynı iş için rekabetçi teklif sunsun.",
    tag: "Rekabetçi Fiyat",
    detail: "Doğrulanmış firmalardan dönüş"
  },
  {
    id: "03",
    title: "Karşılaştır ve Seç",
    description: "Fiyat, teslim süresi ve firma puanına göre en iyi 3 seçeneği değerlendir.",
    tag: "Akıllı Karar",
    detail: "En iyi 3 teklif tek ekranda"
  }
];

const quickStats = [
  { label: "Doğrulanmış Firma", value: "2.400+" },
  { label: "Aylık Aktif Talep", value: "12.000+" },
  { label: "Ortalama Dönüş Süresi", value: "48 saat" }
];

const heroHighlights = ["KVKK uyumlu altyapı", "Doğrulanmış firma havuzu", "Akıllı teklif karşılaştırma"];

const heroLiveOffers = [
  { company: "Ares Yapı", price: "1.560 TL", eta: "2 gün", isBest: true },
  { company: "Marmara Tedarik", price: "1.704 TL", eta: "3 gün", isBest: false },
  { company: "Delta Lojistik", price: "1.890 TL", eta: "1 gün", isBest: false }
];

const faqItems = [
  {
    question: "Üyelik ücretsiz mi?",
    answer:
      "Evet. Trial paketi ile platformu 15 gün ücretsiz kullanabilirsin. Süreç boyunca talep açma, teklif toplama ve temel karşılaştırma ekranları aktif olur."
  },
  {
    question: "Açık taleplere nasıl teklif verebilirim?",
    answer:
      "Firma hesabını doğruladıktan sonra sektörüne uygun açık talepleri panelinde görürsün. Teklifini fiyat, teslim süresi ve not ekleyerek tek adımda gönderebilirsin."
  },
  {
    question: "Depo ve stok yönetimi yapabilir miyim?",
    answer:
      "Evet. Plus paket ile teklif süreçlerini stok takibi ve sipariş hareketleri ile aynı panelde izleyebilirsin. Böylece satın alma kararları daha hızlı alınır."
  },
  {
    question: "Bayi yönetimi mevcut mu?",
    answer:
      "Bayi ve alt kullanıcı yapısı Plus pakette desteklenir. Yetki bazlı kullanıcı tanımları ile ekiplerini ayrı rollerle yönetebilirsin."
  }
];

export function LandingPage() {
  const [selectedType, setSelectedType] = useState<RequestType>("SERVICE");
  const [compareMode, setCompareMode] = useState<"CASH" | "CARD">("CASH");
  const [comparePriority, setComparePriority] = useState<ComparePriority>("PRICE");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [siteContent, setSiteContent] = useState<Record<string, unknown>>({});
  const [supportForm, setSupportForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [supportNotice, setSupportNotice] = useState("");
  const [supportError, setSupportError] = useState("");
  const currentYear = new Date().getFullYear();

  const selectedText = useMemo(
    () =>
      selectedType === "SERVICE"
        ? {
            title: "Hizmet",
            subtitle: "Nitelikli firma arayanlar için hızlı ve güvenilir teklif deneyimi.",
            helper: "Bakım, montaj, lojistik ve proje ihtiyaçlarını 3teklif ile dakikalar içinde doğru firmalarla eşleştir."
          }
        : {
            title: "Ürün",
            subtitle: "Ürün alımları için nitelikli firmalardan rekabetçi teklifleri tek panelde topla.",
            helper: "Stok, teslim ve ödeme seçeneklerini aynı ekranda karşılaştırıp satın alma sürecini hızlandır."
          },
    [selectedType]
  );
  useEffect(() => {
    apiRequest<{ items: Array<{ key: string; value: unknown }> }>("/api/public/site-content")
      .then((response) => {
        const mapped = response.items.reduce<Record<string, unknown>>((acc, item) => {
          acc[item.key] = item.value;
          return acc;
        }, {});
        setSiteContent(mapped);
      })
      .catch(() => undefined);
  }, []);

  const cmsText = (key: string, fallback: string) => {
    const value = siteContent[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  };

  const handleSupportSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSupportError("");
    setSupportNotice("");
    try {
      await apiRequest<{ message: string }>("/api/public/support-messages", {
        method: "POST",
        body: {
          name: supportForm.name,
          email: supportForm.email,
          subject: supportForm.subject || undefined,
          message: supportForm.message
        }
      });
      setSupportNotice("Mesajınız alındı. En kısa sürede dönüş yapacağız.");
      setSupportForm({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      setSupportError(err instanceof Error ? err.message : "Mesaj gönderilemedi.");
    }
  };

  const supportEmail = cmsText("contact.email", "destek@3teklif.com");
  const supportPhone = cmsText("contact.phone", "+90 (212) 888 55 55");
  const supportPhoneHref = `tel:${supportPhone.replace(/[^+\d]/g, "")}`;

  const comparisonMetrics = useMemo(() => {
    const minCash = Math.min(...comparisonSuppliers.map((supplier) => supplier.cashUnitPrice));
    const minProject = Math.min(...comparisonSuppliers.map((supplier) => supplier.projectTotal));
    const minDelivery = Math.min(...comparisonSuppliers.map((supplier) => supplier.deliveryDays));
    const maxRating = Math.max(...comparisonSuppliers.map((supplier) => supplier.rating));
    const minRating = Math.min(...comparisonSuppliers.map((supplier) => supplier.rating));

    const cardCandidates = comparisonSuppliers.filter(
      (supplier): supplier is CompareSupplier & { cardTotalPrice: number } => supplier.cardTotalPrice !== null
    );
    const minCard = cardCandidates.length > 0 ? Math.min(...cardCandidates.map((supplier) => supplier.cardTotalPrice)) : null;

    const scenarioPriceById = comparisonSuppliers.reduce<Record<string, number>>((acc, supplier) => {
      const scenarioPrice =
        compareMode === "CASH"
          ? supplier.projectTotal
          : supplier.cardTotalPrice !== null
            ? supplier.cardTotalPrice
            : Math.round(supplier.projectTotal * 1.35);
      acc[supplier.id] = scenarioPrice;
      return acc;
    }, {});

    const scenarioPrices = Object.values(scenarioPriceById);
    const minScenarioPrice = Math.min(...scenarioPrices);
    const maxScenarioPrice = Math.max(...scenarioPrices);
    const maxDelivery = Math.max(...comparisonSuppliers.map((supplier) => supplier.deliveryDays));

    const weightMap: Record<ComparePriority, { price: number; speed: number; rating: number }> = {
      PRICE: { price: 0.6, speed: 0.2, rating: 0.2 },
      SPEED: { price: 0.25, speed: 0.55, rating: 0.2 },
      RATING: { price: 0.3, speed: 0.2, rating: 0.5 }
    };

    const scoreRows = comparisonSuppliers.map((supplier) => {
      const scenarioPrice = scenarioPriceById[supplier.id];
      const priceScore =
        maxScenarioPrice === minScenarioPrice ? 100 : ((maxScenarioPrice - scenarioPrice) / (maxScenarioPrice - minScenarioPrice)) * 100;
      const speedScore =
        maxDelivery === minDelivery ? 100 : ((maxDelivery - supplier.deliveryDays) / (maxDelivery - minDelivery)) * 100;
      const ratingScore =
        maxRating === minRating ? 100 : ((supplier.rating - minRating) / (maxRating - minRating)) * 100;

      const weights = weightMap[comparePriority];
      const totalScore = Math.round(priceScore * weights.price + speedScore * weights.speed + ratingScore * weights.rating);

      return {
        supplier,
        scenarioPrice,
        totalScore,
        priceScore: Math.round(priceScore),
        speedScore: Math.round(speedScore),
        ratingScore: Math.round(ratingScore)
      };
    });

    const ranking = [...scoreRows].sort((a, b) => b.totalScore - a.totalScore);
    const recommended = ranking[0].supplier;
    const maxScore = ranking[0].totalScore;
    const scoreById = ranking.reduce<Record<string, number>>((acc, row) => {
      acc[row.supplier.id] = row.totalScore;
      return acc;
    }, {});

    const priorityLabelMap: Record<ComparePriority, string> = {
      PRICE: "Fiyat Odaklı",
      SPEED: "Hız Odaklı",
      RATING: "Kalite/Puan Odaklı"
    };

    const recommendationReasonMap: Record<ComparePriority, string> = {
      PRICE: "Seçili senaryoda toplam maliyet avantajı sunuyor.",
      SPEED: "Teslim süresi ve dönüş hızı en güçlü kombinasyonda.",
      RATING: "Puan, güven ve toplam denge açısından öne çıkıyor."
    };

    return {
      minCash,
      minProject,
      minDelivery,
      maxRating,
      minCard,
      cardCandidatesCount: cardCandidates.length,
      recommended,
      ranking,
      maxScore,
      scoreById,
      scenarioPriceById,
      minScenarioPrice,
      priorityLabel: priorityLabelMap[comparePriority],
      recommendationReason: recommendationReasonMap[comparePriority]
    };
  }, [compareMode, comparePriority]);

  return (
    <div className="landing-home">
      <section className="landing-band hero-band">
        <div className="hero-orb hero-orb-left" aria-hidden="true" />
        <div className="hero-orb hero-orb-right" aria-hidden="true" />
        <div className="band-inner hero-layout">
          <div className="hero-copy">
            <p className="hero-brand">
              <span className="hero-brand-main">3teklif</span>
              <span className="hero-brand-dotcom">.com</span>
            </p>
            <p className="hero-pill">Güvenilir • Hızlı • Şeffaf</p>
            <h1>
              {cmsText("landing.hero.title", "Satın alma sürecini hızlandır,")}
              <span className="hero-headline-accent"> {cmsText("landing.hero.title.accent", "teklifleri tek ekranda karşılaştır.")}</span>
            </h1>
            <p className="hero-subtitle">{cmsText("landing.hero.subtitle", selectedText.subtitle)}</p>

            <p className="hero-helper">{cmsText("landing.hero.helper", selectedText.helper)}</p>

            <div className="hero-highlight-row">
              {heroHighlights.map((item) => (
                <span key={item} className="hero-highlight-chip">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <aside className="hero-aside">
            <div className="hero-focus-panel hero-focus-panel-priority">
              <p className="hero-focus-title">İhtiyacını seç ve hemen başla</p>

              <div className="choice-grid">
                <button
                  className={`choice-card ${selectedType === "SERVICE" ? "is-active" : ""}`}
                  onClick={() => setSelectedType("SERVICE")}
                  type="button"
                >
                  <h3>Hizmet</h3>
                  <p>İlan oluştur, uzman firmalardan hızlı hizmet teklifi al.</p>
                </button>
                <button
                  className={`choice-card ${selectedType === "PRODUCT" ? "is-active" : ""}`}
                  onClick={() => setSelectedType("PRODUCT")}
                  type="button"
                >
                  <h3>Ürün</h3>
                  <p>Ürün ihtiyacın için onaylı tedarikçilerden fiyat topla.</p>
                </button>
              </div>

              <div className="cta-row hero-cta-row">
                <Link className="solid-btn" to={`/register/customer?type=${selectedType}`}>
                  {selectedText.title} Teklifi Al
                </Link>
                <Link className="ghost-btn" to="/register/company">
                  {selectedText.title} Teklifi Ver
                </Link>
              </div>

              <p className="hero-inline-links">
                <a href="#nasil-calisir">Nasıl Çalışır?</a>
                <span>|</span>
                <a href="#paketler">Paketleri İncele</a>
              </p>
            </div>

            <article className="hero-live-card">
              <header>
                <p>Canlı Teklif Akışı</p>
                <strong>Son 2 Saat</strong>
              </header>
              <div className="hero-live-list">
                {heroLiveOffers.map((offer) => (
                  <article key={offer.company} className={`hero-live-item ${offer.isBest ? "is-best" : ""}`}>
                    <div>
                      <strong>{offer.company}</strong>
                      <p>Teslim: {offer.eta}</p>
                    </div>
                    <span>{offer.price}</span>
                  </article>
                ))}
              </div>
            </article>
            <div className="hero-stats-grid">
              {quickStats.map((stat) => (
                <article key={stat.label} className="metric-card">
                  <p>{stat.label}</p>
                  <strong>{stat.value}</strong>
                </article>
              ))}
            </div>
            <article className="metric-card metric-note">
              <p>Bugün öne çıkan kategori</p>
              <strong>Yapı Kimyasalları</strong>
              <span>142 aktif teklif talebi</span>
            </article>
          </aside>
        </div>
      </section>

      <section id="nasil-calisir" className="landing-band process-band">
        <div className="band-inner process-layout">
          <header className="section-head process-head">
            <p className="process-kicker">3 adımda teklif süreci</p>
            <h2>Nasıl Çalışır?</h2>
            <p>Talebini aç, teklifleri topla, en doğru firmayı güvenle seç.</p>
          </header>

          <div className="process-grid">
            {processSteps.map((step) => (
              <article key={step.id} className="process-card">
                <div className="process-top">
                  <span className="step-no">{step.id}</span>
                  <span className="process-tag">{step.tag}</span>
                </div>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
                <span className="process-detail">{step.detail}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-band compare-band">
        <div className="band-inner compare-layout">
          <header className="section-head compare-head">
            <p className="compare-kicker">Karar motoru</p>
            <h2>Akıllı Teklif Karşılaştırma</h2>
            <p>Tedarikçileri fiyat, ödeme ve hız kriterlerine göre tek tabloda değerlendir.</p>

            <div className="compare-controls">
              <div className="compare-mode-switch" role="tablist" aria-label="Karşılaştırma modu">
                <button
                  type="button"
                  role="tab"
                  aria-selected={compareMode === "CASH"}
                  className={`compare-mode-btn ${compareMode === "CASH" ? "is-active" : ""}`}
                  onClick={() => setCompareMode("CASH")}
                >
                  Peşin Senaryo
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={compareMode === "CARD"}
                  className={`compare-mode-btn ${compareMode === "CARD" ? "is-active" : ""}`}
                  onClick={() => setCompareMode("CARD")}
                >
                  Kredi Kartı Senaryo
                </button>
              </div>

              <div className="compare-priority-switch" role="tablist" aria-label="Karar önceliği">
                <button
                  type="button"
                  role="tab"
                  aria-selected={comparePriority === "PRICE"}
                  className={`compare-priority-btn ${comparePriority === "PRICE" ? "is-active" : ""}`}
                  onClick={() => setComparePriority("PRICE")}
                >
                  Fiyat
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={comparePriority === "SPEED"}
                  className={`compare-priority-btn ${comparePriority === "SPEED" ? "is-active" : ""}`}
                  onClick={() => setComparePriority("SPEED")}
                >
                  Hız
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={comparePriority === "RATING"}
                  className={`compare-priority-btn ${comparePriority === "RATING" ? "is-active" : ""}`}
                  onClick={() => setComparePriority("RATING")}
                >
                  Puan
                </button>
              </div>
            </div>
          </header>

          <div className="compare-insight-grid">
            <article className="compare-insight-card spotlight">
              <p>Önerilen Tedarikçi</p>
              <strong>{comparisonMetrics.recommended.company}</strong>
              <span>{comparisonMetrics.recommendationReason}</span>
              <small>Uyumluluk Skoru %{comparisonMetrics.maxScore}</small>
            </article>
            <article className="compare-insight-card">
              <p>Karar Önceliği</p>
              <strong>{comparisonMetrics.priorityLabel}</strong>
              <span>Öneri motoru bu kritere göre sıralama yapar.</span>
            </article>
            <article className="compare-insight-card">
              <p>Senaryodaki En Düşük Fiyat</p>
              <strong>{formatTry(comparisonMetrics.minScenarioPrice)}</strong>
              <span>{compareMode === "CASH" ? "Peşin toplam bazlı hesaplandı" : "Kredi kartı toplam bazlı hesaplandı"}</span>
            </article>
            <article className="compare-insight-card">
              <p>Kredi Kartı Uygunluğu</p>
              <strong>
                {comparisonMetrics.cardCandidatesCount}/{comparisonSuppliers.length}
              </strong>
              <span>Kart senaryosu için teklif veren firma oranı.</span>
            </article>
          </div>

          <div className="supplier-grid">
            {comparisonSuppliers.map((supplier) => (
              <article
                key={supplier.id}
                className={`supplier-card ${comparisonMetrics.recommended.id === supplier.id ? "is-recommended" : ""}`}
              >
                <div className="supplier-card-head">
                  <p>{supplier.columnTitle}</p>
                  {supplier.isVerified ? <span className="supplier-verified">Doğrulandı</span> : null}
                </div>
                <strong>{supplier.company}</strong>
                <span className="supplier-city">{supplier.city}</span>
                <span className="supplier-score">%{comparisonMetrics.scoreById[supplier.id]} uyum</span>
                <div className="supplier-meta">
                  <span>Puan {formatScore(supplier.rating)}</span>
                  <span>Teslim {supplier.deliveryDays} gün</span>
                  <span>Yanıt {supplier.responseTime}</span>
                </div>
                <p className="supplier-price-label">{compareMode === "CASH" ? "Peşin Senaryo Toplamı" : "Kart Senaryo Toplamı"}</p>
                <strong className="supplier-scenario-price">{formatTry(comparisonMetrics.scenarioPriceById[supplier.id])}</strong>
                {compareMode === "CARD" && supplier.cardTotalPrice === null ? (
                  <span className="supplier-warning">Kart teklifi yok, peşin veriden tahmini senaryo hesaplandı.</span>
                ) : null}
              </article>
            ))}
          </div>

          <section className="compare-ranking-board" aria-label="Önceliğe göre sıralama">
            <header>
              <h3>Önceliğine Göre Sıralama</h3>
              <p>Fiyat, hız ve puan metriklerinden hesaplanan uyumluluk skorları.</p>
            </header>
            <div className="compare-ranking-list">
              {comparisonMetrics.ranking.map((row, index) => (
                <article key={row.supplier.id} className={`ranking-item ${index === 0 ? "is-top" : ""}`}>
                  <div className="ranking-head">
                    <span className="ranking-order">#{index + 1}</span>
                    <strong>{row.supplier.company}</strong>
                    <span className="ranking-score">%{row.totalScore}</span>
                  </div>
                  <div className="ranking-bar">
                    <span style={{ width: `${row.totalScore}%` }} />
                  </div>
                  <div className="ranking-meta">
                    <span>Fiyat %{row.priceScore}</span>
                    <span>Hız %{row.speedScore}</span>
                    <span>Puan %{row.ratingScore}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="table-wrap compare-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Kriter</th>
                  {comparisonSuppliers.map((supplier) => (
                    <th key={supplier.id}>
                      <span>{supplier.columnTitle}</span>
                      <small>{supplier.company}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Peşin Birim Fiyat</td>
                  {comparisonSuppliers.map((supplier) => (
                    <td key={`${supplier.id}-cash`} className={comparisonMetrics.minCash === supplier.cashUnitPrice ? "best-offer" : ""}>
                      {formatTry(supplier.cashUnitPrice)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>{compareMode === "CASH" ? "Senaryo Toplamı (Peşin)" : "Senaryo Toplamı (Kredi Kartı)"}</td>
                  {comparisonSuppliers.map((supplier) => (
                    <td
                      key={`${supplier.id}-scenario`}
                      className={
                        comparisonMetrics.minScenarioPrice === comparisonMetrics.scenarioPriceById[supplier.id] ? "best-offer" : ""
                      }
                    >
                      {formatTry(comparisonMetrics.scenarioPriceById[supplier.id])}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Kredi Kartı Toplam</td>
                  {comparisonSuppliers.map((supplier) => {
                    if (supplier.cardTotalPrice === null) {
                      return (
                        <td key={`${supplier.id}-card`} className="muted-cell">
                          <span className="status-badge status-neutral">Teklif Vermedi</span>
                        </td>
                      );
                    }
                    return (
                      <td key={`${supplier.id}-card`} className={comparisonMetrics.minCard === supplier.cardTotalPrice ? "best-offer" : ""}>
                        {formatTry(supplier.cardTotalPrice)}
                      </td>
                    );
                  })}
                </tr>
                <tr className="total-row">
                  <td>Proje Toplamı</td>
                  {comparisonSuppliers.map((supplier) => (
                    <td
                      key={`${supplier.id}-total`}
                      className={comparisonMetrics.minProject === supplier.projectTotal ? "best-offer" : ""}
                    >
                      {formatTry(supplier.projectTotal)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Teslim Süresi</td>
                  {comparisonSuppliers.map((supplier) => (
                    <td key={`${supplier.id}-delivery`} className={comparisonMetrics.minDelivery === supplier.deliveryDays ? "best-offer" : ""}>
                      {supplier.deliveryDays} gün
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Uyumluluk Skoru</td>
                  {comparisonSuppliers.map((supplier) => (
                    <td
                      key={`${supplier.id}-score`}
                      className={comparisonMetrics.maxScore === comparisonMetrics.scoreById[supplier.id] ? "best-offer" : ""}
                    >
                      %{comparisonMetrics.scoreById[supplier.id]}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Firma Puanı</td>
                  {comparisonSuppliers.map((supplier) => (
                    <td key={`${supplier.id}-rating`} className={comparisonMetrics.maxRating === supplier.rating ? "best-offer" : ""}>
                      {formatScore(supplier.rating)} / 5
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="landing-band category-showcase">
        <div className="band-inner">
          <h2>100+ Kategori ile Sektöre Uygun Eşleşme</h2>
          <div className="category-chip-list">
            {categoryItems.map((item) => (
              <article key={item} className="category-chip">
                <span className="check-dot">✓</span>
                <span>{item}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="hakkimizda" className="landing-band question-hero">
        <div className="band-inner question-overlay">
          <h2>Doğru Tedarikçiye Güvenli Şekilde Ulaş</h2>
          <div className="question-chip-grid">
            {referenceItems.map((item) => (
              <span key={item} className="question-chip">
                {item}
              </span>
            ))}
            {securityItems.map((item) => (
              <span key={item} className="question-chip">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-band testimonials-band">
        <div className="band-inner testimonials-section">
          <h2>Müşteri Yorumları</h2>
          <p className="section-subtitle">Satın alma ve tedarik ekiplerinin platform deneyimleri.</p>

          <div className="testimonial-grid">
            {testimonialItems.map((item) => (
              <article key={item.name} className="testimonial-card">
                <div className="testimonial-head">
                  <div className="avatar-dot">{item.name.charAt(0)}</div>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.role}</p>
                  </div>
                </div>
                <p className="stars">★ ★ ★ ★ ★</p>
                <p>{item.comment}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="sss" className="landing-band faq-band">
        <div className="band-inner faq-layout">
          <div className="faq-copy">
            <p className="faq-kicker">3teklif Pro</p>
            <h2>Sıkça Sorulan Sorular</h2>

            <div className="faq-list">
              {faqItems.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <article key={item.question} className={`faq-item ${isOpen ? "is-open" : ""}`}>
                    <button
                      type="button"
                      className="faq-question"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${index}`}
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    >
                      <span>{item.question}</span>
                      <span className="faq-icon">{isOpen ? "−" : "+"}</span>
                    </button>
                    {isOpen ? (
                      <p id={`faq-answer-${index}`} className="faq-answer">
                        {item.answer}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <Link className="solid-btn faq-cta" to="/register/customer?type=SERVICE">
              Ücretsiz Başlayın
            </Link>
          </div>

          <aside className="faq-visual" aria-hidden="true">
            <div className="faq-laptop">
              <div className="faq-screen">
                <header className="faq-screen-head">
                  <span className="faq-dot" />
                  <span className="faq-dot" />
                  <span className="faq-dot" />
                </header>
                <div className="faq-screen-body">
                  <div className="faq-toolbar-line" />
                  <div className="faq-table-head">
                    <span>Sıra No</span>
                    <span>Stok Kodu</span>
                    <span>Ürün Adı</span>
                    <span>Durum</span>
                  </div>
                  <div className="faq-table-row">
                    <span>1</span>
                    <span>GC210230</span>
                    <span>Hikvision Kamera</span>
                    <span className="ok-tag">Yeterli Stok</span>
                  </div>
                  <div className="faq-table-row">
                    <span>2</span>
                    <span>GC220912</span>
                    <span>Bull IP Kamera</span>
                    <span className="warn-tag">Azalan Stok</span>
                  </div>
                </div>
              </div>
              <div className="faq-laptop-base" />
            </div>
          </aside>
        </div>
      </section>

      <section id="paketler" className="landing-band pricing-band">
        <div className="band-inner">
          <header className="section-head">
            <h2>Paketler</h2>
            <p>Ekibinin hızına göre başla, büyüdükçe genişlet.</p>
          </header>

          <div className="pricing-grid">
            <article className="price-card">
              <h3>Trial</h3>
              <p>15 gün ücretsiz kullanım, temel teklif yönetimi</p>
              <strong>0 TL</strong>
            </article>
            <article className="price-card featured">
              <h3>Plus</h3>
              <p>Sınırsız teklif, öncelikli görünüm ve detaylı raporlar</p>
              <strong>Aylık Paket</strong>
            </article>
          </div>
        </div>
      </section>

      <footer id="iletisim" className="landing-band contact-band corporate-footer">
        <div className="band-inner footer-shell">
          <section className="footer-top">
            <div className="footer-top-copy">
              <p className="footer-kicker">3teklif Kurumsal</p>
              <h2>{cmsText("landing.footer.heading", "Satın alma operasyonun için tek bir güvenli teklif altyapısı")}</h2>
              <p>{cmsText("landing.footer.description", "Onaylı tedarikçi havuzu, akıllı karşılaştırma ve raporlama modülleri ile ekiplerin daha hızlı ve kontrollü karar alır.")}</p>
            </div>
            <div className="footer-top-actions">
              <Link className="solid-btn" to="/register/customer?type=SERVICE">
                Demo Talep Et
              </Link>
              <Link className="ghost-btn footer-ghost-btn" to="/register/company">
                Kurumsal Satış
              </Link>
            </div>
          </section>

          <section className="footer-grid">
            <div className="footer-col footer-brand-col">
              <p className="footer-logo">3teklif</p>
              <p className="footer-description">
                Hizmet ve ürün alımlarında işletmeleri doğrulanmış tedarikçilerle buluşturan dijital teklif yönetim platformu.
              </p>
              <div className="footer-badges">
                <span>KVKK Uyumlu</span>
                <span>SSL 256-bit</span>
                <span>Doğrulanmış Firma</span>
              </div>
            </div>

            <nav className="footer-col" aria-label="Platform">
              <h3>Platform</h3>
              <a href="/#nasil-calisir">Nasıl Çalışır?</a>
              <a href="/#paketler">Paketler</a>
              <a href="/#iletisim">İletişim</a>
              <a href="/#sss">Sıkça Sorulan Sorular</a>
            </nav>

            <nav className="footer-col" aria-label="Hesap">
              <h3>Hesap</h3>
              <Link to="/login">Giriş Yap</Link>
              <Link to="/register/customer?type=SERVICE">Müşteri Kaydı</Link>
              <Link to="/register/company">Firma Kaydı</Link>
              <Link to="/redirect">Panele Git</Link>
            </nav>

            <div className="footer-col">
              <h3>İletişim</h3>
              <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
              <a href={supportPhoneHref}>{supportPhone}</a>
              <p>Hafta içi 09:00 - 18:00</p>
              <p>Maslak, Sarıyer / İstanbul</p>
              <form className="form-grid" onSubmit={handleSupportSubmit}>
                <label>
                  Ad Soyad
                  <input value={supportForm.name} onChange={(e) => setSupportForm((p) => ({ ...p, name: e.target.value }))} required />
                </label>
                <label>
                  E-posta
                  <input type="email" value={supportForm.email} onChange={(e) => setSupportForm((p) => ({ ...p, email: e.target.value }))} required />
                </label>
                <label>
                  Konu
                  <input value={supportForm.subject} onChange={(e) => setSupportForm((p) => ({ ...p, subject: e.target.value }))} />
                </label>
                <label>
                  Mesaj
                  <textarea rows={3} value={supportForm.message} onChange={(e) => setSupportForm((p) => ({ ...p, message: e.target.value }))} required />
                </label>
                {supportError ? <p className="error-text">{supportError}</p> : null}
                {supportNotice ? <p className="admin-success-note">{supportNotice}</p> : null}
                <button className="ghost-btn footer-ghost-btn" type="submit">Destek Mesajı Gönder</button>
              </form>
            </div>
          </section>

          <div className="footer-bottom">
            <p>© {currentYear} 3teklif Teknoloji A.Ş. Tüm hakları saklıdır.</p>
            <div className="footer-bottom-links">
              <span>KVKK</span>
              <span>Gizlilik Politikası</span>
              <span>Çerez Politikası</span>
              <span>Kullanım Şartları</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}














