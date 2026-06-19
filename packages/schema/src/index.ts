import { validateCollectionFields } from "./field-validation.ts";
import { normalizeSelectOptions } from "./field-validation.ts";
import type {
  ArrayFieldDefinition,
  BooleanFieldDefinition,
  CollectionAccess,
  CollectionDefinition,
  CollectionHooks,
  DateFieldDefinition,
  EmailFieldDefinition,
  FieldDefinition,
  FieldstoneConfigInput,
  GlobalDefinition,
  GroupFieldDefinition,
  NumberFieldDefinition,
  RelationshipFieldDefinition,
  RichTextFieldDefinition,
  SelectFieldDefinition,
  SelectOptionInput,
  TextFieldDefinition,
} from "./types.ts";

export { validateCollectionFields, normalizeSelectOptions } from "./field-validation.ts";
export { STATUS_FIELD_NAME } from "./types.ts";
export {
  normalizeBooleanFieldValue,
  normalizeCollectionData,
  normalizeFieldValue,
  normalizeTextFieldValue,
  normalizeNumberFieldValue,
  normalizeDateFieldValue,
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
  GeneratedGlobals,
  GroupFieldDefinition,
  NumberFieldDefinition,
  RelationshipFieldDefinition,
  RichTextFieldDefinition,
  RuntimeField,
  SelectFieldDefinition,
  SelectOption,
  SelectOptionInput,
  SystemFieldName,
  TextFieldDefinition,
} from "./types.ts";

export function text(
  config: Omit<TextFieldDefinition, "type">,
): TextFieldDefinition {
  return { ...config, type: "text" };
}

export function email(
  config: Omit<EmailFieldDefinition, "type">,
): EmailFieldDefinition {
  return { ...config, type: "email" };
}

export function number(
  config: Omit<NumberFieldDefinition, "type">,
): NumberFieldDefinition {
  return { ...config, type: "number" };
}

export function date(
  config: Omit<DateFieldDefinition, "type">,
): DateFieldDefinition {
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

export function boolean(
  config: Omit<BooleanFieldDefinition, "type">,
): BooleanFieldDefinition {
  return { ...config, type: "boolean" };
}

export function relationship(
  config: Omit<RelationshipFieldDefinition, "type">,
): RelationshipFieldDefinition {
  return { ...config, type: "relationship" };
}

export function richText(
  config: Omit<RichTextFieldDefinition, "type">,
): RichTextFieldDefinition {
  return { ...config, type: "richText" };
}

export function group(
  config: Omit<GroupFieldDefinition, "type">,
): GroupFieldDefinition {
  return { ...config, fields: [...config.fields], type: "group" };
}

export function array(
  config: Omit<ArrayFieldDefinition, "type">,
): ArrayFieldDefinition {
  return { ...config, fields: [...config.fields], type: "array" };
}

export function collection(config: {
  fields: readonly FieldDefinition[];
  hooks?: CollectionHooks;
  access?: CollectionAccess;
  drafts?: boolean;
}): CollectionDefinition {
  validateCollectionFields(config.fields);

  return {
    fields: [...config.fields],
    ...(config.hooks ? { hooks: config.hooks } : {}),
    ...(config.access ? { access: config.access } : {}),
    ...(config.drafts ? { drafts: true } : {}),
  };
}

export function global(config: {
  fields: readonly FieldDefinition[];
  hooks?: CollectionHooks;
  drafts?: boolean;
}): GlobalDefinition {
  validateCollectionFields(config.fields);

  return {
    fields: [...config.fields],
    ...(config.hooks ? { hooks: config.hooks } : {}),
    ...(config.drafts ? { drafts: true } : {}),
  };
}

export function defineConfig(
  config: FieldstoneConfigInput,
): FieldstoneConfigInput {
  return config;
}
