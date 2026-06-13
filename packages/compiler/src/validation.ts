import type { FieldstoneConfig } from '@fieldstone/schema';
export { validateCollectionFields } from '@fieldstone/schema';
import { buildSchemaPlan } from './collection-model.ts';

export function validateFieldstoneConfig(config: FieldstoneConfig) {
	buildSchemaPlan(config);
}
