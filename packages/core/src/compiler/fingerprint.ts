import type { FieldstoneConfig } from '../types.ts';
import { validateFieldstoneConfig } from './validation.ts';

export function createSchemaFingerprint(config: FieldstoneConfig) {
	validateFieldstoneConfig(config);

	return JSON.stringify(
		Object.values(config.collections)
			.map((collection) => ({
				fields: collection.fields.map((field) => ({
					name: field.name,
					multiline: Boolean(field.multiline),
					required: Boolean(field.required),
					type: field.type
				})),
				slug: collection.slug
			}))
			.sort((a, b) => a.slug.localeCompare(b.slug))
	);
}
