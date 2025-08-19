import { test, expect } from '@playwright/test';

test('calendar view loads and shows tabs', async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.getByRole('tab', { name: /week/i })).toBeVisible();
  await page.getByRole('tab', { name: /day/i }).click();
  await expect(page.getByRole('tab', { name: /day/i, selected: true })).toBeVisible();
});

