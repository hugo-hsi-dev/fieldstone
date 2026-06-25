import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  discoverContentFiles,
  isWatchedCollectionFile,
  isWatchedGlobalFile,
} from "../src/collections.js";

async function withCollections(
  files: Record<string, string>,
  run: (root: string) => Promise<void>,
) {
  const root = await mkdtemp(path.join(tmpdir(), "fieldstone-codegen-"));
  const cmsDir = path.join(root, "src", "cms");
  await mkdir(cmsDir, { recursive: true });

  try {
    for (const [slug, source] of Object.entries(files)) {
      const collectionDir = path.join(cmsDir, slug);
      await mkdir(collectionDir, { recursive: true });
      await writeFile(path.join(collectionDir, "+collection.ts"), source);
    }

    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("collection discovery", () => {
  it("ignores blank collection files", async () => {
    await withCollections({ draft: "" }, async (root) => {
      await expect(discoverContentFiles(root)).resolves.toMatchObject({ collections: [] });
    });
  });

  it("discovers nonblank collection files", async () => {
    await withCollections({ posts: "export default {};" }, async (root) => {
      await expect(discoverContentFiles(root)).resolves.toMatchObject({
        collections: [
          {
            file: path.join(root, "src", "cms", "posts", "+collection.ts"),
            slug: "posts",
          },
        ],
      });
    });
  });

  it("ignores blank prototype collection files", async () => {
    await withCollections({ ["__proto__"]: "" }, async (root) => {
      await expect(discoverContentFiles(root)).resolves.toMatchObject({ collections: [] });
    });
  });

  it("rejects nonblank prototype collection files", async () => {
    await withCollections({ ["__proto__"]: "export default {};" }, async (root) => {
      await expect(discoverContentFiles(root)).rejects.toThrow("Reserved content slug: __proto__");
    });
  });

  it("discovers global files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-codegen-"));
    await mkdir(path.join(root, "src", "cms", "site-settings"), {
      recursive: true,
    });
    await writeFile(
      path.join(root, "src", "cms", "site-settings", "+global.ts"),
      "export default {};",
    );

    try {
      await expect(discoverContentFiles(root)).resolves.toMatchObject({
        globals: [
          {
            file: path.join(root, "src", "cms", "site-settings", "+global.ts"),
            slug: "site-settings",
          },
        ],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignores blank sibling content files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-codegen-"));
    await mkdir(path.join(root, "src", "cms", "site-settings"), {
      recursive: true,
    });
    await writeFile(path.join(root, "src", "cms", "site-settings", "+collection.ts"), "");
    await writeFile(
      path.join(root, "src", "cms", "site-settings", "+global.ts"),
      "export default {};",
    );

    try {
      await expect(discoverContentFiles(root)).resolves.toEqual({
        collections: [],
        globals: [
          {
            file: path.join(root, "src", "cms", "site-settings", "+global.ts"),
            slug: "site-settings",
          },
        ],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects collection and global files with the same slug", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-codegen-"));
    await mkdir(path.join(root, "src", "cms", "settings"), {
      recursive: true,
    });
    await writeFile(
      path.join(root, "src", "cms", "settings", "+collection.ts"),
      "export default {};",
    );
    await writeFile(path.join(root, "src", "cms", "settings", "+global.ts"), "export default {};");

    try {
      await expect(discoverContentFiles(root)).rejects.toThrow("Duplicate content slug: settings");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects collection files that exist but cannot be read", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-codegen-"));
    await mkdir(path.join(root, "src", "cms", "posts", "+collection.ts"), {
      recursive: true,
    });

    try {
      await expect(discoverContentFiles(root)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not read ignored collection directories", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-codegen-"));
    await mkdir(path.join(root, "src", "cms", "_draft", "+collection.ts"), {
      recursive: true,
    });

    try {
      await expect(discoverContentFiles(root)).resolves.toMatchObject({ collections: [] });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("recognizes watched content files through public predicates", () => {
    const cmsDir = path.join("src", "cms");
    expect(isWatchedCollectionFile(cmsDir, path.join(cmsDir, "posts", "+collection.ts"))).toBe(
      true,
    );
    expect(isWatchedGlobalFile(cmsDir, path.join(cmsDir, "settings", "+global.ts"))).toBe(true);
    expect(isWatchedCollectionFile(cmsDir, path.join(cmsDir, "_draft", "+collection.ts"))).toBe(
      false,
    );
    expect(isWatchedGlobalFile(cmsDir, path.join(cmsDir, "settings", "helper.ts"))).toBe(false);
  });
});
