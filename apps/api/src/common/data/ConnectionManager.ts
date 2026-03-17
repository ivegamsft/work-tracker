import type { PrismaClient } from "@prisma/client";
import type { TenantContext } from "./TenantContext";

/**
 * ConnectionManager — maintains a pool of database connections
 * indexed by tenant ID.
 *
 * - "shared" tenants all use the same PrismaClient (row-level isolation).
 * - "dedicated" tenants get their own PrismaClient with a separate
 *   connection string, resolved from Key Vault at first access.
 *
 * @see Decision #1 (Tiered Isolation)
 */

/** Function that resolves a secret value by name (Key Vault or mock) */
export type SecretResolver = (secretName: string) => Promise<string | undefined>;

export interface ConnectionManagerOptions {
  /** The shared PrismaClient used for all "shared" tier tenants */
  sharedClient: PrismaClient;

  /** Factory to create a new PrismaClient for a connection string */
  createClient?: (connectionString: string) => PrismaClient;

  /** Secret resolver (defaults to getKeyVaultSecret) */
  resolveSecret?: SecretResolver;
}

export class ConnectionManager {
  private sharedClient: PrismaClient;
  private dedicatedClients = new Map<string, PrismaClient>();
  private pendingConnections = new Map<string, Promise<PrismaClient>>();
  private createClient: (connectionString: string) => PrismaClient;
  private resolveSecret: SecretResolver;

  constructor(options: ConnectionManagerOptions) {
    this.sharedClient = options.sharedClient;
    this.createClient = options.createClient ?? this.defaultCreateClient;
    this.resolveSecret = options.resolveSecret ?? this.defaultResolveSecret;
  }

  /**
   * Get the appropriate PrismaClient for a tenant context.
   */
  async getClient(context: TenantContext): Promise<PrismaClient> {
    if (context.tier === "shared") {
      return this.sharedClient;
    }

    // Dedicated tier — check cache first
    const existing = this.dedicatedClients.get(context.tenantId);
    if (existing) return existing;

    // Prevent duplicate connection creation for the same tenant
    const pending = this.pendingConnections.get(context.tenantId);
    if (pending) return pending;

    const connectionPromise = this.createDedicatedClient(context.tenantId);
    this.pendingConnections.set(context.tenantId, connectionPromise);

    try {
      const client = await connectionPromise;
      this.dedicatedClients.set(context.tenantId, client);
      return client;
    } finally {
      this.pendingConnections.delete(context.tenantId);
    }
  }

  /**
   * Disconnect a specific tenant's dedicated client.
   */
  async disconnectTenant(tenantId: string): Promise<void> {
    const client = this.dedicatedClients.get(tenantId);
    if (client) {
      await client.$disconnect();
      this.dedicatedClients.delete(tenantId);
    }
  }

  /**
   * Disconnect all managed clients (shared + dedicated).
   */
  async disconnectAll(): Promise<void> {
    const disconnects = [...this.dedicatedClients.values()].map((c) =>
      c.$disconnect(),
    );
    disconnects.push(this.sharedClient.$disconnect());
    await Promise.allSettled(disconnects);
    this.dedicatedClients.clear();
  }

  /** Number of active dedicated connections */
  get dedicatedConnectionCount(): number {
    return this.dedicatedClients.size;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private async createDedicatedClient(tenantId: string): Promise<PrismaClient> {
    const secretName = `db-connection-${tenantId}`;
    const connectionString = await this.resolveSecret(secretName);

    if (!connectionString) {
      throw new Error(
        `Cannot resolve database connection for dedicated tenant "${tenantId}". ` +
          `Key Vault secret "${secretName}" not found or KEY_VAULT_URI is not set.`,
      );
    }

    return this.createClient(connectionString);
  }

  private defaultCreateClient(connectionString: string): PrismaClient {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient: PClient } = require("@prisma/client");
    return new PClient({ datasources: { db: { url: connectionString } } });
  }

  private async defaultResolveSecret(secretName: string): Promise<string | undefined> {
    const { getKeyVaultSecret } = await import("../../config/keyvault");
    return getKeyVaultSecret(secretName);
  }
}
