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
  let complianceOfficerToken: string;

  beforeAll(() => {
    app = createTestApp();
    employeeToken = generateTestToken(Roles.EMPLOYEE);
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    managerToken = generateTestToken(Roles.MANAGER);
    complianceOfficerToken = generateTestToken(Roles.COMPLIANCE_OFFICER);
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

  describe("Edge Cases & Additional Scenarios", () => {
    describe("Compliance Summary", () => {
      it("handles employee with zero qualifications", async () => {
        vi.spyOn(dashboardService, "getComplianceSummary").mockResolvedValue(
          buildComplianceSummary({
            qualifications: { total: 0, active: 0, expiringSoon: 0, expired: 0 },
            overallComplianceScore: 90,
          }),
        );

        const response = await request(app)
          .get("/api/dashboard/compliance-summary")
          .set("Authorization", `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.qualifications.total).toBe(0);
      });

      it("handles employee with all expired qualifications", async () => {
        vi.spyOn(dashboardService, "getComplianceSummary").mockResolvedValue(
          buildComplianceSummary({
            qualifications: { total: 3, active: 0, expiringSoon: 0, expired: 3 },
            overallComplianceScore: 45,
          }),
        );

        const response = await request(app)
          .get("/api/dashboard/compliance-summary")
          .set("Authorization", `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.qualifications.expired).toBe(3);
        expect(response.body.overallComplianceScore).toBe(45);
      });

      it("handles employee with zero hours progress", async () => {
        vi.spyOn(dashboardService, "getComplianceSummary").mockResolvedValue(
          buildComplianceSummary({
            hoursProgress: {
              totalTargetHours: 200,
              totalCompletedHours: 0,
              overallPercentage: 0,
              requirementCount: 2,
              completedRequirements: 0,
            },
          }),
        );

        const response = await request(app)
          .get("/api/dashboard/compliance-summary")
          .set("Authorization", `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.hoursProgress.overallPercentage).toBe(0);
      });

      it("handles employee with no template assignments", async () => {
        vi.spyOn(dashboardService, "getComplianceSummary").mockResolvedValue(
          buildComplianceSummary({
            templates: {
              totalAssignments: 0,
              completedAssignments: 0,
              overdueAssignments: 0,
              totalFulfillments: 0,
              fulfilledCount: 0,
              pendingReviewCount: 0,
              overallCompletionPercentage: 0,
            },
          }),
        );

        const response = await request(app)
          .get("/api/dashboard/compliance-summary")
          .set("Authorization", `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.templates.totalAssignments).toBe(0);
      });

      it("handles employee with overdue template assignments", async () => {
        vi.spyOn(dashboardService, "getComplianceSummary").mockResolvedValue(
          buildComplianceSummary({
            templates: {
              totalAssignments: 5,
              completedAssignments: 1,
              overdueAssignments: 3,
              totalFulfillments: 10,
              fulfilledCount: 2,
              pendingReviewCount: 2,
              overallCompletionPercentage: 20,
            },
          }),
        );

        const response = await request(app)
          .get("/api/dashboard/compliance-summary")
          .set("Authorization", `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.templates.overdueAssignments).toBe(3);
      });

      it("handles 100% compliance score", async () => {
        vi.spyOn(dashboardService, "getComplianceSummary").mockResolvedValue(
          buildComplianceSummary({
            qualifications: { total: 5, active: 5, expiringSoon: 0, expired: 0 },
            hoursProgress: {
              totalTargetHours: 200,
              totalCompletedHours: 200,
              overallPercentage: 100,
              requirementCount: 2,
              completedRequirements: 2,
            },
            templates: {
              totalAssignments: 3,
              completedAssignments: 3,
              overdueAssignments: 0,
              totalFulfillments: 10,
              fulfilledCount: 10,
              pendingReviewCount: 0,
              overallCompletionPercentage: 100,
            },
            medical: { total: 2, active: 2, expiringSoon: 0, expired: 0 },
            overallComplianceScore: 100,
          }),
        );

        const response = await request(app)
          .get("/api/dashboard/compliance-summary")
          .set("Authorization", `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.overallComplianceScore).toBe(100);
      });

      it("handles new employee with no data", async () => {
        vi.spyOn(dashboardService, "getComplianceSummary").mockResolvedValue(
          buildComplianceSummary({
            qualifications: { total: 0, active: 0, expiringSoon: 0, expired: 0 },
            hoursProgress: {
              totalTargetHours: 0,
              totalCompletedHours: 0,
              overallPercentage: 0,
              requirementCount: 0,
              completedRequirements: 0,
            },
            templates: {
              totalAssignments: 0,
              completedAssignments: 0,
              overdueAssignments: 0,
              totalFulfillments: 0,
              fulfilledCount: 0,
              pendingReviewCount: 0,
              overallCompletionPercentage: 0,
            },
            medical: { total: 0, active: 0, expiringSoon: 0, expired: 0 },
            overallComplianceScore: 0,
          }),
        );

        const response = await request(app)
          .get("/api/dashboard/compliance-summary")
          .set("Authorization", `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.overallComplianceScore).toBe(0);
      });

      it("manager can view employee summary", async () => {
        const targetId = randomUUID();
        const managerToken = generateTestToken(Roles.MANAGER);
        vi.spyOn(dashboardService, "getComplianceSummary").mockResolvedValue(
          buildComplianceSummary({ employeeId: targetId }),
        );

        const response = await request(app)
          .get(`/api/dashboard/compliance-summary?employeeId=${targetId}`)
          .set("Authorization", `Bearer ${managerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.employeeId).toBe(targetId);
      });

      it("compliance officer can view employee summary", async () => {
        const targetId = randomUUID();
        vi.spyOn(dashboardService, "getComplianceSummary").mockResolvedValue(
          buildComplianceSummary({ employeeId: targetId }),
        );

        const response = await request(app)
          .get(`/api/dashboard/compliance-summary?employeeId=${targetId}`)
          .set("Authorization", `Bearer ${complianceOfficerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.employeeId).toBe(targetId);
      });
    });

    describe("Team Summary", () => {
      it("handles empty team", async () => {
        vi.spyOn(dashboardService, "getTeamSummary").mockResolvedValue(
          buildTeamSummary({
            data: [],
            total: 0,
            teamAverageComplianceScore: 0,
            atRiskCount: 0,
          }),
        );

        const response = await request(app)
          .get("/api/dashboard/team-summary")
          .set("Authorization", `Bearer ${supervisorToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([]);
        expect(response.body.teamAverageComplianceScore).toBe(0);
      });

      it("handles team with multiple at-risk employees", async () => {
        vi.spyOn(dashboardService, "getTeamSummary").mockResolvedValue(
          buildTeamSummary({
            data: [
              {
                employeeId: randomUUID(),
                employeeName: "John Doe",
                employeeEmail: "john@example.com",
                qualificationsActive: 2,
                qualificationsExpiring: 2,
                templateCompletionPercentage: 40,
                hoursPercentage: 50,
                overallComplianceScore: 65,
              },
              {
                employeeId: randomUUID(),
                employeeName: "Jane Smith",
                employeeEmail: "jane@example.com",
                qualificationsActive: 1,
                qualificationsExpiring: 3,
                templateCompletionPercentage: 30,
                hoursPercentage: 40,
                overallComplianceScore: 55,
              },
            ],
            total: 2,
            teamAverageComplianceScore: 60,
            atRiskCount: 2,
          }),
        );

        const response = await request(app)
          .get("/api/dashboard/team-summary")
          .set("Authorization", `Bearer ${supervisorToken}`);

        expect(response.status).toBe(200);
        expect(response.body.atRiskCount).toBe(2);
        expect(response.body.teamAverageComplianceScore).toBe(60);
      });

      it("handles pagination with large limit value", async () => {
        vi.spyOn(dashboardService, "getTeamSummary").mockResolvedValue(
          buildTeamSummary({ limit: 50 }),
        );

        const response = await request(app)
          .get("/api/dashboard/team-summary?limit=50")
          .set("Authorization", `Bearer ${supervisorToken}`);

        expect(response.status).toBe(200);
      });

      it("handles large team pagination", async () => {
        const largeTeamData = Array.from({ length: 50 }, (_, i) => ({
          employeeId: randomUUID(),
          employeeName: `Employee ${i + 1}`,
          employeeEmail: `employee${i + 1}@example.com`,
          qualificationsActive: 3,
          qualificationsExpiring: 1,
          templateCompletionPercentage: 75,
          hoursPercentage: 80,
          overallComplianceScore: 78,
        }));

        vi.spyOn(dashboardService, "getTeamSummary").mockResolvedValue(
          buildTeamSummary({
            data: largeTeamData,
            total: 200,
            page: 2,
            limit: 50,
          }),
        );

        const response = await request(app)
          .get("/api/dashboard/team-summary?page=2&limit=50")
          .set("Authorization", `Bearer ${supervisorToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(50);
        expect(response.body.page).toBe(2);
        expect(response.body.total).toBe(200);
      });

      it("manager can view team summary", async () => {
        const managerToken = generateTestToken(Roles.MANAGER);
        vi.spyOn(dashboardService, "getTeamSummary").mockResolvedValue(buildTeamSummary());

        const response = await request(app)
          .get("/api/dashboard/team-summary")
          .set("Authorization", `Bearer ${managerToken}`);

        expect(response.status).toBe(200);
      });

      it("compliance officer can view team summary", async () => {
        vi.spyOn(dashboardService, "getTeamSummary").mockResolvedValue(buildTeamSummary());

        const response = await request(app)
          .get("/api/dashboard/team-summary")
          .set("Authorization", `Bearer ${complianceOfficerToken}`);

        expect(response.status).toBe(200);
      });

      it("admin can view team summary", async () => {
        const adminToken = generateTestToken(Roles.ADMIN);
        vi.spyOn(dashboardService, "getTeamSummary").mockResolvedValue(buildTeamSummary());

        const response = await request(app)
          .get("/api/dashboard/team-summary")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
      });

      it("handles default pagination values", async () => {
        vi.spyOn(dashboardService, "getTeamSummary").mockResolvedValue(
          buildTeamSummary({ page: 1, limit: 50 }),
        );

        const response = await request(app)
          .get("/api/dashboard/team-summary")
          .set("Authorization", `Bearer ${supervisorToken}`);

        expect(response.status).toBe(200);
        expect(response.body.page).toBe(1);
        expect(response.body.limit).toBe(50);
      });
    });

    describe("Error Handling", () => {
      it("handles service errors gracefully for compliance summary", async () => {
        vi.spyOn(dashboardService, "getComplianceSummary").mockRejectedValue(
          new Error("Database connection failed"),
        );

        const response = await request(app)
          .get("/api/dashboard/compliance-summary")
          .set("Authorization", `Bearer ${employeeToken}`);

        expect(response.status).toBe(500);
      });

      it("handles service errors gracefully for team summary", async () => {
        vi.spyOn(dashboardService, "getTeamSummary").mockRejectedValue(
          new Error("Database connection failed"),
        );

        const response = await request(app)
          .get("/api/dashboard/team-summary")
          .set("Authorization", `Bearer ${supervisorToken}`);

        expect(response.status).toBe(500);
      });

      it("handles invalid employeeId format", async () => {
        const response = await request(app)
          .get("/api/dashboard/compliance-summary?employeeId=not-a-uuid")
          .set("Authorization", `Bearer ${supervisorToken}`);

        expect(response.status).toBe(400);
      });

      it("handles invalid page number", async () => {
        const response = await request(app)
          .get("/api/dashboard/team-summary?page=0")
          .set("Authorization", `Bearer ${supervisorToken}`);

        expect(response.status).toBe(400);
      });

      it("handles invalid limit value", async () => {
        const response = await request(app)
          .get("/api/dashboard/team-summary?limit=0")
          .set("Authorization", `Bearer ${supervisorToken}`);

        expect(response.status).toBe(400);
      });
    });
  });
});
