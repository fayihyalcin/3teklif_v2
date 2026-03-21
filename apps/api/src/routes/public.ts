import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/async-handler";

const publicRouter = Router();

const createSupportMessageSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6).max(40).optional(),
  subject: z.string().min(2).max(140).optional(),
  message: z.string().min(8).max(4000)
});

publicRouter.get(
  "/site-content",
  asyncHandler(async (req, res) => {
    const key = typeof req.query.key === "string" ? req.query.key.trim() : "";
    const keysRaw = typeof req.query.keys === "string" ? req.query.keys : "";
    const keys = keysRaw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (key) {
      const item = await prisma.siteContentSetting.findUnique({
        where: { key }
      });
      res.status(200).json({
        item: item
          ? {
              key: item.key,
              value: item.value,
              updatedAt: item.updatedAt
            }
          : null
      });
      return;
    }

    const where = keys.length > 0 ? { key: { in: keys } } : {};
    const items = await prisma.siteContentSetting.findMany({
      where,
      orderBy: { key: "asc" }
    });

    res.status(200).json({
      items: items.map((item) => ({
        key: item.key,
        value: item.value,
        updatedAt: item.updatedAt
      }))
    });
  })
);

publicRouter.get(
  "/site-content/:key",
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const item = await prisma.siteContentSetting.findUnique({
      where: { key }
    });

    res.status(200).json({
      item: item
        ? {
            key: item.key,
            value: item.value,
            updatedAt: item.updatedAt
          }
        : null
    });
  })
);

publicRouter.post(
  "/support-messages",
  asyncHandler(async (req, res) => {
    const payload = createSupportMessageSchema.parse(req.body);

    const item = await prisma.supportMessage.create({
      data: {
        name: payload.name.trim(),
        email: payload.email.toLowerCase().trim(),
        phone: payload.phone?.trim(),
        subject: payload.subject?.trim(),
        message: payload.message.trim(),
        status: "NEW"
      }
    });

    res.status(201).json({
      message: "Destek talebiniz alindi. En kisa surede donus saglanacaktir.",
      item: {
        id: item.id,
        status: item.status
      }
    });
  })
);

export { publicRouter };
