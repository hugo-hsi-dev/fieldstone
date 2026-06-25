# @hugo-hsi-dev/vite-plugin

## 0.3.0

### Patch Changes

- 8359d26: Internal cleanup from a repo-wide over-engineering audit (no API or behavior change):

  - runtime: use `Object.hasOwn` instead of a hand-rolled `hasOwn`, and dedupe the
    byte-identical `isPlainObject` predicate (now shared from `where.ts`).
  - vite-plugin: collapse the three identical chokidar watch handlers (`add` /
    `change` / `unlink`) into one shared listener, and drop a single-use type alias.
  - @hugo-hsi-dev/codegen@0.3.0
  - @hugo-hsi-dev/compiler@0.3.0
  - @hugo-hsi-dev/schema@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [5b766de]
  - @hugo-hsi-dev/schema@0.2.0
  - @hugo-hsi-dev/codegen@0.2.0
  - @hugo-hsi-dev/compiler@0.2.0

## 0.1.2

### Patch Changes

- Updated dependencies [2c73af1]
  - @hugo-hsi-dev/schema@0.1.2
  - @hugo-hsi-dev/codegen@0.1.2
  - @hugo-hsi-dev/compiler@0.1.2

## 0.1.0

### Patch Changes

- Updated dependencies [f7d6111]
  - @hugo-hsi-dev/schema@0.1.0
  - @hugo-hsi-dev/codegen@0.1.0
  - @hugo-hsi-dev/compiler@0.1.0
