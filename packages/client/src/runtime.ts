import type { FieldstoneConfig } from '@fieldstone/core';

import { createDatabase } from './database.ts';
import { createDocumentRuntime } from './documents.ts';

export async function createFieldstoneRuntime(config: FieldstoneConfig) {
	const database = await createDatabase(config);
	const documents = createDocumentRuntime(config, database);

	return {
		collections: database.collections,

		getCollection: (slug: string) => database.collections.find((collection) => collection.slug === slug) ?? null,

		find: documents.find,
		findById: documents.findById,
		create: documents.create,
		update: documents.update,
		delete: documents.delete
	};
}
