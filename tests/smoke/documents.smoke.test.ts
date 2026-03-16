/**
 * Documents Subsystem Smoke Tests
 * Tests: document management, processing queue
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loginAsAdmin, authenticatedGet, expectPaginatedResponse } from './helpers';

describe('Documents Subsystem Smoke', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it('GET /api/documents returns paginated list', async () => {
    const res = await authenticatedGet('/api/documents', adminToken);
    await expectPaginatedResponse(res);
  });

  it('GET /api/documents/queue returns review queue', async () => {
    const res = await authenticatedGet('/api/documents/queue', adminToken);
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
