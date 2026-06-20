import { expect, test } from '@playwright/test';

test('group and array nested fields persist and round-trip', async ({ page }) => {
	await page.goto('/admin/collections/profiles/new');
	await page.getByLabel('Name').fill('Ada');

	// group sub-field
	await page.getByLabel('City').fill('London');

	// array: add a row, then fill its sub-fields
	await page.getByRole('button', { name: 'Add item' }).click();
	await page.getByLabel('Label').fill('Home');

	await page.getByRole('button', { name: 'Create profile' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/profiles\/[0-9a-f-]{8,}$/);
	const detailUrl = page.url();

	// Detail page (fresh server load) shows the persisted nested values (as JSON).
	await expect(page.getByText(/London/)).toBeVisible();
	await expect(page.getByText(/Home/)).toBeVisible();

	// Edit form repopulates nested fields.
	await page.goto(`${detailUrl}/edit`);
	await expect(page.getByLabel('City')).toHaveValue('London');
	await expect(page.getByLabel('Label')).toHaveValue('Home');
});

test('a required nested sub-field is enforced', async ({ page }) => {
	await page.goto('/admin/collections/profiles/new');
	await page.getByLabel('Name').fill('No city');
	// Leave the required group sub-field "city" empty.
	await page.getByRole('button', { name: 'Create profile' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/profiles\/new$/);
	await expect(page.getByText('city is required')).toBeVisible();
});
