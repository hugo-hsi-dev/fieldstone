---
"@hugo-hsi-dev/runtime": patch
"@hugo-hsi-dev/vite-plugin": patch
---

Internal cleanup from a repo-wide over-engineering audit (no API or behavior change):

- runtime: use `Object.hasOwn` instead of a hand-rolled `hasOwn`, and dedupe the
  byte-identical `isPlainObject` predicate (now shared from `where.ts`).
- vite-plugin: collapse the three identical chokidar watch handlers (`add` /
  `change` / `unlink`) into one shared listener, and drop a single-use type alias.
