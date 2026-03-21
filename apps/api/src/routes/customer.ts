import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { findEligibleCompaniesBySector } from "../services/company-eligibility";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/app-error";

const customerRouter = Router();

const createListingSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  listingType: z.enum(["SERVICE", "PRODUCT"]),
  sectorId: z.string().min(10),
  city: z.string().min(2),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  expiresAt: z.string().datetime().optional()
});

const createTenderSchema = z.object({
  listingId: z.string().min(10),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime()
});

const manageTenderSchema = z
  .object({
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    status: z.enum(["DRAFT", "OPEN", "CLOSED", "CANCELED"]).optional()
  })
  .refine((value) => value.startsAt !== undefined || value.endsAt !== undefined || value.status !== undefined, {
    message: "En az bir alan guncellenmeli."
  });

const awardTenderSchema = z.object({
  tenderBidId: z.string().min(10)
});

const createPanelSupportMessageSchema = z.object({
  subject: z.string().min(2).max(140).optional(),
  message: z.string().min(8).max(4000),
  phone: z.string().min(6).max(40).optional()
});

function toScore(value: number, minValue: number, maxValue: number): number {
  if (maxValue === minValue) {
    return 100;
  }

  const score = ((maxValue - value) / (maxValue - minValue)) * 100;
  return Math.max(0, Math.min(100, score));
}

type BidCompany = {
  id: string;
  name: string;
  city: string | null;
  rating: number;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  membershipType: "TRIAL" | "PLUS";
};

type NumericValue = number | string | { toString: () => string };

type ListingBidRankInput = {
  id: string;
  listingId: string;
  price: NumericValue;
  deliveryDay: number | null;
  note: string | null;
  company: BidCompany;
};

type TenderBidRankInput = {
  id: string;
  tenderId: string;
  price: NumericValue;
  deliveryDay: number | null;
  note: string | null;
  status: "ACTIVE" | "WITHDRAWN" | "WON" | "LOST";
  company: BidCompany;
};

function rankListingBids(bids: ListingBidRankInput[]) {
  if (bids.length === 0) {
    return [];
  }

  const priceValues = bids.map((bid) => Number(bid.price));
  const maxPrice = Math.max(...priceValues);
  const minPrice = Math.min(...priceValues);

  const deliveryValues = bids.map((bid) => bid.deliveryDay ?? 999);
  const maxDelivery = Math.max(...deliveryValues);
  const minDelivery = Math.min(...deliveryValues);

  return bids
    .map((bid) => {
      const priceScore = toScore(Number(bid.price), minPrice, maxPrice);
      const deliveryScore = toScore(bid.deliveryDay ?? 999, minDelivery, maxDelivery);
      const ratingScore = Math.max(0, Math.min(100, bid.company.rating * 20));
      const finalScore = priceScore * 0.6 + deliveryScore * 0.2 + ratingScore * 0.2;

      return {
        bidId: bid.id,
        listingId: bid.listingId,
        company: bid.company,
        price: Number(bid.price),
        deliveryDay: bid.deliveryDay,
        note: bid.note,
        score: Number(finalScore.toFixed(2))
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      isTop3: index < 3
    }));
}

function rankTenderBids(bids: TenderBidRankInput[]) {
  if (bids.length === 0) {
    return [];
  }

  const priceValues = bids.map((bid) => Number(bid.price));
  const maxPrice = Math.max(...priceValues);
  const minPrice = Math.min(...priceValues);
  const deliveryValues = bids.map((bid) => bid.deliveryDay ?? 999);
  const maxDelivery = Math.max(...deliveryValues);
  const minDelivery = Math.min(...deliveryValues);

  return bids
    .map((bid) => {
      const priceScore = toScore(Number(bid.price), minPrice, maxPrice);
      const deliveryScore = toScore(bid.deliveryDay ?? 999, minDelivery, maxDelivery);
      const ratingScore = Math.max(0, Math.min(100, bid.company.rating * 20));
      const finalScore = priceScore * 0.6 + deliveryScore * 0.2 + ratingScore * 0.2;

      return {
        tenderBidId: bid.id,
        tenderId: bid.tenderId,
        company: bid.company,
        price: Number(bid.price),
        deliveryDay: bid.deliveryDay,
        note: bid.note,
        score: Number(finalScore.toFixed(2)),
        status: bid.status
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      isTop3: index < 3
    }));
}

async function getCustomerIdByUserId(userId: string): Promise<string> {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: { id: true }
  });

  if (!customer) {
    throw new AppError("Musteri profili bulunamadi.", 404);
  }

  return customer.id;
}

