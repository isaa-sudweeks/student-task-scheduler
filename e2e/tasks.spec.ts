import { test, expect } from '@playwright/test';

test('user can create, edit, and delete a task', async ({ page }) => {
  const title = `Playwright Task ${Date.now()}`;
  const updated = `${title} Updated`;

  await page.goto('/');

  const input = page.getByPlaceholder('Add a task…');
  await input.fill(title);
  await page.keyboard.press('Enter');
  await expect(page.getByText(title)).toBeVisible();

  await page.getByText(title).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Title').fill(updated);
  await modal.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(updated)).toBeVisible();

  await page.getByText(updated).click();
  const editModal = page.getByRole('dialog');
  await expect(editModal).toBeVisible();
  await editModal.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(updated)).toHaveCount(0);
});
