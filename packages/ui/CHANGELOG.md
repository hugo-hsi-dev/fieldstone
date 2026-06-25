# @hugo-hsi-dev/ui

## 0.3.0

### Minor Changes

- 3fbdf64: Reskin the admin UI to the "Fieldstone Admin System" design — a quiet,
  content-first look built on one restrained violet accent over a precise neutral
  base, the Geist typeface, and hairline borders instead of shadows.

  - **Design tokens** — new light + dark palettes (violet primary `#6d5ae6`),
    13px body, 11px uppercase field labels with a violet required marker, radii
    capped at 8px, and a status-pill scale (published / draft / warning / danger).
    Geist is loaded via `@import` with a system-sans fallback.
  - **Shell** — a full-height sidebar (brand · nav · theme toggle) with a thin
    breadcrumb bar over the content; the index groups collections and globals into
    card sections with two-letter monogram chips.
  - **Navigation** — monogram chips and a violet-tint active pill.
  - **Lists** — `select` fields render as status pills and number columns are
    right-aligned with tabular figures.
  - **Forms** — nested `group`/`array` fields use indent + a left rule instead of
    nested cards.

  No API or markup contract changes: every existing label, heading, button name,
  and hook-facing class is preserved (all admin e2e pass unchanged).

### Patch Changes

- @hugo-hsi-dev/admin-runtime@0.3.0
- @hugo-hsi-dev/schema@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [5b766de]
  - @hugo-hsi-dev/schema@0.2.0

## 0.1.2

### Patch Changes

- Updated dependencies [2c73af1]
  - @hugo-hsi-dev/schema@0.1.2

## 0.1.0

### Patch Changes

- Updated dependencies [f7d6111]
  - @hugo-hsi-dev/schema@0.1.0
