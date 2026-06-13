import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { discoverCollections, validateCollectionEntries } from '../src/collections.ts';

async function withCollections(
	files: Record<string, string>,
	run: (root: string) => Promise<void>
) {
	const root = await mkdtemp(path.join(tmpdir(), 'fieldstone-codegen-'));
	const cmsDir = path.join(root, 'src', 'cms');
	await mkdir(cmsDir, { recursive: true });

	try {
		for (const [slug, source] of Object.entries(files)) {
			const collectionDir = path.join(cmsDir, slug);
			await mkdir(collectionDir, { recursive: true });
			await writeFile(path.join(collectionDir, '+collection.ts'), source);
		}

		await run(root);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

describe('collection discovery', () => {
	it('ignores blank collection files', async () => {
		await withCollections({ draft: '' }, async (root) => {
			await expect(discoverCollections(root)).resolves.toEqual([]);
		});
	});

	it('discovers nonblank collection files', async () => {
		await withCollections({ posts: 'export default {};' }, async (root) => {
			await expect(discoverCollections(root)).resolves.toEqual([
				{
					file: path.join(root, 'src', 'cms', 'posts', '+collection.ts'),
					slug: 'posts'
				}
			]);
		});
	});

	it('ignores blank prototype collection files', async () => {
		await withCollections({ ['__proto__']: '' }, async (root) => {
			await expect(discoverCollections(root)).resolves.toEqual([]);
		});
	});

	it('rejects nonblank prototype collection files', async () => {
		await withCollections({ ['__proto__']: 'export default {};' }, async (root) => {
			await expect(discoverCollections(root)).rejects.toThrow('Reserved collection slug: __proto__');
		});
	});

	it('rejects duplicate nonblank collection slugs', async () => {
		expect(() =>
			validateCollectionEntries([
				{ entry: 'Posts', isBlank: false },
				{ entry: 'posts', isBlank: false }
			])
		).toThrow('Duplicate collection slug: posts');
	});

	it('rejects collection files that exist but cannot be read', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'fieldstone-codegen-'));
		await mkdir(path.join(root, 'src', 'cms', 'posts', '+collection.ts'), { recursive: true });

		try {
			await expect(discoverCollections(root)).rejects.toThrow();
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
