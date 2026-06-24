---
"@hugo-hsi-dev/schema": minor
---

Data-layer features that make installed apps production-deployable:

- **Non-interactive schema apply** — `fieldstone push --yes` (with `--allow-data-loss`) runs unattended in CI/production instead of blocking on a prompt.
- **Typed `where` query builder** on `find`/`count` — Payload-style operators (`equals`, `greater_than`, `in`, `like`, `exists`, …) with `and`/`or` groups, generated per-collection `Where<T>` types, and a REST `?where=` param.
- **Relationship `populate`** via `depth` — replaces relation/upload ids with the target document(s), access-checked (per-row read rules) and multi-level, with a recursive `PopulatedDocument<T, Depth>` type and a REST `?depth=` param.
