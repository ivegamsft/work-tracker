import {
  FulfillmentStatus as PrismaFulfillmentStatus,
  ProofType as PrismaProofType,
  QualificationStatus as PrismaQualificationStatus,
  TemplateStatus as PrismaTemplateStatus,
  type Prisma,
} from "@prisma/client";
import { ForbiddenError, NotFoundError, Roles, type Role } from "@e-clat/shared";
import { prisma } from "../../config/database";
import type { ComplianceSummaryQuery, TeamSummaryQuery } from "./validators";

interface Actor {
  id: string;
  role: Role;
}

export interface QualificationSummary {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
}

export interface HoursProgressSummary {
  totalTargetHours: number;
  totalCompletedHours: number;
  overallPercentage: number;
  requirementCount: number;
  completedRequirements: number;
}

export interface TemplateSummary {
  totalAssignments: number;
  completedAssignments: number;
  overdueAssignments: number;
  totalFulfillments: number;
  fulfilledCount: number;
  pendingReviewCount: number;
  overallCompletionPercentage: number;
}

export interface MedicalSummary {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
}

export interface ComplianceSummaryResult {
  employeeId: string;
  qualifications: QualificationSummary;
  hoursProgress: HoursProgressSummary;
  templates: TemplateSummary;
  medical: MedicalSummary;
  overallComplianceScore: number;
}

export interface TeamMemberSummary {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  qualificationsActive: number;
  qualificationsExpiring: number;
  templateCompletionPercentage: number;
  hoursPercentage: number;
  overallComplianceScore: number;
}

export interface TeamSummaryResult {
  data: TeamMemberSummary[];
  total: number;
  page: number;
  limit: number;
  teamAverageComplianceScore: number;
  atRiskCount: number;
}

export interface DashboardService {
  getComplianceSummary(query: ComplianceSummaryQuery, actor: Actor): Promise<ComplianceSummaryResult>;
  getTeamSummary(query: TeamSummaryQuery, actor: Actor): Promise<TeamSummaryResult>;
}

async function buildQualificationSummary(employeeId: string): Promise<QualificationSummary> {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const qualifications = await prisma.qualification.findMany({
    where: { employeeId },
    select: { status: true, expirationDate: true },
  });

  let active = 0;
  let expiringSoon = 0;
  let expired = 0;

  for (const q of qualifications) {
    if (q.status === PrismaQualificationStatus.EXPIRED) {
      expired++;
    } else if (q.status === PrismaQualificationStatus.ACTIVE) {
      if (q.expirationDate && q.expirationDate <= thirtyDaysFromNow && q.expirationDate > now) {
        expiringSoon++;
      }
      active++;
    }
  }

  return { total: qualifications.length, active, expiringSoon, expired };
}

async function buildHoursProgressSummary(employeeId: string): Promise<HoursProgressSummary> {
  const requirements = await prisma.proofRequirement.findMany({
    where: {
      proofType: PrismaProofType.HOURS,
      threshold: { not: null },
      template: {
        status: PrismaTemplateStatus.PUBLISHED,
        assignments: { some: { employeeId, isActive: true } },
      },
    },
    select: {
      id: true,
      threshold: true,
      rollingWindowDays: true,
    },
  });

  let totalTarget = 0;
  let totalCompleted = 0;
  let completedRequirements = 0;

  for (const req of requirements) {
    const target = req.threshold ?? 0;
    totalTarget += target;

    const dateFilter: Prisma.HourRecordWhereInput = { employeeId, isDeleted: false };
    if (req.rollingWindowDays) {
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - req.rollingWindowDays);
      dateFilter.date = { gte: windowStart };
    }

    const result = await prisma.hourRecord.aggregate({
      where: dateFilter,
      _sum: { hours: true },
    });

    const completed = Number(result._sum.hours ?? 0);
    totalCompleted += completed;

    if (completed >= target) {
      completedRequirements++;
    }
  }

  const overallPercentage = totalTarget > 0
    ? Math.min(Math.round((totalCompleted / totalTarget) * 100), 100)
    : 0;

  return {
    totalTargetHours: totalTarget,
    totalCompletedHours: Math.round(totalCompleted * 100) / 100,
    overallPercentage,
    requirementCount: requirements.length,
    completedRequirements,
  };
}

