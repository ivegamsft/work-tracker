import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { Roles } from "@e-clat/shared";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestApp, generateTestToken, seededTestUsers } from "./helpers";
import { hoursService } from "../src/modules/hours/service";
import type { EmployeeHoursProgress, TeamHoursProgressItem } from "../src/modules/hours/service";

function buildProgressItem(overrides: Partial<EmployeeHoursProgress["progressItems"][number]> = {}) {
  return {
    requirementId: overrides.requirementId ?? randomUUID(),
    requirementName: overrides.requirementName ?? "Safety Hours Requirement",
    templateId: overrides.templateId ?? randomUUID(),
    templateName: overrides.templateName ?? "Safety Certification Template",
    proofType: overrides.proofType ?? "hours",
    targetHours: overrides.targetHours ?? 150,
    completedHours: overrides.completedHours ?? 120,
    percentage: overrides.percentage ?? 80,
    thresholdUnit: overrides.thresholdUnit ?? "hours",
    rollingWindowDays: overrides.rollingWindowDays ?? null,
    status: overrides.status ?? "on_track",
  };
}

function buildEmployeeProgress(overrides: Partial<EmployeeHoursProgress> = {}): EmployeeHoursProgress {
  const progressItems = overrides.progressItems ?? [buildProgressItem()];
  return {
    employeeId: overrides.employeeId ?? seededTestUsers.employee.id,
    progressItems,
    totalTargetHours: overrides.totalTargetHours ?? 150,
    totalCompletedHours: overrides.totalCompletedHours ?? 120,
    overallPercentage: overrides.overallPercentage ?? 80,
  };
}

function buildTeamProgressItem(overrides: Partial<TeamHoursProgressItem> = {}): TeamHoursProgressItem {
  return {
    employeeId: overrides.employeeId ?? randomUUID(),
    employeeName: overrides.employeeName ?? "Jane Doe",
    employeeEmail: overrides.employeeEmail ?? "jane@example.com",
    progressItems: overrides.progressItems ?? [buildProgressItem()],
    totalTargetHours: overrides.totalTargetHours ?? 150,
    totalCompletedHours: overrides.totalCompletedHours ?? 120,
    overallPercentage: overrides.overallPercentage ?? 80,
  };
}

describe("Hours Progress API", () => {
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

  describe("GET /api/hours/progress", () => {
    it("returns hours progress for authenticated employee", async () => {
      vi.spyOn(hoursService, "getEmployeeProgress").mockResolvedValue(buildEmployeeProgress());

      const response = await request(app)
        .get("/api/hours/progress")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        employeeId: seededTestUsers.employee.id,
        progressItems: expect.any(Array),
        totalTargetHours: 150,
        totalCompletedHours: 120,
        overallPercentage: 80,
      }));
    });

    it("accepts optional proofType filter", async () => {
      vi.spyOn(hoursService, "getEmployeeProgress").mockResolvedValue(buildEmployeeProgress());

      const response = await request(app)
        .get("/api/hours/progress?proofType=hours")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get("/api/hours/progress");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/hours/progress/:employeeId", () => {
    it("returns progress for specified employee when supervisor", async () => {
      vi.spyOn(hoursService, "getEmployeeProgress").mockResolvedValue(
        buildEmployeeProgress({ employeeId: seededTestUsers.employee.id }),
      );

      const response = await request(app)
        .get(`/api/hours/progress/${seededTestUsers.employee.id}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.employeeId).toBe(seededTestUsers.employee.id);
    });

    it("returns 403 for employees", async () => {
      const response = await request(app)
        .get(`/api/hours/progress/${randomUUID()}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .get(`/api/hours/progress/${randomUUID()}`);

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/hours/team-progress", () => {
    it("returns team progress for supervisor", async () => {
      vi.spyOn(hoursService, "getTeamProgress").mockResolvedValue({
        data: [buildTeamProgressItem()],
        total: 1,
        page: 1,
        limit: 50,
      });

      const response = await request(app)
        .get("/api/hours/team-progress")
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        data: expect.any(Array),
        total: 1,
        page: 1,
        limit: 50,
      }));
      expect(response.body.data[0]).toEqual(expect.objectContaining({
        employeeName: "Jane Doe",
        overallPercentage: 80,
      }));
    });

    it("accepts pagination parameters", async () => {
      vi.spyOn(hoursService, "getTeamProgress").mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 10,
      });

      const response = await request(app)
        .get("/api/hours/team-progress?page=2&limit=10")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
    });

    it("returns 403 for employees", async () => {
      const response = await request(app)
        .get("/api/hours/team-progress")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get("/api/hours/team-progress");
      expect(response.status).toBe(401);
    });
  });
});
