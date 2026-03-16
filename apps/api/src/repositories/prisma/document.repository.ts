import type {
  RecordsCorrectExtractionRequest,
  RecordsReviewDocumentRequest,
  RecordsUploadDocumentRequest,
} from "@e-clat/shared";
import { documentsService } from "../../modules/documents/service";
import type { IDocumentRepository } from "../interfaces";

export class PrismaDocumentRepository {
  upload(input: RecordsUploadDocumentRequest, fileBuffer: Buffer, uploadedBy: string) {
    return documentsService.upload(input, fileBuffer, uploadedBy);
  }

  getDocument(id: string) {
    return documentsService.getDocument(id);
  }

  listByEmployee(employeeId: string, page?: number, limit?: number) {
    return documentsService.listByEmployee(employeeId, page, limit);
  }

  getExtraction(documentId: string) {
    return documentsService.getExtraction(documentId);
  }

  correctExtraction(
    documentId: string,
    fieldId: string,
    input: RecordsCorrectExtractionRequest,
    correctedBy: string,
  ) {
    return documentsService.correctExtraction(documentId, fieldId, input, correctedBy);
  }

  reviewDocument(id: string, input: RecordsReviewDocumentRequest, reviewedBy: string) {
    return documentsService.reviewDocument(id, input, reviewedBy);
  }

  listReviewQueue(page?: number, limit?: number) {
    return documentsService.listReviewQueue(page, limit);
  }

  getAuditTrail(documentId: string) {
    return documentsService.getAuditTrail(documentId);
  }
}

export const prismaDocumentRepository = new PrismaDocumentRepository() as IDocumentRepository;