async function getCustomerByUserId(userId: string) {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true
        }
      }
    }
  });

  if (!customer) {
    throw new AppError("Musteri profili bulunamadi.", 404);
  }

  return customer;
}

async function getRankedListingBidsByCustomer(listingId: string, customerId: string) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, customerId },
    include: {
      sector: true,
      _count: {
        select: {
          bids: true,
          matches: true
        }
      },
      bids: {
        where: { status: "ACTIVE" },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              city: true,
              rating: true,
              approvalStatus: true,
              membershipType: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!listing) {
    throw new AppError("Ilan bulunamadi.", 404);
  }

  const ranked = rankListingBids(listing.bids);

  if (ranked.length > 0) {
    await prisma.$transaction(
      ranked.map((item) =>
        prisma.bid.update({
          where: { id: item.bidId },
          data: { score: item.score }
        })
      )
    );
  }

  return { listing, ranked };
}

async function getRankedTenderBidsByCustomer(tenderId: string, customerId: string) {
  const tender = await prisma.tender.findFirst({
    where: {
      id: tenderId,
      customerId
    },
    include: {
      listing: {
        include: {
          sector: true
        }
      },
      _count: {
        select: {
          bids: true,
          participants: true
        }
      },
      participants: {
        include: {
          company: {
            select: {
              id: true,
              name: true,
              city: true,
              rating: true,
              approvalStatus: true,
              membershipType: true
            }
          }
        },
        orderBy: { joinedAt: "desc" }
      },
      bids: {
        where: {
          status: {
            in: ["ACTIVE", "WON", "LOST"]
          }
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              city: true,
              rating: true,
              approvalStatus: true,
              membershipType: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!tender) {
    throw new AppError("Ihale bulunamadi.", 404);
  }

  const ranked = rankTenderBids(tender.bids);

  if (ranked.length > 0) {
    await prisma.$transaction(
      ranked.map((item) =>
        prisma.tenderBid.update({
          where: { id: item.tenderBidId },
          data: { score: item.score }
        })
      )
    );
  }

  return { tender, ranked };
}

customerRouter.use(authenticate, authorize("CUSTOMER"));

customerRouter.get(
  "/support-messages",
  asyncHandler(async (req, res) => {
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const customer = await getCustomerByUserId(currentUser.id);
    const items = await prisma.supportMessage.findMany({
      where: {
        email: customer.user.email.toLowerCase().trim()
      },
      include: {
        handledByUser: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json({ items });
  })
);

customerRouter.post(
  "/support-messages",
  asyncHandler(async (req, res) => {
    const payload = createPanelSupportMessageSchema.parse(req.body);
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const customer = await getCustomerByUserId(currentUser.id);
    const baseSubject = payload.subject?.trim() || "Panel destek talebi";

    const item = await prisma.supportMessage.create({
      data: {
        name: customer.fullName,
        email: customer.user.email.toLowerCase().trim(),
        phone: payload.phone?.trim() || customer.phone || undefined,
        subject: `[MUSTERI PANELI] ${baseSubject}`,
        message: payload.message.trim(),
        status: "NEW"
      },
      include: {
        handledByUser: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      message: "Destek talebiniz iletildi.",
      item
    });
  })
);

customerRouter.post(
  "/listings",
  asyncHandler(async (req, res) => {
    const payload = createListingSchema.parse(req.body);
    const currentUser = req.authUser;

    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const customerId = await getCustomerIdByUserId(currentUser.id);
    const sector = await prisma.sector.findUnique({ where: { id: payload.sectorId } });
    if (!sector) {
      throw new AppError("Secilen sektor bulunamadi.", 404);
    }

    if (payload.budgetMin && payload.budgetMax && payload.budgetMin > payload.budgetMax) {
      throw new AppError("Minimum butce, maksimum butceden buyuk olamaz.", 400);
    }

    const listing = await prisma.listing.create({
      data: {
        customerId,
        title: payload.title,
        description: payload.description,
        listingType: payload.listingType,
        sectorId: payload.sectorId,
        city: payload.city,
        budgetMin: payload.budgetMin,
        budgetMax: payload.budgetMax,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null
      },
      include: {
        sector: true
      }
    });

    const eligibleCompanies = await findEligibleCompaniesBySector(payload.sectorId);

    if (eligibleCompanies.length > 0) {
      await prisma.listingMatch.createMany({
        data: eligibleCompanies.map((company) => ({
          listingId: listing.id,
          companyId: company.id,
          reason: "Sector match + active membership"
        })),
        skipDuplicates: true
      });
    }

    res.status(201).json({
      message: "Ilan olusturuldu ve uygun firmalara dagitildi.",
      listing,
      matchedCompanyCount: eligibleCompanies.length
    });
  })
);

customerRouter.get(
  "/listings",
  asyncHandler(async (req, res) => {
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const customerId = await getCustomerIdByUserId(currentUser.id);
    const listings = await prisma.listing.findMany({
      where: { customerId },
      include: {
        sector: true,
        _count: {
          select: {
            bids: true,
            matches: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ items: listings });
  })
);

customerRouter.get(
  "/listings/:listingId/top-3",
  asyncHandler(async (req, res) => {
    const { listingId } = req.params;
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const customerId = await getCustomerIdByUserId(currentUser.id);
    const { ranked } = await getRankedListingBidsByCustomer(listingId, customerId);

    res.status(200).json({
      items: ranked.slice(0, 3)
    });
  })
);

customerRouter.get(
  "/listings/:listingId/bids",
  asyncHandler(async (req, res) => {
    const { listingId } = req.params;
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const customerId = await getCustomerIdByUserId(currentUser.id);
    const { listing, ranked } = await getRankedListingBidsByCustomer(listingId, customerId);

    res.status(200).json({
      item: {
        listing: {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          listingType: listing.listingType,
          city: listing.city,
          status: listing.status,
          createdAt: listing.createdAt,
          expiresAt: listing.expiresAt,
          sector: {
            id: listing.sector.id,
            name: listing.sector.name
          },
          metrics: {
            bids: listing._count.bids,
            matchedCompanies: listing._count.matches
          }
        },
        top3: ranked.slice(0, 3),
        items: ranked
      }
    });
  })
);

customerRouter.post(
  "/tenders",
  asyncHandler(async (req, res) => {
    const payload = createTenderSchema.parse(req.body);
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const customerId = await getCustomerIdByUserId(currentUser.id);
    const startsAt = new Date(payload.startsAt);
    const endsAt = new Date(payload.endsAt);
    if (endsAt <= startsAt) {
      throw new AppError("Ihale bitis tarihi baslangic tarihinden sonra olmalidir.", 400);
    }

    const listing = await prisma.listing.findFirst({
      where: {
        id: payload.listingId,
        customerId
      }
    });
    if (!listing) {
      throw new AppError("Ihale acilacak ilan bulunamadi.", 404);
    }

    const existingTender = await prisma.tender.findUnique({
      where: { listingId: listing.id },
      select: { id: true }
    });
    if (existingTender) {
      throw new AppError("Bu ilan icin zaten bir ihale olusturulmus.", 409);
    }

    const now = new Date();
    const tender = await prisma.tender.create({
      data: {
        listingId: listing.id,
        customerId,
        startsAt,
        endsAt,
        status: startsAt <= now ? "OPEN" : "DRAFT"
      }
    });

    res.status(201).json({
      message: "Ihale olusturuldu.",
      item: tender
    });
  })
);

customerRouter.get(
  "/tenders",
  asyncHandler(async (req, res) => {
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const customerId = await getCustomerIdByUserId(currentUser.id);
    const tenders = await prisma.tender.findMany({
      where: { customerId },
      include: {
        listing: {
          include: {
            sector: true
          }
        },
        _count: {
          select: { bids: true, participants: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ items: tenders });
  })
);

customerRouter.get(
  "/tenders/:tenderId/top-3",
  asyncHandler(async (req, res) => {
    const { tenderId } = req.params;
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const customerId = await getCustomerIdByUserId(currentUser.id);
    const { ranked } = await getRankedTenderBidsByCustomer(tenderId, customerId);

    res.status(200).json({
      items: ranked.slice(0, 3)
    });
  })
);

customerRouter.get(
  "/tenders/:tenderId/bids",
  asyncHandler(async (req, res) => {
    const { tenderId } = req.params;
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const customerId = await getCustomerIdByUserId(currentUser.id);
    const { tender, ranked } = await getRankedTenderBidsByCustomer(tenderId, customerId);
    const bidByCompanyId = new Map(tender.bids.map((bid) => [bid.companyId, bid]));
    const winnerBid = tender.bids.find((bid) => bid.status === "WON");

    res.status(200).json({
      item: {
        tender: {
          id: tender.id,
          status: tender.status,
          startsAt: tender.startsAt,
          endsAt: tender.endsAt,
          listing: {
            id: tender.listing.id,
            title: tender.listing.title,
            sector: {
              id: tender.listing.sector.id,
              name: tender.listing.sector.name
            }
          },
          metrics: {
            bids: tender._count.bids,
            participants: tender._count.participants
          }
        },
        participants: tender.participants.map((participant) => {
          const bid = bidByCompanyId.get(participant.companyId);
          return {
            id: participant.id,
            status: participant.status,
            joinedAt: participant.joinedAt,
            company: participant.company,
            hasBid: !!bid,
            bidStatus: bid?.status ?? null
          };
        }),
        winner:
          winnerBid && winnerBid.company
            ? {
                tenderBidId: winnerBid.id,
                company: winnerBid.company,
                price: Number(winnerBid.price),
                deliveryDay: winnerBid.deliveryDay
              }
            : null,
        top3: ranked.slice(0, 3),
        items: ranked
      }
    });
  })
);

customerRouter.patch(
  "/tenders/:tenderId",
  asyncHandler(async (req, res) => {
    const payload = manageTenderSchema.parse(req.body);
    const { tenderId } = req.params;
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const customerId = await getCustomerIdByUserId(currentUser.id);
    const tender = await prisma.tender.findFirst({
      where: { id: tenderId, customerId }
    });
    if (!tender) {
      throw new AppError("Ihale bulunamadi.", 404);
    }

    if (tender.status === "CLOSED" || tender.status === "CANCELED") {
      throw new AppError("Kapali veya iptal ihalede guncelleme yapilamaz.", 400);
    }

    const nextStartsAt = payload.startsAt ? new Date(payload.startsAt) : tender.startsAt;
    const nextEndsAt = payload.endsAt ? new Date(payload.endsAt) : tender.endsAt;
    if (nextEndsAt <= nextStartsAt) {
      throw new AppError("Ihale bitis tarihi baslangic tarihinden sonra olmalidir.", 400);
    }

    let nextStatus = payload.status ?? tender.status;
    const now = new Date();

    if (nextStatus === "OPEN" && nextStartsAt > now) {
      throw new AppError("Baslangic zamani gelmeyen ihale acik duruma alinamaz.", 400);
    }

    if (nextStatus === "OPEN" && nextEndsAt <= now) {
      throw new AppError("Suresi bitmis ihale acik duruma alinamaz.", 400);
    }

    if (payload.status === undefined) {
      if (nextStatus === "OPEN" && nextEndsAt <= now) {
        nextStatus = "CLOSED";
      } else if (nextStatus === "DRAFT" && nextStartsAt <= now && nextEndsAt > now) {
        nextStatus = "OPEN";
      }
    }

    const updatedTender = await prisma.tender.update({
      where: { id: tender.id },
      data: {
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        status: nextStatus
      }
    });

    res.status(200).json({
      message: "Ihale guncellendi.",
      item: updatedTender
    });
  })
);

customerRouter.post(
  "/tenders/:tenderId/award",
  asyncHandler(async (req, res) => {
    const payload = awardTenderSchema.parse(req.body);
    const { tenderId } = req.params;
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const customerId = await getCustomerIdByUserId(currentUser.id);
    const tender = await prisma.tender.findFirst({
      where: { id: tenderId, customerId },
      include: {
        bids: {
          where: {
            status: {
              in: ["ACTIVE", "WON", "LOST"]
            }
          }
        }
      }
    });

    if (!tender) {
      throw new AppError("Ihale bulunamadi.", 404);
    }

    if (tender.status === "CANCELED") {
      throw new AppError("Iptal edilmis ihalede kazanan secilemez.", 400);
    }

    const selectedBid = tender.bids.find((bid) => bid.id === payload.tenderBidId);
    if (!selectedBid) {
      throw new AppError("Secilen teklif bu ihalede bulunamadi.", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.tender.update({
        where: { id: tender.id },
        data: { status: "CLOSED" }
      });

      await tx.tenderBid.updateMany({
        where: {
          tenderId: tender.id,
          id: { not: selectedBid.id },
          status: { in: ["ACTIVE", "WON", "LOST"] }
        },
        data: { status: "LOST" }
      });

      await tx.tenderBid.update({
        where: { id: selectedBid.id },
        data: { status: "WON" }
      });
    });

    res.status(200).json({
      message: "Kazanan teklif secildi ve ihale kapatildi.",
      item: {
        tenderId: tender.id,
        tenderBidId: selectedBid.id
      }
    });
  })
);

export { customerRouter };
