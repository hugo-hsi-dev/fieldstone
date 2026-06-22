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
		// The only test that drives the real UI sign-in, so it eats the cold-server
		// compile of the login + admin client graphs — give it room on slow CI runners.
		test.setTimeout(60_000);
		await page.goto('/login');
		await page.getByLabel('Email').fill('admin@example.com');
		await page.getByLabel('Password').fill('password12345');
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		// The module graphs are pre-warmed in auth.setup.ts, but keep generous headroom
		// for slow CI runners since this is the only test that drives the real sign-in.
		await expect(page).toHaveURL(/\/admin/, { timeout: 30000 });
		await expect(page.getByRole('heading', { level: 1, name: 'CMS' })).toBeVisible();
	});
});
