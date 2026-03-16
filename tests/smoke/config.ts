/**
 * Smoke Test Configuration
 * 
 * Supports running against different environments via API_BASE_URL env var
 */

export const config = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  timeout: 5000, // 5s timeout for smoke checks
  adminEmail: process.env.SMOKE_ADMIN_EMAIL || 'admin@example.com',
  adminPassword: process.env.SMOKE_ADMIN_PASSWORD || 'Password123!',
} as const;

export interface SmokeTestContext {
  apiBaseUrl: string;
  adminToken: string;
}
