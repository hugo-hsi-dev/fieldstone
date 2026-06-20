import { expect, test } from '@playwright/test';

test('an authenticated user can reach the admin', async ({ page }) => {
	await page.goto('/admin');
	await expect(page).not.toHaveURL(/\/login/);
	await expect(page.getByRole('heading', { level: 1, name: 'CMS' })).toBeVisible();
});

test.describe('unauthenticated', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('the admin redirects to the login page', async ({ page }) => {
		await page.goto('/admin/collections/posts');
		await expect(page).toHaveURL(/\/login/);
	});

	test('login grants access to the admin', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill('admin@example.com');
		await page.getByLabel('Password').fill('password12345');
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		// The first sign-in can be slow while vite warms the auth-client module graph.
		await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
		await expect(page.getByRole('heading', { level: 1, name: 'CMS' })).toBeVisible();
	});
});
