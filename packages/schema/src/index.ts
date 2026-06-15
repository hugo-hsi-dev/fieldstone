import { validateCollectionFields } from "./field-validation.ts";
import type {
  BooleanFieldDefinition,
  CollectionDefinition,
  FieldDefinition,
  FieldstoneConfigInput,
  GlobalDefinition,
  TextFieldDefinition,
} from "./types.ts";

export { validateCollectionFields } from "./field-validation.ts";
export {
  normalizeBooleanFieldValue,
  normalizeCollectionData,
  normalizeTextFieldValue,
  type DocumentDataValue,
  type NormalizedDocumentData,
} from "./document-data.ts";
export type {
  CollectionConfig,
  CollectionDefinition,
  CollectionData,
  CollectionDocument,
  CollectionRuntimeField,
  CollectionRuntimeConfig,
  CollectionSlug,
  FieldstoneConfig,
  GlobalConfig,
  GlobalData,
  GlobalDefinition,
  GlobalDocument,
  GlobalRuntimeConfig,
  GlobalRuntimeField,
  GlobalSlug,
  BooleanFieldDefinition,
  FieldDefinition,
  FieldstoneConfigInput,
  GeneratedCollections,
  GeneratedGlobals,
  SystemFieldName,
  TextFieldDefinition,
} from "./types.ts";

export function text(
  config: Omit<TextFieldDefinition, "type">,
): TextFieldDefinition {
  return { ...config, type: "text" };
}

export function boolean(
  config: Omit<BooleanFieldDefinition, "type">,
): BooleanFieldDefinition {
  return { ...config, type: "boolean" };
}

export function collection(config: {
  fields: readonly FieldDefinition[];
}): CollectionDefinition {
  validateCollectionFields(config.fields);

  return { fields: [...config.fields] };
}

export function global(config: {
  fields: readonly FieldDefinition[];
}): GlobalDefinition {
  validateCollectionFields(config.fields);

  return { fields: [...config.fields] };
}

export function defineConfig(
  config: FieldstoneConfigInput,
): FieldstoneConfigInput {
  return config;
}
