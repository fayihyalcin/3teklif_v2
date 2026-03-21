import { UserRole } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";

export function authorize(...roles: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const currentUser = req.authUser;

    if (!currentUser) {
      next(new AppError("Yetkisiz istek.", 401));
      return;
    }

    if (!roles.includes(currentUser.role)) {
      const needsCustomerAccess = roles.includes("CUSTOMER");
      const needsCompanyAccess = roles.includes("COMPANY");

      if (!needsCustomerAccess && !needsCompanyAccess) {
        next(new AppError("Bu islem icin yetkiniz yok.", 403));
        return;
      }

      try {
        const user = await prisma.user.findUnique({
          where: { id: currentUser.id },
          select: {
            id: true,
            customer: {
              select: {
                id: true
              }
            },
            company: {
              select: {
                id: true
              }
            }
          }
        });

        if (!user) {
          next(new AppError("Kullanici bulunamadi.", 404));
          return;
        }

        const canAccessByCustomerProfile = needsCustomerAccess && !!user.customer;
        const canAccessByCompanyProfile = needsCompanyAccess && !!user.company;

        if (!canAccessByCustomerProfile && !canAccessByCompanyProfile) {
          next(new AppError("Bu islem icin yetkiniz yok.", 403));
          return;
        }
      } catch (error) {
        next(error);
        return;
      }
    }

    next();
  };
}
