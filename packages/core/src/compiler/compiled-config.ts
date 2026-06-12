import type { CollectionRuntimeConfig, FieldstoneConfig } from '../types.ts';
import { buildSchemaPlan } from './collection-model.ts';
import type { SchemaPlan } from './collection-model.ts';
import { createCollectionRuntimeConfigs } from './collection-model.ts';
import { createDrizzleSchemaSource } from './drizzle-source.ts';
import { createSchemaFingerprint } from './fingerprint.ts';
import { createRuntimeSchema, type RuntimeSchema } from './runtime-schema.ts';
import { createTypesDeclaration } from './types-output.ts';

export type FieldstoneCompiledConfig = {
	createCollectionRuntimeConfigs(): CollectionRuntimeConfig[];
	readonly schemaPlan: SchemaPlan;
	renderRuntimeSchema(): RuntimeSchema;
	renderSchemaSource(): string;
	renderTypesDeclaration(): string;
	schemaFingerprint(): string;
};

export function compileFieldstoneConfig(config: FieldstoneConfig): FieldstoneCompiledConfig {
	const schemaPlan = buildSchemaPlan(config);
	let runtimeSchema: RuntimeSchema | undefined;
	let drizzleSchemaSource: string | undefined;
	let typesDeclaration: string | undefined;
	let fingerprint: string | undefined;

	return {
		createCollectionRuntimeConfigs: () => createCollectionRuntimeConfigs(schemaPlan),
		schemaPlan,
		renderRuntimeSchema() {
			runtimeSchema ??= createRuntimeSchema(schemaPlan);
			return runtimeSchema;
		},
		renderSchemaSource() {
			drizzleSchemaSource ??= createDrizzleSchemaSource(schemaPlan);
			return drizzleSchemaSource;
		},
		renderTypesDeclaration() {
			typesDeclaration ??= createTypesDeclaration(schemaPlan);
			return typesDeclaration;
		},
		schemaFingerprint() {
			fingerprint ??= createSchemaFingerprint(schemaPlan);
			return fingerprint;
		}
	};
}
