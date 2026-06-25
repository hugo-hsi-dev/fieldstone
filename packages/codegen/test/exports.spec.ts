import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import * as codegen from "../src/index.js";

describe("fieldstone codegen exports", () => {
  it("exposes generation helpers without Vite plugin exports", () => {
    expect(codegen).toHaveProperty("loadFieldstoneConfig");
    expect(codegen).toHaveProperty("writeGeneratedFiles");
    expect(codegen).toHaveProperty("renderAdminRemotesBarrel");
    expect(codegen).toHaveProperty("writeAdminRemotesBarrel");
    expect(codegen).not.toHaveProperty("createCollectionScaffold");
    expect(codegen).not.toHaveProperty("scaffoldCollectionFile");
    expect(codegen).not.toHaveProperty("fieldstone");
  });

  it("discovers collection files under src/cms route directories", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-codegen-"));
    await mkdir(path.join(root, "src", "cms", "posts"), { recursive: true });
    await mkdir(path.join(root, "src", "cms", "pages"), { recursive: true });
    await writeFile(path.join(root, "src", "cms", "posts", "+collection.ts"), "export default {};");
    await writeFile(path.join(root, "src", "cms", "pages", "+collection.ts"), "export default {};");

    try {
      await expect(codegen.discoverContentFiles(root)).resolves.toMatchObject({
        collections: [
          {
            file: path.join(root, "src", "cms", "pages", "+collection.ts"),
            slug: "pages",
          },
          {
            file: path.join(root, "src", "cms", "posts", "+collection.ts"),
            slug: "posts",
          },
        ],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignores underscored cms dirs and rejects reserved collection slugs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-codegen-"));
    await mkdir(path.join(root, "src", "cms", "_draft"), { recursive: true });
    await mkdir(path.join(root, "src", "cms", "__proto__"), {
      recursive: true,
    });
    await writeFile(path.join(root, "src", "cms", "_draft", "+collection.ts"), "");
    await writeFile(
      path.join(root, "src", "cms", "__proto__", "+collection.ts"),
      "export default {};",
    );

    try {
      await expect(codegen.discoverContentFiles(root)).rejects.toThrow(
        "Reserved content slug: __proto__",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("loads virtual config from src/cms collection and global files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-codegen-"));
    await mkdir(path.join(root, "src", "cms", "posts"), { recursive: true });
    await mkdir(path.join(root, "src", "cms", "site-settings"), {
      recursive: true,
    });
    await writeFile(path.join(root, "src", "cms", "posts", "+collection.ts"), "export default {};");
    await writeFile(
      path.join(root, "src", "cms", "site-settings", "+global.ts"),
      "export default {};",
    );

    try {
      const source = await codegen.loadVirtualConfig(root, {
        db: { dialect: "sqlite", url: "fallback.db" },
      });

      expect(source).toContain('import collection0 from "/src/cms/posts/+collection.ts"');
      expect(source).toContain('"posts": runtimeCollection0');
      expect(source).toContain('import global0 from "/src/cms/site-settings/+global.ts"');
      expect(source).toContain('"site-settings": runtimeGlobal0');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serializes the storage block into the virtual config only when set", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-codegen-"));
    await mkdir(path.join(root, "src", "cms"), { recursive: true });

    try {
      const withStorage = await codegen.loadVirtualConfig(root, {
        db: { dialect: "sqlite", url: "fallback.db" },
        storage: { staticDir: "uploads", staticURL: "/files" },
      });
      expect(withStorage).toContain('storage: {"staticDir":"uploads","staticURL":"/files"}');

      const withoutStorage = await codegen.loadVirtualConfig(root, {
        db: { dialect: "sqlite", url: "fallback.db" },
      });
      expect(withoutStorage).not.toContain("storage:");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
