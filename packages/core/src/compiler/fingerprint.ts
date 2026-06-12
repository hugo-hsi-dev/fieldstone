import type { SchemaPlan } from './schema-plan.ts';

export function createSchemaFingerprint(plan: SchemaPlan) {
	return JSON.stringify(
		plan.collections
			.map((collection) => ({
				fields: collection.fields.map((field) => ({
					name: field.name,
					multiline: field.multiline,
					required: field.required,
					type: field.type
				})),
				slug: collection.slug
			}))
			.sort((a, b) => a.slug.localeCompare(b.slug))
	);
}
