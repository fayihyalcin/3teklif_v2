import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/app-error";

const adminRouter = Router();

const companyApprovalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(1000).optional()
});

const documentReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(1000).optional()
});

const createPackageSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  price: z.number().nonnegative(),
  durationDays: z.number().int().positive(),
  listingLimit: z.number().int().positive().optional(),
  bidLimit: z.number().int().positive().optional(),
  isActive: z.boolean().default(true)
});

const updatePackageSchema = z
  .object({
    name: z.string().min(2).optional(),
    price: z.number().nonnegative().optional(),
    durationDays: z.number().int().positive().optional(),
    listingLimit: z.number().int().positive().nullable().optional(),
    bidLimit: z.number().int().positive().nullable().optional(),
    isActive: z.boolean().optional()
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.price !== undefined ||
      value.durationDays !== undefined ||
      value.listingLimit !== undefined ||
      value.bidLimit !== undefined ||
      value.isActive !== undefined,
    {
      message: "En az bir alan guncellenmeli."
    }
  );

const createSubscriptionSchema = z.object({
  companyId: z.string().min(10),
  packageId: z.string().min(10),
  paymentReference: z.string().optional(),
  startsAt: z.string().datetime().optional()
});

const updateTenderStatusSchema = z.object({
  status: z.enum(["DRAFT", "OPEN", "CLOSED", "CANCELED"])
});

const updateListingStatusSchema = z.object({
  status: z.enum(["OPEN", "CLOSED", "CANCELED"])
});

const createCompetencySchema = z.object({
  name: z.string().min(2)
});

const updateSectorCompetenciesSchema = z.object({
  competencyIds: z.array(z.string().min(10)).default([])
});

const updateAccountStateSchema = z.object({
  isActive: z.boolean()
});

const freeTrialSchema = z.object({
  days: z.number().int().min(1).max(365).default(15)
});

const updateSupportMessageSchema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "ARCHIVED"])
});

const upsertSiteContentSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(2),
        value: z.unknown()
      })
    )
    .min(1)
});

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return (value === null ? Prisma.JsonNull : value) as Prisma.InputJsonValue;
}

adminRouter.use(authenticate, authorize("SUPER_ADMIN"));

