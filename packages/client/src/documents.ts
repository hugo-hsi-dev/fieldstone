import type { CollectionDocument, CollectionSlug, FieldstoneConfig } from '@fieldstone/core';

import { getCollection, normalizeData } from './collections.ts';
import type { createDatabase } from './database.ts';
import type { CollectionInput, CreateInput, DocumentInput, UpdateInput } from './types.ts';

type DatabaseContext = Awaited<ReturnType<typeof createDatabase>>;

export function createDocumentRuntime(config: FieldstoneConfig, context: DatabaseContext) {
	const { compiled, database, desc, eq } = context;

	function getTable(collectionSlug: string) {
		getCollection(config, collectionSlug);
		return compiled.tables[collectionSlug];
	}

	return {
		find: async <TCollection extends CollectionSlug>({
			collection: collectionSlug
		}: CollectionInput<TCollection>) => {
			const table = getTable(collectionSlug);
			return database.select().from(table).orderBy(desc(table.createdAt)) as unknown as Promise<
				CollectionDocument<TCollection>[]
			>;
		},

		findById: async <TCollection extends CollectionSlug>({
			collection: collectionSlug,
			id
		}: DocumentInput<TCollection>) => {
			const table = getTable(collectionSlug);
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
				.returning()) as unknown[];
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
				.returning()) as unknown[];
			const [updated] = updatedRows;

			if (!updated) throw new Error('Document not found');
			return updated as CollectionDocument<TCollection>;
		},

		delete: async <TCollection extends CollectionSlug>({
			collection: collectionSlug,
			id
		}: DocumentInput<TCollection>) => {
			const table = getTable(collectionSlug);
			const deletedRows = (await database
				.delete(table)
				.where(eq(table.id, id))
				.returning({ id: table.id })) as unknown[];
			const [deleted] = deletedRows;

			if (!deleted) throw new Error('Document not found');
			return deleted;
		}
	};
}
