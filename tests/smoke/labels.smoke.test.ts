/**
 * Labels Subsystem Smoke Tests
 * Tests: label management and taxonomy
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loginAsAdmin, authenticatedGet, expectPaginatedResponse } from './helpers';

describe('Labels Subsystem Smoke', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it('GET /api/labels returns paginated list', async () => {
    const res = await authenticatedGet('/api/labels', adminToken);
    await expectPaginatedResponse(res);
  });

  it('GET /api/labels/:id with invalid ID returns 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedGet(`/api/labels/${fakeId}`, adminToken);
    expect(res.status).toBe(404);
  });
});
