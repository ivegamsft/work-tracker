/**
 * Medical Subsystem Smoke Tests
 * Tests: medical clearances management
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loginAsAdmin, authenticatedGet } from './helpers';

describe('Medical Subsystem Smoke', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it('GET /api/medical/:id with invalid ID returns 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedGet(`/api/medical/${fakeId}`, adminToken);
    expect(res.status).toBe(404);
  });

  it('GET /api/medical/employee/:employeeId returns clearances', async () => {
    const fakeEmployeeId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedGet(`/api/medical/employee/${fakeEmployeeId}`, adminToken);
    
    // Returns empty array for non-existent employee (not 404)
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
