import type {
  AccessUser,
  CollectionData,
  CollectionSlug,
  CollectionWhere,
  DocumentStatus,
  GlobalData,
  GlobalSlug,
} from "@hugo-hsi-dev/schema";

export type { WhereClause, WhereOperators } from "./where.js";

export type CollectionInput<TCollection extends CollectionSlug = CollectionSlug> = {
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
    /**
     * Typed field filter (Payload-style operators, AND/OR groups). Combined with
     * `status`/`search` via AND. Scalar columns only — group/array/hasMany relation
     * fields are stored as JSON and cannot be filtered.
     */
    where?: CollectionWhere<TCollection>;
    /**
     * Relationship depth. `0` (default) returns relation/upload fields as ids; `n ≥ 1`
     * recursively replaces each top-level relation field with the target
     * document(s), `n` levels deep, access-checked. The recursion is bounded by
     * `depth`, so it terminates even with circular relations.
     */
    depth?: number;
  };

export type DocumentInput<TCollection extends CollectionSlug = CollectionSlug> =
  CollectionInput<TCollection> & {
    id: string;
    depth?: number;
  };

export type MutationInput<TCollection extends CollectionSlug = CollectionSlug> =
  CollectionInput<TCollection> & {
    data: CollectionData<TCollection>;
  };

export type CreateInput<TCollection extends CollectionSlug = CollectionSlug> =
  MutationInput<TCollection> & {
    createdAt?: Date;
    updatedAt?: Date;
    // Trusted, server-only fields applied AFTER normalization (which strips
    // read-only fields). The upload pipeline uses this to set system-managed media
    // metadata. NEVER populate it from request data — user paths only fill `data`.
    system?: Record<string, unknown>;
  };

// PATCH merge data is recursively partial: top-level fields and nested group
// objects may be omitted (the runtime deep-merges them onto the stored row), while
// arrays and scalar values are replaced wholesale.
type DeepMergeData<T> = T extends Date | string | number | boolean | null
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [TKey in keyof T]?: DeepMergeData<T[TKey]> }
      : T;

export type UpdateInput<TCollection extends CollectionSlug = CollectionSlug> =
  DocumentInput<TCollection> & {
    updatedAt?: Date;
  } & (
      | {
          /**
           * Partial (PATCH) update: merge `data` onto the stored row instead of
           * replacing it, so omitted fields keep their values. The merge reads the
           * raw row under the already-checked update access — no separate read,
           * which is why `data` may omit otherwise-required fields (including nested
           * group siblings).
           */
          merge: true;
          data: DeepMergeData<CollectionData<TCollection>>;
        }
      | {
          merge?: false;
          data: CollectionData<TCollection>;
        }
    );

export type GlobalInput<TGlobal extends GlobalSlug = GlobalSlug> = {
  global: TGlobal;
  user?: AccessUser;
};

export type UpdateGlobalInput<TGlobal extends GlobalSlug = GlobalSlug> = GlobalInput<TGlobal> & {
  data: GlobalData<TGlobal>;
  updatedAt?: Date;
};
