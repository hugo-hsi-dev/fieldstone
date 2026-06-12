import type { FieldstoneConfig, TextFieldDefinition } from '../types.ts';
import { toUniqueIdentifier } from './identifiers.ts';
import { validateFieldstoneConfig } from './validation.ts';

export type SchemaFieldPlan = TextFieldDefinition & {
	multiline: boolean;
	required: boolean;
	sourceIdentifier: string;
};

export type SchemaCollectionPlan = {
	fields: SchemaFieldPlan[];
	slug: string;
	sourceIdentifier: string;
};

export type SchemaSystemFieldPlan = {
	columnName: string;
	name: 'createdAt' | 'id' | 'updatedAt';
	type: 'timestampNow' | 'uuidTextPrimaryKey';
};

export type SchemaPlan = {
	collections: SchemaCollectionPlan[];
	systemFields: {
		createdAt: SchemaSystemFieldPlan;
		id: SchemaSystemFieldPlan;
		updatedAt: SchemaSystemFieldPlan;
	};
};

const systemFields: SchemaPlan['systemFields'] = {
	createdAt: { columnName: 'created_at', name: 'createdAt', type: 'timestampNow' },
	id: { columnName: 'id', name: 'id', type: 'uuidTextPrimaryKey' },
	updatedAt: { columnName: 'updated_at', name: 'updatedAt', type: 'timestampNow' }
};

export function createSchemaPlan(config: FieldstoneConfig): SchemaPlan {
	validateFieldstoneConfig(config);

	const collectionIdentifiers = new Set<string>();
	const collections = Object.values(config.collections).map((collection) => {
		const fieldIdentifiers = new Set<string>();
		const fields = collection.fields.map((field) => ({
			...field,
			multiline: Boolean(field.multiline),
			required: Boolean(field.required),
			sourceIdentifier: toUniqueIdentifier(field.name, fieldIdentifiers)
		}));

		return {
			fields,
			slug: collection.slug,
			sourceIdentifier: toUniqueIdentifier(collection.slug, collectionIdentifiers, 'collection_')
		};
	});

	return { collections, systemFields };
}
