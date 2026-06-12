import { createClient } from '@libsql/client';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

import { collection, text, type FieldstoneConfig } from '@fieldstone/core';
import { getFieldstone } from '../src/index.ts';

describe('fieldstone runtime', () => {
	it('does not treat inherited collection keys as valid collections', async () => {
		const stone = await getFieldstone({
			config: {
				db: { dialect: 'sqlite', url: ':memory:' },
				collections: {}
			}
		});

		expect(stone.getCollection('toString')).toBeNull();
		await expect(stone.find({ collection: 'toString' })).rejects.toThrow(
			'Unsupported collection: toString'
		);
	});

	it('provides the virtual config module declaration from the client entrypoint', () => {
		const source = `
			import { getFieldstone } from '@fieldstone/client';
			import config from '$fieldstone-config';

			void getFieldstone({ config });
		`;
		const rootDir = process.cwd().replace(/\/packages\/client$/, '');
		const fileName = `${rootDir}/app.ts`;
		const compilerOptions = {
			allowImportingTsExtensions: true,
			baseUrl: rootDir,
			module: ts.ModuleKind.ESNext,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			noEmit: true,
			paths: {
				'@fieldstone/client': ['packages/client/src/index.ts'],
				'@fieldstone/core': ['packages/core/src/index.ts']
			},
			strict: true,
			target: ts.ScriptTarget.ESNext
		} satisfies ts.CompilerOptions;
		const host = ts.createCompilerHost(compilerOptions);
		const originalReadFile = host.readFile;
		const originalFileExists = host.fileExists;

		host.readFile = (requestedFileName) =>
			requestedFileName === fileName ? source : originalReadFile(requestedFileName);
		host.fileExists = (requestedFileName) =>
			requestedFileName === fileName || originalFileExists(requestedFileName);

		const program = ts.createProgram([fileName], compilerOptions, host);
		const diagnostics = ts.getPreEmitDiagnostics(program);

		expect(
			diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
		).not.toContain(
			"Cannot find module '$fieldstone-config' or its corresponding type declarations."
		);
	});

	it('types collection-specific documents and mutation data from generated collections', () => {
		const source = `
			import { getFieldstone } from '@fieldstone/client';
			import type { FieldstoneConfig } from '@fieldstone/core';

			declare module '@fieldstone/core' {
				interface GeneratedCollections {
					"posts": {
						id: string;
						title: string;
						description?: string;
						createdAt: Date;
						updatedAt: Date;
					};
				}
			}

			const config = {
				db: { dialect: 'sqlite', url: ':memory:' },
				collections: {}
			} satisfies FieldstoneConfig;

			async function run() {
				const stone = await getFieldstone({ config });
				const posts = await stone.find({ collection: 'posts' });
				const title: string = posts[0].title;
				const createdAt: Date = posts[0].createdAt;

				await stone.create({
					collection: 'posts',
					data: { title: 'Hello', description: 'Body' }
				});

				await stone.create({
					collection: 'posts',
					data: { title: 'Hello' }
				});

				// @ts-expect-error missing configured field
				await stone.create({ collection: 'posts', data: { description: 'Body' } });

				// @ts-expect-error unknown collection
				await stone.find({ collection: 'pages' });
			}
		`;
		const diagnostics = getDiagnostics(source);

		expect(diagnostics).toEqual([]);
	});

	it('handles Document reads, mutations, validation, timestamps, and missing rows', async () => {
		const { cleanup, config } = await createRuntimeFixture();

		try {
			const stone = await getFieldstone({ config });
			const createdAt = new Date('2026-01-01T00:00:00.000Z');
			const updatedAt = new Date('2026-01-02T00:00:00.000Z');

			await expect(
				stone.create({ collection: 'posts', data: { description: 'Missing title' } })
			).rejects.toThrow('title is required');
			await expect(
				stone.create({
					collection: 'posts',
					data: { title: 'Hello', description: 'Body', extra: 'Nope' }
				})
			).rejects.toThrow('Unknown field: extra');

			const created = await stone.create({
				collection: 'posts',
				createdAt,
				data: { title: ' Hello ', description: ' Body ' },
				updatedAt
			});

			expect(created).toMatchObject({
				title: 'Hello',
				description: 'Body',
				createdAt,
				updatedAt
			});

			const listed = await stone.find({ collection: 'posts' });
			expect(listed).toHaveLength(1);
			expect(await stone.findById({ collection: 'posts', id: created.id })).toMatchObject({
				id: created.id,
				title: 'Hello'
			});
			expect(await stone.findById({ collection: 'posts', id: 'missing' })).toBeNull();

			const defaulted = await stone.create({
				collection: 'posts',
				data: { title: 'Default timestamps', description: 'Generated' }
			});
			expect(defaulted.createdAt).toBeInstanceOf(Date);
			expect(defaulted.updatedAt).toBeInstanceOf(Date);

			const updateTime = new Date('2026-01-03T00:00:00.000Z');
			const updated = await stone.update({
				collection: 'posts',
				data: { title: ' Updated ', description: ' Again ' },
				id: created.id,
				updatedAt: updateTime
			});
			expect(updated).toMatchObject({
				id: created.id,
				title: 'Updated',
				description: 'Again',
				updatedAt: updateTime
			});

			await expect(
				stone.update({
					collection: 'posts',
					data: { title: 'Missing', description: 'Missing' },
					id: 'missing'
				})
			).rejects.toThrow('Document not found');
			await expect(stone.delete({ collection: 'posts', id: 'missing' })).rejects.toThrow(
				'Document not found'
			);
		} finally {
			await cleanup();
		}
	});
});

