import type { CollectionDefinition, FieldstoneConfigInput, TextFieldDefinition } from './types.ts';

export type {
	CollectionDefinition,
	CollectionData,
	CollectionDocument,
	CollectionRuntimeConfig,
	CollectionSlug,
	FieldstoneConfig,
	FieldstoneConfigInput,
	GeneratedCollections,
	SystemFieldName,
	TextFieldDefinition
} from './types.ts';

export {
	compileFieldstoneConfig,
	createSchemaFingerprint,
	generateDrizzleSchemaSource,
	generateTypes
} from './schema.ts';

export function text(config: Omit<TextFieldDefinition, 'type'>): TextFieldDefinition {
	return { ...config, type: 'text' };
}

export function collection(config: {
	fields: readonly TextFieldDefinition[];
}): CollectionDefinition {
	const seen = new Set<string>();
	const reserved = new Set([
		'__proto__',
		'id',
		'createdAt',
		'updatedAt',
		'created_at',
		'updated_at'
	]);
	for (const field of config.fields) {
		if (reserved.has(field.name)) throw new Error(`Reserved field name: ${field.name}`);
		const normalizedName = field.name.toLowerCase();
		if (seen.has(normalizedName)) throw new Error(`Duplicate field name: ${field.name}`);
		seen.add(normalizedName);
	}

	return { fields: [...config.fields] };
}

export function defineConfig(config: FieldstoneConfigInput): FieldstoneConfigInput {
	return config;
}
