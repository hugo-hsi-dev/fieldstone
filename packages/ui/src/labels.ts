import type { CollectionRuntimeConfig } from '@fieldstone/schema';

export function titleCase(value: string) {
	return value
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
		.join(' ');
}

function singularize(slug: string) {
	return slug.endsWith('s') ? slug.slice(0, -1) : slug;
}

export function getCollectionLabel(
	collection: CollectionRuntimeConfig,
	count: 'singular' | 'plural'
) {
	return titleCase(count === 'singular' ? singularize(collection.slug) : collection.slug);
}

export function getFieldLabel(field: CollectionRuntimeConfig['fields'][number]) {
	return titleCase(field.name);
}

export function getFieldValue(document: Record<string, unknown>, fieldName: string) {
	return String(document[fieldName] ?? '');
}

export function shouldUseTextarea(field: CollectionRuntimeConfig['fields'][number]) {
	return Boolean(field.multiline);
}

export function getSelectedCollection(
	collections: CollectionRuntimeConfig[],
	collectionName: string,
	fallback: CollectionRuntimeConfig
) {
	return collections.find((collection) => collection.slug === collectionName) ?? fallback;
}
