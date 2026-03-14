import { Employee } from "@e-clat/shared";
import { CreateEmployeeInput, UpdateEmployeeInput } from "./validators";
import { notImplemented } from "../../common/utils";

export interface EmployeeReadiness {
  employee: Employee;
  qualifications: { total: number; active: number; expiringSoon: number; expired: number };
  hours: { totalThisMonth: number; totalThisYear: number };
  medicalClearance: { status: string; expiresAt: Date | null };
  overallStatus: "compliant" | "at_risk" | "non_compliant";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface EmployeesService {
  create(input: CreateEmployeeInput): Promise<Employee>;
  getById(id: string): Promise<Employee>;
  update(id: string, input: UpdateEmployeeInput): Promise<Employee>;
  list(filters?: Record<string, unknown>): Promise<PaginatedResult<Employee>>;
  getReadiness(id: string): Promise<EmployeeReadiness>;
}

export const employeesService: EmployeesService = {
  create: () => notImplemented("createEmployee"),
  getById: () => notImplemented("getEmployee"),
  update: () => notImplemented("updateEmployee"),
  list: () => notImplemented("listEmployees"),
  getReadiness: () => notImplemented("getReadiness"),
};
