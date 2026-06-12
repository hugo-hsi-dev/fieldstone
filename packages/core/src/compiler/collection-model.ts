import type { FieldstoneConfig, TextFieldDefinition } from '../types.ts';
import { toUniqueIdentifier } from './identifiers.ts';

const reservedFieldNames = new Set([
	'__proto__',
	'id',
	'createdAt',
	'updatedAt',
	'created_at',
	'updated_at'
]);

export type CompiledCollectionField = Readonly<
	TextFieldDefinition & {
		identifier: string;
		required: boolean;
	}
>;

export const systemFields = [
	{ columnName: 'id', identifier: 'id', name: 'id' },
	{ columnName: 'created_at', identifier: 'createdAt', name: 'createdAt' },
	{ columnName: 'updated_at', identifier: 'updatedAt', name: 'updatedAt' }
] as const;

export type CompiledSystemField = (typeof systemFields)[number];

export type CollectionFingerprint = Readonly<{
	fields: readonly Readonly<{
		multiline: boolean;
		name: string;
		required: boolean;
		type: TextFieldDefinition['type'];
	}>[];
	slug: string;
}>;

export type CompiledCollection = Readonly<{
	fields: readonly CompiledCollectionField[];
	fingerprint: CollectionFingerprint;
	slug: string;
	systemFields: typeof systemFields;
	tableIdentifier: string;
}>;

export type SchemaPlan = Readonly<{
	collections: readonly CompiledCollection[];
	fingerprintPayload: readonly CollectionFingerprint[];
}>;

function compareSlugs(left: string, right: string) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

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

export function buildSchemaPlan(config: FieldstoneConfig): SchemaPlan {
	validateCollectionSlugs(config);

	const tableIdentifiers = new Set<string>();
	const collections = Object.values(config.collections)
		.sort((a, b) => compareSlugs(a.slug, b.slug))
		.map((collection) => {
			validateCollectionFields(collection.fields);
			const fieldIdentifiers = new Set<string>();
			const fields = collection.fields.map((field) => ({
				...field,
				identifier: toUniqueIdentifier(field.name, fieldIdentifiers),
				required: Boolean(field.required)
			}));
			const fingerprint = {
				fields: fields.map((field) => ({
					name: field.name,
					multiline: Boolean(field.multiline),
					required: field.required,
					type: field.type
				})),
				slug: collection.slug
			};

			return {
				fields,
				fingerprint,
				slug: collection.slug,
				systemFields,
				tableIdentifier: toUniqueIdentifier(collection.slug, tableIdentifiers, 'collection_')
			};
		});

	return {
		collections,
		fingerprintPayload: collections.map((compiled) => compiled.fingerprint)
	};
}
