import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { Roles } from "@e-clat/shared";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestApp, generateTestToken, seededTestUsers } from "./helpers";
import { dashboardService } from "../src/modules/dashboard/service";
import type { ComplianceSummaryResult, TeamSummaryResult } from "../src/modules/dashboard/service";

function buildComplianceSummary(overrides: Partial<ComplianceSummaryResult> = {}): ComplianceSummaryResult {
  return {
    employeeId: overrides.employeeId ?? seededTestUsers.employee.id,
    qualifications: overrides.qualifications ?? {
      total: 5,
      active: 4,
      expiringSoon: 1,
      expired: 0,
    },
    hoursProgress: overrides.hoursProgress ?? {
      totalTargetHours: 200,
      totalCompletedHours: 160,
      overallPercentage: 80,
      requirementCount: 2,
      completedRequirements: 1,
    },
    templates: overrides.templates ?? {
      totalAssignments: 3,
      completedAssignments: 2,
      overdueAssignments: 0,
      totalFulfillments: 10,
      fulfilledCount: 8,
      pendingReviewCount: 1,
      overallCompletionPercentage: 67,
    },
    medical: overrides.medical ?? {
      total: 2,
      active: 2,
      expiringSoon: 0,
      expired: 0,
    },
    overallComplianceScore: overrides.overallComplianceScore ?? 82,
  };
}

function buildTeamSummary(overrides: Partial<TeamSummaryResult> = {}): TeamSummaryResult {
  return {
    data: overrides.data ?? [{
      employeeId: randomUUID(),
      employeeName: "Jane Doe",
      employeeEmail: "jane@example.com",
      qualificationsActive: 4,
      qualificationsExpiring: 1,
      templateCompletionPercentage: 67,
      hoursPercentage: 80,
      overallComplianceScore: 82,
    }],
    total: overrides.total ?? 1,
    page: overrides.page ?? 1,
    limit: overrides.limit ?? 50,
    teamAverageComplianceScore: overrides.teamAverageComplianceScore ?? 82,
    atRiskCount: overrides.atRiskCount ?? 0,
  };
}

describe("Dashboard API", () => {
  let app: Express;
  let employeeToken: string;
  let supervisorToken: string;
  let managerToken: string;

  beforeAll(() => {
    app = createTestApp();
    employeeToken = generateTestToken(Roles.EMPLOYEE);
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    managerToken = generateTestToken(Roles.MANAGER);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/dashboard/compliance-summary", () => {
    it("returns compliance summary for authenticated employee", async () => {
      vi.spyOn(dashboardService, "getComplianceSummary").mockResolvedValue(buildComplianceSummary());

      const response = await request(app)
        .get("/api/dashboard/compliance-summary")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        employeeId: seededTestUsers.employee.id,
        qualifications: expect.objectContaining({ total: 5, active: 4 }),
        hoursProgress: expect.objectContaining({ totalTargetHours: 200 }),
        templates: expect.objectContaining({ totalAssignments: 3 }),
        medical: expect.objectContaining({ total: 2 }),
        overallComplianceScore: 82,
      }));
    });

    it("allows supervisor to view another employee's summary", async () => {
      const targetId = randomUUID();
      vi.spyOn(dashboardService, "getComplianceSummary").mockResolvedValue(
        buildComplianceSummary({ employeeId: targetId }),
      );

      const response = await request(app)
        .get(`/api/dashboard/compliance-summary?employeeId=${targetId}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.employeeId).toBe(targetId);
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get("/api/dashboard/compliance-summary");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/dashboard/team-summary", () => {
    it("returns team summary for supervisor", async () => {
      vi.spyOn(dashboardService, "getTeamSummary").mockResolvedValue(buildTeamSummary());

      const response = await request(app)
        .get("/api/dashboard/team-summary")
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        data: expect.any(Array),
        total: 1,
        teamAverageComplianceScore: 82,
        atRiskCount: 0,
      }));
    });

    it("accepts pagination parameters", async () => {
      vi.spyOn(dashboardService, "getTeamSummary").mockResolvedValue(
        buildTeamSummary({ page: 2, limit: 10 }),
      );

      const response = await request(app)
        .get("/api/dashboard/team-summary?page=2&limit=10")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
    });

    it("returns 403 for employees", async () => {
      const response = await request(app)
        .get("/api/dashboard/team-summary")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get("/api/dashboard/team-summary");
      expect(response.status).toBe(401);
    });
  });
});
