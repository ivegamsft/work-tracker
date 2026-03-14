import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

const secretCache = new Map<string, string>();
const clientCache = new Map<string, SecretClient>();
let credential: DefaultAzureCredential | undefined;

function getSecretClient(keyVaultUri: string) {
  let client = clientCache.get(keyVaultUri);
  if (!client) {
    credential ??= new DefaultAzureCredential();
    client = new SecretClient(keyVaultUri, credential);
    clientCache.set(keyVaultUri, client);
  }

  return client;
}

export async function getKeyVaultSecret(secretName: string): Promise<string | undefined> {
  const keyVaultUri = process.env.KEY_VAULT_URI;
  if (!keyVaultUri || !secretName) {
    return undefined;
  }

  const cacheKey = `${keyVaultUri}:${secretName}`;
  const cachedValue = secretCache.get(cacheKey);
  if (cachedValue) {
    return cachedValue;
  }

  const secret = await getSecretClient(keyVaultUri).getSecret(secretName);
  if (!secret.value) {
    throw new Error(`Key Vault secret "${secretName}" has no value.`);
  }

  secretCache.set(cacheKey, secret.value);
  return secret.value;
}

export async function bootstrapKeyVaultSecrets() {
  if (!process.env.KEY_VAULT_URI) {
    return {} as Partial<Record<"DATABASE_URL" | "JWT_SECRET", string>>;
  }

  const secrets: Partial<Record<"DATABASE_URL" | "JWT_SECRET", string>> = {};

  if (!process.env.DATABASE_URL && process.env.DATABASE_URL_SECRET_NAME) {
    const databaseUrl = await getKeyVaultSecret(process.env.DATABASE_URL_SECRET_NAME);
    if (databaseUrl) {
      secrets.DATABASE_URL = databaseUrl;
    }
  }

  if (!process.env.JWT_SECRET && process.env.JWT_SECRET_SECRET_NAME) {
    const jwtSecret = await getKeyVaultSecret(process.env.JWT_SECRET_SECRET_NAME);
    if (jwtSecret) {
      secrets.JWT_SECRET = jwtSecret;
    }
  }

  return secrets;
}
