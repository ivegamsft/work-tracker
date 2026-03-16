/**
 * Auth Subsystem Smoke Tests
 * Tests: login, token validation, basic auth flows
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { config } from './config';
import { loginAsAdmin, expectSuccess } from './helpers';

describe('Auth Subsystem Smoke', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it('POST /api/auth/login succeeds with valid credentials', async () => {
    const res = await fetch(`${config.apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: config.adminEmail,
        password: config.adminPassword,
      }),
    });

    expectSuccess(res);
    const body = await res.json();
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body).toHaveProperty('expiresIn');
  });

  it('POST /api/auth/login fails with invalid credentials', async () => {
    const res = await fetch(`${config.apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: config.adminEmail,
        password: 'wrong-password',
      }),
    });

    expect(res.status).toBe(401);
  });

  it('authenticated request with valid token succeeds', async () => {
    const res = await fetch(`${config.apiBaseUrl}/api/employees`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expectSuccess(res);
  });

  it('request without token returns 401', async () => {
    const res = await fetch(`${config.apiBaseUrl}/api/employees`);
    expect(res.status).toBe(401);
  });
});
