import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StorageConfig } from "@fieldstone/schema";

export type StorageObject = {
  body: Uint8Array;
  size: number;
  contentType?: string;
};

// A pluggable file backend. v1 ships LocalDiskStorage; an S3-compatible adapter
// implements the same surface in a later slice (its url() returns a CDN/signed
// URL and the media route 302-redirects to it instead of streaming bytes).
export interface StorageAdapter {
  put(
    key: string,
    body: Uint8Array,
    meta?: { contentType?: string },
  ): Promise<void>;
  get(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<void>;
  url(key: string): string;
}

export const DEFAULT_STATIC_DIR = ".fieldstone/uploads";
export const DEFAULT_STATIC_URL = "/media";

// Reject any key that could escape the storage root before it is joined onto a
// filesystem path. Enforced here in the adapter and (in a later slice) again at
// the serve route — keys are attacker-influenced (they ride the request path).
export function assertSafeStorageKey(key: string): string {
  if (typeof key !== "string" || key === "")
    throw new Error("Invalid storage key: empty");
  if (key.includes("\0")) throw new Error("Invalid storage key: null byte");
  for (const segment of key.split("/")) {
    if (segment === "" || segment === "." || segment === "..")
      throw new Error(`Invalid storage key segment: ${JSON.stringify(segment)}`);
    if (segment.includes("\\")) throw new Error("Invalid storage key: backslash");
    // Reject drive-letter / device prefixes (e.g. "C:") and alternate data
    // streams: path.resolve treats them as absolute on Windows, escaping the root.
    if (segment.includes(":")) throw new Error("Invalid storage key: colon");
  }
  return key;
}

function joinUrl(prefix: string, key: string): string {
  const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${base}/${encoded}`;
}

export class LocalDiskStorage implements StorageAdapter {
  readonly #dir: string;
  readonly #urlPrefix: string;

  constructor(options: { staticDir: string; staticURL?: string }) {
    this.#dir = path.resolve(options.staticDir);
    this.#urlPrefix = options.staticURL ?? DEFAULT_STATIC_URL;
  }

  #resolve(key: string): string {
    const safe = assertSafeStorageKey(key);
    const resolved = path.resolve(this.#dir, safe);
    // Defense in depth: even if a key slipped past the segment check, never read
    // or write outside the configured directory.
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

// Resolve the declarative storage block (carried in $fieldstone-config) into a
// live adapter. Runs at runtime — a function adapter can't be serialized into the
// config, so the backend is chosen here from a string discriminator.
export function resolveStorage(config: {
  storage?: StorageConfig;
}): StorageAdapter {
  const storage = config.storage ?? {};
  if (storage.adapter && storage.adapter !== "local")
    // Remote (S3) adapters arrive in a later slice. Fail loudly rather than
    // silently writing to local disk when a remote backend was requested.
    throw new Error(
      `Unsupported storage adapter: ${storage.adapter}. Only "local" is available today.`,
    );
  return new LocalDiskStorage({
    staticDir: storage.staticDir ?? DEFAULT_STATIC_DIR,
    staticURL: storage.staticURL ?? DEFAULT_STATIC_URL,
  });
}
