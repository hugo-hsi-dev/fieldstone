/// <reference path="./fieldstone-config.d.ts" />

import { compileFieldstoneConfig } from '@fieldstone/core';
import type {
	CollectionData,
	CollectionDocument,
	CollectionRuntimeConfig,
	CollectionSlug,
	FieldstoneConfig
} from '@fieldstone/core';

export type DocumentData = Record<string, string>;
export type FieldstoneCollectionSlug = CollectionSlug;
export type FieldstoneDocument<TCollection extends CollectionSlug> =
	CollectionDocument<TCollection>;
export type FieldstoneDocumentData<TCollection extends CollectionSlug> =
	CollectionData<TCollection>;

export type CollectionInput<TCollection extends CollectionSlug = CollectionSlug> = {
	collection: TCollection;
};

export type DocumentInput<TCollection extends CollectionSlug = CollectionSlug> =
	CollectionInput<TCollection> & {
		id: string;
	};

export type MutationInput<TCollection extends CollectionSlug = CollectionSlug> =
	CollectionInput<TCollection> & {
		data: CollectionData<TCollection>;
	};

export type CreateInput<TCollection extends CollectionSlug = CollectionSlug> =
	MutationInput<TCollection> & {
		createdAt?: Date;
		updatedAt?: Date;
	};

export type UpdateInput<TCollection extends CollectionSlug = CollectionSlug> =
	DocumentInput<TCollection> &
		MutationInput<TCollection> & {
			updatedAt?: Date;
		};

function getCollection(config: FieldstoneConfig, collectionSlug: string): CollectionRuntimeConfig {
	if (!Object.prototype.hasOwnProperty.call(config.collections, collectionSlug)) {
		throw new Error(`Unsupported collection: ${collectionSlug}`);
	}

	const collectionConfig = config.collections[collectionSlug];
	if (!collectionConfig) throw new Error(`Unsupported collection: ${collectionSlug}`);
	return collectionConfig;
}

function normalizeData(
	config: FieldstoneConfig,
	collectionSlug: string,
	data: Record<string, unknown>
) {
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

		find: async <TCollection extends CollectionSlug>({
			collection: collectionSlug
		}: CollectionInput<TCollection>) => {
			getCollection(config, collectionSlug);
			const table = compiled.tables[collectionSlug];
			return database.select().from(table).orderBy(desc(table.createdAt)) as unknown as Promise<
				CollectionDocument<TCollection>[]
			>;
		},

		findById: async <TCollection extends CollectionSlug>({
			collection: collectionSlug,
			id
		}: DocumentInput<TCollection>) => {
			getCollection(config, collectionSlug);
			const table = compiled.tables[collectionSlug];
			const [document] = await database.select().from(table).where(eq(table.id, id)).limit(1);
			return (document ?? null) as CollectionDocument<TCollection> | null;
		},

		create: async <TCollection extends CollectionSlug>({
			collection: collectionSlug,
			createdAt,
			data,
			updatedAt
		}: CreateInput<TCollection>) => {
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

			return created as CollectionDocument<TCollection>;
		},

		update: async <TCollection extends CollectionSlug>({
			collection: collectionSlug,
			data,
			id,
			updatedAt
		}: UpdateInput<TCollection>) => {
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
			return updated as CollectionDocument<TCollection>;
		},

		delete: async <TCollection extends CollectionSlug>({
			collection: collectionSlug,
			id
		}: DocumentInput<TCollection>) => {
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
