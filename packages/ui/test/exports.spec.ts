import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('fieldstone ui package exports', () => {
	it('exposes admin component and css entries', async () => {
		const packageJson = JSON.parse(await readFile('package.json', 'utf-8')) as {
			exports: Record<string, unknown>;
		};
		const adminIndex = await readFile('src/index.ts', 'utf-8');

		expect(packageJson.exports).toHaveProperty('.');
		expect(packageJson.exports).toHaveProperty('./admin.css');
		expect(adminIndex).toContain('FieldstoneAdmin');
		expect(adminIndex).not.toContain('AdminDashboard');
	});
});
