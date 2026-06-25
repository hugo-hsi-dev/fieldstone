import { validateCollectionFields } from "./field-validation.js";
import { normalizeSelectOptions } from "./field-validation.js";

import type {
  ArrayFieldDefinition,
  BooleanFieldDefinition,
  CollectionAccess,
  CollectionDefinition,
  CollectionHooks,
  DateFieldDefinition,
  EmailFieldDefinition,
  FieldDefinition,
  GlobalDefinition,
  GroupFieldDefinition,
  NumberFieldDefinition,
  RelationshipFieldDefinition,
  RichTextFieldDefinition,
  SelectFieldDefinition,
  SelectOptionInput,
  TextFieldDefinition,
  UploadFieldDefinition,
  UploadOptions,
} from "./types.js";

export { validateCollectionFields, normalizeSelectOptions } from "./field-validation.js";
export { STATUS_FIELD_NAME, UPLOAD_FIELD_NAMES } from "./types.js";
export {
  normalizeBooleanFieldValue,
  normalizeCollectionData,
  normalizeFieldValue,
  normalizeTextFieldValue,
  normalizeNumberFieldValue,
  normalizeDateFieldValue,
  type DocumentDataValue,
  type NormalizedDocumentData,
} from "./document-data.js";
export type {
  CollectionConfig,
  CollectionDefinition,
  CollectionData,
  CollectionDocument,
  CollectionRuntimeField,
  CollectionRuntimeConfig,
  CollectionSlug,
  CollectionWhere,
  FieldstoneConfig,
  GlobalConfig,
  GlobalData,
  GlobalDefinition,
  GlobalDocument,
  GlobalRuntimeConfig,
  GlobalRuntimeField,
  GlobalSlug,
  AccessArgs,
  AccessFn,
  AccessOperation,
  AccessUser,
  ArrayFieldDefinition,
  BooleanFieldDefinition,
  CollectionAccess,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionAfterReadHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionHooks,
  DateFieldDefinition,
  DocumentStatus,
  EmailFieldDefinition,
  FieldAdminOptions,
  FieldDefinition,
  FieldType,
  HookOperation,
  FieldstoneConfigInput,
  GeneratedCollections,
  GeneratedCollectionRelations,
  GeneratedGlobals,
  GroupFieldDefinition,
  NumberFieldDefinition,
  PopulatedDocument,
  RelationshipFieldDefinition,
  RichTextFieldDefinition,
  RuntimeField,
  SelectFieldDefinition,
  SelectOption,
  SelectOptionInput,
  StorageConfig,
  SystemFieldName,
  TextFieldDefinition,
  UploadFieldDefinition,
  UploadImageSize,
  UploadOptions,
} from "./types.js";

export function text(config: Omit<TextFieldDefinition, "type">): TextFieldDefinition {
  return { ...config, type: "text" };
}

export function email(config: Omit<EmailFieldDefinition, "type">): EmailFieldDefinition {
  return { ...config, type: "email" };
}

export function number(config: Omit<NumberFieldDefinition, "type">): NumberFieldDefinition {
  return { ...config, type: "number" };
}

export function date(config: Omit<DateFieldDefinition, "type">): DateFieldDefinition {
  return { ...config, type: "date" };
}

export function select(
  config: Omit<SelectFieldDefinition, "type" | "options"> & {
    options: readonly SelectOptionInput[];
  },
): SelectFieldDefinition {
  return {
    ...config,
    options: normalizeSelectOptions(config.options),
    type: "select",
  };
}

export function boolean(config: Omit<BooleanFieldDefinition, "type">): BooleanFieldDefinition {
  return { ...config, type: "boolean" };
}

export function relationship(
  config: Omit<RelationshipFieldDefinition, "type">,
): RelationshipFieldDefinition {
  return { ...config, type: "relationship" };
}

export function upload(config: Omit<UploadFieldDefinition, "type">): UploadFieldDefinition {
  return { ...config, type: "upload" };
}

export function richText(config: Omit<RichTextFieldDefinition, "type">): RichTextFieldDefinition {
  return { ...config, type: "richText" };
}

export function group(config: Omit<GroupFieldDefinition, "type">): GroupFieldDefinition {
  return { ...config, fields: [...config.fields], type: "group" };
}

export function array(config: Omit<ArrayFieldDefinition, "type">): ArrayFieldDefinition {
  return { ...config, fields: [...config.fields], type: "array" };
}

export function collection(config: {
  fields: readonly FieldDefinition[];
  hooks?: CollectionHooks;
  access?: CollectionAccess;
  drafts?: boolean;
  upload?: UploadOptions;
}): CollectionDefinition {
  validateCollectionFields(config.fields);

  return {
    fields: [...config.fields],
    ...(config.hooks ? { hooks: config.hooks } : {}),
    ...(config.access ? { access: config.access } : {}),
    ...(config.drafts ? { drafts: true } : {}),
    ...(config.upload ? { upload: config.upload } : {}),
  };
}

export function global(config: {
  fields: readonly FieldDefinition[];
  drafts?: boolean;
}): GlobalDefinition {
  validateCollectionFields(config.fields);

  return {
    fields: [...config.fields],
    ...(config.drafts ? { drafts: true } : {}),
  };
}
