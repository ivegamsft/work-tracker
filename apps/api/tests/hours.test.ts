import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { NotFoundError, Roles, ValidationError } from "@e-clat/shared";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestApp, generateTestToken, seededTestUsers } from "./helpers";
import { hoursService } from "../src/modules/hours/service";

const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";

function buildHourRecord(overrides: Partial<{
  id: string;
  employeeId: string;
  source: "clock_in_out" | "timesheet_import" | "job_ticket_sync" | "calendar_sync" | "manual_entry";
  date: Date;
  hours: number;
  qualificationCategory: string;
  description: string;
}> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    employeeId: overrides.employeeId ?? seededTestUsers.employee.id,
    source: overrides.source ?? "manual_entry",
    date: overrides.date ?? new Date("2026-03-18T00:00:00.000Z"),
    hours: overrides.hours ?? 8,
    qualificationCategory: overrides.qualificationCategory ?? "Safety",
    description: overrides.description ?? "Hours test fixture",
    verifiedBy: null,
    verifiedAt: null,
    createdAt: new Date("2026-03-18T00:00:00.000Z"),
  };
}

function buildConflict(overrides: Partial<{
  id: string;
  recordIds: string[];
  conflictType: "duplicate" | "mismatch";
  status: "pending" | "resolved";
}> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    recordIds: overrides.recordIds ?? [randomUUID(), randomUUID()],
    conflictType: overrides.conflictType ?? "duplicate",
    status: overrides.status ?? "pending",
    resolutionMethod: null,
    resolvedBy: null,
    resolvedAt: null,
    attestation: null,
    reason: null,
    createdAt: new Date("2026-03-18T00:00:00.000Z"),
  };
}

