import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { asyncHandler } from "../utils/async-handler";

const sectorsRouter = Router();

const createSectorSchema = z.object({
  name: z.string().min(2)
});

sectorsRouter.get(
  "/",
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

sectorsRouter.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const payload = createSectorSchema.parse(req.body);
    const sector = await prisma.sector.upsert({
      where: { name: payload.name.trim() },
      update: {},
      create: { name: payload.name.trim() }
    });

    res.status(201).json({ item: sector });
  })
);

export { sectorsRouter };
