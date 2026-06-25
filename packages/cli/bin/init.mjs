import { glob, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ADMIN_REMOTES_BARREL_PATH, renderAdminRemotesBarrel } from "@hugo-hsi-dev/codegen";

const TEMPLATES_DIR = fileURLToPath(new URL("../templates", import.meta.url));

// The lockstep version of the @hugo-hsi-dev/* packages a scaffolded app depends on.
const FIELDSTONE_VERSION = "^0.1.0";

/** @type {Record<string, string>} */
const DEPENDENCIES = {
  "@hugo-hsi-dev/admin-runtime": FIELDSTONE_VERSION,
  "@hugo-hsi-dev/schema": FIELDSTONE_VERSION,
  "@hugo-hsi-dev/ui": FIELDSTONE_VERSION,
  "@hugo-hsi-dev/vite-plugin": FIELDSTONE_VERSION,
  "@libsql/client": "^0.15.15",
  "better-auth": "^1.6.19",
  "drizzle-orm": "^0.45.2",
};

/** @type {Record<string, string>} */
const DEV_DEPENDENCIES = {
  "@hugo-hsi-dev/cli": FIELDSTONE_VERSION,
};

/** @type {Record<string, string>} */
const SCRIPTS = {
  "fieldstone:generate": "fieldstone generate",
  "db:push": "fieldstone push",
};

const GITIGNORE_ENTRIES = [".fieldstone/", "*.db", "*.db-shm", "*.db-wal"];

/** @param {string} file */
async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** @param {string} file */
async function isNonEmptyFile(file) {
  try {
    const stats = await stat(file);
    return stats.isFile() && stats.size > 0;
  } catch {
    return false;
  }
}

async function templateFiles() {
  const files = [];
  for await (const entry of glob("**/*", { cwd: TEMPLATES_DIR, withFileTypes: true })) {
    if (entry.isFile()) files.push(path.relative(TEMPLATES_DIR, path.join(entry.parentPath, entry.name)));
  }
  return files;
}

/** @param {string} relativePath */
function templateFileSource(relativePath) {
  if (relativePath === ADMIN_REMOTES_BARREL_PATH) return renderAdminRemotesBarrel();
  return readFile(path.join(TEMPLATES_DIR, relativePath));
}

/**
 * @param {string} cwd
 * @param {string[]} written
 * @param {(message: string) => void} log
 */
async function mergePackageJson(cwd, written, log) {
  const pkgPath = path.join(cwd, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  let changed = false;

  /** @type {[string, Record<string, string>][]} */
  const merges = [
    ["dependencies", DEPENDENCIES],
    ["devDependencies", DEV_DEPENDENCIES],
    ["scripts", SCRIPTS],
  ];
  for (const [field, additions] of merges) {
    pkg[field] ??= {};
    for (const [key, value] of Object.entries(additions)) {
      if (pkg[field][key] === undefined) {
        pkg[field][key] = value;
        changed = true;
      }
    }
  }

  if (changed) {
    await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    written.push("package.json");
  } else {
    log("package.json already has the Fieldstone deps + scripts");
  }
}

/**
 * @param {string} cwd
 * @param {string[]} written
 * @param {(message: string) => void} log
 */
async function updateGitignore(cwd, written, log) {
  const gitignorePath = path.join(cwd, ".gitignore");
  const current = (await exists(gitignorePath)) ? await readFile(gitignorePath, "utf8") : "";
  const lines = current.split("\n");
  const missing = GITIGNORE_ENTRIES.filter((entry) => !lines.some((line) => line.trim() === entry));
  if (missing.length === 0) {
    log(".gitignore already ignores the Fieldstone artifacts");
    return;
  }
  const prefix = current.length === 0 || current.endsWith("\n") ? "" : "\n";
  await writeFile(gitignorePath, `${current}${prefix}\n# Fieldstone\n${missing.join("\n")}\n`);
  written.push(".gitignore");
}

/** @param {{ cwd: string, force: boolean, install: boolean }} options */
export async function runInit({ cwd, force, install }) {
  /** @param {string} message */
  const log = (message) => console.log(`  ${message}`);

  // 1. Require an existing SvelteKit app — Fieldstone composes onto one rather than
  //    reimplementing SvelteKit's scaffolding.
  const pkgPath = path.join(cwd, "package.json");
  if (!(await exists(pkgPath))) {
    console.error(
      "No package.json here. Create a SvelteKit app first (`npx sv create`), then run `fieldstone init`.",
    );
    process.exitCode = 1;
    return;
  }
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const hasKit = pkg.devDependencies?.["@sveltejs/kit"] || pkg.dependencies?.["@sveltejs/kit"];
  if (!hasKit && !force) {
    console.error(
      "@sveltejs/kit not found — this doesn't look like a SvelteKit app.\nCreate one with `npx sv create`, then re-run `fieldstone init` (or pass --force).",
    );
    process.exitCode = 1;
    return;
  }

  console.log("Setting up Fieldstone...\n");

  // 2. Copy template files. Never clobber existing non-empty files without --force.
  /** @type {string[]} */
  const written = [];
  /** @type {string[]} */
  const skipped = [];
  for (const relativePath of [...new Set([...(await templateFiles()), ADMIN_REMOTES_BARREL_PATH])]) {
    const target = path.join(cwd, relativePath);
    if (!force && (await isNonEmptyFile(target))) {
      skipped.push(relativePath);
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await templateFileSource(relativePath));
    written.push(relativePath);
  }

  // 3. Merge package.json deps/scripts and the .gitignore entries.
  await mergePackageJson(cwd, written, log);
  await updateGitignore(cwd, written, log);

  // 4. Report.
  console.log("");
  if (written.length) {
    console.log("Created / updated:");
    for (const file of written.sort()) log(file);
  }
  if (skipped.length) {
    console.log("\nSkipped (already exist — re-run with --force to overwrite):");
    for (const file of skipped.sort()) log(file);
  }

  console.log("\nNext steps:");
  if (skipped.includes("vite.config.ts")) {
    log(
      "merge the Fieldstone Vite config into your vite.config.ts (the fieldstone() plugin + experimental flags — see the skipped template)",
    );
  }
  if (install) {
    log("install dependencies (e.g. `pnpm install`)");
  }
  log("set BETTER_AUTH_SECRET in .env (copy .env.example) — the dev fallback is insecure");
  log("`fieldstone push` to create the SQLite schema, then start your dev server");
  log("open /admin and register the first account");
}
