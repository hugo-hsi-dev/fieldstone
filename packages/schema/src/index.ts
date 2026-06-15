import { validateCollectionFields } from "./field-validation.ts";
import type {
  CollectionDefinition,
  FieldstoneConfigInput,
  GlobalDefinition,
  TextFieldDefinition,
} from "./types.ts";

export { validateCollectionFields } from "./field-validation.ts";
export {
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

export function collection(config: {
  fields: readonly TextFieldDefinition[];
}): CollectionDefinition {
  validateCollectionFields(config.fields);

  return { fields: [...config.fields] };
}

export function global(config: {
  fields: readonly TextFieldDefinition[];
}): GlobalDefinition {
  validateCollectionFields(config.fields);

  return { fields: [...config.fields] };
}

export function defineConfig(
  config: FieldstoneConfigInput,
): FieldstoneConfigInput {
  return config;
}
