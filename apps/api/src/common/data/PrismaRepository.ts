import type { PrismaClient } from "@prisma/client";
import type {
  IRepository,
  ITransaction,
  Filter,
  QueryOptions,
  RepositorySchema,
  RepositoryCapability,
  FieldMeta,
} from "@e-clat/shared";

/**
 * Prisma-backed implementation of IRepository<T>.
 *
 * This is the default (and only MVP) adapter. Services never import this
 * directly — they depend on IRepository<T> and receive a PrismaRepository
 * instance via the RepositoryFactory.
 *
 * @see docs/specs/data-layer-api.md — Section 4.1
 */
export class PrismaRepository<T> implements IRepository<T> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly modelName: string,
  ) {}

  // -----------------------------------------------------------------------
  // Internal helper — get the Prisma delegate for this.modelName
  // -----------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get model(): any {
    const delegate = (this.prisma as unknown as Record<string, unknown>)[this.modelName];
    if (!delegate) {
      throw new Error(
        `Prisma model "${this.modelName}" not found. ` +
          `Check that the model name matches a Prisma schema model (camelCase).`,
      );
    }
    return delegate;
  }

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------

  async create(data: Partial<T>): Promise<T> {
    return this.model.create({ data }) as Promise<T>;
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id } }) as Promise<T | null>;
  }

  async findMany(filter: Filter<T>, options?: QueryOptions): Promise<T[]> {
    return this.model.findMany({
      where: this.translateFilter(filter),
      take: options?.limit,
      skip: options?.offset,
      orderBy: options?.sort ? this.translateSort(options.sort) : undefined,
      include: options?.include ? this.buildInclude(options.include) : undefined,
    }) as Promise<T[]>;
  }

  async findUnique(filter: Filter<T>): Promise<T | null> {
    const results = await this.findMany(filter, { limit: 1 });
    return results[0] ?? null;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    return this.model.update({ where: { id }, data }) as Promise<T>;
  }

  async delete(id: string, soft = true): Promise<void> {
    if (soft) {
      await this.model.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } else {
      await this.model.delete({ where: { id } });
    }
  }

  // -----------------------------------------------------------------------
  // Batch
  // -----------------------------------------------------------------------

  async createMany(data: Partial<T>[]): Promise<T[]> {
    // Prisma's createMany doesn't return records, so we use a transaction
    const results = await this.prisma.$transaction(
      data.map((item) => this.model.create({ data: item })),
    );
    return results as T[];
  }

  async updateMany(filter: Filter<T>, data: Partial<T>): Promise<number> {
    const result = await this.model.updateMany({
      where: this.translateFilter(filter),
      data,
    });
    return result.count;
  }

  async deleteMany(filter: Filter<T>, soft = true): Promise<number> {
    if (soft) {
      const result = await this.model.updateMany({
        where: this.translateFilter(filter),
        data: { deletedAt: new Date() },
      });
      return result.count;
    }
    const result = await this.model.deleteMany({
      where: this.translateFilter(filter),
    });
    return result.count;
  }

  // -----------------------------------------------------------------------
  // Count
  // -----------------------------------------------------------------------

  async count(filter: Filter<T>): Promise<number> {
    return this.model.count({ where: this.translateFilter(filter) });
  }

  // -----------------------------------------------------------------------
  // Transactions
  // -----------------------------------------------------------------------

  async beginTransaction(): Promise<ITransaction> {
    // Prisma uses interactive transactions via $transaction with a callback.
    // We expose a promise-pair so callers get commit/rollback semantics.
    let resolveTx!: (value: unknown) => void;
    let rejectTx!: (reason: unknown) => void;

    const txPromise = new Promise((resolve, reject) => {
      resolveTx = resolve;
      rejectTx = reject;
    });

    // Start the interactive transaction in the background
    const txResult = this.prisma.$transaction(async (_tx) => {
      return txPromise;
    });

    return {
      commit: async () => {
        resolveTx(undefined);
        await txResult;
      },
      rollback: async () => {
        rejectTx(new Error("Transaction rolled back"));
        // Swallow the expected rejection from the $transaction wrapper
        await txResult.catch(() => {});
      },
    };
  }

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  getSchema(): RepositorySchema {
    return {
      name: this.modelName,
      fields: {} as Record<string, FieldMeta>,
    };
  }

  supports(capability: RepositoryCapability): boolean {
    const supported: RepositoryCapability[] = [
      "transactions",
      "batch",
      "softDelete",
    ];
    return supported.includes(capability);
  }

  // -----------------------------------------------------------------------
  // Private helpers — filter translation
  // -----------------------------------------------------------------------

  private translateFilter(filter: Filter<T>): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(filter)) {
      if (key === "$and" && Array.isArray(value)) {
        where.AND = (value as Filter<T>[]).map((f) => this.translateFilter(f));
        continue;
      }
      if (key === "$or" && Array.isArray(value)) {
        where.OR = (value as Filter<T>[]).map((f) => this.translateFilter(f));
        continue;
      }

      if (value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) !== Date.prototype) {
        const ops = value as Record<string, unknown>;
        const prismaOp: Record<string, unknown> = {};

        if ("$in" in ops) prismaOp.in = ops.$in;
        if ("$nin" in ops) prismaOp.notIn = ops.$nin;
        if ("$gt" in ops) prismaOp.gt = ops.$gt;
        if ("$gte" in ops) prismaOp.gte = ops.$gte;
        if ("$lt" in ops) prismaOp.lt = ops.$lt;
        if ("$lte" in ops) prismaOp.lte = ops.$lte;
        if ("$ne" in ops) prismaOp.not = ops.$ne;
        if ("$like" in ops) {
          prismaOp.contains = ops.$like;
          prismaOp.mode = "insensitive";
        }

        where[key] = prismaOp;
      } else {
        where[key] = value;
      }
    }

    return where;
  }

  private translateSort(
    sort: Record<string, "asc" | "desc">,
  ): Record<string, "asc" | "desc">[] {
    return Object.entries(sort).map(([field, direction]) => ({
      [field]: direction,
    }));
  }

  private buildInclude(
    relations: string[],
  ): Record<string, boolean> {
    const include: Record<string, boolean> = {};
    for (const relation of relations) {
      include[relation] = true;
    }
    return include;
  }
}
