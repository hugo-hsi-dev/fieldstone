# @hugo-hsi-dev/schema

## 0.3.0

## 0.2.0

### Minor Changes

- 5b766de: Data-layer features that make installed apps production-deployable:

  - **Non-interactive schema apply** — `fieldstone push --yes` (with `--allow-data-loss`) runs unattended in CI/production instead of blocking on a prompt.
  - **Typed `where` query builder** on `find`/`count` — Payload-style operators (`equals`, `greater_than`, `in`, `like`, `exists`, …) with `and`/`or` groups, generated per-collection `Where<T>` types, and a REST `?where=` param.
  - **Relationship `populate`** via `depth` — replaces relation/upload ids with the target document(s), access-checked (per-row read rules) and multi-level, with a recursive `PopulatedDocument<T, Depth>` type and a REST `?depth=` param.

## 0.1.2

### Patch Changes

- 2c73af1: Add a `repository` field to each package, enabling npm provenance attestations via
  trusted publishing. Re-unifies all 11 packages in lockstep at 0.1.2 — a single
  changeset entry bumps the whole fixed group.

## 0.1.0

### Minor Changes

- f7d6111: First public release of Fieldstone — a Payload-style CMS for SvelteKit. Define
  collections in code and get a generated SQLite schema, a typed in-process Local API,
  and a batteries-included admin UI. Scaffold it into any SvelteKit app with
  `fieldstone init`. (All `@hugo-hsi-dev/*` packages version in lockstep.)
