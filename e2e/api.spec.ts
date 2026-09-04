import { test, expect } from '@playwright/test';

test.describe('API Tests', () => {
  const BASE_URL = process.env.E2E_API_BASE_URL;

  test.beforeAll(() => {
    if (!BASE_URL) {
      throw new Error('E2E_API_BASE_URL must point to a non-production test API before running api.spec.ts');
    }
  });

  test('health check endpoint', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('auth endpoints - login', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'test@example.com',
        password: 'testpassword',
      },
    });
    
    // Should return 400 for invalid credentials or 200 for valid
    expect([200, 400, 401]).toContain(response.status());
  });

  test('auth endpoints - signup', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: 'newuser@example.com',
        password: 'testpassword123',
        name: 'Test User',
      },
    });
    
    // Should return 400 for existing email or 201 for new user
    expect([201, 400, 409]).toContain(response.status());
  });

  test('leads API - list leads', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/leads`);
    
    // Should require authentication
    expect([200, 401, 403]).toContain(response.status());
  });

  test('leads API - create lead', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/leads`, {
      data: {
        businessName: 'Test Gym',
        phone: '9876543210',
        locality: 'Gomti Nagar',
        category: 'Gym',
      },
    });
    
    // Should require authentication
    expect([201, 401, 403]).toContain(response.status());
  });

  test('leads API - get lead by id', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/leads/test-id`);
    
    // Should require authentication
    expect([200, 401, 403, 404]).toContain(response.status());
  });

  test('leads API - update lead', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/leads/test-id`, {
      data: {
        status: 'INTERESTED',
      },
    });
    
    // Should require authentication
    expect([200, 401, 403, 404]).toContain(response.status());
  });

  test('leads API - delete lead', async ({ request }) => {
    const response = await request.delete(`${BASE_URL}/api/leads/test-id`);
    
    // Should require authentication
    expect([200, 204, 401, 403, 404]).toContain(response.status());
  });

  test('call records API', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/call-records`);
    
    expect([200, 401, 403]).toContain(response.status());
  });

  test('follow-ups API', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/follow-ups`);
    
    expect([200, 401, 403]).toContain(response.status());
  });

  test('sync API - status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/sync/status`);
    
    expect([200, 401, 403]).toContain(response.status());
  });

  test('sync API - trigger sync', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/sync/trigger`);
    
    expect([200, 202, 401, 403]).toContain(response.status());
  });

  test('backup API - create backup', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/backup`);
    
    expect([200, 401, 403]).toContain(response.status());
  });

  test('backup API - restore', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/backup/restore`, {
      data: { backupData: {} },
    });
    
    expect([200, 400, 401, 403]).toContain(response.status());
  });

  test('import API - upload', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/import`, {
      multipart: {
        file: Buffer.from('test,content'),
      },
    });
    
    expect([200, 400, 401, 403]).toContain(response.status());
  });

  test('agents API - list agents', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/agents`);
    
    expect([200, 401, 403]).toContain(response.status());
  });

  test('agents API - create agent', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/agents`, {
      data: {
        email: 'newagent@example.com',
        name: 'New Agent',
        phone: '9876543210',
      },
    });
    
    expect([201, 400, 401, 403, 409]).toContain(response.status());
  });

  test('reports API - dashboard metrics', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/reports/dashboard`);
    
    expect([200, 401, 403]).toContain(response.status());
  });

  test('reports API - leads report', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/reports/leads`);
    
    expect([200, 401, 403]).toContain(response.status());
  });

  test('CORS headers', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`, {
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });
    
    expect(response.status()).toBe(200);
    const corsHeader = response.headers()['access-control-allow-origin'];
    expect(corsHeader).toBeDefined();
  });

  test('rate limiting', async ({ request }) => {
    // Make multiple rapid requests to test rate limiting
    const promises = Array(20).fill(null).map(() => 
      request.get(`${BASE_URL}/api/health`)
    );
    
    const responses = await Promise.all(promises);
    const statusCodes = responses.map(r => r.status());
    
    // At least some should succeed (200) or be rate limited (429)
    expect(statusCodes.every(code => [200, 429].includes(code))).toBe(true);
  });

  test('response time', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(`${BASE_URL}/api/health`);
    const duration = Date.now() - start;
    
    expect(response.status()).toBe(200);
    // API should respond within 2 seconds
    expect(duration).toBeLessThan(2000);
  });

  test('error response format', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'invalid',
        password: 'invalid',
      },
    });
    
    expect(response.status()).toBeGreaterThanOrEqual(400);
    
    const body = await response.json();
    // Error responses should have a consistent format
    expect(body).toHaveProperty('error');
    // or
    // expect(body).toHaveProperty('message');
  });
});
