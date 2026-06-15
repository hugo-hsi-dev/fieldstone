import type {
  CollectionData,
  CollectionDocument,
  CollectionSlug,
  GlobalData,
  GlobalDocument,
  GlobalSlug,
} from "@fieldstone/schema";

export type DocumentData = Record<string, string | null>;
export type FieldstoneCollectionSlug = CollectionSlug;
export type FieldstoneDocument<TCollection extends CollectionSlug> =
  CollectionDocument<TCollection>;
export type FieldstoneDocumentData<TCollection extends CollectionSlug> =
  CollectionData<TCollection>;
export type FieldstoneGlobalSlug = GlobalSlug;
export type FieldstoneGlobal<TGlobal extends GlobalSlug> =
  GlobalDocument<TGlobal>;
export type FieldstoneGlobalData<TGlobal extends GlobalSlug> =
  GlobalData<TGlobal>;

export type CollectionInput<
  TCollection extends CollectionSlug = CollectionSlug,
> = {
  collection: TCollection;
};

export type DocumentInput<TCollection extends CollectionSlug = CollectionSlug> =
  CollectionInput<TCollection> & {
    id: string;
  };

export type MutationInput<TCollection extends CollectionSlug = CollectionSlug> =
  CollectionInput<TCollection> & {
    data: CollectionData<TCollection>;
  };

export type CreateInput<TCollection extends CollectionSlug = CollectionSlug> =
  MutationInput<TCollection> & {
    createdAt?: Date;
    updatedAt?: Date;
  };

export type UpdateInput<TCollection extends CollectionSlug = CollectionSlug> =
  DocumentInput<TCollection> &
    MutationInput<TCollection> & {
      updatedAt?: Date;
    };

export type GlobalInput<TGlobal extends GlobalSlug = GlobalSlug> = {
  global: TGlobal;
};

export type UpdateGlobalInput<TGlobal extends GlobalSlug = GlobalSlug> =
  GlobalInput<TGlobal> & {
    data: GlobalData<TGlobal>;
    updatedAt?: Date;
  };
