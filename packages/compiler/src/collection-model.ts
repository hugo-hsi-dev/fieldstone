import {
  normalizeCollectionData,
  type NormalizedDocumentData,
} from "@fieldstone/schema";
import type {
  CollectionRuntimeConfig,
  FieldDefinition,
  FieldstoneConfig,
  GlobalRuntimeConfig,
} from "@fieldstone/schema";
import {
  normalizeSelectOptions,
  STATUS_FIELD_NAME,
  validateCollectionFields,
} from "@fieldstone/schema";
import { toUniqueIdentifier } from "./identifiers.ts";

export type CompiledCollectionField = Readonly<
  FieldDefinition & {
    identifier: string;
    required: boolean;
  }
>;

export const systemFields = [
  { columnName: "id", identifier: "id", name: "id" },
  { columnName: "created_at", identifier: "createdAt", name: "createdAt" },
  { columnName: "updated_at", identifier: "updatedAt", name: "updatedAt" },
] as const;

export type CompiledSystemField = (typeof systemFields)[number];

export type CompiledColumn = Readonly<{
  columnName: string;
  drizzleType: "boolean" | "number" | "text" | "timestamp";
  fingerprint: boolean;
  identifier: string;
  name: string;
  // The value is optional on create/update even when the stored column is
  // non-null — i.e. the runtime fills it in (a defaulted field) or it defaults to
  // an empty collection (an optional array). Generated mutation input marks these
  // optional so callers needn't pass them.
  optionalInput: boolean;
  origin: "field" | "system";
  required: boolean;
  runtimeKey: string;
  sourceExpression:
    | "boolean"
    | "number"
    | "text"
    | "json"
    | "dateValue"
    | "timestampNow"
    | "uuidTextPrimaryKey";
  typeScriptName: string;
  typeScriptProperty: string;
  typeScriptType: string;
  unique: boolean;
}>;

export type CollectionFingerprint = Readonly<{
  fields: readonly Readonly<{
    multiline?: boolean;
    name: string;
    relationTo?: string;
    hasMany?: boolean;
    required: boolean;
    type: FieldDefinition["type"];
    unique: boolean;
  }>[];
  slug: string;
}>;

export type CompiledCollection = Readonly<{
  columns: readonly CompiledColumn[];
  fields: readonly CompiledCollectionField[];
  fingerprint: CollectionFingerprint;
  kind: "collection";
  slug: string;
  systemFields: typeof systemFields;
  tableIdentifier: string;
}>;

export type CompiledGlobal = Readonly<{
  columns: readonly CompiledColumn[];
  fields: readonly CompiledCollectionField[];
  fingerprint: CollectionFingerprint;
  kind: "global";
  slug: string;
  systemFields: typeof systemFields;
  tableIdentifier: string;
}>;

export type CompiledContent = CompiledCollection | CompiledGlobal;

export type SchemaPlan = Readonly<{
  collectionBySlug: ReadonlyMap<string, CompiledCollection>;
  collections: readonly CompiledCollection[];
  globalBySlug: ReadonlyMap<string, CompiledGlobal>;
  globals: readonly CompiledGlobal[];
  fingerprintPayload: Readonly<{
    collections: readonly CollectionFingerprint[];
    globals: readonly CollectionFingerprint[];
  }>;
}>;

