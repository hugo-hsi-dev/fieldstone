export type TextFieldDefinition = {
  multiline?: boolean;
  name: string;
  required?: boolean;
  type: "text";
};

export type CollectionRuntimeField = TextFieldDefinition & {
  identifier: string;
  required: boolean;
};

export type CollectionDefinition = {
  fields: TextFieldDefinition[];
};

export type CollectionRuntimeConfig = {
  fields: CollectionRuntimeField[];
  slug: string;
};

export type CollectionConfig = CollectionDefinition & {
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
};

export interface GeneratedCollections {}

type GeneratedCollectionSlug = keyof GeneratedCollections & string;

export type CollectionSlug = [GeneratedCollectionSlug] extends [never]
  ? string
  : GeneratedCollectionSlug;

export type SystemFieldName = "id" | "createdAt" | "updatedAt";

type CollectionFieldName<TCollection extends keyof GeneratedCollections> = Exclude<
  keyof GeneratedCollections[TCollection],
  SystemFieldName
> &
  string;

type RequiredCollectionFieldName<TCollection extends keyof GeneratedCollections> = {
  [TField in CollectionFieldName<TCollection>]: null extends GeneratedCollections[TCollection][TField]
    ? never
    : TField;
}[CollectionFieldName<TCollection>];

type OptionalCollectionFieldName<TCollection extends keyof GeneratedCollections> = Exclude<
  CollectionFieldName<TCollection>,
  RequiredCollectionFieldName<TCollection>
>;

type CollectionDataValue<
  TCollection extends keyof GeneratedCollections,
  TField extends CollectionFieldName<TCollection>,
> =
  Exclude<GeneratedCollections[TCollection][TField], undefined> extends string | null
    ? Exclude<GeneratedCollections[TCollection][TField], undefined>
    : Exclude<GeneratedCollections[TCollection][TField], undefined>;

export type CollectionDocument<TCollection extends string> =
  TCollection extends keyof GeneratedCollections
    ? GeneratedCollections[TCollection]
    : {
        id: string;
        createdAt: Date;
        updatedAt: Date;
      } & Record<string, unknown>;

export type CollectionData<TCollection extends string> =
  TCollection extends keyof GeneratedCollections
    ? {
        [K in RequiredCollectionFieldName<TCollection>]: CollectionDataValue<TCollection, K>;
      } & {
        [K in OptionalCollectionFieldName<TCollection>]?: CollectionDataValue<TCollection, K>;
      }
    : Record<string, string | null>;
