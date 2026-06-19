import { expect, test } from '@playwright/test';

test('draft-enabled collections default to draft and can be published', async ({ page }) => {
	await page.goto('/admin/collections/articles/new');
	// drafts: true injects a Status select defaulting to "draft".
	await expect(page.getByLabel('Status')).toHaveValue('draft');

	await page.getByLabel('Title').fill('Publishable');
	await page.getByLabel('Status').selectOption('published');
	await page.getByRole('button', { name: 'Create article' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/articles\/[0-9a-f-]{8,}$/);
	const detailUrl = page.url();

	// The stored status survives a fresh edit-form load.
	await page.goto(`${detailUrl}/edit`);
	await expect(page.getByLabel('Status')).toHaveValue('published');
});
