import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FieldstoneConfig } from "@hugo-hsi-dev/schema";
import type { FieldstoneCompiledConfig } from "@hugo-hsi-dev/compiler";
import { discoverCollections, discoverGlobals } from "./collections.ts";

type LoadModule = <T = Record<string, unknown>>(id: string) => Promise<T>;

// Loads the app's collections/globals using the host's own Vite config (so aliases
// etc. resolve), WITHOUT requiring the fieldstone() plugin's $fieldstone-config virtual
// module — `generate` only emits types, so it must work before the plugin is wired.
// The `db.url` here is a placeholder: codegen never opens the database; the running app
// and `push` resolve the real URL from the plugin (DATABASE_URL env, else db.url).
export async function loadFieldstoneConfig({
  loadModule,
  root,
}: {
  loadModule: LoadModule;
  root: string;
}): Promise<FieldstoneConfig> {
  const [collectionFiles, globalFiles] = await Promise.all([
    discoverCollections(root),
    discoverGlobals(root),
  ]);
  const collections: FieldstoneConfig["collections"] = {};
  const globals: NonNullable<FieldstoneConfig["globals"]> = {};

  for (const { file, slug } of collectionFiles) {
    const module = await loadModule<{
      default: FieldstoneConfig["collections"][string];
    }>(file);
    collections[slug] = {
      ...module.default,
      slug,
    };
  }

  for (const { file, slug } of globalFiles) {
    const module = await loadModule<{
      default: NonNullable<FieldstoneConfig["globals"]>[string];
    }>(file);
    globals[slug] = {
      ...module.default,
      slug,
    };
  }

  return {
    db: {
      dialect: "sqlite",
      url: process.env.DATABASE_URL ?? "local.db",
    },
    collections,
    globals,
  };
}

export async function writeGeneratedFiles({
  compiled,
  root,
}: {
  compiled: FieldstoneCompiledConfig;
  root: string;
}) {
  const outputDir = path.join(root, ".fieldstone");
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, "schema.ts"), compiled.renderSchemaSource()),
    writeFile(
      path.join(outputDir, "types.d.ts"),
      compiled.renderTypesDeclaration(),
    ),
  ]);
}
