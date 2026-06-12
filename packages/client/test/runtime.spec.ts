import { describe, expect, it } from 'vitest';
import ts from 'typescript';

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
});

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
		typeRoots: [`${rootDir}/demo/node_modules/@types`],
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
