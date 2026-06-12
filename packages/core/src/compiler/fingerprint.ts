import type { CollectionModel } from './collection-model.ts';

export function createSchemaFingerprint(model: CollectionModel) {
	return JSON.stringify(model.fingerprintPayload);
}
