import type {
  AccessUser,
  CollectionData,
  CollectionDocument,
  CollectionSlug,
  DocumentStatus,
  GlobalData,
  GlobalDocument,
  GlobalSlug,
} from "@fieldstone/schema";

export type DocumentData = Record<string, boolean | string | null>;
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
  status?: DocumentStatus;
  user?: AccessUser;
};

export type ListSort = {
  field: string;
  direction?: "asc" | "desc";
};

export type ListInput<TCollection extends CollectionSlug = CollectionSlug> =
  CollectionInput<TCollection> & {
    limit?: number;
    offset?: number;
    sort?: ListSort;
    search?: string;
  };

export type ListResult<TCollection extends CollectionSlug = CollectionSlug> = {
  docs: CollectionDocument<TCollection>[];
  total: number;
  limit: number;
  offset: number;
};

export type DocumentInput<TCollection extends CollectionSlug = CollectionSlug> =
  CollectionInput<TCollection> & {
    id: string;
    /**
     * Skip afterRead hooks and return the raw stored row. Used internally when a
     * read feeds back into a write (e.g. building a PATCH merge base) so hook
     * decorations/masking aren't persisted.
     */
    skipReadHooks?: boolean;
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
  user?: AccessUser;
};

export type UpdateGlobalInput<TGlobal extends GlobalSlug = GlobalSlug> =
  GlobalInput<TGlobal> & {
    data: GlobalData<TGlobal>;
    updatedAt?: Date;
  };
