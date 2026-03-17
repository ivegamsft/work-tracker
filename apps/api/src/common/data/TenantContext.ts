/**
 * Tenant context — extracted from JWT claims or request headers.
 *
 * Used by TenantResolver to determine which database connection
 * (shared vs dedicated) to use for a request.
 *
 * @see Decision #1 (Tiered Data Isolation)
 * @see Decision #11 (Logical Partition Environments)
 */

export type TenantTier = "shared" | "dedicated";

export interface TenantContext {
  /** Unique tenant identifier (from JWT `tenant_id` claim or X-Tenant-ID header) */
  tenantId: string;

  /** Data isolation tier — "shared" uses row-level isolation, "dedicated" uses separate DB */
  tier: TenantTier;

  /** Optional environment partition (dev, staging, prod) */
  environmentId?: string;

  /** Optional region hint for data residency routing */
  region?: string;
}

export interface TenantConfig {
  tenantId: string;
  tier: TenantTier;
  connectionStringSecretName?: string;
  region?: string;
}
