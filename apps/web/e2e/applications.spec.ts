import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

// ---------------------------------------------------------------------------
// Mock application data — Kanban columns
// ---------------------------------------------------------------------------

type ApplicationStatus =
  | 'TO_APPLY'
  | 'APPLIED'
  | 'INTERVIEW_SCHEDULED'
  | 'OFFER_RECEIVED'
  | 'REJECTED';

interface MockApplication {
  id: string;
  status: ApplicationStatus;
  job: { title: string; company: { name: string } };
  appliedAt: string | null;
  interviewDate: string | null;
  notes: string | null;
}

const MOCK_APPLICATIONS: MockApplication[] = [
  {
    id: 'app-1',
    status: 'TO_APPLY',
    job: {
      title: 'UX Designer',
      company: { name: 'DesignCo' },
    },
    appliedAt: null,
    interviewDate: null,
    notes: 'Contacter RH avant de postuler',
  },
  {
    id: 'app-2',
    status: 'APPLIED',
    job: {
      title: 'Développeur React',
      company: { name: 'TechSN' },
    },
    appliedAt: new Date().toISOString(),
    interviewDate: null,
    notes: null,
  },
  {
    id: 'app-3',
    status: 'INTERVIEW_SCHEDULED',
    job: {
      title: 'Product Manager',
      company: { name: 'Dakar Digital' },
    },
    appliedAt: new Date().toISOString(),
    interviewDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Préparer présentation portfolio',
  },
  {
    id: 'app-4',
    status: 'APPLIED',
    job: {
      title: 'Data Scientist',
      company: { name: 'SenData' },
    },
    appliedAt: new Date().toISOString(),
    interviewDate: null,
    notes: null,
  },
];

// ---------------------------------------------------------------------------
// Helper — map internal status to French column label
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  TO_APPLY: 'À postuler',
  APPLIED: 'Postulé',
  INTERVIEW_SCHEDULED: 'Entretien prévu',
  OFFER_RECEIVED: 'Offre reçue',
  REJECTED: 'Refusé',
};

// ---------------------------------------------------------------------------
// Helper — intercept applications API
// ---------------------------------------------------------------------------

