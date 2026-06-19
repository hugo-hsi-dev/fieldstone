import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function createProduct(page: Page, name: string, sku: string) {
	await page.goto('/admin/collections/products/new');
	await page.getByLabel('Name').fill(name);
	await page.getByLabel('Price').fill('42');
	await page.getByLabel('Status').selectOption('active');
	await page.getByLabel('Sku').fill(sku);
	await page.getByLabel('Featured').check();
	await page.getByRole('button', { name: 'Create product' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/products\/[^/]+$/);
}

test('creates and edits a product with number, select, and boolean fields', async ({ page }) => {
	await createProduct(page, 'Test Widget', 'WIDGET-1');

	// Detail page (fresh server load after the create redirect) reflects every field type.
	await expect(page.getByRole('heading', { name: 'Test Widget' })).toBeVisible();
	await expect(page.getByText('active')).toBeVisible();
	const detailUrl = page.url();

	// Load the edit form directly so values come from a fresh server render.
	await page.goto(`${detailUrl}/edit`);
	await expect(page.getByLabel('Price')).toHaveValue('42');
	await expect(page.getByLabel('Status')).toHaveValue('active');
	await expect(page.getByLabel('Sku')).toHaveValue('WIDGET-1');
	await expect(page.getByLabel('Featured')).toBeChecked();

	// Editing a number field persists.
	await page.getByLabel('Price').fill('99');
	await page.getByRole('button', { name: 'Save product' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/products\/[^/]+$/);

	await page.goto(`${detailUrl}/edit`);
	await expect(page.getByLabel('Price')).toHaveValue('99');
	await expect(page.getByLabel('Featured')).toBeChecked();
});

test('rejects a missing required number through remote form issues', async ({ page }) => {
	await page.goto('/admin/collections/products/new');

	await page.getByLabel('Name').fill('No price');
	await page.getByRole('button', { name: 'Create product' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/products\/new$/);
	await expect(page.getByText('price is required')).toBeVisible();
});

test('rejects an invalid email through remote form issues', async ({ page }) => {
	await page.goto('/admin/collections/products/new');

	await page.getByLabel('Name').fill('Bad email');
	await page.getByLabel('Price').fill('10');
	// Passes the browser's native email check (has "@") but fails server validation (no TLD).
	await page.getByLabel('Contact').fill('foo@bar');
	await page.getByRole('button', { name: 'Create product' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/products\/new$/);
	await expect(page.getByText('contact must be a valid email')).toBeVisible();
});

test('shows admin description help text', async ({ page }) => {
	await page.goto('/admin/collections/products/new');
	await expect(page.getByText('Support contact email')).toBeVisible();
});
