import type { FieldstoneConfig } from '../types.ts';
import { compileCollectionModel, validateCollectionFields } from './collection-model.ts';

export { validateCollectionFields };

export function validateFieldstoneConfig(config: FieldstoneConfig) {
	compileCollectionModel(config);
}
