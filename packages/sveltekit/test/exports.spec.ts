import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('fieldstone sveltekit package exports', () => {
	it('exposes admin component, remote factory, and css entries', async () => {
		const packageJson = JSON.parse(await readFile('package.json', 'utf-8')) as {
			exports: Record<string, unknown>;
		};

		expect(packageJson.exports).toHaveProperty('./admin');
		expect(packageJson.exports).toHaveProperty('./admin/remote');
		expect(packageJson.exports).toHaveProperty('./admin.css');
	});
});
