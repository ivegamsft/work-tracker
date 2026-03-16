import type {
  ReferenceDataCreateLabelMappingRequest,
  ReferenceDataCreateLabelRequest,
  ReferenceDataDeprecateLabelRequest,
  ReferenceDataUpdateLabelRequest,
} from "@e-clat/shared";
import { labelService } from "../../modules/labels/service";
import type { ILabelRepository } from "../interfaces";

export class PrismaLabelRepository {
  createLabel(input: ReferenceDataCreateLabelRequest) {
    return labelService.createLabel(input);
  }

  updateLabel(id: string, input: ReferenceDataUpdateLabelRequest) {
    return labelService.updateLabel(id, input);
  }

  deprecateLabel(id: string, input: ReferenceDataDeprecateLabelRequest) {
    return labelService.deprecateLabel(id, input);
  }

  getLabel(id: string) {
    return labelService.getLabel(id);
  }

  listVersions() {
    return labelService.listVersions();
  }

  createMapping(input: ReferenceDataCreateLabelMappingRequest) {
    return labelService.createMapping(input);
  }

  resolveLabel(label: string, version?: number) {
    return labelService.resolveLabel(label, version);
  }

  getAuditTrail(id: string) {
    return labelService.getAuditTrail(id);
  }
}

export const prismaLabelRepository = new PrismaLabelRepository() as ILabelRepository;
