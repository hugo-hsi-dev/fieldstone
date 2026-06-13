import type { FieldstoneConfig } from '@fieldstone/core';

import { createDatabase } from './database.ts';
import { createDocumentRuntime } from './documents.ts';

export async function createFieldstoneRuntime(config: FieldstoneConfig) {
	const database = await createDatabase(config);
	const documents = createDocumentRuntime(database);

	return {
		collections: database.collections,

		getCollection: (slug: string) => database.compiledConfig.getCollection(slug),

		find: documents.find,
		findById: documents.findById,
		create: documents.create,
		update: documents.update,
		delete: documents.delete
	};
}
