import {
  Document,
  ExtractionResult,
  ReviewQueueItem,
  AuditLog,
} from "../../common/types";
import { UploadDocumentInput, ReviewDocumentInput, CorrectExtractionInput } from "./validators";
import { notImplemented } from "../../common/utils";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DocumentsService {
  upload(input: UploadDocumentInput, fileBuffer: Buffer, uploadedBy: string): Promise<Document>;
  getDocument(id: string): Promise<Document>;
  getExtraction(documentId: string): Promise<ExtractionResult[]>;
  correctExtraction(documentId: string, fieldId: string, input: CorrectExtractionInput, correctedBy: string): Promise<ExtractionResult>;
  reviewDocument(id: string, input: ReviewDocumentInput, reviewedBy: string): Promise<ReviewQueueItem>;
  listReviewQueue(page?: number, limit?: number): Promise<PaginatedResult<ReviewQueueItem>>;
  getAuditTrail(documentId: string): Promise<AuditLog[]>;
}

export const documentsService: DocumentsService = {
  upload: () => notImplemented("upload"),
  getDocument: () => notImplemented("getDocument"),
  getExtraction: () => notImplemented("getExtraction"),
  correctExtraction: () => notImplemented("correctExtraction"),
  reviewDocument: () => notImplemented("reviewDocument"),
  listReviewQueue: () => notImplemented("listReviewQueue"),
  getAuditTrail: () => notImplemented("getAuditTrail"),
};
