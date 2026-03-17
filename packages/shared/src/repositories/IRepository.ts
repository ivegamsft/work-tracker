/**
 * Generic repository interface — the core data access abstraction for E-CLAT.
 *
 * Services depend on IRepository<T>, never on a concrete ORM or driver.
 * Concrete adapters (Prisma, Cosmos, Blob, Redis) implement this interface.
 *
 * @see docs/specs/data-layer-api.md — Section 3.1
 * @see Decision #1 (Tiered Isolation), Decision #3 (Modular Monolith)
 */

// ---------------------------------------------------------------------------
// Filter & query types
// ---------------------------------------------------------------------------

/** Comparison operators for filter values */
export type FilterOperator<V> =
  | V
  | { $in: V[] }
  | { $nin: V[] }
  | { $gt: V }
  | { $gte: V }
  | { $lt: V }
  | { $lte: V }
  | { $ne: V }
  | { $like: string };

/** Per-field filter using comparison operators */
export type Filter<T> = {
  [K in keyof T]?: FilterOperator<T[K]>;
} & {
  $and?: Filter<T>[];
  $or?: Filter<T>[];
};

/** Pagination, sorting, and relation-loading options */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  sort?: Record<string, "asc" | "desc">;
  include?: string[];
}

/** Standard paginated result envelope */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------

export interface ITransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Repository schema metadata
// ---------------------------------------------------------------------------

export interface FieldMeta {
  type: string;
  nullable: boolean;
  unique: boolean;
}

export interface RepositorySchema {
  name: string;
  fields: Record<string, FieldMeta>;
}

// ---------------------------------------------------------------------------
// Repository capabilities (for feature detection at runtime)
// ---------------------------------------------------------------------------

export type RepositoryCapability =
  | "transactions"
  | "batch"
  | "softDelete"
  | "fullTextSearch"
  | "blobStorage"
  | "ttl";

// ---------------------------------------------------------------------------
// IRepository<T> — the primary abstraction
// ---------------------------------------------------------------------------

export interface IRepository<T> {
  // --- CRUD ---
  create(data: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findMany(filter: Filter<T>, options?: QueryOptions): Promise<T[]>;
  findUnique(filter: Filter<T>): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string, soft?: boolean): Promise<void>;

  // --- Batch ---
  createMany(data: Partial<T>[]): Promise<T[]>;
  updateMany(filter: Filter<T>, data: Partial<T>): Promise<number>;
  deleteMany(filter: Filter<T>, soft?: boolean): Promise<number>;

  // --- Counting ---
  count(filter: Filter<T>): Promise<number>;

  // --- Transactions ---
  beginTransaction(): Promise<ITransaction>;

  // --- Metadata ---
  getSchema(): RepositorySchema;
  supports(capability: RepositoryCapability): boolean;
}
