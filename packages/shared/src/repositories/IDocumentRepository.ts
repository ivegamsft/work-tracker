import type { IRepository, Filter, QueryOptions } from "./IRepository";

/**
 * Document repository — combines relational metadata (SQL)
 * with binary blob storage for actual file content.
 *
 * The Document type referenced here is the shared domain type
 * from packages/shared/src/types/domain.ts.
 */
export interface DocumentMeta {
  id: string;
  employeeId: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  status: string;
  classifiedType: string | null;
  extractedData: Record<string, unknown> | null;
  detectedExpiration: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocumentRepository extends IRepository<DocumentMeta> {
  /** Upload binary content and link it to an existing document record */
  uploadFile(documentId: string, file: Buffer, mimeType: string): Promise<string>;

  /** Download the raw binary content for a document */
  downloadFile(documentId: string): Promise<Buffer>;

  /** Delete the binary file associated with a document */
  deleteFile(documentId: string): Promise<void>;

  /** Generate a time-limited signed URL for direct download */
  getSignedUrl(documentId: string, expiresInSeconds: number): Promise<string>;

  /** List documents belonging to an employee with optional filtering */
  listByEmployee(
    employeeId: string,
    filter?: Filter<DocumentMeta>,
    options?: QueryOptions,
  ): Promise<DocumentMeta[]>;
}
