/// <reference path="./fieldstone-config.d.ts" />

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FieldstoneConfig, FieldstoneConfigInput } from '@fieldstone/schema';
import { compileFieldstoneConfig } from '@fieldstone/compiler';
import type { Plugin, ViteDevServer } from 'vite';

import {
	CONFIG_ID,
	RESOLVED_CONFIG_ID,
	isWatchedCollectionFile,
	loadVirtualConfig,
	pushSchema,
	scaffoldCollectionFile
} from '@fieldstone/codegen';

type FieldstonePluginOptions = FieldstoneConfigInput;

async function writeTypes(root: string, compiled: ReturnType<typeof compileFieldstoneConfig>) {
	const outputFile = path.join(root, '.fieldstone', 'types.d.ts');
	await mkdir(path.dirname(outputFile), { recursive: true });
	await writeFile(outputFile, compiled.renderTypesDeclaration());
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

export function fieldstone(options: FieldstonePluginOptions): Plugin {
	let root = process.cwd();
	let previousFingerprint = '';
	let rebuildTimer: NodeJS.Timeout | undefined;

	async function rebuild(server: ViteDevServer) {
		server.moduleGraph.invalidateAll();
		invalidateImporters(server, RESOLVED_CONFIG_ID);

		const config = (await server.ssrLoadModule(CONFIG_ID)).default as FieldstoneConfig;
		const compiled = compileFieldstoneConfig(config);
		const fingerprint = compiled.schemaFingerprint();
		await writeTypes(root, compiled);

		if (fingerprint !== previousFingerprint) {
			const didPush = await pushSchema(config, compiled);
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
				if (!isWatchedCollectionFile(collectionsDir, file)) return;
				void scaffoldCollectionFile(file)
					.catch((error) => {
						server.config.logger.error(
							error instanceof Error ? error.stack || error.message : String(error)
						);
					})
					.finally(() => scheduleRebuild(server));
			});
			server.watcher.on('change', (file) => {
				if (isWatchedCollectionFile(collectionsDir, file)) scheduleRebuild(server);
			});
			server.watcher.on('unlink', (file) => {
				if (isWatchedCollectionFile(collectionsDir, file)) scheduleRebuild(server);
			});

			if (process.env.FIELDSTONE_PUSH_ON_CONFIGURE === 'true') {
				return rebuild(server);
			}

			return () => scheduleRebuild(server);
		}
	};
}
