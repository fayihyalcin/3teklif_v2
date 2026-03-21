import { Company } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";

export async function ensureCompanyCanBid(companyId: string): Promise<Company> {
  const now = new Date();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      subscriptions: {
        where: {
          status: "ACTIVE",
          startsAt: { lte: now },
          endsAt: { gte: now }
        },
        take: 1
      }
    }
  });

  if (!company) {
    throw new AppError("Firma bulunamadi.", 404);
  }

  if (company.approvalStatus !== "APPROVED") {
    throw new AppError("Firma henuz admin tarafindan onaylanmadi.", 403);
  }

  const hasTrial = company.membershipType === "TRIAL" && !!company.trialEndsAt && company.trialEndsAt >= now;
  const hasActiveSubscription = company.subscriptions.length > 0;

  if (!hasTrial && !hasActiveSubscription) {
    throw new AppError("Teklif verebilmek icin aktif paket veya trial suresi gerekli.", 403);
  }

  return company;
}

export async function findEligibleCompaniesBySector(sectorId: string): Promise<Array<{ id: string }>> {
  const now = new Date();

  return prisma.company.findMany({
    where: {
      approvalStatus: "APPROVED",
      sectors: {
        some: { sectorId }
      },
      OR: [
        {
          membershipType: "TRIAL",
          trialEndsAt: { gte: now }
        },
        {
          subscriptions: {
            some: {
              status: "ACTIVE",
              startsAt: { lte: now },
              endsAt: { gte: now }
            }
          }
        }
      ]
    },
    select: { id: true }
  });
}

