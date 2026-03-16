/**
 * Smoke Test Helpers
 */
import { config } from './config';

/**
 * Login and return access token
 */
export async function loginAsAdmin(): Promise<string> {
  const res = await fetch(`${config.apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: config.adminEmail,
      password: config.adminPassword,
    }),
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json();
  return body.accessToken;
}

/**
 * Authenticated GET request
 */
export async function authenticatedGet(path: string, token: string) {
  return fetch(`${config.apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Check if response is successful and has expected shape
 */
export function expectSuccess(res: Response, expectedStatus = 200) {
  if (res.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus}, got ${res.status}`);
  }
}

/**
 * Check if response body has pagination shape
 */
export async function expectPaginatedResponse(res: Response) {
  expectSuccess(res);
  const body = await res.json();
  
  if (!body.data || !Array.isArray(body.data)) {
    throw new Error('Expected paginated response with data array');
  }
  
  if (typeof body.total !== 'number' || typeof body.page !== 'number' || typeof body.limit !== 'number') {
    throw new Error('Expected paginated response with total, page, and limit');
  }
  
  return body;
}
