declare module "@azure/keyvault-secrets" {
  export interface KeyVaultSecret {
    value?: string;
  }

  export class SecretClient {
    constructor(vaultUrl: string, credential: unknown);
    getSecret(secretName: string): Promise<KeyVaultSecret>;
  }
}
