import { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Test credentials
// ---------------------------------------------------------------------------

export const TEST_USER = {
  email: 'test@example.com',
  password: 'Test1234!',
} as const;

export const ADMIN_USER = {
  email: 'admin@jogdoorwaar.sn',
  password: 'Admin1234!',
} as const;

// ---------------------------------------------------------------------------
// API base — matches NestJS backend
// ---------------------------------------------------------------------------

const API_BASE = process.env.API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// loginAs
// ---------------------------------------------------------------------------
// Bypasses the UI login form entirely for speed in test setup.
// Strategy:
//   1. Intercept POST /api/auth/login on the Next.js proxy before the real
//      network call goes out.
//   2. Inject an access token cookie and a mock httpOnly refresh-token cookie
//      so the app considers the session valid.
//   3. Navigate to /dashboard to prime any client-side auth state stores
//      (React Query / Zustand hydration).
//
// NOTE: If your Next.js API proxy is not at /api/auth/login, adjust the
//       route pattern below to match your actual Next.js route handler path.
// ---------------------------------------------------------------------------

export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  // Intercept the login request so tests never need a live backend.
  await page.route('**/api/auth/login', async (route) => {
    const mockToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
      '.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiQ0FORElEQVRFIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjk5OTk5OTk5OTl9' +
      '.mock-signature';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      // The backend sets httpOnly refresh token via Set-Cookie; here we
      // simulate the access token body the frontend expects.
      headers: {
        'Set-Cookie':
          'refresh_token=mock-refresh-token; HttpOnly; Path=/; SameSite=Lax',
      },
      body: JSON.stringify({
        access_token: mockToken,
        user: {
          id: 'test-user-id',
          email,
          firstName: 'Test',
          lastName: 'User',
          role: email === ADMIN_USER.email ? 'ADMIN' : 'CANDIDATE',
          plan: 'FREE',
        },
      }),
    });
  });

  // Navigate to login, submit credentials programmatically, then wait for
  // the app to redirect to /dashboard — which confirms the session is set.
  await page.goto('/login');

  // NOTE: add data-testid="email-input" to the email <input> component
  // NOTE: add data-testid="password-input" to the password <input> component
  // NOTE: add data-testid="login-submit" to the login submit <button>
  await page.locator('[data-testid="email-input"]').fill(email);
  await page.locator('[data-testid="password-input"]').fill(password);

  await Promise.all([
    page.waitForURL('**/dashboard'),
    page.locator('[data-testid="login-submit"]').click(),
  ]);
}

// ---------------------------------------------------------------------------
// loginAsTestUser — convenience wrapper
// ---------------------------------------------------------------------------

export async function loginAsTestUser(page: Page): Promise<void> {
  await loginAs(page, TEST_USER.email, TEST_USER.password);
}

// ---------------------------------------------------------------------------
// loginAsAdmin — convenience wrapper
// ---------------------------------------------------------------------------

export async function loginAsAdmin(page: Page): Promise<void> {
  // Admin login returns a different role claim — intercept separately so the
  // role field in the mock payload reflects ADMIN correctly.
  await page.route('**/api/auth/login', async (route) => {
    const mockAdminToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
      '.eyJzdWIiOiJhZG1pbi11c2VyLWlkIiwiZW1haWwiOiJhZG1pbkBqb2dkb29yd2Fhci5zbiIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ' +
      '.mock-admin-signature';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Set-Cookie':
          'refresh_token=mock-admin-refresh-token; HttpOnly; Path=/; SameSite=Lax',
      },
      body: JSON.stringify({
        access_token: mockAdminToken,
        user: {
          id: 'admin-user-id',
          email: ADMIN_USER.email,
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          plan: 'RECRUTEUR',
        },
      }),
    });
  });

  await page.goto('/login');
  await page.locator('[data-testid="email-input"]').fill(ADMIN_USER.email);
  await page.locator('[data-testid="password-input"]').fill(ADMIN_USER.password);

  await Promise.all([
    page.waitForURL('**/dashboard'),
    page.locator('[data-testid="login-submit"]').click(),
  ]);
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------
// Clears all auth state: cookies, localStorage, sessionStorage.
// Call this in afterEach hooks when test isolation requires a clean slate.
// ---------------------------------------------------------------------------

export async function logout(page: Page): Promise<void> {
  // Remove the httpOnly refresh token cookie via the logout endpoint if
  // the app exposes one; otherwise clear browser storage directly.
  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Set-Cookie':
          'refresh_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
      },
      body: JSON.stringify({ message: 'Logged out' }),
    });
  });

  // Clear all browser-side storage to remove access token from memory/store.
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Clear cookies (including httpOnly ones via Playwright context).
  await page.context().clearCookies();
}
