import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  ADMIN_BOOTSTRAP_KEY: z.string().min(8).default("change_this_key"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Environment variables are invalid.");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
