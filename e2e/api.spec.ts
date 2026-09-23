import { test, expect } from '@playwright/test';

/**
 * The app is a local-first React client. It does not expose a separate /api/*
 * server; its authenticated HTTP boundary is the local Supabase gateway.
 *
 * Run this suite only with an explicit loopback E2E_API_BASE_URL, for example:
 * E2E_API_BASE_URL=http://127.0.0.1:15432
 */
const BASE_URL = process.env.E2E_API_BASE_URL?.trim();

function assertLoopbackURL(value: string): void {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol) || !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error('E2E_API_BASE_URL must point to a loopback-only local test service');
  }
}

function endpoint(path: string): string {
  return [BASE_URL, path].join('');
}

test.describe('Local API boundary', () => {
  test.beforeAll(() => {
    if (!BASE_URL) {
      throw new Error('E2E_API_BASE_URL must explicitly point to a loopback-only local test service');
    }
    assertLoopbackURL(BASE_URL);
  });

  test('Supabase Auth health endpoint is available', async ({ request }) => {
    const response = await request.get(endpoint('/auth/v1/health'));
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('name');
  });

  test('REST gateway protects lead data without an API key', async ({ request }) => {
    const response = await request.get(endpoint('/rest/v1/leads'));
    expect([401, 403]).toContain(response.status());
  });

  test('REST gateway protects call records without an API key', async ({ request }) => {
    const response = await request.get(endpoint('/rest/v1/call_records'));
    expect([401, 403]).toContain(response.status());
  });

  test('REST gateway protects follow-ups without an API key', async ({ request }) => {
    const response = await request.get(endpoint('/rest/v1/follow_ups'));
    expect([401, 403]).toContain(response.status());
  });

  test('Auth login rejects invalid credentials without creating data', async ({ request }) => {
    const response = await request.post(endpoint('/auth/v1/token?grant_type=password'), {
      data: {
        email: 'invalid-local-test@example.invalid',
        password: 'invalid-password',
      },
    });
    expect([400, 401, 422]).toContain(response.status());
  });

  test('Auth signup rejects invalid input without creating data', async ({ request }) => {
    const response = await request.post(endpoint('/auth/v1/signup'), {
      data: {
        email: 'not-an-email',
        password: 'short',
      },
    });
    expect([400, 401, 422]).toContain(response.status());
  });

  test('health endpoint returns CORS headers for a local origin', async ({ request }) => {
    const response = await request.get(endpoint('/auth/v1/health'), {
      headers: {
        Origin: 'http://localhost:3000',
      },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['access-control-allow-origin']).toBeDefined();
  });

  test('health endpoint responds within two seconds', async ({ request }) => {
    const startedAt = Date.now();
    const response = await request.get(endpoint('/auth/v1/health'));
    const duration = Date.now() - startedAt;

    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(2000);
  });

  test('health endpoint tolerates a bounded burst', async ({ request }) => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => request.get(endpoint('/auth/v1/health'))),
    );
    expect(responses.every((response) => [200, 429].includes(response.status()))).toBe(true);
  });

  test('invalid Auth input returns a structured error response', async ({ request }) => {
    const response = await request.post(endpoint('/auth/v1/token?grant_type=password'), {
      data: {
        email: 'invalid-local-test@example.invalid',
        password: 'invalid-password',
      },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);

    const body = await response.json();
    expect(
      ['error', 'error_description', 'msg', 'message'].some((field) => Object.prototype.hasOwnProperty.call(body, field)),
    ).toBe(true);
  });
});
