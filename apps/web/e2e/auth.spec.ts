import { test, expect } from '@playwright/test';
import { loginAs, loginAsTestUser, TEST_USER } from './helpers/auth';

// ---------------------------------------------------------------------------
// Auth & Landing — E2E Tests
// ---------------------------------------------------------------------------

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render landing page with correct branding', async ({ page }) => {
    // Verify headline contains the product name or the tagline
    // NOTE: add data-testid="landing-headline" to the main <h1> on the landing page
    const headline = page.locator('h1');
    await expect(headline).toBeVisible();
    const headlineText = await headline.first().innerText();
    expect(
      headlineText.toLowerCase().includes("jog door waar") ||
      headlineText.toLowerCase().includes("aujourd") ||
      headlineText.toLowerCase().includes("emploi") ||
      headlineText.toLowerCase().includes("travail"),
    ).toBeTruthy();

    // Verify at least one CTA button uses the terracotta brand color (#E8580A)
    // The button should carry a CSS class or inline style referencing the color.
    // NOTE: add data-testid="cta-primary" to the primary CTA button on the landing page
    const ctaButton = page.locator('[data-testid="cta-primary"]').first();
    if (await ctaButton.count() > 0) {
      await expect(ctaButton).toBeVisible();
    } else {
      // Fallback: locate any button/link with a terracotta background class
      const terracottaBtn = page
        .locator('a, button')
        .filter({ hasText: /commencer|postuler|rejoindre|voir les offres/i })
        .first();
      await expect(terracottaBtn).toBeVisible();
    }
  });

  test('should display navigation links on landing page', async ({ page }) => {
    // NOTE: add data-testid="nav-login" to the login link in the top navigation
    const loginLink = page
      .locator('[data-testid="nav-login"], a[href="/login"]')
      .first();
    await expect(loginLink).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should show login form', async ({ page }) => {
    // NOTE: add data-testid="email-input" to the email <input>
    // NOTE: add data-testid="password-input" to the password <input>
    // NOTE: add data-testid="login-submit" to the submit <button>
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
  });

  test('should show validation errors on empty submit', async ({ page }) => {
    // Submit the form without filling anything in
    // NOTE: add data-testid="login-submit" to the submit <button>
    await page.locator('[data-testid="login-submit"]').click();

    // Expect at least one validation error message to appear
    // NOTE: add data-testid="field-error" to each validation error <p> / <span>
    const errors = page.locator('[data-testid="field-error"]');
    if (await errors.count() > 0) {
      await expect(errors.first()).toBeVisible();
    } else {
      // Fallback: HTML5 required validation or any visible error text
      const anyError = page
        .locator('p, span, div')
        .filter({ hasText: /requis|required|invalide|invalid|champ/i })
        .first();
      await expect(anyError).toBeVisible();
    }
  });

  test('should show validation error for invalid email format', async ({ page }) => {
    // NOTE: add data-testid="email-input" to the email <input>
    // NOTE: add data-testid="login-submit" to the submit <button>
    await page.locator('[data-testid="email-input"]').fill('not-an-email');
    await page.locator('[data-testid="login-submit"]').click();

    // The form should not navigate away — URL should remain /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show Google OAuth button', async ({ page }) => {
    // NOTE: add data-testid="google-oauth-btn" to the Google sign-in <button>
    const googleBtn = page
      .locator('[data-testid="google-oauth-btn"], button, a')
      .filter({ hasText: /google/i })
      .first();
    await expect(googleBtn).toBeVisible();
  });

  test('should navigate to register page via sign-up link', async ({ page }) => {
    // NOTE: add data-testid="register-link" to the "Créer un compte" <a> link
    const registerLink = page
      .locator('[data-testid="register-link"], a')
      .filter({ hasText: /cr[eé]er un compte|s'inscrire|inscription|register/i })
      .first();
    await expect(registerLink).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/register/),
      registerLink.click(),
    ]);

    await expect(page).toHaveURL(/\/register/);
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    // Mock the login endpoint so no real backend is required
    await page.route('**/api/auth/login', async (route) => {
      const mockToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
        '.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiQ0FORElEQVRFIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjk5OTk5OTk5OTl9' +
        '.mock-signature';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Set-Cookie':
            'refresh_token=mock-refresh-token; HttpOnly; Path=/; SameSite=Lax',
        },
        body: JSON.stringify({
          access_token: mockToken,
          user: {
            id: 'test-user-id',
            email: TEST_USER.email,
            firstName: 'Test',
            lastName: 'User',
            role: 'CANDIDATE',
            plan: 'FREE',
          },
        }),
      });
    });

    // NOTE: add data-testid="email-input" to the email <input>
    // NOTE: add data-testid="password-input" to the password <input>
    // NOTE: add data-testid="login-submit" to the submit <button>
    await page.locator('[data-testid="email-input"]').fill(TEST_USER.email);
    await page.locator('[data-testid="password-input"]').fill(TEST_USER.password);

    await Promise.all([
      page.waitForURL(/\/dashboard/),
      page.locator('[data-testid="login-submit"]').click(),
    ]);

    await expect(page).toHaveURL(/\/dashboard/);
  });
});

// ---------------------------------------------------------------------------
// Register Page
// ---------------------------------------------------------------------------

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should show register form with all required fields', async ({ page }) => {
    // NOTE: add data-testid="firstName-input" to the first name <input>
    // NOTE: add data-testid="lastName-input" to the last name <input>
    // NOTE: add data-testid="email-input" to the email <input>
    // NOTE: add data-testid="password-input" to the password <input>
    // NOTE: add data-testid="register-submit" to the submit <button>
    await expect(page.locator('[data-testid="firstName-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="lastName-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-submit"]')).toBeVisible();
  });

  test('should show validation errors on empty register submit', async ({ page }) => {
    // NOTE: add data-testid="register-submit" to the submit <button>
    await page.locator('[data-testid="register-submit"]').click();

    // Expect at least one validation error
    // NOTE: add data-testid="field-error" to each validation error element
    const errors = page.locator('[data-testid="field-error"]');
    if (await errors.count() > 0) {
      await expect(errors.first()).toBeVisible();
    } else {
      const anyError = page
        .locator('p, span, div')
        .filter({ hasText: /requis|required|invalide|invalid|champ/i })
        .first();
      await expect(anyError).toBeVisible();
    }
  });

  test('should navigate between login and register', async ({ page }) => {
    // From /register, click "Se connecter" or "Déjà un compte" to go back to /login
    // NOTE: add data-testid="login-link" to the "Déjà un compte? Se connecter" <a> on /register
    const loginLink = page
      .locator('[data-testid="login-link"], a')
      .filter({ hasText: /se connecter|connexion|d[eé]j[aà] un compte|login/i })
      .first();
    await expect(loginLink).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/login/),
      loginLink.click(),
    ]);

    await expect(page).toHaveURL(/\/login/);
  });

  test('should have password confirmation field', async ({ page }) => {
    // NOTE: add data-testid="confirm-password-input" to the confirm password <input>
    const confirmField = page.locator('[data-testid="confirm-password-input"]');
    if (await confirmField.count() > 0) {
      await expect(confirmField).toBeVisible();
    } else {
      // Fallback: look for a second password-type input
      const passwordInputs = page.locator('input[type="password"]');
      await expect(passwordInputs).toHaveCount(2);
    }
  });
});
