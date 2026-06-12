import crypto from 'node:crypto';

import { integer, sqliteTable, text as sqliteText } from 'drizzle-orm/sqlite-core';

import type { CompiledColumn, SchemaPlan } from './collection-model.ts';

export type RuntimeSchema = {
	schema: Record<string, any>;
	tables: Record<string, any>;
};

function createRuntimeColumn(column: CompiledColumn) {
	if (column.origin === 'field') {
		return column.required ? sqliteText(column.columnName).notNull() : sqliteText(column.columnName);
	}

	if (column.identifier === 'id') {
		return sqliteText(column.columnName)
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID());
	}

	return integer(column.columnName, { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date());
}

export function createRuntimeSchema(schemaPlan: SchemaPlan): RuntimeSchema {
	const tables: Record<string, any> = {};

	for (const collection of schemaPlan.collections) {
		const columns: Record<string, any> = {};

		for (const column of collection.columns) {
			columns[column.runtimeKey] = createRuntimeColumn(column);
		}

		tables[collection.slug] = sqliteTable(collection.slug, columns);
	}

	return {
		schema: tables,
		tables
	};
}
