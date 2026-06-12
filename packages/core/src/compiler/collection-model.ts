import {
	normalizeCollectionData,
	type NormalizedDocumentData
} from '../document-data.ts';
import type { CollectionRuntimeConfig, FieldstoneConfig, TextFieldDefinition } from '../types.ts';
import { validateCollectionFields } from '../field-validation.ts';
import { toUniqueIdentifier } from './identifiers.ts';

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

export type CompiledColumn = Readonly<{
	columnName: string;
	drizzleType: 'text' | 'timestamp';
	fingerprint: boolean;
	identifier: string;
	name: string;
	origin: 'field' | 'system';
	required: boolean;
	runtimeKey: string;
	sourceExpression: 'text' | 'timestampNow' | 'uuidTextPrimaryKey';
	typeScriptName: string;
	typeScriptProperty: string;
	typeScriptType: 'Date' | 'string';
}>;

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
	columns: readonly CompiledColumn[];
	fields: readonly CompiledCollectionField[];
	fingerprint: CollectionFingerprint;
	slug: string;
	systemFields: typeof systemFields;
	tableIdentifier: string;
}>;

export type SchemaPlan = Readonly<{
	collectionBySlug: ReadonlyMap<string, CompiledCollection>;
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

function createSystemColumn(field: CompiledSystemField): CompiledColumn {
	const isId = field.identifier === 'id';

	return {
		columnName: field.columnName,
		drizzleType: isId ? 'text' : 'timestamp',
		fingerprint: false,
		identifier: field.identifier,
		name: field.name,
		origin: 'system',
		required: true,
		runtimeKey: field.identifier,
		sourceExpression: isId ? 'uuidTextPrimaryKey' : 'timestampNow',
		typeScriptName: field.identifier,
		typeScriptProperty: field.identifier,
		typeScriptType: isId ? 'string' : 'Date'
	};
}

function createFieldColumn(field: CompiledCollectionField): CompiledColumn {
	return {
		columnName: field.name,
		drizzleType: 'text',
		fingerprint: true,
		identifier: field.identifier,
		name: field.name,
		origin: 'field',
		required: field.required,
		runtimeKey: field.name,
		sourceExpression: 'text',
		typeScriptName: field.name,
		typeScriptProperty: JSON.stringify(field.name),
		typeScriptType: 'string'
	};
}

export function getSchemaPlanCollection(schemaPlan: SchemaPlan, slug: string) {
	return schemaPlan.collectionBySlug.get(slug) ?? null;
}

export function getCollectionConfig(
	schemaPlan: SchemaPlan,
	slug: string
): CollectionRuntimeConfig | null {
	const collection = getSchemaPlanCollection(schemaPlan, slug);
	if (!collection) return null;

	return {
		fields: collection.fields.map((field) => ({
			identifier: field.identifier,
			multiline: field.multiline,
			name: field.name,
			required: field.required,
			type: field.type
		})),
		slug: collection.slug
	};
}

export function requireSchemaPlanCollection(schemaPlan: SchemaPlan, slug: string) {
	const collection = getSchemaPlanCollection(schemaPlan, slug);
	if (!collection) throw new Error(`Unsupported collection: ${slug}`);
	return collection;
}

export function normalizeDocumentData(
	schemaPlan: SchemaPlan,
	slug: string,
	data: Record<string, unknown>
): NormalizedDocumentData {
	const collection = getCollectionConfig(schemaPlan, slug);
	if (!collection) throw new Error(`Unsupported collection: ${slug}`);
	return normalizeCollectionData(collection, data);
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
			const [idField, createdAtField, updatedAtField] = systemFields;

			return {
				columns: [
					createSystemColumn(idField),
					...fields.map(createFieldColumn),
					createSystemColumn(createdAtField),
					createSystemColumn(updatedAtField)
				],
				fields,
				fingerprint,
				slug: collection.slug,
				systemFields,
				tableIdentifier: toUniqueIdentifier(collection.slug, tableIdentifiers, 'collection_')
			};
		});

	return {
		collectionBySlug: new Map(collections.map((collection) => [collection.slug, collection])),
		collections,
		fingerprintPayload: collections.map((compiled) => compiled.fingerprint)
	};
}

export function createCollectionRuntimeConfigs(
	schemaPlan: SchemaPlan
): CollectionRuntimeConfig[] {
	return schemaPlan.collections.map((collection) => getCollectionConfig(schemaPlan, collection.slug)!);
}
