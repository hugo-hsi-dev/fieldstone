import type { CollectionDocument, CollectionSlug } from "@hugo-hsi-dev/schema";

import { assertCollectionAccess } from "./access.ts";
import type { createDatabase } from "./database.ts";
import {
  getCollectionHooks,
  hasChangeHooks,
  runAfterChangeHooks,
  runAfterDeleteHooks,
  runAfterReadHooks,
  runBeforeChangeHooks,
  runBeforeDeleteHooks,
} from "./hooks.ts";
import type {
  CreateInput,
  DocumentInput,
  ListInput,
  UpdateInput,
} from "./types.ts";
import { buildWhere } from "./where.ts";

type DatabaseContext = Awaited<ReturnType<typeof createDatabase>>;
type Doc = Record<string, unknown>;

// Drop the runtime-managed system columns so a stored row can be used as a merge
// base for a partial update without the normalizer rejecting them as unknown.
const SYSTEM_FIELDS = new Set(["id", "createdAt", "updatedAt"]);
function stripSystemFields(doc: Doc): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (!SYSTEM_FIELDS.has(key)) rest[key] = value;
  }
  return rest;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  // Only merge plain records (group objects); scalar object values like Date are
  // replaced wholesale so the deep merge can't turn a Date into {}.
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Recursively overlay a PATCH body onto the stored row so partial group payloads
// (e.g. { seo: { description } }) keep their omitted siblings instead of replacing
// the whole group. Arrays and scalars are replaced wholesale.
function deepMergePatch(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const existing = result[key];
    result[key] =
      isPlainObject(value) && isPlainObject(existing)
        ? deepMergePatch(existing, value)
        : value;
  }
  return result;
}

function isUploadCollection(config: DatabaseContext["config"], slug: string) {
  return Object.values(config.collections).some(
    (collection) => collection.slug === slug && Boolean(collection.upload),
  );
}

// The original filename plus every generated variant filename (the `sizes` rows),
// for cleanup when a media doc is deleted.
function collectStorageKeys(doc: Doc): string[] {
  const keys: string[] = [];
  if (typeof doc.filename === "string" && doc.filename) keys.push(doc.filename);
  if (Array.isArray(doc.sizes)) {
    for (const entry of doc.sizes) {
      const filename = (entry as { filename?: unknown } | null)?.filename;
      if (typeof filename === "string" && filename) keys.push(filename);
    }
  }
  return keys;
}

