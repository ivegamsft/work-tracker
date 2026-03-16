import type {
  ComplianceCreateQualificationRequest,
  ComplianceUpdateQualificationRequest,
} from "@e-clat/shared";
import { qualificationsService } from "../../modules/qualifications/service";
import type { IQualificationRepository, QualificationListFilters } from "../interfaces";

export class PrismaQualificationRepository {
  create(input: ComplianceCreateQualificationRequest) {
    return qualificationsService.create(input);
  }

  getById(id: string) {
    return qualificationsService.getById(id);
  }

  update(id: string, input: ComplianceUpdateQualificationRequest) {
    return qualificationsService.update(id, input);
  }

  listByEmployee(employeeId: string) {
    return qualificationsService.listByEmployee(employeeId);
  }

  list(filters: QualificationListFilters = {}) {
    return qualificationsService.list(filters as Record<string, unknown>);
  }

  getAuditTrail(id: string) {
    return qualificationsService.getAuditTrail(id);
  }

  checkCompliance(employeeId: string, standardId: string) {
    return qualificationsService.checkCompliance(employeeId, standardId);
  }
}

export const prismaQualificationRepository = new PrismaQualificationRepository() as IQualificationRepository;
