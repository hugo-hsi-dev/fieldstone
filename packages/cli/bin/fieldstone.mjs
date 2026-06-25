#!/usr/bin/env node
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs as parseNodeArgs } from "node:util";

import { runInit } from "./init.mjs";

const HELP = `Fieldstone — a Payload-style CMS for SvelteKit

Usage: fieldstone <command> [options]

Commands:
  init        Scaffold Fieldstone into the current SvelteKit app
  generate    Generate the SQLite schema + types from your collections
  push        Apply the schema to the database

Options:
  --cwd <dir>         Run in a different directory
  --force             (init) Overwrite existing files instead of skipping them
  --no-install        (init) Don't suggest installing dependencies afterward
  -y, --yes           (push) Apply schema changes without prompting (CI-safe)
  --allow-data-loss   (push) Allow destructive changes during a non-interactive push
  -h, --help          Show this help
  -v, --version       Show the version
`;

/** @param {string[]} argv */
function parseArgs(argv) {
  let parsed;
  try {
    parsed = parseNodeArgs({
      args: argv,
      allowPositionals: true,
      options: {
        cwd: { type: "string" },
        force: { type: "boolean" },
        "no-install": { type: "boolean" },
        yes: { type: "boolean", short: "y" },
        "allow-data-loss": { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  const values = parsed.values;
  return {
    command: parsed.positionals[0],
    flags: {
      cwd: path.resolve(values.cwd ?? process.cwd()),
      force: Boolean(values.force),
      install: !values["no-install"],
      yes: Boolean(values.yes),
      allowDataLoss: Boolean(values["allow-data-loss"]),
      help: Boolean(values.help),
      version: Boolean(values.version),
    },
  };
}

const { command, flags } = parseArgs(process.argv.slice(2));

if (flags.version) {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
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
    { CONFIG_ID, loadFieldstoneConfig, pushSchema, writeAdminRemotesBarrel, writeGeneratedFiles },
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
    const didPush = await pushSchema(config, compiled, {
      yes: flags.yes,
      allowDataLoss: flags.allowDataLoss,
    });
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
