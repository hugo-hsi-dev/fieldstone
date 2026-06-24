import path from "node:path";

import type { FieldstoneConfigInput } from "@hugo-hsi-dev/schema";

import {
  discoverCollections,
  discoverGlobals,
  normalizePath,
} from "./collections.ts";

export async function loadVirtualConfig(
  root: string,
  options: FieldstoneConfigInput,
) {
  const [collections, globals] = await Promise.all([
    discoverCollections(root),
    discoverGlobals(root),
  ]);
  const collectionImports = collections
    .map(({ file, slug }, index) => {
      const importPath = `/${normalizePath(path.relative(root, file))}`;
      return `import collection${index} from ${JSON.stringify(importPath)};\nconst runtimeCollection${index} = { ...collection${index}, slug: ${JSON.stringify(slug)} };`;
    })
    .join("\n");
  const globalImports = globals
    .map(({ file, slug }, index) => {
      const importPath = `/${normalizePath(path.relative(root, file))}`;
      return `import global${index} from ${JSON.stringify(importPath)};\nconst runtimeGlobal${index} = { ...global${index}, slug: ${JSON.stringify(slug)} };`;
    })
    .join("\n");
  const imports = [collectionImports, globalImports].filter(Boolean).join("\n");
  const collectionEntries = collections
    .map(
      ({ slug }, index) => `${JSON.stringify(slug)}: runtimeCollection${index}`,
    )
    .join(",\n");
  const globalEntries = globals
    .map(({ slug }, index) => `${JSON.stringify(slug)}: runtimeGlobal${index}`)
    .join(",\n");

  // The storage block is declarative data; the live adapter is resolved from it
  // at runtime (a function can't ride in the serialized config module).
  const storageBlock = options.storage
    ? `  storage: ${JSON.stringify(options.storage)},\n`
    : "";

  return `${imports}\n\nconst databaseURL = process.env.DATABASE_URL ?? ${JSON.stringify(options.db.url)};\n\nexport default {\n  db: {\n    dialect: ${JSON.stringify(options.db.dialect)},\n    url: databaseURL\n  },\n${storageBlock}  collections: {\n${collectionEntries}\n  },\n  globals: {\n${globalEntries}\n  }\n};\n`;
}
