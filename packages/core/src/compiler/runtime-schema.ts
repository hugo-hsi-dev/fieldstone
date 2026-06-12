import crypto from 'node:crypto';

import { integer, sqliteTable, text as sqliteText } from 'drizzle-orm/sqlite-core';

import type { FieldstoneConfig } from '../types.ts';
import { validateFieldstoneConfig } from './validation.ts';

export function compileFieldstoneConfig(config: FieldstoneConfig) {
	validateFieldstoneConfig(config);
	const tables: Record<string, any> = {};

	for (const collection of Object.values(config.collections)) {
		const columns: Record<string, any> = {};

		for (const field of collection.fields) {
			columns[field.name] = field.required
				? sqliteText(field.name).notNull()
				: sqliteText(field.name);
		}

		tables[collection.slug] = sqliteTable(collection.slug, {
			id: sqliteText('id')
				.primaryKey()
				.$defaultFn(() => crypto.randomUUID()),
			...columns,
			createdAt: integer('created_at', { mode: 'timestamp' })
				.notNull()
				.$defaultFn(() => new Date()),
			updatedAt: integer('updated_at', { mode: 'timestamp' })
				.notNull()
				.$defaultFn(() => new Date())
		});
	}

	return {
		schema: tables,
		tables
	};
}
