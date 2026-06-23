export type FieldAdminOptions = {
  description?: string;
  placeholder?: string;
  readOnly?: boolean;
};

type CommonFieldOptions = {
  name: string;
  label?: string;
  required?: boolean;
  unique?: boolean;
  admin?: FieldAdminOptions;
};

export type TextFieldDefinition = CommonFieldOptions & {
  type: "text";
  multiline?: boolean;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

export type EmailFieldDefinition = CommonFieldOptions & {
  type: "email";
  defaultValue?: string;
};

export type NumberFieldDefinition = CommonFieldOptions & {
  type: "number";
  defaultValue?: number;
  min?: number;
  max?: number;
  integer?: boolean;
};

export type DateFieldDefinition = CommonFieldOptions & {
  type: "date";
  defaultValue?: string;
};

export type SelectOption = {
  label: string;
  value: string;
};

export type SelectOptionInput = string | SelectOption;

export type SelectFieldDefinition = CommonFieldOptions & {
  type: "select";
  options: SelectOption[];
  defaultValue?: string;
};

export type BooleanFieldDefinition = {
  name: string;
  label?: string;
  type: "boolean";
  defaultValue?: boolean;
  admin?: FieldAdminOptions;
};

export type RelationshipFieldDefinition = CommonFieldOptions & {
  type: "relationship";
  relationTo: string;
  hasMany?: boolean;
};

// An `upload` field is a single-id (or hasMany) reference to an upload-enabled
// collection — it stores media ids exactly like a relationship, but the target
// must be a media collection (validated by the compiler) and the admin renders it
// as a file picker rather than a plain relation select.
export type UploadFieldDefinition = CommonFieldOptions & {
  type: "upload";
  relationTo: string;
  hasMany?: boolean;
};

export type RichTextFieldDefinition = CommonFieldOptions & {
  type: "richText";
  defaultValue?: string;
};

export type GroupFieldDefinition = {
  type: "group";
  name: string;
  label?: string;
  fields: FieldDefinition[];
  admin?: FieldAdminOptions;
};

export type ArrayFieldDefinition = {
  type: "array";
  name: string;
  label?: string;
  fields: FieldDefinition[];
  required?: boolean;
  admin?: FieldAdminOptions;
};

export type FieldDefinition =
  | TextFieldDefinition
  | EmailFieldDefinition
  | NumberFieldDefinition
  | DateFieldDefinition
  | SelectFieldDefinition
  | BooleanFieldDefinition
  | RelationshipFieldDefinition
  | UploadFieldDefinition
  | RichTextFieldDefinition
  | GroupFieldDefinition
  | ArrayFieldDefinition;

export type FieldType = FieldDefinition["type"];

export type RuntimeField = FieldDefinition & {
  identifier: string;
  required: boolean;
};

export type CollectionRuntimeField = RuntimeField;
export type GlobalRuntimeField = RuntimeField;

export type HookOperation = "create" | "update";

export type CollectionBeforeChangeHook = (args: {
  collection: string;
  data: Record<string, unknown>;
  operation: HookOperation;
  originalDoc: Record<string, unknown> | null;
}) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>;

export type CollectionAfterChangeHook = (args: {
  collection: string;
  doc: Record<string, unknown>;
  operation: HookOperation;
  previousDoc: Record<string, unknown> | null;
}) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>;

export type CollectionAfterReadHook = (args: {
  collection: string;
  doc: Record<string, unknown>;
}) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>;

export type CollectionBeforeDeleteHook = (args: {
  collection: string;
  id: string;
}) => void | Promise<void>;

export type CollectionAfterDeleteHook = (args: {
  collection: string;
  id: string;
  doc: Record<string, unknown>;
}) => void | Promise<void>;

export type CollectionHooks = {
  beforeChange?: CollectionBeforeChangeHook[];
  afterChange?: CollectionAfterChangeHook[];
  afterRead?: CollectionAfterReadHook[];
  beforeDelete?: CollectionBeforeDeleteHook[];
  afterDelete?: CollectionAfterDeleteHook[];
};

export type AccessOperation = "create" | "read" | "update" | "delete";

export type AccessUser = Record<string, unknown> | null;

export type AccessArgs = {
  collection: string;
  operation: AccessOperation;
  user: AccessUser;
  id?: string;
  data?: Record<string, unknown>;
};

export type AccessFn = (args: AccessArgs) => boolean | Promise<boolean>;

export type CollectionAccess = {
  read?: AccessFn;
  create?: AccessFn;
  update?: AccessFn;
  delete?: AccessFn;
};

export type DocumentStatus = "draft" | "published";

export const STATUS_FIELD_NAME = "_status";

// Media-metadata fields the compiler injects into every upload-enabled
// collection. Reserved: a user field of the same name would shadow the injected
// column and corrupt upload bookkeeping. (`sizes` is added with image variants in
// a later slice; `url` is derived from `filename` + the serve route, not stored.)
export const UPLOAD_FIELD_NAMES = [
  "filename",
  "mimeType",
  "filesize",
  "width",
  "height",
  "focalX",
  "focalY",
] as const;

export type UploadImageSize = {
  name: string;
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
};

// Per-collection upload rules. Where bytes are stored is a backend concern set
// once on the global `storage` config; these are per-media-collection knobs.
export type UploadOptions = {
  /** Allowed MIME types, e.g. ["image/*"] or ["image/png", "application/pdf"]. */
  mimeTypes?: string[];
  /** Maximum accepted upload size, in bytes. */
  maxFileSize?: number;
  /** Named image variants, generated when `sharp` is installed. */
  imageSizes?: UploadImageSize[];
  /** Named size (or "filename") used as the admin thumbnail. */
  adminThumbnail?: string;
  /** Enable per-document focal point selection (requires `sharp`). */
  focalPoint?: boolean;
};

export type ContentDefinition = {
  fields: FieldDefinition[];
  drafts?: boolean;
};

// Hooks and access are collection-only. The global runtime just normalizes and
// upserts data — it never runs hooks or access checks — so globals deliberately
// don't accept those options rather than expose ones that silently do nothing.
export type CollectionDefinition = ContentDefinition & {
  hooks?: CollectionHooks;
  access?: CollectionAccess;
  // Marks this as a media collection: the compiler injects upload metadata fields
  // and the admin renders upload/serve affordances. Upload is collection-only —
  // globals have no hook/access seam for file cleanup, so they can't be media.
  upload?: UploadOptions;
};
export type GlobalDefinition = ContentDefinition;

export type RuntimeConfig = {
  fields: RuntimeField[];
  slug: string;
};

export type CollectionRuntimeConfig = RuntimeConfig;
export type GlobalRuntimeConfig = RuntimeConfig;

export type CollectionConfig = CollectionDefinition & {
  slug: string;
};

export type GlobalConfig = GlobalDefinition & {
  slug: string;
};

// Storage backend for uploaded files. Declarative (serialized into
// $fieldstone-config); the live adapter is resolved from it at runtime by
// @fieldstone/storage. The mime/size limits are per-collection (UploadOptions).
export type StorageConfig = {
  /** Backend. "local" (default) writes to staticDir; "s3" uses a remote adapter (a later slice). */
  adapter?: "local" | "s3";
  /** Directory (relative to the app root) for local files. Defaults to ".fieldstone/uploads". */
  staticDir?: string;
  /** URL prefix the media-serving route is mounted at. Defaults to "/media". */
  staticURL?: string;
};

export type FieldstoneConfigInput = {
  db: {
    dialect: "sqlite";
    url: string;
  };
  storage?: StorageConfig;
};

export type FieldstoneConfig = FieldstoneConfigInput & {
  collections: Record<string, CollectionConfig>;
  globals?: Record<string, GlobalConfig>;
};

export interface GeneratedCollections {}
export interface GeneratedGlobals {}

type GeneratedCollectionSlug = keyof GeneratedCollections & string;
type GeneratedGlobalSlug = keyof GeneratedGlobals & string;

export type CollectionSlug = [GeneratedCollectionSlug] extends [never]
  ? string
  : GeneratedCollectionSlug;

export type GlobalSlug = [GeneratedGlobalSlug] extends [never]
  ? string
  : GeneratedGlobalSlug;

export type SystemFieldName = "id" | "createdAt" | "updatedAt";

type ContentFieldName<
  TGenerated extends object,
  TSlug extends keyof TGenerated,
> = Exclude<keyof TGenerated[TSlug], SystemFieldName> & string;

type RequiredContentFieldName<
  TGenerated extends object,
  TSlug extends keyof TGenerated,
> = {
  [TField in ContentFieldName<TGenerated, TSlug>]: undefined extends TGenerated[TSlug][TField]
    ? never // optional property (e.g. a defaulted field) → optional on input
    : Exclude<TGenerated[TSlug][TField], undefined> extends boolean
      ? never
      : null extends TGenerated[TSlug][TField]
        ? never
        : TField;
}[ContentFieldName<TGenerated, TSlug>];

type OptionalContentFieldName<
  TGenerated extends object,
  TSlug extends keyof TGenerated,
> = Exclude<
  ContentFieldName<TGenerated, TSlug>,
  RequiredContentFieldName<TGenerated, TSlug>
>;

// Mutation input reuses the generated document field types, but the runtime and
// REST/admin paths also normalize strings: a `date` reads as `Date` yet accepts an
// ISO string, and a `number` accepts a numeric string. Widen those on input,
// recursing through nested group/array shapes (normalization recurses too).
type WidenInputValue<T> = T extends Date
  ? Date | string
  : T extends number
    ? number | string
    : T extends readonly (infer TItem)[]
      ? WidenInputValue<TItem>[]
      : T extends object
        ? { [TKey in keyof T]: WidenInputValue<T[TKey]> }
        : T;

type ContentDataValue<
  TGenerated extends object,
  TSlug extends keyof TGenerated,
  TField extends ContentFieldName<TGenerated, TSlug>,
> = WidenInputValue<Exclude<TGenerated[TSlug][TField], undefined>>;

type GeneratedData<
  TGenerated extends object,
  TSlug extends keyof TGenerated,
> = {
  [K in RequiredContentFieldName<TGenerated, TSlug>]: ContentDataValue<
    TGenerated,
    TSlug,
    K
  >;
} & {
  [K in OptionalContentFieldName<TGenerated, TSlug>]?: ContentDataValue<
    TGenerated,
    TSlug,
    K
  >;
};

type FallbackDocument = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
} & Record<string, unknown>;

