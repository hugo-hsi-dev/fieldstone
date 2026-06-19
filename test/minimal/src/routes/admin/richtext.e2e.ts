import { expect, test } from '@playwright/test';

test('rich text content is editable and round-trips', async ({ page }) => {
	await page.goto('/admin/collections/articles/new');
	await page.getByLabel('Title').fill('Rich Article');
	await page.getByRole('textbox', { name: 'Body' }).fill('Hello rich world');
	await page.getByRole('button', { name: 'Create article' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/articles\/[0-9a-f-]{8,}$/);
	const detailUrl = page.url();

	await expect(page.getByText('Hello rich world')).toBeVisible();

	// The editor on a fresh edit-form load is populated with the stored content.
	await page.goto(`${detailUrl}/edit`);
	await expect(page.getByRole('textbox', { name: 'Body' })).toContainText('Hello rich world');
});
