import type {
  ReferenceDataCreateStandardRequest,
  ReferenceDataCreateStandardRequirementRequest,
  ReferenceDataUpdateStandardRequest,
  ReferenceDataUpdateStandardRequirementRequest,
} from "@e-clat/shared";
import { standardsService } from "../../modules/standards/service";
import type { IStandardRepository, StandardListFilters } from "../interfaces";

export class PrismaStandardRepository {
  create(input: ReferenceDataCreateStandardRequest) {
    return standardsService.create(input);
  }

  list(filters: StandardListFilters = {}) {
    return standardsService.list(filters);
  }

  getById(id: string) {
    return standardsService.getById(id);
  }

  update(id: string, input: ReferenceDataUpdateStandardRequest) {
    return standardsService.update(id, input);
  }

  createRequirement(
    standardId: string,
    input: Omit<ReferenceDataCreateStandardRequirementRequest, "standardId">,
  ) {
    return standardsService.createRequirement(standardId, input);
  }

  updateRequirement(id: string, input: ReferenceDataUpdateStandardRequirementRequest) {
    return standardsService.updateRequirement(id, input);
  }

  listRequirements(standardId: string) {
    return standardsService.listRequirements(standardId);
  }
}

export const prismaStandardRepository = new PrismaStandardRepository() as IStandardRepository;
