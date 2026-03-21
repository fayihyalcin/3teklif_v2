import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/token";
import { AppError } from "../utils/app-error";

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.header("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new AppError("Yetkisiz istek.", 401));
    return;
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    const payload = verifyAccessToken(token);
    req.authUser = {
      id: payload.sub,
      role: payload.role
    };
    next();
  } catch (_error) {
    next(new AppError("Gecersiz veya suresi dolmus token.", 401));
  }
}

