import type { SchemaPlan } from './collection-model.ts';

export function createSchemaFingerprint(schemaPlan: SchemaPlan) {
	return JSON.stringify(schemaPlan.fingerprintPayload);
}
