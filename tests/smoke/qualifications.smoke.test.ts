/**
 * Qualifications Subsystem Smoke Tests
 * Tests: qualifications management
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loginAsAdmin, authenticatedGet, expectPaginatedResponse } from './helpers';

describe('Qualifications Subsystem Smoke', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it('GET /api/qualifications returns paginated list', async () => {
    const res = await authenticatedGet('/api/qualifications', adminToken);
    await expectPaginatedResponse(res);
  });

  it('GET /api/qualifications/:id with invalid ID returns 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedGet(`/api/qualifications/${fakeId}`, adminToken);
    expect(res.status).toBe(404);
  });
});
