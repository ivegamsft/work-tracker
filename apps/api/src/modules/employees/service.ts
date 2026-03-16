import type { Employee } from "@e-clat/shared";
import type {
  EmployeeDetails,
  EmployeeListFilters,
  EmployeeReadiness,
  IEmployeeRepository,
  PaginatedResult,
} from "../../repositories/interfaces";
import { prismaEmployeeRepository } from "../../repositories/prisma/employee.repository";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "./validators";

export interface EmployeesService {
  create(input: CreateEmployeeInput): Promise<Employee>;
  getById(id: string): Promise<EmployeeDetails>;
  update(id: string, input: UpdateEmployeeInput): Promise<Employee>;
  list(filters?: EmployeeListFilters): Promise<PaginatedResult<Employee>>;
  getReadiness(id: string): Promise<EmployeeReadiness>;
}

export function createEmployeesService(employeeRepository: IEmployeeRepository = prismaEmployeeRepository): EmployeesService {
  return {
    create(input) {
      return employeeRepository.create(input);
    },
    getById(id) {
      return employeeRepository.getById(id);
    },
    update(id, input) {
      return employeeRepository.update(id, input);
    },
    list(filters) {
      return employeeRepository.list(filters);
    },
    getReadiness(id) {
      return employeeRepository.getReadiness(id);
    },
  };
}

export const employeesService = createEmployeesService();

export type { EmployeeDetails, EmployeeListFilters, EmployeeReadiness, PaginatedResult };
