import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { ensureCompanyCanBid } from "../services/company-eligibility";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/app-error";

const companyRouter = Router();

const createDocumentSchema = z.object({
  docType: z.string().min(2),
  fileUrl: z.string().url(),
  note: z.string().optional()
});

const createBidSchema = z.object({
  listingId: z.string().min(10),
  price: z.number().positive(),
  deliveryDay: z.number().int().positive().optional(),
  note: z.string().max(1000).optional()
});

const createTenderBidSchema = z.object({
  tenderId: z.string().min(10),
  price: z.number().positive(),
  deliveryDay: z.number().int().positive().optional(),
  note: z.string().max(1000).optional()
});

const updateCompanyPreferencesSchema = z.object({
  sectorIds: z.array(z.string().min(10)).min(1),
  competencyIds: z.array(z.string().min(10)).default([])
});

const createPanelSupportMessageSchema = z.object({
  subject: z.string().min(2).max(140).optional(),
  message: z.string().min(8).max(4000),
  phone: z.string().min(6).max(40).optional()
});

async function getCompanyByUserId(userId: string) {
  const company = await prisma.company.findUnique({
    where: { userId },
    include: {
      sectors: {
        include: {
          sector: true
        }
      },
      competencies: {
        include: {
          competency: true
        }
      },
      subscriptions: {
        include: { package: true },
        orderBy: { endsAt: "desc" },
        take: 5
      },
      documents: {
        orderBy: { uploadedAt: "desc" }
      }
    }
  });

  if (!company) {
    throw new AppError("Firma profili bulunamadi.", 404);
  }

  return company;
}

async function getOpenTenderOpportunityForCompany(tenderId: string, companyId: string) {
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      listing: {
        include: {
          matches: {
            where: { companyId },
            take: 1
          }
        }
      }
    }
  });

  if (!tender) {
    throw new AppError("Ihale bulunamadi.", 404);
  }

  if (tender.listing.matches.length === 0) {
    throw new AppError("Bu ihale firma panelinize dusmedi.", 403);
  }

  if (tender.status !== "OPEN") {
    throw new AppError("Ihale acik degil.", 400);
  }

  const now = new Date();
  if (tender.startsAt > now || tender.endsAt < now) {
    throw new AppError("Ihale suresi disinda islem yapilamaz.", 400);
  }

  return tender;
}

companyRouter.use(authenticate, authorize("COMPANY"));