adminRouter.get(
  "/catalog",
  asyncHandler(async (_req, res) => {
    const [sectors, competencies] = await Promise.all([
      prisma.sector.findMany({
        orderBy: { name: "asc" },
        include: {
          competencies: {
            include: {
              competency: true
            }
          }
        }
      }),
      prisma.competency.findMany({
        orderBy: { name: "asc" }
      })
    ]);

    res.status(200).json({
      sectors: sectors.map((sector) => ({
        id: sector.id,
        name: sector.name,
        competencies: sector.competencies
          .map((item) => ({
            id: item.competency.id,
            name: item.competency.name
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      })),
      competencies
    });
  })
);

adminRouter.post(
  "/competencies",
  asyncHandler(async (req, res) => {
    const payload = createCompetencySchema.parse(req.body);
    const normalizedName = payload.name.trim().replace(/\s+/g, " ");

    const item = await prisma.competency.upsert({
      where: { name: normalizedName },
      update: {},
      create: { name: normalizedName }
    });

    res.status(201).json({
      message: "Yetkinlik olusturuldu.",
      item
    });
  })
);

adminRouter.put(
  "/sectors/:sectorId/competencies",
  asyncHandler(async (req, res) => {
    const { sectorId } = req.params;
    const payload = updateSectorCompetenciesSchema.parse(req.body);
    const competencyIds = [...new Set(payload.competencyIds)];

    const sector = await prisma.sector.findUnique({
      where: { id: sectorId }
    });
    if (!sector) {
      throw new AppError("Kategori bulunamadi.", 404);
    }

    const competencies = competencyIds.length
      ? await prisma.competency.findMany({
          where: {
            id: { in: competencyIds }
          }
        })
      : [];

    if (competencies.length !== competencyIds.length) {
      throw new AppError("Gecersiz yetkinlik secimi.", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.sectorCompetency.deleteMany({
        where: { sectorId }
      });

      if (competencyIds.length > 0) {
        await tx.sectorCompetency.createMany({
          data: competencyIds.map((competencyId) => ({
            sectorId,
            competencyId
          }))
        });
      }
    });

    const updatedSector = await prisma.sector.findUniqueOrThrow({
      where: { id: sectorId },
      include: {
        competencies: {
          include: {
            competency: true
          }
        }
      }
    });

    res.status(200).json({
      message: "Kategori yetkinlikleri guncellendi.",
      item: {
        id: updatedSector.id,
        name: updatedSector.name,
        competencies: updatedSector.competencies
          .map((item) => ({
            id: item.competency.id,
            name: item.competency.name
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      }
    });
  })
);

adminRouter.get(
  "/companies/pending",
  asyncHandler(async (_req, res) => {
    const companies = await prisma.company.findMany({
      where: { approvalStatus: "PENDING" },
      include: {
        user: {
          select: {
            email: true,
            isActive: true,
            createdAt: true
          }
        },
        sectors: {
          include: { sector: true }
        },
        competencies: {
          include: { competency: true }
        },
        subscriptions: {
          include: { package: true },
          orderBy: { endsAt: "desc" },
          take: 1
        },
        documents: {
          orderBy: { uploadedAt: "desc" }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    res.status(200).json({ items: companies });
  })
);

adminRouter.get(
  "/companies",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const where = ["PENDING", "APPROVED", "REJECTED"].includes(status)
      ? { approvalStatus: status as "PENDING" | "APPROVED" | "REJECTED" }
      : {};

    const companies = await prisma.company.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            createdAt: true
          }
        },
        sectors: {
          include: { sector: true }
        },
        competencies: {
          include: { competency: true }
        },
        subscriptions: {
          include: { package: true },
          orderBy: { endsAt: "desc" },
          take: 3
        },
        documents: {
          orderBy: { uploadedAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ items: companies });
  })
);

adminRouter.patch(
  "/companies/:companyId/approval",
  asyncHandler(async (req, res) => {
    const payload = companyApprovalSchema.parse(req.body);
    const { companyId } = req.params;
    const currentUser = req.authUser;

    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });
    if (!company) {
      throw new AppError("Firma bulunamadi.", 404);
    }

    const now = new Date();
    const trialEndsAt = company.trialEndsAt ?? new Date(now);
    if (!company.trialEndsAt && payload.status === "APPROVED") {
      trialEndsAt.setDate(trialEndsAt.getDate() + 15);
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        approvalStatus: payload.status,
        approvalNote: payload.note,
        approvedAt: payload.status === "APPROVED" ? now : null,
        approvedByUserId: payload.status === "APPROVED" ? currentUser.id : null,
        trialEndsAt: payload.status === "APPROVED" ? trialEndsAt : company.trialEndsAt
      }
    });

    res.status(200).json({
      message: "Firma onay durumu guncellendi.",
      item: updatedCompany
    });
  })
);

adminRouter.patch(
  "/companies/:companyId/active",
  asyncHandler(async (req, res) => {
    const payload = updateAccountStateSchema.parse(req.body);
    const { companyId } = req.params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        userId: true,
        name: true
      }
    });

    if (!company) {
      throw new AppError("Firma bulunamadi.", 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id: company.userId },
      data: { isActive: payload.isActive },
      select: {
        id: true,
        isActive: true
      }
    });

    res.status(200).json({
      message: payload.isActive ? "Firma hesabi aktif edildi." : "Firma hesabi pasife alindi.",
      item: {
        companyId: company.id,
        user: updatedUser
      }
    });
  })
);

adminRouter.post(
  "/companies/:companyId/free-trial",
  asyncHandler(async (req, res) => {
    const payload = freeTrialSchema.parse(req.body);
    const { companyId } = req.params;

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });
    if (!company) {
      throw new AppError("Firma bulunamadi.", 404);
    }

    const startsAt = new Date();
    const trialEndsAt = new Date(startsAt);
    trialEndsAt.setDate(trialEndsAt.getDate() + payload.days);

    const item = await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          companyId,
          status: "ACTIVE"
        },
        data: {
          status: "EXPIRED"
        }
      });

      return tx.company.update({
        where: { id: companyId },
        data: {
          membershipType: "TRIAL",
          trialEndsAt
        }
      });
    });

    res.status(200).json({
      message: `${payload.days} gunluk ucretsiz kullanim tanimlandi.`,
      item
    });
  })
);

