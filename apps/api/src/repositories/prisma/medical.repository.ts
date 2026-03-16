import type {
  ComplianceCreateMedicalClearanceRequest,
  ComplianceUpdateMedicalClearanceRequest,
} from "@e-clat/shared";
import { medicalService } from "../../modules/medical/service";
import type { IMedicalRepository } from "../interfaces";

export class PrismaMedicalRepository {
  create(input: ComplianceCreateMedicalClearanceRequest) {
    return medicalService.create(input);
  }

  getById(id: string) {
    return medicalService.getById(id);
  }

  update(id: string, input: ComplianceUpdateMedicalClearanceRequest) {
    return medicalService.update(id, input);
  }

  listByEmployee(employeeId: string) {
    return medicalService.listByEmployee(employeeId);
  }

  getAuditTrail(id: string) {
    return medicalService.getAuditTrail(id);
  }
}

export const prismaMedicalRepository = new PrismaMedicalRepository() as IMedicalRepository;
