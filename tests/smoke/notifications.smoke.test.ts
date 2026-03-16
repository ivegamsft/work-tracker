/**
 * Notifications Subsystem Smoke Tests
 * Tests: notification management
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loginAsAdmin, authenticatedGet, expectPaginatedResponse } from './helpers';

describe('Notifications Subsystem Smoke', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it('GET /api/notifications returns paginated list', async () => {
    const res = await authenticatedGet('/api/notifications', adminToken);
    await expectPaginatedResponse(res);
  });

  it('GET /api/notifications/preferences/:employeeId returns preferences', async () => {
    const fakeEmployeeId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedGet(`/api/notifications/preferences/${fakeEmployeeId}`, adminToken);
    
    // May return 404 or default preferences depending on implementation
    expect([200, 404]).toContain(res.status);
  });
});