async function buildTemplateSummary(employeeId: string): Promise<TemplateSummary> {
  const now = new Date();

  const assignments = await prisma.templateAssignment.findMany({
    where: { employeeId, isActive: true },
    select: {
      id: true,
      dueDate: true,
      completedAt: true,
      fulfillments: {
        select: { status: true },
      },
    },
  });

  let completedAssignments = 0;
  let overdueAssignments = 0;
  let totalFulfillments = 0;
  let fulfilledCount = 0;
  let pendingReviewCount = 0;

  for (const a of assignments) {
    if (a.completedAt) {
      completedAssignments++;
    } else if (a.dueDate && a.dueDate < now) {
      overdueAssignments++;
    }

    totalFulfillments += a.fulfillments.length;
    for (const f of a.fulfillments) {
      if (f.status === PrismaFulfillmentStatus.FULFILLED) {
        fulfilledCount++;
      } else if (f.status === PrismaFulfillmentStatus.PENDING_REVIEW) {
        pendingReviewCount++;
      }
    }
  }

  const totalAssignments = assignments.length;
  const overallCompletionPercentage = totalAssignments > 0
    ? Math.round((completedAssignments / totalAssignments) * 100)
    : 0;

  return {
    totalAssignments,
    completedAssignments,
    overdueAssignments,
    totalFulfillments,
    fulfilledCount,
    pendingReviewCount,
    overallCompletionPercentage,
  };
}

async function buildMedicalSummary(employeeId: string): Promise<MedicalSummary> {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const clearances = await prisma.medicalClearance.findMany({
    where: { employeeId },
    select: { status: true, expirationDate: true },
  });

  let active = 0;
  let expiringSoon = 0;
  let expired = 0;

  for (const c of clearances) {
    const statusStr = c.status.toLowerCase();
    if (statusStr === "expired") {
      expired++;
    } else if (statusStr === "active" || statusStr === "cleared") {
      if (c.expirationDate && c.expirationDate <= thirtyDaysFromNow && c.expirationDate > now) {
        expiringSoon++;
      }
      active++;
    }
  }

  return { total: clearances.length, active, expiringSoon, expired };
}

function computeComplianceScore(
  quals: QualificationSummary,
  hours: HoursProgressSummary,
  templates: TemplateSummary,
  medical: MedicalSummary,
): number {
  const qualScore = quals.total > 0 ? (quals.active / quals.total) * 100 : 100;
  const hoursScore = hours.overallPercentage;
  const templateScore = templates.overallCompletionPercentage;
  const medicalScore = medical.total > 0 ? (medical.active / medical.total) * 100 : 100;

  // Weighted average: templates 30%, hours 30%, qualifications 25%, medical 15%
  return Math.round(templateScore * 0.3 + hoursScore * 0.3 + qualScore * 0.25 + medicalScore * 0.15);
}

export const dashboardService: DashboardService = {
  async getComplianceSummary(query, actor) {
    const employeeId = query.employeeId ?? actor.id;

    if (actor.role === Roles.EMPLOYEE && employeeId !== actor.id) {
      throw new ForbiddenError("Employees can only view their own compliance summary.");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundError("Employee", employeeId);
    }

    const [qualifications, hoursProgress, templates, medical] = await Promise.all([
      buildQualificationSummary(employeeId),
      buildHoursProgressSummary(employeeId),
      buildTemplateSummary(employeeId),
      buildMedicalSummary(employeeId),
    ]);

    const overallComplianceScore = computeComplianceScore(qualifications, hoursProgress, templates, medical);

    return {
      employeeId,
      qualifications,
      hoursProgress,
      templates,
      medical,
      overallComplianceScore,
    };
  },

  async getTeamSummary(query, actor) {
    if (actor.role === Roles.EMPLOYEE) {
      throw new ForbiddenError("Employees cannot view team summaries.");
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.employee.count(),
    ]);

    const teamMembers: TeamMemberSummary[] = [];
    let totalScore = 0;
    let atRiskCount = 0;

    for (const emp of employees) {
      const [quals, hours, templates, medical] = await Promise.all([
        buildQualificationSummary(emp.id),
        buildHoursProgressSummary(emp.id),
        buildTemplateSummary(emp.id),
        buildMedicalSummary(emp.id),
      ]);

      const score = computeComplianceScore(quals, hours, templates, medical);
      totalScore += score;

      if (score < 70) {
        atRiskCount++;
      }

      teamMembers.push({
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeeEmail: emp.email,
        qualificationsActive: quals.active,
        qualificationsExpiring: quals.expiringSoon,
        templateCompletionPercentage: templates.overallCompletionPercentage,
        hoursPercentage: hours.overallPercentage,
        overallComplianceScore: score,
      });
    }

    const teamAverageComplianceScore = teamMembers.length > 0
      ? Math.round(totalScore / teamMembers.length)
      : 0;

    return {
      data: teamMembers,
      total,
      page,
      limit,
      teamAverageComplianceScore,
      atRiskCount,
    };
  },
};
