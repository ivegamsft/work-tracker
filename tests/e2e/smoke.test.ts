/**
 * E2E Smoke Tests — runs against the live Docker stack
 * Prerequisite: `docker compose up -d` with all services running
 *
 * Tests the full request path: HTTP → API → Postgres (where applicable)
 */
import { describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:3000';
const WEB_BASE = 'http://localhost:5173';
const PASSWORD = 'Password123!';
const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000';

const roles = [
  { email: 'admin@example.com', role: 'admin', canListEmployees: true, canListQualifications: true },
  { email: 'supervisor@example.com', role: 'supervisor', canListEmployees: true, canListQualifications: true },
  { email: 'manager@example.com', role: 'manager', canListEmployees: true, canListQualifications: true },
  { email: 'compliance@example.com', role: 'compliance_officer', canListEmployees: true, canListQualifications: true },
  { email: 'employee@example.com', role: 'employee', canListEmployees: false, canListQualifications: false },
] as const;

type RoleFixture = (typeof roles)[number];
type LoginBody = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

type AccessTokenPayload = {
  id: string;
  email: string;
  role: RoleFixture['role'];
  tokenType: 'access' | 'refresh';
  exp: number;
  iat: number;
};

const loginCache = new Map<string, Promise<LoginBody>>();

async function login(email: string, password: string) {
  return fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

async function loginAs(user: RoleFixture) {
  const cached = loginCache.get(user.email);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const res = await login(user.email, PASSWORD);
    expect(res.status).toBe(200);

    const body = (await res.json()) as LoginBody;
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.expiresIn).toBe(3600);

    return body;
  })();

  loginCache.set(user.email, request);
  return request;
}

function decodeJwtPayload(token: string): AccessTokenPayload {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('JWT payload is missing');
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AccessTokenPayload;
}

async function authenticatedGet(path: string, token: string) {
  return fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe('E2E Smoke Tests', () => {
  describe('Health', () => {
    it('GET /health returns 200 with status ok', async () => {
      const res = await fetch(`${API_BASE}/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('e-clat');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('Auth', () => {
    it('POST /api/auth/login succeeds with valid credentials', async () => {
      const res = await login('admin@example.com', PASSWORD);
      expect(res.status).toBe(200);
      const body = (await res.json()) as LoginBody;
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.expiresIn).toBe(3600);
    });

    it('POST /api/auth/login fails with wrong password', async () => {
      const res = await login('admin@example.com', 'wrong');
      expect(res.status).toBe(401);
    });

    it('POST /api/auth/login fails with unknown email', async () => {
      const res = await login('nobody@example.com', PASSWORD);
      expect(res.status).toBe(401);
    });
  });

  describe('Role-based access', () => {
    describe.each(roles)('$role', (user) => {
      it('login succeeds and JWT includes the correct role claim', async () => {
        const body = await loginAs(user);
        const payload = decodeJwtPayload(body.accessToken);

        expect(payload.email).toBe(user.email);
        expect(payload.role).toBe(user.role);
        expect(payload.tokenType).toBe('access');
        expect(payload.id).toBeDefined();
      });

      it('checks GET /api/employees access by role', async () => {
        const { accessToken } = await loginAs(user);
        const res = await authenticatedGet('/api/employees', accessToken);

        expect(res.status).toBe(user.canListEmployees ? 200 : 403);

        if (user.canListEmployees) {
          const body = await res.json();
          expect(body).toHaveProperty('data');
          expect(body).toHaveProperty('total');
          expect(body).toHaveProperty('page');
          expect(body).toHaveProperty('limit');
          expect(Array.isArray(body.data)).toBe(true);

          if (body.data.length > 0) {
            const employee = body.data[0];
            expect(employee).toHaveProperty('id');
            expect(employee).toHaveProperty('firstName');
            expect(employee).toHaveProperty('lastName');
            expect(employee).toHaveProperty('email');
            expect(employee).toHaveProperty('role');
            expect(employee).toHaveProperty('isActive');
          }
        }
      });

      it('checks GET /api/standards access by role', async () => {
        const { accessToken } = await loginAs(user);
        const res = await authenticatedGet('/api/standards', accessToken);

        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
      });

      it('checks GET /api/qualifications access by role', async () => {
        const { accessToken } = await loginAs(user);
        const res = await authenticatedGet('/api/qualifications', accessToken);

        expect(res.status).toBe(user.canListQualifications ? 200 : 403);

        if (user.canListQualifications) {
          const body = await res.json();
          expect(body).toHaveProperty('data');
          expect(Array.isArray(body.data)).toBe(true);
        }
      });

      it('checks GET /api/medical/:id access by role', async () => {
        const { accessToken } = await loginAs(user);
        const res = await authenticatedGet(`/api/medical/${NONEXISTENT_ID}`, accessToken);

        expect(res.status).toBe(404);
      });
    });
  });

  describe('Protected endpoints reject missing auth', () => {
    it('GET /api/employees without auth returns 401', async () => {
      const res = await fetch(`${API_BASE}/api/employees`);
      expect(res.status).toBe(401);
    });

    it('GET /api/standards without auth returns 401', async () => {
      const res = await fetch(`${API_BASE}/api/standards`);
      expect(res.status).toBe(401);
    });

    it('GET /api/qualifications without auth returns 401', async () => {
      const res = await fetch(`${API_BASE}/api/qualifications`);
      expect(res.status).toBe(401);
    });

    it('GET /api/medical/:id without auth returns 401', async () => {
      const res = await fetch(`${API_BASE}/api/medical/${NONEXISTENT_ID}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Web App', () => {
    it('serves index.html on root', async () => {
      const res = await fetch(WEB_BASE);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html.toLowerCase()).toContain('<!doctype html>');
      expect(html.toLowerCase()).toContain('e-clat');
    });
  });
});
