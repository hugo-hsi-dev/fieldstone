import { error } from '@sveltejs/kit';
import type { CollectionRuntimeConfig, CollectionSlug } from '@fieldstone/core';

export function requireSupportedCollection(
	getCollection: (collection: string) => CollectionRuntimeConfig | null,
	collection: string
) {
	if (!getCollection(collection)) error(404, 'Collection not found');
	return collection as CollectionSlug;
}
