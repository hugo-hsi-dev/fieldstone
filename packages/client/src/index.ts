/// <reference path="./fieldstone-config.d.ts" />

import type { FieldstoneConfig } from '@fieldstone/core';

import { createFieldstoneRuntime } from './runtime.ts';

export type {
	CollectionInput,
	CreateInput,
	DocumentData,
	DocumentInput,
	FieldstoneCollectionSlug,
	FieldstoneDocument,
	FieldstoneDocumentData,
	MutationInput,
	UpdateInput
} from './types.ts';

export async function getFieldstone({ config }: { config: FieldstoneConfig }) {
	return createFieldstoneRuntime(config);
}
