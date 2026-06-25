import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StorageConfig } from "@hugo-hsi-dev/schema";

export type StorageObject = {
  body: Uint8Array;
  size: number;
};

export const DEFAULT_STATIC_DIR = ".fieldstone/uploads";
export const DEFAULT_STATIC_URL = "/media";

export function assertSafeStorageKey(key: string): string {
  if (typeof key !== "string" || key === "") throw new Error("Invalid storage key: empty");
  if (key.includes("\0")) throw new Error("Invalid storage key: null byte");
  for (const segment of key.split("/")) {
    if (segment === "" || segment === "." || segment === "..")
      throw new Error(`Invalid storage key segment: ${JSON.stringify(segment)}`);
    if (segment.includes("\\")) throw new Error("Invalid storage key: backslash");
    if (segment.includes(":")) throw new Error("Invalid storage key: colon");
  }
  return key;
}

function joinUrl(prefix: string, key: string): string {
  const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${base}/${encoded}`;
}

export class LocalDiskStorage {
  readonly #dir: string;
  readonly #urlPrefix: string;

  constructor(options: { staticDir: string; staticURL?: string }) {
    this.#dir = path.resolve(options.staticDir);
    this.#urlPrefix = options.staticURL ?? DEFAULT_STATIC_URL;
  }

  #resolve(key: string): string {
    const safe = assertSafeStorageKey(key);
    const resolved = path.resolve(this.#dir, safe);
    if (resolved !== this.#dir && !resolved.startsWith(this.#dir + path.sep))
      throw new Error("Storage key escapes the storage directory");
    return resolved;
  }

  async put(key: string, body: Uint8Array): Promise<void> {
    const target = this.#resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async get(key: string): Promise<StorageObject | null> {
    try {
      const body = await readFile(this.#resolve(key));
      return { body, size: body.byteLength };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.#resolve(key), { force: true });
  }

  url(key: string): string {
    return joinUrl(this.#urlPrefix, assertSafeStorageKey(key));
  }
}

export function resolveStorage(config: { storage?: StorageConfig }): LocalDiskStorage {
  const storage = config.storage ?? {};
  return new LocalDiskStorage({
    staticDir: storage.staticDir ?? DEFAULT_STATIC_DIR,
    staticURL: storage.staticURL ?? DEFAULT_STATIC_URL,
  });
}