function compareSlugs(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function validateContentSlugs(config: FieldstoneConfig) {
  const seen = new Set<string>();

  for (const collection of Object.values(config.collections)) {
    // `globals` is reserved for the REST global-singleton route (/api/globals/…);
    // a collection with this slug would be shadowed by it and become unreachable.
    if (collection.slug.toLowerCase() === "globals") {
      throw new Error('Reserved collection slug: "globals"');
    }
  }

  for (const content of [
    ...Object.values(config.collections),
    ...Object.values(config.globals ?? {}),
  ]) {
    if (content.slug === "__proto__") {
      throw new Error("Reserved content slug: __proto__");
    }

    const normalizedSlug = content.slug.toLowerCase();
    if (seen.has(normalizedSlug))
      throw new Error(`Duplicate content slug: ${content.slug}`);
    seen.add(normalizedSlug);
  }
}

function createSystemColumn(field: CompiledSystemField): CompiledColumn {
  const isId = field.identifier === "id";

  return {
    columnName: field.columnName,
    drizzleType: isId ? "text" : "timestamp",
    fingerprint: false,
    identifier: field.identifier,
    name: field.name,
    optionalInput: false,
    origin: "system",
    required: true,
    runtimeKey: field.identifier,
    sourceExpression: isId ? "uuidTextPrimaryKey" : "timestampNow",
    typeScriptName: field.identifier,
    typeScriptProperty: field.identifier,
    typeScriptType: isId ? "string" : "Date",
    unique: false,
  };
}

function selectUnionType(field: Extract<FieldDefinition, { type: "select" }>) {
  const values = normalizeSelectOptions(field.options ?? []).map((option) =>
    JSON.stringify(option.value),
  );
  return values.length > 0 ? values.join(" | ") : "string";
}

// Only used for nested (group/array) subfields, which are persisted inside a
// JSON text column. A nested `date` is serialized to an ISO string and reads
// back as a string, so its generated type must be `string`, not `Date`.
function fieldTypeScript(field: FieldDefinition): string {
  switch (field.type) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "date":
      return "string";
    case "select":
      return selectUnionType(field);
    case "relationship":
      return field.hasMany ? "string[]" : "string";
    case "group":
      return objectTypeScript(field.fields);
    case "array":
      return `${objectTypeScript(field.fields)}[]`;
    default:
      return "string";
  }
}

function fieldNullable(field: FieldDefinition): boolean {
  if (
    field.type === "boolean" ||
    field.type === "group" ||
    field.type === "array"
  )
    return false;
  return !field.required;
}

function objectTypeScript(fields: FieldDefinition[]): string {
  if (fields.length === 0) return "Record<string, never>";
  const entries = fields
    .map(
      (field) =>
        `${JSON.stringify(field.name)}: ${fieldTypeScript(field)}${fieldNullable(field) ? " | null" : ""}`,
    )
    .join("; ");
  return `{ ${entries} }`;
}

function fieldUnique(field: CompiledCollectionField): boolean {
  return "unique" in field ? Boolean(field.unique) : false;
}

function hasDefaultValue(field: CompiledCollectionField): boolean {
  return "defaultValue" in field && field.defaultValue !== undefined;
}

function createFieldColumn(field: CompiledCollectionField): CompiledColumn {
  const base = {
    columnName: field.name,
    fingerprint: true,
    identifier: field.identifier,
    name: field.name,
    // A defaulted field (runtime fills the default) or an optional array (defaults
    // to []) is optional on input even though the stored value is non-null.
    optionalInput:
      hasDefaultValue(field) || (field.type === "array" && !field.required),
    origin: "field",
    required: field.required,
    runtimeKey: field.name,
    typeScriptName: field.name,
    typeScriptProperty: JSON.stringify(field.name),
    unique: fieldUnique(field),
  } as const;

  switch (field.type) {
    case "boolean":
      return {
        ...base,
        drizzleType: "boolean",
        sourceExpression: "boolean",
        typeScriptType: "boolean",
      };
    case "number":
      return {
        ...base,
        drizzleType: "number",
        sourceExpression: "number",
        typeScriptType: "number",
      };
    case "date":
      return {
        ...base,
        drizzleType: "timestamp",
        sourceExpression: "dateValue",
        typeScriptType: "Date",
      };
    case "select":
      return {
        ...base,
        drizzleType: "text",
        sourceExpression: "text",
        typeScriptType: selectUnionType(field),
      };
    case "relationship":
      return field.hasMany
        ? {
            ...base,
            drizzleType: "text",
            sourceExpression: "json",
            typeScriptType: "string[]",
          }
        : {
            ...base,
            drizzleType: "text",
            sourceExpression: "text",
            typeScriptType: "string",
          };
    case "group":
      return {
        ...base,
        drizzleType: "text",
        sourceExpression: "json",
        typeScriptType: objectTypeScript(field.fields),
      };
    case "array":
      return {
        ...base,
        drizzleType: "text",
        sourceExpression: "json",
        typeScriptType: `${objectTypeScript(field.fields)}[]`,
      };
    default:
      return {
        ...base,
        drizzleType: "text",
        sourceExpression: "text",
        typeScriptType: "string",
      };
  }
}