companyRouter.get(
  "/support-messages",
  asyncHandler(async (req, res) => {
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const userAccount = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { email: true }
    });
    if (!userAccount) {
      throw new AppError("Kullanici bulunamadi.", 404);
    }

    const items = await prisma.supportMessage.findMany({
      where: {
        email: userAccount.email.toLowerCase().trim()
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

companyRouter.post(
  "/support-messages",
  asyncHandler(async (req, res) => {
    const payload = createPanelSupportMessageSchema.parse(req.body);
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const userAccount = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { email: true }
    });
    if (!userAccount) {
      throw new AppError("Kullanici bulunamadi.", 404);
    }

    const company = await getCompanyByUserId(currentUser.id);
    const baseSubject = payload.subject?.trim() || "Panel destek talebi";

    const item = await prisma.supportMessage.create({
      data: {
        name: company.name,
        email: userAccount.email.toLowerCase().trim(),
        phone: payload.phone?.trim() || undefined,
        subject: `[FIRMA PANELI] ${baseSubject}`,
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

companyRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const company = await getCompanyByUserId(currentUser.id);
    res.status(200).json({
      item: {
        id: company.id,
        name: company.name,
        city: company.city,
        taxNumber: company.taxNumber,
        approvalStatus: company.approvalStatus,
        membershipType: company.membershipType,
        trialEndsAt: company.trialEndsAt,
        rating: company.rating,
        completedJobs: company.completedJobs,
        sectors: company.sectors.map((item) => item.sector),
        competencies: company.competencies.map((item) => item.competency),
        subscriptions: company.subscriptions,
        documents: company.documents
      }
    });
  })
);

companyRouter.get(
  "/preferences/options",
  asyncHandler(async (_req, res) => {
    const sectors = await prisma.sector.findMany({
      orderBy: { name: "asc" },
      include: {
        competencies: {
          include: {
            competency: true
          }
        }
      }
    });

    res.status(200).json({
      items: sectors.map((sector) => ({
        id: sector.id,
        name: sector.name,
        competencies: sector.competencies
          .map((item) => ({
            id: item.competency.id,
            name: item.competency.name
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      }))
    });
  })
);

companyRouter.put(
  "/preferences",
  asyncHandler(async (req, res) => {
    const payload = updateCompanyPreferencesSchema.parse(req.body);
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const company = await getCompanyByUserId(currentUser.id);
    const now = new Date();

    const sectorIds = [...new Set(payload.sectorIds)];
    const competencyIds = [...new Set(payload.competencyIds)];

    const selectedSectors = await prisma.sector.findMany({
      where: {
        id: { in: sectorIds }
      },
      select: { id: true }
    });
    if (selectedSectors.length !== sectorIds.length) {
      throw new AppError("Secilen kategorilerden bazilari gecersiz.", 400);
    }

    if (competencyIds.length > 0) {
      const competencyCount = await prisma.competency.count({
        where: {
          id: { in: competencyIds }
        }
      });
      if (competencyCount !== competencyIds.length) {
        throw new AppError("Secilen yetkinliklerden bazilari gecersiz.", 400);
      }

      const validLinks = await prisma.sectorCompetency.findMany({
        where: {
          sectorId: { in: sectorIds },
          competencyId: { in: competencyIds }
        },
        select: { competencyId: true }
      });
      const validCompetencyIds = new Set(validLinks.map((item) => item.competencyId));
      const hasInvalidCompetency = competencyIds.some((id) => !validCompetencyIds.has(id));
      if (hasInvalidCompetency) {
        throw new AppError("Yetkinlik secimi, secilen kategorilerle uyusmuyor.", 400);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.companySector.deleteMany({
        where: { companyId: company.id }
      });

      await tx.companySector.createMany({
        data: sectorIds.map((sectorId) => ({
          companyId: company.id,
          sectorId
        }))
      });

      await tx.companyCompetency.deleteMany({
        where: { companyId: company.id }
      });

      if (competencyIds.length > 0) {
        await tx.companyCompetency.createMany({
          data: competencyIds.map((competencyId) => ({
            companyId: company.id,
            competencyId
          }))
        });
      }

      await tx.listingMatch.deleteMany({
        where: {
          companyId: company.id,
          listing: {
            sectorId: {
              notIn: sectorIds
            }
          }
        }
      });

      const openListings = await tx.listing.findMany({
        where: {
          status: "OPEN",
          sectorId: { in: sectorIds },
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
          matches: {
            none: {
              companyId: company.id
            }
          }
        },
        select: { id: true }
      });

      if (openListings.length > 0) {
        await tx.listingMatch.createMany({
          data: openListings.map((listing) => ({
            listingId: listing.id,
            companyId: company.id,
            reason: "Kategori tercihleri guncellendi."
          }))
        });
      }
    });

    const updatedCompany = await getCompanyByUserId(currentUser.id);

    res.status(200).json({
      message: "Kategori ve yetkinlik tercihleri guncellendi.",
      item: {
        sectors: updatedCompany.sectors.map((item) => item.sector),
        competencies: updatedCompany.competencies.map((item) => item.competency)
      }
    });
  })
);

companyRouter.post(
  "/documents",
  asyncHandler(async (req, res) => {
    const payload = createDocumentSchema.parse(req.body);
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const company = await getCompanyByUserId(currentUser.id);
    const document = await prisma.companyDocument.create({
      data: {
        companyId: company.id,
        docType: payload.docType,
        fileUrl: payload.fileUrl,
        note: payload.note,
        status: "PENDING"
      }
    });

    res.status(201).json({
      message: "Evrak yuklendi. Admin incelemesi bekleniyor.",
      item: document
    });
  })
);

companyRouter.get(
  "/opportunities",
  asyncHandler(async (req, res) => {
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const company = await getCompanyByUserId(currentUser.id);
    const now = new Date();
    const opportunities = await prisma.listingMatch.findMany({
      where: {
        companyId: company.id,
        listing: {
          status: "OPEN",
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }]
        }
      },
      include: {
        listing: {
          include: {
            sector: true,
            customer: {
              select: {
                id: true,
                fullName: true,
                city: true
              }
            },
            _count: {
              select: { bids: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json({ items: opportunities });
  })
);

companyRouter.post(
  "/bids",
  asyncHandler(async (req, res) => {
    const payload = createBidSchema.parse(req.body);
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const company = await getCompanyByUserId(currentUser.id);
    await ensureCompanyCanBid(company.id);

    const listing = await prisma.listing.findUnique({
      where: { id: payload.listingId }
    });
    if (!listing) {
      throw new AppError("Ilan bulunamadi.", 404);
    }
    if (listing.status !== "OPEN") {
      throw new AppError("Bu ilana teklif verilemez.", 400);
    }
    if (listing.expiresAt && listing.expiresAt < new Date()) {
      throw new AppError("Ilan suresi dolmus.", 400);
    }

    const match = await prisma.listingMatch.findUnique({
      where: {
        listingId_companyId: {
          listingId: listing.id,
          companyId: company.id
        }
      }
    });
    if (!match) {
      throw new AppError("Bu ilan firma panelinize dusmedi.", 403);
    }

    const bid = await prisma.bid.upsert({
      where: {
        listingId_companyId: {
          listingId: listing.id,
          companyId: company.id
        }
      },
      update: {
        price: payload.price,
        deliveryDay: payload.deliveryDay,
        note: payload.note,
        status: "ACTIVE"
      },
      create: {
        listingId: listing.id,
        companyId: company.id,
        price: payload.price,
        deliveryDay: payload.deliveryDay,
        note: payload.note,
        status: "ACTIVE"
      }
    });

    res.status(201).json({
      message: "Teklif kaydedildi.",
      item: bid
    });
  })
);

companyRouter.get(
  "/bids",
  asyncHandler(async (req, res) => {
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const company = await getCompanyByUserId(currentUser.id);
    const bids = await prisma.bid.findMany({
      where: { companyId: company.id },
      include: {
        listing: {
          include: {
            sector: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json({ items: bids });
  })
);

companyRouter.get(
  "/tenders/opportunities",
  asyncHandler(async (req, res) => {
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const company = await getCompanyByUserId(currentUser.id);
    const now = new Date();

    const tenders = await prisma.tender.findMany({
      where: {
        status: "OPEN",
        startsAt: { lte: now },
        endsAt: { gte: now },
        listing: {
          matches: {
            some: { companyId: company.id }
          }
        }
      },
      include: {
        participants: {
          where: { companyId: company.id },
          take: 1
        },
        bids: {
          where: { companyId: company.id },
          take: 1,
          orderBy: { updatedAt: "desc" }
        },
        listing: {
          include: {
            sector: true,
            customer: {
              select: {
                fullName: true
              }
            }
          }
        },
        _count: {
          select: {
            bids: true,
            participants: true
          }
        }
      },
      orderBy: { endsAt: "asc" }
    });

    res.status(200).json({
      items: tenders.map((tender) => ({
        id: tender.id,
        status: tender.status,
        startsAt: tender.startsAt,
        endsAt: tender.endsAt,
        listing: tender.listing,
        metrics: {
          bids: tender._count.bids,
          participants: tender._count.participants
        },
        isJoined: tender.participants.some((item) => item.status === "JOINED"),
        participation: tender.participants[0] ?? null,
        myBid: tender.bids[0]
          ? {
              id: tender.bids[0].id,
              price: Number(tender.bids[0].price),
              deliveryDay: tender.bids[0].deliveryDay,
              status: tender.bids[0].status,
              updatedAt: tender.bids[0].updatedAt
            }
          : null
      }))
    });
  })
);

companyRouter.post(
  "/tenders/:tenderId/join",
  asyncHandler(async (req, res) => {
    const { tenderId } = req.params;
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const company = await getCompanyByUserId(currentUser.id);
    await ensureCompanyCanBid(company.id);
    await getOpenTenderOpportunityForCompany(tenderId, company.id);

    const participant = await prisma.tenderParticipant.upsert({
      where: {
        tenderId_companyId: {
          tenderId,
          companyId: company.id
        }
      },
      update: {
        status: "JOINED"
      },
      create: {
        tenderId,
        companyId: company.id,
        status: "JOINED"
      }
    });

    res.status(201).json({
      message: "Ihaleye katilim kaydi olusturuldu.",
      item: participant
    });
  })
);

companyRouter.delete(
  "/tenders/:tenderId/join",
  asyncHandler(async (req, res) => {
    const { tenderId } = req.params;
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const company = await getCompanyByUserId(currentUser.id);

    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      include: {
        listing: {
          include: {
            matches: {
              where: { companyId: company.id },
              take: 1
            }
          }
        },
        participants: {
          where: { companyId: company.id },
          take: 1
        }
      }
    });

    if (!tender) {
      throw new AppError("Ihale bulunamadi.", 404);
    }

    if (tender.listing.matches.length === 0) {
      throw new AppError("Bu ihale firma panelinize dusmedi.", 403);
    }

    const participant = tender.participants[0];
    if (!participant || participant.status !== "JOINED") {
      throw new AppError("Ihalede aktif katilim kaydin bulunmuyor.", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenderParticipant.update({
        where: { id: participant.id },
        data: { status: "WITHDRAWN" }
      });

      await tx.tenderBid.updateMany({
        where: {
          tenderId: tender.id,
          companyId: company.id,
          status: "ACTIVE"
        },
        data: {
          status: "WITHDRAWN"
        }
      });
    });

    res.status(200).json({
      message: "Ihale katilimi geri cekildi.",
      item: {
        tenderId: tender.id,
        companyId: company.id
      }
    });
  })
);

companyRouter.post(
  "/tenders/bids",
  asyncHandler(async (req, res) => {
    const payload = createTenderBidSchema.parse(req.body);
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const company = await getCompanyByUserId(currentUser.id);
    await ensureCompanyCanBid(company.id);

    const tender = await getOpenTenderOpportunityForCompany(payload.tenderId, company.id);

    const participant = await prisma.tenderParticipant.findUnique({
      where: {
        tenderId_companyId: {
          tenderId: tender.id,
          companyId: company.id
        }
      }
    });
    if (!participant || participant.status !== "JOINED") {
      throw new AppError("Ihaleye teklif vermek icin once ihaleye katilmaniz gerekir.", 403);
    }

    const tenderBid = await prisma.tenderBid.upsert({
      where: {
        tenderId_companyId: {
          tenderId: tender.id,
          companyId: company.id
        }
      },
      update: {
        price: payload.price,
        deliveryDay: payload.deliveryDay,
        note: payload.note,
        status: "ACTIVE"
      },
      create: {
        tenderId: tender.id,
        companyId: company.id,
        price: payload.price,
        deliveryDay: payload.deliveryDay,
        note: payload.note,
        status: "ACTIVE"
      }
    });

    res.status(201).json({
      message: "Ihale teklifi kaydedildi.",
      item: tenderBid
    });
  })
);

companyRouter.get(
  "/tenders/bids",
  asyncHandler(async (req, res) => {
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const company = await getCompanyByUserId(currentUser.id);
    const bids = await prisma.tenderBid.findMany({
      where: { companyId: company.id },
      include: {
        tender: {
          include: {
            listing: {
              include: {
                sector: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ items: bids });
  })
);

export { companyRouter };
