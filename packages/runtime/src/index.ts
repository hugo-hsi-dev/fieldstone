// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./fieldstone-config.d.ts" />

import type { FieldstoneConfig } from "@fieldstone/schema";

import { createFieldstoneRuntime } from "./runtime.ts";

export type {
  CollectionInput,
  CreateInput,
  DocumentData,
  DocumentInput,
  FieldstoneCollectionSlug,
  FieldstoneDocument,
  FieldstoneDocumentData,
  MutationInput,
  UpdateInput,
} from "./types.ts";

export async function getFieldstone({ config }: { config: FieldstoneConfig }) {
  return createFieldstoneRuntime(config);
}
