import { expect, test } from '@playwright/test';

const browserErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  browserErrors.length = 0;
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserErrors.push(`console ${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
  await page.goto('file://' + process.cwd() + '/index.html');
});

test('supports the complete deterministic task lifecycle without browser errors', async ({ page }) => {
  const input = page.getByTestId('todo-input');
  const list = page.getByTestId('todo-list');
  const emptyState = page.getByTestId('empty-state');

  await expect(page.getByRole('heading', { name: 'Todo App' })).toBeVisible();
  await expect(emptyState).toHaveText('No tasks yet.');
  await expect(list).toBeEmpty();

  await input.fill('  Write tests  ');
  await page.getByTestId('add-button').click();
  await expect(page.getByTestId('todo-item-1')).toBeVisible();
  await expect(page.getByTestId('todo-title-1')).toHaveText('Write tests');
  await expect(input).toHaveValue('');
  await expect(emptyState).toBeHidden();

  await input.fill('Review results');
  await input.press('Enter');
  await expect(page.getByTestId('todo-item-2')).toBeVisible();
  await expect(list.locator('li')).toHaveText(['Write testsDelete', 'Review resultsDelete']);

  await input.fill('   ');
  await page.getByTestId('add-button').click();
  await expect(list.locator('li')).toHaveCount(2);
  await input.fill('');
  await input.press('Enter');
  await expect(list.locator('li')).toHaveCount(2);

  await page.getByTestId('todo-checkbox-1').check();
  await expect(page.getByTestId('todo-title-1')).toHaveCSS('text-decoration-line', 'line-through');
  await expect(page.getByTestId('todo-checkbox-2')).not.toBeChecked();
  await page.getByTestId('todo-checkbox-1').uncheck();
  await expect(page.getByTestId('todo-title-1')).toHaveCSS('text-decoration-line', 'none');

  await page.getByTestId('todo-delete-1').click();
  await expect(page.getByTestId('todo-item-1')).toHaveCount(0);
  await expect(page.getByTestId('todo-title-2')).toHaveText('Review results');
  await page.getByTestId('todo-delete-2').click();
  await expect(list).toBeEmpty();
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toHaveText('No tasks yet.');
  expect(browserErrors).toEqual([]);
});
