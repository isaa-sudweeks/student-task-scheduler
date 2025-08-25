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

test('reorders tasks via drag and drop and persists order', async ({ page }) => {
  const first = `Reorder A ${Date.now()}`;
  const second = `Reorder B ${Date.now()}`;

  await page.goto('/');

  const input = page.getByPlaceholder('Add a task…');
  await input.fill(first);
  await page.keyboard.press('Enter');
  await input.fill(second);
  await page.keyboard.press('Enter');

  await expect(page.getByText(first)).toBeVisible();
  await expect(page.getByText(second)).toBeVisible();

  const firstHandle = page
    .locator('li', { hasText: first })
    .getByLabel('Drag to reorder');
  const secondHandle = page
    .locator('li', { hasText: second })
    .getByLabel('Drag to reorder');

  const firstBox = await firstHandle.boundingBox();
  const secondBox = await secondHandle.boundingBox();
  if (!firstBox || !secondBox) throw new Error('missing boxes');

  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.up();

  const titlesAfter = await page
    .locator('[data-testid="task-scroll"] li span.font-medium')
    .allTextContents();
  const idxFirst = titlesAfter.indexOf(first);
  const idxSecond = titlesAfter.indexOf(second);
  expect(idxSecond).toBeLessThan(idxFirst);

  await page.reload();
  await expect(page.getByText(first)).toBeVisible();
  await expect(page.getByText(second)).toBeVisible();
  const titlesReload = await page
    .locator('[data-testid="task-scroll"] li span.font-medium')
    .allTextContents();
  const idxFirstReload = titlesReload.indexOf(first);
  const idxSecondReload = titlesReload.indexOf(second);
  expect(idxSecondReload).toBeLessThan(idxFirstReload);
});
