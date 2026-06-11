import { error } from '@sveltejs/kit';

import { fieldstoneAdmin } from '$lib/server/admin/fieldstone-admin';

type CollectionName = string;

export async function load({ params }) {
	const collection = fieldstoneAdmin.getCollection(params.collection);
	if (!collection) error(404, 'Collection not found');

	return {
		collection,
		collectionName: params.collection as CollectionName,
		collections: fieldstoneAdmin.collections
	};
}
