import dotenv from "dotenv";
import { z } from "zod";
import { bootstrapKeyVaultSecrets } from "./keyvault";

dotenv.config({ quiet: true });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  KEY_VAULT_URI: z.string().url().optional(),
  DATABASE_URL: z.string().url().optional(),
  DATABASE_URL_SECRET_NAME: z.string().optional(),

  JWT_SECRET: z.string().min(1),
  JWT_SECRET_SECRET_NAME: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default("1h"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  OAUTH_CLIENT_ID: z.string().optional(),
  OAUTH_CLIENT_SECRET: z.string().optional(),
  OAUTH_REDIRECT_URI: z.string().url().optional(),

  DOCUMENT_PROCESSOR: z.enum(["aws-textract", "google-vision", "azure-form-recognizer"]).default("aws-textract"),

  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

type Env = z.infer<typeof envSchema>;

function parseEnv(source: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

let envState: Env | undefined = process.env.KEY_VAULT_URI ? undefined : parseEnv(process.env);
let envPromise: Promise<Env> | undefined;

export async function loadEnv() {
  if (envState) {
    return envState;
  }

  if (!envPromise) {
    envPromise = (async () => {
      const keyVaultSecrets = await bootstrapKeyVaultSecrets();

      for (const [key, value] of Object.entries(keyVaultSecrets)) {
        if (value && !process.env[key]) {
          process.env[key] = value;
        }
      }

      envState = parseEnv(process.env);
      return envState;
    })();
  }

  return envPromise;
}

export const env = new Proxy({} as Env, {
  get(_target, property) {
    if (!envState) {
      throw new Error("Environment not initialized. Call loadEnv() before accessing env when KEY_VAULT_URI is set.");
    }

    return envState[property as keyof Env];
  },
});

export type { Env };
