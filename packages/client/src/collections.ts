import type { CollectionRuntimeConfig, FieldstoneConfig } from '@fieldstone/core';

import type { DocumentData } from './types.ts';

export function getCollection(
	config: FieldstoneConfig,
	collectionSlug: string
): CollectionRuntimeConfig {
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

export function normalizeData(
	config: FieldstoneConfig,
	collectionSlug: string,
	data: Record<string, unknown>
) {
	const collectionConfig = getCollection(config, collectionSlug);
	const allowedFields = new Set(collectionConfig.fields.map((field) => field.name));
	const normalized: DocumentData = {};

	for (const field of collectionConfig.fields) {
		const value = String(data[field.name] ?? '').trim();
		if (field.required && !value) throw new Error(`${field.name} is required`);
		normalized[field.name] = value;
	}

	for (const fieldName of Object.keys(data)) {
		if (!allowedFields.has(fieldName)) throw new Error(`Unknown field: ${fieldName}`);
	}

	return normalized;
}
