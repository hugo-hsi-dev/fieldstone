import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const authFile = 'playwright/.auth/user.json';

setup('register the first admin user', async ({ page }) => {
	mkdirSync('playwright/.auth', { recursive: true });

	// Register via the Better Auth API; the Set-Cookie lands in the browser context's jar.
	const response = await page.request.post('/api/auth/sign-up/email', {
		data: { email: 'admin@example.com', password: 'password12345', name: 'Admin' }
	});
	expect(response.ok()).toBeTruthy();

	await page.context().storageState({ path: authFile });
});
