import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import * as codegen from '../src/index.ts';
import { validateCollectionEntries } from '../src/collections.ts';

describe('fieldstone codegen exports', () => {
	it('exposes generation helpers without Vite plugin exports', () => {
		expect(codegen).toHaveProperty('loadFieldstoneConfig');
		expect(codegen).toHaveProperty('writeGeneratedFiles');
		expect(codegen).toHaveProperty('createCollectionScaffold');
		expect(codegen).not.toHaveProperty('fieldstone');
	});

	it('discovers collection files under src/cms route directories', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'fieldstone-codegen-'));
		await mkdir(path.join(root, 'src', 'cms', 'posts'), { recursive: true });
		await mkdir(path.join(root, 'src', 'cms', 'pages'), { recursive: true });
		await writeFile(path.join(root, 'src', 'cms', 'posts', '+collection.ts'), '');
		await writeFile(path.join(root, 'src', 'cms', 'pages', '+collection.ts'), '');

		try {
			await expect(codegen.discoverCollections(root)).resolves.toEqual([
				{ file: path.join(root, 'src', 'cms', 'pages', '+collection.ts'), slug: 'pages' },
				{ file: path.join(root, 'src', 'cms', 'posts', '+collection.ts'), slug: 'posts' }
			]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('ignores underscored cms dirs and rejects reserved collection slugs', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'fieldstone-codegen-'));
		await mkdir(path.join(root, 'src', 'cms', '_draft'), { recursive: true });
		await mkdir(path.join(root, 'src', 'cms', '__proto__'), { recursive: true });
		await writeFile(path.join(root, 'src', 'cms', '_draft', '+collection.ts'), '');
		await writeFile(path.join(root, 'src', 'cms', '__proto__', '+collection.ts'), '');

		try {
			await expect(codegen.discoverCollections(root)).rejects.toThrow(
				'Reserved collection slug: __proto__'
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('loads virtual config from src/cms collection files', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'fieldstone-codegen-'));
		await mkdir(path.join(root, 'src', 'cms', 'posts'), { recursive: true });
		await writeFile(path.join(root, 'src', 'cms', 'posts', '+collection.ts'), '');

		try {
			const source = await codegen.loadVirtualConfig(root, {
				db: { dialect: 'sqlite', url: 'fallback.db' }
			});

			expect(source).toContain('import collection0 from "/src/cms/posts/+collection.ts"');
			expect(source).toContain('"posts": runtimeCollection0');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('rejects duplicate collection slugs case-insensitively', () => {
		expect(() => validateCollectionEntries(['Posts', 'posts'])).toThrow(
			'Duplicate collection slug: posts'
		);
	});
});
