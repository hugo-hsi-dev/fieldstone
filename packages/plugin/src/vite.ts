import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import type { Plugin, ViteDevServer } from 'vite';

import { compileFieldstoneConfig, createSchemaFingerprint, generateTypes } from './schema.ts';
import type { FieldstoneConfig, FieldstoneConfigInput } from './types.ts';

const CONFIG_ID = '$fieldstone-config';
const RESOLVED_CONFIG_ID = '\0fieldstone-config';

type FieldstonePluginOptions = FieldstoneConfigInput;

function normalizePath(file: string) {
	return file.split(path.sep).join('/');
}

function normalizeSqliteUrl(url: string) {
	if (/^[a-z]+:/i.test(url)) return url;
	return `file:${url}`;
}

function isCollectionFile(collectionsDir: string, file: string) {
	const basename = path.basename(file);
	return (
		file.startsWith(collectionsDir) &&
		file.endsWith('.ts') &&
		!file.endsWith('.d.ts') &&
		!file.includes('.test.') &&
		!file.includes('.spec.') &&
		(!basename.startsWith('_') || basename === '__proto__.ts')
	);
}

function isCollectionEntry(entry: string) {
	return (
		entry.endsWith('.ts') &&
		!entry.endsWith('.d.ts') &&
		!entry.includes('.test.') &&
		!entry.includes('.spec.') &&
		!entry.startsWith('_')
	);
}

function validateCollectionEntries(entries: string[]) {
	const slugs = new Set<string>();

	for (const entry of entries) {
		if (
			!entry.endsWith('.ts') ||
			entry.endsWith('.d.ts') ||
			entry.includes('.test.') ||
			entry.includes('.spec.')
		) {
			continue;
		}

		const slug = path.basename(entry, '.ts');
		if (slug === '__proto__') throw new Error('Reserved collection slug: __proto__');
		if (entry.startsWith('_')) continue;

		const normalizedSlug = slug.toLowerCase();
		if (slugs.has(normalizedSlug)) throw new Error(`Duplicate collection slug: ${slug}`);
		slugs.add(normalizedSlug);
	}
}

function createCollectionScaffold(slug: string) {
	return `import { collection, text } from '@fieldstone/plugin';

export default collection({
\tfields: [
\t\ttext({ name: 'title', required: true })
\t]
});
`;
}

async function scaffoldCollectionFile(file: string) {
	const source = await readFile(file, 'utf-8');
	if (source.trim()) return false;

	await writeFile(file, createCollectionScaffold(path.basename(file, '.ts')));
	return true;
}

async function discoverCollections(root: string) {
	const collectionsDir = path.join(root, 'collections');
	let entries: string[] = [];

	try {
		entries = await readdir(collectionsDir);
	} catch {
		return [];
	}

	validateCollectionEntries(entries);

	return entries
		.filter(isCollectionEntry)
		.sort()
		.map((entry) => ({
			file: path.join(collectionsDir, entry),
			slug: path.basename(entry, '.ts')
		}));
}

async function loadVirtualConfig(root: string, options: FieldstonePluginOptions) {
	const collections = await discoverCollections(root);
	const imports = collections
		.map(({ file, slug }, index) => {
			const importPath = `/${normalizePath(path.relative(root, file))}`;
			return `import collection${index} from ${JSON.stringify(importPath)};\nconst runtimeCollection${index} = { ...collection${index}, slug: ${JSON.stringify(slug)} };`;
		})
		.join('\n');
	const collectionEntries = collections
		.map(({ slug }, index) => `${JSON.stringify(slug)}: runtimeCollection${index}`)
		.join(',\n');

	return `${imports}\n\nconst databaseURL = process.env.DATABASE_URL ?? ${JSON.stringify(options.db.url)};\n\nexport default {\n  db: {\n    dialect: ${JSON.stringify(options.db.dialect)},\n    url: databaseURL\n  },\n  collections: {\n${collectionEntries}\n  }\n};\n`;
}

async function writeTypes(root: string, config: FieldstoneConfig) {
	const outputFile = path.join(root, '.fieldstone', 'types.d.ts');
	await mkdir(path.dirname(outputFile), { recursive: true });
	await writeFile(outputFile, generateTypes(config));
}

