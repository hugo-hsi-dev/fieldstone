import { readFile, readdir } from "node:fs/promises";
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

export type ContentEntry = {
  entry: string;
  hasCollection: boolean;
  hasGlobal: boolean;
  isBlank: boolean;
};

export type CollectionEntry = {
  entry: string;
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

export function isCollectionEntry(entry: string) {
  return !entry.startsWith("_");
}

export function isWatchedCollectionFile(cmsDir: string, file: string) {
  return (
    isWatchedContentFile(cmsDir, file) &&
    path.basename(file) === COLLECTION_FILENAME
  );
}

export function isWatchedGlobalFile(cmsDir: string, file: string) {
  return (
    isWatchedContentFile(cmsDir, file) &&
    path.basename(file) === GLOBAL_FILENAME
  );
}

export function isWatchedContentFile(cmsDir: string, file: string) {
  const basename = path.basename(file);
  return (
    file.startsWith(cmsDir) &&
    isContentSource(file) &&
    (basename === COLLECTION_FILENAME || basename === GLOBAL_FILENAME) &&
    (!path.basename(path.dirname(file)).startsWith("_") ||
      path.basename(path.dirname(file)) === "__proto__")
  );
}

export function validateContentEntries(entries: ContentEntry[]) {
  const slugs = new Set<string>();

  for (const { entry, hasCollection, hasGlobal, isBlank } of entries) {
    if (isBlank) continue;

    if (entry === "__proto__")
      throw new Error("Reserved content slug: __proto__");
    if (entry.startsWith("_")) continue;
    if (hasCollection && hasGlobal)
      throw new Error(`Duplicate content slug: ${entry}`);

    const normalizedSlug = entry.toLowerCase();
    if (slugs.has(normalizedSlug))
      throw new Error(`Duplicate content slug: ${entry}`);
    slugs.add(normalizedSlug);
  }
}

export function validateCollectionEntries(entries: CollectionEntry[]) {
  validateContentEntries(
    entries.map((entry) => ({
      entry: entry.entry,
      hasCollection: true,
      hasGlobal: false,
      isBlank: entry.isBlank,
    })),
  );
}

export async function readCollectionEntries(root: string) {
  const cmsDir = path.join(root, CMS_DIR);

  try {
    return await readdir(cmsDir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readOptionalSource(file: string) {
  try {
    return await readFile(file, "utf-8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

async function readContentEntry(
  cmsDir: string,
  entry: string,
): Promise<ContentEntry | null> {
  const [collectionSource, globalSource] = await Promise.all([
    readOptionalSource(path.join(cmsDir, entry, COLLECTION_FILENAME)),
    readOptionalSource(path.join(cmsDir, entry, GLOBAL_FILENAME)),
  ]);

  if (collectionSource === null && globalSource === null) return null;

  const sources = [collectionSource, globalSource].filter(
    (source): source is string => source !== null,
  );
  return {
    entry,
    hasCollection: collectionSource !== null,
    hasGlobal: globalSource !== null,
    isBlank: sources.every((source) => !source.trim()),
  };
}

async function discoverContent(root: string) {
  const cmsDir = path.join(root, CMS_DIR);
  const entries = await readCollectionEntries(root);
  const contentEntries = (
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .filter(
          (entry) =>
            isCollectionEntry(entry.name) || entry.name === "__proto__",
        )
        .map((entry) => readContentEntry(cmsDir, entry.name)),
    )
  ).filter((entry): entry is ContentEntry => entry !== null);

  contentEntries.sort((a, b) => a.entry.localeCompare(b.entry));
  validateContentEntries(contentEntries);

  return contentEntries.filter(
    ({ entry, isBlank }) => !isBlank && isCollectionEntry(entry),
  );
}

export async function discoverCollections(
  root: string,
): Promise<CollectionFile[]> {
  const cmsDir = path.join(root, CMS_DIR);
  const contentEntries = await discoverContent(root);

  return contentEntries
    .filter(({ hasCollection }) => hasCollection)
    .map(({ entry }) => ({
      file: path.join(cmsDir, entry, COLLECTION_FILENAME),
      slug: entry,
    }));
}

export async function discoverGlobals(root: string): Promise<GlobalFile[]> {
  const cmsDir = path.join(root, CMS_DIR);
  const contentEntries = await discoverContent(root);

  return contentEntries
    .filter(({ hasGlobal }) => hasGlobal)
    .map(({ entry }) => ({
      file: path.join(cmsDir, entry, GLOBAL_FILENAME),
      slug: entry,
    }));
}
