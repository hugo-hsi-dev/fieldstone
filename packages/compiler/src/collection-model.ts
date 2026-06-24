import {
  normalizeCollectionData,
  type NormalizedDocumentData,
} from "@hugo-hsi-dev/schema";
import type {
  CollectionRuntimeConfig,
  FieldDefinition,
  FieldstoneConfig,
  GlobalRuntimeConfig,
  UploadOptions,
} from "@hugo-hsi-dev/schema";
import {
  normalizeSelectOptions,
  STATUS_FIELD_NAME,
  UPLOAD_FIELD_NAMES,
  validateCollectionFields,
} from "@hugo-hsi-dev/schema";
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
    case "upload":
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

// A field is optional on mutation input (but non-null when stored) when the
// runtime fills it in: a defaulted field, an optional array (defaults to []), or
// a group whose subfields are all optional (defaults to {} and fills them in).
function isOptionalInput(field: FieldDefinition): boolean {
  if ("defaultValue" in field && field.defaultValue !== undefined) return true;
  // A boolean defaults to false when omitted, so it's always optional on input.
  if (field.type === "boolean") return true;
  if (field.type === "array") return !field.required;
  if (field.type === "group") return !isRequiredInput(field);
  return false;
}

// Whether omitting a value would fail at runtime — used to derive group
// requiredness from its (possibly nested) subfields.
function isRequiredInput(field: FieldDefinition): boolean {
  if (field.type === "boolean") return false;
  if ("defaultValue" in field && field.defaultValue !== undefined) return false;
  if (field.type === "group") return field.fields.some(isRequiredInput);
  return "required" in field ? Boolean(field.required) : false;
}

function objectTypeScript(fields: FieldDefinition[]): string {
  if (fields.length === 0) return "Record<string, never>";
  const entries = fields
    .map((field) => {
      const optional = isOptionalInput(field);
      const nullable = !optional && fieldNullable(field);
      return `${JSON.stringify(field.name)}${optional ? "?" : ""}: ${fieldTypeScript(field)}${nullable ? " | null" : ""}`;
    })
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
    case "upload":
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

// Mirrors withDraftStatusField: an upload-enabled collection gets read-only media
// metadata columns. They are left non-required (nullable) on purpose — they are
// populated by the upload pipeline, never by a hand-written create, so forcing
// them would break the collection's own create input type and form. `url` is
// derived from `filename` at read time; `sizes` arrives with image variants.
function withUploadFields(content: {
  fields: FieldDefinition[];
  upload?: UploadOptions;
}): FieldDefinition[] {
  if (!content.upload) return content.fields;
  const reserved = new Set<string>(UPLOAD_FIELD_NAMES);
  for (const field of content.fields) {
    if (reserved.has(field.name))
      throw new Error(
        `Reserved field name on an upload-enabled collection: ${field.name}`,
      );
  }
  const meta = (name: string, type: "text" | "number"): FieldDefinition =>
    ({ name, type, admin: { readOnly: true } }) as FieldDefinition;
  // Generated image variants. Modeled as a read-only array (a json column) so the
  // type is sound whether empty (no sharp / no imageSizes) or populated; the upload
  // pipeline sets it via the trusted `system` channel.
  const sizes: FieldDefinition = {
    name: "sizes",
    type: "array",
    admin: { readOnly: true },
    fields: [
      { name: "name", type: "text", required: true },
      { name: "filename", type: "text", required: true },
      { name: "width", type: "number" },
      { name: "height", type: "number" },
      { name: "mimeType", type: "text" },
      { name: "filesize", type: "number" },
    ],
  };
  return [
    ...content.fields,
    meta("filename", "text"),
    meta("mimeType", "text"),
    meta("filesize", "number"),
    meta("width", "number"),
    meta("height", "number"),
    meta("focalX", "number"),
    meta("focalY", "number"),
    sizes,
  ];
}

function compileContent(
  content: {
    fields: FieldDefinition[];
    slug: string;
    drafts?: boolean;
    upload?: UploadOptions;
  },
  kind: "collection" | "global",
  tableIdentifiers: Set<string>,
): CompiledContent {
  const sourceFields = withUploadFields({
    fields: withDraftStatusField(content),
    upload: content.upload,
  });
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
        : field.type === "group"
          ? // A group must be provided when a subfield would otherwise fail.
            field.fields.some(isRequiredInput)
          : "required" in field
            ? Boolean(field.required)
            : false,
  }));
  const fingerprint = {
    fields: fields.map((field) => ({
      name: field.name,
      ...(field.type === "text" ? { multiline: Boolean(field.multiline) } : {}),
      ...(field.type === "relationship" || field.type === "upload"
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
  const uploadCollectionSlugs = new Set(
    Object.values(config.collections)
      .filter((collection) => collection.upload)
      .map((collection) => collection.slug),
  );
  const assertRelationshipTargets = (
    fields: FieldDefinition[],
    withinGlobal: boolean,
  ) => {
    for (const field of fields) {
      if (field.type === "relationship" && !collectionSlugs.has(field.relationTo))
        throw new Error(
          `Relationship field "${field.name}" points to unknown collection: ${field.relationTo}`,
        );
      if (field.type === "upload") {
        // Globals run no hooks/access, so there is no seam to clean up files or
        // gate them — upload fields are collection-only.
        if (withinGlobal)
          throw new Error(
            `Upload field "${field.name}" is not supported on globals`,
          );
        if (!collectionSlugs.has(field.relationTo))
          throw new Error(
            `Upload field "${field.name}" points to unknown collection: ${field.relationTo}`,
          );
        if (!uploadCollectionSlugs.has(field.relationTo))
          throw new Error(
            `Upload field "${field.name}" must point to an upload-enabled collection: ${field.relationTo}`,
          );
      }
      // Relationships/uploads can be nested inside group/array fields; validate those too.
      if (field.type === "group" || field.type === "array")
        assertRelationshipTargets(field.fields, withinGlobal);
    }
  };
  for (const collection of Object.values(config.collections)) {
    assertRelationshipTargets(collection.fields, false);
  }
  for (const global of Object.values(config.globals ?? {})) {
    assertRelationshipTargets(global.fields, true);
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
