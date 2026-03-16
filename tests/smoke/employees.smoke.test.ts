/**
 * Employees Subsystem Smoke Tests
 * Tests: list employees, basic CRUD operations
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loginAsAdmin, authenticatedGet, expectPaginatedResponse } from './helpers';

describe('Employees Subsystem Smoke', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it('GET /api/employees returns paginated list', async () => {
    const res = await authenticatedGet('/api/employees', adminToken);
    const body = await expectPaginatedResponse(res);

    // Should have seeded employees
    expect(body.data.length).toBeGreaterThan(0);
    
    // Check employee shape
    const employee = body.data[0];
    expect(employee).toHaveProperty('id');
    expect(employee).toHaveProperty('firstName');
    expect(employee).toHaveProperty('lastName');
    expect(employee).toHaveProperty('email');
    expect(employee).toHaveProperty('role');
  });

  it('GET /api/employees/:id returns single employee', async () => {
    // First get the list to get a valid ID
    const listRes = await authenticatedGet('/api/employees', adminToken);
    const listBody = await listRes.json();
    const employeeId = listBody.data[0].id;

    const res = await authenticatedGet(`/api/employees/${employeeId}`, adminToken);
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(body.id).toBe(employeeId);
  });

  it('GET /api/employees/:id with invalid ID returns 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedGet(`/api/employees/${fakeId}`, adminToken);
    expect(res.status).toBe(404);
  });
});