adminRouter.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const isActiveRaw = typeof req.query.isActive === "string" ? req.query.isActive : "";
    const whereUser =
      isActiveRaw === "true" ? { isActive: true } : isActiveRaw === "false" ? { isActive: false } : {};

    const items = await prisma.customer.findMany({
      where: {
        user: whereUser
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            listings: true,
            tenders: true
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

adminRouter.patch(
  "/customers/:customerId/active",
  asyncHandler(async (req, res) => {
    const payload = updateAccountStateSchema.parse(req.body);
    const { customerId } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        userId: true,
        fullName: true
      }
    });

    if (!customer) {
      throw new AppError("Musteri bulunamadi.", 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id: customer.userId },
      data: { isActive: payload.isActive },
      select: {
        id: true,
        isActive: true
      }
    });

    res.status(200).json({
      message: payload.isActive ? "Musteri hesabi aktif edildi." : "Musteri hesabi pasife alindi.",
      item: {
        customerId: customer.id,
        user: updatedUser
      }
    });
  })
);

adminRouter.patch(
  "/documents/:documentId/review",
  asyncHandler(async (req, res) => {
    const payload = documentReviewSchema.parse(req.body);
    const { documentId } = req.params;
    const currentUser = req.authUser;

    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const document = await prisma.companyDocument.findUnique({
      where: { id: documentId }
    });
    if (!document) {
      throw new AppError("Evrak bulunamadi.", 404);
    }

    const updatedDocument = await prisma.companyDocument.update({
      where: { id: documentId },
      data: {
        status: payload.status,
        note: payload.note,
        reviewedByUserId: currentUser.id,
        reviewedAt: new Date()
      }
    });

    res.status(200).json({
      message: "Evrak durumu guncellendi.",
      item: updatedDocument
    });
  })
);

adminRouter.get(
  "/listings",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const where = ["OPEN", "CLOSED", "CANCELED"].includes(status)
      ? { status: status as "OPEN" | "CLOSED" | "CANCELED" }
      : {};

    const items = await prisma.listing.findMany({
      where,
      include: {
        sector: true,
        customer: {
          include: {
            user: {
              select: {
                email: true,
                isActive: true
              }
            }
          }
        },
        _count: {
          select: {
            bids: true,
            matches: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ items });
  })
);

adminRouter.get(
  "/listings/:listingId",
  asyncHandler(async (req, res) => {
    const { listingId } = req.params;

    const item = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        sector: true,
        customer: {
          include: {
            user: {
              select: {
                email: true,
                isActive: true
              }
            }
          }
        },
        matches: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
                city: true,
                approvalStatus: true,
                membershipType: true,
                rating: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        bids: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
                city: true,
                approvalStatus: true,
                membershipType: true,
                rating: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!item) {
      throw new AppError("Ilan bulunamadi.", 404);
    }

    res.status(200).json({ item });
  })
);

adminRouter.patch(
  "/listings/:listingId/status",
  asyncHandler(async (req, res) => {
    const payload = updateListingStatusSchema.parse(req.body);
    const { listingId } = req.params;

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true }
    });

    if (!listing) {
      throw new AppError("Ilan bulunamadi.", 404);
    }

    const item = await prisma.listing.update({
      where: { id: listingId },
      data: { status: payload.status }
    });

    res.status(200).json({
      message: "Ilan durumu guncellendi.",
      item
    });
  })
);