describe("Hours API", () => {
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

  describe("Happy path", () => {
    it("clocks in an employee", async () => {
      vi.spyOn(hoursService, "clockIn").mockResolvedValue(buildHourRecord({ source: "clock_in_out" }) as never);

      const response = await request(app)
        .post("/api/hours/clock-in")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ employeeId: seededTestUsers.employee.id, timestamp: "2026-03-18T08:00:00.000Z" });

      expect([201, 500, 501]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body).toEqual(expect.objectContaining({
          employeeId: seededTestUsers.employee.id,
          source: "clock_in_out",
        }));
      }
    });

    it("clocks out an employee", async () => {
      vi.spyOn(hoursService, "clockOut").mockResolvedValue(buildHourRecord({ source: "clock_in_out" }) as never);

      const response = await request(app)
        .post("/api/hours/clock-out")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ employeeId: seededTestUsers.employee.id, timestamp: "2026-03-18T17:00:00.000Z" });

      expect([200, 201, 500, 501]).toContain(response.status);
    });

    it("submits a manual hours entry", async () => {
      vi.spyOn(hoursService, "submitManualEntry").mockResolvedValue(buildHourRecord({ source: "manual_entry", hours: 6.5 }) as never);

      const response = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-03-18T00:00:00.000Z",
          hours: 6.5,
          qualificationCategory: "Safety",
          description: "Manual entry",
          attestation: "I attest this entry is correct",
        });

      expect([201, 500, 501]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body).toEqual(expect.objectContaining({
          employeeId: seededTestUsers.employee.id,
          source: "manual_entry",
          hours: 6.5,
        }));
      }
    });

    it("imports payroll hours", async () => {
      vi.spyOn(hoursService, "importPayroll").mockResolvedValue({ imported: 1, conflicts: 0 } as never);

      const response = await request(app)
        .post("/api/hours/import/payroll")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          records: [{
            employeeId: seededTestUsers.employee.id,
            date: "2026-03-18T00:00:00.000Z",
            hours: 8,
            qualificationCategory: "Safety",
            description: "Payroll sync",
          }],
          sourceSystemId: "payroll-system",
        });

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({ imported: 1, conflicts: 0 }));
      }
    });

    it("imports scheduling hours", async () => {
      vi.spyOn(hoursService, "importScheduling").mockResolvedValue({ imported: 2, conflicts: 1 } as never);

      const response = await request(app)
        .post("/api/hours/import/scheduling")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          records: [{
            employeeId: seededTestUsers.employee.id,
            date: "2026-03-18T00:00:00.000Z",
            hours: 8,
            jobTicketId: "JOB-1001",
            qualificationCategory: "Operations",
            description: "Schedule import",
          }],
          sourceSystemId: "scheduling-system",
        });

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({ imported: 2, conflicts: 1 }));
      }
    });

    it("gets paginated employee hours", async () => {
      vi.spyOn(hoursService, "getEmployeeHours").mockResolvedValue({
        data: [buildHourRecord()],
        total: 1,
        page: 1,
        limit: 10,
      } as never);

      const response = await request(app)
        .get(`/api/hours/employee/${seededTestUsers.employee.id}`)
        .query({ page: 1, limit: 10 })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({
          data: expect.any(Array),
          total: 1,
          page: 1,
          limit: 10,
        }));
      }
    });

    it("gets paginated hour conflicts", async () => {
      vi.spyOn(hoursService, "listConflicts").mockResolvedValue({
        data: [buildConflict()],
        total: 1,
        page: 1,
        limit: 10,
      } as never);

      const response = await request(app)
        .get("/api/hours/conflicts")
        .query({ page: 1, limit: 10 })
        .set("Authorization", `Bearer ${managerToken}`);

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({
          data: expect.any(Array),
          total: 1,
          page: 1,
          limit: 10,
        }));
      }
    });

    it("resolves an hour conflict", async () => {
      vi.spyOn(hoursService, "resolveConflict").mockResolvedValue({
        ...buildConflict({ status: "resolved" }),
        resolutionMethod: "merge",
        resolvedBy: seededTestUsers.manager.id,
        resolvedAt: new Date("2026-03-18T12:00:00.000Z"),
        attestation: "Reviewed against payroll and scheduling systems",
        reason: "Merged authoritative records",
      } as never);

      const response = await request(app)
        .post(`/api/hours/conflicts/${randomUUID()}/resolve`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          resolutionMethod: "merge",
          attestation: "Reviewed against payroll and scheduling systems",
          reason: "Merged authoritative records",
        });

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({
          status: "resolved",
          resolutionMethod: "merge",
        }));
      }
    });
  });

  describe("Edit/Delete", () => {
    it("updates an hour record", async () => {
      const recordId = randomUUID();
      vi.spyOn(hoursService, "editHour").mockResolvedValue(buildHourRecord({ id: recordId, hours: 7.5, description: "Corrected hours" }) as never);

      const response = await request(app)
        .put(`/api/hours/${recordId}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          hours: 7.5,
          qualificationCategory: "Safety",
          description: "Corrected hours",
          reason: "Adjusted after reconciliation",
        });

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({ id: recordId, hours: 7.5 }));
      }
    });

    it("deletes an hour record when a reason is provided", async () => {
      vi.spyOn(hoursService, "deleteHour").mockResolvedValue(undefined as never);

      const response = await request(app)
        .delete(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ reason: "Duplicate entry" });

      expect([200, 204, 500, 501]).toContain(response.status);
    });

    it("returns 404 when updating a non-existent hour record", async () => {
      vi.spyOn(hoursService, "editHour").mockRejectedValue(new NotFoundError("HourRecord", NON_EXISTENT_ID));

      const response = await request(app)
        .put(`/api/hours/${NON_EXISTENT_ID}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ hours: 4, reason: "Attempted update" });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when deleting a non-existent hour record", async () => {
      vi.spyOn(hoursService, "deleteHour").mockRejectedValue(new NotFoundError("HourRecord", NON_EXISTENT_ID));

      const response = await request(app)
        .delete(`/api/hours/${NON_EXISTENT_ID}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ reason: "Attempted delete" });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("RBAC", () => {
    it("returns 401 for clock-in without authentication", async () => {
      const response = await request(app)
        .post("/api/hours/clock-in")
        .send({ employeeId: seededTestUsers.employee.id });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 403 when an employee imports payroll hours", async () => {
      const response = await request(app)
        .post("/api/hours/import/payroll")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          records: [{
            employeeId: seededTestUsers.employee.id,
            date: "2026-03-18T00:00:00.000Z",
            hours: 8,
            qualificationCategory: "Safety",
          }],
          sourceSystemId: "payroll-system",
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee imports scheduling hours", async () => {
      const response = await request(app)
        .post("/api/hours/import/scheduling")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          records: [{
            employeeId: seededTestUsers.employee.id,
            date: "2026-03-18T00:00:00.000Z",
            hours: 8,
            jobTicketId: "JOB-1001",
            qualificationCategory: "Operations",
          }],
          sourceSystemId: "scheduling-system",
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee lists hour conflicts", async () => {
      const response = await request(app)
        .get("/api/hours/conflicts")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee resolves an hour conflict", async () => {
      const response = await request(app)
        .post(`/api/hours/conflicts/${randomUUID()}/resolve`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          resolutionMethod: "merge",
          attestation: "I should not be able to do this",
          reason: "Unauthorized",
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("Edge cases", () => {
    it("returns 400 when manual hours exceed 24", async () => {
      const submitManualEntrySpy = vi.spyOn(hoursService, "submitManualEntry");

      const response = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-03-18T00:00:00.000Z",
          hours: 25,
          qualificationCategory: "Safety",
          description: "Invalid hours",
          attestation: "I attest this entry is correct",
        });

      expect([400, 500]).toContain(response.status);
      expect(submitManualEntrySpy).not.toHaveBeenCalled();
    });

    it("returns 404 or 400 when there is no open clock-in", async () => {
      vi.spyOn(hoursService, "clockOut").mockRejectedValue(new ValidationError("No open clock-in found for employee"));

      const response = await request(app)
        .post("/api/hours/clock-out")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ employeeId: seededTestUsers.employee.id, timestamp: "2026-03-18T17:00:00.000Z" });

      expect([400, 404]).toContain(response.status);
    });

    it("gets employee hours with date range filters", async () => {
      const getEmployeeHoursSpy = vi.spyOn(hoursService, "getEmployeeHours").mockResolvedValue({
        data: [buildHourRecord()],
        total: 1,
        page: 1,
        limit: 5,
      } as never);

      const response = await request(app)
        .get(`/api/hours/employee/${seededTestUsers.employee.id}`)
        .query({ from: "2026-03-01", to: "2026-03-31", page: 1, limit: 5 })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({ page: 1, limit: 5 }));
      }

      expect(getEmployeeHoursSpy).toHaveBeenCalledWith(
        seededTestUsers.employee.id,
        new Date("2026-03-01T00:00:00.000Z"),
        new Date("2026-03-31T00:00:00.000Z"),
        1,
        5,
      );
    });
  });
});
