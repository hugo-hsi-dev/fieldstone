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

	it('builds admin primitives on bits-ui', async () => {
		const packageJson = JSON.parse(await readFile('package.json', 'utf-8')) as {
			dependencies: Record<string, string>;
		};
		const button = await readFile('src/primitives/Button.svelte', 'utf-8');
		const label = await readFile('src/primitives/Label.svelte', 'utf-8');

		expect(packageJson.dependencies).toHaveProperty('bits-ui');
		expect(button).toContain("import { Button as BitsButton } from 'bits-ui'");
		expect(button).toContain('<BitsButton.Root');
		expect(label).toContain("import { Label as BitsLabel } from 'bits-ui'");
		expect(label).toContain('<BitsLabel.Root');
	});

	it('routes admin actions through shared primitives', async () => {
		const admin = await readFile('src/FieldstoneAdmin.svelte', 'utf-8');
		const createForm = await readFile('src/CreateDocumentForm.svelte', 'utf-8');
		const editForm = await readFile('src/DocumentEditForm.svelte', 'utf-8');
		const list = await readFile('src/DocumentList.svelte', 'utf-8');
		const input = await readFile('src/FieldInput.svelte', 'utf-8');

		expect(admin).toContain("import Button from './primitives/Button.svelte'");
		expect(createForm).toContain("import Button from './primitives/Button.svelte'");
		expect(editForm).toContain("import Button from './primitives/Button.svelte'");
		expect(list).toContain("import Button from './primitives/Button.svelte'");
		expect(input).toContain("import Label from './primitives/Label.svelte'");
	});
});
