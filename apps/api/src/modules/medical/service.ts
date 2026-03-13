import { MedicalClearance, AuditLog } from "../../common/types";
import { CreateMedicalClearanceInput, UpdateMedicalClearanceInput } from "./validators";
import { notImplemented } from "../../common/utils";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface MedicalService {
  create(input: CreateMedicalClearanceInput): Promise<MedicalClearance>;
  getById(id: string): Promise<MedicalClearance>;
  update(id: string, input: UpdateMedicalClearanceInput): Promise<MedicalClearance>;
  listByEmployee(employeeId: string): Promise<MedicalClearance[]>;
  getAuditTrail(id: string): Promise<AuditLog[]>;
}

export const medicalService: MedicalService = {
  create: () => notImplemented("createMedicalClearance"),
  getById: () => notImplemented("getMedicalClearance"),
  update: () => notImplemented("updateMedicalClearance"),
  listByEmployee: () => notImplemented("listMedicalByEmployee"),
  getAuditTrail: () => notImplemented("getMedicalAudit"),
};
