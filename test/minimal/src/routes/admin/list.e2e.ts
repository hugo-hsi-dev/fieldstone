import { expect, test } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173/api';

test('admin list paginates and searches (with REST pagination)', async ({ page, request }) => {
	for (let i = 1; i <= 12; i += 1) {
		const res = await request.post(`${BASE}/widgets`, {
			data: { name: `Widget ${String(i).padStart(2, '0')}` }
		});
		expect(res.status()).toBe(201);
	}

	// REST list honours limit/offset/search and reports a total.
	const limited = await request.get(`${BASE}/widgets?limit=5&offset=0`);
	const limitedBody = await limited.json();
	expect(limitedBody.docs).toHaveLength(5);
	expect(limitedBody.total).toBe(12);

	const searched = await request.get(`${BASE}/widgets?search=${encodeURIComponent('Widget 07')}`);
	expect((await searched.json()).total).toBe(1);

	// Admin list shows pagination controls and supports search.
	await page.goto('/admin/collections/widgets');
	await expect(page.getByText(/Page 1 of 2/)).toBeVisible();

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.getByText(/Page 2 of 2/)).toBeVisible();

	await page.getByLabel('Search').fill('Widget 07');
	await page.getByRole('button', { name: 'Search' }).click();
	await expect(page.getByRole('link', { name: 'Widget 07' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Widget 03' })).not.toBeVisible();
});
