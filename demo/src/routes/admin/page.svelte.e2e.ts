import { expect, test } from '@playwright/test';

test('redirects unauthenticated visitors to login', async ({ page }) => {
	await page.goto('/admin');

	await expect(page).toHaveURL('/demo/better-auth/login');
	await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});
