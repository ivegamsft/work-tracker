import type {
  ComplianceAssignmentListQuery,
  ComplianceAttachFulfillmentDocumentRequest,
  ComplianceAssignTemplateRequest,
  ComplianceCreateProofRequirementRequest,
  ComplianceCreateProofTemplateRequest,
  ComplianceReorderProofRequirementsRequest,
  ComplianceSelfAttestFulfillmentRequest,
  ComplianceTemplateListQuery,
  ComplianceThirdPartyVerifyFulfillmentRequest,
  ComplianceUpdateProofRequirementRequest,
  ComplianceUpdateProofTemplateRequest,
  ComplianceValidateFulfillmentRequest,
} from "@e-clat/shared";
import { templatesService } from "../../modules/templates/service";
import type { ITemplateRepository, TemplateActor } from "../interfaces";

export class PrismaTemplateRepository {
  createTemplate(input: ComplianceCreateProofTemplateRequest, actor: TemplateActor) {
    return templatesService.createTemplate(input, actor);
  }

  listTemplates(filters: ComplianceTemplateListQuery, actor: TemplateActor) {
    return templatesService.listTemplates(filters, actor);
  }

  getTemplate(id: string, actor: TemplateActor) {
    return templatesService.getTemplate(id, actor);
  }

  updateTemplate(id: string, input: ComplianceUpdateProofTemplateRequest, actor: TemplateActor) {
    return templatesService.updateTemplate(id, input, actor);
  }

  deleteTemplate(id: string, actor: TemplateActor) {
    return templatesService.deleteTemplate(id, actor);
  }

  publishTemplate(id: string, actor: TemplateActor) {
    return templatesService.publishTemplate(id, actor);
  }

  archiveTemplate(id: string, actor: TemplateActor) {
    return templatesService.archiveTemplate(id, actor);
  }

  cloneTemplate(id: string, actor: TemplateActor) {
    return templatesService.cloneTemplate(id, actor);
  }

  addRequirement(templateId: string, input: ComplianceCreateProofRequirementRequest, actor: TemplateActor) {
    return templatesService.addRequirement(templateId, input, actor);
  }

  updateRequirement(
    templateId: string,
    requirementId: string,
    input: ComplianceUpdateProofRequirementRequest,
    actor: TemplateActor,
  ) {
    return templatesService.updateRequirement(templateId, requirementId, input, actor);
  }

  removeRequirement(templateId: string, requirementId: string, actor: TemplateActor) {
    return templatesService.removeRequirement(templateId, requirementId, actor);
  }

  reorderRequirements(templateId: string, input: ComplianceReorderProofRequirementsRequest, actor: TemplateActor) {
    return templatesService.reorderRequirements(templateId, input, actor);
  }

  assignTemplate(templateId: string, input: ComplianceAssignTemplateRequest, actor: TemplateActor) {
    return templatesService.assignTemplate(templateId, input as never, actor);
  }

  listAssignmentsByTemplate(templateId: string, filters: ComplianceAssignmentListQuery, actor: TemplateActor) {
    return templatesService.listAssignmentsByTemplate(templateId, filters, actor);
  }

  listAssignmentsByEmployee(employeeId: string, filters: ComplianceAssignmentListQuery, actor: TemplateActor) {
    return templatesService.listAssignmentsByEmployee(employeeId, filters, actor);
  }

  deactivateAssignment(assignmentId: string, actor: TemplateActor) {
    return templatesService.deactivateAssignment(assignmentId, actor);
  }

  listFulfillmentsByAssignment(assignmentId: string, actor: TemplateActor) {
    return templatesService.listFulfillmentsByAssignment(assignmentId, actor);
  }

  selfAttestFulfillment(fulfillmentId: string, input: ComplianceSelfAttestFulfillmentRequest, actor: TemplateActor) {
    return templatesService.selfAttestFulfillment(fulfillmentId, input, actor);
  }

  attachDocument(fulfillmentId: string, input: ComplianceAttachFulfillmentDocumentRequest, actor: TemplateActor) {
    return templatesService.attachDocument(fulfillmentId, input, actor);
  }

  validateFulfillment(fulfillmentId: string, input: ComplianceValidateFulfillmentRequest, actor: TemplateActor) {
    return templatesService.validateFulfillment(fulfillmentId, input, actor);
  }

  thirdPartyVerify(fulfillmentId: string, input: ComplianceThirdPartyVerifyFulfillmentRequest, actor: TemplateActor) {
    return templatesService.thirdPartyVerify(fulfillmentId, input, actor);
  }

  listPendingReview(filters: ComplianceAssignmentListQuery, actor: TemplateActor) {
    return templatesService.listPendingReview(filters, actor);
  }

  countPendingReview(actor: TemplateActor) {
    return templatesService.countPendingReview(actor);
  }

  getTemplateAuditTrail(id: string) {
    return templatesService.getTemplateAuditTrail(id);
  }

  getFulfillmentAuditTrail(id: string) {
    return templatesService.getFulfillmentAuditTrail(id);
  }
}

export const prismaTemplateRepository = new PrismaTemplateRepository() as unknown as ITemplateRepository;
