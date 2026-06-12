import type { FieldstoneConfig } from '@fieldstone/core';

import { createDatabase } from './database.ts';
import { createDocumentRuntime } from './documents.ts';
import { findCollection } from './collections.ts';

export async function createFieldstoneRuntime(config: FieldstoneConfig) {
	const database = await createDatabase(config);
	const documents = createDocumentRuntime(config, database);

	return {
		collections: Object.values(config.collections),

		getCollection: (slug: string) => findCollection(config, slug),

		find: documents.find,
		findById: documents.findById,
		create: documents.create,
		update: documents.update,
		delete: documents.delete
	};
}
