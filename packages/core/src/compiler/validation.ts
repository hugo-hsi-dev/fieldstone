import type { FieldstoneConfig } from '../types.ts';
export { validateCollectionFields } from '../field-validation.ts';
import { buildSchemaPlan } from './collection-model.ts';

export function validateFieldstoneConfig(config: FieldstoneConfig) {
	buildSchemaPlan(config);
}
