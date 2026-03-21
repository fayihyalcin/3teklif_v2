import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "uc-teklif-api",
    uptimeSeconds: Math.round(process.uptime())
  });
});

export { healthRouter };

