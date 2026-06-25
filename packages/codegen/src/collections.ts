import { glob, readFile } from "node:fs/promises";
import path from "node:path";

export const CMS_DIR = path.join("src", "cms");
export const COLLECTION_FILENAME = "+collection.ts";
export const GLOBAL_FILENAME = "+global.ts";

export type ContentFile = {
  file: string;
  slug: string;
};

export type CollectionFile = ContentFile;
export type GlobalFile = ContentFile;

type ContentEntry = {
  entry: string;
  files: Partial<Record<"collection" | "global", string>>;
  hasCollection: boolean;
  hasGlobal: boolean;
  isBlank: boolean;
};

export function normalizePath(file: string) {
  return file.split(path.sep).join("/");
}

function isContentSource(entry: string) {
  return (
    entry.endsWith(".ts") &&
    !entry.endsWith(".d.ts") &&
    !entry.includes(".test.") &&
    !entry.includes(".spec.")
  );
}

function isCollectionEntry(entry: string) {
  return !entry.startsWith("_");
}

export function isWatchedCollectionFile(cmsDir: string, file: string) {
  return isWatchedContentFile(cmsDir, file) && path.basename(file) === COLLECTION_FILENAME;
}

export function isWatchedGlobalFile(cmsDir: string, file: string) {
  return isWatchedContentFile(cmsDir, file) && path.basename(file) === GLOBAL_FILENAME;
}

function isWatchedContentFile(cmsDir: string, file: string) {
  const basename = path.basename(file);
  return (
    file.startsWith(cmsDir) &&
    isContentSource(file) &&
    (basename === COLLECTION_FILENAME || basename === GLOBAL_FILENAME) &&
    (!path.basename(path.dirname(file)).startsWith("_") ||
      path.basename(path.dirname(file)) === "__proto__")
  );
}

function validateContentEntries(entries: ContentEntry[]) {
  const slugs = new Set<string>();

  for (const { entry, hasCollection, hasGlobal, isBlank } of entries) {
    if (isBlank) continue;

    if (entry === "__proto__") throw new Error("Reserved content slug: __proto__");
    if (entry.startsWith("_")) continue;
    if (hasCollection && hasGlobal) throw new Error(`Duplicate content slug: ${entry}`);

    const normalizedSlug = entry.toLowerCase();
    if (slugs.has(normalizedSlug)) throw new Error(`Duplicate content slug: ${entry}`);
    slugs.add(normalizedSlug);
  }
}

async function discoverContent(root: string) {
  const groups = new Map<string, ContentEntry["files"]>();
  for await (const file of glob(`${CMS_DIR}/*/{${COLLECTION_FILENAME},${GLOBAL_FILENAME}}`, {
    cwd: root,
  })) {
    const entry = path.basename(path.dirname(file));
    if (!isCollectionEntry(entry) && entry !== "__proto__") continue;
    const kind = path.basename(file) === COLLECTION_FILENAME ? "collection" : "global";
    const files = groups.get(entry) ?? {};
    files[kind] = path.join(root, file);
    groups.set(entry, files);
  }

  const contentEntries = await Promise.all(
    [...groups.entries()].map(async ([entry, files]) => {
      const [collectionSource, globalSource] = await Promise.all([
        files.collection ? readFile(files.collection, "utf-8") : null,
        files.global ? readFile(files.global, "utf-8") : null,
      ]);
      const hasCollection = Boolean(collectionSource?.trim());
      const hasGlobal = Boolean(globalSource?.trim());

      return {
        entry,
        files,
        hasCollection,
        hasGlobal,
        isBlank: !hasCollection && !hasGlobal,
      };
    }),
  );

  contentEntries.sort((a, b) => a.entry.localeCompare(b.entry));
  validateContentEntries(contentEntries);

  return contentEntries.filter(({ entry, isBlank }) => !isBlank && isCollectionEntry(entry));
}

export async function discoverContentFiles(root: string): Promise<{
  collections: CollectionFile[];
  globals: GlobalFile[];
}> {
  const cmsDir = path.join(root, CMS_DIR);
  const contentEntries = await discoverContent(root);

  return {
    collections: contentEntries
      .filter(({ hasCollection }) => hasCollection)
      .map(({ entry, files }) => ({
        file: files.collection ?? path.join(cmsDir, entry, COLLECTION_FILENAME),
        slug: entry,
      })),
    globals: contentEntries
      .filter(({ hasGlobal }) => hasGlobal)
      .map(({ entry, files }) => ({
        file: files.global ?? path.join(cmsDir, entry, GLOBAL_FILENAME),
        slug: entry,
      })),
  };
}
