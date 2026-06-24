# Fieldstone

A [Payload](https://payloadcms.com)-style headless CMS built **for SvelteKit**. You
define collections in code, Fieldstone compiles them into a SQLite schema, generates
typed access, and ships a batteries-included admin UI — all running inside the same
SvelteKit app that consumes the content.

> **Status: early / experimental.** The data layer (schema → compiler → runtime Local
> API), the admin UI, the publishable `@hugo-hsi-dev/*` packages, and the `fieldstone init`
> scaffolder are real and tested. The packages are not on npm yet (the release is the
> last step of the current milestone) — until then you can use Fieldstone from a local
> checkout (see [Contributing](#contributing)). Image/upload support is still
> [planned](#roadmap).

## What it does

- **Collections & globals as code** — `text`, `email`, `number`, `date`, `select`,
  `boolean`, `relationship`, `group`, `array`, and `richText` fields with validation,
  defaults, and admin options.
- **Local API** — `find` / `findById` / `create` / `update` / `delete` / `count` with
  hooks, access control, drafts, and nested fields, executed in-process.
- **Generated types** — your collections become TypeScript types and a SQLite schema
  that can't drift from each other.
- **Admin UI** — list/detail/edit views, search, pagination, drafts, dark mode, and a
  rich-text editor, mounted at `/admin`, protected by Better Auth.
- **SQLite only**, via Drizzle + libsql. One embedded host app is the only consumer, so
  data flows through the Local API and admin remote functions.

## Getting started

Fieldstone composes onto a SvelteKit app — it doesn't replace `sv create`. Start from a
new (or existing) SvelteKit project, then scaffold Fieldstone into it:

This quick start assumes a **brand-new** app, where `--force` may freely overwrite the
trivial `sv create` boilerplate. For an **existing** app, run `fieldstone init` _without_
`--force` (see below).

```bash
npx sv create my-app          # a brand-new SvelteKit app
cd my-app

npm install -D @hugo-hsi-dev/cli
npx fieldstone init --force    # scaffold Fieldstone over the fresh-app boilerplate

npm install                    # install the dependencies init added
echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)" >> .env

npx fieldstone push            # create the SQLite schema
npm run dev                    # open http://localhost:5173/admin and register the first account
```

`fieldstone init` scaffolds the host surface (the `vite.config.ts` with the Fieldstone
plugin, the admin route + generated remotes barrel, a Better Auth stack + login page, a
sample collection, hooks, and the app shell), merges the required dependencies and
scripts into your `package.json`, and adds the Fieldstone entries to `.gitignore`.

- On a **brand-new** app, `--force` lets Fieldstone overwrite the trivial `sv create`
  boilerplate (`vite.config.ts`, `app.html`, `app.d.ts`).
- On an **existing** app, run without `--force`: Fieldstone never clobbers your files —
  it writes only what's missing and tells you which ones to merge by hand (notably your
  `vite.config.ts`, which must add the `fieldstone()` plugin + the experimental flags).

> `fieldstone init --help` lists every command and flag.

### Defining content

Collections live in `src/cms/<slug>/+collection.ts`; globals in `+global.ts`:

```ts
import { collection, text, richText } from '@hugo-hsi-dev/schema';

export default collection({
  fields: [
    text({ name: 'title', required: true }),
    richText({ name: 'body' })
  ],
  drafts: true
});
```

Whenever you change a collection, regenerate the types + schema and re-apply it:

```bash
npx fieldstone generate   # regenerate .fieldstone/types.d.ts + the schema + the remotes barrel
npx fieldstone push       # apply the schema to SQLite
```

In dev, the Vite plugin regenerates types automatically as you edit collections.

> Schema changes apply via Drizzle's interactive push (dev-oriented). Versioned
> migrations for production are on the [roadmap](#roadmap).

## How the pieces fit

`fieldstone init` wires these up for you; here's what they are.

1. **Vite plugin** (`vite.config.ts`) compiles `src/cms/*` into a virtual
   `$fieldstone-config` module + `.fieldstone/types.d.ts`. It needs SvelteKit's
   experimental remote functions and async compiler features enabled (the scaffolded
   config sets these inline on `sveltekit({ ... })`).
2. **Admin remotes** (`src/routes/admin/dashboard.remote.ts`, generated) expose the Local
   API to the admin UI via `createFieldstoneAdminRemotes({ config })`.
3. **Admin route** (`src/routes/admin/[...segments]/+page.svelte`) renders
   `<FieldstoneAdmin {remotes} />` from `@hugo-hsi-dev/ui` (+ `@hugo-hsi-dev/ui/admin.css`).
4. **Auth** (`src/lib/auth.ts` + `src/hooks.server.ts`) protects `/admin` and serves
   `/api/auth/*` (Better Auth, email + password). An optional REST API mounts at
   `src/routes/api/[...path]/+server.ts` via `createFieldstoneRest`.

## Contributing

This is a pnpm monorepo. The `test/minimal` app dogfoods every feature against the real
`fieldstone` bin.

```bash
corepack enable        # use the pinned pnpm (see the packageManager field)
pnpm install
pnpm dev               # build the packages, then run test/minimal at /admin
```

Requirements: Node (pinned in [`.node-version`](.node-version)) and pnpm 11.

```text
packages/
  schema/         field & collection definitions, validation, types
  compiler/       collections -> SchemaPlan (DDL + runtime config)
  runtime/        Local API (find/create/update/delete, hooks, access)
  vite-plugin/    virtual $fieldstone-config + generated types
  remotes/        SvelteKit remote functions for the admin
  admin-runtime/  REST handler + admin glue
  ui/             admin UI (Svelte components + admin.css)
  routes/         admin route helpers (path parsing)
  codegen/        type generation + schema push + the remotes barrel
  cli/            the `fieldstone` bin (init / generate / push) + scaffold templates
test/minimal/     reference SvelteKit app exercising every feature
config/           shared eslint / prettier / tsconfig / oxlint presets (private)
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | build packages, run the example app |
| `pnpm build` | build packages + production build of the example app |
| `pnpm build:packages` | build the publishable `@hugo-hsi-dev/*` packages |
| `pnpm typecheck` | typecheck every package |
| `pnpm test` | unit tests + e2e |
| `pnpm test:unit` / `pnpm test:e2e` | package unit tests / Playwright admin tests |
| `pnpm lint` / `pnpm format` | lint / format |
| `pnpm check:publish` | publint + are-the-types-wrong on every package |
| `pnpm changeset` | record a versioning changeset for a release |

CI gates lint, typecheck, unit, `check:publish`, build, and e2e on every push and PR
(see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Releases are driven by
[Changesets](https://github.com/changesets/changesets) — see
[`.github/workflows/release.yml`](.github/workflows/release.yml).

## Roadmap

Current focus — "make it consumable":

1. ✅ Publishable `@hugo-hsi-dev/*` packages.
2. ✅ Easy setup — `fieldstone init` + a documented manual path.
3. ✅ SQLite only.
4. ⬜ Image / upload support, mirroring Payload's feature set.

Then: versioned production migrations, a typed `where` query builder, relationship
population, and extracting the Better Auth stack into `@hugo-hsi-dev/auth`.