function withDraftStatusField(content: {
  fields: FieldDefinition[];
  drafts?: boolean;
}): FieldDefinition[] {
  if (!content.drafts) return content.fields;
  // Reserve _status on draft collections: a user field of that name would suppress
  // the injected draft/published select and break status defaulting and filtering.
  if (content.fields.some((field) => field.name === STATUS_FIELD_NAME))
    throw new Error(
      `Reserved field name on a draft-enabled collection: ${STATUS_FIELD_NAME}`,
    );
  const statusField: FieldDefinition = {
    name: STATUS_FIELD_NAME,
    type: "select",
    options: normalizeSelectOptions(["draft", "published"]),
    defaultValue: "draft",
    required: true,
  };
  return [...content.fields, statusField];
}

function compileContent(
  content: { fields: FieldDefinition[]; slug: string; drafts?: boolean },
  kind: "collection" | "global",
  tableIdentifiers: Set<string>,
): CompiledContent {
  const sourceFields = withDraftStatusField(content);
  validateCollectionFields(sourceFields);
  const fieldIdentifiers = new Set<string>();
  const fields = sourceFields.map((field) => ({
    ...field,
    ...(field.type === "select"
      ? { options: normalizeSelectOptions(field.options ?? []) }
      : {}),
    identifier: toUniqueIdentifier(field.name, fieldIdentifiers),
    required:
      field.type === "boolean"
        ? true
        : "required" in field
          ? Boolean(field.required)
          : false,
  }));
  const fingerprint = {
    fields: fields.map((field) => ({
      name: field.name,
      ...(field.type === "text" ? { multiline: Boolean(field.multiline) } : {}),
      ...(field.type === "relationship"
        ? { relationTo: field.relationTo, hasMany: Boolean(field.hasMany) }
        : {}),
      required: field.required,
      type: field.type,
      unique: "unique" in field ? Boolean(field.unique) : false,
    })),
    slug: content.slug,
  };
  const [idField, createdAtField, updatedAtField] = systemFields;

  return {
    columns: [
      createSystemColumn(idField),
      ...fields.map(createFieldColumn),
      createSystemColumn(createdAtField),
      createSystemColumn(updatedAtField),
    ],
    fields,
    fingerprint,
    kind,
    slug: content.slug,
    systemFields,
    tableIdentifier: toUniqueIdentifier(
      content.slug,
      tableIdentifiers,
      `${kind}_`,
    ),
  } as CompiledContent;
}

export function getSchemaPlanCollection(schemaPlan: SchemaPlan, slug: string) {
  return schemaPlan.collectionBySlug.get(slug) ?? null;
}

export function getSchemaPlanGlobal(schemaPlan: SchemaPlan, slug: string) {
  return schemaPlan.globalBySlug.get(slug) ?? null;
}

export function getCollectionConfig(
  schemaPlan: SchemaPlan,
  slug: string,
): CollectionRuntimeConfig | null {
  const collection = getSchemaPlanCollection(schemaPlan, slug);
  if (!collection) return null;

  return createRuntimeConfig(collection);
}

