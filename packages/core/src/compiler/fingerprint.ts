import type { FieldstoneConfig } from '../types.ts';
import { compileCollectionModel } from './collection-model.ts';

export function createSchemaFingerprint(config: FieldstoneConfig) {
	return JSON.stringify(compileCollectionModel(config).fingerprintPayload);
}
