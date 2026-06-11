import { expect, test } from '@playwright/test';

test('creates a post from admin', async ({ page }) => {
	await page.goto('/admin/collections/posts');

	await expect(page).toHaveURL(/\/admin\/collections\/posts$/);
	await expect(page.getByRole('link', { name: 'Pages' })).toHaveAttribute(
		'href',
		'/admin/collections/pages'
	);
	await page.getByLabel('Title').fill('POC post');
	await page.getByLabel('Description').fill('Created from admin\nWith another line');
	await page.getByRole('button', { name: 'Create post' }).click();

	await expect(page.getByRole('heading', { name: 'POC post' })).toBeVisible();
	await expect(page.getByText('Created from admin')).toBeVisible();
	await expect(page.getByText('With another line')).toBeVisible();
});

test('updates collection view state after client navigation', async ({ page }) => {
	await page.goto('/admin/collections/pages');

	await page.getByRole('link', { name: 'Posts' }).click();

	await expect(page).toHaveURL(/\/admin\/collections\/posts$/);
	await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Posts' })).toHaveAttribute('aria-current', 'page');
	await expect(page.getByRole('link', { name: 'Pages' })).not.toHaveAttribute(
		'aria-current',
		'page'
	);
});
