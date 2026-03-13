import { HourRecord, HourConflict, AuditLog } from "../../common/types";
import {
  ClockInInput,
  ClockOutInput,
  ManualEntryInput,
  PayrollImportInput,
  SchedulingImportInput,
  ResolveConflictInput,
  EditHourInput,
} from "./validators";
import { notImplemented } from "../../common/utils";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface HoursService {
  clockIn(input: ClockInInput): Promise<HourRecord>;
  clockOut(input: ClockOutInput): Promise<HourRecord>;
  submitManualEntry(input: ManualEntryInput, submittedBy: string): Promise<HourRecord>;
  importPayroll(input: PayrollImportInput): Promise<{ imported: number; conflicts: number }>;
  importScheduling(input: SchedulingImportInput): Promise<{ imported: number; conflicts: number }>;
  syncCalendar(employeeId: string): Promise<{ synced: number }>;
  getEmployeeHours(employeeId: string, from?: Date, to?: Date, page?: number, limit?: number): Promise<PaginatedResult<HourRecord>>;
  listConflicts(page?: number, limit?: number): Promise<PaginatedResult<HourConflict>>;
  resolveConflict(conflictId: string, input: ResolveConflictInput, resolvedBy: string): Promise<HourConflict>;
  editHour(id: string, input: EditHourInput, editedBy: string): Promise<HourRecord>;
  deleteHour(id: string, reason: string, deletedBy: string): Promise<void>;
  getAuditTrail(recordId: string): Promise<AuditLog[]>;
}

export const hoursService: HoursService = {
  clockIn: () => notImplemented("clockIn"),
  clockOut: () => notImplemented("clockOut"),
  submitManualEntry: () => notImplemented("submitManualEntry"),
  importPayroll: () => notImplemented("importPayroll"),
  importScheduling: () => notImplemented("importScheduling"),
  syncCalendar: () => notImplemented("syncCalendar"),
  getEmployeeHours: () => notImplemented("getEmployeeHours"),
  listConflicts: () => notImplemented("listConflicts"),
  resolveConflict: () => notImplemented("resolveConflict"),
  editHour: () => notImplemented("editHour"),
  deleteHour: () => notImplemented("deleteHour"),
  getAuditTrail: () => notImplemented("getAuditTrail"),
};
