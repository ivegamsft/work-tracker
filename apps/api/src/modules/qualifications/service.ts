import { Qualification, AuditLog } from "@e-clat/shared";
import { CreateQualificationInput, UpdateQualificationInput } from "./validators";
import { notImplemented } from "../../common/utils";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface QualificationsService {
  create(input: CreateQualificationInput): Promise<Qualification>;
  getById(id: string): Promise<Qualification>;
  update(id: string, input: UpdateQualificationInput): Promise<Qualification>;
  listByEmployee(employeeId: string, page?: number, limit?: number): Promise<PaginatedResult<Qualification>>;
  list(filters?: Record<string, unknown>): Promise<PaginatedResult<Qualification>>;
  getAuditTrail(id: string): Promise<AuditLog[]>;
  checkCompliance(employeeId: string, standardId: string): Promise<{ compliant: boolean; gaps: string[] }>;
}

export const qualificationsService: QualificationsService = {
  create: () => notImplemented("createQualification"),
  getById: () => notImplemented("getQualification"),
  update: () => notImplemented("updateQualification"),
  listByEmployee: () => notImplemented("listByEmployee"),
  list: () => notImplemented("listQualifications"),
  getAuditTrail: () => notImplemented("getQualificationAudit"),
  checkCompliance: () => notImplemented("checkCompliance"),
};
