import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertSafeStorageKey,
  DEFAULT_STATIC_DIR,
  LocalDiskStorage,
  resolveStorage,
} from "../src/index.js";

const TRAVERSAL_KEYS = [
  "",
  "../escape",
  "a/../../escape",
  "/abs",
  "a/./b",
  "a\\b",
  "x\0y",
  "C:/Windows/system32",
  "file:stream",
];

describe("LocalDiskStorage", () => {
  it("round-trips put/get/delete and builds urls", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "fs-storage-"));
    try {
      const storage = new LocalDiskStorage({ staticDir: dir, staticURL: "/media" });
      const bytes = new TextEncoder().encode("hello");

      await storage.put("a/b/file.txt", bytes);
      const got = await storage.get("a/b/file.txt");
      expect(got?.size).toBe(5);
      expect(new TextDecoder().decode(got!.body)).toBe("hello");
      expect(await readFile(path.join(dir, "a/b/file.txt"), "utf8")).toBe("hello");

      expect(storage.url("a/b/file.txt")).toBe("/media/a/b/file.txt");
      expect(await storage.get("missing.txt")).toBeNull();

      await storage.delete("a/b/file.txt");
      expect(await storage.get("a/b/file.txt")).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects path-traversal keys in both the guard and local storage", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "fs-storage-"));
    try {
      const storage = new LocalDiskStorage({ staticDir: dir });
      for (const key of TRAVERSAL_KEYS) {
        expect(() => assertSafeStorageKey(key), key).toThrow();
        await expect(storage.put(key, new Uint8Array()), key).rejects.toThrow();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("resolveStorage", () => {
  it("defaults to local disk and honors staticURL", () => {
    expect(resolveStorage({}).url("x.png")).toBe("/media/x.png");
    expect(resolveStorage({ storage: { staticURL: "/files" } }).url("x.png")).toBe("/files/x.png");
    expect(DEFAULT_STATIC_DIR).toBe(".fieldstone/uploads");
  });
});
