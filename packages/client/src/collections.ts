import type { CollectionConfig, FieldstoneConfig } from '@fieldstone/core';

export function getCollection(
	config: FieldstoneConfig,
	collectionSlug: string
): CollectionConfig {
	if (!Object.prototype.hasOwnProperty.call(config.collections, collectionSlug)) {
		throw new Error(`Unsupported collection: ${collectionSlug}`);
	}

	const collectionConfig = config.collections[collectionSlug];
	if (!collectionConfig) throw new Error(`Unsupported collection: ${collectionSlug}`);
	return collectionConfig;
}

export function findCollection(config: FieldstoneConfig, slug: string) {
	return Object.prototype.hasOwnProperty.call(config.collections, slug)
		? (config.collections[slug] ?? null)
		: null;
}
