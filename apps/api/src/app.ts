import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { companyRouter } from "./routes/company";
import { customerRouter } from "./routes/customer";
import { healthRouter } from "./routes/health";
import { errorHandler, notFound } from "./middleware/error";
import { publicRouter } from "./routes/public";
import { sectorsRouter } from "./routes/sectors";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.use("/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/public", publicRouter);
app.use("/api/sectors", sectorsRouter);
app.use("/api/customer", customerRouter);
app.use("/api/company", companyRouter);
app.use("/api/admin", adminRouter);

app.use(notFound);
app.use(errorHandler);

export { app };
