import { expect, test } from '@playwright/test';

test('selects a relationship and persists it across edits', async ({ page }) => {
	// Create a brand to relate to.
	await page.goto('/admin/collections/brands/new');
	await page.getByLabel('Name').fill('Acme');
	await page.getByRole('button', { name: 'Create brand' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/brands\/[0-9a-f-]{8,}$/);
	const brandId = new URL(page.url()).pathname.split('/').at(-1) ?? '';
	expect(brandId).not.toBe('');

	// Create a product that points to the brand via the relationship picker.
	await page.goto('/admin/collections/products/new');
	await page.getByLabel('Name').fill('Relational Phone');
	await page.getByLabel('Price').fill('5');
	await page.getByLabel('Sku').fill('REL-1');
	await page.getByLabel('Brand', { exact: true }).selectOption(brandId);
	await page.getByRole('button', { name: 'Create product' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/products\/[0-9a-f-]{8,}$/);
	const detailUrl = page.url();

	// The edit form (fresh load) reflects the stored relationship.
	await page.goto(`${detailUrl}/edit`);
	await expect(page.getByLabel('Brand', { exact: true })).toHaveValue(brandId);
	await expect(
		page.getByLabel('Brand', { exact: true }).locator('option:checked')
	).toHaveText('Acme');
});
