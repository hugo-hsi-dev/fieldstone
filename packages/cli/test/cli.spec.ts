import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { describe, expect, it } from "vitest";

const packageRoot = path.dirname(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);
const cliPath = path.join(packageRoot, "bin", "fieldstone.mjs");

function runFieldstone(
  command: "generate" | "push",
  cwd: string,
  databaseURL: string | undefined = ":memory:",
) {
  return new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
    const env = { ...process.env };
    if (databaseURL === undefined) {
      delete env.DATABASE_URL;
    } else {
      env.DATABASE_URL = databaseURL;
    }
    const child = spawn(process.execPath, [cliPath, command], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stderr, stdout });
        return;
      }

      reject(
        new Error(`fieldstone ${command} exited ${code}\n${stdout}\n${stderr}`),
      );
    });
  });
}

function runFieldstoneGenerate(cwd: string) {
  return runFieldstone("generate", cwd);
}

describe("fieldstone cli", () => {
  it("loads collections with the app Vite config", async () => {
    const tmpRoot = path.join(packageRoot, ".tmp");
    await mkdir(tmpRoot, { recursive: true });
    const root = await mkdtemp(path.join(tmpRoot, "fieldstone-cli-"));

    try {
      await mkdir(path.join(root, "src"), { recursive: true });
      await mkdir(path.join(root, "src", "cms", "posts"), { recursive: true });
      await writeFile(
        path.join(root, "vite.config.ts"),
        `import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
\tresolve: {
\t\talias: {
\t\t\t$fields: path.resolve('src/fields.ts')
\t\t}
\t}
});
`,
      );
      await writeFile(
        path.join(root, "src", "fields.ts"),
        `import { text } from '@fieldstone/schema';

export const title = text({ name: 'title', required: true });
`,
      );
      await writeFile(
        path.join(root, "src", "cms", "posts", "+collection.ts"),
        `import { collection } from '@fieldstone/schema';
import { title } from '$fields';

export default collection({
\tfields: [title]
});
`,
      );

      await runFieldstoneGenerate(root);
      const schema = await readFile(
        path.join(root, ".fieldstone", "schema.ts"),
        "utf-8",
      );

      expect(schema).toContain(
        'export const collection_posts = sqliteTable("posts"',
      );
      expect(schema).toContain('title: text("title").notNull()');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects prototype-mutating collection slugs", async () => {
    const tmpRoot = path.join(packageRoot, ".tmp");
    await mkdir(tmpRoot, { recursive: true });
    const root = await mkdtemp(path.join(tmpRoot, "fieldstone-cli-"));

    try {
      await mkdir(path.join(root, "src", "cms", "__proto__"), {
        recursive: true,
      });
      await writeFile(
        path.join(root, "src", "cms", "__proto__", "+collection.ts"),
        `import { collection, text } from '@fieldstone/schema';

export default collection({
\tfields: [text({ name: 'title', required: true })]
});
`,
      );

      await expect(runFieldstoneGenerate(root)).rejects.toThrow(
        "Reserved content slug: __proto__",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
