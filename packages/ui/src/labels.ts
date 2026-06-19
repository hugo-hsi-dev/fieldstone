import type {
	CollectionRuntimeConfig,
	DocumentDataValue,
	GlobalRuntimeConfig
} from '@fieldstone/schema';

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

export function getGlobalLabel(global: GlobalRuntimeConfig) {
	return titleCase(global.slug);
}

export function getFieldLabel(field: { name: string; label?: string }) {
	return field.label ?? titleCase(field.name);
}

export function getFieldValue(document: Record<string, unknown>, fieldName: string) {
	const value = document[fieldName];
	if (value instanceof Date) return value.toLocaleString();
	if (value && typeof value === 'object') return JSON.stringify(value);
	return String(value ?? '');
}

export function getFieldInputValue(
	document: Record<string, unknown> | null,
	fieldName: string
): DocumentDataValue | undefined {
	const value = document?.[fieldName];
	if (value === undefined) return undefined;
	// Pass through every shape (string/number/boolean/Date/null + nested objects/arrays
	// for group/array/relationship fields) so edit forms repopulate correctly.
	return value as DocumentDataValue;
}

function pad(value: number) {
	return String(value).padStart(2, '0');
}

export function toDatetimeLocalValue(value: unknown): string {
	if (value === null || value === undefined || value === '') return '';
	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) return '';
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toInputValue(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (value instanceof Date) return value.toISOString();
	return String(value);
}

export function shouldUseTextarea(field: CollectionRuntimeConfig['fields'][number]) {
	return field.type === 'text' && Boolean(field.multiline);
}

export function getSelectedCollection(
	collections: CollectionRuntimeConfig[],
	collectionName: string,
	fallback: CollectionRuntimeConfig
) {
	return collections.find((collection) => collection.slug === collectionName) ?? fallback;
}