export function createDocumentRuntime(context: DatabaseContext) {
  const {
    compiled,
    compiledConfig,
    config,
    database,
    storage,
    and,
    asc,
    count,
    desc,
    eq,
    gt,
    gte,
    inArray,
    isNotNull,
    isNull,
    like,
    lt,
    lte,
    ne,
    notInArray,
    or,
  } = context;

  // Operator bundle for the typed where-builder (drizzle-orm fns from the context).
  const whereOps = {
    and,
    or,
    eq,
    ne,
    gt,
    gte,
    lt,
    lte,
    like,
    inArray,
    notInArray,
    isNull,
    isNotNull,
  };

  function getTable(collectionSlug: string) {
    if (!compiledConfig.getCollection(collectionSlug)) {
      throw new Error(`Unsupported collection: ${collectionSlug}`);
    }
    return compiled.tables[collectionSlug];
  }

  function buildConditions(
    collectionSlug: string,
    table: Record<string, any>,
    status: ListInput["status"],
    search: string | undefined,
    where: ListInput["where"],
  ) {
    const conditions: unknown[] = [];
    if (status) {
      // Reject rather than silently drop the predicate, which would otherwise
      // return every row (including ones that aren't drafts) on a non-draft collection.
      if (!table._status)
        throw new Error(
          `Collection "${collectionSlug}" does not support a status filter (drafts are not enabled)`,
        );
      conditions.push(eq(table._status, status));
    }
    const term = search?.trim();
    if (term) {
      const fields = compiledConfig.getCollection(collectionSlug)?.fields ?? [];
      const likes = fields
        .filter(
          (field) =>
            field.type === "text" ||
            field.type === "email" ||
            field.type === "select",
        )
        .map((field) => table[field.name])
        .filter(Boolean)
        .map((column) => like(column, `%${term}%`));
      if (likes.length === 1) conditions.push(likes[0]);
      else if (likes.length > 1) conditions.push(or(...likes));
    }
    if (where) {
      const fields = compiledConfig.getCollection(collectionSlug)?.fields ?? [];
      const condition = buildWhere(where, table, fields, whereOps);
      if (condition !== undefined) conditions.push(condition);
    }
    return conditions;
  }

  return {
    find: async <TCollection extends CollectionSlug>({
      collection: collectionSlug,
      status,
      limit,
      offset,
      sort,
      search,
      where,
      user,
    }: ListInput<TCollection>) => {
      await assertCollectionAccess(config, collectionSlug, "read", { user: user ?? null });
      const table = getTable(collectionSlug);
      const conditions = buildConditions(collectionSlug, table, status, search, where);
      let query = database.select().from(table).$dynamic();
      if (conditions.length === 1) query = query.where(conditions[0] as any);
      else if (conditions.length > 1) query = query.where(and(...(conditions as any[])));
      const sortColumn =
        sort?.field && Object.prototype.hasOwnProperty.call(table, sort.field)
          ? table[sort.field]
          : table.createdAt;
      query = query.orderBy(sort?.direction === "asc" ? asc(sortColumn) : desc(sortColumn));
      if (typeof limit === "number") query = query.limit(limit);
      if (typeof offset === "number") query = query.offset(offset);
      const rows = (await query) as Doc[];
      const hooks = getCollectionHooks(config, collectionSlug);
      if (!hooks?.afterRead?.length) {
        return rows as unknown as CollectionDocument<TCollection>[];
      }
      const read = await Promise.all(
        rows.map((row) => runAfterReadHooks(hooks, collectionSlug, row)),
      );
      return read as unknown as CollectionDocument<TCollection>[];
    },

    count: async <TCollection extends CollectionSlug>({
      collection: collectionSlug,
      status,
      search,
      where,
      user,
    }: ListInput<TCollection>) => {
      await assertCollectionAccess(config, collectionSlug, "read", { user: user ?? null });
      const table = getTable(collectionSlug);
      const conditions = buildConditions(collectionSlug, table, status, search, where);
      let query = database.select({ value: count() }).from(table).$dynamic();
      if (conditions.length === 1) query = query.where(conditions[0] as any);
      else if (conditions.length > 1) query = query.where(and(...(conditions as any[])));
      const [row] = (await query) as { value: number }[];
      return Number(row?.value ?? 0);
    },

    findById: async <TCollection extends CollectionSlug>({
      collection: collectionSlug,
      id,
      user,
    }: DocumentInput<TCollection>) => {
      await assertCollectionAccess(config, collectionSlug, "read", { user: user ?? null, id });
      const table = getTable(collectionSlug);
      const [document] = await database.select().from(table).where(eq(table.id, id)).limit(1);
      if (!document) return null;
      const hooks = getCollectionHooks(config, collectionSlug);
      const read = await runAfterReadHooks(hooks, collectionSlug, document as Doc);
      return read as unknown as CollectionDocument<TCollection>;
    },

    create: async <TCollection extends CollectionSlug>({
      collection: collectionSlug,
      createdAt,
      data,
      system,
      updatedAt,
      user,
    }: CreateInput<TCollection>) => {
      const hooks = getCollectionHooks(config, collectionSlug);
      // Normalize before the access check so rules inspecting `data` see the trimmed
      // values and applied defaults that will actually be stored.
      let document: Doc;
      try {
        document = compiledConfig.normalizeDocumentData(collectionSlug, data) as Doc;
      } catch (normalizationError) {
        // Check access before surfacing a validation error, so denied callers can't
        // probe field names/constraints via 400 messages.
        await assertCollectionAccess(config, collectionSlug, "create", {
          user: user ?? null,
          data: data as Record<string, unknown>,
        });
        throw normalizationError;
      }
      await assertCollectionAccess(config, collectionSlug, "create", {
        user: user ?? null,
        data: document as Record<string, unknown>,
      });
      document = await runBeforeChangeHooks(hooks, {
        collection: collectionSlug,
        data: document,
        operation: "create",
        originalDoc: null,
      });
      const table = compiled.tables[collectionSlug];
      const now = new Date();
      const createdRows = (await database
        .insert(table)
        .values({
          ...document,
          // Trusted system fields (set by the upload pipeline) override anything
          // a hook or stripped input could have left, and aren't user-reachable.
          ...system,
          createdAt: createdAt ?? now,
          updatedAt: updatedAt ?? now,
        })
        .returning()) as Doc[];
      const created = await runAfterChangeHooks(hooks, {
        collection: collectionSlug,
        doc: createdRows[0] as Doc,
        operation: "create",
        previousDoc: null,
      });

      return created as unknown as CollectionDocument<TCollection>;
    },

    update: async <TCollection extends CollectionSlug>({
      collection: collectionSlug,
      data,
      id,
      merge,
      updatedAt,
      user,
    }: UpdateInput<TCollection>) => {
      const hooks = getCollectionHooks(config, collectionSlug);
      const table = getTable(collectionSlug);
      let originalDoc: Doc | null = null;
      const needExisting = merge || hasChangeHooks(hooks);
      if (needExisting) {
        const [existing] = await database.select().from(table).where(eq(table.id, id)).limit(1);
        originalDoc = (existing ?? null) as Doc | null;
      }
      if (needExisting && !originalDoc) {
        // Run the access rule (against the body) before revealing absence, so a
        // forbidden caller gets 403 rather than enumerating ids via 404-vs-403.
        await assertCollectionAccess(config, collectionSlug, "update", {
          user: user ?? null,
          id,
          data: data as Record<string, unknown>,
        });
        throw new Error("Document not found");
      }
      // PATCH/merge: overlay the provided fields onto the stored content so omitted
      // fields keep their values. Reads the raw row directly (no afterRead); unknown
      // keys still flow to the normalizer, which rejects them.
      const inputData =
        merge && originalDoc
          ? deepMergePatch(
              stripSystemFields(originalDoc),
              data as Record<string, unknown>,
            )
          : data;
      // Check access against the normalized, merged document — so rules see the
      // trimmed/defaulted values that will be stored and a PATCH can't bypass a rule
      // on a persisted field by omitting it.
      let document: Doc;
      try {
        document = compiledConfig.normalizeDocumentData(collectionSlug, inputData) as Doc;
      } catch (normalizationError) {
        // Run the access rule before surfacing a validation/unknown-field error, so a
        // forbidden caller can't enumerate existing vs missing ids with a malformed body.
        await assertCollectionAccess(config, collectionSlug, "update", {
          user: user ?? null,
          id,
          data: inputData as Record<string, unknown>,
        });
        throw normalizationError;
      }
      await assertCollectionAccess(config, collectionSlug, "update", {
        user: user ?? null,
        id,
        data: document as Record<string, unknown>,
      });
      document = await runBeforeChangeHooks(hooks, {
        collection: collectionSlug,
        data: document,
        operation: "update",
        originalDoc,
      });
      const updatedRows = (await database
        .update(table)
        .set({
          ...document,
          updatedAt: updatedAt ?? new Date(),
        })
        .where(eq(table.id, id))
        .returning()) as Doc[];
      const updated = updatedRows[0];

      if (!updated) throw new Error("Document not found");
      const afterChange = await runAfterChangeHooks(hooks, {
        collection: collectionSlug,
        doc: updated,
        operation: "update",
        previousDoc: originalDoc,
      });
      return afterChange as unknown as CollectionDocument<TCollection>;
    },

    delete: async <TCollection extends CollectionSlug>({
      collection: collectionSlug,
      id,
      user,
    }: DocumentInput<TCollection>) => {
      await assertCollectionAccess(config, collectionSlug, "delete", { user: user ?? null, id });
      const hooks = getCollectionHooks(config, collectionSlug);
      const table = getTable(collectionSlug);
      // Upload collections need the row up front to clean up the stored file —
      // this is a framework step, not a user hook (afterDelete only fires when a
      // user registered one), so a media doc never leaks its bytes on delete.
      const uploadCollection = isUploadCollection(config, collectionSlug);
      let deletedDoc: Doc | null = null;
      if (hooks?.beforeDelete?.length || hooks?.afterDelete?.length || uploadCollection) {
        const [existing] = await database.select().from(table).where(eq(table.id, id)).limit(1);
        deletedDoc = (existing ?? null) as Doc | null;
        // Confirm the row exists before firing hooks, so beforeDelete/afterDelete
        // never run (writing audit records, cleaning resources) for a no-op delete.
        if (!deletedDoc) throw new Error("Document not found");
      }
      await runBeforeDeleteHooks(hooks, collectionSlug, id);
      const deletedRows = (await database
        .delete(table)
        .where(eq(table.id, id))
        .returning({ id: table.id })) as unknown[];
      const [deleted] = deletedRows;

      if (!deleted) throw new Error("Document not found");

      // The original file plus every generated variant (the `sizes` rows).
      const storageKeys =
        uploadCollection && deletedDoc ? collectStorageKeys(deletedDoc) : [];

      // The row is already gone, so the files must be cleaned up even if a user
      // afterDelete hook throws — otherwise the bytes leak. Run hooks, capture any
      // error, clean up, then resurface the hook error.
      let afterDeleteError: unknown = null;
      if (deletedDoc) {
        try {
          await runAfterDeleteHooks(hooks, collectionSlug, id, deletedDoc);
        } catch (caught) {
          afterDeleteError = caught;
        }
      }
      // Best-effort: a missing file must not fail the delete (the DB is the
      // source of truth).
      for (const key of storageKeys) await storage.delete(key).catch(() => {});
      if (afterDeleteError) throw afterDeleteError;

      return deleted as { id: string };
    },
  };
}
