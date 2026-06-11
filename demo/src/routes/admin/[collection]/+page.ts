import { error } from '@sveltejs/kit';

import { getCollectionConfig, type CollectionName } from '$lib/cms/config';

export function load({ params }) {
	const collection = getCollectionConfig(params.collection);
	if (!collection) error(404, 'Collection not found');

	return { collection, collectionName: params.collection as CollectionName };
}
