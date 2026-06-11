/// <reference path="./fieldstone-config.d.ts" />

import { compileFieldstoneConfig } from './schema.ts';
import type {
	CollectionDefinition,
	CollectionRuntimeConfig,
	FieldstoneConfig,
	FieldstoneConfigInput,
	TextFieldDefinition
} from './types.ts';

export type {
	CollectionDefinition,
	CollectionRuntimeConfig,
	FieldstoneConfig,
	FieldstoneConfigInput,
	GeneratedCollections,
	TextFieldDefinition
} from './types.ts';

export type DocumentData = Record<string, string>;

export function text(config: Omit<TextFieldDefinition, 'type'>): TextFieldDefinition {
	return { ...config, type: 'text' };
}

export function collection(config: {
	fields: readonly TextFieldDefinition[];
}): CollectionDefinition {
	const seen = new Set<string>();
	const reserved = new Set(['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at']);
	for (const field of config.fields) {
		if (reserved.has(field.name)) throw new Error(`Reserved field name: ${field.name}`);
		if (seen.has(field.name)) throw new Error(`Duplicate field name: ${field.name}`);
		seen.add(field.name);
	}

	return { fields: [...config.fields] };
}

export function defineConfig(config: FieldstoneConfigInput): FieldstoneConfigInput {
	return config;
}

function getCollection(config: FieldstoneConfig, collectionSlug: string): CollectionRuntimeConfig {
	if (!Object.prototype.hasOwnProperty.call(config.collections, collectionSlug)) {
		throw new Error(`Unsupported collection: ${collectionSlug}`);
	}

	const collectionConfig = config.collections[collectionSlug];
	if (!collectionConfig) throw new Error(`Unsupported collection: ${collectionSlug}`);
	return collectionConfig;
}

function normalizeData(config: FieldstoneConfig, collectionSlug: string, data: DocumentData) {
	const collectionConfig = getCollection(config, collectionSlug);
	const allowedFields = new Set(collectionConfig.fields.map((field) => field.name));
	const normalized: DocumentData = {};

	for (const field of collectionConfig.fields) {
		const value = String(data[field.name] ?? '').trim();
		if (field.required && !value) throw new Error(`${field.name} is required`);
		normalized[field.name] = value;
	}

	for (const fieldName of Object.keys(data)) {
		if (!allowedFields.has(fieldName)) throw new Error(`Unknown field: ${fieldName}`);
	}

	return normalized;
}

function normalizeSqliteUrl(url: string) {
	if (/^[a-z]+:/i.test(url)) return url;
	return `file:${url}`;
}

export async function getFieldstone({ config }: { config: FieldstoneConfig }) {
	const [{ createClient }, { desc, eq }, { drizzle }] = await Promise.all([
		import('@libsql/client'),
		import('drizzle-orm'),
		import('drizzle-orm/libsql')
	]);
	const compiled = compileFieldstoneConfig(config);
	const client = createClient({ url: normalizeSqliteUrl(config.db.url) });
	const database = drizzle(client, { schema: compiled.schema });

	return {
		collections: Object.values(config.collections),

		getCollection: (slug: string) =>
			Object.prototype.hasOwnProperty.call(config.collections, slug)
				? (config.collections[slug] ?? null)
				: null,

		find: async ({ collection: collectionSlug }: { collection: string }) => {
			getCollection(config, collectionSlug);
			const table = compiled.tables[collectionSlug];
			return database.select().from(table).orderBy(desc(table.createdAt));
		},

		findById: async ({ collection: collectionSlug, id }: { collection: string; id: string }) => {
			getCollection(config, collectionSlug);
			const table = compiled.tables[collectionSlug];
			const [document] = await database.select().from(table).where(eq(table.id, id)).limit(1);
			return document ?? null;
		},

		create: async ({
			collection: collectionSlug,
			createdAt,
			data,
			updatedAt
		}: {
			collection: string;
			createdAt?: Date;
			data: DocumentData;
			updatedAt?: Date;
		}) => {
			const document = normalizeData(config, collectionSlug, data);
			const table = compiled.tables[collectionSlug];
			const now = new Date();
			const createdRows = (await database
				.insert(table)
				.values({
					...document,
					createdAt: createdAt ?? now,
					updatedAt: updatedAt ?? now
				})
				.returning()) as any[];
			const [created] = createdRows;

			return created;
		},

		update: async ({
			collection: collectionSlug,
			data,
			id,
			updatedAt
		}: {
			collection: string;
			data: DocumentData;
			id: string;
			updatedAt?: Date;
		}) => {
			const document = normalizeData(config, collectionSlug, data);
			const table = compiled.tables[collectionSlug];
			const updatedRows = (await database
				.update(table)
				.set({
					...document,
					updatedAt: updatedAt ?? new Date()
				})
				.where(eq(table.id, id))
				.returning()) as any[];
			const [updated] = updatedRows;

			if (!updated) throw new Error('Document not found');
			return updated;
		},

		delete: async ({ collection: collectionSlug, id }: { collection: string; id: string }) => {
			getCollection(config, collectionSlug);
			const table = compiled.tables[collectionSlug];
			const deletedRows = (await database
				.delete(table)
				.where(eq(table.id, id))
				.returning({ id: table.id })) as any[];
			const [deleted] = deletedRows;

			if (!deleted) throw new Error('Document not found');
			return deleted;
		}
	};
}
