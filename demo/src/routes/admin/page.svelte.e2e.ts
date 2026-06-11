import { expect, test } from '@playwright/test';

test('creates a post from admin', async ({ page }) => {
	await page.goto('/admin');

	await expect(page).toHaveURL(/\/admin\/posts$/);
	await expect(page.getByRole('link', { name: 'Pages' })).toHaveAttribute('href', '/admin/pages');
	await page.getByLabel('Title').fill('POC post');
	await page.getByLabel('Description').fill('Created from admin\nWith another line');
	await page.getByRole('button', { name: 'Create post' }).click();

	await expect(page.getByRole('heading', { name: 'POC post' })).toBeVisible();
	await expect(page.getByText('Created from admin')).toBeVisible();
	await expect(page.getByText('With another line')).toBeVisible();
});
