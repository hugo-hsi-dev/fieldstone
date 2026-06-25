import { expect, test } from '@playwright/test';

test('collection access control: authenticated allowed, anonymous redirected', async ({ page }) => {
	await page.goto('/admin/collections/secrets');
	await expect(page.getByRole('heading', { level: 1, name: 'Secrets' })).toBeVisible();

	await page.goto('/admin/collections/secrets/new');
	await page.getByLabel('Title').fill('Top secret');
	await page.getByRole('button', { name: 'Create secret' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/secrets\/[^/]+$/);
	await expect(page.getByRole('heading', { name: 'Top secret' })).toBeVisible();
});

test.describe('unauthenticated', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('protected collection redirects to login', async ({ page }) => {
		await page.goto('/admin/collections/secrets');
		await expect(page).toHaveURL(/\/login/);
	});
});
