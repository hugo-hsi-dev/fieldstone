import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { RESOLVED_CONFIG_ID } from "@fieldstone/codegen";
import { fieldstone } from "../src/index.ts";

describe("fieldstone vite plugin", () => {
  it("rejects client imports of $fieldstone-config", () => {
    const plugin = fieldstone({ db: { dialect: "sqlite", url: ":memory:" } });

    expect(() =>
      plugin.resolveId?.call({} as never, "$fieldstone-config", undefined, { ssr: false }),
    ).toThrow("$fieldstone-config is server-only");
  });

  it("reads database url from runtime env in virtual config", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-vite-"));
    await mkdir(path.join(root, "src", "cms", "posts"), { recursive: true });
    await writeFile(path.join(root, "src", "cms", "posts", "+collection.ts"), "");

    try {
      const plugin = fieldstone({ db: { dialect: "sqlite", url: "fallback.db" } });
      plugin.configResolved?.call({} as never, { root } as never);
      const source = await plugin.load?.call({} as never, RESOLVED_CONFIG_ID);

      expect(source).toContain('process.env.DATABASE_URL ?? "fallback.db"');
      expect(source).toContain('dialect: "sqlite"');
      expect(source).not.toContain('import collection0 from "/src/cms/posts/+collection.ts"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects prototype-mutating collection slugs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-vite-"));
    const collectionDir = path.join(root, "src", "cms", "__proto__");
    await mkdir(collectionDir, { recursive: true });
    await writeFile(path.join(collectionDir, "+collection.ts"), "export default {};");

    try {
      const plugin = fieldstone({ db: { dialect: "sqlite", url: ":memory:" } });
      plugin.configResolved?.call({} as never, { root } as never);

      await expect(plugin.load?.call({} as never, RESOLVED_CONFIG_ID)).rejects.toThrow(
        "Reserved collection slug: __proto__",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignores underscored cms dirs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-vite-"));
    await mkdir(path.join(root, "src", "cms", "_draft"), { recursive: true });
    await mkdir(path.join(root, "src", "cms", "posts"), { recursive: true });
    await writeFile(path.join(root, "src", "cms", "_draft", "+collection.ts"), "");
    await writeFile(path.join(root, "src", "cms", "posts", "+collection.ts"), "export default {};");

    try {
      const plugin = fieldstone({ db: { dialect: "sqlite", url: ":memory:" } });
      plugin.configResolved?.call({} as never, { root } as never);

      const source = await plugin.load?.call({} as never, RESOLVED_CONFIG_ID);

      expect(source).toContain('"posts": runtimeCollection0');
      expect(source).not.toContain("_draft");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
