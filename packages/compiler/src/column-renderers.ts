import crypto from "node:crypto";

import {
  integer,
  real,
  text as sqliteText,
} from "drizzle-orm/sqlite-core";

import type { CompiledColumn } from "./collection-model.js";

function requiredAndUnique(builder: any, column: CompiledColumn) {
  if (column.required) builder = builder.notNull();
  if (column.unique) builder = builder.unique();
  return builder;
}

function sourceModifiers(column: CompiledColumn) {
  return `${column.required ? ".notNull()" : ""}${column.unique ? ".unique()" : ""}`;
}

type ColumnRenderer = {
  runtime: (column: CompiledColumn) => any;
  source: (column: CompiledColumn) => string;
};

export const columnRenderers: Record<CompiledColumn["sourceExpression"], ColumnRenderer> = {
  boolean: {
    runtime: (column) =>
      integer(column.columnName, { mode: "boolean" })
        .notNull()
        .default(false),
    source: (column) =>
      `integer(${JSON.stringify(column.columnName)}, { mode: 'boolean' }).notNull().default(false)`,
  },
  dateValue: {
    runtime: (column) =>
      requiredAndUnique(integer(column.columnName, { mode: "timestamp" }), column),
    source: (column) =>
      `integer(${JSON.stringify(column.columnName)}, { mode: 'timestamp' })${sourceModifiers(column)}`,
  },
  json: {
    runtime: (column) => requiredAndUnique(sqliteText(column.columnName, { mode: "json" }), column),
    source: (column) =>
      `text(${JSON.stringify(column.columnName)}, { mode: 'json' })${sourceModifiers(column)}`,
  },
  number: {
    runtime: (column) => requiredAndUnique(real(column.columnName), column),
    source: (column) => `real(${JSON.stringify(column.columnName)})${sourceModifiers(column)}`,
  },
  text: {
    runtime: (column) => requiredAndUnique(sqliteText(column.columnName), column),
    source: (column) => `text(${JSON.stringify(column.columnName)})${sourceModifiers(column)}`,
  },
  timestampNow: {
    runtime: (column) =>
      integer(column.columnName, { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
    source: (column) =>
      `integer(${JSON.stringify(column.columnName)}, { mode: 'timestamp' })
\t\t.notNull()
\t\t.$defaultFn(() => new Date())`,
  },
  uuidTextPrimaryKey: {
    runtime: (column) =>
      sqliteText(column.columnName)
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    source: (column) =>
      `text(${JSON.stringify(column.columnName)})
\t\t.primaryKey()
\t\t.$defaultFn(() => crypto.randomUUID())`,
  },
};

export function createRuntimeColumn(column: CompiledColumn) {
  return columnRenderers[column.sourceExpression].runtime(column);
}

export function renderColumnSource(column: CompiledColumn) {
  return `\t${column.identifier}: ${columnRenderers[column.sourceExpression].source(column)},`;
}
