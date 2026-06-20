import { expect, test } from '@playwright/test';

test('a beforeChange hook derives a field on create', async ({ page }) => {
	await page.goto('/admin/collections/articles/new');
	await page.getByLabel('Title').fill('My First Post');
	// Leave slug empty so the hook derives it.
	await page.getByRole('button', { name: 'Create article' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/articles\/[0-9a-f-]{8,}$/);

	// The detail page (fresh server load) shows the hook-derived slug.
	await expect(page.getByText('my-first-post')).toBeVisible();
});
