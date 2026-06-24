// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./fieldstone-config.d.ts" />

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  FieldstoneConfig,
  FieldstoneConfigInput,
} from "@hugo-hsi-dev/schema";
import { compileFieldstoneConfig } from "@hugo-hsi-dev/compiler";
import type { Plugin, ViteDevServer } from "vite";

import {
  CMS_DIR,
  COLLECTION_FILENAME,
  CONFIG_ID,
  GLOBAL_FILENAME,
  RESOLVED_CONFIG_ID,
  isWatchedCollectionFile,
  isWatchedGlobalFile,
  loadVirtualConfig,
  pushSchema,
} from "@hugo-hsi-dev/codegen";

type FieldstonePluginOptions = FieldstoneConfigInput;

async function writeTypes(
  root: string,
  compiled: ReturnType<typeof compileFieldstoneConfig>,
) {
  const outputFile = path.join(root, ".fieldstone", "types.d.ts");
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, compiled.renderTypesDeclaration());
}

async function assertNoBlankKnownContent(
  root: string,
  knownSlugs: ReadonlySet<string>,
) {
  for (const slug of knownSlugs) {
    const sources: string[] = [];
    const files = [
      path.join(root, CMS_DIR, slug, COLLECTION_FILENAME),
      path.join(root, CMS_DIR, slug, GLOBAL_FILENAME),
    ];

    for (const file of files) {
      try {
        sources.push(await readFile(file, "utf-8"));
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          continue;
        }
        throw error;
      }
    }

    if (sources.some((source) => source.trim())) continue;
    if (sources.length > 0) {
      throw new Error(
        `Content ${slug} is temporarily blank. Keeping previous config.`,
      );
    }
  }
}

function invalidateImporters(
  server: ViteDevServer,
  id: string,
  seen = new Set<string>(),
) {
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
  let previousFingerprint = "";
  let previousContentSlugs = new Set<string>();
  let rebuildTimer: NodeJS.Timeout | undefined;

  async function rebuild(server: ViteDevServer) {
    await assertNoBlankKnownContent(root, previousContentSlugs);
    server.moduleGraph.invalidateAll();
    invalidateImporters(server, RESOLVED_CONFIG_ID);

    const config = (await server.ssrLoadModule(CONFIG_ID))
      .default as FieldstoneConfig;
    const compiled = compileFieldstoneConfig(config);
    const fingerprint = compiled.schemaFingerprint();
    await writeTypes(root, compiled);
    previousContentSlugs = new Set([
      ...Object.keys(config.collections),
      ...Object.keys(config.globals ?? {}),
    ]);

    if (fingerprint !== previousFingerprint) {
      const didPush = await pushSchema(config, compiled);
      if (!didPush) return;
      previousFingerprint = fingerprint;
      server.ws.send({ type: "full-reload" });
    }
  }

  function warnRebuildFailure(server: ViteDevServer, error: unknown) {
    const message =
      error instanceof Error ? error.stack || error.message : String(error);
    server.config.logger.warn(
      `Fieldstone collection rebuild failed. Keeping previous config.\n${message}`,
    );
  }

  function scheduleRebuild(server: ViteDevServer) {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      void rebuild(server).catch((error) => warnRebuildFailure(server, error));
    }, 100);
  }

  return {
    name: "fieldstone",

    configResolved(config) {
      root = config.root;
    },

    resolveId(source, _importer, resolveOptions) {
      if (source !== CONFIG_ID) return;
      if (resolveOptions?.ssr === false) {
        throw new Error(
          "$fieldstone-config is server-only and cannot be imported by client code.",
        );
      }
      return RESOLVED_CONFIG_ID;
    },

    async load(id) {
      if (id !== RESOLVED_CONFIG_ID) return;
      return loadVirtualConfig(root, options);
    },

    configureServer(server) {
      if (process.env.VITEST || process.env.FIELDSTONE_GENERATE === "true")
        return;

      const cmsDir = path.join(root, CMS_DIR);
      server.watcher.add(cmsDir);
      server.watcher.add(path.join(cmsDir, "*", COLLECTION_FILENAME));
      server.watcher.add(path.join(cmsDir, "*", GLOBAL_FILENAME));
      server.watcher.on("add", (file) => {
        if (
          !isWatchedCollectionFile(cmsDir, file) &&
          !isWatchedGlobalFile(cmsDir, file)
        )
          return;
        scheduleRebuild(server);
      });
      server.watcher.on("change", (file) => {
        if (
          isWatchedCollectionFile(cmsDir, file) ||
          isWatchedGlobalFile(cmsDir, file)
        ) {
          scheduleRebuild(server);
        }
      });
      server.watcher.on("unlink", (file) => {
        if (
          isWatchedCollectionFile(cmsDir, file) ||
          isWatchedGlobalFile(cmsDir, file)
        ) {
          scheduleRebuild(server);
        }
      });

      if (process.env.FIELDSTONE_PUSH_ON_CONFIGURE === "true") {
        return rebuild(server);
      }

      return () => scheduleRebuild(server);
    },
  };
}