// The generated interface marks defaulted fields / optional arrays / optional
// nested subfields optional so mutation input (CollectionData) can omit them, but
// a *read* always returns a concrete value. This recursively makes every read
// property required and non-undefined (including inside nested group/array
// shapes) so the document type stays sound; nullable fields keep their `| null`.
type DocumentShape<T> = T extends Date
  ? T
  : T extends readonly (infer TItem)[]
    ? DocumentShape<TItem>[]
    : T extends object
      ? { [TField in keyof T]-?: DocumentShape<Exclude<T[TField], undefined>> }
      : T;

export type CollectionDocument<TCollection extends string> =
  TCollection extends keyof GeneratedCollections
    ? DocumentShape<GeneratedCollections[TCollection]>
    : FallbackDocument;

export type GlobalDocument<TGlobal extends string> =
  TGlobal extends keyof GeneratedGlobals
    ? DocumentShape<GeneratedGlobals[TGlobal]>
    : FallbackDocument;

type FallbackDataValue =
  | boolean
  | number
  | string
  | string[]
  | Date
  | null
  | { [key: string]: FallbackDataValue }
  | { [key: string]: FallbackDataValue }[];

export type CollectionData<TCollection extends string> =
  TCollection extends keyof GeneratedCollections
    ? GeneratedData<GeneratedCollections, TCollection>
    : Record<string, FallbackDataValue>;

export type GlobalData<TGlobal extends string> =
  TGlobal extends keyof GeneratedGlobals
    ? GeneratedData<GeneratedGlobals, TGlobal>
    : Record<string, FallbackDataValue>;
