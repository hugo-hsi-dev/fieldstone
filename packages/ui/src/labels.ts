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
	let date: Date;
	if (value instanceof Date) {
		date = value;
	} else {
		let raw = String(value).trim();
		// A timezone-less datetime-local string is stored as UTC by the server
		// (normalizeDateFieldValue appends Z), so parse it as UTC here too — otherwise
		// a non-UTC browser would render a date default shifted by its offset.
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw)) raw += 'Z';
		date = new Date(raw);
	}
	if (Number.isNaN(date.getTime())) return '';
	// Render the UTC wall-clock time. The datetime-local control carries no offset,
	// so the server parses the submitted value as UTC too (see normalizeDateFieldValue);
	// using UTC on both sides keeps the stored instant stable and avoids an SSR/client
	// hydration mismatch from differing local timezones.
	const base = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
	const seconds = date.getUTCSeconds();
	const ms = date.getUTCMilliseconds();
	// Include seconds/fraction so an unchanged edit round-trips without truncating
	// a stored value like 12:34:56.789 back to 12:34:00.000.
	if (ms) return `${base}:${pad(seconds)}.${String(ms).padStart(3, '0')}`;
	if (seconds) return `${base}:${pad(seconds)}`;
	return base;
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
