#!/usr/bin/env node
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

const command = process.argv[2] ?? 'generate';

if (command !== 'generate') {
	console.error(`Unknown fieldstone command: ${command}`);
	process.exit(1);
}

const root = process.cwd();
const collectionsDir = path.join(root, 'collections');
const outputDir = path.join(root, '.fieldstone');

function isCollectionFile(entry) {
	return (
		entry.endsWith('.ts') &&
		!entry.endsWith('.d.ts') &&
		!entry.includes('.test.') &&
		!entry.includes('.spec.') &&
		!entry.startsWith('_')
	);
}

const server = await createServer({
	configFile: false,
	root,
	server: { middlewareMode: true }
});

try {
	const entries = await readdir(collectionsDir).catch(() => []);
	const collections = {};

	for (const entry of entries.filter(isCollectionFile).sort()) {
		const slug = path.basename(entry, '.ts');
		const file = path.join(collectionsDir, entry);
		const module = await server.ssrLoadModule(file);

		collections[slug] = {
			...module.default,
			slug
		};
	}

	const schemaModulePath = fileURLToPath(new URL('../src/schema.ts', import.meta.url));
	const { generateDrizzleSchemaSource, generateTypes } =
		await server.ssrLoadModule(schemaModulePath);
	const config = {
		db: {
			dialect: 'sqlite',
			url: process.env.DATABASE_URL ?? 'local.db'
		},
		collections
	};

	await mkdir(outputDir, { recursive: true });
	await Promise.all([
		writeFile(path.join(outputDir, 'schema.ts'), generateDrizzleSchemaSource(config)),
		writeFile(path.join(outputDir, 'types.d.ts'), generateTypes(config))
	]);
} finally {
	await server.close();
}
