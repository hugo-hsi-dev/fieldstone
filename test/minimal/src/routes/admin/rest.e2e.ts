import { expect, test } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173/api';

test('REST API supports CRUD over collections', async ({ request }) => {
	const createRes = await request.post(`${BASE}/brands`, { data: { name: 'RestBrand' } });
	expect(createRes.status()).toBe(201);
	const created = await createRes.json();
	expect(created.name).toBe('RestBrand');
	const id = created.id as string;

	const getRes = await request.get(`${BASE}/brands/${id}`);
	expect((await getRes.json()).name).toBe('RestBrand');

	const listRes = await request.get(`${BASE}/brands`);
	const { docs } = await listRes.json();
	expect(Array.isArray(docs)).toBe(true);
	expect(docs.length).toBeGreaterThanOrEqual(1);

	const patchRes = await request.patch(`${BASE}/brands/${id}`, { data: { name: 'Renamed' } });
	expect((await patchRes.json()).name).toBe('Renamed');

	const delRes = await request.delete(`${BASE}/brands/${id}`);
	expect(delRes.status()).toBe(200);
	expect((await request.get(`${BASE}/brands/${id}`)).status()).toBe(404);
});

test('REST API reports validation errors and missing collections', async ({ request }) => {
	const invalid = await request.post(`${BASE}/brands`, { data: {} });
	expect(invalid.status()).toBe(400);
	expect((await invalid.json()).error).toContain('name is required');

	const missing = await request.get(`${BASE}/not-a-collection`);
	expect(missing.status()).toBe(404);
});
