import type { FieldstoneConfig } from "@hugo-hsi-dev/schema";

import { createDatabase } from "./database.ts";
import { createDocumentRuntime } from "./documents.ts";
import { createGlobalRuntime } from "./globals.ts";

export async function createFieldstoneRuntime(config: FieldstoneConfig) {
  const database = await createDatabase(config);
  const documents = createDocumentRuntime(database);
  const globals = createGlobalRuntime(database);

  return {
    collections: database.collections,
    globals: database.globals,
    storage: database.storage,

    getCollection: (slug: string) =>
      database.compiledConfig.getCollection(slug),
    getGlobalConfig: (slug: string) => database.compiledConfig.getGlobal(slug),

    find: documents.find,
    count: documents.count,
    findById: documents.findById,
    create: documents.create,
    update: documents.update,
    delete: documents.delete,
    getGlobal: globals.getGlobal,
    updateGlobal: globals.updateGlobal,
  };
}
