import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
	fieldstone,
	fieldstoneCollectionScaffold,
	resolvedFieldstoneConfigModuleID
} from '../src/vite.ts';

describe('fieldstone vite plugin', () => {
	it('rejects client imports of $fieldstone-config', () => {
		const plugin = fieldstone({ db: { dialect: 'sqlite', url: ':memory:' } });

		expect(() =>
			plugin.resolveId?.call({} as never, '$fieldstone-config', undefined, { ssr: false })
		).toThrow('$fieldstone-config is server-only');
	});

	it('scaffolds a new collection file from the filename', () => {
		expect(fieldstoneCollectionScaffold('blog-posts')).toBe(`import { collection, text } from '@fieldstone/plugin';

export default collection({
\tfields: [
\t\ttext({ name: 'title', required: true })
\t]
});
`);
	});

	it('reads database url from runtime env in virtual config', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'fieldstone-vite-'));
		await mkdir(path.join(root, 'collections'));

		try {
			const plugin = fieldstone({ db: { dialect: 'sqlite', url: 'fallback.db' } });
			plugin.configResolved?.call({} as never, { root } as never);
			const source = await plugin.load?.call({} as never, resolvedFieldstoneConfigModuleID);

			expect(source).toContain('process.env.DATABASE_URL ?? "fallback.db"');
			expect(source).toContain('dialect: "sqlite"');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('rejects prototype-mutating collection slugs', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'fieldstone-vite-'));
		const collectionsDir = path.join(root, 'collections');
		await mkdir(collectionsDir);
		await writeFile(path.join(collectionsDir, '__proto__.ts'), '');

		try {
			const plugin = fieldstone({ db: { dialect: 'sqlite', url: ':memory:' } });
			plugin.configResolved?.call({} as never, { root } as never);

			await expect(
				plugin.load?.call({} as never, resolvedFieldstoneConfigModuleID)
			).rejects.toThrow('Reserved collection slug: __proto__');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
