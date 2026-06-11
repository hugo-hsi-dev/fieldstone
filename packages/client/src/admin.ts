import type { CollectionRuntimeConfig, CollectionSlug, FieldstoneConfig } from '@fieldstone/core';

import {
	getFieldstone,
	type CollectionInput,
	type CreateInput,
	type DocumentInput,
	type UpdateInput
} from './index.ts';

export async function createFieldstoneAdmin({ config }: { config: FieldstoneConfig }) {
	const stone = await getFieldstone({ config });

	return {
		collections: stone.collections,

		getCollection(slug: string): CollectionRuntimeConfig | null {
			return stone.getCollection(slug);
		},

		listDocuments<TCollection extends CollectionSlug>(input: CollectionInput<TCollection>) {
			return stone.find(input);
		},

		getDocument<TCollection extends CollectionSlug>(input: DocumentInput<TCollection>) {
			return stone.findById(input);
		},

		createDocument<TCollection extends CollectionSlug>(input: CreateInput<TCollection>) {
			return stone.create(input);
		},

		updateDocument<TCollection extends CollectionSlug>(input: UpdateInput<TCollection>) {
			return stone.update(input);
		},

		deleteDocument<TCollection extends CollectionSlug>(input: DocumentInput<TCollection>) {
			return stone.delete(input);
		}
	};
}
