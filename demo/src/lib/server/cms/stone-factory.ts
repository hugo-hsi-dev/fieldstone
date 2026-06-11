import { desc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { getCollectionConfig, type CollectionName } from '$lib/cms/config';
import * as schema from '$lib/server/db/schema';

import { collectionTables } from './tables';

export type { CollectionName } from '$lib/cms/config';

export type DocumentData = Record<string, string>;

export type Document = {
	id: string;
	createdAt: Date;
	updatedAt: Date;
} & DocumentData;

type FindInput = {
	collection: CollectionName;
};

type FindByIdInput = FindInput & {
	id: string;
};

type CreateInput = FindInput & {
	data: DocumentData;
	createdAt?: Date;
	updatedAt?: Date;
};

type UpdateInput = CreateInput & {
	id: string;
};

type DeleteInput = FindByIdInput;

function getCollectionOrThrow(collection: string) {
	const config = getCollectionConfig(collection);
	if (!config) throw new Error(`Unsupported collection: ${collection}`);
	return config;
}

function getTable(collection: CollectionName) {
	return collectionTables[collection];
}

function normalizeData(collection: CollectionName, data: DocumentData) {
	const config = getCollectionOrThrow(collection);
	const allowedFields = new Set(config.fields.map((field) => field.name));
	const normalized: DocumentData = {};

	for (const field of config.fields) {
		const value = String(data[field.name] ?? '').trim();
		if (field.required && !value) throw new Error(`${field.label ?? field.name} is required`);
		normalized[field.name] = value;
	}

	for (const fieldName of Object.keys(data)) {
		if (!allowedFields.has(fieldName)) throw new Error(`Unknown field: ${fieldName}`);
	}

	return normalized;
}

export function createStone(database: BetterSQLite3Database<typeof schema>) {
	return {
		find: async ({ collection }: FindInput) => {
			getCollectionOrThrow(collection);
			const table = getTable(collection);

			return database.select().from(table).orderBy(desc(table.createdAt));
		},

		findById: async ({ collection, id }: FindByIdInput) => {
			getCollectionOrThrow(collection);
			const table = getTable(collection);

			const [document] = await database.select().from(table).where(eq(table.id, id)).limit(1);
			return document ?? null;
		},

		create: async ({ collection, data, createdAt, updatedAt }: CreateInput) => {
			const document = normalizeData(collection, data);
			const table = getTable(collection);
			const now = new Date();
			const [created] = await database
				.insert(table)
				.values({
					...document,
					createdAt: createdAt ?? now,
					updatedAt: updatedAt ?? now
				})
				.returning();

			return created;
		},

		update: async ({ collection, id, data, updatedAt }: UpdateInput) => {
			const document = normalizeData(collection, data);
			const table = getTable(collection);
			const [updated] = await database
				.update(table)
				.set({
					...document,
					updatedAt: updatedAt ?? new Date()
				})
				.where(eq(table.id, id))
				.returning();

			if (!updated) throw new Error('Document not found');
			return updated;
		},

		delete: async ({ collection, id }: DeleteInput) => {
			getCollectionOrThrow(collection);
			const table = getTable(collection);
			const [deleted] = await database
				.delete(table)
				.where(eq(table.id, id))
				.returning({ id: table.id });

			if (!deleted) throw new Error('Document not found');
			return deleted;
		}
	};
}
