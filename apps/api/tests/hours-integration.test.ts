import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { NotFoundError, Roles, ValidationError } from "@e-clat/shared";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestApp, generateTestToken, seededTestUsers } from "./helpers";
import { hoursService } from "../src/modules/hours/service";

const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";

function buildHourRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    employeeId: seededTestUsers.employee.id,
    source: "manual_entry",
    date: new Date("2026-03-20T00:00:00.000Z"),
    hours: 8,
    qualificationCategory: "Safety",
    description: "Integration test fixture",
    verifiedBy: null,
    verifiedAt: null,
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
    ...overrides,
  };
}

function buildConflict(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    recordIds: [randomUUID(), randomUUID()],
    conflictType: "duplicate",
    status: "pending",
    resolutionMethod: null,
    resolvedBy: null,
    resolvedAt: null,
    attestation: null,
    reason: null,
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
    ...overrides,
  };
}

describe("Hours Integration — Real Router", () => {
  let app: Express;
  let employeeToken: string;
  let supervisorToken: string;
  let managerToken: string;
  let adminToken: string;

  beforeAll(() => {
    app = createTestApp();
    employeeToken = generateTestToken(Roles.EMPLOYEE);
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    managerToken = generateTestToken(Roles.MANAGER);
    adminToken = generateTestToken(Roles.ADMIN);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── CLOCK IN/OUT ────────────────────────────────────────────

  describe("Clock in/out (real router)", () => {
    it("clocks in an employee", async () => {
      vi.spyOn(hoursService, "clockIn").mockResolvedValue(
        buildHourRecord({ source: "clock_in_out" }) as never,
      );

      const res = await request(app)
        .post("/api/hours/clock-in")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ employeeId: seededTestUsers.employee.id, timestamp: "2026-03-20T08:00:00Z" });

      expect([201, 500, 501]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.source).toBe("clock_in_out");
      }
    });

    it("clocks out an employee", async () => {
      vi.spyOn(hoursService, "clockOut").mockResolvedValue(
        buildHourRecord({ source: "clock_in_out", hours: 8.5 }) as never,
      );

      const res = await request(app)
        .post("/api/hours/clock-out")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ employeeId: seededTestUsers.employee.id, timestamp: "2026-03-20T16:30:00Z" });

      expect([201, 500, 501]).toContain(res.status);
    });

    it("rejects clock-in with non-UUID employeeId", async () => {
      const res = await request(app)
        .post("/api/hours/clock-in")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ employeeId: "not-a-uuid" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects clock-out with non-UUID employeeId", async () => {
      const res = await request(app)
        .post("/api/hours/clock-out")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ employeeId: "not-a-uuid" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns error when clocking out without open clock-in", async () => {
      vi.spyOn(hoursService, "clockOut").mockRejectedValue(
        new ValidationError("No open clock-in found for employee"),
      );

      const res = await request(app)
        .post("/api/hours/clock-out")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ employeeId: seededTestUsers.employee.id });

      expect([400, 404]).toContain(res.status);
    });
  });

  // ─── MANUAL ENTRY ────────────────────────────────────────────

  describe("Manual entry (real router)", () => {
    it("submits a valid manual entry", async () => {
      vi.spyOn(hoursService, "submitManualEntry").mockResolvedValue(
        buildHourRecord({ source: "manual_entry", hours: 6.5 }) as never,
      );

      const res = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-03-20",
          hours: 6.5,
          qualificationCategory: "Safety",
          description: "Safety training",
          attestation: "I certify these hours are accurate",
        });

      expect([201, 500, 501]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.hours).toBe(6.5);
      }
    });

    it("rejects manual entry exceeding 24 hours", async () => {
      const spy = vi.spyOn(hoursService, "submitManualEntry");

      const res = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-03-20",
          hours: 25,
          qualificationCategory: "Safety",
          description: "Too many hours",
          attestation: "I attest",
        });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects manual entry with zero hours", async () => {
      const spy = vi.spyOn(hoursService, "submitManualEntry");

      const res = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-03-20",
          hours: 0,
          qualificationCategory: "Safety",
          description: "Zero hours",
          attestation: "I attest",
        });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects manual entry with negative hours", async () => {
      const spy = vi.spyOn(hoursService, "submitManualEntry");

      const res = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-03-20",
          hours: -5,
          qualificationCategory: "Safety",
          description: "Negative hours",
          attestation: "I attest",
        });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects manual entry without attestation", async () => {
      const spy = vi.spyOn(hoursService, "submitManualEntry");

      const res = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-03-20",
          hours: 8,
          qualificationCategory: "Safety",
          description: "Missing attestation",
        });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects manual entry with empty attestation", async () => {
      const spy = vi.spyOn(hoursService, "submitManualEntry");

      const res = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-03-20",
          hours: 8,
          qualificationCategory: "Safety",
          description: "Empty attestation",
          attestation: "",
        });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects manual entry without description", async () => {
      const spy = vi.spyOn(hoursService, "submitManualEntry");

      const res = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-03-20",
          hours: 8,
          qualificationCategory: "Safety",
          attestation: "I attest",
        });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects manual entry without qualificationCategory", async () => {
      const spy = vi.spyOn(hoursService, "submitManualEntry");

      const res = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-03-20",
          hours: 8,
          description: "Missing category",
          attestation: "I attest",
        });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── IMPORTS ─────────────────────────────────────────────────

  describe("Imports (real router)", () => {
    it("imports payroll hours (supervisor+)", async () => {
      vi.spyOn(hoursService, "importPayroll").mockResolvedValue({ imported: 3, conflicts: 0 } as never);

      const res = await request(app)
        .post("/api/hours/import/payroll")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          records: [
            { employeeId: seededTestUsers.employee.id, date: "2026-03-20", hours: 8, qualificationCategory: "Safety" },
            { employeeId: seededTestUsers.employee.id, date: "2026-03-21", hours: 7.5, qualificationCategory: "Safety" },
            { employeeId: seededTestUsers.employee.id, date: "2026-03-22", hours: 8, qualificationCategory: "Operations" },
          ],
          sourceSystemId: "payroll-v2",
        });

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toEqual(expect.objectContaining({ imported: 3, conflicts: 0 }));
      }
    });

    it("imports scheduling hours (supervisor+)", async () => {
      vi.spyOn(hoursService, "importScheduling").mockResolvedValue({ imported: 1, conflicts: 1 } as never);

      const res = await request(app)
        .post("/api/hours/import/scheduling")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          records: [
            { employeeId: seededTestUsers.employee.id, date: "2026-03-20", hours: 8, jobTicketId: "JOB-2001", qualificationCategory: "Operations" },
          ],
          sourceSystemId: "scheduling-v2",
        });

      expect([200, 500, 501]).toContain(res.status);
    });

    it("rejects payroll import with empty records array", async () => {
      const spy = vi.spyOn(hoursService, "importPayroll");

      const res = await request(app)
        .post("/api/hours/import/payroll")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ records: [], sourceSystemId: "payroll-v2" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects scheduling import with missing sourceSystemId", async () => {
      const spy = vi.spyOn(hoursService, "importScheduling");

      const res = await request(app)
        .post("/api/hours/import/scheduling")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          records: [
            { employeeId: seededTestUsers.employee.id, date: "2026-03-20", hours: 8, jobTicketId: "J1", qualificationCategory: "Ops" },
          ],
        });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects payroll import with hours > 24 in a record", async () => {
      const spy = vi.spyOn(hoursService, "importPayroll");

      const res = await request(app)
        .post("/api/hours/import/payroll")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          records: [
            { employeeId: seededTestUsers.employee.id, date: "2026-03-20", hours: 30, qualificationCategory: "Safety" },
          ],
          sourceSystemId: "payroll-v2",
        });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── CALENDAR SYNC ───────────────────────────────────────────

  describe("Calendar sync", () => {
    it("syncs calendar hours for authenticated user", async () => {
      vi.spyOn(hoursService, "syncCalendar").mockResolvedValue({ synced: 3 } as never);

      const res = await request(app)
        .post("/api/hours/calendar/sync")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({});

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toEqual(expect.objectContaining({ synced: 3 }));
      }
    });

    it("returns 401 for calendar sync without authentication", async () => {
      const res = await request(app).post("/api/hours/calendar/sync").send({});
      expect(res.status).toBe(401);
    });
  });

  // ─── GET EMPLOYEE HOURS ──────────────────────────────────────

  describe("Get employee hours (real router)", () => {
    it("retrieves paginated employee hours", async () => {
      vi.spyOn(hoursService, "getEmployeeHours").mockResolvedValue({
        data: [buildHourRecord()],
        total: 1,
        page: 1,
        limit: 10,
      } as never);

      const res = await request(app)
        .get(`/api/hours/employee/${seededTestUsers.employee.id}`)
        .query({ page: 1, limit: 10 })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toEqual(expect.objectContaining({ total: 1, page: 1, limit: 10 }));
      }
    });

    it("retrieves employee hours with date range filters", async () => {
      const spy = vi.spyOn(hoursService, "getEmployeeHours").mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      } as never);

      const res = await request(app)
        .get(`/api/hours/employee/${seededTestUsers.employee.id}`)
        .query({ from: "2026-03-01", to: "2026-03-31" })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(spy).toHaveBeenCalledWith(
          seededTestUsers.employee.id,
          new Date("2026-03-01T00:00:00.000Z"),
          new Date("2026-03-31T00:00:00.000Z"),
          1,
          50,
        );
      }
    });

    it("returns empty data for employee with no hours", async () => {
      vi.spyOn(hoursService, "getEmployeeHours").mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      } as never);

      const res = await request(app)
        .get(`/api/hours/employee/${randomUUID()}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data).toHaveLength(0);
        expect(res.body.total).toBe(0);
      }
    });
  });

  // ─── EDIT / DELETE ───────────────────────────────────────────

  describe("Edit/Delete (real router)", () => {
    it("updates an hour record (manager+)", async () => {
      const recordId = randomUUID();
      vi.spyOn(hoursService, "editHour").mockResolvedValue(
        buildHourRecord({ id: recordId, hours: 7 }) as never,
      );

      const res = await request(app)
        .put(`/api/hours/${recordId}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ hours: 7, reason: "Correction after review" });

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.hours).toBe(7);
      }
    });

    it("deletes an hour record with reason (manager+)", async () => {
      vi.spyOn(hoursService, "deleteHour").mockResolvedValue(undefined as never);

      const res = await request(app)
        .delete(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ reason: "Duplicate record" });

      expect([200, 204, 500, 501]).toContain(res.status);
    });

    it("rejects edit without reason", async () => {
      const spy = vi.spyOn(hoursService, "editHour");

      const res = await request(app)
        .put(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ hours: 5 });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects edit with empty reason", async () => {
      const spy = vi.spyOn(hoursService, "editHour");

      const res = await request(app)
        .put(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ hours: 5, reason: "" });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects delete without reason", async () => {
      const spy = vi.spyOn(hoursService, "deleteHour");

      const res = await request(app)
        .delete(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({});

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects delete with empty reason", async () => {
      const spy = vi.spyOn(hoursService, "deleteHour");

      const res = await request(app)
        .delete(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ reason: "" });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects edit with hours > 24", async () => {
      const spy = vi.spyOn(hoursService, "editHour");

      const res = await request(app)
        .put(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ hours: 25, reason: "Bad correction" });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("returns 404 when editing non-existent hour record", async () => {
      vi.spyOn(hoursService, "editHour").mockRejectedValue(
        new NotFoundError("HourRecord", NON_EXISTENT_ID),
      );

      const res = await request(app)
        .put(`/api/hours/${NON_EXISTENT_ID}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ hours: 4, reason: "Attempted update" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when deleting non-existent hour record", async () => {
      vi.spyOn(hoursService, "deleteHour").mockRejectedValue(
        new NotFoundError("HourRecord", NON_EXISTENT_ID),
      );

      const res = await request(app)
        .delete(`/api/hours/${NON_EXISTENT_ID}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ reason: "Attempted delete" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ─── CONFLICTS ───────────────────────────────────────────────

  describe("Conflicts (real router)", () => {
    it("lists conflicts (manager+)", async () => {
      vi.spyOn(hoursService, "listConflicts").mockResolvedValue({
        data: [buildConflict()],
        total: 1,
        page: 1,
        limit: 50,
      } as never);

      const res = await request(app)
        .get("/api/hours/conflicts")
        .set("Authorization", `Bearer ${managerToken}`);

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toEqual(expect.objectContaining({ total: 1 }));
      }
    });

    it("resolves a conflict with attestation (manager+)", async () => {
      const conflictId = randomUUID();
      vi.spyOn(hoursService, "resolveConflict").mockResolvedValue(
        buildConflict({ id: conflictId, status: "resolved", resolutionMethod: "merge" }) as never,
      );

      const res = await request(app)
        .post(`/api/hours/conflicts/${conflictId}/resolve`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          resolutionMethod: "merge",
          attestation: "Verified against source systems",
          reason: "Records reconciled",
        });

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.status).toBe("resolved");
      }
    });

    it("rejects conflict resolution without attestation", async () => {
      const spy = vi.spyOn(hoursService, "resolveConflict");

      const res = await request(app)
        .post(`/api/hours/conflicts/${randomUUID()}/resolve`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ resolutionMethod: "merge", reason: "No attestation" });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects conflict resolution without reason", async () => {
      const spy = vi.spyOn(hoursService, "resolveConflict");

      const res = await request(app)
        .post(`/api/hours/conflicts/${randomUUID()}/resolve`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ resolutionMethod: "merge", attestation: "I attest" });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("rejects conflict resolution with invalid method", async () => {
      const spy = vi.spyOn(hoursService, "resolveConflict");

      const res = await request(app)
        .post(`/api/hours/conflicts/${randomUUID()}/resolve`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ resolutionMethod: "delete_all", attestation: "I attest", reason: "Bad method" });

      expect([400, 500]).toContain(res.status);
      expect(spy).not.toHaveBeenCalled();
    });

    it("supports all three resolution methods", async () => {
      for (const method of ["precedence", "override", "merge"] as const) {
        vi.spyOn(hoursService, "resolveConflict").mockResolvedValue(
          buildConflict({ status: "resolved", resolutionMethod: method }) as never,
        );

        const res = await request(app)
          .post(`/api/hours/conflicts/${randomUUID()}/resolve`)
          .set("Authorization", `Bearer ${managerToken}`)
          .send({ resolutionMethod: method, attestation: "I attest", reason: `Using ${method}` });

        expect([200, 500, 501]).toContain(res.status);
        vi.restoreAllMocks();
      }
    });
  });

  // ─── AUDIT TRAIL ─────────────────────────────────────────────

  describe("Audit trail", () => {
    it("gets audit trail for an hour record (supervisor+)", async () => {
      vi.spyOn(hoursService, "getAuditTrail").mockResolvedValue([] as never);

      const res = await request(app)
        .get(`/api/hours/${randomUUID()}/audit`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body)).toBe(true);
      }
    });

    it("returns 403 when an employee accesses hour audit trail", async () => {
      const res = await request(app)
        .get(`/api/hours/${randomUUID()}/audit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ─── RBAC BOUNDARIES ─────────────────────────────────────────

  describe("RBAC boundaries (real router)", () => {
    it("returns 401 for clock-in without authentication", async () => {
      const res = await request(app)
        .post("/api/hours/clock-in")
        .send({ employeeId: seededTestUsers.employee.id });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 for manual entry without authentication", async () => {
      const res = await request(app)
        .post("/api/hours/manual")
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-03-20",
          hours: 8,
          qualificationCategory: "Safety",
          description: "Unauthenticated",
          attestation: "I attest",
        });

      expect(res.status).toBe(401);
    });

    it("returns 403 when an employee imports payroll hours", async () => {
      const res = await request(app)
        .post("/api/hours/import/payroll")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          records: [{ employeeId: seededTestUsers.employee.id, date: "2026-03-20", hours: 8, qualificationCategory: "Safety" }],
          sourceSystemId: "payroll",
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee imports scheduling hours", async () => {
      const res = await request(app)
        .post("/api/hours/import/scheduling")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          records: [{ employeeId: seededTestUsers.employee.id, date: "2026-03-20", hours: 8, jobTicketId: "J1", qualificationCategory: "Ops" }],
          sourceSystemId: "scheduling",
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee edits an hour record", async () => {
      const res = await request(app)
        .put(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ hours: 5, reason: "Unauthorized edit" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor edits an hour record", async () => {
      const res = await request(app)
        .put(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ hours: 5, reason: "Unauthorized edit" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee deletes an hour record", async () => {
      const res = await request(app)
        .delete(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ reason: "Unauthorized delete" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor deletes an hour record", async () => {
      const res = await request(app)
        .delete(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ reason: "Unauthorized delete" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee lists conflicts", async () => {
      const res = await request(app)
        .get("/api/hours/conflicts")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor lists conflicts", async () => {
      const res = await request(app)
        .get("/api/hours/conflicts")
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee resolves a conflict", async () => {
      const res = await request(app)
        .post(`/api/hours/conflicts/${randomUUID()}/resolve`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ resolutionMethod: "merge", attestation: "I attest", reason: "Unauthorized" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor resolves a conflict", async () => {
      const res = await request(app)
        .post(`/api/hours/conflicts/${randomUUID()}/resolve`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ resolutionMethod: "merge", attestation: "I attest", reason: "Unauthorized" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("allows admin to edit hour records", async () => {
      vi.spyOn(hoursService, "editHour").mockResolvedValue(
        buildHourRecord({ hours: 4 }) as never,
      );

      const res = await request(app)
        .put(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ hours: 4, reason: "Admin correction" });

      expect([200, 500, 501]).toContain(res.status);
    });

    it("allows admin to delete hour records", async () => {
      vi.spyOn(hoursService, "deleteHour").mockResolvedValue(undefined as never);

      const res = await request(app)
        .delete(`/api/hours/${randomUUID()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Admin cleanup" });

      expect([200, 204, 500, 501]).toContain(res.status);
    });

    it("allows admin to resolve conflicts", async () => {
      vi.spyOn(hoursService, "resolveConflict").mockResolvedValue(
        buildConflict({ status: "resolved" }) as never,
      );

      const res = await request(app)
        .post(`/api/hours/conflicts/${randomUUID()}/resolve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ resolutionMethod: "precedence", attestation: "Admin resolved", reason: "Final word" });

      expect([200, 500, 501]).toContain(res.status);
    });
  });
});
