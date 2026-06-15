export type TextFieldDefinition = {
  multiline?: boolean;
  name: string;
  required?: boolean;
  type: "text";
};

export type BooleanFieldDefinition = {
  name: string;
  type: "boolean";
};

export type FieldDefinition = TextFieldDefinition | BooleanFieldDefinition;

export type RuntimeField = FieldDefinition & {
  identifier: string;
  required: boolean;
};

export type CollectionRuntimeField = RuntimeField;
export type GlobalRuntimeField = RuntimeField;

export type ContentDefinition = {
  fields: FieldDefinition[];
};

export type CollectionDefinition = ContentDefinition;
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
  [TField in ContentFieldName<TGenerated, TSlug>]: Exclude<
    TGenerated[TSlug][TField],
    undefined
  > extends boolean
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

type ContentDataValue<
  TGenerated extends object,
  TSlug extends keyof TGenerated,
  TField extends ContentFieldName<TGenerated, TSlug>,
> =
  Exclude<TGenerated[TSlug][TField], undefined> extends string | null
    ? Exclude<TGenerated[TSlug][TField], undefined>
    : Exclude<TGenerated[TSlug][TField], undefined>;

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

export type CollectionDocument<TCollection extends string> =
  TCollection extends keyof GeneratedCollections
    ? GeneratedCollections[TCollection]
    : FallbackDocument;

export type GlobalDocument<TGlobal extends string> =
  TGlobal extends keyof GeneratedGlobals
    ? GeneratedGlobals[TGlobal]
    : FallbackDocument;

export type CollectionData<TCollection extends string> =
  TCollection extends keyof GeneratedCollections
    ? GeneratedData<GeneratedCollections, TCollection>
    : Record<string, boolean | string | null>;

export type GlobalData<TGlobal extends string> =
  TGlobal extends keyof GeneratedGlobals
    ? GeneratedData<GeneratedGlobals, TGlobal>
    : Record<string, boolean | string | null>;
