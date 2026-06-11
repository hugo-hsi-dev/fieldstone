import { expect, test } from '@playwright/test';

test('creates a post from admin', async ({ page }) => {
	await page.goto('/admin');

	await expect(page).toHaveURL(/\/admin\/posts$/);
	await page.getByLabel('Title').fill('POC post');
	await page.getByLabel('Description').fill('Created from admin');
	await page.getByRole('button', { name: 'Create post' }).click();

	await expect(page.getByRole('heading', { name: 'POC post' })).toBeVisible();
	await expect(page.getByText('Created from admin')).toBeVisible();
});
