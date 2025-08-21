import { test, expect } from '@playwright/test';

test.describe('calendar views', () => {
  test('switches between day, week, and month', async ({ page }) => {
    await page.goto('/calendar');

    await expect(page.getByRole('tab', { name: /week/i, selected: true })).toBeVisible();

    await page.getByRole('tab', { name: /day/i }).click();
    await expect(page.getByRole('tab', { name: /day/i, selected: true })).toBeVisible();

    await page.getByRole('tab', { name: /month/i }).click();
    await expect(page.getByRole('tab', { name: /month/i, selected: true })).toBeVisible();

    const dayCells = await page.locator('[data-testid="day-cell"]').count();
    expect(dayCells).toBeGreaterThan(20);
  });
});
