import { Label, LabelMapping, TaxonomyVersion, AuditLog } from "@e-clat/shared";
import { CreateLabelInput, UpdateLabelInput, DeprecateLabelInput, CreateLabelMappingInput } from "./validators";
import { notImplemented } from "../../common/utils";

export interface LabelService {
  createLabel(input: CreateLabelInput): Promise<Label>;
  updateLabel(id: string, input: UpdateLabelInput): Promise<Label>;
  deprecateLabel(id: string, input: DeprecateLabelInput): Promise<Label>;
  getLabel(id: string): Promise<Label>;
  listVersions(): Promise<TaxonomyVersion[]>;
  createMapping(input: CreateLabelMappingInput): Promise<LabelMapping>;
  resolveLabel(label: string, version?: number): Promise<LabelMapping>;
  getAuditTrail(id: string): Promise<AuditLog[]>;
}

export const labelService: LabelService = {
  createLabel: () => notImplemented("createLabel"),
  updateLabel: () => notImplemented("updateLabel"),
  deprecateLabel: () => notImplemented("deprecateLabel"),
  getLabel: () => notImplemented("getLabel"),
  listVersions: () => notImplemented("listVersions"),
  createMapping: () => notImplemented("createMapping"),
  resolveLabel: () => notImplemented("resolveLabel"),
  getAuditTrail: () => notImplemented("getAuditTrail"),
};
