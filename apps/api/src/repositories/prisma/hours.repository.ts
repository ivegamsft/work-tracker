import type {
  RecordsClockInRequest,
  RecordsClockOutRequest,
  RecordsEditHourRequest,
  RecordsManualEntryRequest,
  RecordsPayrollImportRequest,
  RecordsResolveConflictRequest,
  RecordsSchedulingImportRequest,
} from "@e-clat/shared";
import { hoursService } from "../../modules/hours/service";
import type { IHoursRepository } from "../interfaces";

export class PrismaHoursRepository {
  clockIn(input: RecordsClockInRequest) {
    return hoursService.clockIn(input);
  }

  clockOut(input: RecordsClockOutRequest) {
    return hoursService.clockOut(input);
  }

  submitManualEntry(input: RecordsManualEntryRequest, submittedBy: string) {
    return hoursService.submitManualEntry(input, submittedBy);
  }

  importPayroll(input: RecordsPayrollImportRequest) {
    return hoursService.importPayroll(input);
  }

  importScheduling(input: RecordsSchedulingImportRequest) {
    return hoursService.importScheduling(input);
  }

  syncCalendar(employeeId: string) {
    return hoursService.syncCalendar(employeeId);
  }

  getEmployeeHours(employeeId: string, from?: Date, to?: Date, page?: number, limit?: number) {
    return hoursService.getEmployeeHours(employeeId, from, to, page, limit);
  }

  listConflicts(page?: number, limit?: number) {
    return hoursService.listConflicts(page, limit);
  }

  resolveConflict(conflictId: string, input: RecordsResolveConflictRequest, resolvedBy: string) {
    return hoursService.resolveConflict(conflictId, input, resolvedBy);
  }

  editHour(id: string, input: RecordsEditHourRequest, editedBy: string) {
    return hoursService.editHour(id, input, editedBy);
  }

  deleteHour(id: string, reason: string, deletedBy: string) {
    return hoursService.deleteHour(id, reason, deletedBy);
  }

  getAuditTrail(recordId: string) {
    return hoursService.getAuditTrail(recordId);
  }
}

export const prismaHoursRepository = new PrismaHoursRepository() as IHoursRepository;
