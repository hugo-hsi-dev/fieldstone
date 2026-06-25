import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { describe, expect, it } from "vitest";

import { runInit } from "../bin/init.mjs";

const packageRoot = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const cliPath = path.join(packageRoot, "bin", "fieldstone.mjs");
const schemaEntry = path.resolve(packageRoot, "../schema/src/index.ts");

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

      reject(new Error(`fieldstone ${command} exited ${code}\n${stdout}\n${stderr}`));
    });
  });
}

function runFieldstoneGenerate(cwd: string) {
  return runFieldstone("generate", cwd);
}

function runFieldstoneBin(args: string[], cwd: string) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (err) => {
      stderr += `\n${String(err)}`;
      resolve({ code: 1, stdout, stderr });
    });
    child.on("close", (code, signal) =>
      resolve({ code: code ?? (signal ? 1 : 0), stdout, stderr }),
    );
  });
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
\t\t\t$fields: path.resolve('src/fields.ts'),
\t\t\t'@hugo-hsi-dev/schema': ${JSON.stringify(schemaEntry)}
\t\t}
\t}
});
`,
      );
      await writeFile(
        path.join(root, "src", "fields.ts"),
        `import { text } from '@hugo-hsi-dev/schema';

export const title = text({ name: 'title', required: true });
`,
      );
      await writeFile(
        path.join(root, "src", "cms", "posts", "+collection.ts"),
        `import { collection } from '@hugo-hsi-dev/schema';
import { title } from '$fields';

export default collection({
\tfields: [title]
});
`,
      );

      await runFieldstoneGenerate(root);
      const schema = await readFile(path.join(root, ".fieldstone", "schema.ts"), "utf-8");

      expect(schema).toContain('export const collection_posts = sqliteTable("posts"');
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
        `import { collection, text } from '@hugo-hsi-dev/schema';

export default collection({
\tfields: [text({ name: 'title', required: true })]
});
`,
      );

      await expect(runFieldstoneGenerate(root)).rejects.toThrow("Reserved content slug: __proto__");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("init scaffolds Fieldstone into a SvelteKit app and merges package.json", async () => {
    const tmpRoot = path.join(packageRoot, ".tmp");
    await mkdir(tmpRoot, { recursive: true });
    const root = await mkdtemp(path.join(tmpRoot, "fieldstone-init-"));

    try {
      await writeFile(
        path.join(root, "package.json"),
        JSON.stringify({
          name: "host-app",
          devDependencies: { "@sveltejs/kit": "^2.0.0" },
        }),
      );

      await runInit({ cwd: root, force: true, install: false });

      // Template files are written.
      const vite = await readFile(path.join(root, "vite.config.ts"), "utf-8");
      expect(vite).toContain("@hugo-hsi-dev/vite-plugin");
      const barrel = await readFile(
        path.join(root, "src", "routes", "admin", "dashboard.remote.ts"),
        "utf-8",
      );
      expect(barrel).toContain("@hugo-hsi-dev/admin-runtime/sveltekit");
      const auth = await readFile(path.join(root, "src", "lib", "auth.ts"), "utf-8");
      expect(auth).toContain("betterAuth");

      // package.json deps + scripts are merged, not clobbered.
      const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf-8"));
      expect(pkg.name).toBe("host-app");
      expect(pkg.dependencies["@hugo-hsi-dev/ui"]).toBeDefined();
      expect(pkg.devDependencies["@hugo-hsi-dev/cli"]).toBeDefined();
      expect(pkg.scripts["db:push"]).toBe("fieldstone push");

      // .gitignore gains the Fieldstone artifacts.
      const gitignore = await readFile(path.join(root, ".gitignore"), "utf-8");
      expect(gitignore).toContain(".fieldstone/");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("init leaves existing files untouched without --force", async () => {
    const tmpRoot = path.join(packageRoot, ".tmp");
    await mkdir(tmpRoot, { recursive: true });
    const root = await mkdtemp(path.join(tmpRoot, "fieldstone-init-"));

    try {
      await writeFile(
        path.join(root, "package.json"),
        JSON.stringify({
          name: "host-app",
          devDependencies: { "@sveltejs/kit": "^2.0.0" },
        }),
      );
      await writeFile(path.join(root, "vite.config.ts"), "// my own vite config\n");

      await runInit({ cwd: root, force: false, install: false });

      // The pre-existing vite.config.ts is preserved.
      expect(await readFile(path.join(root, "vite.config.ts"), "utf-8")).toBe(
        "// my own vite config\n",
      );
      // New files are still written.
      expect(await readFile(path.join(root, "src", "lib", "auth.ts"), "utf-8")).toContain(
        "betterAuth",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("routes init through the bin with --cwd and honours --no-install", async () => {
    const tmpRoot = path.join(packageRoot, ".tmp");
    await mkdir(tmpRoot, { recursive: true });
    const root = await mkdtemp(path.join(tmpRoot, "fieldstone-init-bin-"));

    try {
      await writeFile(
        path.join(root, "package.json"),
        JSON.stringify({
          name: "host-app",
          devDependencies: { "@sveltejs/kit": "^2.0.0" },
        }),
      );

      // Run from packageRoot, targeting `root` via --cwd.
      const result = await runFieldstoneBin(
        ["init", "--cwd", root, "--force", "--no-install"],
        packageRoot,
      );

      expect(result.code).toBe(0);
      // --no-install suppresses the install suggestion.
      expect(result.stdout).not.toContain("install dependencies");
      expect(await readFile(path.join(root, "vite.config.ts"), "utf-8")).toContain(
        "@hugo-hsi-dev/vite-plugin",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
