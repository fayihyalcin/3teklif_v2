import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { signAccessToken } from "../lib/token";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/app-error";

const authRouter = Router();

const registerCustomerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  city: z.string().optional()
});

const registerCompanySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
  taxNumber: z.string().optional(),
  city: z.string().optional(),
  sectors: z.array(z.string().min(2)).default([])
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const bootstrapAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  bootstrapKey: z.string().min(8)
});

const createCustomerProfileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional(),
  city: z.string().optional()
});

const createCompanyProfileSchema = z.object({
  companyName: z.string().min(2),
  taxNumber: z.string().optional(),
  city: z.string().optional(),
  sectors: z.array(z.string().min(2)).default([])
});

function normalizeSectorName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function toAuthUserResponse(user: {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "COMPANY" | "CUSTOMER";
  customer: null | { id: string; fullName: string; city: string | null };
  company:
    | null
    | {
        id: string;
        name: string;
        city: string | null;
        approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
        membershipType: "TRIAL" | "PLUS";
        trialEndsAt: Date | null;
        sectors: Array<{ sector: { id: string; name: string } }>;
        competencies: Array<{ competency: { id: string; name: string } }>;
      };
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    customer: user.customer
      ? {
          id: user.customer.id,
          fullName: user.customer.fullName,
          city: user.customer.city
        }
      : null,
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
          city: user.company.city,
          approvalStatus: user.company.approvalStatus,
          membershipType: user.company.membershipType,
          trialEndsAt: user.company.trialEndsAt,
          sectors: user.company.sectors.map((item) => ({
            id: item.sector.id,
            name: item.sector.name
          })),
          competencies: user.company.competencies.map((item) => ({
            id: item.competency.id,
            name: item.competency.name
          }))
        }
      : null
  };
}

async function findAuthUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      customer: true,
      company: {
        include: {
          sectors: {
            include: { sector: true }
          },
          competencies: {
            include: { competency: true }
          }
        }
      }
    }
  });
}

authRouter.post(
  "/register/customer",
  asyncHandler(async (req, res) => {
    const payload = registerCustomerSchema.parse(req.body);
    const normalizedEmail = payload.email.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        customer: true,
        company: {
          include: {
            sectors: {
              include: { sector: true }
            },
            competencies: {
              include: { competency: true }
            }
          }
        }
      }
    });

    let user = existingUser;

    if (existingUser) {
      const isPasswordValid = await bcrypt.compare(payload.password, existingUser.passwordHash);
      if (!isPasswordValid) {
        throw new AppError("Bu e-posta başka bir hesapta kullanılıyor.", 409);
      }
      if (existingUser.customer) {
        throw new AppError("Bu hesapta zaten müşteri profili var.", 409);
      }

      await prisma.customer.create({
        data: {
          userId: existingUser.id,
          fullName: payload.fullName,
          phone: payload.phone,
          city: payload.city
        }
      });

      user = await findAuthUserById(existingUser.id);
      if (!user) {
        throw new AppError("Kullanici bulunamadi.", 404);
      }
    } else {
      const passwordHash = await bcrypt.hash(payload.password, 10);
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role: "CUSTOMER",
          customer: {
            create: {
              fullName: payload.fullName,
              phone: payload.phone,
              city: payload.city
            }
          }
        },
        include: {
          customer: true,
          company: {
            include: {
              sectors: {
                include: { sector: true }
              },
              competencies: {
                include: { competency: true }
              }
            }
          }
        }
      });
    }

    const token = signAccessToken({ sub: user.id, role: user.role });
    res.status(201).json({
      message: existingUser ? "Mevcut hesaba musteri profili eklendi." : "Musteri kaydi basarili.",
      token,
      user: toAuthUserResponse(user)
    });
  })
);

authRouter.post(
  "/register/company",
  asyncHandler(async (req, res) => {
    const payload = registerCompanySchema.parse(req.body);
    const normalizedEmail = payload.email.toLowerCase();
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 15);

    const normalizedSectors = [...new Set(payload.sectors.map(normalizeSectorName).filter(Boolean))];
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        customer: true,
        company: true
      }
    });

    const createdUser = await prisma.$transaction(async (tx) => {
      let userId = "";
      let companyId = "";

      if (existingUser) {
        const isPasswordValid = await bcrypt.compare(payload.password, existingUser.passwordHash);
        if (!isPasswordValid) {
          throw new AppError("Bu e-posta başka bir hesapta kullanılıyor.", 409);
        }
        if (existingUser.company) {
          throw new AppError("Bu hesapta zaten firma profili var.", 409);
        }

        const company = await tx.company.create({
          data: {
            userId: existingUser.id,
            name: payload.companyName,
            taxNumber: payload.taxNumber,
            city: payload.city,
            membershipType: "TRIAL",
            trialEndsAt,
            approvalStatus: "PENDING"
          }
        });
        userId = existingUser.id;
        companyId = company.id;
      } else {
        const passwordHash = await bcrypt.hash(payload.password, 10);
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            role: "COMPANY",
            company: {
              create: {
                name: payload.companyName,
                taxNumber: payload.taxNumber,
                city: payload.city,
                membershipType: "TRIAL",
                trialEndsAt,
                approvalStatus: "PENDING"
              }
            }
          },
          include: {
            company: true
          }
        });

        if (!user.company) {
          throw new AppError("Firma olusturulamadi.", 500);
        }
        userId = user.id;
        companyId = user.company.id;
      }

      if (normalizedSectors.length > 0) {
        const existingSectors = await tx.sector.findMany({
          where: {
            name: {
              in: normalizedSectors
            }
          }
        });

        if (existingSectors.length !== normalizedSectors.length) {
          throw new AppError("Secilen kategoriler admin tarafindan tanimli degil.", 400);
        }

        await tx.companySector.createMany({
          data: existingSectors.map((sector) => ({
            companyId,
            sectorId: sector.id
          }))
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
          customer: true,
          company: {
            include: {
              sectors: {
                include: { sector: true }
              },
              competencies: {
                include: { competency: true }
              }
            }
          }
        }
      });
    });

    const token = signAccessToken({ sub: createdUser.id, role: createdUser.role });
    res.status(201).json({
      message: existingUser
        ? "Mevcut hesaba firma profili eklendi. Evrak ve admin onayi sonrasi teklif verebilirsiniz."
        : "Firma kaydi alindi. Evrak ve admin onayi sonrasi teklif verebilirsiniz.",
      token,
      user: toAuthUserResponse(createdUser)
    });
  })
);

