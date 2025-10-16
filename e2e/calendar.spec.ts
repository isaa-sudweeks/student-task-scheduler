import { test, expect } from '@playwright/test';
import superjson from 'superjson';

test.describe('calendar', () => {
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

  test('allows scheduling, moving, and resizing tasks via drag and drop', async ({ page }) => {
    const title = `Calendar Task ${Date.now()}`;

    // create a backlog task on the home page
    await page.goto('/');
    const input = page.getByPlaceholder('Add a task…');
    await input.fill(title);
    await page.keyboard.press('Enter');
    await expect(page.getByText(title)).toBeVisible();

    await page.goto('/calendar');

    const task = page.getByRole('button', { name: new RegExp(`${title}`, 'i') });
    const targetCell = page.locator('[id^="cell-"]').first();

    const taskBox = await task.boundingBox();
    const cellBox = await targetCell.boundingBox();
    if (!taskBox || !cellBox) throw new Error('missing boxes');

    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cellBox.x + 10, cellBox.y + 10);
    await page.mouse.up();

    const event = page.locator('[data-testid="calendar-grid"]').locator(`text=${title}`).first();
    await expect(event).toBeVisible();

    const initialBox = await event.boundingBox();
    if (!initialBox) throw new Error('missing initial event box');

    // move the event down roughly one hour
    await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + 5);
    await page.mouse.down();
    await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + 60);
    await page.mouse.up();

    const movedBox = await event.boundingBox();
    if (!movedBox) throw new Error('missing moved event box');
    expect(movedBox.y).toBeGreaterThan(initialBox.y);

    // extend duration using resize handle
    const handle = event.locator('[aria-label="resize end"]');
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error('missing handle box');
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 60);
    await page.mouse.up();

    const resizedBox = await event.boundingBox();
    if (!resizedBox) throw new Error('missing resized event box');
    expect(resizedBox.height).toBeGreaterThan(movedBox.height);

    // reload and ensure position and size persist
    await page.reload();
    const persisted = page.locator('[data-testid="calendar-grid"]').locator(`text=${title}`).first();
    const persistedBox = await persisted.boundingBox();
    if (!persistedBox) throw new Error('missing persisted event box');
    expect(Math.abs(persistedBox.y - resizedBox.y)).toBeLessThan(5);
    expect(Math.abs(persistedBox.height - resizedBox.height)).toBeLessThan(5);
  });

  test('schedules task using custom default duration', async ({ page }) => {
    // set default duration to 60 minutes via settings
    await page.goto('/settings');
    const durationInput = page.getByLabel(/default duration/i);
    await durationInput.fill('60');

    const title = `Custom Duration Task ${Date.now()}`;

    await page.goto('/');
    const input = page.getByPlaceholder('Add a task…');
    await input.fill(title);
    await page.keyboard.press('Enter');
    await expect(page.getByText(title)).toBeVisible();

    await page.goto('/calendar');

    const task = page.getByRole('button', { name: new RegExp(`${title}`, 'i') });
    const targetCell = page.locator('[id^="cell-"]').first();

    const taskBox = await task.boundingBox();
    const cellBox = await targetCell.boundingBox();
    if (!taskBox || !cellBox) throw new Error('missing boxes');

    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cellBox.x + 10, cellBox.y + 10);
    await page.mouse.up();

    const event = page.locator('[data-testid="calendar-grid"]').locator(`text=${title}`).first();
    await expect(event).toBeVisible();
    const box = await event.boundingBox();
    if (!box) throw new Error('missing event box');
    expect(box.height).toBeGreaterThan(40); // 60min ~48px
  });

  test('toggles focus with keyboard and updates timer', async ({ page }) => {
    const title = `Focus Task ${Date.now()}`;

    await page.goto('/');
    const input = page.getByPlaceholder('Add a task…');
    await input.fill(title);
    await page.keyboard.press('Enter');

    await page.goto('/calendar');

    const backlogItem = page.getByRole('button', { name: new RegExp(`${title}`, 'i') });
    await backlogItem.focus();
    await page.keyboard.press(' ');

    await expect(page.getByText(new RegExp(`Focusing: ${title}`))).toBeVisible();
    const timer = page.getByLabel('timer');
    const first = parseInt((await timer.textContent()) || '0');
    await page.waitForTimeout(1100);
    const second = parseInt((await timer.textContent()) || '0');
    expect(second).toBeGreaterThan(first);

    // Toggle off with Space and ensure focus page closes
    await page.keyboard.press(' ');
    await expect(page.getByText(new RegExp(`Focusing: ${title}`))).toHaveCount(0);
  });

  test('only requests AI suggestions for selected backlog tasks', async ({ page }) => {
    const firstTitle = `AI Backlog ${Date.now()}`;
    const secondTitle = `${firstTitle} B`;

    await page.goto('/');
    const input = page.getByPlaceholder('Add a task…');
    await input.fill(firstTitle);
    await page.keyboard.press('Enter');
    await input.fill(secondTitle);
    await page.keyboard.press('Enter');

    await page.goto('/calendar');

    const firstCheckbox = page.getByRole('checkbox', { name: new RegExp(`Select ${firstTitle}`, 'i') });
    const secondCheckbox = page.getByRole('checkbox', { name: new RegExp(`Select ${secondTitle}`, 'i') });
    await expect(firstCheckbox).toBeChecked();
    await expect(secondCheckbox).toBeChecked();

    await secondCheckbox.click();
    await expect(firstCheckbox).toBeChecked();
    await expect(secondCheckbox).not.toBeChecked();

    const firstTaskButton = page.locator('[data-task-id]', { hasText: firstTitle }).first();
    const secondTaskButton = page.locator('[data-task-id]', { hasText: secondTitle }).first();
    const firstId = await firstTaskButton.getAttribute('data-task-id');
    const secondId = await secondTaskButton.getAttribute('data-task-id');
    if (!firstId || !secondId) throw new Error('Missing task identifiers');

    await page.route('**/api/trpc/task.scheduleSuggestions?batch=1', async (route) => {
      const postData = route.request().postData();
      if (!postData) throw new Error('Missing body');
      const parsed = JSON.parse(postData);
      const firstKey = Object.keys(parsed)[0];
      const input = parsed[firstKey]?.json ?? {};
      expect(input.taskIds).toEqual([firstId]);
      expect(input.taskIds).not.toContain(secondId);

      const payload = superjson.stringify({
        suggestions: [
          {
            taskId: firstId,
            startAt: new Date('2099-04-01T10:00:00Z'),
            endAt: new Date('2099-04-01T11:00:00Z'),
            origin: 'fallback',
          },
        ],
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: { data: JSON.parse(payload) } }),
      });
    });

    await page.getByRole('button', { name: /generate/i }).click();
    const suggestionItems = page.locator('[data-testid="ai-suggestion-item"]');
    await expect(suggestionItems).toHaveCount(1);
    await expect(suggestionItems.first()).toContainText(firstTitle);
    await expect(suggestionItems.first()).not.toContainText(secondTitle);
  });
});
