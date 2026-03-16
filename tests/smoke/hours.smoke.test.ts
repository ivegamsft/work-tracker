/**
 * Hours Subsystem Smoke Tests
 * Tests: hour records, clock-in/out
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loginAsAdmin, authenticatedGet, expectPaginatedResponse } from './helpers';

describe('Hours Subsystem Smoke', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it('GET /api/hours returns paginated list', async () => {
    const res = await authenticatedGet('/api/hours', adminToken);
    await expectPaginatedResponse(res);
  });

  it('GET /api/hours/conflicts returns list', async () => {
    const res = await authenticatedGet('/api/hours/conflicts', adminToken);
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
