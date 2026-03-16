/**
 * Standards Subsystem Smoke Tests
 * Tests: compliance standards and requirements
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loginAsAdmin, authenticatedGet, expectPaginatedResponse } from './helpers';

describe('Standards Subsystem Smoke', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it('GET /api/standards returns paginated list', async () => {
    const res = await authenticatedGet('/api/standards', adminToken);
    await expectPaginatedResponse(res);
  });

  it('GET /api/standards/:id with invalid ID returns 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedGet(`/api/standards/${fakeId}`, adminToken);
    expect(res.status).toBe(404);
  });
});
