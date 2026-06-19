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

export type FieldstoneConfigInput = {
  db: {
    dialect: "sqlite";
    url: string;
  };
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

// Mutation input reuses the generated document field types, but a `date` field
// reads as `Date` while create/update also accept an ISO string (the runtime and
// REST/admin paths both normalize strings), so widen Date → Date | string on input.
type WidenInputValue<T> = T extends Date ? Date | string : T;

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

// The generated interface marks defaulted fields / optional arrays optional so
// mutation input (CollectionData) can omit them, but a *read* always returns a
// concrete value. This makes every read property required and non-undefined so
// the document (read) type stays sound; nullable fields keep their `| null`.
type DocumentShape<TGenerated> = {
  [TField in keyof TGenerated]-?: Exclude<TGenerated[TField], undefined>;
};

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
