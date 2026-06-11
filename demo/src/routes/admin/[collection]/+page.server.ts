import { error } from '@sveltejs/kit';

import { stone, type CollectionName } from '$lib/server/cms/stone';

export async function load({ params }) {
	const collection = stone.getCollection(params.collection);
	if (!collection) error(404, 'Collection not found');

	return {
		collection,
		collectionName: params.collection as CollectionName,
		collections: stone.collections
	};
}
