#!/usr/bin/env node
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

import { runInit } from "./init.mjs";

const HELP = `Fieldstone — a Payload-style CMS for SvelteKit

Usage: fieldstone <command> [options]

Commands:
  init        Scaffold Fieldstone into the current SvelteKit app
  generate    Generate the SQLite schema + types from your collections
  push        Apply the schema to the database

Options:
  --cwd <dir>     Run in a different directory
  --force         (init) Overwrite existing files instead of skipping them
  --no-install    (init) Don't suggest installing dependencies afterward
  -h, --help      Show this help
  -v, --version   Show the version
`;

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {string[]} */
  const positional = [];
  /** @type {{ cwd: string, force: boolean, install: boolean, help?: boolean, version?: boolean }} */
  const flags = { cwd: process.cwd(), force: false, install: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--cwd") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        console.error("Missing value for --cwd");
        process.exit(1);
      }
      flags.cwd = path.resolve(next);
      i++;
    } else if (arg === "--force") flags.force = true;
    else if (arg === "--no-install") flags.install = false;
    else if (arg === "--help" || arg === "-h") flags.help = true;
    else if (arg === "--version" || arg === "-v") flags.version = true;
    else if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    } else positional.push(arg);
  }
  return { command: positional[0], flags };
}

const { command, flags } = parseArgs(process.argv.slice(2));

if (flags.version) {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  console.log(pkg.version);
  process.exit(0);
}

if (flags.help || !command || command === "help") {
  console.log(HELP);
  process.exit(0);
}

if (command === "init") {
  await runInit(flags);
  process.exit(process.exitCode ?? 0);
}

if (command !== "generate" && command !== "push") {
  console.error(`Unknown command: ${command}\n`);
  console.log(HELP);
  process.exit(1);
}

// generate / push: boot Vite against the app's own config so collection modules
// (and aliases) resolve, then drive @hugo-hsi-dev/codegen.
const { createServer } = await import("vite");
const root = flags.cwd;
const require = createRequire(import.meta.url);
const previousGenerateEnv = process.env.FIELDSTONE_GENERATE;
process.env.FIELDSTONE_GENERATE = "true";

const server = await createServer({
  root,
  server: { middlewareMode: true },
});

try {
  const generatorModulePath = require.resolve("@hugo-hsi-dev/codegen");
  const coreModulePath = require.resolve("@hugo-hsi-dev/compiler");
  const [
    {
      CONFIG_ID,
      loadFieldstoneConfig,
      pushSchema,
      writeAdminRemotesBarrel,
      writeGeneratedFiles,
    },
    { compileFieldstoneConfig },
  ] = await Promise.all([
    server.ssrLoadModule(generatorModulePath),
    server.ssrLoadModule(coreModulePath),
  ]);
  const config =
    command === "push"
      ? (await server.ssrLoadModule(CONFIG_ID)).default
      : await loadFieldstoneConfig({
          loadModule: (/** @type {string} */ id) => server.ssrLoadModule(id),
          root,
        });
  const compiled = compileFieldstoneConfig(config);

  if (command === "push") {
    const didPush = await pushSchema(config, compiled);
    if (!didPush) process.exitCode = 1;
  } else {
    await writeGeneratedFiles({ compiled, root });
    await writeAdminRemotesBarrel(root);
  }
} finally {
  await server.close();
  if (previousGenerateEnv === undefined) {
    delete process.env.FIELDSTONE_GENERATE;
  } else {
    process.env.FIELDSTONE_GENERATE = previousGenerateEnv;
  }
}