async function createRuntimeFixture() {
	const tempDir = await mkdtemp(path.join(tmpdir(), 'fieldstone-runtime-'));
	const dbPath = path.join(tempDir, 'test.db');
	const client = createClient({ url: `file:${dbPath}` });
	await client.executeMultiple(`
		create table posts (
			id text primary key not null,
			title text not null,
			description text not null,
			created_at integer not null,
			updated_at integer not null
		);
	`);
	client.close();

	const config: FieldstoneConfig = {
		db: { dialect: 'sqlite', url: dbPath },
		collections: {
			posts: {
				...collection({
					fields: [
						text({ name: 'title', required: true }),
						text({ name: 'description', required: true })
					]
				}),
				slug: 'posts'
			}
		}
	};

	return {
		cleanup: () => rm(tempDir, { force: true, recursive: true }),
		config
	};
}

function getDiagnostics(source: string) {
	const rootDir = process.cwd().replace(/\/packages\/client$/, '');
	const fileName = `${rootDir}/type-test.ts`;
	const compilerOptions = {
		allowImportingTsExtensions: true,
		baseUrl: rootDir,
		ignoreDeprecations: '6.0',
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		noEmit: true,
		paths: {
			'@fieldstone/client': ['packages/client/src/index.ts'],
			'@fieldstone/core': ['packages/core/src/index.ts']
		},
		skipLibCheck: true,
		strict: true,
		target: ts.ScriptTarget.ESNext,
		typeRoots: [`${rootDir}/test/simple/node_modules/@types`],
		types: ['node']
	} satisfies ts.CompilerOptions;
	const host = ts.createCompilerHost(compilerOptions);
	const originalReadFile = host.readFile;
	const originalFileExists = host.fileExists;

	host.readFile = (requestedFileName) =>
		requestedFileName === fileName ? source : originalReadFile(requestedFileName);
	host.fileExists = (requestedFileName) =>
		requestedFileName === fileName || originalFileExists(requestedFileName);

	const program = ts.createProgram([fileName], compilerOptions, host);
	return ts
		.getPreEmitDiagnostics(program)
		.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
}