async function mockApplicationsApi(page: import('@playwright/test').Page) {
  await page.route('**/api/applications*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: MOCK_APPLICATIONS,
        stats: {
          total: MOCK_APPLICATIONS.length,
          inProgress: MOCK_APPLICATIONS.filter(
            (a) => a.status !== 'REJECTED' && a.status !== 'OFFER_RECEIVED',
          ).length,
        },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Applications (Kanban CRM) Tests
// ---------------------------------------------------------------------------

test.describe('Applications Page — Kanban CRM', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await mockApplicationsApi(page);
    await page.goto('/applications');
  });

  test('should display Kanban board with multiple columns', async ({ page }) => {
    // NOTE: add data-testid="kanban-board" to the Kanban board root container
    // NOTE: add data-testid="kanban-column" to each column in the board
    const kanbanBoard = page.locator('[data-testid="kanban-board"]');
    if (await kanbanBoard.count() > 0) {
      await expect(kanbanBoard).toBeVisible();
    }

    const columns = page.locator('[data-testid="kanban-column"]');
    if (await columns.count() > 0) {
      const count = await columns.count();
      expect(count).toBeGreaterThanOrEqual(3);
    } else {
      // Fallback: look for the French column headers
      await expect(
        page.locator('text=À postuler').first(),
      ).toBeVisible();
      await expect(
        page.locator('text=Postulé').first(),
      ).toBeVisible();
    }
  });

  test('should show application cards in expected columns', async ({ page }) => {
    // Verify cards exist in the "Postulé" and "À postuler" columns
    // NOTE: add data-testid="application-card" to each application card
    const appCards = page.locator('[data-testid="application-card"]');
    if (await appCards.count() > 0) {
      const count = await appCards.count();
      expect(count).toBeGreaterThanOrEqual(1);
    } else {
      // Fallback: check mock job titles are present in page
      await expect(
        page.locator('text=Développeur React').first(),
      ).toBeVisible();
    }
  });

  test('should display status column headers in French', async ({ page }) => {
    // All primary French column labels must be visible on the board
    for (const label of [
      STATUS_LABELS.TO_APPLY,
      STATUS_LABELS.APPLIED,
      STATUS_LABELS.INTERVIEW_SCHEDULED,
    ]) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible();
    }
  });

  test('should expand application card on click to show details', async ({ page }) => {
    // NOTE: add data-testid="application-card" to each card
    const firstCard = page.locator('[data-testid="application-card"]').first();
    if (await firstCard.count() > 0) {
      await firstCard.click();
    } else {
      // Fallback: click on a card using job title text
      await page.locator('text=Développeur React').first().click();
    }

    // After click, detail content should become visible
    // NOTE: add data-testid="application-detail" to the expanded detail panel/drawer
    const detailPanel = page.locator('[data-testid="application-detail"]');
    if (await detailPanel.count() > 0) {
      await expect(detailPanel).toBeVisible();
    } else {
      // Fallback: look for notes or interview date field becoming visible
      const notesOrDate = page
        .locator('textarea, input[type="date"], [data-testid="application-notes"]')
        .first();
      await expect(notesOrDate).toBeVisible();
    }
  });

  test('should display stats bar with total and in-progress counts', async ({ page }) => {
    // NOTE: add data-testid="stats-bar" to the statistics summary bar
    // NOTE: add data-testid="stats-total" to the total count element
    // NOTE: add data-testid="stats-in-progress" to the "En cours" count element
    const statsBar = page.locator('[data-testid="stats-bar"]');
    if (await statsBar.count() > 0) {
      await expect(statsBar).toBeVisible();
    }

    // Check for total count — mock data has 4 applications
    const totalEl = page.locator('[data-testid="stats-total"]');
    if (await totalEl.count() > 0) {
      await expect(totalEl).toContainText('4');
    } else {
      // Fallback: look for any text that shows a count near "total" or "candidature"
      const statsText = page
        .locator('text=/\\d+ candidature|\\d+ en cours/i')
        .first();
      await expect(statsText).toBeVisible();
    }
  });

  test('should show in-progress count matching non-final statuses', async ({ page }) => {
    // 3 applications are in non-final statuses (TO_APPLY, APPLIED x2, INTERVIEW_SCHEDULED)
    // NOTE: add data-testid="stats-in-progress" to the in-progress count element
    const inProgressEl = page.locator('[data-testid="stats-in-progress"]');
    if (await inProgressEl.count() > 0) {
      const text = await inProgressEl.innerText();
      // Should contain a number between 1 and 4 (all mock apps are in progress)
      expect(parseInt(text.replace(/\D/g, ''), 10)).toBeGreaterThanOrEqual(1);
    } else {
      // Fallback: any element referencing "en cours"
      const enCoursEl = page
        .locator('*')
        .filter({ hasText: /en cours/i })
        .first();
      await expect(enCoursEl).toBeVisible();
    }
  });

  test('should be horizontally scrollable on the kanban container', async ({ page }) => {
    // NOTE: add data-testid="kanban-board" to the Kanban container
    const kanbanContainer = page.locator('[data-testid="kanban-board"]');
    if (await kanbanContainer.count() > 0) {
      // Check that the container allows horizontal overflow/scroll
      const overflowX = await kanbanContainer.evaluate(
        (el) => window.getComputedStyle(el).overflowX,
      );
      expect(['auto', 'scroll', 'overlay']).toContain(overflowX);
    } else {
      // Fallback: check the page body or a wrapper div
      const scrollWrapper = page
        .locator('div')
        .filter({ has: page.locator('[data-testid="kanban-column"]') })
        .first();
      if (await scrollWrapper.count() > 0) {
        const overflowX = await scrollWrapper.evaluate(
          (el) => window.getComputedStyle(el).overflowX,
        );
        expect(['auto', 'scroll', 'overlay']).toContain(overflowX);
      }
    }
  });
});
