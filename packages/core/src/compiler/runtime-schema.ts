import crypto from 'node:crypto';

import { integer, sqliteTable, text as sqliteText } from 'drizzle-orm/sqlite-core';

import type { CollectionModel, CompiledSystemField } from './collection-model.ts';

export type RuntimeSchema = {
	schema: Record<string, any>;
	tables: Record<string, any>;
};

function createSystemColumn(field: CompiledSystemField) {
	if (field.identifier === 'id') {
		return sqliteText(field.columnName)
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID());
	}

	return integer(field.columnName, { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date());
}

export function createRuntimeSchema(model: CollectionModel): RuntimeSchema {
	const tables: Record<string, any> = {};

	for (const collection of model.collections) {
		const columns: Record<string, any> = {};

		for (const field of collection.fields) {
			columns[field.name] = field.required
				? sqliteText(field.name).notNull()
				: sqliteText(field.name);
		}

		const [idField, createdAtField, updatedAtField] = collection.systemFields;

		tables[collection.slug] = sqliteTable(collection.slug, {
			[idField.identifier]: createSystemColumn(idField),
			...columns,
			[createdAtField.identifier]: createSystemColumn(createdAtField),
			[updatedAtField.identifier]: createSystemColumn(updatedAtField)
		});
	}

	return {
		schema: tables,
		tables
	};
}