adminRouter.get(
  "/tenders",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const where = ["DRAFT", "OPEN", "CLOSED", "CANCELED"].includes(status)
      ? { status: status as "DRAFT" | "OPEN" | "CLOSED" | "CANCELED" }
      : {};

    const items = await prisma.tender.findMany({
      where,
      include: {
        listing: {
          include: {
            sector: true,
            customer: {
              include: {
                user: {
                  select: {
                    email: true,
                    isActive: true
                  }
                }
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
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json({ items });
  })
);

adminRouter.get(
  "/tenders/:tenderId",
  asyncHandler(async (req, res) => {
    const { tenderId } = req.params;

    const item = await prisma.tender.findUnique({
      where: { id: tenderId },
      include: {
        listing: {
          include: {
            sector: true,
            customer: {
              include: {
                user: {
                  select: {
                    email: true,
                    isActive: true
                  }
                }
              }
            }
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
          orderBy: {
            joinedAt: "desc"
          }
        },
        bids: {
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
          orderBy: {
            createdAt: "desc"
          }
        },
        _count: {
          select: {
            bids: true,
            participants: true
          }
        }
      }
    });

    if (!item) {
      throw new AppError("Ihale bulunamadi.", 404);
    }

    res.status(200).json({ item });
  })
);

adminRouter.patch(
  "/tenders/:tenderId/status",
  asyncHandler(async (req, res) => {
    const { tenderId } = req.params;
    const payload = updateTenderStatusSchema.parse(req.body);

    const tender = await prisma.tender.findUnique({
      where: { id: tenderId }
    });
    if (!tender) {
      throw new AppError("Ihale bulunamadi.", 404);
    }

    const updatedTender = await prisma.tender.update({
      where: { id: tenderId },
      data: { status: payload.status }
    });

    res.status(200).json({
      message: "Ihale durumu guncellendi.",
      item: updatedTender
    });
  })
);

adminRouter.post(
  "/packages",
  asyncHandler(async (req, res) => {
    const payload = createPackageSchema.parse(req.body);

    const item = await prisma.package.create({
      data: {
        code: payload.code,
        name: payload.name,
        price: payload.price,
        durationDays: payload.durationDays,
        listingLimit: payload.listingLimit,
        bidLimit: payload.bidLimit,
        isActive: payload.isActive
      }
    });

    res.status(201).json({
      message: "Paket olusturuldu.",
      item
    });
  })
);

adminRouter.get(
  "/packages",
  asyncHandler(async (_req, res) => {
    const items = await prisma.package.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.status(200).json({ items });
  })
);

adminRouter.patch(
  "/packages/:packageId",
  asyncHandler(async (req, res) => {
    const payload = updatePackageSchema.parse(req.body);
    const { packageId } = req.params;

    const existingPackage = await prisma.package.findUnique({ where: { id: packageId } });
    if (!existingPackage) {
      throw new AppError("Paket bulunamadi.", 404);
    }

    const item = await prisma.package.update({
      where: { id: packageId },
      data: {
        name: payload.name,
        price: payload.price,
        durationDays: payload.durationDays,
        listingLimit: payload.listingLimit === undefined ? undefined : payload.listingLimit,
        bidLimit: payload.bidLimit === undefined ? undefined : payload.bidLimit,
        isActive: payload.isActive
      }
    });

    res.status(200).json({
      message: "Paket guncellendi.",
      item
    });
  })
);

adminRouter.post(
  "/subscriptions",
  asyncHandler(async (req, res) => {
    const payload = createSubscriptionSchema.parse(req.body);
    const startsAt = payload.startsAt ? new Date(payload.startsAt) : new Date();

    const selectedPackage = await prisma.package.findUnique({
      where: { id: payload.packageId }
    });
    if (!selectedPackage || !selectedPackage.isActive) {
      throw new AppError("Paket bulunamadi veya pasif.", 404);
    }

    const company = await prisma.company.findUnique({
      where: { id: payload.companyId }
    });
    if (!company) {
      throw new AppError("Firma bulunamadi.", 404);
    }

    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + selectedPackage.durationDays);

    const subscription = await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          companyId: company.id,
          status: "ACTIVE"
        },
        data: {
          status: "EXPIRED"
        }
      });

      const createdSubscription = await tx.subscription.create({
        data: {
          companyId: company.id,
          packageId: selectedPackage.id,
          membershipType: "PLUS",
          startsAt,
          endsAt,
          status: "ACTIVE",
          paymentReference: payload.paymentReference
        }
      });

      await tx.company.update({
        where: { id: company.id },
        data: {
          membershipType: "PLUS"
        }
      });

      return createdSubscription;
    });

    res.status(201).json({
      message: "Abonelik tanimlandi.",
      item: subscription
    });
  })
);

