import type { CollectionHooks, FieldstoneConfig, HookOperation } from "@hugo-hsi-dev/schema";

type Doc = Record<string, unknown>;

export function getCollectionHooks(
  config: FieldstoneConfig,
  slug: string,
): CollectionHooks | undefined {
  // Resolve by slug, not config key — a collection may be registered under a key
  // that differs from its slug, and runtime calls pass the slug (matches the
  // access check).
  return Object.values(config.collections).find((entry) => entry.slug === slug)?.hooks;
}

export async function runBeforeChangeHooks(
  hooks: CollectionHooks | undefined,
  args: {
    collection: string;
    data: Record<string, unknown>;
    operation: HookOperation;
    originalDoc: Doc | null;
  },
): Promise<Record<string, unknown>> {
  let data = args.data;
  for (const hook of hooks?.beforeChange ?? []) {
    const next = await hook({ ...args, data });
    if (next) data = next;
  }
  return data;
}

export async function runAfterChangeHooks(
  hooks: CollectionHooks | undefined,
  args: {
    collection: string;
    doc: Doc;
    operation: HookOperation;
    previousDoc: Doc | null;
  },
): Promise<Doc> {
  let doc = args.doc;
  for (const hook of hooks?.afterChange ?? []) {
    const next = await hook({ ...args, doc });
    if (next) doc = next;
  }
  return doc;
}

export async function runAfterReadHooks(
  hooks: CollectionHooks | undefined,
  collection: string,
  doc: Doc,
): Promise<Doc> {
  let result = doc;
  for (const hook of hooks?.afterRead ?? []) {
    const next = await hook({ collection, doc: result });
    if (next) result = next;
  }
  return result;
}

export async function runBeforeDeleteHooks(
  hooks: CollectionHooks | undefined,
  collection: string,
  id: string,
): Promise<void> {
  for (const hook of hooks?.beforeDelete ?? []) {
    await hook({ collection, id });
  }
}

export async function runAfterDeleteHooks(
  hooks: CollectionHooks | undefined,
  collection: string,
  id: string,
  doc: Doc,
): Promise<void> {
  for (const hook of hooks?.afterDelete ?? []) {
    await hook({ collection, id, doc });
  }
}

export function hasChangeHooks(hooks: CollectionHooks | undefined): boolean {
  return Boolean(hooks?.beforeChange?.length || hooks?.afterChange?.length);
}
