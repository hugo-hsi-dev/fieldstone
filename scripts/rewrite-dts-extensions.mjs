#!/usr/bin/env node
// Rewrite relative `.ts` import specifiers to `.js` in emitted `.d.ts` files.
//
// This codebase imports with explicit `.ts` extensions (allowImportingTsExtensions).
// tsc's `rewriteRelativeImportExtensions` fixes the emitted JS but NOT declarations,
// so without this the shipped `.d.ts` would import `./x.ts` while dist only contains
// `./x.d.ts`/`./x.js` — dangling for consumers. Matches only quoted relative
// specifiers (`./` or `../`) ending in `.ts`, in `from "..."` and `import("...")`.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: rewrite-dts-extensions <dir>");
  process.exit(1);
}

// The optional `.d` group keeps `./x.d.ts` specifiers intact (they must stay
// declaration references) while plain `./x.ts` becomes `./x.js`.
const RELATIVE_TS = /((?:from\s*|import\s*\(\s*)["'])(\.\.?\/[^"']+?)(\.d)?\.ts(["'])/g;

async function walk(d) {
  for (const entry of await readdir(d, { withFileTypes: true })) {
    const p = join(d, entry.name);
    if (entry.isDirectory()) {
      await walk(p);
    } else if (entry.name.endsWith(".d.ts")) {
      const src = await readFile(p, "utf8");
      const out = src.replace(RELATIVE_TS, (_m, prefix, specifier, dtsMarker, quote) =>
        dtsMarker ? `${prefix}${specifier}.d.ts${quote}` : `${prefix}${specifier}.js${quote}`,
      );
      if (out !== src) await writeFile(p, out);
    }
  }
}

await walk(dir);
