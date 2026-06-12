import type { FieldstoneConfig } from '../types.ts';
import { createDrizzleSchemaSource } from './drizzle-source.ts';
import { createSchemaFingerprint } from './fingerprint.ts';
import { createRuntimeSchema, type RuntimeSchema } from './runtime-schema.ts';
import { createSchemaPlan } from './schema-plan.ts';
import { createTypesDeclaration } from './types-output.ts';

export type FieldstoneCompiledConfig = {
	drizzleSchemaSource(): string;
	fingerprint(): string;
	runtimeSchema(): RuntimeSchema;
	typesDeclaration(): string;
};

export function compileFieldstoneConfig(config: FieldstoneConfig): FieldstoneCompiledConfig {
	const plan = createSchemaPlan(config);
	let runtimeSchema: RuntimeSchema | undefined;
	let drizzleSchemaSource: string | undefined;
	let typesDeclaration: string | undefined;
	let fingerprint: string | undefined;

	return {
		drizzleSchemaSource() {
			drizzleSchemaSource ??= createDrizzleSchemaSource(plan);
			return drizzleSchemaSource;
		},
		fingerprint() {
			fingerprint ??= createSchemaFingerprint(plan);
			return fingerprint;
		},
		runtimeSchema() {
			runtimeSchema ??= createRuntimeSchema(plan);
			return runtimeSchema;
		},
		typesDeclaration() {
			typesDeclaration ??= createTypesDeclaration(plan);
			return typesDeclaration;
		}
	};
}
