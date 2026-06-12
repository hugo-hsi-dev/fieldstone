import crypto from 'node:crypto';

import { integer, sqliteTable, text as sqliteText } from 'drizzle-orm/sqlite-core';

import type { SchemaPlan } from './schema-plan.ts';

export type RuntimeSchema = {
	schema: Record<string, any>;
	tables: Record<string, any>;
};

export function createRuntimeSchema(plan: SchemaPlan): RuntimeSchema {
	const tables: Record<string, any> = {};
	const { createdAt, id, updatedAt } = plan.systemFields;

	for (const collection of plan.collections) {
		const columns: Record<string, any> = {};

		for (const field of collection.fields) {
			columns[field.name] = field.required
				? sqliteText(field.name).notNull()
				: sqliteText(field.name);
		}

		tables[collection.slug] = sqliteTable(collection.slug, {
			[id.name]: sqliteText(id.columnName)
				.primaryKey()
				.$defaultFn(() => crypto.randomUUID()),
			...columns,
			[createdAt.name]: integer(createdAt.columnName, { mode: 'timestamp' })
				.notNull()
				.$defaultFn(() => new Date()),
			[updatedAt.name]: integer(updatedAt.columnName, { mode: 'timestamp' })
				.notNull()
				.$defaultFn(() => new Date())
		});
	}

	return {
		schema: tables,
		tables
	};
}
