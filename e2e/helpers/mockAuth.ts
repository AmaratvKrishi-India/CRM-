import { Page } from '@playwright/test';

export interface MockUserConfig {
  id: string;
  email: string;
  name: string;
  role: 'AGENT' | 'ADMIN';
  phone?: string;
  organizationId?: string;
}

export const MOCK_AGENT: MockUserConfig = {
  id: 'usr-agent-001',
  email: 'rahul@amaratvkrishi.com',
  name: 'Rahul Sharma',
  role: 'AGENT',
  phone: '9876543210',
  organizationId: 'org-lucknow-1',
};

export const MOCK_ADMIN: MockUserConfig = {
  id: 'usr-admin-001',
  email: 'admin@amaratvkrishi.com',
  name: 'Admin Vikram',
  role: 'ADMIN',
  phone: '9876543211',
  organizationId: 'org-lucknow-1',
};

/**
 * Sets up Supabase Auth and Profiles network route mocking for Playwright tests
 */
export async function setupAuthMocks(page: Page, user: MockUserConfig = MOCK_AGENT) {
  // Mock Supabase signInWithPassword endpoint
  await page.route('**/auth/v1/token*', async (route) => {
    const postData = route.request().postDataJSON() || {};
    if (postData.password === 'WrongPassword') {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
          message: 'Invalid login credentials',
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-jwt-token-12345',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token-12345',
        user: {
          id: user.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: user.email,
          phone: user.phone || '',
          created_at: '2026-01-01T00:00:00Z',
          app_metadata: { provider: 'email' },
          user_metadata: { name: user.name },
        },
      }),
    });
  });

  // Mock Supabase getUser endpoint
  await page.route('**/auth/v1/user*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: user.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: user.email,
        phone: user.phone || '',
        created_at: '2026-01-01T00:00:00Z',
      }),
    });
  });

  // Mock Supabase Profiles Table query
  await page.route('**/rest/v1/profiles*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: user.id,
          auth_user_id: user.id,
          organization_id: user.organizationId || 'org-lucknow-1',
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          status: 'ACTIVE',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ]),
    });
  });

  // Mock Supabase signOut endpoint
  await page.route('**/auth/v1/logout*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

/**
 * Performs login flow on the Login Screen
 */
export async function performLogin(page: Page, email: string = MOCK_AGENT.email, password: string = 'SecurePass123') {
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[placeholder="Enter your password"]');
  const submitButton = page.locator('button[type="submit"]');

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submitButton.click();
}
