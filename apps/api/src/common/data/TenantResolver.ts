import type { Request } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth";
import type { TenantContext, TenantConfig, TenantTier } from "./TenantContext";

/**
 * TenantResolver — extracts tenant context from the current request.
 *
 * Resolution order:
 *   1. JWT claim `tenant_id` (from authenticated user token)
 *   2. Request header `X-Tenant-ID`
 *   3. Default tenant (for single-tenant / MVP deployments)
 *
 * Once resolved, the context is attached to the request for downstream use.
 *
 * @see Decision #1 (Tiered Isolation — shared vs dedicated)
 * @see docs/specs/data-layer-api.md — Section 5
 */

export const DEFAULT_TENANT_ID = "default";
const DEFAULT_TIER: TenantTier = "shared";

export interface TenantLookup {
  getTenantConfig(tenantId: string): Promise<TenantConfig | null>;
}

/**
 * In-memory tenant lookup for development / single-tenant mode.
 * Production will resolve against a tenant registry (database or config service).
 */
export class StaticTenantLookup implements TenantLookup {
  private configs = new Map<string, TenantConfig>();

  constructor(configs: TenantConfig[] = []) {
    for (const config of configs) {
      this.configs.set(config.tenantId, config);
    }
  }

  async getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
    return this.configs.get(tenantId) ?? null;
  }

  /** Register a tenant at runtime (useful for tests) */
  register(config: TenantConfig): void {
    this.configs.set(config.tenantId, config);
  }
}

export class TenantResolver {
  constructor(private readonly lookup: TenantLookup) {}

  /**
   * Extract tenant context from the incoming request.
   */
  async resolve(req: Request): Promise<TenantContext> {
    const tenantId = this.extractTenantId(req);
    const config = await this.lookup.getTenantConfig(tenantId);

    return {
      tenantId,
      tier: config?.tier ?? DEFAULT_TIER,
      environmentId: this.extractEnvironmentId(req),
      region: config?.region,
    };
  }

  /**
   * Extract the tenant ID from JWT or header, falling back to default.
   */
  private extractTenantId(req: Request): string {
    // 1. JWT claim
    const authReq = req as AuthenticatedRequest;
    const jwtTenantId = (authReq.user as Record<string, unknown> | undefined)?.tenant_id;
    if (typeof jwtTenantId === "string" && jwtTenantId.length > 0) {
      return jwtTenantId;
    }

    // 2. Request header
    const headerTenantId = req.headers["x-tenant-id"];
    if (typeof headerTenantId === "string" && headerTenantId.length > 0) {
      return headerTenantId;
    }

    // 3. Default
    return DEFAULT_TENANT_ID;
  }

  /**
   * Extract environment ID for logical partition support (Decision #11).
   */
  private extractEnvironmentId(req: Request): string | undefined {
    const envHeader = req.headers["x-environment-id"];
    if (typeof envHeader === "string" && envHeader.length > 0) {
      return envHeader;
    }
    return process.env.ENVIRONMENT_ID ?? undefined;
  }
}
