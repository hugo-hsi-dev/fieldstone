import type { FieldstoneConfig } from "@hugo-hsi-dev/schema";

import { createDatabase } from "./database.js";
import { createDocumentRuntime } from "./documents.js";
import { createGlobalRuntime } from "./globals.js";

export type {
  CollectionInput,
  CreateInput,
  DocumentInput,
  GlobalInput,
  ListInput,
  ListSort,
  MutationInput,
  UpdateGlobalInput,
  UpdateInput,
  WhereClause,
  WhereOperators,
} from "./types.js";

export { ForbiddenError, isForbiddenError } from "./access.js";
export {
  assertSafeStorageKey,
  DEFAULT_STATIC_DIR,
  DEFAULT_STATIC_URL,
  LocalDiskStorage,
  resolveStorage,
  type StorageObject,
} from "./storage.js";

export async function getFieldstone({ config }: { config: FieldstoneConfig }) {
  const database = await createDatabase(config);
  const documents = createDocumentRuntime(database);
  const globals = createGlobalRuntime(database);

  return {
    collections: database.collections,
    globals: database.globals,
    storage: database.storage,

    getCollection: (slug: string) => database.compiledConfig.getCollection(slug),
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
