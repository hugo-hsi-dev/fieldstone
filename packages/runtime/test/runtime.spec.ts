import { createClient } from "@libsql/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

import {
  boolean,
  collection,
  date,
  email,
  global,
  number,
  relationship,
  select,
  text,
  type FieldstoneConfig,
} from "@fieldstone/schema";
import { getFieldstone } from "../src/index.ts";

describe("fieldstone runtime", () => {
  it("does not treat inherited collection keys as valid collections", async () => {
    const stone = await getFieldstone({
      config: {
        db: { dialect: "sqlite", url: ":memory:" },
        collections: {},
      },
    });

    expect(stone.getCollection("toString")).toBeNull();
    await expect(stone.find({ collection: "toString" })).rejects.toThrow(
      "Unsupported collection: toString",
    );
  });

  it("provides the virtual config module declaration from the client entrypoint", { timeout: 20_000 }, () => {
    const source = `
			import { getFieldstone } from '@fieldstone/runtime';
			import config from '$fieldstone-config';

			void getFieldstone({ config });
		`;
    const rootDir = process.cwd().replace(/\/packages\/runtime$/, "");
    const fileName = `${rootDir}/app.ts`;
    const compilerOptions = {
      allowImportingTsExtensions: true,
      baseUrl: rootDir,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      paths: {
        "@fieldstone/runtime": ["packages/runtime/src/index.ts"],
        "@fieldstone/schema": ["packages/schema/src/index.ts"],
      },
      strict: true,
      target: ts.ScriptTarget.ESNext,
    } satisfies ts.CompilerOptions;
    const host = ts.createCompilerHost(compilerOptions);
    const originalReadFile = host.readFile;
    const originalFileExists = host.fileExists;

    host.readFile = (requestedFileName) =>
      requestedFileName === fileName
        ? source
        : originalReadFile(requestedFileName);
    host.fileExists = (requestedFileName) =>
      requestedFileName === fileName || originalFileExists(requestedFileName);

    const program = ts.createProgram([fileName], compilerOptions, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(
      diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      ),
    ).not.toContain(
      "Cannot find module '$fieldstone-config' or its corresponding type declarations.",
    );
  });

  it("types collection-specific documents and mutation data from generated collections", () => {
    const source = `
			import { getFieldstone } from '@fieldstone/runtime';
			import type { FieldstoneConfig } from '@fieldstone/schema';

			declare module '@fieldstone/schema' {
				interface GeneratedCollections {
					"posts": {
						id: string;
						title: string;
						description: string | null;
						published: boolean;
						createdAt: Date;
						updatedAt: Date;
					};
				}
				interface GeneratedGlobals {
					"site-settings": {
						id: string;
						siteTitle: string;
						tagline: string | null;
						showBanner: boolean;
						createdAt: Date;
						updatedAt: Date;
					};
				}
			}

			const config = {
				db: { dialect: 'sqlite', url: ':memory:' },
				collections: {}
			} satisfies FieldstoneConfig;

			async function run() {
				const stone = await getFieldstone({ config });
				const posts = await stone.find({ collection: 'posts' });
				const title: string = posts[0].title;
				const description: string | null = posts[0].description;
				const published: boolean = posts[0].published;
				const createdAt: Date = posts[0].createdAt;

				await stone.create({
					collection: 'posts',
					data: { title: 'Hello', description: 'Body', published: true }
				});

				await stone.create({
					collection: 'posts',
					data: { title: 'Hello' }
				});

				const settings = await stone.getGlobal({ global: 'site-settings' });
				if (settings) {
					const siteTitle: string = settings.siteTitle;
					const tagline: string | null = settings.tagline;
					const showBanner: boolean = settings.showBanner;
				}

				await stone.updateGlobal({
					global: 'site-settings',
					data: { siteTitle: 'Fieldstone', showBanner: true }
				});

				// @ts-expect-error missing configured global field
				await stone.updateGlobal({ global: 'site-settings', data: { tagline: 'Nope' } });

				// @ts-expect-error unknown global
				await stone.getGlobal({ global: 'navigation' });

				// @ts-expect-error missing configured field
				await stone.create({ collection: 'posts', data: { description: 'Body' } });

				// @ts-expect-error unknown collection
				await stone.find({ collection: 'pages' });
			}
		`;
    const diagnostics = getDiagnostics(source);

    expect(diagnostics).toEqual([]);
  });

  it("handles Document reads, mutations, validation, timestamps, and missing rows", async () => {
    const { cleanup, config } = await createRuntimeFixture();

    try {
      const stone = await getFieldstone({ config });
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      const updatedAt = new Date("2026-01-02T00:00:00.000Z");

      await expect(
        stone.create({
          collection: "posts",
          data: { description: "Missing title" },
        }),
      ).rejects.toThrow("title is required");
      await expect(
        stone.create({
          collection: "posts",
          data: {
            title: "Hello",
            description: "Body",
            published: true,
            extra: "Nope",
          },
        }),
      ).rejects.toThrow("Unknown field: extra");

      const created = await stone.create({
        collection: "posts",
        createdAt,
        data: { title: " Hello ", description: " Body ", published: true },
        updatedAt,
      });

      expect(created).toMatchObject({
        title: "Hello",
        description: "Body",
        published: true,
        createdAt,
        updatedAt,
      });

      const emptyOptional = await stone.create({
        collection: "posts",
        data: { title: "Empty optional", description: "" },
      });
      expect(emptyOptional.description).toBeNull();
      expect(emptyOptional.published).toBe(false);

      const omittedOptional = await stone.create({
        collection: "posts",
        data: { title: "Omitted optional" },
      });
      expect(omittedOptional.description).toBeNull();
      expect(omittedOptional.published).toBe(false);

      const listed = await stone.find({ collection: "posts" });
      expect(listed).toHaveLength(3);
      expect(
        await stone.findById({ collection: "posts", id: created.id }),
      ).toMatchObject({
        id: created.id,
        title: "Hello",
        published: true,
      });
      expect(
        await stone.findById({ collection: "posts", id: "missing" }),
      ).toBeNull();

      const defaulted = await stone.create({
        collection: "posts",
        data: { title: "Default timestamps", description: "Generated" },
      });
      expect(defaulted.createdAt).toBeInstanceOf(Date);
      expect(defaulted.updatedAt).toBeInstanceOf(Date);

      const updateTime = new Date("2026-01-03T00:00:00.000Z");
      const updated = await stone.update({
        collection: "posts",
        data: { title: " Updated ", description: " Again ", published: false },
        id: created.id,
        updatedAt: updateTime,
      });
      expect(updated).toMatchObject({
        id: created.id,
        title: "Updated",
        description: "Again",
        published: false,
        updatedAt: updateTime,
      });

      const cleared = await stone.update({
        collection: "posts",
        data: { title: "Cleared optional" },
        id: created.id,
      });
      expect(cleared.description).toBeNull();
      expect(cleared.published).toBe(false);

      await expect(
        stone.update({
          collection: "posts",
          data: { title: "Missing", description: "Missing" },
          id: "missing",
        }),
      ).rejects.toThrow("Document not found");
      await expect(
        stone.delete({ collection: "posts", id: "missing" }),
      ).rejects.toThrow("Document not found");

      expect(await stone.getGlobal({ global: "site-settings" })).toBeNull();
      await expect(
        stone.updateGlobal({
          global: "site-settings",
          data: { tagline: "Missing title" },
        }),
      ).rejects.toThrow("siteTitle is required");

      const updatedGlobalAt = new Date("2026-01-04T00:00:00.000Z");
      const [firstConcurrentSave, secondConcurrentSave] = await Promise.all([
        stone.updateGlobal({
          global: "site-settings",
          data: {
            siteTitle: "Concurrent first save",
            tagline: "First",
            showBanner: true,
          },
        }),
        stone.updateGlobal({
          global: "site-settings",
          data: {
            siteTitle: "Concurrent first save",
            tagline: "Second",
            showBanner: false,
          },
        }),
      ]);
      expect(firstConcurrentSave.id).toBe("global");
      expect(secondConcurrentSave.id).toBe("global");
      await expect(
        stone.getGlobal({ global: "site-settings" }),
      ).resolves.toMatchObject({
        id: "global",
      });

      const settings = await stone.updateGlobal({
        global: "site-settings",
        data: { siteTitle: " Fieldstone ", tagline: " CMS ", showBanner: true },
        updatedAt: updatedGlobalAt,
      });
      expect(settings).toMatchObject({
        id: "global",
        siteTitle: "Fieldstone",
        tagline: "CMS",
        showBanner: true,
        updatedAt: updatedGlobalAt,
      });

      const changedSettings = await stone.updateGlobal({
        global: "site-settings",
        data: { siteTitle: "Fieldstone", tagline: "", showBanner: false },
      });
      expect(changedSettings.id).toBe("global");
      expect(changedSettings.tagline).toBeNull();
      await expect(
        stone.getGlobal({ global: "site-settings" }),
      ).resolves.toMatchObject({
        id: "global",
        siteTitle: "Fieldstone",
        tagline: null,
        showBanner: false,
      });
    } finally {
      await cleanup();
    }
  });

  it("stores and reads number, date, email, and select fields", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-types-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table products (
        id text primary key not null,
        name text not null,
        price real not null,
        launchDate integer,
        contact text,
        status text,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        products: {
          ...collection({
            fields: [
              text({ name: "name", required: true }),
              number({ name: "price", required: true, min: 0 }),
              date({ name: "launchDate" }),
              email({ name: "contact" }),
              select({
                name: "status",
                options: ["draft", "active"],
                defaultValue: "draft",
              }),
            ],
          }),
          slug: "products",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });

      const launch = new Date("2026-06-01T00:00:00.000Z");
      const created = await stone.create({
        collection: "products",
        data: {
          name: "Widget",
          price: "19.99",
          launchDate: launch.toISOString(),
          contact: "sales@example.com",
        },
      });

      expect(created).toMatchObject({
        name: "Widget",
        price: 19.99,
        contact: "sales@example.com",
        status: "draft",
      });
      expect(created.launchDate).toBeInstanceOf(Date);
      expect((created.launchDate as Date).toISOString()).toBe(
        launch.toISOString(),
      );

      const fetched = await stone.findById({
        collection: "products",
        id: created.id,
      });
      expect(fetched?.price).toBe(19.99);
      expect(fetched?.launchDate).toBeInstanceOf(Date);

      await expect(
        stone.create({
          collection: "products",
          data: { name: "Bad", price: "-5" },
        }),
      ).rejects.toThrow("price must be at least 0");
      await expect(
        stone.create({
          collection: "products",
          data: { name: "Bad", price: "1", contact: "nope" },
        }),
      ).rejects.toThrow("contact must be a valid email");
      await expect(
        stone.create({
          collection: "products",
          data: { name: "Bad", price: "1", status: "archived" },
        }),
      ).rejects.toThrow("status must be one of: draft, active");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("stores single and hasMany relationship ids", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-rel-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table authors (
        id text primary key not null,
        name text not null,
        created_at integer not null,
        updated_at integer not null
      );
      create table posts (
        id text primary key not null,
        title text not null,
        author text not null,
        editors text,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        authors: {
          ...collection({ fields: [text({ name: "name", required: true })] }),
          slug: "authors",
        },
        posts: {
          ...collection({
            fields: [
              text({ name: "title", required: true }),
              relationship({ name: "author", relationTo: "authors", required: true }),
              relationship({ name: "editors", relationTo: "authors", hasMany: true }),
            ],
          }),
          slug: "posts",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });
      const ada = await stone.create({
        collection: "authors",
        data: { name: "Ada" },
      });
      const grace = await stone.create({
        collection: "authors",
        data: { name: "Grace" },
      });

      const post = await stone.create({
        collection: "posts",
        data: {
          title: "Hello",
          author: ada.id,
          editors: [ada.id, grace.id],
        },
      });
      expect(post.author).toBe(ada.id);
      expect(post.editors).toEqual([ada.id, grace.id]);

      const fetched = await stone.findById({ collection: "posts", id: post.id });
      expect(fetched?.author).toBe(ada.id);
      expect(fetched?.editors).toEqual([ada.id, grace.id]);

      await expect(
        stone.create({ collection: "posts", data: { title: "No author" } }),
      ).rejects.toThrow("author is required");

      const noEditors = await stone.create({
        collection: "posts",
        data: { title: "Solo", author: grace.id },
      });
      expect(noEditors.editors).toBeNull();
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("defaults and filters draft status", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-drafts-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table posts (
        id text primary key not null,
        title text not null,
        _status text not null,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        posts: {
          ...collection({
            fields: [text({ name: "title", required: true })],
            drafts: true,
          }),
          slug: "posts",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });

      const draft = await stone.create({
        collection: "posts",
        data: { title: "A draft" },
      });
      expect((draft as Record<string, unknown>)._status).toBe("draft");

      const published = await stone.create({
        collection: "posts",
        data: { title: "Live", _status: "published" },
      });
      expect((published as Record<string, unknown>)._status).toBe("published");

      const onlyPublished = await stone.find({
        collection: "posts",
        status: "published",
      });
      expect(onlyPublished).toHaveLength(1);
      expect((onlyPublished[0] as Record<string, unknown>).title).toBe("Live");

      const everything = await stone.find({ collection: "posts" });
      expect(everything).toHaveLength(2);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("paginates, sorts, searches, and counts documents", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-list-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table posts (
        id text primary key not null,
        title text not null,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        posts: {
          ...collection({ fields: [text({ name: "title", required: true })] }),
          slug: "posts",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });
      const titles = ["Apple", "Banana", "Cherry", "apricot"];
      for (const [index, title] of titles.entries()) {
        await stone.create({
          collection: "posts",
          data: { title },
          createdAt: new Date(Date.UTC(2026, 0, index + 1)),
        });
      }

      expect(await stone.count({ collection: "posts" })).toBe(4);

      const matches = await stone.find({ collection: "posts", search: "ap" });
      expect(matches.map((doc) => doc.title).sort()).toEqual(["Apple", "apricot"]);
      expect(await stone.count({ collection: "posts", search: "ap" })).toBe(2);

      const page1 = await stone.find({ collection: "posts", limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);
      const page2 = await stone.find({ collection: "posts", limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);
      expect(new Set([...page1, ...page2].map((doc) => doc.title)).size).toBe(4);

      const sorted = await stone.find({
        collection: "posts",
        sort: { field: "title", direction: "asc" },
      });
      expect(sorted.map((doc) => doc.title)).toEqual([
        "Apple",
        "Banana",
        "Cherry",
        "apricot",
      ]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("enforces collection access functions", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-access-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table secrets (
        id text primary key not null,
        title text not null,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        secrets: {
          ...collection({
            fields: [text({ name: "title", required: true })],
            access: {
              read: ({ user }) => Boolean(user),
              create: ({ user }) => Boolean(user),
              delete: () => false,
            },
          }),
          slug: "secrets",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });

      await expect(stone.find({ collection: "secrets" })).rejects.toThrow("Forbidden");
      expect(await stone.find({ collection: "secrets", user: { id: "u1" } })).toEqual([]);

      await expect(
        stone.create({ collection: "secrets", data: { title: "x" } }),
      ).rejects.toThrow("Forbidden");

      const created = await stone.create({
        collection: "secrets",
        data: { title: "Secret" },
        user: { id: "u1" },
      });
      expect(created.title).toBe("Secret");

      await expect(
        stone.delete({ collection: "secrets", id: created.id, user: { id: "u1" } }),
      ).rejects.toThrow("Forbidden");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("runs collection lifecycle hooks", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-hooks-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table notes (
        id text primary key not null,
        title text not null,
        slug text,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const events: string[] = [];
    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        notes: {
          ...collection({
            fields: [
              text({ name: "title", required: true }),
              text({ name: "slug" }),
            ],
            hooks: {
              beforeChange: [
                ({ data, operation }) => {
                  events.push(`beforeChange:${operation}`);
                  if (!data.slug && typeof data.title === "string")
                    return {
                      ...data,
                      slug: data.title.toLowerCase().replace(/\s+/g, "-"),
                    };
                },
              ],
              afterChange: [
                ({ operation }) => {
                  events.push(`afterChange:${operation}`);
                },
              ],
              afterRead: [
                ({ doc }) => ({ ...doc, title: String(doc.title).toUpperCase() }),
              ],
              beforeDelete: [
                () => {
                  events.push("beforeDelete");
                },
              ],
              afterDelete: [
                ({ doc }) => {
                  events.push(`afterDelete:${String(doc.title)}`);
                },
              ],
            },
          }),
          slug: "notes",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });

      const created = await stone.create({
        collection: "notes",
        data: { title: "Hello World" },
      });
      // beforeChange derived the slug; afterRead is not applied to write results.
      expect(created.slug).toBe("hello-world");
      expect(created.title).toBe("Hello World");
      expect(events).toContain("beforeChange:create");
      expect(events).toContain("afterChange:create");

      const found = await stone.findById({ collection: "notes", id: created.id });
      expect(found?.title).toBe("HELLO WORLD");
      expect(found?.slug).toBe("hello-world");

      const listed = await stone.find({ collection: "notes" });
      expect(listed[0]?.title).toBe("HELLO WORLD");

      const updated = await stone.update({
        collection: "notes",
        data: { title: "New Title" },
        id: created.id,
      });
      expect(updated.slug).toBe("new-title");
      expect(events).toContain("beforeChange:update");
      expect(events).toContain("afterChange:update");

      await stone.delete({ collection: "notes", id: created.id });
      expect(events).toContain("beforeDelete");
      expect(events).toContain("afterDelete:New Title");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});

async function createRuntimeFixture() {
  const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-runtime-"));
  const dbPath = path.join(tempDir, "test.db");
  const client = createClient({ url: `file:${dbPath}` });
  await client.executeMultiple(`
			create table posts (
					id text primary key not null,
					title text not null,
					description text,
					published integer not null,
					created_at integer not null,
					updated_at integer not null
			);
			create table "site-settings" (
					id text primary key not null,
					siteTitle text not null,
					tagline text,
					showBanner integer not null,
					created_at integer not null,
					updated_at integer not null
			);
		`);
  client.close();

  const config: FieldstoneConfig = {
    db: { dialect: "sqlite", url: dbPath },
    collections: {
      posts: {
        ...collection({
          fields: [
            text({ name: "title", required: true }),
            text({ name: "description" }),
            boolean({ name: "published" }),
          ],
        }),
        slug: "posts",
      },
    },
    globals: {
      "site-settings": {
        ...global({
          fields: [
            text({ name: "siteTitle", required: true }),
            text({ name: "tagline" }),
            boolean({ name: "showBanner" }),
          ],
        }),
        slug: "site-settings",
      },
    },
  };

  return {
    cleanup: () => rm(tempDir, { force: true, recursive: true }),
    config,
  };
}

function getDiagnostics(source: string) {
  const rootDir = process.cwd().replace(/\/packages\/runtime$/, "");
  const fileName = `${rootDir}/type-test.ts`;
  const compilerOptions = {
    allowImportingTsExtensions: true,
    baseUrl: rootDir,
    ignoreDeprecations: "6.0",
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    paths: {
      "@fieldstone/runtime": ["packages/runtime/src/index.ts"],
      "@fieldstone/schema": ["packages/schema/src/index.ts"],
    },
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ESNext,
    typeRoots: [`${rootDir}/test/minimal/node_modules/@types`],
    types: ["node"],
  } satisfies ts.CompilerOptions;
  const host = ts.createCompilerHost(compilerOptions);
  const originalReadFile = host.readFile;
  const originalFileExists = host.fileExists;

  host.readFile = (requestedFileName) =>
    requestedFileName === fileName
      ? source
      : originalReadFile(requestedFileName);
  host.fileExists = (requestedFileName) =>
    requestedFileName === fileName || originalFileExists(requestedFileName);

  const program = ts.createProgram([fileName], compilerOptions, host);
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
}
