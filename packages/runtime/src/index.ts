// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./fieldstone-config.d.ts" />

import type { FieldstoneConfig } from "@hugo-hsi-dev/schema";

import { createFieldstoneRuntime } from "./runtime.ts";

export type {
  CollectionInput,
  CreateInput,
  DocumentData,
  DocumentInput,
  FieldstoneCollectionSlug,
  FieldstoneDocument,
  FieldstoneDocumentData,
  FieldstoneGlobal,
  FieldstoneGlobalData,
  FieldstoneGlobalSlug,
  GlobalInput,
  ListInput,
  ListResult,
  ListSort,
  MutationInput,
  UpdateGlobalInput,
  UpdateInput,
  WhereClause,
  WhereOperators,
} from "./types.ts";

export { ForbiddenError, isForbiddenError } from "./access.ts";

export async function getFieldstone({ config }: { config: FieldstoneConfig }) {
  return createFieldstoneRuntime(config);
}