authRouter.post(
  "/bootstrap-admin",
  asyncHandler(async (req, res) => {
    const payload = bootstrapAdminSchema.parse(req.body);

    if (payload.bootstrapKey !== env.ADMIN_BOOTSTRAP_KEY) {
      throw new AppError("Admin bootstrap key hatali.", 403);
    }

    const existingAdmin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" }
    });
    if (existingAdmin) {
      throw new AppError("Super admin zaten olusturulmus.", 409);
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const admin = await prisma.user.create({
      data: {
        email: payload.email.toLowerCase(),
        passwordHash,
        role: "SUPER_ADMIN"
      },
      include: {
        customer: true,
        company: {
          include: {
            sectors: {
              include: { sector: true }
            },
            competencies: {
              include: { competency: true }
            }
          }
        }
      }
    });

    const token = signAccessToken({ sub: admin.id, role: admin.role });
    res.status(201).json({
      message: "Super admin hesabi olusturuldu.",
      token,
      user: toAuthUserResponse(admin)
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
      include: {
        customer: true,
        company: {
          include: {
            sectors: {
              include: { sector: true }
            },
            competencies: {
              include: { competency: true }
            }
          }
        }
      }
    });

    if (!user) {
      throw new AppError("E-posta veya sifre hatali.", 401);
    }

    const isPasswordValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError("E-posta veya sifre hatali.", 401);
    }

    if (!user.isActive) {
      throw new AppError("Hesap pasif durumda.", 403);
    }

    const token = signAccessToken({ sub: user.id, role: user.role });
    res.status(200).json({
      message: "Giris basarili.",
      token,
      user: toAuthUserResponse(user)
    });
  })
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: {
        customer: true,
        company: {
          include: {
            sectors: {
              include: { sector: true }
            },
            competencies: {
              include: { competency: true }
            }
          }
        }
      }
    });
    if (!user) {
      throw new AppError("Kullanici bulunamadi.", 404);
    }

    res.status(200).json({
      user: toAuthUserResponse(user)
    });
  })
);

authRouter.post(
  "/profiles/customer",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = createCustomerProfileSchema.parse(req.body);
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const user = await findAuthUserById(currentUser.id);
    if (!user) {
      throw new AppError("Kullanici bulunamadi.", 404);
    }
    if (user.customer) {
      throw new AppError("Bu hesapta zaten musteri profili var.", 409);
    }

    await prisma.customer.create({
      data: {
        userId: user.id,
        fullName: payload.fullName,
        phone: payload.phone,
        city: payload.city
      }
    });

    const updatedUser = await findAuthUserById(user.id);
    if (!updatedUser) {
      throw new AppError("Kullanici bulunamadi.", 404);
    }

    res.status(201).json({
      message: "Musteri profili olusturuldu.",
      user: toAuthUserResponse(updatedUser)
    });
  })
);

authRouter.post(
  "/profiles/company",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = createCompanyProfileSchema.parse(req.body);
    const currentUser = req.authUser;
    if (!currentUser) {
      throw new AppError("Yetkisiz istek.", 401);
    }

    const user = await findAuthUserById(currentUser.id);
    if (!user) {
      throw new AppError("Kullanici bulunamadi.", 404);
    }
    if (user.company) {
      throw new AppError("Bu hesapta zaten firma profili var.", 409);
    }

    const normalizedSectors = [...new Set(payload.sectors.map(normalizeSectorName).filter(Boolean))];
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 15);

    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          userId: user.id,
          name: payload.companyName,
          taxNumber: payload.taxNumber,
          city: payload.city,
          membershipType: "TRIAL",
          trialEndsAt,
          approvalStatus: "PENDING"
        }
      });

      if (normalizedSectors.length > 0) {
        const existingSectors = await tx.sector.findMany({
          where: {
            name: {
              in: normalizedSectors
            }
          }
        });

        if (existingSectors.length !== normalizedSectors.length) {
          throw new AppError("Secilen kategoriler admin tarafindan tanimli degil.", 400);
        }

        await tx.companySector.createMany({
          data: existingSectors.map((sector) => ({
            companyId: company.id,
            sectorId: sector.id
          }))
        });
      }
    });

    const updatedUser = await findAuthUserById(user.id);
    if (!updatedUser) {
      throw new AppError("Kullanici bulunamadi.", 404);
    }

    res.status(201).json({
      message: "Firma profili olusturuldu.",
      user: toAuthUserResponse(updatedUser)
    });
  })
);

export { authRouter };
