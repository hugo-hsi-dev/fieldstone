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
			diagnostics.map((diagnostic) =>
				ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
			)
		).not.toContain("Cannot find module '$fieldstone-config' or its corresponding type declarations.");
	});
});
