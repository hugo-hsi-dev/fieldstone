import { expect, test } from '@playwright/test';

async function createWidget(page: import('@playwright/test').Page, name: string) {
	await page.goto('/admin/collections/widgets/new');
	await page.getByLabel('Name').fill(name);
	await page.getByRole('button', { name: 'Create widget' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/widgets\/[^/]+$/);
}

test('admin list paginates and searches', async ({ page }) => {
	for (let i = 1; i <= 12; i += 1) {
		await createWidget(page, `Widget ${String(i).padStart(2, '0')}`);
	}

	await page.goto('/admin/collections/widgets');
	await expect(page.getByText(/Page 1 of 2/)).toBeVisible();

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.getByText(/Page 2 of 2/)).toBeVisible();

	await page.getByLabel('Search').fill('Widget 07');
	await page.getByRole('button', { name: 'Search' }).click();
	await expect(page.getByRole('link', { name: 'Widget 07' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Widget 03' })).not.toBeVisible();
});
