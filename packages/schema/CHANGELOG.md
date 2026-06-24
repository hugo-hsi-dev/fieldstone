# @hugo-hsi-dev/schema

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
