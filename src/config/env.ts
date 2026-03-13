import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  DATABASE_URL: z.string().url().optional(),

  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default("1h"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  OAUTH_CLIENT_ID: z.string().optional(),
  OAUTH_CLIENT_SECRET: z.string().optional(),
  OAUTH_REDIRECT_URI: z.string().url().optional(),

  DOCUMENT_PROCESSOR: z.enum(["aws-textract", "google-vision", "azure-form-recognizer"]).default("aws-textract"),

  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
