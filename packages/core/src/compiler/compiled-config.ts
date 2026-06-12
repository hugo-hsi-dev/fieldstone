import type { FieldstoneConfig } from '../types.ts';
import { compileCollectionModel } from './collection-model.ts';
import type { CollectionModel } from './collection-model.ts';
import { createDrizzleSchemaSource } from './drizzle-source.ts';
import { createSchemaFingerprint } from './fingerprint.ts';
import { createRuntimeSchema, type RuntimeSchema } from './runtime-schema.ts';
import { createTypesDeclaration } from './types-output.ts';

export type FieldstoneCompiledConfig = {
	drizzleSchemaSource(): string;
	fingerprint(): string;
	runtimeSchema(): RuntimeSchema;
	typesDeclaration(): string;
};

export function compileFieldstoneConfig(config: FieldstoneConfig): FieldstoneCompiledConfig {
	const model: CollectionModel = compileCollectionModel(config);
	let runtimeSchema: RuntimeSchema | undefined;
	let drizzleSchemaSource: string | undefined;
	let typesDeclaration: string | undefined;
	let fingerprint: string | undefined;

	return {
		drizzleSchemaSource() {
			drizzleSchemaSource ??= createDrizzleSchemaSource(model);
			return drizzleSchemaSource;
		},
		fingerprint() {
			fingerprint ??= createSchemaFingerprint(model);
			return fingerprint;
		},
		runtimeSchema() {
			runtimeSchema ??= createRuntimeSchema(model);
			return runtimeSchema;
		},
		typesDeclaration() {
			typesDeclaration ??= createTypesDeclaration(model);
			return typesDeclaration;
		}
	};
}