adminRouter.get(
  "/support-messages",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const where = ["NEW", "IN_PROGRESS", "RESOLVED", "ARCHIVED"].includes(status)
      ? { status: status as "NEW" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED" }
      : {};

    const items = await prisma.supportMessage.findMany({
      where,
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

adminRouter.patch(
  "/support-messages/:messageId",
  asyncHandler(async (req, res) => {
    const payload = updateSupportMessageSchema.parse(req.body);
    const { messageId } = req.params;
    const currentUser = req.authUser;

    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const existingMessage = await prisma.supportMessage.findUnique({
      where: { id: messageId }
    });
    if (!existingMessage) {
      throw new AppError("Destek mesaji bulunamadi.", 404);
    }

    const item = await prisma.supportMessage.update({
      where: { id: messageId },
      data: {
        status: payload.status,
        handledByUserId: currentUser.id
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

    res.status(200).json({
      message: "Destek mesaji durumu guncellendi.",
      item
    });
  })
);

adminRouter.get(
  "/site-content",
  asyncHandler(async (req, res) => {
    const key = typeof req.query.key === "string" ? req.query.key.trim() : "";
    const where = key ? { key } : {};

    const items = await prisma.siteContentSetting.findMany({
      where,
      include: {
        updatedByUser: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: {
        key: "asc"
      }
    });

    res.status(200).json({
      items: items.map((item) => ({
        id: item.id,
        key: item.key,
        value: item.value,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        updatedByUser: item.updatedByUser
      }))
    });
  })
);

adminRouter.put(
  "/site-content",
  asyncHandler(async (req, res) => {
    const payload = upsertSiteContentSchema.parse(req.body);
    const currentUser = req.authUser;

    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const items = await prisma.$transaction(
      payload.items.map((entry) =>
        prisma.siteContentSetting.upsert({
          where: {
            key: entry.key.trim()
          },
          update: {
            value: toInputJsonValue(entry.value),
            updatedByUserId: currentUser.id
          },
          create: {
            key: entry.key.trim(),
            value: toInputJsonValue(entry.value),
            updatedByUserId: currentUser.id
          }
        })
      )
    );

    res.status(200).json({
      message: "Site icerik ayarlari guncellendi.",
      items
    });
  })
);

adminRouter.delete(
  "/site-content/:key",
  asyncHandler(async (req, res) => {
    const { key } = req.params;

    const existing = await prisma.siteContentSetting.findUnique({
      where: { key }
    });

    if (!existing) {
      throw new AppError("Icerik anahtari bulunamadi.", 404);
    }

    await prisma.siteContentSetting.delete({
      where: { key }
    });

    res.status(200).json({
      message: "Icerik ayari silindi.",
      item: {
        key
      }
    });
  })
);

adminRouter.get(
  "/dashboard/stats",
  asyncHandler(async (_req, res) => {
    const [
      pendingCompanies,
      approvedCompanies,
      totalCompanies,
      totalCustomers,
      openListings,
      openTenders,
      totalBids,
      totalTenderBids,
      pendingSupportMessages
    ] = await Promise.all([
      prisma.company.count({ where: { approvalStatus: "PENDING" } }),
      prisma.company.count({ where: { approvalStatus: "APPROVED" } }),
      prisma.company.count(),
      prisma.customer.count(),
      prisma.listing.count({ where: { status: "OPEN" } }),
      prisma.tender.count({ where: { status: "OPEN" } }),
      prisma.bid.count(),
      prisma.tenderBid.count(),
      prisma.supportMessage.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } })
    ]);

    res.status(200).json({
      pendingCompanies,
      approvedCompanies,
      totalCompanies,
      totalCustomers,
      openListings,
      openTenders,
      totalBids,
      totalTenderBids,
      pendingSupportMessages
    });
  })
);

export { adminRouter };