function invalidateImporters(server: ViteDevServer, id: string, seen = new Set<string>()) {
	if (seen.has(id)) return;
	seen.add(id);

	const module = server.moduleGraph.getModuleById(id);
	if (!module) return;

	server.moduleGraph.invalidateModule(module);
	for (const importer of module.importers) {
		if (importer.id) invalidateImporters(server, importer.id, seen);
	}
}

async function confirmWarnings(warnings: string[], hasDataLoss: boolean) {
	if (!warnings.length) return true;

	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const message = [
		'Fieldstone schema push warnings:',
		'',
		...warnings,
		hasDataLoss ? '\nDATA LOSS WARNING: possible data loss detected.' : '',
		'',
		'Accept warnings and push schema? (y/N) '
	].join('\n');

	try {
		const answer = await rl.question(message);
		return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
	} finally {
		rl.close();
	}
}

async function pushSchema(config: FieldstoneConfig) {
	const { pushSQLiteSchema } = await import('drizzle-kit/api');
	const compiled = compileFieldstoneConfig(config);
	const client = createClient({ url: normalizeSqliteUrl(config.db.url) });
	const database = drizzle(client, { schema: compiled.schema });
	const { apply, hasDataLoss, warnings } = await pushSQLiteSchema(compiled.schema, database);

	if (!(await confirmWarnings(warnings, hasDataLoss))) return false;
	await apply();
	return true;
}

export function fieldstone(options: FieldstonePluginOptions): Plugin {
	let root = process.cwd();
	let previousFingerprint = '';
	let rebuildTimer: NodeJS.Timeout | undefined;

	async function rebuild(server: ViteDevServer) {
		server.moduleGraph.invalidateAll();
		invalidateImporters(server, RESOLVED_CONFIG_ID);

		const config = (await server.ssrLoadModule(CONFIG_ID)).default as FieldstoneConfig;
		const fingerprint = createSchemaFingerprint(config);
		await writeTypes(root, config);

		if (fingerprint !== previousFingerprint) {
			const didPush = await pushSchema(config);
			if (!didPush) return;
			previousFingerprint = fingerprint;
		}

		server.ws.send({ type: 'full-reload' });
	}

	function scheduleRebuild(server: ViteDevServer) {
		clearTimeout(rebuildTimer);
		rebuildTimer = setTimeout(() => {
			void rebuild(server).catch((error) => {
				server.config.logger.error(
					error instanceof Error ? error.stack || error.message : String(error)
				);
			});
		}, 100);
	}

	return {
		name: 'fieldstone',

		configResolved(config) {
			root = config.root;
		},

		resolveId(source, _importer, resolveOptions) {
			if (source !== CONFIG_ID) return;
			if (resolveOptions?.ssr === false) {
				throw new Error('$fieldstone-config is server-only and cannot be imported by client code.');
			}
			return RESOLVED_CONFIG_ID;
		},

		async load(id) {
			if (id !== RESOLVED_CONFIG_ID) return;
			return loadVirtualConfig(root, options);
		},

		configureServer(server) {
			if (process.env.VITEST || process.env.FIELDSTONE_GENERATE === 'true') return;

			const collectionsDir = path.join(root, 'collections');
			server.watcher.add(collectionsDir);
			server.watcher.add(path.join(collectionsDir, '*.ts'));
			server.watcher.on('add', (file) => {
				if (!isCollectionFile(collectionsDir, file)) return;
				void scaffoldCollectionFile(file)
					.catch((error) => {
						server.config.logger.error(
							error instanceof Error ? error.stack || error.message : String(error)
						);
					})
					.finally(() => scheduleRebuild(server));
			});
			server.watcher.on('change', (file) => {
				if (isCollectionFile(collectionsDir, file)) scheduleRebuild(server);
			});
			server.watcher.on('unlink', (file) => {
				if (isCollectionFile(collectionsDir, file)) scheduleRebuild(server);
			});

			if (process.env.FIELDSTONE_PUSH_ON_CONFIGURE === 'true') {
				return rebuild(server);
			}

			return () => scheduleRebuild(server);
		}
	};
}

export const fieldstoneConfigModuleID = CONFIG_ID;
export const resolvedFieldstoneConfigModuleID = RESOLVED_CONFIG_ID;
export const fieldstoneCollectionScaffold = createCollectionScaffold;
