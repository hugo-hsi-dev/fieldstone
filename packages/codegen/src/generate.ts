import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FieldstoneConfig } from "@fieldstone/schema";
import type { FieldstoneCompiledConfig } from "@fieldstone/compiler";
import { discoverCollections, discoverGlobals } from "./collections.ts";

type LoadModule = <T = Record<string, unknown>>(id: string) => Promise<T>;

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
