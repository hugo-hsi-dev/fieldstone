import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('fieldstone sveltekit package exports', () => {
	it('exposes renamed admin component, remote factory, and css entries', async () => {
		const packageJson = JSON.parse(await readFile('package.json', 'utf-8')) as {
			exports: Record<string, unknown>;
		};
		const adminIndex = await readFile('src/admin/index.ts', 'utf-8');
		const remote = await readFile('src/admin/remote.ts', 'utf-8');

		expect(packageJson.exports).toHaveProperty('./admin');
		expect(packageJson.exports).toHaveProperty('./admin/remote');
		expect(packageJson.exports).toHaveProperty('./admin.css');
		expect(adminIndex).toContain('FieldstoneAdmin');
		expect(adminIndex).not.toContain('AdminDashboard');
		expect(remote).toContain('createFieldstoneAdminRemotes');
		expect(remote).not.toContain('createAdminRemotes');
	});
});
