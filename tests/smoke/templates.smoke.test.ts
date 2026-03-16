/**
 * Templates Subsystem Smoke Tests
 * Tests: list templates, assignments, fulfillments
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loginAsAdmin, authenticatedGet, expectPaginatedResponse } from './helpers';

describe('Templates Subsystem Smoke', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it('GET /api/templates returns paginated list', async () => {
    const res = await authenticatedGet('/api/templates', adminToken);
    await expectPaginatedResponse(res);
  });

  it('GET /api/assignments returns paginated list', async () => {
    const res = await authenticatedGet('/api/assignments', adminToken);
    await expectPaginatedResponse(res);
  });

  it('GET /api/fulfillments returns paginated list', async () => {
    const res = await authenticatedGet('/api/fulfillments', adminToken);
    await expectPaginatedResponse(res);
  });
});
