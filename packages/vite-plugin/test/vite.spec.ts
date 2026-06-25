import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { RESOLVED_CONFIG_ID } from "@hugo-hsi-dev/codegen";
import { fieldstone } from "../src/index.js";

type TestPlugin = ReturnType<typeof fieldstone> & {
  configResolved?: {
    call(thisArg: unknown, config: { root: string }): void | Promise<void>;
  };
  load?: {
    call(
      thisArg: unknown,
      id: string,
    ): Promise<string | undefined> | string | undefined;
  };
  resolveId?: {
    call(
      thisArg: unknown,
      source: string,
      importer: string | undefined,
      options: { ssr: boolean },
    ): unknown;
  };
};

function createTestPlugin(
  options: Parameters<typeof fieldstone>[0],
): TestPlugin {
  return fieldstone(options) as TestPlugin;
}

describe("fieldstone vite plugin", () => {
  it("rejects client imports of $fieldstone-config", () => {
    const plugin = createTestPlugin({
      db: { dialect: "sqlite", url: ":memory:" },
    });

    expect(() =>
      plugin.resolveId?.call({}, "$fieldstone-config", undefined, {
        ssr: false,
      }),
    ).toThrow("$fieldstone-config is server-only");
  });

  it("reads database url from runtime env in virtual config", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-vite-"));
    await mkdir(path.join(root, "src", "cms", "posts"), { recursive: true });
    await writeFile(
      path.join(root, "src", "cms", "posts", "+collection.ts"),
      "",
    );

    try {
      const plugin = createTestPlugin({
        db: { dialect: "sqlite", url: "fallback.db" },
      });
      await plugin.configResolved?.call({}, { root });
      const source = await plugin.load?.call({}, RESOLVED_CONFIG_ID);

      expect(source).toContain('process.env.DATABASE_URL ?? "fallback.db"');
      expect(source).toContain('dialect: "sqlite"');
      expect(source).not.toContain(
        'import collection0 from "/src/cms/posts/+collection.ts"',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects prototype-mutating collection slugs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-vite-"));
    const collectionDir = path.join(root, "src", "cms", "__proto__");
    await mkdir(collectionDir, { recursive: true });
    await writeFile(
      path.join(collectionDir, "+collection.ts"),
      "export default {};",
    );

    try {
      const plugin = createTestPlugin({
        db: { dialect: "sqlite", url: ":memory:" },
      });
      await plugin.configResolved?.call({}, { root });

      await expect(plugin.load?.call({}, RESOLVED_CONFIG_ID)).rejects.toThrow(
        "Reserved content slug: __proto__",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignores underscored cms dirs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fieldstone-vite-"));
    await mkdir(path.join(root, "src", "cms", "_draft"), { recursive: true });
    await mkdir(path.join(root, "src", "cms", "posts"), { recursive: true });
    await writeFile(
      path.join(root, "src", "cms", "_draft", "+collection.ts"),
      "",
    );
    await writeFile(
      path.join(root, "src", "cms", "posts", "+collection.ts"),
      "export default {};",
    );

    try {
      const plugin = createTestPlugin({
        db: { dialect: "sqlite", url: ":memory:" },
      });
      await plugin.configResolved?.call({}, { root });

      const source = await plugin.load?.call({}, RESOLVED_CONFIG_ID);

      expect(source).toContain('"posts": runtimeCollection0');
      expect(source).not.toContain("_draft");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
