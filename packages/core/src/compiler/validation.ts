import type { FieldstoneConfig } from '../types.ts';

const reservedFieldNames = new Set([
	'__proto__',
	'id',
	'createdAt',
	'updatedAt',
	'created_at',
	'updated_at'
]);

function validateCollectionSlugs(config: FieldstoneConfig) {
	const seen = new Set<string>();

	for (const collection of Object.values(config.collections)) {
		if (collection.slug === '__proto__') {
			throw new Error('Reserved collection slug: __proto__');
		}

		const normalizedSlug = collection.slug.toLowerCase();
		if (seen.has(normalizedSlug)) throw new Error(`Duplicate collection slug: ${collection.slug}`);
		seen.add(normalizedSlug);
	}
}

export function validateCollectionFields(
	collectionFields: readonly FieldstoneConfig['collections'][string]['fields'][number][]
) {
	const seen = new Set<string>();

	for (const field of collectionFields) {
		if (reservedFieldNames.has(field.name)) throw new Error(`Reserved field name: ${field.name}`);
		const normalizedName = field.name.toLowerCase();
		if (seen.has(normalizedName)) throw new Error(`Duplicate field name: ${field.name}`);
		seen.add(normalizedName);
	}
}

export function validateFieldstoneConfig(config: FieldstoneConfig) {
	validateCollectionSlugs(config);
	for (const collection of Object.values(config.collections)) {
		validateCollectionFields(collection.fields);
	}
}