export function getGlobalConfig(
  schemaPlan: SchemaPlan,
  slug: string,
): GlobalRuntimeConfig | null {
  const global = getSchemaPlanGlobal(schemaPlan, slug);
  if (!global) return null;

  return createRuntimeConfig(global);
}

function createRuntimeConfig(content: CompiledContent): CollectionRuntimeConfig {
  return {
    fields: content.fields.map((field) => ({ ...field })),
    slug: content.slug,
  };
}

export function requireSchemaPlanCollection(
  schemaPlan: SchemaPlan,
  slug: string,
) {
  const collection = getSchemaPlanCollection(schemaPlan, slug);
  if (!collection) throw new Error(`Unsupported collection: ${slug}`);
  return collection;
}

export function requireSchemaPlanGlobal(schemaPlan: SchemaPlan, slug: string) {
  const global = getSchemaPlanGlobal(schemaPlan, slug);
  if (!global) throw new Error(`Unsupported global: ${slug}`);
  return global;
}

export function normalizeDocumentData(
  schemaPlan: SchemaPlan,
  slug: string,
  data: Record<string, unknown>,
): NormalizedDocumentData {
  const collection = getCollectionConfig(schemaPlan, slug);
  if (!collection) throw new Error(`Unsupported collection: ${slug}`);
  return normalizeCollectionData(collection, data);
}

export function normalizeGlobalData(
  schemaPlan: SchemaPlan,
  slug: string,
  data: Record<string, unknown>,
): NormalizedDocumentData {
  const global = getGlobalConfig(schemaPlan, slug);
  if (!global) throw new Error(`Unsupported global: ${slug}`);
  return normalizeCollectionData(global, data);
}

export function buildSchemaPlan(config: FieldstoneConfig): SchemaPlan {
  validateContentSlugs(config);

  const tableIdentifiers = new Set<string>();
  const collections = Object.values(config.collections)
    .sort((a, b) => compareSlugs(a.slug, b.slug))
    .map(
      (collection) =>
        compileContent(
          collection,
          "collection",
          tableIdentifiers,
        ) as CompiledCollection,
    );
  const globals = Object.values(config.globals ?? {})
    .sort((a, b) => compareSlugs(a.slug, b.slug))
    .map(
      (global) =>
        compileContent(global, "global", tableIdentifiers) as CompiledGlobal,
    );

  const collectionSlugs = new Set(collections.map((collection) => collection.slug));
  const assertRelationshipTargets = (fields: FieldDefinition[]) => {
    for (const field of fields) {
      if (field.type === "relationship" && !collectionSlugs.has(field.relationTo))
        throw new Error(
          `Relationship field "${field.name}" points to unknown collection: ${field.relationTo}`,
        );
      // Relationships can be nested inside group/array fields; validate those too.
      if (field.type === "group" || field.type === "array")
        assertRelationshipTargets(field.fields);
    }
  };
  for (const content of [
    ...Object.values(config.collections),
    ...Object.values(config.globals ?? {}),
  ]) {
    assertRelationshipTargets(content.fields);
  }

  return {
    collectionBySlug: new Map(
      collections.map((collection) => [collection.slug, collection]),
    ),
    collections,
    globalBySlug: new Map(globals.map((global) => [global.slug, global])),
    globals,
    fingerprintPayload: {
      collections: collections.map((compiled) => compiled.fingerprint),
      globals: globals.map((compiled) => compiled.fingerprint),
    },
  };
}

export function createCollectionRuntimeConfigs(
  schemaPlan: SchemaPlan,
): CollectionRuntimeConfig[] {
  return schemaPlan.collections.map(
    (collection) => getCollectionConfig(schemaPlan, collection.slug)!,
  );
}

export function createGlobalRuntimeConfigs(
  schemaPlan: SchemaPlan,
): GlobalRuntimeConfig[] {
  return schemaPlan.globals.map(
    (global) => getGlobalConfig(schemaPlan, global.slug)!,
  );
}
