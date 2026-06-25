import { sqliteTable } from "drizzle-orm/sqlite-core";

import type { SchemaPlan } from "./collection-model.js";
import { createRuntimeColumn } from "./column-renderers.js";

export type RuntimeSchema = {
  schema: Record<string, any>;
  tables: Record<string, any>;
};

export function createRuntimeSchema(schemaPlan: SchemaPlan): RuntimeSchema {
  const tables: Record<string, any> = {};

  for (const collection of [...schemaPlan.collections, ...schemaPlan.globals]) {
    const columns: Record<string, any> = {};

    for (const column of collection.columns) {
      columns[column.runtimeKey] = createRuntimeColumn(column);
    }

    tables[collection.slug] = sqliteTable(collection.slug, columns);
  }

  return {
    schema: tables,
    tables,
  };
}
