#!/usr/bin/env node
import { createRequire } from 'node:module';

import { createServer } from 'vite';

const command = process.argv[2] ?? 'generate';

if (command !== 'generate') {
	console.error(`Unknown fieldstone command: ${command}`);
	process.exit(1);
}

const root = process.cwd();
const require = createRequire(import.meta.url);
const previousGenerateEnv = process.env.FIELDSTONE_GENERATE;
process.env.FIELDSTONE_GENERATE = 'true';

const server = await createServer({
	root,
	server: { middlewareMode: true }
});

try {
	const generatorModulePath = require.resolve('@fieldstone/codegen');
	const coreModulePath = require.resolve('@fieldstone/compiler');
	const [{ loadFieldstoneConfig, writeGeneratedFiles }, { compileFieldstoneConfig }] =
		await Promise.all([
			server.ssrLoadModule(generatorModulePath),
			server.ssrLoadModule(coreModulePath)
		]);
	const config = await loadFieldstoneConfig({
		loadModule: (id) => server.ssrLoadModule(id),
		root
	});
	const compiled = compileFieldstoneConfig(config);

	await writeGeneratedFiles({
		compiled,
		root
	});
} finally {
	await server.close();
	if (previousGenerateEnv === undefined) {
		delete process.env.FIELDSTONE_GENERATE;
	} else {
		process.env.FIELDSTONE_GENERATE = previousGenerateEnv;
	}
}
