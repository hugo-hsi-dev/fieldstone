import { expect, request as playwrightRequest, test } from '@playwright/test';

const BASE = 'http://localhost:4173/api';

test('collection access control: authenticated allowed, anonymous denied', async ({ request }) => {
	// The suite runs authenticated (storageState), so read + create are permitted.
	const authedRead = await request.get(`${BASE}/secrets`);
	expect(authedRead.status()).toBe(200);

	const created = await request.post(`${BASE}/secrets`, { data: { title: 'Top secret' } });
	expect(created.status()).toBe(201);

	// A fresh, cookie-less context is anonymous and must be forbidden.
	const anon = await playwrightRequest.newContext({ storageState: { cookies: [], origins: [] } });
	try {
		expect((await anon.get(`${BASE}/secrets`)).status()).toBe(403);
		expect((await anon.post(`${BASE}/secrets`, { data: { title: 'nope' } })).status()).toBe(403);
	} finally {
		await anon.dispose();
	}
});
