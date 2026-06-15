import {
  normalizeCollectionData,
  type NormalizedDocumentData,
} from "@fieldstone/schema";
import type {
  CollectionRuntimeConfig,
  FieldstoneConfig,
  GlobalRuntimeConfig,
  TextFieldDefinition,
} from "@fieldstone/schema";
import { validateCollectionFields } from "@fieldstone/schema";
import { toUniqueIdentifier } from "./identifiers.ts";

export type CompiledCollectionField = Readonly<
  TextFieldDefinition & {
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
  drizzleType: "text" | "timestamp";
  fingerprint: boolean;
  identifier: string;
  name: string;
  origin: "field" | "system";
  required: boolean;
  runtimeKey: string;
  sourceExpression: "text" | "timestampNow" | "uuidTextPrimaryKey";
  typeScriptName: string;
  typeScriptProperty: string;
  typeScriptType: "Date" | "string";
}>;

export type CollectionFingerprint = Readonly<{
  fields: readonly Readonly<{
    multiline: boolean;
    name: string;
    required: boolean;
    type: TextFieldDefinition["type"];
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
    origin: "system",
    required: true,
    runtimeKey: field.identifier,
    sourceExpression: isId ? "uuidTextPrimaryKey" : "timestampNow",
    typeScriptName: field.identifier,
    typeScriptProperty: field.identifier,
    typeScriptType: isId ? "string" : "Date",
  };
}

function createFieldColumn(field: CompiledCollectionField): CompiledColumn {
  return {
    columnName: field.name,
    drizzleType: "text",
    fingerprint: true,
    identifier: field.identifier,
    name: field.name,
    origin: "field",
    required: field.required,
    runtimeKey: field.name,
    sourceExpression: "text",
    typeScriptName: field.name,
    typeScriptProperty: JSON.stringify(field.name),
    typeScriptType: "string",
  };
}

function compileContent(
  content: { fields: TextFieldDefinition[]; slug: string },
  kind: "collection" | "global",
  tableIdentifiers: Set<string>,
): CompiledContent {
  validateCollectionFields(content.fields);
  const fieldIdentifiers = new Set<string>();
  const fields = content.fields.map((field) => ({
    ...field,
    identifier: toUniqueIdentifier(field.name, fieldIdentifiers),
    required: Boolean(field.required),
  }));
  const fingerprint = {
    fields: fields.map((field) => ({
      name: field.name,
      multiline: Boolean(field.multiline),
      required: field.required,
      type: field.type,
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

function createRuntimeConfig(content: CompiledContent) {
  return {
    fields: content.fields.map((field) => ({
      identifier: field.identifier,
      multiline: field.multiline,
      name: field.name,
      required: field.required,
      type: field.type,
    })),
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
