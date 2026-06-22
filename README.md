# Fieldstone

A [Payload](https://payloadcms.com)-style headless CMS built **for SvelteKit**. You
define collections in code, Fieldstone compiles them into a SQLite schema, generates
typed access, and ships a batteries-included admin UI — all running inside the same
SvelteKit app that consumes the content.

> **Status: early / experimental.** The data layer (schema → compiler → runtime Local
> API), admin UI, and an example app are real and tested. Packaging for external
> installation, a setup CLI, and image/upload support are not built yet — see
> [Scope](#scope--roadmap). Today the supported way to use Fieldstone is to work inside
> this monorepo against the `test/minimal` example app.

## What it does

- **Collections & globals as code** — `text`, `email`, `number`, `date`, `select`,
  `boolean`, `relationship`, `group`, `array`, and `richText` fields with validation,
  defaults, and admin options.
- **Local API** — `find` / `findById` / `create` / `update` / `delete` / `count` with
  hooks, access control, drafts, and nested fields, executed in-process.
- **Generated types** — your collections become TypeScript types and a SQLite schema
  that can't drift from each other.
- **Admin UI** — list/detail/edit views, search, pagination, drafts, dark mode, and a
  rich-text editor, mounted at `/admin`.
- **SQLite only**, via Drizzle + libsql. One embedded host app is the only consumer, so
  data flows through the Local API and admin remote functions.

## Requirements

- Node — version pinned in [`.node-version`](.node-version) (24.x)
- pnpm — version pinned by the `packageManager` field (11.x); run `corepack enable` to
  match it automatically

## Quick start (run the example)

```bash
pnpm install
pnpm dev          # starts the test/minimal app (Vite dev server)
```

Open `http://localhost:5173/admin`. The first time, you'll be redirected to `/login` —
register an account (any signed-in user can reach the admin in this example), then you're
in.

The dev server pushes the CMS schema automatically on start
(`FIELDSTONE_PUSH_ON_CONFIGURE=true` is wired into the dev script). No `.env` is required
to run locally; see [`test/minimal/.env.example`](test/minimal/.env.example) for the
configurable values (and the production auth-secret footgun).

## How a SvelteKit app wires it up

The [`test/minimal`](test/minimal) app is the reference setup. The moving pieces:

1. **Collections** live in `src/cms/<slug>/+collection.ts`:

   ```ts
   import { collection, text } from '@fieldstone/schema';

   export default collection({
     fields: [
       text({ name: 'title', required: true }),
       text({ name: 'description', multiline: true, required: true })
     ]
   });
   ```

2. **Vite plugin** in `vite.config.ts` compiles those collections into a virtual
   `$fieldstone-config` module and `.fieldstone/types.d.ts`. It needs SvelteKit's
   experimental remote functions and async features enabled:

   ```ts
   import { fieldstone } from '@fieldstone/vite-plugin';
   // plugins: [ fieldstone({ db: { dialect: 'sqlite', url: 'local.db' } }), sveltekit({ ... }) ]
   // sveltekit experimental: { remoteFunctions: true }, compilerOptions.experimental.async: true
   ```

3. **Admin remotes** in `src/routes/admin/dashboard.remote.ts` expose the Local API to
   the admin UI:

   ```ts
   import config from '$fieldstone-config';
   import { createFieldstoneAdminRemotes } from '@fieldstone/remotes';
   export const { listCollections, listDocuments, getDocument, createDocument /* ... */ } =
     createFieldstoneAdminRemotes({ config });
   ```

4. **Admin route** `src/routes/admin/[...segments]/+page.svelte` renders the UI:

   ```svelte
   <script lang="ts">
     import '@fieldstone/ui/admin.css';
     import { FieldstoneAdmin } from '@fieldstone/ui';
     import * as remotes from '../dashboard.remote';
   </script>
   <FieldstoneAdmin {remotes} />
   ```

5. **Auth** (`src/lib/auth.ts`) and **`src/hooks.server.ts`** protect `/admin` and serve
   `/api/auth/*` (Better Auth, email + password). An optional external REST API can be
   mounted at `src/routes/api/[...path]/+server.ts` via `createFieldstoneRest`.

### Schema generate / push loop

Editing collections changes the schema. In dev the Vite plugin regenerates types and the
dev script pushes automatically. To run them by hand (e.g. before a build):

```bash
DATABASE_URL=local.db pnpm --dir test/minimal fieldstone:generate   # regenerate types
DATABASE_URL=local.db pnpm db:push                                  # apply schema to SQLite
```

> Schema changes apply via Drizzle's interactive push (dev-only). Versioned migrations
> for production are on the roadmap.

## Repository layout

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
  codegen/        type generation + schema push
  cli/            fieldstone CLI (generate / push)
test/minimal/     reference SvelteKit app exercising every feature
config/           shared eslint / prettier / tsconfig / oxlint
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | run the example app |
| `pnpm build` | production build of the example app |
| `pnpm typecheck` | typecheck every package |
| `pnpm test` | unit tests + e2e |
| `pnpm test:unit` | package unit tests (Vitest) |
| `pnpm test:e2e` | admin end-to-end tests (Playwright) |
| `pnpm lint` | ESLint + per-package lint |
| `pnpm format` | Prettier / formatter write |
| `pnpm db:push` | push the CMS schema to SQLite |

CI runs lint, typecheck, unit, build, and e2e on every push and pull request
(see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Scope / roadmap

Current focus:

1. The embedding SvelteKit app is the only consumer (Local API + admin remotes).
2. Easy setup — a `fieldstone init` CLI plus a documented manual path. *(planned)*
3. SQLite only.
4. Image / upload support, mirroring Payload's feature set. *(planned)*
