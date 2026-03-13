import { ComplianceStandard, StandardRequirement } from "../../common/types";
import { CreateStandardInput, UpdateStandardInput, CreateRequirementInput, UpdateRequirementInput } from "./validators";
import { notImplemented } from "../../common/utils";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface StandardsService {
  createStandard(input: CreateStandardInput): Promise<ComplianceStandard>;
  getStandard(id: string): Promise<ComplianceStandard>;
  updateStandard(id: string, input: UpdateStandardInput): Promise<ComplianceStandard>;
  listStandards(filters?: Record<string, unknown>): Promise<PaginatedResult<ComplianceStandard>>;
  createRequirement(input: CreateRequirementInput): Promise<StandardRequirement>;
  updateRequirement(id: string, input: UpdateRequirementInput): Promise<StandardRequirement>;
  listRequirements(standardId: string): Promise<StandardRequirement[]>;
}

export const standardsService: StandardsService = {
  createStandard: () => notImplemented("createStandard"),
  getStandard: () => notImplemented("getStandard"),
  updateStandard: () => notImplemented("updateStandard"),
  listStandards: () => notImplemented("listStandards"),
  createRequirement: () => notImplemented("createRequirement"),
  updateRequirement: () => notImplemented("updateRequirement"),
  listRequirements: () => notImplemented("listRequirements"),
};
