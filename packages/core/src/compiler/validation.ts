import type { FieldstoneConfig } from '../types.ts';
import { buildSchemaPlan, validateCollectionFields } from './collection-model.ts';

export { validateCollectionFields };

export function validateFieldstoneConfig(config: FieldstoneConfig) {
	buildSchemaPlan(config);
}
